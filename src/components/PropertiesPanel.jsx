import { useStore } from '../hooks/useStore';
import { store } from '../store/editorStore';
import styles from './Panel.module.css';

const TRANSITIONS = ['none','fade','slide-left','slide-right','zoom-in','zoom-out','wipe'];

export default function PropertiesPanel() {
  const { tracks, selectedClipId, selectedTrackId } = useStore(s => s);

  const track = tracks.find(t => t.id === selectedTrackId);
  const clip  = track?.clips.find(c => c.id === selectedClipId);

  if (!clip) return (
    <div className={styles.panel}>
      <div className={styles.empty} style={{ marginTop: 32, textAlign: 'center' }}>
        Select a clip in the timeline to see properties.
      </div>
    </div>
  );

  const upd = patch => store.updateClip(clip.id, patch);

  return (
    <div className={styles.panel}>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Clip · {track.type}</div>
        <label className={styles.field}>
          <span>Name</span>
          <input type="text" value={clip.name || ''} onChange={e => upd({ name: e.target.value })} />
        </label>
        <label className={styles.field}>
          <span>Start (s)</span>
          <input type="number" step="0.1" value={clip.start.toFixed(2)}
            onChange={e => upd({ start: +e.target.value })} />
        </label>
        <label className={styles.field}>
          <span>Duration (s)</span>
          <input type="number" step="0.1" value={clip.duration.toFixed(2)}
            onChange={e => upd({ duration: +e.target.value })} />
        </label>
      </div>

      {/* Audio/Voiceover */}
      {(track.type === 'audio' || track.type === 'voiceover') && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Audio</div>
          <label className={styles.field}>
            <span>Volume {Math.round((clip.volume ?? 1) * 100)}%</span>
            <input type="range" min="0" max="1" step="0.01"
              value={clip.volume ?? 1} onChange={e => upd({ volume: +e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Mute</span>
            <input type="checkbox" checked={!!clip.muted} onChange={e => upd({ muted: e.target.checked })} />
          </label>
        </div>
      )}

      {/* Text */}
      {track.type === 'text' && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Text</div>
          <label className={styles.field}>
            <span>Content</span>
            <textarea rows={2} value={clip.text || ''} onChange={e => upd({ text: e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Font size</span>
            <input type="number" value={clip.fontSize || 36} onChange={e => upd({ fontSize: +e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Color</span>
            <input type="color" value={clip.color || '#ffffff'} onChange={e => upd({ color: e.target.value })}
              style={{ height: 30, padding: 2, width: '100%' }} />
          </label>
          <label className={styles.field}>
            <span>Align</span>
            <select value={clip.align || 'center'} onChange={e => upd({ align: e.target.value })}>
              <option>left</option><option>center</option><option>right</option>
            </select>
          </label>
          <label className={styles.field}>
            <span>X pos (0–1)</span>
            <input type="range" min="0" max="1" step="0.01" value={clip.x ?? 0.5}
              onChange={e => upd({ x: +e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Y pos (0–1)</span>
            <input type="range" min="0" max="1" step="0.01" value={clip.y ?? 0.8}
              onChange={e => upd({ y: +e.target.value })} />
          </label>
        </div>
      )}

      {/* Shape */}
      {track.type === 'shape' && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Shape</div>
          <label className={styles.field}>
            <span>Type</span>
            <select value={clip.shape || 'rect'} onChange={e => upd({ shape: e.target.value })}>
              <option value="rect">Rectangle</option>
              <option value="circle">Circle</option>
            </select>
          </label>
          <label className={styles.field}>
            <span>Color</span>
            <input type="color" value={clip.color || '#ff4b3a'} onChange={e => upd({ color: e.target.value })}
              style={{ height: 30, padding: 2, width: '100%' }} />
          </label>
          <label className={styles.field}>
            <span>Opacity {Math.round((clip.opacity ?? 0.8) * 100)}%</span>
            <input type="range" min="0" max="1" step="0.01" value={clip.opacity ?? 0.8}
              onChange={e => upd({ opacity: +e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>X (0–1)</span>
            <input type="range" min="0" max="1" step="0.01" value={clip.x ?? 0.5} onChange={e => upd({ x: +e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Y (0–1)</span>
            <input type="range" min="0" max="1" step="0.01" value={clip.y ?? 0.5} onChange={e => upd({ y: +e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Width (0–1)</span>
            <input type="range" min="0.01" max="1" step="0.01" value={clip.w ?? 0.2} onChange={e => upd({ w: +e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Height (0–1)</span>
            <input type="range" min="0.01" max="1" step="0.01" value={clip.h ?? 0.1} onChange={e => upd({ h: +e.target.value })} />
          </label>
        </div>
      )}

      {/* Transition */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Transition (in)</div>
        <select value={clip.transition || 'none'} onChange={e => upd({ transition: e.target.value })}>
          {TRANSITIONS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className={styles.section}>
        <button className={styles.dangerBtn} onClick={() => store.removeClip(clip.id)}>🗑 Delete Clip</button>
        <button className={styles.secondaryBtn} style={{marginTop:6}}
          onClick={() => store.splitClip(clip.id, store.getState().playhead)}>
          ✂ Split at Playhead
        </button>
      </div>
    </div>
  );
}
