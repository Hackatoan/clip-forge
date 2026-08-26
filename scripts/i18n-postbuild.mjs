#!/usr/bin/env node
// Runs after `vite build`. Generates dist/<locale>/index.html from dist/index.html
// using the committed src/i18n/seo/<locale>.json maps (NO Gemini at build time):
// translates the static SEO text + meta in place, sets <html lang>, self-referential
// canonical/og:url, hreflang alternates, and writes dist/sitemap.xml.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const ORIGIN = 'https://clip-forge.hackatoa.com';
const LOCALES = ['es', 'pt-br', 'fr', 'de', 'vi', 'th'];
const HREFLANG = { en: 'en', 'pt-br': 'pt-BR', es: 'es', fr: 'fr', de: 'de', vi: 'vi', th: 'th' };
const ALL = ['en', ...LOCALES];
const url = (l) => (l === 'en' ? `${ORIGIN}/` : `${ORIGIN}/${l}/`);

if (!existsSync(join(DIST, 'index.html'))) { console.error('dist/index.html missing — run vite build first'); process.exit(1); }
const baseHtml = readFileSync(join(DIST, 'index.html'), 'utf8');

const PROTECT = /<(script|style|code|pre)\b[\s\S]*?<\/\1>/gi;
const hasLetter = (s) => /[A-Za-z]/.test(s);

const hreflangBlock = () => {
  const links = ALL.map((l) => `  <link rel="alternate" hreflang="${HREFLANG[l]}" href="${url(l)}" />`);
  links.push(`  <link rel="alternate" hreflang="x-default" href="${ORIGIN}/" />`);
  return `\n  <!-- i18n:hreflang -->\n${links.join('\n')}`;
};

function localize(html, loc, map) {
  // protect scripts/styles/code
  const blocks = [];
  let s = html.replace(PROTECT, (m) => `%%${blocks.push(m) - 1}%%`);
  const tr = (v) => { const k = v.trim(); return (Object.prototype.hasOwnProperty.call(map, k) && map[k] != null) ? v.replace(k, map[k]) : v; };
  s = s
    .replace(/>([^<>]+)</g, (m, t) => (hasLetter(t) ? `>${tr(t)}<` : m))
    .replace(/<title>([^<]+)<\/title>/i, (m, t) => `<title>${tr(t)}</title>`)
    .replace(/(<meta\s+name="(?:description|keywords|twitter:title|twitter:description)"\s+content=")([^"]*)(")/gi, (m, p, c, q) => `${p}${tr(c)}${q}`)
    .replace(/(<meta\s+property="(?:og:title|og:description)"\s+content=")([^"]*)(")/gi, (m, p, c, q) => `${p}${tr(c)}${q}`);
  s = s.replace(/%%(\d+)%%/g, (m, i) => blocks[+i]);
  // lang + self-referential canonical/og:url + hreflang
  s = s.replace(/<html lang="en">/i, `<html lang="${loc}">`)
       .replace(/(<link\b[^>]*\brel="canonical"[^>]*\bhref=")[^"]*(")/i, `$1${url(loc)}$2`)
       .replace(/(<meta\b[^>]*\bproperty="og:url"[^>]*\bcontent=")[^"]*(")/i, `$1${url(loc)}$2`)
       .replace('</head>', `${hreflangBlock()}\n</head>`);
  return s;
}

// English page also gets hreflang (idempotent-ish; strip any prior block first)
const enOut = baseHtml.replace(/\s*<!-- i18n:hreflang -->[\s\S]*?(?=\n<\/head>|<\/head>)/i, '').replace('</head>', `${hreflangBlock()}\n</head>`);
writeFileSync(join(DIST, 'index.html'), enOut);

for (const loc of LOCALES) {
  const mapPath = join(ROOT, `src/i18n/seo/${loc}.json`);
  const map = existsSync(mapPath) ? JSON.parse(readFileSync(mapPath, 'utf8')) : {};
  mkdirSync(join(DIST, loc), { recursive: true });
  writeFileSync(join(DIST, loc, 'index.html'), localize(baseHtml, loc, map));
  console.log(`  dist/${loc}/index.html`);
}

const today = new Date().toISOString().slice(0, 10);
const alts = ALL.map((l) => `    <xhtml:link rel="alternate" hreflang="${HREFLANG[l]}" href="${url(l)}"/>`).join('\n') + `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}/"/>`;
const urls = ALL.map((l) => `  <url>\n    <loc>${url(l)}</loc>\n    <lastmod>${today}</lastmod>\n${alts}\n  </url>`).join('\n');
writeFileSync(join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`);
console.log('  dist/sitemap.xml\ni18n-postbuild done.');
