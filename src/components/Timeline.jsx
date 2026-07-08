import { useRef, useState, useCallback, useEffect } from 'react';
import { useStore } from '../hooks/useStore';
import { store } from '../store/editorStore';
import { ensureWaveform, ensurePoster } from '../engine/mediaThumbs';
import styles from './Timeline.module.css';

export default function Timeline() {
  const { tracks, playhead, duration, zoom, selectedClipId, snap: snapOn } = useStore(s => s);
  const rulerRef = useRef(null);
  const areaRef = useRef(null);
  const [dragging, setDragging] = useState(null); // {clipId, mode, startX, orig...}

  // Generate waveforms (audio) and poster thumbnails (video/image) once each.
  useEffect(() => {
    for (const track of tracks) {
      const isAudio = track.type === 'audio' || track.type === 'voiceover';
      const isVisual = track.type === 'video' || track.type === 'image';
      for (const clip of track.clips) {
        if (!clip.src) continue;
        if (isAudio && !clip.wave) {
          ensureWaveform(clip.src).then(url => url && store.updateClip(clip.id, { wave: url }, true));
        } else if (isVisual && !clip.thumb) {
          ensurePoster(clip.src, track.type === 'video').then(url => url && store.updateClip(clip.id, { thumb: url }, true));
        }
      }
    }
  }, [tracks]);

  const toX = t => t * zoom;
  const toT = x => x / zoom;

  // Collect snap targets (other clip edges + playhead + 0).
  const snapPoints = (excludeId) => {
    const pts = [0, playhead];
    for (const tr of tracks) for (const c of tr.clips) {
      if (c.id === excludeId) continue;
      pts.push(c.start, c.start + c.duration);
    }
    return pts;
  };
  // Snap `t` to nearby edges unless snapping is off or Alt is held.
  const snap = (t, excludeId, bypass) => {
    if (!snapOn || bypass) return t;
    const threshold = 8 / zoom; // ~8px
    let best = t, bestD = threshold;
    for (const p of snapPoints(excludeId)) {
      const d = Math.abs(p - t);
      if (d < bestD) { best = p; bestD = d; }
    }
    return best;
  };

  const rulerT = clientX => {
    const rect = rulerRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(duration, toT(clientX - rect.left)));
  };

  // Scrub: mousedown on ruler / playhead → drag to move the playhead.
  const onScrubStart = e => {
    e.preventDefault();
    store.setPlaying(false);
    store.setPlayhead(rulerT(e.clientX));
    setDragging({ mode: 'scrub' });
  };

  // Zoom so the whole timeline fits the visible area.
  const zoomToFit = () => {
    const w = areaRef.current?.clientWidth || 600;
    store.setZoom((w - 40) / Math.max(1, duration));
  };

  // Clip interactions
  const onClipMouseDown = (e, clip, trackId, mode = 'move') => {
    e.stopPropagation();
    store.select(trackId, clip.id);
    if (clip.locked) return;
    setDragging({
      clipId: clip.id, mode,
      startX: e.clientX,
      origStart: clip.start,
      origDuration: clip.duration,
      origOffset: clip.offset || 0,
    });
  };

  const onMouseMove = useCallback(e => {
    if (!dragging) return;
    if (dragging.mode === 'scrub') { store.setPlayhead(rulerT(e.clientX)); return; }
    const dx = toT(e.clientX - dragging.startX);
    const { clipId, mode, origStart, origDuration, origOffset } = dragging;
    const bypass = e.altKey;
    if (mode === 'move') {
      const newStart = Math.max(0, snap(origStart + dx, clipId, bypass));
      store.updateClip(clipId, { start: newStart });
    } else if (mode === 'trim-left') {
      let newStart = Math.max(0, snap(origStart + dx, clipId, bypass));
      let delta = newStart - origStart;
      // Don't let duration go below 0.2s.
      if (origDuration - delta < 0.2) { delta = origDuration - 0.2; newStart = origStart + delta; }
      store.updateClip(clipId, {
        start: newStart,
        duration: origDuration - delta,
        offset: Math.max(0, origOffset + delta),
      });
    } else if (mode === 'trim-right') {
      const end = snap(origStart + origDuration + dx, clipId, bypass);
      const newDur = Math.max(0.2, end - origStart);
      store.updateClip(clipId, { duration: newDur });
    }
  }, [dragging, zoom, tracks, playhead, snapOn, duration]);

  const onMouseUp = () => setDragging(null);

  const trackColors = {
    video: '#ff4b3a', audio: '#f472b6', text: '#ff8a4a',
    shape: '#a78bfa', voiceover: '#34d399', image: '#38bdf8',
  };

  const addTrack = (type) => store.addTrack(type);

  return (
    <div className={styles.timeline} onMouseMove={onMouseMove} onMouseUp={onMouseUp}>
      {/* Add track row */}
      <div className={styles.addRow}>
        <span className={styles.addLabel}>Add track:</span>
        {['video','audio','text','shape','voiceover'].map(t => (
          <button key={t} className={styles.addBtn} onClick={() => addTrack(t)}
            style={{ borderColor: trackColors[t], color: trackColors[t] }}>
            + {t}
          </button>
        ))}
        <button className={`${styles.addBtn} ${snapOn ? styles.snapOn : ''}`}
          onClick={() => store.setSnap(!snapOn)} title="Toggle snapping (hold Alt to bypass)"
          style={{ marginLeft: 'auto' }}>🧲 Snap</button>
        <button className={styles.addBtn} onClick={zoomToFit} title="Zoom to fit">⤢ Fit</button>
        <div className={styles.zoom}>
          <span>Zoom</span>
          <input type="range" min="20" max="300" value={zoom}
            onChange={e => store.setZoom(+e.target.value)} style={{width:80}} />
        </div>
      </div>

      <div className={styles.body}>
        {/* Headers */}
        <div className={styles.headers}>
          <div className={styles.rulerSpacer} />
          {tracks.map((track, ti) => (
            <div key={track.id} className={styles.trackHeader}
              style={{ borderLeft: `3px solid ${trackColors[track.type] || '#888'}` }}>
              <span className={styles.trackName}>{track.name}</span>
              <div className={styles.trackControls}>
                <button className={styles.iconBtn} disabled={ti === 0}
                  onClick={() => store.moveTrack(track.id, -1)} title="Move up">▲</button>
                <button className={styles.iconBtn} disabled={ti === tracks.length - 1}
                  onClick={() => store.moveTrack(track.id, 1)} title="Move down">▼</button>
                <button className={`${styles.iconBtn} ${track.muted ? styles.muted : ''}`}
                  onClick={() => store.updateTrack(track.id, { muted: !track.muted })}
                  title="Mute">M</button>
                {(track.type === 'audio' || track.type === 'voiceover') && (
                  <input type="range" min="0" max="1" step="0.05" value={track.volume ?? 1}
                    onChange={e => store.updateTrack(track.id, { volume: +e.target.value })}
                    title="Volume" style={{ width: 40 }} />
                )}
                <button className={styles.iconBtn} onClick={() => store.removeTrack(track.id)} title="Delete">✕</button>
              </div>
            </div>
          ))}
        </div>

        {/* Scrollable canvas area */}
        <div className={styles.canvasArea} ref={areaRef}>
          {/* Ruler */}
          <div className={styles.ruler} ref={rulerRef}
            style={{ width: toX(duration) + 200 }}
            onMouseDown={onScrubStart}>
            {Array.from({ length: Math.ceil(duration) + 1 }, (_, i) => (
              <div key={i} className={styles.tick} style={{ left: toX(i) }}>
                <span>{fmt(i)}</span>
              </div>
            ))}
          </div>

          {/* Playhead (offset parent is canvasArea → no header offset) */}
          <div className={styles.playhead} style={{ left: toX(playhead) }}>
            <div className={styles.playheadHandle} onMouseDown={onScrubStart} />
          </div>

          {/* Tracks */}
          {tracks.map(track => (
            <div key={track.id} className={styles.track}
              onMouseDown={() => store.select(null, null)}
              style={{ width: toX(duration) + 200, opacity: track.muted ? 0.4 : 1 }}>
              {track.clips.map(clip => {
                const visual = clip.thumb
                  ? { backgroundImage: `url(${clip.thumb})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                  : clip.wave
                    ? { backgroundImage: `url(${clip.wave})`, backgroundSize: '100% 80%', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', backgroundColor: trackColors[track.type] + '33' }
                    : { background: trackColors[track.type] + '33' };
                return (
                <div
                  key={clip.id}
                  className={`${styles.clip} ${clip.id === selectedClipId ? styles.selected : ''}`}
                  style={{
                    left: toX(clip.start),
                    width: Math.max(toX(clip.duration), 4),
                    ...visual,
                    borderColor: trackColors[track.type],
                  }}
                  onMouseDown={e => onClipMouseDown(e, clip, track.id, 'move')}
                  onDoubleClick={() => store.splitClip(clip.id, playhead)}
                  title="Drag to move · Edges to trim · Double-click to split at playhead"
                >
                  <div className={styles.trimHandle} data-side="l"
                    onMouseDown={e => onClipMouseDown(e, clip, track.id, 'trim-left')} />
                  <span className={styles.clipLabel}>{clip.name || clip.text || track.type}</span>
                  {clip.keyframes && Object.values(clip.keyframes).flat().map((k, i) => (
                    <div key={i} className={styles.kfMark} style={{ left: toX(k.t) }} />
                  ))}
                  <div className={styles.trimHandle} data-side="r"
                    onMouseDown={e => onClipMouseDown(e, clip, track.id, 'trim-right')} />
                </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function fmt(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2,'0')}`;
}
