const searchCache=new Map();
const textOnly=value=>String(value||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim().slice(0,700);
import {translateSearch} from '../public/search-terms.mjs';
export {translateSearch};
function webUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:''}catch{return '';}}
export function allowedImage(value){try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port)return false;return (u.hostname==='images.metmuseum.org'&&u.pathname.startsWith('/CRDImages/'))||(['upload.wikimedia.org','thumb.wikimedia.org'].includes(u.hostname)&&u.pathname.startsWith('/wikipedia/commons/'))||(u.hostname==='www.artic.edu'&&u.pathname.startsWith('/iiif/2/'))||(u.hostname==='api.smk.dk'&&/^\/api\/v1\/thumbnail\/[a-zA-Z0-9-]+\.(jpg|png|webp)$/.test(u.pathname))||(['iip.smk.dk','iip-thumb.smk.dk'].includes(u.hostname)&&u.pathname.startsWith('/iiif/'));}catch{return false;}}
async function fetchJson(url,fetcher=fetch,timeout=10000){const r=await fetcher(url,{headers:{'User-Agent':'Paintlight/0.3 (artwork discovery)'},signal:AbortSignal.timeout(timeout)});if(!r.ok)throw new Error('Source unavailable');return r.json();}
function candidate(data){return {...data,title:textOnly(data.title),artist:textOnly(data.artist)||'作者待核实',date:textOnly(data.date)||'年代待核实',description:textOnly(data.description),sourceUrl:webUrl(data.sourceUrl),imageUrl:allowedImage(data.imageUrl)?data.imageUrl:'',verified:false};}
export function normalizeCommons(data){return Object.values(data.query?.pages||{}).sort((a,b)=>(a.index||0)-(b.index||0)).flatMap(p=>{
 const info=p.imageinfo?.[0];if(!info||!['image/jpeg','image/png','image/webp'].includes(info.mime))return[];const ext=info.extmetadata||{},v=k=>ext[k]?.value||'';const cats=textOnly(v('Categories'));const originalDate=textOnly(v('DateTimeOriginal')).replace(/date QS:.*/,'').trim();const year=originalDate.match(/(?:^|\D)((?:1[0-9]|20)\d{2})(?:\D|$)/)?.[1];if(year&&(Number(year)>1930||Number(year)<1400))return[];
 if(!/paint|oil on|canvas|水彩|油画|绘画/i.test(cats+' '+v('ImageDescription')+' '+v('Medium')+' '+p.title))return[];
 const license=textOnly(v('LicenseShortName'));return [candidate({id:'commons-'+p.pageid,title:v('ObjectName')||p.title.replace(/^File:/,''),artist:v('Artist'),date:originalDate,description:v('ImageDescription'),source:'Wikimedia Commons',sourceUrl:info.descriptionurl,imageUrl:info.thumburl||info.url,license,credit:textOnly(v('Credit')),importAllowed:/public domain|CC0/i.test(license)})];
 });}
