import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {preferredLanguage,t,message,localized,rawText} from '../public/i18n.mjs';
import {TAGS,parseQuery,filterArtworks} from '../public/logic.mjs';
const artworks = JSON.parse(await readFile(new URL('../public/artworks.json',import.meta.url)));

test('language preference is explicit, persistent-compatible, and has a safe fallback',()=>{
  assert.equal(preferredLanguage('zh','en-US'),'zh');
  assert.equal(preferredLanguage('en','zh-CN'),'en');
  assert.equal(preferredLanguage(null,'en-GB'),'en');
  assert.equal(preferredLanguage('unexpected','zh-TW'),'zh');
  assert.equal(preferredLanguage(null,'fr-FR'),'zh');
});
test('English filter labels and prose preserve the same canonical strict conditions',()=>{
  for(const tag of TAGS) {
    const parsed=parseQuery(t(tag,'en'));
    assert.deepEqual(parsed,{tags:[tag],unknown:[]},tag);
    assert.deepEqual(filterArtworks(artworks,parsed.tags),filterArtworks(artworks,[tag]));
  }
  assert.deepEqual(new Set(parseQuery('Please find a painting with a man in a rainy street at night').unknown),new Set());
  const parsed=parseQuery('male, rainy street, night');
  assert.equal(parsed.unknown.length,0);
  assert.deepEqual(new Set(parsed.tags),new Set(['男性','雨天','街头','夜晚']));
  assert.deepEqual(parseQuery('female').tags,['女性']);
  assert(parseQuery('not male').unknown.includes('not'));
  assert(parseQuery('snowing').unknown.includes('snowing'));
});
test('every curated observation, evidence sentence and photography tip has an English translation',()=>{
  for(const art of artworks)for(const value of [art.composition,art.review,art.museum,...art.photoTips,...Object.values(art.evidence)]) {
    if(/[\u3400-\u9fff]/.test(value))assert(!/[\u3400-\u9fff]/.test(t(value,'en')),`${art.id}: ${value}`);
  }
});
test('messages localize counts and labels while user titles and notes remain untouched',()=>{
  const value=message('移除「{v0}」 · {v1} 幅',{v0:'男性',v1:12});
  assert.equal(t(value,'en'),'Remove “Male” · 12 works');
  assert.equal(t(value,'zh'),'移除「男性」 · 12 幅');
  assert.equal(t(localized('两人赏月','Two Men Contemplating the Moon'),'en'),'Two Men Contemplating the Moon');
  assert.equal(t(rawText('我的收藏'),'en'),'我的收藏');
  assert.equal(t(rawText('<img src=x onerror=alert(1)>'),'en'),'<img src=x onerror=alert(1)>');
});
