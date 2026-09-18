import {handleContribution} from './contributions.mjs';
export {ContributionStore} from './contributions.mjs';
import {handle} from './core.mjs';
import {viewer,accessConfigured} from './access.mjs';
const response=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
const catalogCache=new WeakMap();
async function catalogAsset(env,request){
 if(!catalogCache.has(env.ASSETS))catalogCache.set(env.ASSETS,(async()=>{const r=await env.ASSETS.fetch(new Request(new URL('/artworks.json',request.url)));if(!r.ok)throw Error('catalog unavailable');const bytes=new Uint8Array(await r.arrayBuffer());let raw='';for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.subarray(i,i+8192));return {'/artworks.json':{body:btoa(raw),type:'application/json'}};})());
 try{return await catalogCache.get(env.ASSETS);}catch(e){catalogCache.delete(env.ASSETS);throw e;}
}
export default {async fetch(request,env){
 try{
  const url=new URL(request.url),path=url.pathname;
  if(!path.startsWith('/api/'))return env.ASSETS.fetch(request);
  if(path==='/api/contributions')return await handleContribution(request,env,async()=>{const assets=await catalogAsset(env,request);const binary=atob(assets['/artworks.json'].body);return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary,c=>c.charCodeAt(0))));});
  if(path==='/api/account'&&request.method==='GET'){const user=await viewer(request,env);return response({signedIn:!!user,uploadsReady:accessConfigured(env)&&!!env.DB&&!!env.BUCKET,loginUrl:'/api/private/login'});}
  if(path==='/api/private/login'&&request.method==='GET'){
   if(!accessConfigured(env))return new Response('个人画库登录尚未配置。馆藏浏览和搜索已可使用。',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
   const user=await viewer(request,env);return user?Response.redirect(url.origin+'/',303):new Response('登录尚未完成。请为 /api/private/* 配置 Cloudflare Access 邮箱登录。',{status:401,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  }
  if(path.startsWith('/api/private/uploads')){
   const user=await viewer(request,env);if(!user)return response({error:'请先登录个人画库。'},401);
   const target=new URL(request.url);target.pathname=path.replace('/api/private/uploads','/api/uploads');
   return handle(new Request(target,request),env,{},user.id);
  }
  if(path==='/api/uploads'||path.startsWith('/api/uploads/'))return response({error:'请使用个人画库入口。'},404);
  if(path.startsWith('/api/search')){
   if(request.headers.get('sec-fetch-site')==='cross-site')return response({error:'请从画遇页面搜索。'},403);
   const key=request.headers.get('cf-connecting-ip')||'local';
   const limiter=path==='/api/search/image'?env.IMAGE_LIMITER:env.SEARCH_LIMITER;
   if(!limiter)return response({error:'搜索服务尚未配置。'},503);
   if(!(await limiter.limit({key})).success)return response({error:'搜索较频繁，请稍等一分钟。'},429);
   const user=await viewer(request,env);
   return handle(request,env,path==='/api/search'?await catalogAsset(env,request):{},user?.id||'guest:'+key);
  }
  return response({error:'没有这个操作。'},404);
 }catch{return response({error:'服务暂时不可用，请稍后重试。'},503);}
}};
