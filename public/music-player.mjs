// Owns a single audio element; the UI cannot accidentally create overlapping players.
export function createMusicPlayer({audio, tracks, track, volume = 0.22, isVisible = () => true, onChange = () => {}}) {
  let selected = tracks.findIndex(item => item.id === track);
  if (selected < 0) selected = 0;
  let status = 'idle', wanted = false, generation = 0, source = null, reason = '';
  audio.preload = 'none';
  audio.volume = volume;
  const state = () => ({track: tracks[selected], status, wanted, volume: audio.volume, reason});
  const emit = () => onChange(state());

  function pause(why = '') {
    ++generation;
    wanted = false;
    audio.pause();
    status = 'paused';
    reason = why;
    emit();
  }
  async function play() {
    if (!isVisible()) { pause('hidden'); return false; }
    const token = ++generation;
    wanted = true;
    status = 'loading';
    reason = '';
    if (source !== tracks[selected].src || audio.error) {
      source = tracks[selected].src;
      audio.src = source;
      audio.load();
    }
    emit();
    try {
      await audio.play();
      if (token !== generation || !wanted || !isVisible()) {
        if (!wanted || !isVisible()) audio.pause();
        return false;
      }
      status = 'playing';
      emit();
      return true;
    } catch {
      if (token === generation && wanted) {
        wanted = false;
        audio.pause();
        status = 'error';
        emit();
      }
      return false;
    }
  }
  function select(id) {
    const index = tracks.findIndex(item => item.id === id);
    if (index < 0 || selected === index) return;
    const resume = wanted;
    pause();
    selected = index;
    emit();
    if (resume) void play();
  }
  function setVolume(value) {
    if (!Number.isFinite(value)) return;
    audio.volume = Math.min(1, Math.max(0, value));
    emit();
  }
  audio.addEventListener('playing', () => {
    if (!wanted || !isVisible()) { audio.pause(); return; }
    status = 'playing'; emit();
  });
  audio.addEventListener('waiting', () => { if (wanted) { status = 'loading'; emit(); } });
  audio.addEventListener('error', () => {
    if (!wanted || !audio.error) return;
    ++generation; wanted = false; audio.pause(); status = 'error'; emit();
  });
  audio.addEventListener('pause', () => {
    // Ignore a queued pause event from switching tracks if playback already resumed.
    if (wanted && audio.paused && !audio.ended) pause();
  });
  audio.addEventListener('ended', () => {
    if (!wanted || !isVisible()) { pause(); return; }
    selected = (selected + 1) % tracks.length;
    void play();
  });
  return {state, play, pause, select, setVolume, toggle: () => wanted ? pause() : play()};
}
