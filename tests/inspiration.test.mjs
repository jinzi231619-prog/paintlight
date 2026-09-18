import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {INSPIRATION_IDS, INSPIRATIONS, inspirationFor} from '../public/inspiration-data.mjs';
import {createNotebook, NOTE_LIMIT, NOTE_PREFIX} from '../public/notebook-store.mjs';
import {setupInspiration} from '../public/inspiration.mjs';
import {setLanguage} from '../public/i18n.mjs';

test('studies belong to real public artworks and provide complete bilingual readings', async () => {
  const artworks = JSON.parse(await readFile(new URL('../public/artworks.json', import.meta.url)));
  for (const id of INSPIRATION_IDS) {
    const art = artworks.find(art => art.id === id);
    assert(art?.isPublicDomain && art.sourceUrl && art.image, id);
    const study = inspirationFor(art);
    assert.equal(study, INSPIRATIONS[id]);
    for (const value of [study.title, study.lens, study.observation, study.reading, study.experiment, study.boundary, study.prompt, ...study.steps]) {
      assert(value.zh.length > 0 && value.en.length > 0);
      assert(!/[\u3400-\u9fff]/.test(value.en));
    }
    assert.equal(inspirationFor({...art, userAdded:true}), null);
  }
  assert.equal(inspirationFor({id:'unreviewed'}), null);
  assert.equal(inspirationFor({id:'constructor'}), null);
});

test('notes survive recreation, stay tied to an artwork, and fail explicitly on storage errors', () => {
  const data = new Map();
  const storage = {getItem:key=>data.get(key), setItem:(key,value)=>data.set(key,value)};
  const first = createNotebook(storage);
  const text = '窗边的手 / hands by a window\n<img src=x onerror=alert(1)>';
  first.save('a', text);
  const second = createNotebook(storage);
  assert.equal(second.read('a').text, text);
  assert.equal(second.read('b'), null);
  assert.throws(() => first.save('a', 'x'.repeat(NOTE_LIMIT + 1)));
  assert.equal(second.read('a').text, text);
  data.set(NOTE_PREFIX + 'a', '{broken');
  assert.equal(second.read('a'), null);
  data.set(NOTE_PREFIX + 'a', JSON.stringify({version:1,artworkId:'b',text:'wrong work'}));
  assert.equal(second.read('a'), null);
  const blocked = createNotebook({getItem(){throw Error('blocked');},setItem(){throw Error('quota');}});
  assert.equal(blocked.read('a'), null);
  assert.throws(()=>blocked.save('a','keep this draft'), /quota/);
});

test('switching paintings keeps unsaved drafts when storage fails and never claims a public post', () => {
  const keys = ['document','localStorage','addEventListener'];
  const original = Object.fromEntries(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const elements = new Map();
  const make = () => ({textContent:'',hidden:false,value:'',attributes:{},listeners:{},
    addEventListener(name,fn){this.listeners[name]=fn;},
    setAttribute(name,value){this.attributes[name]=value;},
    replaceChildren(...children){this.children=children;}});
  const get = id => {if(!elements.has(id)) elements.set(id,make());return elements.get(id);};
  const stored = new Map();
  let blocked = true;
  const notices = [];
  try {
    Object.defineProperty(globalThis,'document',{configurable:true,value:{getElementById:get,createElement:make}});
    Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>stored.get(key),setItem(key,value){if(blocked)throw Error('quota');stored.set(key,value);}}});
    Object.defineProperty(globalThis,'addEventListener',{configurable:true,value:()=>{}});
    setLanguage('en');
    const ui = setupInspiration({notify:value=>notices.push(value)});
    ui.render({id:'met-438417'});
    assert.equal(get('studyContent').hidden,false);
    assert.match(get('studyProvenance').textContent,/Not yet photographer-reviewed/);
    get('inspirationNote').value='<img src=x> My own note';
    get('inspirationNote').listeners.input();
    ui.render({id:'unreviewed'});
    assert.equal(get('studyContent').hidden,true);
    assert.equal(get('studyPending').hidden,false);
    assert.equal(get('inspirationNote').value,'');
    assert.equal(notices.length,1);
    ui.render({id:'met-438417'});
    assert.equal(get('inspirationNote').value,'<img src=x> My own note');
    assert.match(get('noteStatus').textContent,/Unsaved/);
    blocked=false;
    get('saveNote').listeners.click();
    assert.equal(get('noteStatus').textContent,'Saved in this browser');
    ui.render({id:'met-441379'});
    ui.render({id:'met-438417'});
    assert.equal(get('inspirationNote').value,'<img src=x> My own note');
  } finally {
    for(const key of keys) {
      if(original[key]) Object.defineProperty(globalThis,key,original[key]);
      else delete globalThis[key];
    }
    setLanguage('zh');
  }
});
