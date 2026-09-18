// Each artwork owns one local note. No account, network request, or public post.
export const NOTE_PREFIX = 'paintlight-note-v1:';
export const NOTE_LIMIT = 2400;
export function createNotebook(storage) {
  function read(artworkId) {
    try {
      const value = JSON.parse(storage.getItem(NOTE_PREFIX + artworkId) || 'null');
      return value?.version === 1 && value.artworkId === artworkId && typeof value.text === 'string'
        ? {...value, text: value.text.slice(0, NOTE_LIMIT)} : null;
    } catch { return null; }
  }
  function save(artworkId, text) {
    if (typeof artworkId !== 'string' || !artworkId || typeof text !== 'string' || text.length > NOTE_LIMIT) {
      throw new Error('Invalid note');
    }
    const record = {version: 1, artworkId, text, updatedAt: new Date().toISOString()};
    // The caller handles quota/blocked-storage errors and retains the in-memory draft.
    storage.setItem(NOTE_PREFIX + artworkId, JSON.stringify(record));
    return record;
  }
  return {read, save};
}
