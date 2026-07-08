import { sample as sampleKf } from './keyframes';

// Shared media + audio engine.
// Manages one HTMLMediaElement per media clip (video/audio/voiceover),
// routes all audio through a Web Audio graph so we get real preview sound
// AND a recordable audio stream for export. Both Preview and the Exporter
// use this single engine so playback and rendering stay in sync.

class MediaEngine {
  constructor() {
    this.ctx = null;                 // AudioContext (created on first user gesture)
    this.recordDest = null;          // MediaStreamAudioDestinationNode (for export)
    this.entries = new Map();        // clipId -> { el, source, gain, ready }
    this.images = new Map();         // clipId -> HTMLImageElement
    this.playing = false;
  }

  ensureContext() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.recordDest = this.ctx.createMediaStreamDestination();
      // Keep-alive silent source: without a continuously-emitting source, the
      // record destination's audio track stalls the MediaRecorder muxer during
      // silent gaps (produces a 0-byte file). A zero-gain ConstantSource keeps
      // samples flowing at all times.
      const silent = this.ctx.createConstantSource();
      const g = this.ctx.createGain();
      g.gain.value = 0;
      silent.connect(g);
      g.connect(this.recordDest);
      silent.start();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  // Create/destroy media elements to match the current clip list.
  sync(tracks) {
    // Images (no audio) are handled separately.
    const wantImg = new Map();
    for (const track of tracks) {
      if (track.type !== 'image') continue;
      for (const clip of track.clips) if (clip.src) wantImg.set(clip.id, clip);
    }
    for (const id of [...this.images.keys()]) if (!wantImg.has(id)) this.images.delete(id);
    for (const [id, clip] of wantImg) {
      if (this.images.has(id)) continue;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = clip.src;
      this.images.set(id, img);
    }

    const wanted = new Map(); // clipId -> {clip, track}
    for (const track of tracks) {
      if (!['video', 'audio', 'voiceover'].includes(track.type)) continue;
      for (const clip of track.clips) {
        if (clip.src) wanted.set(clip.id, { clip, track });
      }
    }

    // Remove entries no longer present.
    for (const [id, entry] of this.entries) {
      if (!wanted.has(id)) {
        try { entry.el.pause(); } catch { /* noop */ }
        try { entry.source && entry.source.disconnect(); } catch { /* noop */ }
        try { entry.gain && entry.gain.disconnect(); } catch { /* noop */ }
        this.entries.delete(id);
      }
    }

    // Add new entries.
    for (const [id, { clip, track }] of wanted) {
      if (this.entries.has(id)) continue;
      const el = document.createElement(track.type === 'video' ? 'video' : 'audio');
      el.src = clip.src;
      el.preload = 'auto';
      el.crossOrigin = 'anonymous';
      // Do NOT set el.muted — audio flows through the Web Audio graph instead.
      const entry = { el, source: null, gain: null, ready: false };
      el.addEventListener('loadedmetadata', () => { entry.ready = true; });
      this.entries.set(id, entry);
    }
  }

  // Lazily wire an element into the audio graph (must happen after a gesture).
  _wire(entry) {
    if (entry.source || !this.ctx) return;
    try {
      entry.source = this.ctx.createMediaElementSource(entry.el);
      entry.gain = this.ctx.createGain();
      entry.source.connect(entry.gain);
      entry.gain.connect(this.ctx.destination);
      if (this.recordDest) entry.gain.connect(this.recordDest);
    } catch {
      // createMediaElementSource throws if called twice; ignore.
    }
  }

  _effectiveGain(clip, track, playhead) {
    if (track.muted || clip.muted) return 0;
    const tClipRaw = playhead - clip.start;
    const cv = sampleKf(clip, 'volume', tClipRaw, clip.volume ?? 1);
    const tv = track.volume ?? 1;
    let g = cv * tv;
    // Audio fade in/out envelope.
    const tClip = playhead - clip.start;
    if (clip.fadeIn && tClip < clip.fadeIn) g *= Math.max(0, tClip / clip.fadeIn);
    if (clip.fadeOut && tClip > clip.duration - clip.fadeOut) g *= Math.max(0, (clip.duration - tClip) / clip.fadeOut);
    return Math.max(0, Math.min(1, g));
  }

