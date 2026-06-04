// Central state store using vanilla JS + event emitter (no Redux needed)
import { v4 as uuidv4 } from 'uuid';

const TRACK_TYPES = { VIDEO: 'video', AUDIO: 'audio', TEXT: 'text', SHAPE: 'shape', VOICEOVER: 'voiceover' };

function createStore() {
  let state = {
    tracks: [],          // [{id, type, name, clips:[{id,src,start,duration,offset,volume,muted,locked,...}]}]
    playhead: 0,         // seconds
    duration: 60,        // total timeline seconds
    playing: false,
    zoom: 60,            // pixels per second
    selectedClipId: null,
    selectedTrackId: null,
    ffmpegReady: false,
    exportProgress: null,
  };

  const listeners = new Set();

  function notify() { listeners.forEach(fn => fn(state)); }

  function setState(patch) {
    state = { ...state, ...patch };
    notify();
  }

  return {
    getState: () => state,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },

    // Tracks
    addTrack(type) {
      const id = uuidv4();
      const names = { video:'Video', audio:'Audio', text:'Text', shape:'Shape', voiceover:'Voiceover' };
      const newTrack = { id, type, name: `${names[type]} ${state.tracks.filter(t=>t.type===type).length+1}`, clips: [], volume: 1, muted: false };
      setState({ tracks: [...state.tracks, newTrack] });
      return id;
    },

    removeTrack(trackId) {
      setState({ tracks: state.tracks.filter(t => t.id !== trackId), selectedTrackId: null, selectedClipId: null });
    },

    updateTrack(trackId, patch) {
      setState({ tracks: state.tracks.map(t => t.id === trackId ? { ...t, ...patch } : t) });
    },

    // Clips
    addClip(trackId, clipData) {
      const id = uuidv4();
      const clip = { id, start: 0, duration: 5, offset: 0, volume: 1, muted: false, locked: false, ...clipData };
      setState({
        tracks: state.tracks.map(t => t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t),
        selectedClipId: id,
        selectedTrackId: trackId,
      });
      return id;
    },

    updateClip(clipId, patch) {
      setState({
        tracks: state.tracks.map(t => ({
          ...t,
          clips: t.clips.map(c => c.id === clipId ? { ...c, ...patch } : c)
        }))
      });
    },

    removeClip(clipId) {
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
        const left  = { ...clip, duration: localTime };
        const right = { ...clip, id: uuidv4(), start: clip.start + localTime, duration: clip.duration - localTime, offset: clip.offset + localTime };
        return { ...track, clips: [...track.clips.filter(c => c.id !== clipId), left, right] };
      });
      setState({ tracks: newTracks });
    },

    // Playback
    setPlayhead(t) { setState({ playhead: Math.max(0, Math.min(t, state.duration)) }); },
    setPlaying(v) { setState({ playing: v }); },
    setZoom(z) { setState({ zoom: Math.max(20, Math.min(300, z)) }); },
    setDuration(d) { setState({ duration: d }); },
    select(trackId, clipId) { setState({ selectedTrackId: trackId, selectedClipId: clipId }); },
    setFFmpegReady(v) { setState({ ffmpegReady: v }); },
    setExportProgress(v) { setState({ exportProgress: v }); },

    TRACK_TYPES,
  };
}

export const store = createStore();
