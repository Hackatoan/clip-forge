import { useUi } from '../hooks/useUi';
import { uiStore, THEMES } from '../store/uiStore';
import styles from './ExportModal.module.css';

export default function SettingsModal({ onClose }) {
  const s = useUi();
  const set = patch => uiStore.set(patch);

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} style={{ width: 380 }} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span>⚙ Settings</span>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>
        <div className={styles.body}>
          <label className={styles.field}>
            <span>Theme</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
              {Object.keys(THEMES).map(name => (
                <button key={name}
                  onClick={() => set({ theme: name })}
                  style={{
                    padding: '6px 4px', borderRadius: 6, fontSize: '0.72rem',
                    border: `1px solid ${s.theme === name ? 'var(--primary)' : 'var(--border)'}`,
                    background: THEMES[name]['--bg-surface'], color: THEMES[name]['--text'],
                  }}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, marginRight: 5, background: THEMES[name]['--primary'], verticalAlign: 'middle' }} />
                  {name}
                </button>
              ))}
            </div>
          </label>

          <label className={styles.field}>
            <span>Accent colour {s.accent ? '(custom)' : '(theme)'}</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="color" value={s.accent || THEMES[s.theme]?.['--primary'] || '#ff4b3a'}
                onChange={e => set({ accent: e.target.value, accentGlow: e.target.value })}
                style={{ height: 30, width: 44, padding: 2 }} />
              <button onClick={() => set({ accent: '', accentGlow: '' })}
                style={{ padding: '6px 10px', borderRadius: 6, fontSize: '0.75rem', border: '1px solid var(--border)', background: 'var(--bg-surface2)', color: 'var(--text)' }}>Use theme</button>
            </div>
          </label>

          <label className={styles.field}>
            <span>Sidebar position</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {['left', 'right'].map(p => (
                <button key={p} onClick={() => set({ sidebarPos: p })}
                  style={{ flex: 1, padding: 6, borderRadius: 6, textTransform: 'capitalize',
                    border: `1px solid ${s.sidebarPos === p ? 'var(--primary)' : 'var(--border)'}`,
                    background: 'var(--bg-surface2)', color: 'var(--text)' }}>{p}</button>
              ))}
            </div>
          </label>

          <label className={styles.field}>
            <span>Sidebar width — {s.sidebarWidth}px</span>
            <input type="range" min="180" max="560" value={s.sidebarWidth}
              onChange={e => set({ sidebarWidth: +e.target.value })} />
          </label>

          <label className={styles.field}>
            <span>Timeline height — {s.timelineHeight}px</span>
            <input type="range" min="120" max="560" value={s.timelineHeight}
              onChange={e => set({ timelineHeight: +e.target.value })} />
          </label>

          <label className={styles.field}>
            <span>UI size — {s.fontSize}px</span>
            <input type="range" min="10" max="18" value={s.fontSize}
              onChange={e => set({ fontSize: +e.target.value })} />
          </label>

          <p className={styles.note} style={{ textAlign: 'left' }}>Tip: drag the edges between panels to resize them directly.</p>
          <button className={styles.exportBtn} style={{ background: 'var(--bg-surface2)', color: 'var(--text)', border: '1px solid var(--border)' }}
            onClick={() => uiStore.reset()}>Reset to defaults</button>
        </div>
      </div>
    </div>
  );
}
