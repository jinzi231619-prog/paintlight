import test from 'node:test';
import assert from 'node:assert/strict';
import {translateSearch,normalizeCommons,searchPaintings,allowedImage,fetchPaintingImage} from '../server/search.mjs';
import {handle as coreHandle} from '../server/core.mjs';
import {themeFromPalette,rgb} from '../public/theme.mjs';

const painting=(overrides={})=>({pageid:123,title:'File:Moonlight painting.jpg',imageinfo:[{mime:'image/jpeg',descriptionurl:'https://commons.wikimedia.org/wiki/File:Moonlight.jpg',thumburl:'https://upload.wikimedia.org/wikipedia/commons/a/ab/Moonlight.jpg',extmetadata:{ObjectName:{value:'<b>Moonlight</b>'},Artist:{value:'<a>Painter</a>'},Categories:{value:'Oil paintings'},LicenseShortName:{value:'Public domain'},DateTimeOriginal:{value:'1880'},...overrides}}]});
test('Chinese scene queries translate and source metadata stays unverified',()=>{
 assert.equal(translateSearch('男性，雨夜，街头'),'man rain night street');
 assert.equal(translateSearch('月光 海景'),'moonlight seascape');
 const [a]=normalizeCommons({query:{pages:{123:painting()}}});
 assert.equal(a.title,'Moonlight');assert.equal(a.artist,'Painter');assert.equal(a.verified,false);assert.equal(a.importAllowed,true);
 assert.equal(normalizeCommons({query:{pages:{123:painting({DateTimeOriginal:{value:'2025'}})}}}).length,0);
 const [cc]=normalizeCommons({query:{pages:{123:painting({LicenseShortName:{value:'CC BY-SA 4.0'}})}}});assert.equal(cc.importAllowed,false);
 const invalid=painting();invalid.imageinfo[0].mime='image/svg+xml';assert.equal(normalizeCommons({query:{pages:{123:invalid}}}).length,0);
});
test('one unavailable provider does not erase other candidates or claim verification',async()=>{
 const fetcher=async url=>{
  if(url.includes('metmuseum'))throw new Error('offline');
  if(url.includes('commons.wikimedia'))return Response.json({query:{pages:{123:painting()}}});
  return Response.json({data:[]});
 };
 const result=await searchPaintings('月光',fetcher);
 assert.equal(result.items.length,1);assert.equal(result.sources[0].status,'unavailable');assert.equal(result.sources[1].status,'ok');assert.equal(result.fullWebEnabled,false);assert.equal(result.visualVerification,false);
 await assert.rejects(()=>searchPaintings(' ',fetcher),e=>e.status===400);
});
test('image proxy rejects arbitrary hosts, credentials, redirects, and non-raster responses',async()=>{
 const url='https://images.metmuseum.org/CRDImages/ep/web-large/test.jpg';assert(allowedImage(url));
 for(const value of ['http://images.metmuseum.org/CRDImages/test.jpg','https://127.0.0.1/a','https://images.metmuseum.org.evil.test/CRDImages/a','https://user:pass@images.metmuseum.org/CRDImages/a','https://images.metmuseum.org/not-images/a']){
  assert.equal(allowedImage(value),false);await assert.rejects(()=>fetchPaintingImage(value,()=>{throw Error('must not fetch')}),e=>e.status===400);
 }
 await assert.rejects(()=>fetchPaintingImage(url,async(u,options)=>{assert.equal(options.redirect,'manual');return new Response(null,{status:302,headers:{location:'http://127.0.0.1'}})}),e=>e.status===502);
 await assert.rejects(()=>fetchPaintingImage(url,async()=>new Response('<html>',{headers:{'content-type':'text/html'}})),e=>e.status===502);
 await assert.rejects(()=>fetchPaintingImage(url,async()=>new Response('big',{headers:{'content-type':'image/jpeg','content-length':'10000001'}})),e=>e.status===413);
 const response=await fetchPaintingImage(url,async()=>new Response(new Uint8Array([255,216,255]),{headers:{'content-type':'image/jpeg'}}));assert.equal(response.status,200);assert.equal((await response.arrayBuffer()).byteLength,3);
 for(const path of ['/api/search?q=moonlight','/api/search/image?url='+encodeURIComponent(url)])assert.equal((await handle(new Request('https://paintlight.test'+path),{})).status,401);
});
test('large surfaces retain visibly distinct warm and cool painting hues',()=>{
 const warm=themeFromPalette(['#71351b','#a06236']),cool=themeFromPalette(['#244e78','#507a9f']);
 for(const key of ['bg','stage','panel']){const a=rgb(warm[key]),b=rgb(cool[key]);assert(a[0]-a[2]>20);assert(b[2]-b[0]>20);assert(Math.hypot(...a.map((c,i)=>c-b[i]))>45);}
});
test('free source pagination advances offsets and preserves each page',async()=>{
 const urls=[];const fetcher=async url=>{urls.push(url);if(url.includes('/v1.1/search'))return Response.json({total:100,objectIDs:[1]});return Response.json({objectID:1,title:'Landscape',artistDisplayName:'Painter',objectDate:'1880',objectBeginDate:1880,objectEndDate:1880,isPublicDomain:true,classification:'Paintings',primaryImageSmall:'https://images.metmuseum.org/CRDImages/ep/test.jpg',objectURL:'https://www.metmuseum.org/art/collection/search/1'});};
 const result=await searchPaintings('landscape',fetcher,{page:2,source:'met'});assert.equal(result.page,2);assert.equal(result.hasMore,true);assert.equal(result.items.length,1);assert(urls[0].includes('offset=24'));assert.equal(urls.length,2);
 await assert.rejects(()=>searchPaintings('landscape',fetcher,{page:-1}),e=>e.status===400);
});
test('SMK normalization only accepts public-domain paintings with supported dates',async()=>{
 const {normalizeSMK,searchLocalCatalog}=await import('../server/search.mjs');
 const art={object_number:'KMS1',public_domain:true,image_thumbnail:'https://iip-thumb.smk.dk/iiif/jp2/a/full/!1024,/0/default.jpg',object_names:[{name:'Maleri'}],production_date:[{start:'1880-01-01',end:'1880-12-31',period:'1880'}],titles:[{title:'Sea',language:'English'}],artist:['Painter'],frontend_url:'https://open.smk.dk/artwork/image/KMS1'};
 const items=normalizeSMK({items:[art,{...art,public_domain:false},{...art,object_names:[{name:'Tegning'}]}]});assert.equal(items.length,1);assert.equal(items[0].verified,false);assert(allowedImage(items[0].imageUrl));assert(allowedImage('https://api.smk.dk/api/v1/thumbnail/6d720d0f-e554-4f24-aae7-7693e872e4c4.jpg'));assert(!allowedImage('https://api.smk.dk/api/v1/art/search/'));
 const local=searchLocalCatalog('月光',[{id:'met-1',title:'Moonlight',artist:'Painter',image:'/images/met-1.webp',sourceUrl:'https://www.metmuseum.org/art/collection/search/1',museumImageUrl:'https://images.metmuseum.org/CRDImages/ep/a.jpg'}]);assert.equal(local.items[0].localImage,'/images/met-1.webp');
});

// Core tests supply an already-authenticated identity; worker.test covers the untrusted HTTP boundary.
function handle(request,env,assets={}) { const url=new URL(request.url);url.pathname=url.pathname.replace('/api/private/uploads','/api/uploads');return coreHandle(new Request(url,request),env,assets,request.headers.get('oai-authenticated-user-id')); }
