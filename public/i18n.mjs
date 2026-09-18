import english from './locales/en.mjs';

export const LANGUAGE_KEY = 'paintlight-language';
export function preferredLanguage(saved, browserLanguage = 'zh-CN') {
  if (saved === 'zh' || saved === 'en') return saved;
  return /^en(?:-|$)/i.test(browserLanguage) ? 'en' : 'zh';
}
let saved;
try { saved = globalThis.localStorage?.getItem(LANGUAGE_KEY); } catch {}
let language = preferredLanguage(saved, globalThis.navigator?.language);
const bindings = new Set();
const records = new WeakMap();
let page;

export const getLanguage = () => language;
export const message = (key, values = {}) => ({kind: 'message', key, values});
export const joinText = (...values) => ({kind: 'join', values});
export const localized = (zh, en) => ({kind: 'localized', zh, en});
export const rawText = value => ({kind: 'raw', value});

export function t(value, locale = language) {
  if (value == null) return '';
  if (typeof value === 'object') {
    if (value.kind === 'raw') return String(value.value ?? '');
    if (value.kind === 'localized') return String(value[locale] ?? value.zh ?? '');
    if (value.kind === 'join') return value.values.map(v => t(v, locale)).join('');
    if (value.kind === 'message') {
      return t(value.key, locale).replace(/\{(\w+)\}/g, (token, key) =>
        Object.hasOwn(value.values, key) ? t(value.values[key], locale) : token);
    }
  }
  const text = String(value);
  if (locale !== 'en') return text;
  const key = text.trim();
  if (Object.hasOwn(english, key)) return text.replace(key, () => english[key]);
  const confirmation = /^上传者确认画面包含「(.+)」；未经馆藏核验。$/.exec(key);
  if (confirmation) return `The uploader confirmed “${t(confirmation[1], locale)}”; not museum-verified.`;
  const connection = /^OpenAI 连接检查返回 HTTP (\d+)。免费馆藏搜索和网页找图仍可使用。$/.exec(key);
  if (connection) return `OpenAI connection check returned HTTP ${connection[1]}. Free museum and web image searches remain available.`;
  return text;
}

function record(node) {
  let entry = records.get(node);
  if (!entry) {
    entry = {attributes: new Map()};
    records.set(node, entry);
    bindings.add(new WeakRef(node));
  }
  return entry;
}
export function setText(node, value) {
  record(node).text = value;
  node.textContent = t(value);
  return node.textContent;
}
export function setAttr(node, name, value) {
  record(node).attributes.set(name, value);
  node.setAttribute(name, t(value));
}
export function textNode(value) {
  const node = document.createTextNode('');
  setText(node, value);
  return node;
}

export function setLanguage(next) {
  if (!['zh', 'en'].includes(next)) return;
  language = next;
  try { globalThis.localStorage?.setItem(LANGUAGE_KEY, language); } catch {}
  if (!page) return;
  page.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
  for (const ref of bindings) {
    const node = ref.deref();
    if (!node?.isConnected) { bindings.delete(ref); continue; }
    const entry = records.get(node);
    if (Object.hasOwn(entry, 'text')) node.textContent = t(entry.text);
    for (const [name, value] of entry.attributes) node.setAttribute(name, t(value));
  }
  page.querySelectorAll('[data-language-select]').forEach(select => { select.value = language; });
  page.dispatchEvent(new CustomEvent('languagechange', {detail: {language}}));
}

export function setupI18n(doc = document) {
  page = doc;
  // Bind the initial static copy once; dynamic copy uses setText/setAttr.
  // Inputs, user content, and the application's canonical filter values are never rewritten.
  const walker = doc.createTreeWalker(doc.documentElement, 4);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    if (node.parentElement?.closest('script,style,[data-language-select]')) continue;
    if (/[\u3400-\u9fff]/.test(node.textContent)) setText(node, node.textContent);
  }
  for (const element of doc.querySelectorAll('[aria-label],[placeholder],[alt],meta[name="description"]')) {
    for (const name of ['aria-label', 'placeholder', 'alt', 'content']) {
      const value = element.getAttribute(name);
      if (value && /[\u3400-\u9fff]/.test(value)) setAttr(element, name, value);
    }
  }
  doc.querySelectorAll('[data-language-select]').forEach(select => {
    select.addEventListener('change', () => setLanguage(select.value));
  });
  setLanguage(language);
}
