import styles from './Landing.module.css';
import { t } from '../i18n';

const FEATURES = [
  { icon: '🎬', title: 'Multi-track timeline', body: 'Video, audio, images, text & shapes on unlimited layers. Trim, split, snap, drag-and-drop — even whole folders.' },
  { icon: '🔑', title: 'Keyframe everything', body: 'Animate opacity, scale, position, rotation and volume over time with eased interpolation. Ken Burns in one click.' },
  { icon: '🟢', title: 'GPU chroma key', body: 'Green/blue-screen removal in a WebGL shader with adjustable similarity and edge softness.' },
  { icon: '🎨', title: 'Filters & blend modes', body: 'Brightness, contrast, saturation, blur, grayscale, one-click looks, plus multiply/screen/overlay blends.' },
  { icon: '🔀', title: 'Transitions & crossfades', body: 'Fade, fade-to-black/white, zoom and slides — plus true cross-clip dissolves between adjacent clips.' },
  { icon: '🔊', title: 'Real audio tools', body: 'Fades, per-clip volume, auto-ducking under voiceover, reverse, a live master meter and volume.' },
  { icon: '📤', title: 'Export up to 8K', body: 'Render to WebM or H.264 MP4 at 480p all the way to 4K and 8K — bitrate scales with resolution.' },
  { icon: '🔒', title: 'No upload, no account', body: 'Everything runs in your browser. Your footage never leaves your machine. Projects save as a single file.' },
];

export default function Landing({ onLaunch }) {
  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <div className={styles.brand}><span className={styles.logo}>✂️</span> Clip Forge</div>
        <button className={styles.navCta} onClick={onLaunch}>{t('Open editor →')}</button>
      </header>

      <section className={styles.hero}>
        <div className={styles.badge}>{t('Browser-based · No AI · No install · Free')}</div>
        <h1 className={styles.title}>{t('Clip Forge — the full-featured video editor that runs in your browser.')}</h1>
        <p className={styles.sub}>
          {t('Multi-track editing, keyframe animation, GPU green-screen, and up-to-8K export — all client-side. No uploads, no account, nothing to install.')}
        </p>
        <p className={styles.sub}>
          {t("It's a hands-on editor you drive yourself — not an AI generator. You make the cuts, keyframes and color; there's no “describe your video” prompt.")}
        </p>
        <div className={styles.ctaRow}>
          <button className={styles.cta} onClick={onLaunch}>{t('🎬 Launch Clip Forge')}</button>
          <a className={styles.ghost} href="https://github.com/Hackatoan/clip-forge" target="_blank" rel="noreferrer">{t('View source')}</a>
        </div>
        <div className={styles.mock}>
          <div className={styles.mockBar}>
            <span className={styles.dot} /><span className={styles.dot} /><span className={styles.dot} />
            <span className={styles.mockUrl}>clip-forge.hackatoa.com</span>
          </div>
          <div className={styles.mockBody}>
            <div className={styles.mockSidebar} />
            <div className={styles.mockStage} />
          </div>
          <div className={styles.mockTimeline}>
            <span style={{ background: 'var(--primary)' }} />
            <span style={{ background: 'var(--accent)' }} />
            <span style={{ background: 'var(--primary-glow)' }} />
          </div>
        </div>
      </section>

      <section className={styles.features} aria-labelledby="features-heading">
        <h2 id="features-heading" className={styles.srOnly}>{t('Clip Forge features')}</h2>
        {FEATURES.map(f => (
          <div key={f.title} className={styles.card}>
            <div className={styles.cardIcon} aria-hidden="true">{f.icon}</div>
            <h3 className={styles.cardTitle}>{t(f.title)}</h3>
            <p className={styles.cardBody}>{t(f.body)}</p>
          </div>
        ))}
      </section>

      <section className={styles.bottomCta}>
        <h2>{t('Ready to edit?')}</h2>
        <p>{t('No sign-up. Open the editor and drop in your first clip.')}</p>
        <button className={styles.cta} onClick={onLaunch}>{t('🎬 Launch Clip Forge')}</button>
      </section>

      <footer className={styles.footer}>
        <span>Clip Forge — a <a href="https://hackatoa.com" target="_blank" rel="noreferrer">Hackatoa</a> project.</span>
        <span>
          <a href="https://github.com/Hackatoan/clip-forge" target="_blank" rel="noreferrer">GitHub</a>
          {' · '}
          <a href="https://buymeacoffee.com/hackatoa" target="_blank" rel="noreferrer">☕ {t('Buy me a coffee')}</a>
        </span>
      </footer>
    </div>
  );
}
