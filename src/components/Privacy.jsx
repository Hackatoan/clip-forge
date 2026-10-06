import styles from './Policy.module.css';

export default function Privacy({ onHome, onTerms }) {
  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <div className={styles.brand}><span className={styles.logo}>✂️</span> Clip Forge</div>
        <a className={styles.back} href="#" onClick={(e) => { e.preventDefault(); onHome(); }}>← Home</a>
      </header>
      <main className={styles.content}>
        <h1>Privacy Policy</h1>
        <p className={styles.updated}>Last updated: September 30, 2026</p>

        <p>Clip Forge is a free, hobby-built browser video editor. Here's exactly what it does and doesn't do with your information — and it depends on which parts you actually use.</p>

        <h2>The editor itself: nothing collected</h2>
        <p>Trimming, keyframes, color, export — all of it runs entirely in your browser. Your video, audio, and image files never leave your machine, never get uploaded anywhere, and we never see them. No account is needed for any of this.</p>
        <p><strong>One optional exception:</strong> the “Mosaic” tool in the Media panel, only after you tick its consent box and press the button, sends the current frame and a few stills sampled from your clips to our Mosaic service (mosaic.hackatoa.com) to build the picture. They are processed in memory and not stored. Nothing is sent unless you do this.</p>

        <h2>If you sign in with Google (for Clip Forge Pro)</h2>
        <p>Signing in is only needed to subscribe to or manage Clip Forge Pro. If you do, we receive your email address, display name, and a Google account ID (via Firebase Authentication). We never see or store your Google password.</p>

        <h2>If you subscribe to Pro</h2>
        <ul>
          <li>Payment is handled entirely by Stripe. We never see or store your full card number — Stripe processes it directly and gives us back only your subscription status and a customer reference.</li>
          <li>We store your email and subscription status (active/plan/renewal date) so the app knows you're subscribed.</li>
          <li><strong>Canceling is self-service</strong>: the "Manage subscription" button opens Stripe's own billing portal, where you can cancel or change your plan yourself, anytime — no need to email us.</li>
        </ul>

        <h2>If you use the AI Editor (Pro feature)</h2>
        <p>When you type a request into the AI Editor, we send your typed prompt and a lightweight summary of your current timeline (clip names, types, and timing — not the actual video/audio/image content) to Google's Gemini API to figure out what edits to make. Your actual media files are never sent anywhere; only that small JSON description of clip positions leaves your browser, and only when you use this specific feature.</p>

        <h2>Feature requests</h2>
        <p>If you leave an optional contact email with a feature request, we store it so we can follow up — it's never shown publicly.</p>

        <h2>What we don't do</h2>
        <ul>
          <li>No ads, no ad trackers, no analytics scripts, no selling or sharing your data with third parties.</li>
        </ul>

        <h2>How long we keep it</h2>
        <p>Account and subscription records are kept as long as your account is active, or until you ask us to delete them.</p>

        <h2>Your choices</h2>
        <ul>
          <li>Use the full manual editor without ever signing in or providing any information.</li>
          <li>Cancel your Pro subscription anytime via the self-service Stripe portal.</li>
          <li>Email <a href="mailto:preston@hackatoa.com">preston@hackatoa.com</a> to have your account data deleted.</li>
        </ul>

        <h2>Children's privacy</h2>
        <p>Clip Forge isn't directed at children under 13, and we don't knowingly collect personal information from them.</p>

        <h2>Changes</h2>
        <p>If this policy changes in a meaningful way, we'll update the date above.</p>

        <p>See also our <a href="#" onClick={(e) => { e.preventDefault(); onTerms(); }}>Terms of Service</a>.</p>
        <p>Questions? <a href="mailto:preston@hackatoa.com">preston@hackatoa.com</a></p>
      </main>
    </div>
  );
}
