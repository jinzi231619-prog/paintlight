import {setupClassification} from './classify.mjs';
import {t, message, joinText, localized, rawText, setText, setAttr, textNode, setupI18n, getLanguage} from './i18n.mjs';
import {GROUPS, TAGS, parseQuery, filterArtworks, chooseRandom, colorDistance} from './logic.mjs';
import {applyTheme} from './theme.mjs';
import {loadAccount, loadUploads, setupUploads} from './uploads.mjs';
import {setupOnline} from './online.mjs';
import {setupInspiration} from './inspiration.mjs';
import {INSPIRATION_IDS, inspirationFor} from './inspiration-data.mjs';
let inspiration;
let uploadControls, uploadsError = '';
const $ = id => document.getElementById(id);
let artworks = [], byId = new Map(), selected = [], current = null, view = '自由偶遇', history = [], cursor = -1, seen = new Set(), favorites = new Set(), recent = [], toastTimer, loadTimer;
const storageKey = 'paintlight-v1';
function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(storageKey) || '{}');
    favorites = new Set(Array.isArray(s.favorites) ? s.favorites.filter(x => typeof x === 'string').slice(0, 10000) : []);
    recent = Array.isArray(s.recent) ? s.recent.filter(x => typeof x === 'string').slice(0, 120) : [];
    seen = new Set(recent.slice(0, Math.min(12, Math.max(0, artworks.length - 1))));
  } catch {
    favorites = new Set();
    recent = [];
  }
}
function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({
      favorites: [...favorites],
      recent
    }));
  } catch {
    toast('浏览器未能保存记录；当前页面仍可继续使用。');
  }
}
function toast(text) {
  setText($('toast'), text);
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').hidden = true, 3400);
}
function status(text = '') {
  setText($('statusMessage'), text);
  $('statusMessage').hidden = !text;
}
function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) setText(n, text);
  return n;
}
function catalogCounts() {
  const own = artworks.filter(a => a.userAdded).length, expanded = artworks.filter(a => a.expandedCatalog).length;
  return message("{v0} 幅馆藏{v1}{v2}", {
    v0: artworks.length - own,
    v1: expanded ? message('（{count} 幅标签待核验）', {count: expanded}) : '',
    v2: own ? message(' + {count} 幅个人画作', {count: own}) : ''
  });
}
function paintingTitle(art) {
  return art.userAdded ? rawText(art.titleZh) : localized(art.titleZh || art.title, art.title || art.titleZh);
}
function paintingNotes(art) {
  const study = inspirationFor(art);
  if (study) return localized(study.observation.zh, study.observation.en);
  return art.userAdded && art.notes ? rawText(art.composition) : '';
}
function refreshCatalog() {
  byId = new Map(artworks.map(a => [a.id, a]));
  setText($('catalogCount'), catalogCounts());
}
function pool() {
  return filterArtworks(artworks, selected);
}
function chip(tag, callback, active = false) {
  const b = el('button', 'chip', tag);
  b.type = 'button';
  b.setAttribute('aria-pressed', String(active));
  b.onclick = callback;
  return b;
}
function renderFilters() {
  $('filterGroups').replaceChildren();
  GROUPS.forEach(([label, tags]) => {
    const g = el('div', 'filter-group');
    g.append(el('h2', '', label));
    const wrap = el('div', 'chips');
    tags.forEach(t => wrap.append(chip(t, () => toggleTag(t), selected.includes(t))));
    g.append(wrap);
    $('filterGroups').append(g);
  });
  setText($('selectedCount'), selected.length);
  $('activeFilters').replaceChildren();
  if (!selected.length) $('activeFilters').append(el('span', 'hint', '不限定，看看会遇见什么。'));
  selected.forEach(t => {
    const b = chip(message("{v0} ×", {
      v0: t
    }), () => toggleTag(t));
    setAttr(b, 'aria-label', message("移除条件：{v0}", {
      v0: t
    }));
    $('activeFilters').append(b);
  });
}
function toggleTag(tag) {
  selected = selected.includes(tag) ? selected.filter(t => t !== tag) : [...selected, tag];
  $('query').value = '';
  renderFilters();
  runSearch();
}
function toolbar() {
  const n = pool().length;
  setText($('viewMode'), view);
  setText($('poolCount'), selected.length ? message("{v0} 幅符合全部条件", {
    v0: n
  }) : catalogCounts());
  $('previousButton').disabled = current ? cursor <= 0 : cursor < 0;
}
function updateFavorite() {
  const saved = !!current && favorites.has(current.id);
  $('favoriteCurrent').setAttribute('aria-pressed', String(saved));
  setAttr($('favoriteCurrent'), 'aria-label', saved ? '取消收藏这幅画' : '收藏这幅画');
  setText($('heartIcon'), saved ? '♥' : '♡');
  setText($('favoriteLabel'), saved ? '已收藏' : '收藏');
  setText($('favoritesCount'), favorites.size);
}
function setInsights(open) {
  $('insights').hidden = !open;
  $('insightsButton').setAttribute('aria-expanded', String(open));
  $('insightsButton').replaceChildren(textNode(open ? '收起拍摄灵感 ' : '看拍摄灵感 '), el('span', '', open ? '−' : '＋'));
}
function showArt(art, {record = true} = {}) {
  if (!art) return;
  current = art;
  if ($('adaptiveTheme').checked) applyTheme(art.colors);
  seen.add(art.id);
  status();
  if (record) {
    history = history.slice(0, cursor + 1);
    history.push(art.id);
    cursor = history.length - 1;
  }
  recent = [art.id, ...recent.filter(id => id !== art.id)].slice(0, 120);
  persist();
  $('artStage').setAttribute('aria-busy', 'true');
  $('emptyState').hidden = true;
  $('imageError').hidden = true;
  $('imageLoading').hidden = false;
  $('artImage').hidden = true;
  $('zoomButton').hidden = true;
  $('artInfo').hidden = false;
  const img = $('artImage');
  clearTimeout(loadTimer);
  img.onload = () => {
    clearTimeout(loadTimer);
    img.hidden = false;
    $('imageLoading').hidden = true;
    $('zoomButton').hidden = false;
    $('artStage').setAttribute('aria-busy', 'false');
  };
  img.onerror = () => {
    clearTimeout(loadTimer);
    img.hidden = true;
    $('imageLoading').hidden = true;
    $('imageError').hidden = false;
    $('artStage').setAttribute('aria-busy', 'false');
  };
  setAttr(img, "alt", message("{v0}，{v1}，{v2}。{v3}", {
    v0: paintingTitle(art),
    v1: art.artist,
    v2: art.date,
    v3: paintingNotes(art)
  }));
  img.src = art.image;
  loadTimer = setTimeout(() => {
    if (!img.complete) img.onerror();
  }, 15000);
  setText($('artTitle'), paintingTitle(art));
  setText($('originalTitle'), rawText(art.title));
  $('originalTitle').hidden = art.userAdded || getLanguage() === 'en' || art.title === art.titleZh;
  $('reviewNote').hidden = !(art.userAdded || art.expandedCatalog);
  setText($('reviewNote'), art.userAdded || art.expandedCatalog ? art.review : '');
  setText($('artDate'), message("{v0} · {v1}", {
    v0: art.date,
    v1: art.museum || '芝加哥艺术博物馆'
  }));
  setText($('artArtist'), art.artist);
  $('sourceLink').href = art.sourceUrl || '#';
  $('sourceLink').hidden = !art.sourceUrl;
  setText($('sourceLink'), art.userAdded ? '上传者提供的来源 ↗' : '馆藏原页 ↗');
  $('artTags').replaceChildren();
  art.tags.forEach(t => {
    const b = chip(t, () => {
      if (!selected.includes(t)) toggleTag(t); else toast('这个条件已经保留。');
    }, selected.includes(t));
    setAttr(b, "title", message("保留「{v0}」，查找符合条件的画作", {
      v0: t
    }));
    $('artTags').append(b);
  });
  inspiration.render(art);
  $('palette').replaceChildren();
  art.colors.forEach(c => {
    const sw = el('span', 'swatch');
    sw.style.backgroundColor = c;
    setAttr(sw, "title", c);
    sw.setAttribute('role', 'img');
    setAttr(sw, 'aria-label', message("近似色 {v0}", {
      v0: c
    }));
    $('palette').append(sw);
  });
  setInsights(true);
  updateFavorite();
  toolbar();
}
function showEmpty(unknown = []) {
  clearTimeout(loadTimer);
  current = null;
  $('artImage').onload = null;
  $('artImage').onerror = null;
  $('artImage').hidden = true;
  $('imageLoading').hidden = true;
  $('imageError').hidden = true;
  $('zoomButton').hidden = true;
  $('artInfo').hidden = true;
  $('emptyState').hidden = false;
  $('artStage').setAttribute('aria-busy', 'false');
  $('relaxOptions').replaceChildren();
  toolbar();
  if (unknown.length) {
    setText($('poolCount'), '有条件暂不支持');
    setText($('emptyText'), message("初版暂时不能核实「{v0}」。请修改输入或使用左侧标签；这些条件没有被忽略。", {
    v0: rawText(unknown.join(', '))
    }));
    status('请先修改尚不支持的条件，再查找。');
    return;
  }
  status();
  setText($('emptyText'), message("当前 {v0} 幅画作中，没有能确认同时满足「{v1}」的作品。", {
    v0: artworks.length,
    v1: joinText(...selected.flatMap((tag, i) => i ? [localized('、', ', '), tag] : [tag]))
  }));
  selected.forEach(t => {
    const rest = selected.filter(x => x !== t);
    const count = filterArtworks(artworks, rest).length;
    if (count) {
      const b = chip(message("移除「{v0}」 · {v1} 幅", {
        v0: t,
        v1: count
      }), () => toggleTag(t));
      $('relaxOptions').append(b);
    }
  });
}
function randomFromPool() {
  const p = pool();
  if (!p.length) {
    showEmpty();
    return null;
  }
  const {art, restarted} = chooseRandom(p, seen, current?.id);
  if (restarted) {
    p.forEach(a => seen.delete(a.id));
    toast(p.length === 1 ? '当前条件下只有这一幅。' : '这一轮已看完，开始新一轮偶遇。');
  }
  showArt(art);
  return art;
}
function runSearch() {
  view = selected.length ? '按条件找画' : '自由偶遇';
  status();
  return randomFromPool();
}
function submitQuery() {
  const parsed = parseQuery($('query').value);
  selected = [...new Set([...selected, ...parsed.tags])];
  renderFilters();
  if (parsed.unknown.length) {
    view = '按条件找画';
    showEmpty(parsed.unknown);
    return null;
  }
  return runSearch();
}
function freeRandom() {
  selected = [];
  $('query').value = '';
  renderFilters();
  view = '自由偶遇';
  return randomFromPool();
}
function collection(kind) {
  const saved = kind === 'favorites', own = kind === 'uploads', all = kind === 'catalog', studies = kind === 'studies';
  setText($('dialogTitle'), studies ? localized('从一幅画，开始一次创作', 'Start something with a painting') : all ? '全部画库' : own ? '我的画库' : saved ? '我的收藏' : '最近看过');
  setText($('dialogNote'), studies ? localized('5 个逐图整理的 AI 辅助解读：看见、理解、试拍。尚未经摄影师复核，欢迎带着自己的判断去尝试。', 'Five AI-assisted studies: notice, interpret, experiment. Not yet photographer-reviewed; bring your own judgment to each exercise.') : all ? joinText(catalogCounts(), '。标记为待核验的作品尚无场景标签；点击一幅即可进入自由浏览。') : own ? '你添加的作品仅自己可见，云端保存。资料和标签由上传者确认。' : saved ? '收藏保存在此浏览器，清除浏览器数据后会消失。' : '保留此浏览器最近看过的画作。打开记录会退出当前筛选。');
  $('collectionGrid').replaceChildren();
  const ids = (studies ? INSPIRATION_IDS : all ? artworks.filter(a => !a.userAdded).map(a => a.id) : own ? artworks.filter(a => a.userAdded).map(a => a.id) : saved ? [...favorites].reverse() : recent).filter(id => byId.has(id));
  if (own) {
    const row = el('div', 'collection-add');
    const add = el('button', 'primary', '＋ 添加画作');
    add.onclick = () => {
      $('collectionDialog').close();
      uploadControls.open();
    };
    row.append(add);
    $('collectionGrid').append(row);
    if (uploadsError) {
      const error = el('p', 'load-failure', uploadsError);
      const retry = el('button', 'secondary', '重新读取');
      retry.onclick = async () => {
        retry.disabled = true;
        try {
          const ownArts = await loadUploads();
          artworks = [...artworks.filter(a => !a.userAdded), ...ownArts];
          refreshCatalog();
          uploadsError = '';
          collection('uploads');
        } catch (e) {
          setText(error, e.message);
          retry.disabled = false;
        }
      };
      row.append(retry);
      $('collectionGrid').append(error);
    }
  }
  if (!ids.length) $('collectionGrid').append(el('div', 'collection-empty', own ? '把你喜欢的一幅画，放进自己的画库。' : saved ? '还没有收藏。遇到喜欢的画，点一下爱心。' : '画册还没有翻开。随机遇见第一幅吧。'));
  ids.forEach(id => {
    const a = byId.get(id);
    const b = el('button', 'collection-item');
    const img = el('img');
    img.src = a.image;
    setAttr(img, "alt", paintingTitle(a));
    img.loading = 'lazy';
    b.append(img, el('strong', '', paintingTitle(a)), el('span', '', rawText(a.artist)));
    if (studies) {
      const study = inspirationFor(a);
      b.append(el('p', 'hint', localized(study.title.zh, study.title.en)));
    }
    b.onclick = () => {
      selected = [];
      $('query').value = '';
      view = studies ? localized('灵感练习', 'Inspiration studies') : all ? '馆藏浏览' : own ? '我的画库' : saved ? '我的收藏' : '浏览记录';
      renderFilters();
      showArt(a);
      $('collectionDialog').close();
      $('artStage').scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    };
    if (own) {
      const wrap = el('div', 'upload-card'), del = el('button', 'delete-upload', '删除这幅画');
      del.onclick = () => uploadControls.requestDelete(a);
      wrap.append(b, del);
      $('collectionGrid').append(wrap);
    } else $('collectionGrid').append(b);
  });
  if (!$('collectionDialog').open) $('collectionDialog').showModal();
}
function similar(kind) {
  if (!current) return;
  let candidates = pool().filter(a => a.id !== current.id);
  if (!candidates.length) {
    toast('当前条件下还没有其他作品，试着减少一个条件。');
    return;
  }
  if (kind === 'color') {
    candidates.sort((a, b) => colorDistance(current, a) - colorDistance(current, b));
    candidates = candidates.slice(0, Math.min(4, candidates.length));
  } else {
    const shape = ['单人', '多人', '背影', '侧脸', '留白', '纵深'];
    const keys = current.tags.filter(t => shape.includes(t));
    if (!keys.length) {
      toast('这幅画暂时没有可用于构图探索的标签。');
      return;
    }
    const score = a => keys.filter(t => a.tags.includes(t)).length;
    candidates = candidates.filter(a => score(a) > 0).sort((a, b) => score(b) - score(a));
    if (!candidates.length) {
      toast('当前条件下没有构图标签相近的其他作品。');
      return;
    }
    candidates = candidates.filter(a => score(a) === score(candidates[0]));
  }
  const pick = chooseRandom(candidates, seen, current.id).art;
  view = kind === 'color' ? '沿着配色探索' : '沿着构图探索';
  showArt(pick);
  status(kind === 'color' ? '根据近似色板寻找；人物和场景仍遵守已选条件。' : '根据人物数量、姿态与空间标签寻找；已选条件保持不变。');
}
function initEvents() {
  $('browseStudies').onclick = $('seeStudies').onclick = () => collection('studies');
  $('privacyButton').onclick = () => $('privacyDialog').showModal();
  $('closePrivacy').onclick = () => $('privacyDialog').close();
  $('browseCatalog').onclick = () => collection('catalog');
  $('myUploadsButton').onclick = () => collection('uploads');
  $('adaptiveTheme').onchange = () => {
    if ($('adaptiveTheme').checked && current) applyTheme(current.colors); else {
      document.documentElement.removeAttribute('style');
      document.querySelector('meta[name=\"theme-color\"]').setAttribute('content', '#171b19');
    }
    try {
      localStorage.setItem('paintlight-adaptive-theme', String($('adaptiveTheme').checked));
    } catch {}
  };
  $('searchForm').onsubmit = e => {
    e.preventDefault();
    submitQuery();
  };
  $('freeRandom').onclick = freeRandom;
  $('emptyRandom').onclick = freeRandom;
  $('nextButton').onclick = randomFromPool;
  $('clearFilters').onclick = freeRandom;
  $('favoritesButton').onclick = () => collection('favorites');
  $('historyButton').onclick = () => collection('history');
  $('closeCollection').onclick = () => $('collectionDialog').close();
  $('previousButton').onclick = () => {
    if (current) {
      if (cursor <= 0) return;
      cursor--;
    } else if (cursor < 0) return;
    selected = [];
    $('query').value = '';
    view = '浏览记录';
    renderFilters();
    showArt(byId.get(history[cursor]), {
      record: false
    });
  };
  $('favoriteCurrent').onclick = () => {
    if (!current) return;
    favorites.has(current.id) ? favorites.delete(current.id) : favorites.add(current.id);
    persist();
    updateFavorite();
    toast(favorites.has(current.id) ? '已收藏，留给下一次拍摄。' : '已取消收藏。');
  };
  $('insightsButton').onclick = () => setInsights($('insights').hidden);
  $('similarColor').onclick = () => similar('color');
  $('similarComposition').onclick = () => similar('composition');
  $('retryImage').onclick = () => {
    if (current) showArt(current, {
      record: false
    }); else location.reload();
  };
  $('zoomButton').onclick = () => {
    if (!current) return;
    $('zoomImage').src = current.image;
    setAttr($('zoomImage'), "alt", paintingTitle(current));
    setText($('zoomCaption'), message("{v0} · {v1}", {
      v0: paintingTitle(current),
      v1: current.artist
    }));
    $('zoomDialog').showModal();
  };
  $('closeZoom').onclick = () => $('zoomDialog').close();
  for (const dialog of [$('collectionDialog'), $('zoomDialog')]) dialog.addEventListener('click', e => {
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
    }
  });
}
function registerTools() {
  if (!document.modelContext?.registerTool) return;
  const lifecycle = new AbortController();
  const register = tool => {
    try {
      Promise.resolve(document.modelContext.registerTool(tool, {
        signal: lifecycle.signal
      })).catch(() => {});
    } catch {}
  };
  const snapshot = () => ({
    current: current ? {
      id: current.id,
      title: current.titleZh,
      artist: current.artist,
      source: current.sourceUrl
    } : null,
    filters: selected,
    eligible: pool().length
  });
  register({
    name: 'paintlight_random',
    title: '随机遇见绘画',
    description: '显示一幅随机绘画。tags 指定所有必须满足的标签；空数组清除条件并从全库抽取。',
    inputSchema: {
      type: 'object',
      properties: {
        tags: {
          type: 'array',
          items: {
            type: 'string',
            enum: TAGS
          }
        }
      },
      required: ['tags'],
      additionalProperties: false
    },
    annotations: {
      readOnlyHint: false,
      untrustedContentHint: false
    },
    execute(input) {
      if (!input || !Array.isArray(input.tags) || input.tags.some(t => !TAGS.includes(t))) throw new Error('Unsupported tags');
      selected = [...new Set(input.tags)];
      $('query').value = '';
      renderFilters();
      runSearch();
      return snapshot();
    }
  });
  register({
    name: 'paintlight_read_current',
    title: '读取当前画作与条件',
    description: '读取当前显示的画作及筛选条件，不改变页面。',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false
    },
    annotations: {
      readOnlyHint: true,
      untrustedContentHint: false
    },
    execute: snapshot
  });
  addEventListener('pagehide', () => lifecycle.abort(), {
    once: true
  });
}
async function init() {
  if (matchMedia('(max-width:700px)').matches) $('searchPanel').open = false;
  try {
    $('adaptiveTheme').checked = localStorage.getItem('paintlight-adaptive-theme') !== 'false';
  } catch {}
  // Account availability must not block the public gallery or free search.
  $('uploadButton').disabled = $('myUploadsButton').disabled = true;
  const accountReady = loadAccount().then(account => {
    $('uploadButton').disabled = $('myUploadsButton').disabled = false;
    $('accountButton').hidden = !account.uploadsReady;
    setText($('accountButton'), account.signedIn ? '退出画库' : '登录画库');
    $('accountButton').href = account.signedIn ? '/cdn-cgi/access/logout' : '/api/private/login';
    return account;
  });
  renderFilters();
  initEvents();
  inspiration = setupInspiration({notify: toast});
  uploadControls = setupUploads({
    notify: toast,
    onSaved(art) {
      artworks = [art, ...artworks.filter(a => a.id !== art.id)];
      refreshCatalog();
      uploadsError = '';
      selected = [];
      $('query').value = '';
      renderFilters();
      view = '我的画库';
      showArt(art);
    },
    onDeleted(id) {
      artworks = artworks.filter(a => a.id !== id);
      favorites.delete(id);
      recent = recent.filter(x => x !== id);
      history = history.filter(x => x !== id);
      cursor = history.length - 1;
      refreshCatalog();
      persist();
      updateFavorite();
      if (current?.id === id) runSearch(); else toolbar();
      if ($('collectionDialog').open) collection('uploads');
    }
  });
  setupOnline({
    getQuery: () => $('query').value || selected.map(tag => t(tag)).join(' '),
    onImport: a => uploadControls.importCandidate(a),
    onView: id => {
      const art = byId.get(id);
      if (!art) return;
      selected = [];
      $('query').value = '';
      view = '馆藏浏览';
      renderFilters();
      showArt(art);
    }
  });
  try {
    const r = await fetch('/artworks.json');
    if (!r.ok) throw new Error('Catalog request failed');
    const data = await r.json();
    if (!Array.isArray(data) || !data.length) throw new Error('Empty catalog');
    artworks = data;
    refreshCatalog();
    setupClassification({getArtworks: () => artworks});
    loadState();
    updateFavorite();
    freeRandom();
    $('browseStudies').disabled = false;
    registerTools();
    // Private uploads arrive independently; never replace the visitor's current painting.
    accountReady.then(() => loadUploads()).then(ownArts => {
      artworks = [...artworks, ...ownArts.filter(a => !byId.has(a.id))];
      refreshCatalog();
      toolbar();
    }).catch(e => {
      uploadsError = e.message;
    });
  } catch (e) {
    $('imageLoading').hidden = true;
    $('imageError').hidden = false;
    setText($('imageError').querySelector('p'), '画册暂时没能打开，请刷新后重试。');
    $('artStage').setAttribute('aria-busy', 'false');
    setText($('catalogCount'), '画册暂不可用');
    status('无法读取画册。请检查连接后重新加载。');
  }
}
setupI18n();
document.addEventListener('languagechange', () => {
  if (current) $('originalTitle').hidden = current.userAdded || getLanguage() === 'en' || current.title === current.titleZh;
});
init();
