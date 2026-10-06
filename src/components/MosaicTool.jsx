import { useEffect, useState } from 'react';
import { store } from '../store/editorStore';
import { importFiles } from '../engine/importMedia';
import { captureSource, sampleStills, makeMosaic } from '../engine/mosaic';
import styles from './Panel.module.css';

const CONSENT_KEY = 'cf-mosaic-consent';
const readConsent = () => { try { return localStorage.getItem(CONSENT_KEY) === '1'; } catch { return false; } };

// Opt-in "turn the current frame into a photomosaic of your own clips" tool (Mosaic API).
export default function MosaicTool() {
  const [consent, setConsent] = useState(readConsent);
  const [cols, setCols] = useState(50);
  const [tileCount, setTileCount] = useState(40);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { blob, url }

  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  const toggleConsent = (v) => { setConsent(v); try { localStorage.setItem(CONSENT_KEY, v ? '1' : '0'); } catch { /* storage blocked */ } };

  const run = async () => {
    setBusy(true); setResult(null);
    try {
      const s = store.getState();
      setStatus('Capturing frame…');
      const source = await captureSource(s);
      const tiles = await sampleStills(s.tracks, tileCount, (d, t) => setStatus(`Sampling stills ${d}/${t}…`));
      setStatus('Uploading to Mosaic…');
      const blob = await makeMosaic({ source, tiles, cols });
      setResult({ blob, url: URL.createObjectURL(blob) });
      setStatus('');
    } catch (e) {
      setStatus('⚠ ' + (e.message || e));
    }
    setBusy(false);
  };

  const addToTimeline = () => importFiles([new File([result.blob], 'mosaic.png', { type: 'image/png' })], {});
  const download = () => { const a = document.createElement('a'); a.href = result.url; a.download = 'clip-forge-mosaic.png'; a.click(); };

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Mosaic</div>
      <div className={styles.hint}>
        Rebuilds the frame under the playhead out of tiny stills sampled from your own clips.
      </div>
      <label className={styles.hint} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
        <input type="checkbox" checked={consent} onChange={e => toggleConsent(e.target.checked)} />
        <span>I understand this sends the frame and sampled stills to mosaic.hackatoa.com to be processed. They are used in memory and not stored. Everything else in Clip Forge stays on your device.</span>
      </label>
      <div className={styles.grid2} style={{ margin: '6px 0' }}>
        <label className={styles.hint}>Columns {cols}
          <input type="range" min="20" max="100" value={cols} onChange={e => setCols(+e.target.value)} style={{ width: '100%' }} />
        </label>
        <label className={styles.hint}>Tiles {tileCount}
          <input type="range" min="10" max="80" value={tileCount} onChange={e => setTileCount(+e.target.value)} style={{ width: '100%' }} />
        </label>
      </div>
      <button className={styles.primaryBtn} disabled={!consent || busy} onClick={run}>
        {busy ? 'Working…' : '🧩 Make mosaic from this frame'}
      </button>
      {status && <div className={styles.hint} style={{ marginTop: 6 }}>{status}</div>}
      {result && (
        <div style={{ marginTop: 8 }}>
          <img src={result.url} alt="Generated mosaic" style={{ width: '100%', borderRadius: 4 }} />
          <div className={styles.btnRow} style={{ marginTop: 6 }}>
            <button className={styles.secondaryBtn} onClick={addToTimeline}>➕ Add to timeline</button>
            <button className={styles.secondaryBtn} onClick={download}>⬇ Download</button>
          </div>
        </div>
      )}
    </div>
  );
}
