// Lightweight, dependency-free UI i18n for the React app.
// Locale is taken from the URL path (/es/, /pt-br/, …) so the localized static
// pages generated at build time (i18n-postbuild) and the React UI agree.
import es from './ui/es.json';
import ptbr from './ui/pt-br.json';
import fr from './ui/fr.json';
import de from './ui/de.json';
import vi from './ui/vi.json';
import th from './ui/th.json';

const MAPS = { es, 'pt-br': ptbr, fr, de, vi, th };
export const SUPPORTED = ['es', 'pt-br', 'fr', 'de', 'vi', 'th'];

function detectLocale() {
  if (typeof window === 'undefined') return 'en';
  const seg = window.location.pathname.split('/').filter(Boolean)[0];
  return SUPPORTED.includes(seg) ? seg : 'en';
}

export const locale = detectLocale();
const map = MAPS[locale] || {};

// t('English source string') -> localized (falls back to the English key)
export function t(en) {
  return Object.prototype.hasOwnProperty.call(map, en) ? map[en] : en;
}
