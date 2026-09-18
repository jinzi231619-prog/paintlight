import {localized, rawText, setText, setAttr} from './i18n.mjs';
import {inspirationFor} from './inspiration-data.mjs';
import {createNotebook, NOTE_LIMIT} from './notebook-store.mjs';

const copy = value => localized(value.zh, value.en);
const $ = id => document.getElementById(id);

export function setupInspiration({notify}) {
  // Resolve storage lazily: privacy modes can throw even when reading localStorage.
  const notebook = createNotebook({
    getItem: key => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value)
  });
  const drafts = new Map();
  const dirty = new Set();
  let artwork = null;

  const state = value => setText($('noteStatus'), value);
  function save() {
    if (!artwork) return true;
    const text = drafts.get(artwork.id) ?? '';
    try {
      notebook.save(artwork.id, text);
      dirty.delete(artwork.id);
      state(localized('已保存在此浏览器', 'Saved in this browser'));
      return true;
    } catch {
      state(localized('未能保存，请下载笔记备份。当前页面仍保留文字。', 'Could not save. Download a copy; your text remains on this page.'));
      return false;
    }
  }

  $('inspirationNote').maxLength = NOTE_LIMIT;
  $('inspirationNote').addEventListener('input', () => {
    if (!artwork) return;
    drafts.set(artwork.id, $('inspirationNote').value);
    dirty.add(artwork.id);
    state(localized('有未保存的修改', 'Unsaved changes'));
  });
  $('saveNote').addEventListener('click', save);
  $('downloadNote').addEventListener('click', () => {
    if (!artwork) return;
    const title = artwork.titleZh || artwork.title;
    const text = drafts.get(artwork.id) ?? '';
    const url = URL.createObjectURL(new Blob([
      `${title}\n${artwork.artist}\n${artwork.sourceUrl || ''}\n\n${text}\n`
    ], {type: 'text/plain;charset=utf-8'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = `Paintlight-${artwork.id}.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  // Switches save drafts; navigation warns only when an explicit save has not succeeded.
  addEventListener('beforeunload', event => {
    if (!dirty.size) return;
    event.preventDefault();
    event.returnValue = '';
  });

  function render(next) {
    if (artwork && artwork.id !== next.id && dirty.has(artwork.id) && !save()) {
      notify(localized('上一幅的笔记尚未保存，返回该画作可继续编辑或下载。', 'The previous note is unsaved. Return to that painting to edit or download it.'));
    }
    artwork = next;
    const study = inspirationFor(next);
    $('studyContent').hidden = !study;
    $('studyPending').hidden = !!study;
    setText($('studyTitle'), study ? copy(study.title) : localized('留一点空间，给你的观察', 'Leave some room for your own eye'));
    setText($('studyLens'), study ? copy(study.lens) : localized('从看见，到想到', 'From noticing to imagining'));
    setText($('studyProvenance'), study
      ? localized('AI 辅助解读 · 尚未经摄影师复核', 'AI-assisted reading · Not yet photographer-reviewed')
      : localized('专属解读待整理', 'A dedicated reading is still to come'));
    if (study) {
      for (const [id, key] of [['studyObservation', 'observation'], ['studyReading', 'reading'], ['studyExperiment', 'experiment'], ['studyBoundary', 'boundary']]) {
        setText($(id), copy(study[key]));
      }
      $('studySteps').replaceChildren(...study.steps.map(step => {
        const li = document.createElement('li');
        setText(li, copy(step));
        return li;
      }));
    }
    setText($('studyPendingText'), next.userAdded
      ? localized('这是你的个人画作。先写下自己的观察与拍摄想法，笔记不会公开。', 'This is your own painting. Start with your observations and ideas; your note stays private.')
      : localized('这幅画还没有逐项整理的灵感解读。你可以先观察最吸引你的一个细节，写下想尝试的变化。', 'This painting does not yet have a structured inspiration study. Notice one detail that draws you in, then write down a change you would like to try.'));
    $('uploaderObservation').hidden = !(next.userAdded && next.notes);
    setText($('uploaderObservation'), rawText(next.userAdded && next.notes ? next.composition : ''));
    if (!drafts.has(next.id)) drafts.set(next.id, notebook.read(next.id)?.text || '');
    $('inspirationNote').value = drafts.get(next.id);
    setAttr($('inspirationNote'), 'placeholder', study ? copy(study.prompt) : localized('我注意到……我想尝试……', 'I noticed… I would like to try…'));
    state(dirty.has(next.id) ? localized('有未保存的修改', 'Unsaved changes')
      : drafts.get(next.id) ? localized('已保存在此浏览器', 'Saved in this browser') : localized('写下下一次拍摄的起点', 'A starting point for your next photograph'));
  }
  return {render};
}
