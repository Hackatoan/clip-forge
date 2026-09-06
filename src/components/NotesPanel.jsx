import { useStore } from '../hooks/useStore';
import { store } from '../store/editorStore';
import styles from './Panel.module.css';

// Free-form scratchpad for the project: shot lists, to-dos, script notes.
// Kept in the store and saved inside the .clipforge project file.
export default function NotesPanel() {
  const notes = useStore(s => s.notes);
  const chars = notes?.length || 0;

  return (
    <div className={styles.panel}>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Notes</div>
        <p className={styles.hint}>
          Jot down your shot list, script, or to-dos. Saved with the project file.
        </p>
        <textarea
          value={notes || ''}
          onChange={e => store.setNotes(e.target.value)}
          placeholder={'e.g.\n1. Intro — trim dead air\n2. Add title card\n3. Colour-grade the beach shot\n4. Duck music under VO'}
          spellCheck
          style={{
            width: '100%',
            minHeight: 320,
            resize: 'vertical',
            boxSizing: 'border-box',
            padding: 8,
            fontFamily: 'inherit',
            fontSize: '0.8rem',
            lineHeight: 1.45,
            color: 'var(--text)',
            background: 'var(--bg-input, rgba(0,0,0,0.15))',
            border: '1px solid var(--border, rgba(255,255,255,0.12))',
            borderRadius: 6,
          }}
        />
        <div className={styles.empty} style={{ textAlign: 'right' }}>{chars} chars</div>
      </div>
    </div>
  );
}
