import test from 'node:test';import assert from 'node:assert/strict';
import {setupOnline} from '../public/online.mjs';
test('closing an active search allows immediate retry after reopening',async()=>{
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',disabled:false,hidden:false,addEventListener(){},replaceChildren(){},showModal(){},close(){},focus(){}});return elements.get(id);};
 const previousDocument=globalThis.document,previousFetch=globalThis.fetch;
 globalThis.document={getElementById:get,querySelectorAll:()=>[]};
 globalThis.fetch=(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError'))));
 try{
  const ui=setupOnline({getQuery:()=> '月光',onImport(){}});ui.open();get('onlineForm').onsubmit({preventDefault(){}});
  assert.equal(get('onlineSubmit').disabled,true);get('closeOnline').onclick();ui.open();
  assert.equal(get('onlineSubmit').disabled,false);assert.equal(get('onlineSubmit').textContent,'搜索');
  await new Promise(resolve=>setImmediate(resolve));assert.equal(get('onlineStatus').textContent,'搜索已取消，可以重新搜索。');
 }finally{globalThis.document=previousDocument;globalThis.fetch=previousFetch;}
});
