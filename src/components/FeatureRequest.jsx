import { useState, useEffect } from 'react';
import styles from './Panel.module.css';

export default function FeatureRequest() {
  const [requests, setRequests] = useState([]);
  const [title, setTitle] = useState('');
  const [desc, setDesc]  = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');

  const load = () => {
    fetch('/api/features')
      .then(r => r.json())
      .then(setRequests)
      .catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!title.trim()) return;
    setSending(true);
    try {
      await fetch('/api/features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description: desc }),
      });
      setTitle(''); setDesc('');
      setMsg('✅ Submitted! Will be worked on next available session.');
      load();
    } catch {
      setMsg('❌ Failed to submit. Server may be offline.');
    }
    setSending(false);
  };

  const statusClass = s => ({ pending: styles.pending, working: styles.working, done: styles.done }[s] || styles.pending);

  return (
    <div className={styles.panel}>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>✨ Request a Feature</div>
        <label className={styles.field}>
          <span>Feature title *</span>
          <input type="text" placeholder="e.g. Add color grading filters"
            value={title} onChange={e => setTitle(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Description (optional)</span>
          <textarea rows={3} placeholder="Describe what you'd like..."
            value={desc} onChange={e => setDesc(e.target.value)} />
        </label>
        <button className={styles.primaryBtn} onClick={submit} disabled={sending || !title.trim()}>
          {sending ? 'Submitting…' : '🚀 Submit Request'}
        </button>
        {msg && <p style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>{msg}</p>}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Submitted Requests ({requests.length})</div>
        <div className={styles.trackList} style={{ maxHeight: 300 }}>
          {requests.length === 0 && <p className={styles.empty}>No requests yet.</p>}
          {requests.slice().reverse().map(r => (
            <div key={r.id} className={styles.featureCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className={`${styles.featureStatus} ${statusClass(r.status)}`}>{r.status}</span>
                <span className={styles.featureDate}>{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
              <div className={styles.featureTitle}>{r.title}</div>
              {r.description && <div className={styles.featureDate}>{r.description}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
