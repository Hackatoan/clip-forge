import { useState } from 'react';
import { proStore } from '../store/proStore';
import { useProStore } from '../hooks/useProStore';
import { store } from '../store/editorStore';
import { getIdToken } from '../firebase';
import { API_BASE } from '../apiBase';
import { FILTER_PRESETS, GRADE_PRESETS } from '../engine/presets';
import styles from './Panel.module.css';

// Maps a tool call name (see server/aiEdit.cjs -- keep both in sync) to the
// same store functions manual editing already uses, so undo/redo and every
// existing invariant apply to AI-driven edits for free.
const ACTION_HANDLERS = {
  trim_clip: (a) => {
    const patch = {};
    if (a.start != null) patch.start = a.start;
    if (a.duration != null) patch.duration = a.duration;
    store.updateClip(a.clip_id, patch);
  },
  split_clip: (a) => store.splitClip(a.clip_id, a.at_time),
  delete_clip: (a) => store.removeClip(a.clip_id),
  duplicate_clip: (a) => store.duplicateClip(a.clip_id),
  set_speed: (a) => store.updateClip(a.clip_id, { speed: a.speed }),
  apply_filter_preset: (a) => store.updateClip(a.clip_id, FILTER_PRESETS[a.preset] || {}),
  apply_color_grade: (a) => store.updateClip(a.clip_id, GRADE_PRESETS[a.preset] || {}),
  set_transition: (a) => store.updateClip(a.clip_id, a.edge === 'in'
    ? { transitionIn: a.type, transInDur: a.duration ?? 0.5 }
    : { transitionOut: a.type, transOutDur: a.duration ?? 0.5 }),
  crossfade_with_previous: (a) => store.crossfadePrev(a.clip_id, a.duration ?? 0.5),
  ken_burns: (a) => store.kenBurns(a.clip_id, a.mode || 'in'),
  set_volume: (a) => store.updateClip(a.clip_id, { volume: a.volume }),
  add_marker: (a) => store.addMarker(a.time),
};

const ACTION_LABELS = {
  trim_clip: 'Trimmed a clip',
  split_clip: 'Split a clip',
  delete_clip: 'Deleted a clip',
  duplicate_clip: 'Duplicated a clip',
  set_speed: 'Changed clip speed',
  apply_filter_preset: (a) => `Applied "${a.preset}" filter`,
  apply_color_grade: (a) => `Applied "${a.preset}" color grade`,
  set_transition: (a) => `Set a ${a.type} transition`,
  crossfade_with_previous: 'Added a crossfade',
  ken_burns: 'Added a Ken Burns effect',
  set_volume: 'Changed clip volume',
  add_marker: 'Added a marker',
};

// A lightweight description of the timeline for the model to reason over --
// no media/src data, just enough to reference and reorder clips.
function buildTimelineSummary() {
  const s = store.getState();
  return {
    duration: s.duration,
    aspect: s.aspect,
    tracks: s.tracks.map((t) => ({
      id: t.id,
      type: t.type,
      name: t.name,
      clips: t.clips.map((c) => ({
        id: c.id,
        name: c.name || (c.src ? c.src.split('/').pop() : 'clip'),
        start: c.start,
        duration: c.duration,
        speed: c.speed || 1,
        volume: c.volume ?? 1,
      })),
    })),
  };
}

