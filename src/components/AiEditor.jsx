import { useState } from 'react';
import { proStore } from '../store/proStore';
import { useProStore } from '../hooks/useProStore';
import styles from './Panel.module.css';

export default function AiEditor() {
  const pro = useProStore();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

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
          <div className={styles.notice}>
            <strong>The AI editor itself isn't built yet.</strong> Your subscription is active and
            you'll be first in line when it ships — prompt-driven cuts, auto color grading, and
            auto-generated captions, on top of the manual tools already in the editor.
          </div>
          <button className={styles.secondaryBtn} onClick={manage} disabled={busy}>
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