const SEARCH_PAGE_SIZE=12;
async function commonsSearch(query,fetcher,page){
 const params=new URLSearchParams({action:'query',format:'json',generator:'search',gsrsearch:query+' painting',gsrnamespace:'6',gsrlimit:'16',gsroffset:String(page*16),prop:'imageinfo',iiprop:'url|mime|extmetadata',iiurlwidth:'800'});
 const data=await fetchJson('https://commons.wikimedia.org/w/api.php?'+params,fetcher);return {items:normalizeCommons(data),hasMore:!!data.continue};
}
async function metSearch(query,fetcher,page){
 const params=new URLSearchParams({q:query,hasImages:'true',dateBegin:'1400',dateEnd:'1930',medium:'Paintings',limit:String(SEARCH_PAGE_SIZE),offset:String(page*SEARCH_PAGE_SIZE)});
 const ids=await fetchJson('https://collectionapi.metmuseum.org/public/collection/v1.1/search?'+params,fetcher);
 const records=await Promise.allSettled((ids.objectIDs||[]).slice(0,SEARCH_PAGE_SIZE).map(id=>fetchJson('https://collectionapi.metmuseum.org/public/collection/v1/objects/'+id,fetcher)));
 const items=records.flatMap(r=>{if(r.status!=='fulfilled')return[];const a=r.value;if(!a.isPublicDomain||!a.primaryImageSmall||a.objectBeginDate>1930||a.objectEndDate<1400||!/painting/i.test(a.classification+' '+a.objectName))return[];return[candidate({id:'met-'+a.objectID,title:a.title,artist:a.artistDisplayName,date:a.objectDate,description:a.medium,source:'大都会艺术博物馆',sourceUrl:a.objectURL,imageUrl:a.primaryImageSmall,license:'Public domain / CC0',importAllowed:true})];});
 return {items,hasMore:(page+1)*SEARCH_PAGE_SIZE<(ids.total||0)};
}
async function aicSearch(query,fetcher,page){
 const params=new URLSearchParams({q:query,limit:String(SEARCH_PAGE_SIZE),page:String(page+1),fields:'id,title,artist_display,date_display,date_start,date_end,image_id,is_public_domain,artwork_type_title,thumbnail','query[term][is_public_domain]':'true'});
 const d=await fetchJson('https://api.artic.edu/api/v1/artworks/search?'+params,fetcher);
 const items=(d.data||[]).filter(a=>a.is_public_domain&&a.image_id&&a.artwork_type_title==='Painting'&&a.date_start<=1930&&a.date_end>=1400).map(a=>candidate({id:'aic-'+a.id,title:a.title,artist:a.artist_display,date:a.date_display,description:a.thumbnail?.alt_text,source:'芝加哥艺术博物馆',sourceUrl:'https://www.artic.edu/artworks/'+a.id,imageUrl:'https://www.artic.edu/iiif/2/'+a.image_id+'/full/843,/0/default.jpg',license:'Public domain / CC0',importAllowed:true}));
 return {items,hasMore:(d.pagination?.total_pages||0)>page+1};
}
export function normalizeSMK(d){
 return (d.items||[]).filter(a=>{const date=a.production_date?.[0],start=Number(date?.start?.slice(0,4)),end=Number(date?.end?.slice(0,4));return a.public_domain===true&&a.image_thumbnail&&start>=1400&&end<=1930&&a.object_names?.some(n=>n.name?.toLowerCase()==='maleri');}).map(a=>candidate({id:'smk-'+a.object_number,title:(a.titles?.find(t=>/english|engelsk/i.test(t.language))||a.titles?.[0])?.title,artist:a.artist?.join(', '),date:a.production_date?.[0]?.period,description:a.techniques?.join('; '),source:'丹麦国家美术馆',sourceUrl:a.frontend_url,imageUrl:a.image_thumbnail,license:'Public domain · 馆方标记',importAllowed:true}));
}
async function smkSearch(query,fetcher,page){
 const params=new URLSearchParams({keys:query,filters:'[public_domain:true],[has_image:true],[object_names:Maleri]',range:'[production_dates_start:{1400-01-01T00:00:00Z;1930-12-31T23:59:59Z}]',rows:String(SEARCH_PAGE_SIZE),offset:String(page*SEARCH_PAGE_SIZE)});
 const data=await fetchJson('https://api.smk.dk/api/v1/art/search/?'+params,fetcher,22000);return {items:normalizeSMK(data),hasMore:(page+1)*SEARCH_PAGE_SIZE<(data.found||0)};
}
export function searchLocalCatalog(query,catalog,page=0){
 const tokens=translateSearch(query).toLowerCase().split(/\s+/).filter(Boolean);
 const matches=catalog.filter(a=>{const hay=[a.title,a.titleZh,a.artist,a.medium,...(a.searchTerms||[]),...(a.tags||[]).map(translateSearch)].join(' ').toLowerCase();return tokens.every(t=>hay.includes(t));});
 return {items:matches.slice(page*SEARCH_PAGE_SIZE,(page+1)*SEARCH_PAGE_SIZE).map(a=>({...candidate({id:a.id,title:a.titleZh||a.title,artist:a.artist,date:a.date,description:a.medium||a.composition,source:a.museum,sourceUrl:a.sourceUrl,imageUrl:a.museumImageUrl,license:'Public domain · 馆方标记',importAllowed:true}),localImage:a.image,verified:false})),hasMore:(page+1)*SEARCH_PAGE_SIZE<matches.length};
}
export async function searchPaintings(query,fetcher=fetch,options={}){
 const page=options.page??0,source=options.source||'all';
 if(typeof query!=='string'||!query.trim()||query.trim().length>160||!Number.isInteger(page)||page<0||page>99||!['all','library','met','commons','aic','smk'].includes(source)){const e=new Error('请检查搜索词、来源或页码。');e.status=400;throw e;}query=query.trim();
 const translated=translateSearch(query),cacheKey=[translated,source,page].join('|'),cached=searchCache.get(cacheKey);
 if(fetcher===fetch&&source!=='library'&&cached&&cached.expires>Date.now())return {...cached.result,cached:true};
 const all=[['met','大都会艺术博物馆',metSearch],['commons','Wikimedia Commons',commonsSearch],['aic','芝加哥艺术博物馆',aicSearch],['smk','丹麦国家美术馆',smkSearch]];
 if(options.catalog?.length)all.unshift(['library','网站画库',async()=>searchLocalCatalog(query,options.catalog,page)]);
 const definitions=all.filter(([key])=>source==='all'||source===key);const results=await Promise.allSettled(definitions.map(([,name,fn])=>fn(translated,fetcher,page)));
 const sources=results.map((r,i)=>({name:definitions[i][1],status:r.status==='fulfilled'?'ok':'unavailable',count:r.status==='fulfilled'?r.value.items.length:0}));
 const seen=new Set(),items=[];for(const r of results)if(r.status==='fulfilled')for(const a of r.value.items){if(!a.sourceUrl)continue;const key=(a.title+'|'+a.artist).toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');if(seen.has(a.id)||seen.has(key))continue;seen.add(a.id);seen.add(key);items.push(a);}
 const result={query,translated,items,sources,page,hasMore:page<99&&results.some(r=>r.status==='fulfilled'&&r.value.hasMore),scope:'museum_and_commons',visualVerification:false,fullWebEnabled:false};
 if(fetcher===fetch&&source!=='library'&&sources.some(s=>s.status==='ok')){if(searchCache.size>=60)searchCache.delete(searchCache.keys().next().value);searchCache.set(cacheKey,{expires:Date.now()+300000,result});}return result;
}
export async function fetchPaintingImage(url,fetcher=fetch){
 if(!allowedImage(url)){const e=new Error('仅支持馆藏来源的图片地址。');e.status=400;throw e;}
 const r=await fetcher(url,{redirect:'manual',signal:AbortSignal.timeout(12000)});if(!r.ok||![ 'image/jpeg','image/png','image/webp'].includes(r.headers.get('content-type')?.split(';')[0])){const e=new Error('图片来源暂时无法访问，请打开作品原页。');e.status=502;throw e;}
 if(Number(r.headers.get('content-length'))>10000000){await r.body?.cancel();const e=new Error('原图过大，请在来源页面选择较小图片。');e.status=413;throw e;}
 let total=0;const chunks=[],reader=r.body.getReader();while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>10000000){await reader.cancel();const e=new Error('原图过大。');e.status=413;throw e;}chunks.push(value);}
 return new Response(new Blob(chunks),{headers:{'content-type':r.headers.get('content-type'),'cache-control':'private, max-age=1800','x-content-type-options':'nosniff'}});
}
