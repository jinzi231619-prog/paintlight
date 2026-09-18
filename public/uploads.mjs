import {t, message, joinText, localized, rawText, setText, setAttr, textNode, setupI18n, getLanguage} from './i18n.mjs';
import {TAGS} from './logic.mjs';
import {paletteFromImage} from './theme.mjs';
const $ = id => document.getElementById(id);
let account = {
  signedIn: false,
  uploadsReady: false
};
export async function loadAccount() {
  try {
    const r = await fetch('/api/account', {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: AbortSignal.timeout(6000)
    });
    if (!r.ok) throw Error();
    account = await r.json();
  } catch {
    account = {
      signedIn: false,
      uploadsReady: false
    };
  }
  return account;
}
function canUpload(notify) {
  if (!account.uploadsReady) {
    notify('个人画库登录和云端存储尚未配置；馆藏浏览不受影响。');
    return false;
  }
  if (!account.signedIn) {
    location.assign('/api/private/login');
    return false;
  }
  return true;
}
export async function loadUploads() {
  if (!account.signedIn) return [];
  const r = await fetch('/api/private/uploads', {
    credentials: 'same-origin',
    cache: 'no-store',
    signal: AbortSignal.timeout(10000)
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || '个人画库暂时无法读取。');
  return d.artworks;
}
export function setupUploads({onSaved, onDeleted, notify}) {
  let imageBlob = null, colors = [], previewUrl = null, uploadId = null, busy = false, selection = 0, deleteId = null;
  const error = message => {
    setText($('uploadError'), message);
    $('uploadError').hidden = !message;
  };
  const revoke = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  };
  const close = () => {
    if (busy) return;
    $('uploadDialog').close();
    selection++;
    revoke();
  };
  const open = () => {
    if (!canUpload(notify)) return false;
    $('uploadForm').reset();
    imageBlob = null;
    uploadId = 'user-' + crypto.randomUUID();
    selection++;
    revoke();
    $('uploadPreview').hidden = true;
    setText($('uploadFileLabel'), '选择一幅画 · JPG / PNG / WebP');
    $('saveUpload').disabled = true;
    error('');
    $('uploadDialog').showModal();
    return true;
  };
  const options = $('uploadTagOptions');
  TAGS.forEach(tag => {
    const label = document.createElement('label');
    label.className = 'chip';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = tag;
    input.name = 'uploadTag';
    label.append(input, textNode(tag));
    options.append(label);
  });
  $('uploadButton').onclick = open;
  $('closeUpload').onclick = close;
  $('cancelUpload').onclick = close;
  $('uploadDialog').addEventListener('cancel', e => {
    if (busy) e.preventDefault(); else {
      selection++;
      revoke();
    }
  });
  $('uploadFile').onchange = async () => {
    const ticket = ++selection;
    imageBlob = null;
    $('saveUpload').disabled = true;
    error('');
    revoke();
    $('uploadPreview').hidden = true;
    const file = $('uploadFile').files[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      error('请选择 JPG、PNG 或 WebP 图片。');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      error('原图不能超过 10 MB。');
      return;
    }
    setText($('uploadFileLabel'), '正在准备图片…');
    const original = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = original;
      });
      if (image.naturalWidth * image.naturalHeight > 32000000) throw new Error('图片像素过大，请选择小于 3200 万像素的图片。');
      const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const palette = paletteFromImage(canvas);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .9));
      if (!blob || blob.size > 6000000) throw new Error('图片处理失败，请换一张较小的图片。');
      if (ticket !== selection) return;
      imageBlob = blob;
      colors = palette;
      previewUrl = URL.createObjectURL(blob);
      $('uploadPreview').src = previewUrl;
      $('uploadPreview').hidden = false;
      setText($('uploadFileLabel'), rawText(file.name));
      $('saveUpload').disabled = false;
      if (!$('uploadTitle').value) $('uploadTitle').value = file.name.replace(/\.[^.]+$/, '').slice(0, 120);
    } catch (e) {
      if (ticket === selection) {
        error(e.message || '无法打开这张图片，请换一个文件。');
        setText($('uploadFileLabel'), '重新选择图片');
      }
    } finally {
      URL.revokeObjectURL(original);
    }
  };
  $('uploadForm').onsubmit = async e => {
    e.preventDefault();
    if (busy || !imageBlob) return;
    error('');
    busy = true;
    $('saveUpload').disabled = true;
    setText($('saveUpload'), '正在保存…');
    $('closeUpload').disabled = true;
    $('cancelUpload').disabled = true;
    const fields = [...$('uploadForm').querySelectorAll('input,textarea')];
    fields.forEach(f => f.disabled = true);
    const metadata = {
      title: $('uploadTitle').value,
      artist: $('uploadArtist').value,
      date: $('uploadDate').value,
      sourceUrl: $('uploadSource').value,
      notes: $('uploadNotes').value,
      tags: [...document.querySelectorAll('input[name="uploadTag"]:checked')].map(x => x.value),
      colors
    };
    const body = new FormData();
    body.append('id', uploadId);
    body.append('metadata', JSON.stringify(metadata));
    body.append('image', imageBlob, 'painting.jpg');
    try {
      const response = await fetch('/api/private/uploads', {
        method: 'POST',
        body,
        credentials: 'same-origin'
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '保存失败，请重试。');
      onSaved(data.artwork);
      $('uploadDialog').close();
      revoke();
      notify('已保存到你的云端画库。');
    } catch (e) {
      error(e.message || '连接中断，表单内容已保留，可以再次保存。');
    } finally {
      busy = false;
      fields.forEach(f => f.disabled = false);
      $('saveUpload').disabled = !imageBlob;
      setText($('saveUpload'), '保存到我的画库');
      $('closeUpload').disabled = false;
      $('cancelUpload').disabled = false;
    }
  };
  $('cancelDelete').onclick = () => $('deleteDialog').close();
  $('confirmDelete').onclick = async () => {
    if (!deleteId) return;
    $('confirmDelete').disabled = true;
    $('cancelDelete').disabled = true;
    $('deleteError').hidden = true;
    try {
      const r = await fetch('/api/private/uploads/' + deleteId, {
        method: 'DELETE',
        credentials: 'same-origin'
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '删除失败，请重试。');
      onDeleted(deleteId);
      $('deleteDialog').close();
      notify('已从个人画库删除。');
      deleteId = null;
    } catch (e) {
      setText($('deleteError'), e.message || '删除失败，请重试。');
      $('deleteError').hidden = false;
    } finally {
      $('confirmDelete').disabled = false;
      $('cancelDelete').disabled = false;
    }
  };
  $('deleteDialog').addEventListener('cancel', e => {
    if ($('confirmDelete').disabled) e.preventDefault();
  });
  return {
    open,
    async importCandidate(a) {
      if (!open()) return;
      const ticket = selection;
      $('uploadTitle').value = a.title.slice(0, 120);
      $('uploadArtist').value = a.artist.slice(0, 120);
      $('uploadDate').value = a.date.slice(0, 80);
      $('uploadSource').value = a.sourceUrl;
      $('uploadNotes').value = t('在线搜索候选，画面条件尚待本人确认。');
      setText($('uploadFileLabel'), '正在读取来源图片…');
      if (!a.imageUrl || !a.importAllowed) {
        setText($('uploadFileLabel'), '请先核实来源授权，再手动选择图片');
        return;
      }
      try {
        const response = await fetch('/api/search/image?url=' + encodeURIComponent(a.imageUrl), {
          signal: AbortSignal.timeout(18000),
          credentials: 'same-origin'
        });
        if (!response.ok) throw new Error('来源图片暂不可用。资料已填好，也可以手动选择图片。');
        const blob = await response.blob();
        if (ticket !== selection) return;
        const file = new File([blob], 'painting.' + (blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'), {
          type: blob.type
        });
        const transfer = new DataTransfer();
        transfer.items.add(file);
        $('uploadFile').files = transfer.files;
        await $('uploadFile').onchange();
      } catch (e) {
        if (ticket === selection) {
          error(e.message || '图片读取失败，请手动选择图片。');
          setText($('uploadFileLabel'), '手动选择来源图片');
        }
      }
    },
    requestDelete(art) {
      deleteId = art.id;
      setText($('deleteTitle'), rawText(art.titleZh));
      $('deleteError').hidden = true;
      $('deleteDialog').showModal();
    }
  };
}
