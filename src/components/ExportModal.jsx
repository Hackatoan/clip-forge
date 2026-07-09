import { useState } from 'react';
import { store } from '../store/editorStore';
import { useStore } from '../hooks/useStore';
import { exportTimeline } from '../engine/exporter';
import { isCrossOriginIsolated } from '../engine/ffmpeg';
import styles from './ExportModal.module.css';

const HEIGHTS = {
  '480p': 480, '720p': 720, '1080p': 1080,
  '1440p (2K)': 1440, '2160p (4K)': 2160, '4320p (8K)': 4320,
};

export default function ExportModal({ onClose }) {
  const { tracks, duration, canvasW, canvasH, aspect } = useStore(s => ({
    tracks: s.tracks, duration: s.duration, canvasW: s.canvasW, canvasH: s.canvasH, aspect: s.aspect,
  }));
  const [res, setRes] = useState('720p');
  const [fps, setFps] = useState(30);
  const [format, setFormat] = useState('webm');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');

  const totalClips = tracks.reduce((n, t) => n + t.clips.length, 0);
  const canMp4 = isCrossOriginIsolated();

  const run = async () => {
    setError('');
    setBusy(true);
    setProgress(0);
    // Pause any live playback so it doesn't fight the exporter.
    store.setPlaying(false);
    store.setPlayhead(0);
    try {
      // Derive dimensions from the project aspect ratio and the chosen height.
      const height = HEIGHTS[res];
      let width = Math.round(height * (canvasW / canvasH));
      if (width % 2) width += 1; // even dimensions for H.264
      const { blob, ext, warning } = await exportTimeline({
        tracks, duration, width, height, fps, format,
        onProgress: setProgress,
        onStage: setStage,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clip-forge-export.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      if (warning) setError(warning);
      else onClose();
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setBusy(false);
      setStage('');
    }
  };

  return (
    <div className={styles.backdrop} onClick={busy ? undefined : onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span>⬇ Export Video</span>
          {!busy && <button className={styles.close} onClick={onClose}>✕</button>}
        </div>

        {busy ? (
          <div className={styles.progressWrap}>
            <div className={styles.stage}>{stage}</div>
            <div className={styles.bar}><div className={styles.fill} style={{ width: `${progress}%` }} /></div>
            <div className={styles.pct}>{progress}%</div>
            <p className={styles.note}>
              Export renders in real time — a {Math.ceil(duration)}s timeline takes about {Math.ceil(duration)}s.
              Keep this tab focused.
            </p>
          </div>
        ) : (
          <div className={styles.body}>
            <div className={styles.summary}>
              {totalClips} clip{totalClips !== 1 ? 's' : ''} · {Math.ceil(duration)}s · {aspect} ({Math.round(HEIGHTS[res] * (canvasW / canvasH))}×{HEIGHTS[res]})
            </div>

            <label className={styles.field}>
              <span>Resolution</span>
              <select value={res} onChange={e => setRes(e.target.value)}>
                {Object.keys(HEIGHTS).map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>

            <label className={styles.field}>
              <span>Frame rate</span>
              <select value={fps} onChange={e => setFps(+e.target.value)}>
                <option value={24}>24 fps</option>
                <option value={30}>30 fps</option>
                <option value={60}>60 fps</option>
              </select>
            </label>

            <label className={styles.field}>
              <span>Format</span>
              <select value={format} onChange={e => setFormat(e.target.value)}>
                <option value="webm">WebM (fast, native)</option>
                <option value="mp4" disabled={!canMp4}>
                  MP4 (H.264){canMp4 ? '' : ' — needs cross-origin isolation'}
                </option>
              </select>
            </label>

            {error && <div className={styles.error}>{error}</div>}

            <button
              className={styles.exportBtn}
              disabled={totalClips === 0}
              onClick={run}
            >
              {totalClips === 0 ? 'Add a clip first' : 'Start Export'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
