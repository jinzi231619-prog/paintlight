// Composition and recording rights are distinct. These recordings are CC BY 3.0.
export const MUSIC_TRACKS = [
  {
    id: 'gymnopedie-no-1', src: '/audio/gymnopedie-no-1.mp3', duration: '3:07',
    title: {zh: '第一号吉姆诺佩蒂', en: 'Gymnopédie No. 1'},
    description: {zh: '萨蒂 · 钢琴', en: 'Erik Satie · Piano'},
    creditTitle: 'Gymnopedie No. 1',
    source: 'https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100787'
  },
  {
    id: 'canon-in-d', src: '/audio/canon-in-d.mp3', duration: '5:56',
    title: {zh: 'D 大调卡农', en: 'Canon in D Major'},
    description: {zh: '帕赫贝尔 · 弦乐与竖琴', en: 'Johann Pachelbel · Strings & harp'},
    creditTitle: 'Canon in D Major',
    source: 'https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100301'
  }
];

export const MUSIC_KEY = 'paintlight-music-v1';
export function readMusicPreference(storage) {
  let saved;
  try { saved = JSON.parse(storage?.getItem(MUSIC_KEY) || '{}'); } catch {}
  return {
    welcomed: saved?.welcomed === true,
    track: MUSIC_TRACKS.some(track => track.id === saved?.track) ? saved.track : MUSIC_TRACKS[0].id,
    volume: typeof saved?.volume === 'number' && Number.isFinite(saved.volume)
      ? Math.min(1, Math.max(0, saved.volume)) : 0.22
  };
}

export function saveMusicPreference(storage, preference) {
  // Never persist playback intent: every document starts silent.
  try { storage?.setItem(MUSIC_KEY, JSON.stringify({welcomed: true, track: preference.track, volume: preference.volume})); }
  catch { /* A blocked store must not prevent browsing or pausing. */ }
}
