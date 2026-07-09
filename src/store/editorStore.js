// Central state store using vanilla JS + event emitter (no Redux needed)
import { v4 as uuidv4 } from 'uuid';

const TRACK_TYPES = { VIDEO: 'video', AUDIO: 'audio', TEXT: 'text', SHAPE: 'shape', VOICEOVER: 'voiceover', IMAGE: 'image' };

const ASPECTS = {
  '16:9': { w: 1280, h: 720 },
  '9:16': { w: 720,  h: 1280 },
  '1:1':  { w: 1080, h: 1080 },
  '4:3':  { w: 960,  h: 720 },
  '21:9': { w: 1280, h: 548 },
};

function createStore() {
  let state = {
    tracks: [],          // [{id, type, name, clips:[{id,src,start,duration,offset,volume,muted,locked,...}]}]
    playhead: 0,         // seconds
    duration: 60,        // total timeline seconds
    playing: false,
    loop: false,
    snap: true,          // edge snapping while dragging clips
    zoom: 60,            // pixels per second
    selectedClipId: null,      // primary selection (shown in Properties)
    selectedClipIds: [],       // full multi-selection
    selectedTrackId: null,
    ffmpegReady: false,
    exportProgress: null,
    canvasW: 1280,
    canvasH: 720,
    aspect: '16:9',
    clipboard: null,     // a copied clip payload
    canUndo: false,
    canRedo: false,
  };

  const listeners = new Set();

  // --- Undo / redo history (snapshots of tracks) ---
  const past = [];
  const future = [];
  let lastSnap = 0;

  function snapshot(force = false) {
    const now = Date.now();
    if (!force && now - lastSnap < 500) return; // coalesce rapid edits (slider drags)
    lastSnap = now;
    past.push(structuredClone(state.tracks));
    if (past.length > 60) past.shift();
    future.length = 0;
    state.canUndo = past.length > 0;
    state.canRedo = false;
  }

  function notify() { listeners.forEach(fn => fn(state)); }

  // Timeline auto-grows to fit the furthest clip end (min 10s, +2s padding).
  function contentEnd(tracks) {
    let end = 0;
    for (const t of tracks) for (const c of t.clips) end = Math.max(end, c.start + c.duration);
    return end;
  }

  function setState(patch) {
    state = { ...state, ...patch };
    // Keep the multi-selection in sync when only the primary is set.
    if ('selectedClipId' in patch && !('selectedClipIds' in patch)) {
      state.selectedClipIds = patch.selectedClipId ? [patch.selectedClipId] : [];
    }
    if (patch.tracks) {
      const needed = Math.max(10, Math.ceil(contentEnd(patch.tracks)) + 2);
      if (needed !== state.duration) state.duration = needed;
    }
    notify();
  }

  const api = {
    getState: () => state,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },

    snapshot,

    undo() {
      if (!past.length) return;
      future.push(structuredClone(state.tracks));
      const tracks = past.pop();
      state.canUndo = past.length > 0;
      state.canRedo = true;
      setState({ tracks, selectedClipId: null });
    },
    redo() {
      if (!future.length) return;
      past.push(structuredClone(state.tracks));
      const tracks = future.pop();
      state.canUndo = true;
      state.canRedo = future.length > 0;
      setState({ tracks, selectedClipId: null });
    },

    // Tracks
    addTrack(type) {
      snapshot(true);
      const id = uuidv4();
      const names = { video: 'Video', audio: 'Audio', text: 'Text', shape: 'Shape', voiceover: 'Voiceover', image: 'Image' };
      const newTrack = { id, type, name: `${names[type]} ${state.tracks.filter(t => t.type === type).length + 1}`, clips: [], volume: 1, muted: false };
      setState({ tracks: [...state.tracks, newTrack] });
      return id;
    },

    removeTrack(trackId) {
      snapshot(true);
      setState({ tracks: state.tracks.filter(t => t.id !== trackId), selectedTrackId: null, selectedClipId: null });
    },

    updateTrack(trackId, patch, skipHistory) {
      if (!skipHistory) snapshot();
      setState({ tracks: state.tracks.map(t => t.id === trackId ? { ...t, ...patch } : t) });
    },

    // Reorder a track up (dir -1) or down (dir +1). Later tracks render on top.
    moveTrack(trackId, dir) {
      const i = state.tracks.findIndex(t => t.id === trackId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= state.tracks.length) return;
      snapshot(true);
      const arr = [...state.tracks];
      [arr[i], arr[j]] = [arr[j], arr[i]];
      setState({ tracks: arr });
    },

    // Clips
    addClip(trackId, clipData) {
      snapshot(true);
      const id = uuidv4();
      const clip = { id, start: 0, duration: 5, offset: 0, volume: 1, muted: false, locked: false, ...clipData };
      setState({
        tracks: state.tracks.map(t => t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t),
        selectedClipId: id,
        selectedTrackId: trackId,
      });
      return id;
    },

    updateClip(clipId, patch, skipHistory) {
      if (!skipHistory) snapshot();
      setState({
        tracks: state.tracks.map(t => ({
          ...t,
          clips: t.clips.map(c => c.id === clipId ? { ...c, ...patch } : c)
        }))
      });
    },

    removeClip(clipId) {
      snapshot(true);
      setState({
        tracks: state.tracks.map(t => ({ ...t, clips: t.clips.filter(c => c.id !== clipId) })),
        selectedClipId: null,
      });
    },

    splitClip(clipId, atTime) {
      let splitDone = false;
      const newTracks = state.tracks.map(track => {
        const clip = track.clips.find(c => c.id === clipId);
        if (!clip || splitDone) return track;
        const localTime = atTime - clip.start;
        if (localTime <= 0 || localTime >= clip.duration) return track;
        splitDone = true;
        const speed = clip.speed || 1;
        const left = { ...clip, duration: localTime };
        const right = { ...clip, id: uuidv4(), start: clip.start + localTime, duration: clip.duration - localTime, offset: (clip.offset || 0) + localTime * speed };
        return { ...track, clips: [...track.clips.filter(c => c.id !== clipId), left, right] };
      });
      if (splitDone) { snapshot(true); setState({ tracks: newTracks }); }
    },

    // Clipboard
    copyClip(clipId) {
      for (const t of state.tracks) {
        const c = t.clips.find(x => x.id === clipId);
        if (c) { setState({ clipboard: { clip: structuredClone(c), trackType: t.type } }); return; }
      }
    },

    pasteClip() {
      const cb = state.clipboard;
      if (!cb) return;
      snapshot(true);
      // Paste onto a track of the same type (first match) or a new one.
      let track = state.tracks.find(t => t.type === cb.trackType);
      let tracks = state.tracks;
      if (!track) {
        const id = uuidv4();
        const names = { video: 'Video', audio: 'Audio', text: 'Text', shape: 'Shape', voiceover: 'Voiceover', image: 'Image' };
        track = { id, type: cb.trackType, name: `${names[cb.trackType]} ${tracks.filter(t => t.type === cb.trackType).length + 1}`, clips: [], volume: 1, muted: false };
        tracks = [...tracks, track];
      }
      const newId = uuidv4();
      const newClip = { ...structuredClone(cb.clip), id: newId, start: state.playhead };
      setState({
        tracks: tracks.map(t => t.id === track.id ? { ...t, clips: [...t.clips, newClip] } : t),
        selectedClipId: newId,
        selectedTrackId: track.id,
      });
    },

    // Keyframes ----------------------------------------------------------
    // Add/replace a keyframe for `prop` at clip-local time `t` with value `v`.
    addKeyframe(clipId, prop, t, v) {
      snapshot(true);
      setState({
        tracks: state.tracks.map(track => ({
          ...track,
          clips: track.clips.map(c => {
            if (c.id !== clipId) return c;
            const kf = { ...(c.keyframes || {}) };
            const arr = (kf[prop] || []).filter(k => Math.abs(k.t - t) > 0.001);
            arr.push({ t, v, ease: 'in-out' });
            arr.sort((a, b) => a.t - b.t);
            kf[prop] = arr;
            return { ...c, keyframes: kf };
          }),
        })),
      });
    },

    removeKeyframe(clipId, prop, t) {
      snapshot(true);
      setState({
        tracks: state.tracks.map(track => ({
          ...track,
          clips: track.clips.map(c => {
            if (c.id !== clipId || !c.keyframes?.[prop]) return c;
            const kf = { ...c.keyframes };
            kf[prop] = kf[prop].filter(k => Math.abs(k.t - t) > 0.001);
            if (!kf[prop].length) delete kf[prop];
            return { ...c, keyframes: kf };
          }),
        })),
      });
    },

    clearKeyframes(clipId, prop) {
      snapshot(true);
      setState({
        tracks: state.tracks.map(track => ({
          ...track,
          clips: track.clips.map(c => {
            if (c.id !== clipId || !c.keyframes?.[prop]) return c;
            const kf = { ...c.keyframes };
            delete kf[prop];
            return { ...c, keyframes: kf };
          }),
        })),
      });
    },

    duplicateClip(clipId) {
      snapshot(true);
      const newId = uuidv4();
      let selTrack = null;
      const tracks = state.tracks.map(t => {
        const c = t.clips.find(x => x.id === clipId);
        if (!c) return t;
        selTrack = t.id;
        const dup = { ...structuredClone(c), id: newId, start: c.start + c.duration };
        return { ...t, clips: [...t.clips, dup] };
      });
      if (selTrack) setState({ tracks, selectedClipId: newId, selectedTrackId: selTrack });
    },

    // Cross-clip crossfade: overlap this clip with the previous clip on the
    // same track by `dur` seconds and fade it in, dissolving between the two.
    crossfadePrev(clipId, dur = 0.5) {
      let changed = false;
      const tracks = state.tracks.map(track => {
        const clip = track.clips.find(c => c.id === clipId);
        if (!clip) return track;
        let prev = null;
        for (const c of track.clips) {
          if (c.id === clipId || c.start >= clip.start) continue;
          if (!prev || c.start > prev.start) prev = c;
        }
        if (!prev) return track;
        const d = Math.min(dur, prev.duration * 0.9, clip.duration * 0.9);
        const newStart = Math.max(prev.start + 0.05, prev.start + prev.duration - d);
        changed = true;
        return {
          ...track,
          clips: track.clips.map(c => c.id === clipId
            ? { ...c, start: newStart, transitionIn: 'fade', transInDur: d }
            : c),
        };
      });
      if (changed) { snapshot(true); setState({ tracks }); }
    },

    // Playback / view
    setPlayhead(t) { setState({ playhead: Math.max(0, Math.min(t, state.duration)) }); },
    setPlaying(v) { setState({ playing: v }); },
    setLoop(v) { setState({ loop: v }); },
    setSnap(v) { setState({ snap: v }); },
    setZoom(z) { setState({ zoom: Math.max(20, Math.min(300, z)) }); },
    setDuration(d) { setState({ duration: d }); },
    setAspect(key) {
      const a = ASPECTS[key]; if (!a) return;
      setState({ aspect: key, canvasW: a.w, canvasH: a.h });
    },

    // Replace the whole project (from a loaded .clipforge file). Clears history.
    loadProject(proj) {
      past.length = 0; future.length = 0;
      state.canUndo = false; state.canRedo = false;
      setState({
        tracks: proj.tracks || [],
        aspect: proj.aspect || '16:9',
        canvasW: proj.canvasW || 1280,
        canvasH: proj.canvasH || 720,
        playhead: 0,
        playing: false,
        selectedClipId: null,
        selectedTrackId: null,
      });
    },
    select(trackId, clipId) {
      setState({ selectedTrackId: trackId, selectedClipId: clipId, selectedClipIds: clipId ? [clipId] : [] });
    },
    // Set the primary (Properties-shown) clip without collapsing a multi-selection.
    setPrimary(trackId, clipId) { setState({ selectedTrackId: trackId, selectedClipId: clipId, selectedClipIds: state.selectedClipIds }); },
    selectAll() {
      const ids = [];
      for (const t of state.tracks) for (const c of t.clips) ids.push(c.id);
      setState({ selectedClipIds: ids, selectedClipId: ids[ids.length - 1] ?? null });
    },
    // Shift/Ctrl-click: add/remove a clip from the multi-selection.
    toggleSelect(trackId, clipId) {
      const set = new Set(state.selectedClipIds);
      if (set.has(clipId)) set.delete(clipId); else set.add(clipId);
      const ids = [...set];
      setState({ selectedClipIds: ids, selectedClipId: ids[ids.length - 1] ?? null, selectedTrackId: trackId });
    },
    removeSelected() {
      const ids = state.selectedClipIds.length ? state.selectedClipIds : (state.selectedClipId ? [state.selectedClipId] : []);
      if (!ids.length) return;
      snapshot(true);
      const idset = new Set(ids);
      setState({
        tracks: state.tracks.map(t => ({ ...t, clips: t.clips.filter(c => !idset.has(c.id)) })),
        selectedClipId: null, selectedClipIds: [],
      });
    },
    duplicateSelected() {
      const ids = state.selectedClipIds.length ? state.selectedClipIds : (state.selectedClipId ? [state.selectedClipId] : []);
      if (!ids.length) return;
      snapshot(true);
      const idset = new Set(ids);
      const newIds = [];
      const tracks = state.tracks.map(t => {
        const dups = t.clips.filter(c => idset.has(c.id)).map(c => {
          const nid = uuidv4(); newIds.push(nid);
          return { ...structuredClone(c), id: nid, start: c.start + c.duration };
        });
        return dups.length ? { ...t, clips: [...t.clips, ...dups] } : t;
      });
      setState({ tracks, selectedClipIds: newIds, selectedClipId: newIds[newIds.length - 1] ?? null });
    },
    setFFmpegReady(v) { setState({ ffmpegReady: v }); },
    setExportProgress(v) { setState({ exportProgress: v }); },

    TRACK_TYPES,
    ASPECTS,
  };

  return api;
}

export const store = createStore();