export default function AiEditor() {
  const pro = useProStore();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const signIn = async () => {
    setErr(''); setBusy(true);
    try {
      await proStore.signIn();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const subscribe = async (plan) => {
    setErr(''); setBusy(true);
    try {
      await proStore.startCheckout(plan);
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  const manage = async () => {
    setErr(''); setBusy(true);
    try {
      await proStore.openPortal();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  const runAiEdit = async () => {
    const prompt = aiPrompt.trim();
    if (!prompt) return;
    setAiBusy(true);
    setLastResult(null);
    try {
      const idToken = await getIdToken();
      const r = await fetch(`${API_BASE}/api/ai/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ prompt, timeline: buildTimelineSummary() }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'AI request failed');

      let applied = 0;
      const summary = [];
      for (const action of data.actions || []) {
        const handler = ACTION_HANDLERS[action.name];
        if (!handler) continue;
        try {
          handler(action.args);
          applied += 1;
          const label = ACTION_LABELS[action.name];
          summary.push(typeof label === 'function' ? label(action.args) : label);
        } catch {
          // A stale/hallucinated clip_id, etc -- skip it, the rest of the
          // edit still applies. store's own functions already no-op safely
          // on an unknown id, so this only guards truly malformed args.
        }
      }
      setLastResult({ message: data.message, applied, summary });
      setAiPrompt('');
    } catch (e) {
      setErr(e.message);
    } finally {
      setAiBusy(false);
    }
  };

  if (!pro.user) {
    return (
      <div className={styles.panel}>
        <div className={styles.notice}>
          <strong>Coming soon.</strong> Clip Forge Pro will add an AI-assisted editing mode —
          describe the edit you want in plain English and it drafts the cuts, color, and captions
          for you to refine with the same tools you already have. Sign in to subscribe and lock in
          early pricing; you'll be notified the moment it's live.
        </div>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>🤖 AI Editor — Pro</div>
          <p className={styles.hint}>Sign in with Google to subscribe or check your Pro status.</p>
          <button className={styles.primaryBtn} onClick={signIn} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in with Google'}
          </button>
          {err && <p style={{ fontSize: '0.75rem', color: 'var(--danger, #ef6b6b)' }}>{err}</p>}
        </div>
      </div>
    );
  }

  if (pro.active) {
    return (
      <div className={styles.panel}>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            🤖 AI Editor <span className={`${styles.featureStatus} ${styles.done}`} style={{ marginLeft: 6 }}>Pro active</span>
          </div>
          <p className={styles.hint}>
            Signed in as {pro.user.email}
            {' · '}
            {pro.plan === 'yearly' ? 'Yearly' : 'Monthly'} plan
            {pro.until ? ` · renews ${new Date(pro.until).toLocaleDateString()}` : ''}
          </p>

          <label className={styles.field}>
            <span>Describe the edit</span>
            <textarea
              rows={3}
              placeholder='e.g. "Trim the first clip to 3 seconds and give everything a warm cinematic look"'
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              disabled={aiBusy}
            />
          </label>
          <button className={styles.primaryBtn} onClick={runAiEdit} disabled={aiBusy || !aiPrompt.trim()}>
            {aiBusy ? 'Thinking…' : 'Generate'}
          </button>

          {lastResult && (
            <div className={styles.notice} style={{ marginTop: 10 }}>
              {lastResult.message && <p>{lastResult.message}</p>}
              {lastResult.applied > 0 ? (
                <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                  {lastResult.summary.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              ) : (
                <p>No changes were made — try describing it a bit more specifically.</p>
              )}
            </div>
          )}

          <div className={styles.notice} style={{ marginTop: 10 }}>
            Auto-generated captions aren't available yet — this covers prompt-driven cuts, speed,
            filters, color grading, and transitions on top of the manual tools already in the editor.
          </div>

          <button className={styles.secondaryBtn} style={{ marginTop: 10 }} onClick={manage} disabled={busy}>
            {busy ? 'Opening…' : 'Manage subscription'}
          </button>
          {' '}
          <button className={styles.secondaryBtn} onClick={() => proStore.signOut()} disabled={busy}>
            Sign out
          </button>
          {err && <p style={{ fontSize: '0.75rem', color: 'var(--danger, #ef6b6b)' }}>{err}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.notice}>
        <strong>Coming soon.</strong> Clip Forge Pro will add an AI-assisted editing mode —
        describe the edit you want in plain English and it drafts the cuts, color, and captions
        for you to refine with the same tools you already have. Subscribe now to lock in early
        pricing; you'll be notified the moment it's live.
      </div>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>🤖 AI Editor — Pro</div>
        <p className={styles.hint}>Signed in as {pro.user.email}</p>
        <div className={styles.btnRow}>
          <button className={styles.primaryBtn} onClick={() => subscribe('monthly')} disabled={busy}>
            {busy ? 'Redirecting…' : '$20/mo'}
          </button>
          <button className={styles.primaryBtn} onClick={() => subscribe('yearly')} disabled={busy}>
            {busy ? 'Redirecting…' : '$200/yr — 2 months free'}
          </button>
        </div>
        {err && <p style={{ fontSize: '0.75rem', color: 'var(--danger, #ef6b6b)' }}>{err}</p>}
        <button className={styles.secondaryBtn} style={{ marginTop: 6 }} onClick={() => proStore.signOut()} disabled={busy}>
          Sign out
        </button>
      </div>
    </div>
  );
}
