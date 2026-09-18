import {setText,setAttr,message,localized,rawText,textNode} from './i18n.mjs';
import {QUESTIONS,SCHEMA_VERSION,questionIds,nextQuestion,validateAnswers,undoAnswer,answerLabel} from './classify-logic.mjs';
const KEY='paintlight-community-v1';
export function setupClassification({getArtworks}) {
  const $=id=>document.getElementById(id),dialog=$('classifyDialog');
  let saved={};try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch{}
  const participant=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saved.participant||'')?saved.participant:crypto.randomUUID();
  const completed=new Set(Array.isArray(saved.completed)?saved.completed.filter(x=>typeof x==='string').slice(0,1000):[]);
  const skipped=new Set();
  let art=null,answers={},phase='question',busy=false,transition=false,timer,loaded=false,sessionCount=0;
  const draft=saved.draft;
  function persist(){
    try{localStorage.setItem(KEY,JSON.stringify({participant,completed:[...completed].slice(-1000),draft:art&&!completed.has(art.id)?{version:SCHEMA_VERSION,artworkId:art.id,answers}:null}));$('classifyStorageNote').hidden=true;}
    catch{$('classifyStorageNote').hidden=false;}
  }
  function node(tag,cls,copy){const n=document.createElement(tag);n.className=cls;if(copy!==undefined)setText(n,copy);return n;}
  function focusQuestion(){if(dialog.open)$('classifyQuestion').focus({preventScroll:true});}
  function animate(name){
    const card=$('classifyCard');card.classList.remove('question-arrive','answer-leave','round-complete');
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches){void card.offsetWidth;card.classList.add(name);}
  }
  function render(){
    const ids=questionIds(answers),id=nextQuestion(answers);
    $('classifyQuestionView').hidden=phase!=='question';
    $('classifyReview').hidden=phase!=='review';
    $('classifyThanks').hidden=phase!=='thanks';
    $('classifyEmpty').hidden=phase!=='empty';
    $('classifyPicture').hidden=!art;
    $('classifyUndo').hidden=!['question','review'].includes(phase);
    $('classifyUndo').disabled=busy||!Object.keys(answers).length;
    $('classifySkip').hidden=!['question','review'].includes(phase);
    $('classifySkip').disabled=busy;
    $('classifySubmit').disabled=busy;
    $('classifyRetryImage').disabled=busy;
    setText($('classifySubmit'),busy?'正在提交…':'提交这幅的观察');
    setText($('classifySession'),sessionCount?message('这次已贡献 {count} 幅',{count:sessionCount}):'没有任务，随时可以停下。');
    $('classifyProgress').replaceChildren();
    ids.forEach((key,i)=>{const dot=node('span','classify-dot'+(Object.hasOwn(answers,key)?' filled':''));dot.setAttribute('aria-hidden','true');$('classifyProgress').append(dot);});
    $('classifyProgress').hidden=phase==='empty';
    $('classifyTags').replaceChildren();
    for(const key of ids.filter(key=>Object.hasOwn(answers,key))){
      const tag=node('span','observation-tag',answerLabel(key,answers[key]));
      setAttr(tag,'title',QUESTIONS[key].title);$('classifyTags').append(tag);
    }
    if(phase==='question'&&id){
      const q=QUESTIONS[id];
      setText($('classifyStep'),message('第 {current} / {total} 个小问题',{current:ids.indexOf(id)+1,total:ids.length}));
      setText($('classifyQuestion'),q.title);setText($('classifyHint'),q.hint);
      $('classifyOptions').replaceChildren();
      for(const [value,label,symbol] of q.options){
        const button=node('button','observation-choice');button.type='button';button.disabled=!loaded||transition;
        const icon=node('span','choice-symbol',symbol);icon.setAttribute('aria-hidden','true');
        button.append(icon,node('span','',label));button.onclick=()=>answer(id,value,button);$('classifyOptions').append(button);
      }
    } else if(phase==='review'){
      setText($('classifyStep'),'再看一眼，就可以提交了');
      $('classifySummary').replaceChildren();
      for(const key of ids){const row=node('div','observation-row');row.append(node('dt','',QUESTIONS[key].title),node('dd','',answerLabel(key,answers[key])));$('classifySummary').append(row);}
    } else if(phase==='thanks')setText($('classifyStep'),'已收到，等待复核');
    else setText($('classifyStep'),'这轮先到这里');
  }
  function answer(id,value,button){
    if(busy||transition||!loaded||phase!=='question'||nextQuestion(answers)!==id)return;
    answers={...answers,[id]:value};persist();transition=true;button.classList.add('chosen');
    $('classifyOptions').querySelectorAll('button').forEach(b=>b.disabled=true);
    animate('answer-leave');
    timer=setTimeout(()=>{transition=false;phase=nextQuestion(answers)?'question':'review';render();animate('question-arrive');if(phase==='question')focusQuestion();else if(dialog.open)$('classifyReviewHeading').focus({preventScroll:true});},matchMedia('(prefers-reduced-motion: reduce)').matches?0:230);
  }
  function loadImage(){
    loaded=false;$('classifyImage').hidden=true;$('classifyImageError').hidden=true;$('classifyImageLoading').hidden=false;
    const image=$('classifyImage'),currentArt=art.id;
    image.onload=()=>{if(art?.id!==currentArt)return;loaded=true;image.hidden=false;$('classifyImageLoading').hidden=true;render();};
    image.onerror=()=>{if(art?.id!==currentArt)return;loaded=false;image.hidden=true;$('classifyImageLoading').hidden=true;$('classifyImageError').hidden=false;render();};
    setAttr(image,'alt',localized(art.titleZh||art.title,art.title||art.titleZh));image.src=art.image;
  }
  function showArtwork(next,initial={}){
    clearTimeout(timer);transition=false;art=next;answers=initial;phase=nextQuestion(answers)?'question':'review';
    $('classifyError').hidden=true;
    setText($('classifyArtTitle'),localized(art.titleZh||art.title,art.title||art.titleZh));
    setText($('classifyArtArtist'),rawText([art.artist,art.date].filter(Boolean).join(' · ')));
    $('classifyImageStage').classList.remove('zoomed');setText($('classifyZoomButton'),'仔细看看');$('classifyZoomButton').setAttribute('aria-expanded','false');loadImage();persist();render();animate('question-arrive');focusQuestion();
  }
  function nextArtwork(){
    const eligible=getArtworks().filter(a=>a.expandedCatalog&&!a.userAdded&&!completed.has(a.id)&&!skipped.has(a.id));
    if(!eligible.length){art=null;answers={};phase='empty';render();persist();return;}
    showArtwork(eligible[Math.floor(Math.random()*eligible.length)]);
  }
  const open=()=>{
    dialog.showModal();
    if(!art&&phase!=='empty'){
      const restored=draft?.version===SCHEMA_VERSION&&validateAnswers(draft.answers,false)&&!completed.has(draft.artworkId)?getArtworks().find(a=>a.id===draft.artworkId&&a.expandedCatalog&&!a.userAdded):null;
      if(restored)showArtwork(restored,draft.answers);else nextArtwork();
    }else{render();focusQuestion();}
  };
  $('classifyButton').onclick=open;
  $('classifyButton').disabled=false;
  function close(){dialog.close();persist();}
  $('closeClassify').onclick=close;$('classifyFinish').onclick=close;$('classifyEmptyFinish').onclick=close;
  dialog.addEventListener('cancel',()=>persist());
  $('classifyUndo').onclick=()=>{
    if(busy||!art)return;clearTimeout(timer);transition=false;answers=undoAnswer(answers);phase='question';persist();render();animate('question-arrive');focusQuestion();
  };
  $('classifySkip').onclick=()=>{if(busy||!art)return;skipped.add(art.id);nextArtwork();};
  $('classifyNext').onclick=nextArtwork;
  $('classifyRestart').onclick=()=>{skipped.clear();nextArtwork();};
  $('classifyRetryImage').onclick=()=>{if(art)loadImage();};
  $('classifyZoomButton').onclick=()=>{const zoom=$('classifyImageStage').classList.toggle('zoomed');setText($('classifyZoomButton'),zoom?'返回全图':'仔细看看');$('classifyZoomButton').setAttribute('aria-expanded',String(zoom));};
  $('classifySubmit').onclick=async()=>{
    if(busy||phase!=='review'||!validateAnswers(answers))return;
    busy=true;$('classifyError').hidden=true;render();
    try{
      const r=await fetch('/api/contributions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:SCHEMA_VERSION,participant,artworkId:art.id,answers}),signal:AbortSignal.timeout(20000)});
      if(!r.ok)throw Error(r.status===429?'稍微歇一会儿，再试一次。':'暂时没能提交，答案已保留。请重试。');
      const data=await r.json();if(data.received!==true||data.status!=='pending')throw Error('暂时没能提交，答案已保留。请重试。');
      completed.add(art.id);if(!data.duplicate)sessionCount++;
      phase='thanks';persist();render();animate('round-complete');
      if(dialog.open)$('classifyThanksHeading').focus({preventScroll:true});
    }catch(error){setText($('classifyError'),error.message==='稍微歇一会儿，再试一次。'?error.message:'暂时没能提交，答案已保留。请重试。');$('classifyError').hidden=false;}
    finally{busy=false;render();}
  };
  return {open};
}
