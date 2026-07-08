import { useRef, useState, useCallback } from 'react';
import { useStore } from '../hooks/useStore';
import { store } from '../store/editorStore';
import styles from './Timeline.module.css';

const HEADER_W = 120;

export default function Timeline() {
  const { tracks, playhead, duration, zoom, selectedClipId } = useStore(s => s);
  const rulerRef = useRef(null);
  const [dragging, setDragging] = useState(null); // {clipId, mode, startX, orig...}

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
  const snap = (t, excludeId) => {
    const threshold = 8 / zoom; // ~8px
    let best = t, bestD = threshold;
    for (const p of snapPoints(excludeId)) {
      const d = Math.abs(p - t);
      if (d < bestD) { best = p; bestD = d; }
    }
    return best;
  };

  // Ruler click → set playhead
  const onRulerClick = e => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    store.setPlayhead(toT(x));
  };

  // Clip interactions
  const onClipMouseDown = (e, clip, mode = 'move') => {
    e.stopPropagation();
    if (clip.locked) return;
    store.select(null, clip.id);
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
    const dx = toT(e.clientX - dragging.startX);
    const { clipId, mode, origStart, origDuration, origOffset } = dragging;
    if (mode === 'move') {
      const newStart = Math.max(0, snap(origStart + dx, clipId));
      store.updateClip(clipId, { start: newStart });
    } else if (mode === 'trim-left') {
      let newStart = Math.max(0, snap(origStart + dx, clipId));
      let delta = newStart - origStart;
      // Don't let duration go below 0.2s.
      if (origDuration - delta < 0.2) { delta = origDuration - 0.2; newStart = origStart + delta; }
      store.updateClip(clipId, {
        start: newStart,
        duration: origDuration - delta,
        offset: Math.max(0, origOffset + delta),
      });
    } else if (mode === 'trim-right') {
      const end = snap(origStart + origDuration + dx, clipId);
      const newDur = Math.max(0.2, end - origStart);
      store.updateClip(clipId, { duration: newDur });
    }
  }, [dragging, zoom, tracks, playhead]);

  const onMouseUp = () => setDragging(null);

  const trackColors = {
    video: '#ff4b3a', audio: '#f472b6', text: '#ff8a4a',
    shape: '#a78bfa', voiceover: '#34d399',
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
          {tracks.map(track => (
            <div key={track.id} className={styles.trackHeader}
              style={{ borderLeft: `3px solid ${trackColors[track.type] || '#888'}` }}>
              <span className={styles.trackName}>{track.name}</span>
              <div className={styles.trackControls}>
                <button className={`${styles.iconBtn} ${track.muted ? styles.muted : ''}`}
                  onClick={() => store.updateTrack(track.id, { muted: !track.muted })}
                  title="Mute">M</button>
                {(track.type === 'audio' || track.type === 'voiceover') && (
                  <input type="range" min="0" max="1" step="0.05" value={track.volume ?? 1}
                    onChange={e => store.updateTrack(track.id, { volume: +e.target.value })}
                    title="Volume" style={{ width: 50 }} />
                )}
                <button className={styles.iconBtn} onClick={() => store.removeTrack(track.id)} title="Delete">✕</button>
              </div>
            </div>
          ))}
        </div>

        {/* Scrollable canvas area */}
        <div className={styles.canvasArea}>
          {/* Ruler */}
          <div className={styles.ruler} ref={rulerRef}
            style={{ width: toX(duration) + 200 }}
            onClick={onRulerClick}>
            {Array.from({ length: Math.ceil(duration) + 1 }, (_, i) => (
              <div key={i} className={styles.tick} style={{ left: toX(i) }}>
                <span>{fmt(i)}</span>
              </div>
            ))}
          </div>

          {/* Playhead */}
          <div className={styles.playhead}
            style={{ left: HEADER_W + toX(playhead) }} />

          {/* Tracks */}
          {tracks.map(track => (
            <div key={track.id} className={styles.track}
              style={{ width: toX(duration) + 200, opacity: track.muted ? 0.4 : 1 }}>
              {track.clips.map(clip => (
                <div
                  key={clip.id}
                  className={`${styles.clip} ${clip.id === selectedClipId ? styles.selected : ''}`}
                  style={{
                    left: toX(clip.start),
                    width: Math.max(toX(clip.duration), 4),
                    background: trackColors[track.type] + '33',
                    borderColor: trackColors[track.type],
                  }}
                  onMouseDown={e => onClipMouseDown(e, clip, 'move')}
                  onDoubleClick={() => store.splitClip(clip.id, playhead)}
                  title="Drag to move · Edges to trim · Double-click to split at playhead"
                >
                  <div className={styles.trimHandle} data-side="l"
                    onMouseDown={e => onClipMouseDown(e, clip, 'trim-left')} />
                  <span className={styles.clipLabel}>{clip.name || clip.text || track.type}</span>
                  <div className={styles.trimHandle} data-side="r"
                    onMouseDown={e => onClipMouseDown(e, clip, 'trim-right')} />
                </div>
              ))}
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
