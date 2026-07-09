import { useStore } from '../hooks/useStore';
import { store } from '../store/editorStore';
import MasterMeter from './MasterMeter';
import styles from './Toolbar.module.css';

export default function Toolbar({ onPanel, activePanel, onExport, onHelp, onSettings }) {
  const { playing, ffmpegReady, loop, canUndo, canRedo, aspect } = useStore(s => s);

  const play = () => store.setPlaying(true);
  const pause = () => store.setPlaying(false);
  const stop = () => { store.setPlaying(false); store.setPlayhead(0); };

  const panels = [
    { id: 'media', label: '📁 Media' },
    { id: 'properties', label: '⚙️ Properties' },
    { id: 'features', label: '✨ Requests' },
  ];

  return (
    <div className={styles.toolbar}>
      <div className={styles.brand}>
        <span className={styles.logo}>✂️</span>
        <span className={styles.name}>Clip Forge</span>
      </div>

      <div className={styles.transport}>
        <button className={styles.tBtn} onClick={() => store.undo()} disabled={!canUndo} title="Undo (Ctrl+Z)">↶</button>
        <button className={styles.tBtn} onClick={() => store.redo()} disabled={!canRedo} title="Redo (Ctrl+Y)">↷</button>
        <span className={styles.sep} />
        <button className={styles.tBtn} onClick={stop} title="Stop">⏹</button>
        {playing
          ? <button className={`${styles.tBtn} ${styles.active}`} onClick={pause} title="Pause (Space)">⏸</button>
          : <button className={`${styles.tBtn} ${styles.active}`} onClick={play} title="Play (Space)">▶️</button>
        }
        <button className={`${styles.tBtn} ${loop ? styles.active : ''}`} onClick={() => store.setLoop(!loop)} title="Loop">🔁</button>
      </div>

      <div className={styles.panels}>
        {panels.map(p => (
          <button
            key={p.id}
            className={`${styles.pBtn} ${activePanel === p.id ? styles.pActive : ''}`}
            onClick={() => onPanel(p.id)}
          >{p.label}</button>
        ))}
      </div>

      <div className={styles.right}>
        <MasterMeter />
        <button className={styles.tBtn} onClick={onHelp} title="Keyboard shortcuts (?)">⌨</button>
        <button className={styles.tBtn} onClick={onSettings} title="Settings" style={{ marginRight: 8 }}>⚙</button>
        <select className={styles.aspect} value={aspect} title="Aspect ratio"
          onChange={e => store.setAspect(e.target.value)}>
          {Object.keys(store.ASPECTS).map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <button
          className={styles.exportBtn}
          disabled={!ffmpegReady}
          title={ffmpegReady ? 'Export video' : 'Loading…'}
          onClick={onExport}
        >⬇ Export</button>
      </div>
    </div>
  );
}
