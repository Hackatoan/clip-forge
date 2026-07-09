// Shared media import: turns dropped/selected files into tracks + clips.
// Used by the Media panel button and drag-and-drop onto the timeline.
import { store } from '../store/editorStore';

// opts: { trackId?, startTime? }
//  - trackId: drop onto this existing track if its type is compatible
//  - startTime: place the clip at this timeline position (default: playhead)
export function importFiles(files, opts = {}) {
  let added = 0;
  let stagger = 0;
  Array.from(files).forEach(file => {
    const isVideo = file.type.startsWith('video');
    const isAudio = file.type.startsWith('audio');
    const isImage = file.type.startsWith('image');
    const type = isVideo ? 'video' : isAudio ? 'audio' : isImage ? 'image' : null;
    if (!type) return;
    added++;

    const src = URL.createObjectURL(file);
    const start = Math.max(0, (opts.startTime ?? store.getState().playhead ?? 0) + stagger);

    // Reuse the drop-target track only if its type matches the file.
    let trackId = null;
    if (opts.trackId) {
      const t = store.getState().tracks.find(x => x.id === opts.trackId);
      if (t && t.type === type) trackId = t.id;
    }
    if (!trackId) trackId = store.addTrack(type);

    const dur = isImage ? 5 : 10;
    store.addClip(trackId, {
      src, name: file.name, start, duration: dur,
      ...(isVideo || isImage ? { fit: 'cover' } : {}),
    });
    stagger += dur; // avoid stacking multiple dropped files exactly on top

    if (!isImage) {
      const el = document.createElement(isVideo ? 'video' : 'audio');
      el.src = src;
      el.onloadedmetadata = () => {
        const clip = store.getState().tracks.find(t => t.id === trackId)?.clips.slice(-1)[0];
        if (clip) store.updateClip(clip.id, { duration: el.duration }, true);
      };
    }
  });
  return added;
}
