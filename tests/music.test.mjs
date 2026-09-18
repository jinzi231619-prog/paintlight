import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createMusicPlayer} from '../public/music-player.mjs';
import {MUSIC_TRACKS, MUSIC_KEY, readMusicPreference, saveMusicPreference} from '../public/music-tracks.mjs';

class AudioFake extends EventTarget {
  paused = true; ended = false; volume = 1; error = null;
  loads = 0; pending = [];
  load() { this.loads++; this.error = null; }
  pause() { this.paused = true; }
  play() {
    this.paused = false;
    return new Promise((resolve, reject) => this.pending.push({resolve: () => {this.paused = false; resolve();}, reject}));
  }
  fire(type) { this.dispatchEvent(new Event(type)); }
}
function fixture(extra = {}) {
  const audio = new AudioFake();
  const player = createMusicPlayer({audio, tracks:MUSIC_TRACKS, ...extra});
  return {audio, player};
}

test('even a returning visitor starts silent, with no audio request, and paused track selection does not load', () => {
  const values = new Map();
  const storage = {getItem:key=>values.get(key), setItem:(key,value)=>values.set(key,value)};
  saveMusicPreference(storage, {track:'canon-in-d', volume:0.15, playing:true});
  const preference = readMusicPreference(storage);
  assert.deepEqual(preference, {welcomed:true, track:'canon-in-d', volume:0.15});
  assert(!values.get(MUSIC_KEY).includes('playing'));
  const {audio, player} = fixture(preference);
  assert.equal(audio.src, undefined);
  assert.equal(audio.loads, 0);
  assert.equal(audio.paused, true);
  assert.equal(player.state().wanted, false);
  player.select('gymnopedie-no-1');
  assert.equal(audio.loads, 0);
  assert.equal(audio.src, undefined);
  assert.equal(audio.pending.length, 0);
  assert.doesNotThrow(()=>saveMusicPreference({setItem(){throw Error('blocked');}}, preference));
  assert.equal(readMusicPreference({getItem(){throw Error('blocked');}}).welcomed, false);
  assert.equal(readMusicPreference({getItem:()=>'{broken'}).volume, 0.22);
});

test('pause wins over a pending play promise, and a hidden page cannot start music', async () => {
  let visible = true;
  const {audio, player} = fixture({isVisible:()=>visible});
  const start = player.play();
  assert.equal(player.state().status, 'loading');
  assert.equal(audio.loads, 1);
  player.pause();
  audio.pending[0].resolve();
  assert.equal(await start, false);
  assert.equal(audio.paused, true);
  assert.equal(player.state().status, 'paused');
  audio.fire('playing');
  assert.equal(audio.paused, true);
  visible = false;
  assert.equal(await player.play(), false);
  assert.equal(audio.pending.length, 1);
  visible = true;
  assert.equal(player.state().wanted, false);
});

test('rapid track changes ignore stale play failures and never start another player', async () => {
  const {audio, player} = fixture();
  const first = player.play();
  player.select('canon-in-d');
  assert.equal(audio.pending.length, 2);
  assert.equal(audio.src, MUSIC_TRACKS[1].src);
  audio.pending[0].reject(Error('interrupted'));
  assert.equal(await first, false);
  assert.equal(player.state().wanted, true);
  audio.pending[1].resolve();
  await Promise.resolve();
  assert.equal(player.state().status, 'playing');
  assert.equal(player.state().track.id, 'canon-in-d');
  assert.equal(audio.paused, false);
});

test('failed playback can be retried; playlist advancement requires active intent', async () => {
  const {audio, player} = fixture();
  const first = player.play();
  audio.pending[0].reject(Error('NotAllowedError'));
  assert.equal(await first, false);
  assert.equal(player.state().status, 'error');
  assert.equal(player.state().wanted, false);
  const retry = player.play();
  audio.pending[1].resolve();
  assert.equal(await retry, true);
  audio.ended = true;
  audio.fire('ended');
  assert.equal(player.state().track.id, 'canon-in-d');
  assert.equal(audio.pending.length, 3);
  player.pause('hidden');
  audio.pending[2].resolve();
  await Promise.resolve();
  audio.fire('ended');
  assert.equal(audio.pending.length, 3);
  assert.equal(audio.paused, true);
});

test('music assets, attribution and silent HTML defaults ship together', async () => {
  const html = await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  const audioTag = html.match(/<audio\b[^>]*>/)[0];
  assert.match(audioTag, /preload="none"/);
  assert.doesNotMatch(audioTag, /\b(?:src|autoplay)\b/);
  const credits = await readFile(new URL('../public/audio/CREDITS.md',import.meta.url),'utf8');
  for (const track of MUSIC_TRACKS) {
    const bytes = await readFile(new URL('../public'+track.src,import.meta.url));
    assert(bytes.length > 1_000_000);
    assert(credits.includes(track.source));
    assert(credits.includes(track.creditTitle));
  }
  assert(credits.includes('https://creativecommons.org/licenses/by/3.0/'));
});
