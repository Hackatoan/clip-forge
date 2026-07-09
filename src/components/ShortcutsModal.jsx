import styles from './ExportModal.module.css';

const GROUPS = [
  {
    title: 'Playback',
    items: [
      ['Space', 'Play / pause'],
      ['← / →', 'Step 0.1s (Shift = 1s)'],
      ['Home / End', 'Jump to start / end'],
      ['Drag ruler / playhead', 'Scrub'],
    ],
  },
  {
    title: 'Editing',
    items: [
      ['Ctrl/⌘ Z', 'Undo'],
      ['Ctrl/⌘ Shift Z · Y', 'Redo'],
      ['Ctrl/⌘ C · V · D', 'Copy · Paste · Duplicate'],
      ['Delete / Backspace', 'Remove selected clip'],
    ],
  },
  {
    title: 'Timeline',
    items: [
      ['Drag clip', 'Move'],
      ['Drag clip edges', 'Trim'],
      ['Double-click clip', 'Split at playhead'],
      ['M', 'Add marker at playhead'],
      ['Hold Alt while dragging', 'Bypass snapping'],
    ],
  },
];

export default function ShortcutsModal({ onClose }) {
  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} style={{ width: 420 }} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span>⌨ Keyboard shortcuts</span>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>
        <div className={styles.body}>
          {GROUPS.map(g => (
            <div key={g.title} style={{ marginBottom: 6 }}>
              <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--primary-glow)', marginBottom: 6 }}>{g.title}</div>
              {g.items.map(([k, d]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '3px 0', fontSize: '0.78rem' }}>
                  <kbd style={{ background: 'var(--bg-surface2)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px', color: 'var(--text)', whiteSpace: 'nowrap' }}>{k}</kbd>
                  <span style={{ color: 'var(--text-dim)', textAlign: 'right' }}>{d}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
