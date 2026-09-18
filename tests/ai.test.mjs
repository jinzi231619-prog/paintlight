import test from 'node:test';import assert from 'node:assert/strict';
import {publicHttpsUrl,normalizeWebSearch,searchWeb,normalizeVision,verifyPainting,handleAiRequest} from '../server/ai.mjs';
import {handle as coreHandle} from '../server/core.mjs';
const key='sk-unit-test-not-a-real-credential';
const image={type:'image_result',image_url:'https://images.example.org/painting.jpg',thumbnail_url:'https://images.example.org/small.jpg',source_website_url:'https://museum.example.org/work/12',caption:'Moonlit street painting'};
const webResult={status:'completed',output:[{type:'web_search_call',status:'completed',results:[image],action:{sources:[{url:image.source_website_url,title:'Museum source'}]}}]};
const visionResult=checks=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({checks})}]}]});
const request=(path,body,headers={})=>new Request('https://paintlight.test'+path,{method:'POST',headers:{'content-type':'application/json','x-paintlight-api-key':key,...headers},body:JSON.stringify(body)});
test('direct web search sends a request-scoped credential only to OpenAI and returns actual image results',async()=>{
 let calls=0;const result=await searchWeb('男性，雨夜，街头',key,async(url,options)=>{calls++;assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.headers.Authorization,'Bearer '+key);assert.equal(options.redirect,'manual');const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.tool_choice,'required');assert.equal(body.max_tool_calls,2);assert(body.include.includes('web_search_call.results'));assert(!options.body.includes(key));return Response.json(webResult);});
 assert.equal(calls,1);assert.equal(result.items[0].imageUrl,image.thumbnail_url);assert.equal(result.items[0].verified,false);assert.equal(result.items[0].importAllowed,false);assert.equal(result.scope,'web');assert(!JSON.stringify(result).includes(key));
});
test('model prose alone is never passed off as a web result; unsafe and duplicate images are removed',()=>{
 assert.throws(()=>normalizeWebSearch({output:[]},'rain'),/没有实际完成联网/);
 const altered=structuredClone(webResult);altered.output[0].results.push(image,{...image,image_url:'https://localhost/private',thumbnail_url:'file:///tmp/a'},{...image,image_url:'https://images.example.org/a.jpg',source_website_url:'javascript:alert(1)'});
 assert.equal(normalizeWebSearch(altered,'rain').items.length,1);
 for(const url of ['http://example.org/a','https://127.0.0.1/a','https://2130706433/a','https://[::1]/a','https://user:secret@example.org/a','https://service.internal/a','https://example.org:8443/a'])assert.equal(publicHttpsUrl(url),'');
 const noImages=structuredClone(webResult);noImages.output[0].results=[];const fallback=normalizeWebSearch(noImages,'rain');assert.equal(fallback.imageResults,0);assert.equal(fallback.items[0].imageUrl,'');assert.equal(fallback.items[0].sourceUrl,image.source_website_url);
});
test('API failures never expose provider responses or secrets; invalid credentials do not call upstream',async()=>{
 let calls=0;await assert.rejects(()=>searchWeb('rain','invalid',async()=>{calls++;}),e=>e.status===400);assert.equal(calls,0);
 for(const status of [400,401,403,429,500])await assert.rejects(()=>searchWeb('rain',key,async()=>new Response(key,{status})),e=>!e.message.includes(key)&&e.status===(status===429?429:502));
 await assert.rejects(()=>searchWeb('rain',key,async()=>{throw Error(key)}),e=>e.status===504&&!e.message.includes(key));
 await assert.rejects(()=>searchWeb('rain',key,async()=>Response.json({status:'incomplete',output:[]})),/未能完成/);
});
test('vision requires every original condition and derives the overall assessment conservatively',async()=>{
 const conditions=['男性','雨夜','街头'];const checks=conditions.map(condition=>({condition,status:'yes',evidence:'画面证据'}));
 let result=normalizeVision(visionResult(checks),conditions);assert.equal(result.assessment,'possible_match');assert.equal(result.verified,false);
 checks[1].status='unknown';assert.equal(normalizeVision(visionResult(checks),conditions).assessment,'uncertain');
 checks[1].status='no';assert.equal(normalizeVision(visionResult(checks),conditions).assessment,'mismatch');
 assert.throws(()=>normalizeVision(visionResult(checks.slice(1)),conditions),/遗漏/);
 assert.throws(()=>normalizeVision(visionResult([...checks].reverse()),conditions),/无法对应/);
 result=await verifyPainting(conditions,image.image_url,key,async(url,options)=>{const body=JSON.parse(options.body);assert.equal(body.input[0].content[1].type,'input_image');assert.equal(body.text.format.strict,true);assert.equal(body.store,false);return Response.json(visionResult(checks));});assert.equal(result.assessment,'mismatch');
});
test('direct routes require login, same-origin submission, bounded bodies and valid inputs',async()=>{
 assert.equal((await handle(request('/api/search/web',{query:'rain'}),{})).status,401);
 assert.equal((await handle(request('/api/search/web',{query:'rain'},{'oai-authenticated-user-id':'alice',origin:'https://evil.test'}),{})).status,403);
 assert.equal((await handle(request('/api/search/web',{query:'rain'},{'oai-authenticated-user-id':'alice',origin:'https://paintlight.test','x-paintlight-api-key':''}),{})).status,400);
 await assert.rejects(()=>handleAiRequest(request('/api/search/web',{query:'x'.repeat(12500)}),'alice',()=>{throw Error('must not fetch')}),e=>e.status===413);
 await assert.rejects(()=>handleAiRequest(request('/api/search/web',{query:3}),'alice',()=>{throw Error('must not fetch')}),e=>e.status===400);
 await assert.rejects(()=>handleAiRequest(request('/api/search/verify',{conditions:[],imageUrl:image.image_url}),'alice',()=>{throw Error('must not fetch')}),e=>e.status===400);
});
test('concurrent paid calls are blocked and the slot is released after completion',async()=>{
 let resolve,started;const ready=new Promise(r=>started=r),pending=handleAiRequest(request('/api/search/web',{query:'rain'}),'alice',()=>new Promise(r=>{resolve=r;started();}));await ready;
 await assert.rejects(()=>handleAiRequest(request('/api/search/web',{query:'snow'}),'alice'),e=>e.status===429);
 resolve(Response.json(webResult));await pending;
 const next=await handleAiRequest(request('/api/search/web',{query:'snow'}),'alice',async()=>Response.json(webResult));assert.equal(next.items.length,1);
});
test('connection check needs no credential and distinguishes reachability from key validity',async()=>{
 const {checkOpenAIConnection}=await import('../server/ai.mjs');
 const result=await checkOpenAIConnection(async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/models');assert.equal(options.headers,undefined);return new Response(null,{status:401});});assert.equal(result.reachable,true);
 assert.equal((await checkOpenAIConnection(async()=>{throw Error('network')})).reachable,false);
});
test('English UI requests English AI explanations without changing the original conditions',async()=>{
 const conditions=['male','rainy street'];
 await handleAiRequest(request('/api/search/verify',{conditions,imageUrl:image.image_url,language:'en'}),'english-user',async(url,options)=>{
  const body=JSON.parse(options.body);assert(body.instructions.includes('short English visual evidence'));
  assert.deepEqual(JSON.parse(body.input[0].content[0].text).conditions,conditions);
  return Response.json(visionResult(conditions.map(condition=>({condition,status:'unknown',evidence:'Not clearly visible.'}))));
 });
 await handleAiRequest(request('/api/search/web',{query:'rainy street',language:'en'}),'english-user',async(url,options)=>{
  assert(JSON.parse(options.body).instructions.includes('Use English for short descriptions'));
  return Response.json(webResult);
 });
});

// Core tests supply an already-authenticated identity; worker.test covers the untrusted HTTP boundary.
function handle(request,env,assets={}) { const url=new URL(request.url);url.pathname=url.pathname.replace('/api/private/uploads','/api/uploads');return coreHandle(new Request(url,request),env,assets,request.headers.get('oai-authenticated-user-id')); }
