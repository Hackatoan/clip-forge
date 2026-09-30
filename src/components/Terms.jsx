import styles from './Policy.module.css';

export default function Terms({ onHome, onPrivacy }) {
  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <div className={styles.brand}><span className={styles.logo}>✂️</span> Clip Forge</div>
        <a className={styles.back} href="#" onClick={(e) => { e.preventDefault(); onHome(); }}>← Home</a>
      </header>
      <main className={styles.content}>
        <h1>Terms of Service</h1>
        <p className={styles.updated}>Last updated: September 30, 2026</p>

        <p>By using Clip Forge, you agree to these terms.</p>

        <ul>
          <li>Clip Forge is provided free (with an optional paid Pro tier), as-is, with no warranty of any kind. We're not liable for any damages arising from using it, including loss of a project file you didn't otherwise back up.</li>
          <li>You're responsible for having the rights to any footage, audio, or images you edit — Clip Forge never sees or stores your media, so we can't and don't moderate it.</li>
          <li>Clip Forge Pro is billed monthly or yearly via Stripe. You can cancel anytime through the self-service billing portal (Manage Subscription); cancellation takes effect at the end of the current billing period, and we don't offer partial refunds for unused time.</li>
          <li>The AI Editor (Pro) makes a best effort based on your prompt — it can misinterpret requests or make mistakes. Review its changes like you would any edit; we're not liable for the results.</li>
          <li>If you sign in with Google, you're also subject to Google's own terms for that sign-in.</li>
          <li>We may change, suspend, or discontinue any part of Clip Forge (including Pro features) at any time.</li>
          <li>We may update these terms from time to time; continued use means you accept the changes.</li>
        </ul>

        <p>See also our <a href="#" onClick={(e) => { e.preventDefault(); onPrivacy(); }}>Privacy Policy</a>.</p>
        <p>Questions? <a href="mailto:preston@hackatoa.com">preston@hackatoa.com</a></p>
      </main>
    </div>
  );
}
