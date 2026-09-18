import {localized, rawText, setText, setAttr} from './i18n.mjs';
import {MUSIC_TRACKS, readMusicPreference, saveMusicPreference} from './music-tracks.mjs';
import {createMusicPlayer} from './music-player.mjs';

export function setupMusic() {
  const $ = id => document.getElementById(id);
  let storage;
  try { storage = localStorage; } catch {}
  const preference = readMusicPreference(storage);
  const trackButtons = new Map();
  for (const track of MUSIC_TRACKS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'music-track';
    const text = document.createElement('span');
    const title = document.createElement('strong');
    const description = document.createElement('small');
    const duration = document.createElement('span');
    setText(title, localized(track.title.zh, track.title.en));
    setText(description, localized(track.description.zh, track.description.en));
    duration.textContent = track.duration;
    duration.className = 'music-duration';
    text.append(title, description);
    button.append(text, duration);
    button.addEventListener('click', () => { player.select(track.id); remember(); });
    trackButtons.set(track.id, button);
    $('musicTracks').append(button);
  }
  function render(state) {
    const labels = {idle:'音乐已关闭', paused:'音乐已暂停', loading:'音乐加载中', playing:'音乐播放中', error:'音乐暂不可用'};
    setAttr($('musicToggle'), 'aria-label', state.wanted ? '暂停背景音乐' : '开启背景音乐');
    $('musicToggle').setAttribute('aria-pressed', String(state.wanted));
    $('musicToggle').dataset.playing = String(state.status === 'playing');
    setText($('musicLabel'), state.wanted ? '音乐 · 开' : '音乐 · 关');
    $('musicPlayIcon').hidden = state.wanted;
    $('musicPauseIcon').hidden = !state.wanted;
    setText($('musicPanelToggle'), state.wanted ? '暂停音乐' : '开启音乐');
    setText($('musicStatus'), state.status === 'error' ? '暂时无法播放，请再试一次。' : state.reason === 'hidden' ? '离开页面时已暂停，回来后可手动开启。' : labels[state.status]);
    setText($('musicNowTitle'), localized(state.track.title.zh, state.track.title.en));
    setText($('musicNowArtist'), localized(state.track.description.zh, state.track.description.en));
    $('musicVolume').value = Math.round(state.volume * 100);
    $('musicVolumeValue').value = Math.round(state.volume * 100) + '%';
    for (const [id, button] of trackButtons) button.setAttribute('aria-pressed', String(id === state.track.id));
    $('musicCreditSource').href = state.track.source;
    setText($('musicCreditSource'), rawText(state.track.creditTitle + ' — Kevin MacLeod (incompetech.com)'));
  }
  const player = createMusicPlayer({audio: $('galleryAudio'), tracks: MUSIC_TRACKS,
    track: preference.track, volume: preference.volume,
    isVisible: () => document.visibilityState !== 'hidden', onChange: render});
  const remember = () => saveMusicPreference(storage, {track: player.state().track.id, volume: player.state().volume});
  function dismiss() { $('musicInvitation').hidden = true; remember(); }
  function toggle() { dismiss(); void player.toggle(); }
  $('musicToggle').addEventListener('click', toggle);
  $('musicPanelToggle').addEventListener('click', toggle);
  $('acceptMusic').addEventListener('click', () => { dismiss(); void player.play(); });
  $('declineMusic').addEventListener('click', dismiss);
  $('dismissMusic').addEventListener('click', dismiss);
  $('musicSettings').addEventListener('click', () => { dismiss(); $('musicDialog').showModal(); });
  $('closeMusic').addEventListener('click', () => $('musicDialog').close());
  $('musicVolume').addEventListener('input', event => player.setVolume(Number(event.target.value) / 100));
  $('musicVolume').addEventListener('change', remember);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && player.state().wanted) player.pause('hidden');
  });
  window.addEventListener('pagehide', () => player.pause('hidden'));
  render(player.state());
  $('musicInvitation').hidden = preference.welcomed;
}
