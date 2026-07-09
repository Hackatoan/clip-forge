// Shared media import: turns dropped/selected files into tracks + clips.
// Used by the Media panel button, folder picker, and drag-and-drop.
import { store } from '../store/editorStore';

function typeOf(file) {
  if (file.type.startsWith('video')) return 'video';
  if (file.type.startsWith('audio')) return 'audio';
  if (file.type.startsWith('image')) return 'image';
  return null;
}

// opts:
//  - trackId:     drop onto this existing track if its type is compatible
//  - startTime:   place the first clip at this timeline position (default: playhead)
//  - groupByType: put all files of the same type on one shared layer, back-to-back
//                 (used for folder / bulk import so we don't spawn dozens of tracks)
export function importFiles(files, opts = {}) {
  const list = Array.from(files).filter(typeOf);
  if (!list.length) return 0;

  const base = opts.startTime ?? store.getState().playhead ?? 0;
  const typeTrack = {};   // type -> trackId (groupByType)
  const nextStart = {};   // trackId -> next free start time

  for (const file of list) {
    const type = typeOf(file);
    const isVideo = type === 'video';
    const isImage = type === 'image';
    const src = URL.createObjectURL(file);

    // Pick the destination track.
    let trackId = null;
    if (opts.trackId) {
      const t = store.getState().tracks.find(x => x.id === opts.trackId);
      if (t && t.type === type) trackId = t.id;
    }
    if (!trackId && opts.groupByType && typeTrack[type]) trackId = typeTrack[type];
    if (!trackId) {
      trackId = store.addTrack(type);
      if (opts.groupByType) typeTrack[type] = trackId;
    }

    // Sequential placement per track so clips don't stack on top of each other.
    const start = Math.max(0, nextStart[trackId] ?? base);
    const dur = isImage ? 5 : 10;
    nextStart[trackId] = start + dur;

    store.addClip(trackId, {
      src, name: file.name, start, duration: dur,
      ...(isVideo || isImage ? { fit: 'cover' } : {}),
    });

    if (!isImage) {
      const el = document.createElement(isVideo ? 'video' : 'audio');
      el.src = src;
      el.onloadedmetadata = () => {
        const clip = store.getState().tracks.find(t => t.id === trackId)?.clips.find(c => c.src === src);
        if (clip) store.updateClip(clip.id, { duration: el.duration }, true);
      };
    }
  }
  return list.length;
}

// Expand a DataTransfer that may contain directories (folder drop) into a flat
// file list. Uses the webkit entries API; falls back to plain files.
export async function filesFromDataTransfer(dt) {
  const items = dt.items ? [...dt.items] : [];
  const entries = items.map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
  if (!entries.length) return [...(dt.files || [])];

  const out = [];
  const walk = entry => new Promise(resolve => {
    if (entry.isFile) {
      entry.file(f => { out.push(f); resolve(); }, () => resolve());
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const readBatch = () => reader.readEntries(async batch => {
        if (!batch.length) return resolve();
        await Promise.all(batch.map(walk));
        readBatch(); // directories may return entries in multiple batches
      }, () => resolve());
      readBatch();
    } else resolve();
  });
  await Promise.all(entries.map(walk));
  return out;
}
