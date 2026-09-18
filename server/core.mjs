import {handleAiRequest,checkOpenAIConnection} from './ai.mjs';
import {searchPaintings,fetchPaintingImage} from './search.mjs';
import { TAGS } from '../public/logic.mjs';
const MAX_BODY=6500000;
const decodedAssets=new WeakMap(),catalogAssets=new WeakMap();
function localCatalog(assets){const file=assets['/artworks.json'];if(!file)return [];if(!catalogAssets.has(file)){try{const binary=atob(file.body),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));catalogAssets.set(file,JSON.parse(new TextDecoder().decode(bytes)));}catch{catalogAssets.set(file,[]);}}return catalogAssets.get(file);}
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','vary':'Cookie'}});
const fail=(message,status)=>{const e=new Error(message);e.status=status;throw e;};
function db(env){if(!env.DB||!env.BUCKET)fail('画库暂时不可用，请稍后重试。',503);return env.DB;}
function owner(id){if(!id)fail('请登录后使用个人画库。',401);return id;}
function writeOrigin(request){const origin=request.headers.get('origin');if(!origin||origin!==new URL(request.url).origin)fail('请从画遇页面提交。',403);}
function str(value,max,required=false){if(typeof value!=='string'||value.length>max||(required&&!value.trim()))fail('请检查画作信息的格式和长度。',400);return value.trim();}
export function validateMetadata(input){
  if(!input||typeof input!=='object')fail('请填写画作信息。',400);
  const title=str(input.title,120,true),artist=str(input.artist||'作者未知',120),date=str(input.date||'年代未知',80),notes=str(input.notes||'',1500),sourceUrl=str(input.sourceUrl||'',1500);
  if(sourceUrl){let u;try{u=new URL(sourceUrl)}catch{fail('来源链接需以 https:// 或 http:// 开头。',400)}if(!['https:','http:'].includes(u.protocol)||u.username||u.password)fail('请使用有效的网页来源链接。',400);}
  if(!Array.isArray(input.tags)||input.tags.length>TAGS.length||input.tags.some(t=>!TAGS.includes(t)))fail('存在尚不支持的筛选标签。',400);
  if(!Array.isArray(input.colors)||input.colors.length<1||input.colors.length>5||input.colors.some(c=>!/^#[a-f0-9]{6}$/i.test(c)))fail('无法读取画面配色，请重新选择图片。',400);
  const tags=[...new Set(input.tags)];return {title,titleZh:title,artist,date,sourceUrl,notes,tags,colors:input.colors,evidence:Object.fromEntries(tags.map(t=>[t,`上传者确认画面包含「${t}」；未经馆藏核验。`])),composition:notes||'这幅作品由你手动添加，可以根据画面自行记录拍摄灵感。',photoTips:[],museum:'我的画库 · 用户添加',review:'画作资料与标签由上传者填写，未经馆藏核验。',userAdded:true};
}
async function boundedForm(request){
  if(Number(request.headers.get('content-length'))>MAX_BODY)fail('图片过大，请选择小于 10 MB 的原图。',413);
  if(!request.headers.get('content-type')?.startsWith('multipart/form-data'))fail('请通过上传表单添加图片。',415);
  const reader=request.body?.getReader();if(!reader)fail('上传内容为空。',400);let total=0;const chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_BODY){await reader.cancel();fail('处理后的图片仍然过大，请换一张较小图片。',413)}chunks.push(value);}
  try{return await new Response(new Blob(chunks),{headers:{'content-type':request.headers.get('content-type')}}).formData()}catch{fail('上传内容无法解析，请重新选择图片。',400)}
}
function record(row){const data=JSON.parse(row.metadata);return {...data,id:row.id,image:'/api/private/uploads/'+row.id+'/image',createdAt:row.created_at};}
export async function handle(request,env,assets={},authenticatedUser=null){
 try{
  const url=new URL(request.url),path=url.pathname;
  if(path.startsWith('/api/')){
   const user=owner(authenticatedUser);
   if(path==='/api/search/connectivity'&&request.method==='GET')return json(await checkOpenAIConnection());
   if(['/api/search/web','/api/search/verify'].includes(path)&&request.method==='POST'){writeOrigin(request);return json(await handleAiRequest(request,user));}
   if(path==='/api/search'&&request.method==='GET')return json(await searchPaintings(url.searchParams.get('q')||'',fetch,{page:Number(url.searchParams.get('page')||0),source:url.searchParams.get('source')||'all',catalog:localCatalog(assets)}));
   if(path==='/api/search/image'&&request.method==='GET')return await fetchPaintingImage(url.searchParams.get('url')||'');
   const database=db(env);
   if(path==='/api/uploads'&&request.method==='GET'){
    const result=await database.prepare('SELECT id, metadata, created_at FROM paintings WHERE owner = ? ORDER BY created_at DESC LIMIT 201').bind(user).all();return json({artworks:(result.results||[]).map(record)});
   }
   if(path==='/api/uploads'&&request.method==='POST'){
    writeOrigin(request);const form=await boundedForm(request),id=form.get('id');if(typeof id!=='string'||!/^user-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))fail('上传标识无效，请重新打开上传窗口。',400);
    let raw;try{raw=JSON.parse(form.get('metadata'))}catch{fail('画作信息无法解析。',400)}const data=validateMetadata(raw),metadata=JSON.stringify(data),file=form.get('image');
    if(!file||typeof file.arrayBuffer!=='function'||file.size>6000000||file.size<4)fail('请选择有效的图片。',400);
    const bytes=new Uint8Array(await file.arrayBuffer());if(bytes[0]!==255||bytes[1]!==216||bytes[2]!==255||bytes.at(-2)!==255||bytes.at(-1)!==217)fail('图片处理失败，请重新选择 JPG、PNG 或 WebP 图片。',415);
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
    const existing=await database.prepare('SELECT id, owner, metadata, content_hash, created_at FROM paintings WHERE id = ?').bind(id).first();
    if(existing){if(existing.owner!==user||existing.content_hash!==hash||existing.metadata!==metadata)fail('上传信息发生变化，请重新打开上传窗口。',409);return json({artwork:record(existing)});}
    const count=await database.prepare('SELECT COUNT(*) AS count FROM paintings WHERE owner = ?').bind(user).first();if(count.count>=200)fail('个人画库已达到 200 幅，请先删除不需要的作品。',409);
    const objectKey='paintings/'+id+'.jpg',createdAt=Date.now();
    await env.BUCKET.put(objectKey,bytes,{httpMetadata:{contentType:'image/jpeg'}});
    try{await database.prepare('INSERT INTO paintings (id, owner, metadata, object_key, content_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(id,user,metadata,objectKey,hash,createdAt).run();}
    catch(e){const saved=await database.prepare('SELECT id, owner, metadata, content_hash, created_at FROM paintings WHERE id = ?').bind(id).first();if(saved?.owner===user&&saved.content_hash===hash&&saved.metadata===metadata)return json({artwork:record(saved)});if(!saved)await env.BUCKET.delete(objectKey);throw e;}
    return json({artwork:record({id,metadata,created_at:createdAt})},201);
   }
   const match=path.match(/^\/api\/uploads\/(user-[0-9a-f-]+)(\/image)?$/i);
   if(match){
    const row=await database.prepare('SELECT id, owner, object_key FROM paintings WHERE id = ? AND owner = ?').bind(match[1],user).first();if(!row)fail('找不到这幅个人画作。',404);
    if(match[2]&&request.method==='GET'){const object=await env.BUCKET.get(row.object_key);if(!object)fail('图片暂时无法读取。',404);return new Response(object.body,{headers:{'content-type':'image/jpeg','cache-control':'private, no-store','x-content-type-options':'nosniff','content-disposition':'inline; filename="painting.jpg"','vary':'Cookie'}});}
    if(!match[2]&&request.method==='DELETE'){writeOrigin(request);await database.prepare('DELETE FROM paintings WHERE id = ? AND owner = ?').bind(match[1],user).run();try{await env.BUCKET.delete(row.object_key)}catch{console.error('paintlight_object_cleanup_failed')}return json({deleted:true});}
   }
   return json({error:'没有这个操作。'},404);
  }
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  const asset=assets[path==='/'?'/index.html':path];if(!asset)return new Response('Not found',{status:404});
  let body=null;if(request.method!=='HEAD'){body=decodedAssets.get(asset);if(!body){const binary=atob(asset.body);body=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)body[i]=binary.charCodeAt(i);decodedAssets.set(asset,body);}}return new Response(body,{headers:{'content-type':asset.type,'cache-control':path.startsWith('/images/')?'public, max-age=86400':'no-cache','x-content-type-options':'nosniff'}});
 }catch(error){if(!error.status)console.error('paintlight_request_failed',error.message);return json({error:error.status?error.message:'保存服务暂时不可用，请稍后重试；表单内容会保留。'},error.status||503);}
}
