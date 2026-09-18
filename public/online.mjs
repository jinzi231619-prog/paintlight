import {translateSearch} from './search-terms.mjs';
const O=id=>document.getElementById(id);
const node=(tag,cls,text)=>{const el=document.createElement(tag);el.className=cls;if(text!==undefined)el.textContent=text;return el;};
const safeLink=(url)=>{try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}};
export function setupOnline({getQuery,onImport,onView}){
 let controller,sequence=0,currentPage=0,lastQuery='';const checks=new Set();
 const apiKey=()=>O('apiKey').value.trim();
 const needKey=()=>{if(/^sk-[A-Za-z0-9_-]{16,500}$/.test(apiKey()))return true;O('apiSettings').open=true;O('apiKey').focus();O('onlineStatus').textContent='请先填写 API 密钥，或选择免费的馆藏搜索。';return false;};
 const cancel=()=>{controller?.abort();checks.forEach(c=>c.abort());checks.clear();sequence++;O('onlineSubmit').disabled=false;O('onlineSubmit').textContent='搜索';if(O('onlineStatus').textContent.startsWith('正在'))O('onlineStatus').textContent='搜索已取消，可以重新搜索。';};
 const close=()=>{cancel();O('onlineDialog').close();};
 const updateExternal=()=>{const query=translateSearch(O('onlineQuery').value.trim())||'classical';O('googleImages').href='https://www.google.com/search?tbm=isch&q='+encodeURIComponent(query+' painting');O('bingImages').href='https://www.bing.com/images/search?q='+encodeURIComponent(query+' painting');O('onlineExternal').hidden=false;};
 const open=()=>{O('onlineQuery').value=getQuery();updateExternal();O('onlineDialog').showModal();O('onlineQuery').focus();};
 O('onlineSearchButton').onclick=open;O('closeOnline').onclick=close;O('onlineDialog').addEventListener('cancel',cancel);
 O('checkApiConnection').onclick=async()=>{const button=O('checkApiConnection');button.disabled=true;O('apiConnectionStatus').textContent='正在检查后台连接…';try{const r=await fetch('/api/search/connectivity',{credentials:'same-origin',signal:AbortSignal.timeout(10000)});const data=await r.json();O('apiConnectionStatus').textContent=r.ok?data.message:data.error||'暂时无法检查连接。';}catch{O('apiConnectionStatus').textContent='连接检查未完成；免费找图仍可使用。';}finally{button.disabled=false;}};
 O('clearApiKey').onclick=()=>{cancel();O('apiKey').value='';O('onlineStatus').textContent='API 密钥已从当前页面清除，免费馆藏搜索仍可使用。';};
 globalThis.addEventListener?.('pagehide',()=>{cancel();O('apiKey').value='';});
 O('onlineMode').onchange=()=>{cancel();currentPage=0;O('onlinePagination').hidden=true;const museum=O('onlineMode').value==='museum';O('onlineSource').hidden=!museum;O('onlineSourceLabel').hidden=!museum;if(O('onlineMode').value==='web'&&!apiKey())O('apiSettings').open=true;updateExternal();};
 O('onlineQuery').oninput=updateExternal;O('onlineSource').onchange=()=>{currentPage=0;search();};
 const aiRequest=async(path,payload,signal)=>{const r=await fetch(path,{method:'POST',credentials:'same-origin',signal,headers:{'Content-Type':'application/json','X-Paintlight-API-Key':apiKey()},body:JSON.stringify(payload)});const data=await r.json();if(!r.ok)throw new Error(data.error||'API 请求未完成。');return data;};
 const verify=async(a,query,button,result)=>{
  if(!needKey())return;const active=new AbortController();checks.add(active);const timer=setTimeout(()=>active.abort(),75000);button.disabled=true;result.replaceChildren(node('p','hint','正在检查画面中的条件…'));
  try{
   const conditions=query.split(/[，,、；;\n]+/).map(s=>s.trim()).filter(Boolean);const data=await aiRequest('/api/search/verify',{conditions,imageUrl:a.verificationImageUrl||a.imageUrl},active.signal);
   const label={possible_match:'AI 判断：可能符合',mismatch:'AI 判断：不符合全部条件',uncertain:'AI 判断：有条件无法确认'};
   result.replaceChildren(node('p','ai-verdict',label[data.assessment]||'AI 判断待确认'));
   for(const check of data.checks)result.append(node('p','ai-check',`${check.condition} · ${{yes:'画面支持',no:'画面不符',unknown:'无法确认'}[check.status]}：${check.evidence}`));
   result.append(node('p','hint',data.disclaimer));
  }catch(e){result.replaceChildren(node('p','hint',e.name==='AbortError'?'检查已取消或超时；已开始的调用可能已计费。':e.message));}
  finally{clearTimeout(timer);checks.delete(active);button.disabled=false;}
 };
 const search=async(page=0)=>{
  const query=O('onlineQuery').value.trim(),web=O('onlineMode').value==='web';if(!query)return;updateExternal();if(O('onlineMode').value==='external'){cancel();O('onlineResults').replaceChildren();O('onlineSources').replaceChildren();O('onlineCitations').replaceChildren();O('onlinePagination').hidden=true;O('onlineStatus').textContent='关键词已准备好，点击 Google 或 Bing 图片即可在新窗口免费找图；找到作品后可手动上传。';return;}if(web&&!needKey())return;
  cancel();O('onlinePagination').hidden=true;controller=new AbortController();const active=controller,current=++sequence;
  O('onlineSubmit').disabled=true;O('onlineSubmit').textContent='搜索中…';O('onlineResults').replaceChildren();O('onlineSources').replaceChildren();O('onlineCitations').replaceChildren();O('onlineStatus').textContent=web?'正在联网寻找画作，请稍候；本次调用使用 API 额度…':'正在向馆藏来源检索，通常需要数秒…';O('onlinePrevious').disabled=true;O('onlineNext').disabled=true;
  const timeout=setTimeout(()=>active.abort(),web?95000:35000);
  try{
   let data;if(web)data=await aiRequest('/api/search/web',{query},active.signal);else{const r=await fetch('/api/search?q='+encodeURIComponent(query)+'&page='+page+'&source='+encodeURIComponent(O('onlineSource').value||'all'),{signal:active.signal,credentials:'same-origin'});data=await r.json();if(!r.ok)throw new Error(data.error||'搜索暂时无法完成。');}if(current!==sequence)return;currentPage=page;lastQuery=query;O('onlinePagination').hidden=web;O('onlinePrevious').disabled=page===0;O('onlineNext').disabled=!data.hasMore;O('onlinePageLabel').textContent='第 '+(page+1)+' 页';
   O('onlineStatus').textContent=`找到 ${data.items.length} 个待核验${web?'线索':'候选'} · ${web?'全网搜画':'实际检索词：'+data.translated}${data.cached?' · 最近缓存':''}${web&&data.imageResults===0?' · 本次仅返回来源网页':''}`;
   data.sources.forEach(s=>O('onlineSources').append(node('span',s.status==='ok'?'source-state':'source-state unavailable',`${s.name} · ${s.status==='ok'?s.count+' 个':'暂不可用'}`)));
   if(!data.items.length)O('onlineResults').append(node('p','online-empty',data.sources.every(s=>s.status!=='ok')?'来源暂时都没有响应，请稍后重试。':'暂未找到候选。可以尝试英文画名、作者，或主动减少一个场景词。'));
   data.items.forEach(a=>{
    const sourceUrl=safeLink(a.sourceUrl);if(!sourceUrl)return;
    const card=node('article','online-card'),media=node('a','online-media');media.href=sourceUrl;media.target='_blank';media.rel='noopener noreferrer';media.setAttribute('aria-label','在来源网页查看 '+a.title);
    const fallback=node('span','online-fallback','打开来源查看画作 ↗');fallback.hidden=!!(a.imageUrl||a.localImage);media.append(fallback);
    if(a.imageUrl||a.localImage){const img=node('img','');img.alt=a.title;img.loading='lazy';img.referrerPolicy='no-referrer';img.src=a.localImage?.startsWith('/images/')?a.localImage:a.externalImage?safeLink(a.imageUrl):'/api/search/image?url='+encodeURIComponent(a.imageUrl);img.onerror=()=>{img.hidden=true;fallback.hidden=false;};media.append(img);}
    const body=node('div','online-card-body');body.append(node('span','candidate-badge',web?'联网图片线索 · 待核验':'待核验候选'),node('h3','',a.title),node('p','online-artist',a.artist+' · '+a.date),node('p','hint',a.source+' · '+(a.license||'授权信息待核实')));
    if(a.description&&a.description!==a.title)body.append(node('p','online-description',a.description));
    const actions=node('div','online-card-actions'),link=node('a','source-link','查看原页 ↗');link.href=sourceUrl;link.target='_blank';link.rel='noopener noreferrer';actions.append(link);
    if(a.localImage&&onView){const view=node('button','secondary','在画遇中打开');view.type='button';view.onclick=()=>{close();onView(a.id);};actions.append(view);}
    if(!a.localImage&&(a.importAllowed&&a.imageUrl||a.manualImport)){const add=node('button','secondary',a.importAllowed?'添加到我的画库':'填写资料并上传');add.type='button';add.onclick=()=>{close();onImport(a);};actions.append(add);}
    const assessment=node('div','ai-assessment');assessment.setAttribute('aria-live','polite');
    if(a.imageUrl){const check=node('button','secondary','AI 检查条件 · 计费');check.type='button';check.onclick=()=>verify(a,query,check,assessment);actions.append(check);}
    body.append(actions,assessment);card.append(media,body);O('onlineResults').append(card);
   });
   if(data.citations?.length){const details=node('details','online-references');details.append(node('summary','','本次检索来源'));for(const c of data.citations){const url=safeLink(c.url);if(!url)continue;const a=node('a','',c.title);a.href=url;a.target='_blank';a.rel='noopener noreferrer';details.append(a);}O('onlineCitations').append(details);}
   O('googleImages').href='https://www.google.com/search?tbm=isch&q='+encodeURIComponent(data.translated+' painting');O('bingImages').href='https://www.bing.com/images/search?q='+encodeURIComponent(data.translated+' painting');O('onlineExternal').hidden=false;
  }catch(e){if(current===sequence)O('onlineStatus').textContent=e.name==='AbortError'?(web?'搜索超时或已取消，请稍后重试；已开始的 API 调用可能已计费。':'搜索超时或已取消，请稍后重试或切换来源。'):e.message;}
  finally{clearTimeout(timeout);if(current===sequence){O('onlineSubmit').disabled=false;O('onlineSubmit').textContent='搜索';}}
 };
 O('onlinePrevious').onclick=()=>search(O('onlineQuery').value.trim()===lastQuery?Math.max(0,currentPage-1):0);O('onlineNext').onclick=()=>search(O('onlineQuery').value.trim()===lastQuery?currentPage+1:0);
 O('onlineForm').onsubmit=e=>{e.preventDefault();search();};document.querySelectorAll('[data-online-example]').forEach(button=>button.onclick=()=>{O('onlineQuery').value=button.dataset.onlineExample;search();});
 return {open};
}
