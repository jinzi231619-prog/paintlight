import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {DatabaseSync} from 'node:sqlite';
import {handle as coreHandle,validateMetadata} from '../server/core.mjs';import {themeFromPalette,contrast} from '../public/theme.mjs';import {filterArtworks,chooseRandom,TAGS} from '../public/logic.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../public/artworks.json',import.meta.url)));
function environment() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(fs.readFileSync(new URL('../drizzle/0000_windy_captain_flint.sql', import.meta.url), 'utf8').replaceAll('--> statement-breakpoint', ''));
  const objects = new Map();
  const DB = { prepare(query) {
    const statement = sql.prepare(query);
    return { bind(...args) { return {
      async first() { return statement.get(...args); },
      async all() { return { results: statement.all(...args) }; },
      async run() { return statement.run(...args); }
    }; } };
  } };
  const BUCKET = {
    async put(key, bytes) { objects.set(key, bytes); },
    async get(key) { const bytes=objects.get(key); return bytes ? {body:bytes} : null; },
    async delete(key) { objects.delete(key); }
  };
  return { DB, BUCKET, objects, sql };
}
const metadata={title:'测试画作',artist:'Test Artist',date:'1889',sourceUrl:'https://example.org/painting',notes:'窗边的人物。',tags:['男性','室内'],colors:['#332233','#aabcde']};
function request(path,method='GET',user='alice',body,origin='https://paintlight.test'){return new Request('https://paintlight.test'+path,{method,headers:{...(user?{'oai-authenticated-user-id':user}:{}),...(method!=='GET'?{origin}:{})},body});}
function upload(id='user-12345678-1234-4234-8234-123456789abc',info=metadata){const body=new FormData();body.set('id',id);body.set('metadata',JSON.stringify(info));body.set('image',new Blob([fs.readFileSync(new URL('../public'+catalog[0].image,import.meta.url))],{type:'image/jpeg'}),'painting.jpg');return body;}
test('private upload persists in database/object store, retries safely, isolates users, and deletes',async()=>{
 const env=environment();assert.equal((await handle(request('/api/uploads','GET',null),env)).status,401);
 let r=await handle(request('/api/uploads','POST','alice',upload()),env);assert.equal(r.status,201);const art=(await r.json()).artwork;assert(art.userAdded);assert.equal(env.objects.size,1);
 r=await handle(request('/api/uploads','POST','alice',upload()),env);assert.equal(r.status,200);assert.equal(env.objects.size,1);
 r=await handle(request('/api/uploads','GET','alice'),env);assert.equal((await r.json()).artworks.length,1);
 r=await handle(request('/api/uploads','GET','bob'),env);assert.equal((await r.json()).artworks.length,0);
 assert.equal((await handle(request(art.image,'GET','bob'),env)).status,404);assert.equal((await handle(request(art.image,'GET','alice'),env)).status,200);
 assert.equal((await handle(request('/api/uploads/'+art.id,'DELETE','bob'),env)).status,404);
 assert.equal((await handle(request('/api/uploads/'+art.id,'DELETE','alice'),env)).status,200);assert.equal(env.objects.size,0);
 assert.equal((await handle(request('/api/uploads','GET','alice'),env).then(r=>r.json())).artworks.length,0);env.sql.close();
});
test('cross-origin writes and unsafe metadata fail without saving',async()=>{
 const env=environment();assert.equal((await handle(request('/api/uploads','POST','alice',upload(),'https://evil.test'),env)).status,403);
 assert.equal((await handle(request('/api/uploads','POST','alice',upload(undefined,{...metadata,sourceUrl:'javascript:alert(1)'})),env)).status,400);
 assert.throws(()=>validateMetadata({...metadata,tags:['invented']}));assert.equal(env.objects.size,0);env.sql.close();
});
test('all real palettes and extreme palettes have readable foregrounds',()=>{
 for(const colors of [...catalog.map(a=>a.colors),['#ffffff'],['#000000'],['#ff0000','#00ff00','#0000ff']]){const t=themeFromPalette(colors);for(const surface of ['bg','stage','panel'])for(const text of ['text','muted'])assert(contrast(t[text],t[surface])>=4.5,`${colors} ${text}/${surface}`);assert(contrast(t.accent,t['accent-dark'])>=4.5);}
 assert.notDeepEqual(themeFromPalette(['#92bee1','#fff8aa']),themeFromPalette(['#512811','#201808']));
});
test('expanded collection retains evidence and strict AND filtering',()=>{
 assert.equal(catalog.length,300);assert.equal(new Set(catalog.map(a=>a.id)).size,300);
 assert.equal(catalog.filter(a=>!a.expandedCatalog).length,65);
 assert.equal(filterArtworks(catalog.filter(a=>a.expandedCatalog),['街头']).length,0);
 for(const art of catalog){assert(art.tags.every(t=>TAGS.includes(t)&&art.evidence[t]));assert(fs.existsSync(new URL('../public'+art.image,import.meta.url)));}
 assert.equal(filterArtworks(catalog,['男性','街头','雨天']).length,1);assert.equal(filterArtworks(catalog,['男性','街头','雨天','夜晚']).length,0);
 const seen=new Set();for(let i=0;i<catalog.length;i++){const result=chooseRandom(catalog,seen,null);assert(!seen.has(result.art.id));seen.add(result.art.id);}
});

// Core tests supply an already-authenticated identity; worker.test covers the untrusted HTTP boundary.
function handle(request,env,assets={}) { const url=new URL(request.url);url.pathname=url.pathname.replace('/api/private/uploads','/api/uploads');return coreHandle(new Request(url,request),env,assets,request.headers.get('oai-authenticated-user-id')); }