  // Source time within a clip, accounting for playback speed.
  _localTime(clip, playhead) {
    const speed = clip.speed || 1;
    return (playhead - clip.start) * speed + (clip.offset || 0);
  }

  // Update gains + seek every element to match playhead. Used when paused/scrubbing.
  seek(playhead, tracks) {
    for (const track of tracks) {
      for (const clip of track.clips) {
        const entry = this.entries.get(clip.id);
        if (!entry) continue;
        const active = playhead >= clip.start && playhead <= clip.start + clip.duration;
        const localTime = this._localTime(clip, playhead);
        if (entry.gain) entry.gain.gain.value = this._effectiveGain(clip, track, playhead);
        entry.el.playbackRate = clip.speed || 1;
        if (active) {
          if (entry.ready && Number.isFinite(localTime)) {
            try { entry.el.currentTime = Math.max(0, localTime); } catch { /* noop */ }
          }
        }
        if (!this.playing) { try { entry.el.pause(); } catch { /* noop */ } }
      }
    }
  }

  // Start real-time playback from `playhead`.
  play(playhead, tracks) {
    this.ensureContext();
    this.playing = true;
    for (const track of tracks) {
      for (const clip of track.clips) {
        const entry = this.entries.get(clip.id);
        if (!entry) continue;
        this._wire(entry);
        if (entry.gain) entry.gain.gain.value = this._effectiveGain(clip, track, playhead);
        entry.el.playbackRate = clip.speed || 1;
        const active = playhead >= clip.start && playhead <= clip.start + clip.duration;
        const localTime = this._localTime(clip, playhead);
        if (active && entry.ready) {
          try {
            entry.el.currentTime = Math.max(0, localTime);
            const p = entry.el.play();
            if (p && p.catch) p.catch(() => {});
          } catch { /* noop */ }
        }
      }
    }
  }

  pause() {
    this.playing = false;
    for (const entry of this.entries.values()) {
      try { entry.el.pause(); } catch { /* noop */ }
    }
  }

  // Called each animation frame during playback: start/stop elements as clips
  // enter/leave the playhead window and keep drift in check.
  tick(playhead, tracks) {
    if (!this.playing) return;
    for (const track of tracks) {
      for (const clip of track.clips) {
        const entry = this.entries.get(clip.id);
        if (!entry || !entry.ready) continue;
        const active = playhead >= clip.start && playhead <= clip.start + clip.duration;
        const localTime = this._localTime(clip, playhead);
        if (entry.gain) entry.gain.gain.value = this._effectiveGain(clip, track, playhead);
        entry.el.playbackRate = clip.speed || 1;
        if (active) {
          if (entry.el.paused) {
            try { entry.el.currentTime = Math.max(0, localTime); } catch { /* noop */ }
            const p = entry.el.play();
            if (p && p.catch) p.catch(() => {});
          } else if (Math.abs(entry.el.currentTime - localTime) > 0.3) {
            // Correct drift.
            try { entry.el.currentTime = Math.max(0, localTime); } catch { /* noop */ }
          }
        } else if (!entry.el.paused) {
          try { entry.el.pause(); } catch { /* noop */ }
        }
      }
    }
  }

  getVideoElement(clipId) {
    const entry = this.entries.get(clipId);
    return entry ? entry.el : null;
  }

  getImageElement(clipId) {
    return this.images.get(clipId) || null;
  }

  // Audio stream for export (mix of all tracks).
  getAudioStream() {
    this.ensureContext();
    return this.recordDest.stream;
  }

  // Ensure every media element is wired into the graph (used before export).
  wireAll() {
    this.ensureContext();
    for (const entry of this.entries.values()) this._wire(entry);
  }
}

export const mediaEngine = new MediaEngine();
