import { useState, useEffect } from 'react';
import styles from './Panel.module.css';

export default function FeatureRequest() {
  const [requests, setRequests] = useState([]);
  const [title, setTitle] = useState('');
  const [desc, setDesc]  = useState('');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');
  const [showHowto, setShowHowto] = useState(false);

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
        body: JSON.stringify({ title, description: desc, email }),
      });
      setTitle(''); setDesc(''); setEmail('');
      setMsg(email.trim()
        ? '✅ Submitted! We\'ll email you if we need details or when it ships.'
        : '✅ Feature suggestion submitted. Trying to edit your own clip? Open “How do I…?” above — those are done by hand, not by request.');
      load();
    } catch {
      setMsg('❌ Failed to submit. Server may be offline.');
    }
    setSending(false);
  };

  const statusClass = s => ({ pending: styles.pending, working: styles.working, done: styles.done, wontfix: styles.wontfix }[s] || styles.pending);
  const statusLabel = s => (s === 'wontfix' ? "won't do" : s);

  return (
    <div className={styles.panel}>
      <div className={styles.notice}>
        <strong>Clip Forge isn't an AI editor.</strong> There's no “make it cinematic” or
        “remove the talking” button — you edit the video yourself with the tools in the
        editor (<em>Filters &amp; color, Transitions, Audio, Keyframes, Chroma key</em>).
        {' '}This box is only for <em>suggesting a new tool to add to the editor</em> — not
        for asking the app to change your clip. Prompts like “enhance my video” can't be done.
        {' '}👉 <a href="#howto" onClick={e => { e.preventDefault(); setShowHowto(true); }}>
          Most of what people ask <em>is</em> possible by hand — here's how ↓
        </a>
      </div>

      <details className={styles.section} open={showHowto}>
        <summary className={styles.howtoSummary}>🎓 “How do I…?” — do it yourself in the editor</summary>
        <ul className={styles.howtoList}>
          <li><strong>Make it look cinematic</strong> → select the clip → <em>Filters &amp; color</em>: add contrast, ease off saturation, pick a warm/teal look; drop black bars with a <em>Shape</em> for the widescreen feel.</li>
          <li><strong>Remove the talking / speech</strong> → select the clip → <em>Audio</em>: set volume to 0 / mute, or split the audio out and delete it. <em>Auto-duck</em> lowers it under a voiceover. (There's no AI voice removal.)</li>
          <li><strong>Enhance the colors / quality</strong> → <em>Filters &amp; color</em>: brightness, contrast, saturation, blur/sharpen. (Editing can't add resolution or detail that isn't in the source file.)</li>
          <li><strong>Add text or titles</strong> → <em>Add ▸ Text</em>, drop it on the timeline, set font/size/position in <em>Properties</em>, and animate it with <em>Keyframes</em>.</li>
          <li><strong>Smooth transition between two clips</strong> → put the clips next to each other on the same track → add a <em>Crossfade / Dissolve</em> transition.</li>
          <li><strong>Flip / rotate / zoom over time</strong> → use <em>Keyframes</em> on rotation &amp; scale for an animated flip or Ken-Burns move.</li>
        </ul>
      </details>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>✨ Request an editor feature</div>
        <label className={styles.field}>
          <span>Feature to add *</span>
          <input type="text" placeholder="e.g. Add color-grading filters"
            value={title} onChange={e => setTitle(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Description (optional)</span>
          <textarea rows={3} placeholder="Describe the tool/feature you want added to the editor…"
            value={desc} onChange={e => setDesc(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Email for a response (optional)</span>
          <input type="email" placeholder="you@example.com — leave blank to stay anonymous"
            value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <p className={styles.hint}>Only used to follow up on your request. Never shown publicly or shared.</p>
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
                <span className={`${styles.featureStatus} ${statusClass(r.status)}`}>{statusLabel(r.status)}</span>
                <span className={styles.featureDate}>{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
              <div className={styles.featureTitle}>{r.title}</div>
              {r.description && <div className={styles.featureDate}>{r.description}</div>}
              {r.response && (
                <div className={styles.featureResponse}>
                  <span className={styles.responseLabel}>↳ Reply</span> {r.response}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
