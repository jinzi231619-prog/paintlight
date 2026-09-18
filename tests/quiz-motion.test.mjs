import test from 'node:test';
import assert from 'node:assert/strict';
import {createQuizMotion} from '../public/quiz-motion.mjs';
import {setupClassification} from '../public/classify.mjs';

test('quiz transition cancellation prevents late updates, including reduced motion', () => {
  let id = 0, commits = 0, animations = 0, cancelled = 0;
  const tasks = new Map();
  const card = {get offsetWidth(){throw Error('forced layout');}, animate(){animations++;return {cancel(){cancelled++;}};}};
  const options = {card, schedule:(fn,ms)=>{tasks.set(++id,{fn,ms});return id;},unschedule:id=>tasks.delete(id)};
  const motion = createQuizMotion({...options,reduced:()=>false});
  motion.afterAnswer(()=>commits++);
  assert.equal([...tasks.values()][0].ms,90);
  motion.cancel();
  assert.equal(tasks.size,0);
  assert.equal(commits,0);
  motion.arrive();motion.arrive();
  assert.equal(animations,2);assert.equal(cancelled,1);
  const quiet = createQuizMotion({...options,reduced:()=>true});
  quiet.afterAnswer(()=>commits++);
  assert.equal([...tasks.values()][0].ms,0);
  [...tasks.values()][0].fn();
  assert.equal(commits,1);assert.equal(animations,2);
});

function element() {
  const n={children:[],dataset:{},hidden:false,disabled:false,textContent:'',attributes:{},listeners:{},
    setAttribute(key,value){this.attributes[key]=value;},
    append(...nodes){for(const child of nodes){child.parent=this;this.children.push(child);}},
    insertBefore(child,next){child.parent=this;const i=this.children.indexOf(next);if(i<0)this.children.push(child);else this.children.splice(i,0,child);},
    replaceChildren(...nodes){this.children=[];this.append(...nodes);},
    remove(){this.parent.children=this.parent.children.filter(x=>x!==this);},
    querySelectorAll(){return this.children;}, focus(){},
    addEventListener(name,fn){this.listeners[name]=fn;},
    showModal(){this.open=true;},close(){this.open=false;},animate(){return {cancel(){}};}};
  const classes=new Set();
  n.classList={add:k=>classes.add(k),remove:k=>classes.delete(k),toggle(k,on){const add=on??!classes.has(k);add?classes.add(k):classes.delete(k);return add;}};
  Object.defineProperty(n,'offsetWidth',{get(){throw Error('forced layout');}});
  return n;
}

test('quiz reuses observation nodes, prevents double answers and safely closes or undoes during transition', t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const keys=['document','localStorage','window','matchMedia'];
  const originals=Object.fromEntries(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const elements=new Map(),store=new Map();
  const $=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
  try {
    Object.defineProperty(globalThis,'document',{configurable:true,value:{getElementById:$,createElement:element}});
    Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>store.get(key),setItem:(key,value)=>store.set(key,value)}});
    Object.defineProperty(globalThis,'window',{configurable:true,value:{addEventListener(){}}});
    Object.defineProperty(globalThis,'matchMedia',{configurable:true,value:()=>({matches:false})});
    const ui=setupClassification({getArtworks:()=>[{id:'a',title:'Art',image:'/a.jpg',expandedCatalog:true}]});
    ui.open();$('classifyImage').onload();
    const firstDot=$('classifyProgress').children[0];
    const yes=$('classifyOptions').children[0];
    yes.onclick();yes.onclick();
    t.mock.timers.tick(90);
    assert.equal($('classifyProgress').children[0],firstDot);
    assert.equal($('classifyTags').children.length,1);
    const firstTag=$('classifyTags').children[0];
    $('classifyOptions').children[0].onclick();
    t.mock.timers.tick(90);
    assert.equal($('classifyTags').children[0],firstTag);
    assert.equal($('classifyTags').children.length,2);
    // Undo an accepted answer before the next question is painted.
    $('classifyOptions').children[0].onclick();
    $('classifyUndo').onclick();
    const question=$('classifyQuestion').textContent;
    t.mock.timers.tick(1000);
    assert.equal($('classifyQuestion').textContent,question);
    assert.equal($('classifyTags').children.length,2);
    // Closing cancels the scheduled UI update but saves the accepted answer.
    $('classifyOptions').children[0].onclick();
    $('closeClassify').onclick();
    assert.equal($('classifyDialog').open,false);
    t.mock.timers.tick(1000);
    ui.open();
    assert.equal($('classifyTags').children.length,3);
    assert.notEqual($('classifyQuestion').textContent,question);
    assert.equal(Object.keys(JSON.parse(store.get('paintlight-community-v1')).draft.answers).length,3);
  } finally {
    for(const key of keys){if(originals[key])Object.defineProperty(globalThis,key,originals[key]);else delete globalThis[key];}
    t.mock.timers.reset();
  }
});
