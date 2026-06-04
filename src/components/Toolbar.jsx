import { useStore } from '../hooks/useStore';
import { store } from '../store/editorStore';
import styles from './Toolbar.module.css';

export default function Toolbar({ onPanel, activePanel }) {
  const { playing, ffmpegReady, exportProgress } = useStore(s => s);

  const play  = () => store.setPlaying(true);
  const pause = () => store.setPlaying(false);
  const stop  = () => { store.setPlaying(false); store.setPlayhead(0); };

  const panels = [
    { id: 'media',      label: '📁 Media' },
    { id: 'properties', label: '⚙️ Properties' },
    { id: 'features',   label: '✨ Requests' },
  ];

  return (
    <div className={styles.toolbar}>
      <div className={styles.brand}>
        <span className={styles.logo}>✂️</span>
        <span className={styles.name}>Clip Forge</span>
      </div>

      <div className={styles.transport}>
        <button className={styles.tBtn} onClick={stop} title="Stop">⏹</button>
        {playing
          ? <button className={`${styles.tBtn} ${styles.active}`} onClick={pause} title="Pause">⏸</button>
          : <button className={`${styles.tBtn} ${styles.active}`} onClick={play} title="Play">▶️</button>
        }
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
        {exportProgress !== null
          ? <span className={styles.exporting}>Exporting {Math.round(exportProgress)}%</span>
          : <button
              className={styles.exportBtn}
              disabled={!ffmpegReady}
              title={ffmpegReady ? 'Export video' : 'FFmpeg loading…'}
              onClick={() => alert('Export: select a clip and use Export panel')}
            >⬇ Export</button>
        }
      </div>
    </div>
  );
}
