import test from 'node:test';import assert from 'node:assert/strict';
import {setupOnline} from '../public/online.mjs';
import {setLanguage,t} from '../public/i18n.mjs';
for(const language of ['zh','en'])test(`closing an active search allows immediate retry after reopening (${language})`,async()=>{
 setLanguage(language);
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',disabled:false,hidden:false,addEventListener(){},replaceChildren(){},showModal(){},close(){},focus(){}});return elements.get(id);};
 const previousDocument=globalThis.document,previousFetch=globalThis.fetch;
 globalThis.document={getElementById:get,querySelectorAll:()=>[]};
 globalThis.fetch=(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError'))));
 try{
  const ui=setupOnline({getQuery:()=> '月光',onImport(){}});ui.open();get('onlineForm').onsubmit({preventDefault(){}});
  assert.equal(get('onlineSubmit').disabled,true);get('closeOnline').onclick();assert.equal(get('onlineStatus').textContent,t('搜索已取消，可以重新搜索。'));ui.open();
  assert.equal(get('onlineSubmit').disabled,false);assert.equal(get('onlineSubmit').textContent,t('搜索'));
  await new Promise(resolve=>setImmediate(resolve));assert.equal(get('onlineStatus').textContent,t('输入关键词，寻找精选画库之外的作品。'));
 }finally{globalThis.document=previousDocument;globalThis.fetch=previousFetch;}
});

test('search starts free, paid mode is explicit, and switching modes sends no request',async()=>{
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',disabled:false,hidden:false,addEventListener(){},replaceChildren(){},append(){},showModal(){},close(){},focus(){}});return elements.get(id);};
 const modes=['museum','external','web'].map(searchMode=>({dataset:{searchMode},setAttribute(){}}));
 const previousDocument=globalThis.document,previousFetch=globalThis.fetch,calls=[];
 globalThis.document={getElementById:get,querySelectorAll:selector=>selector==='[data-search-mode]'?modes:[]};
 globalThis.fetch=(url,options)=>{calls.push({url,options});return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError'))));};
 try{
  const ui=setupOnline({getQuery:()=>'',onImport(){}});
  get('discoverQuery').value='Rembrandt';get('discoverForm').onsubmit({preventDefault(){}});
  assert.equal(calls.length,1);assert(calls[0].url.startsWith('/api/search?q=Rembrandt'));
  assert.equal(calls[0].options.headers,undefined);assert.equal(get('apiSettings').hidden,true);
  modes[1].onclick();assert.equal(get('onlineExternal').hidden,false);assert.equal(get('apiSettings').hidden,true);assert.equal(calls.length,1);
  modes[2].onclick();assert.equal(get('apiSettings').hidden,false);assert.equal(calls.length,1);
  get('onlineForm').onsubmit({preventDefault(){}});assert.equal(calls.length,1,'no paid request without a key');
  get('closeOnline').onclick();ui.open();assert.equal(get('apiSettings').hidden,true,'reopening starts in free mode');
  await new Promise(resolve=>setImmediate(resolve));
 }finally{globalThis.document=previousDocument;globalThis.fetch=previousFetch;}
});
