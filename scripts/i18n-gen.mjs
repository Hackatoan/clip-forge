#!/usr/bin/env node
// One-time (run when strings change): translate clip-forge's SEO static strings
// (from index.html) and Landing UI strings into 6 locales via Gemini, writing
// committed maps under src/i18n/seo/<loc>.json and src/i18n/ui/<loc>.json.
// The build then assembles localized pages with NO Gemini call (i18n-postbuild).
//   Usage: GEMINI_API_KEY=... node scripts/i18n-gen.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error('GEMINI_API_KEY not set'); process.exit(1); }
const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
const LOCALES = ['es', 'pt-br', 'fr', 'de', 'vi', 'th'];
const LANGNAME = { es: 'Spanish', 'pt-br': 'Brazilian Portuguese', fr: 'French', de: 'German', vi: 'Vietnamese', th: 'Thai' };
const KEEP = ['Clip Forge', 'Hackatoa', 'GitHub', 'WebM', 'H.264', 'MP4', 'GPU', 'WebGL', 'Ken Burns', '4K', '8K', '480p'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Landing.jsx UI strings (English keys)
const UI = [
  'Open editor →', 'Browser-based · No install · Free',
  'Clip Forge — the full-featured video editor that runs in your browser.',
  'Multi-track editing, keyframe animation, GPU green-screen, and up-to-8K export — all client-side. No uploads, no account, nothing to install.',
  '🎬 Launch Clip Forge', 'View source', 'Clip Forge features', 'Ready to edit?',
  'No sign-up. Open the editor and drop in your first clip.', 'a', 'project.',
  'Multi-track timeline', 'Video, audio, images, text & shapes on unlimited layers. Trim, split, snap, drag-and-drop — even whole folders.',
  'Keyframe everything', 'Animate opacity, scale, position, rotation and volume over time with eased interpolation. Ken Burns in one click.',
  'GPU chroma key', 'Green/blue-screen removal in a WebGL shader with adjustable similarity and edge softness.',
  'Filters & blend modes', 'Brightness, contrast, saturation, blur, grayscale, one-click looks, plus multiply/screen/overlay blends.',
  'Transitions & crossfades', 'Fade, fade-to-black/white, zoom and slides — plus true cross-clip dissolves between adjacent clips.',
  'Real audio tools', 'Fades, per-clip volume, auto-ducking under voiceover, reverse, a live master meter and volume.',
  'Export up to 8K', 'Render to WebM or H.264 MP4 at 480p all the way to 4K and 8K — bitrate scales with resolution.',
  'No upload, no account', 'Everything runs in your browser. Your footage never leaves your machine. Projects save as a single file.',
];

// collect SEO strings from index.html (text nodes + SEO meta), protecting scripts/style/code
const PROTECT = /<(script|style|code|pre)\b[\s\S]*?<\/\1>/gi;
const hasLetter = (s) => /[A-Za-z]/.test(s);
function collectSeo() {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8').replace(PROTECT, '');
  const set = new Set();
  html.replace(/>([^<>]+)</g, (m, t) => { const v = t.trim(); if (hasLetter(v)) set.add(v); return m; });
  const tm = html.match(/<title>([^<]+)<\/title>/i); if (tm) set.add(tm[1].trim());
  html.replace(/<meta\s+name="(?:description|keywords|twitter:title|twitter:description)"\s+content="([^"]*)"/gi, (m, c) => { if (hasLetter(c)) set.add(c); return m; });
  html.replace(/<meta\s+property="(?:og:title|og:description)"\s+content="([^"]*)"/gi, (m, c) => { if (hasLetter(c)) set.add(c); return m; });
  return [...set];
}

async function translate(strings, langName, code) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`;
  const prompt = `Translate each string in this JSON array from English into ${langName} (locale "${code}").
Return ONLY a JSON array, same length and order, one translation per input.
- Natural, idiomatic; this is a browser video-editor product.
- Preserve leading/trailing whitespace, emoji, symbols (→ · & / etc.) and HTML entities.
- Do NOT translate: ${KEEP.join(', ')}.
- A lone word like "a" translates naturally in context of "a Hackatoa project".
Input:
${JSON.stringify(strings)}`;
  for (let a = 1; a <= 6; a++) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } }) });
    const d = await res.json().catch(() => ({}));
    const txt = d?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (txt) { try { const arr = JSON.parse(txt); if (Array.isArray(arr) && arr.length === strings.length) return arr; } catch {} }
    console.warn(`    retry ${a} (${d?.error?.status || res.status})`);
    await sleep((d?.error?.status === 'RESOURCE_EXHAUSTED') ? 20000 : 2000 * a);
  }
  throw new Error('translate failed');
}

const seo = collectSeo();
console.log(`SEO strings: ${seo.length}, UI strings: ${UI.length}`);
mkdirSync(join(ROOT, 'src/i18n/seo'), { recursive: true });
mkdirSync(join(ROOT, 'src/i18n/ui'), { recursive: true });
for (const loc of LOCALES) {
  process.stdout.write(`${loc}... `);
  const seoT = await translate(seo, LANGNAME[loc], loc);
  const uiT = await translate(UI, LANGNAME[loc], loc);
  const seoMap = {}; seo.forEach((k, i) => (seoMap[k] = seoT[i]));
  const uiMap = {}; UI.forEach((k, i) => (uiMap[k] = uiT[i]));
  writeFileSync(join(ROOT, `src/i18n/seo/${loc}.json`), JSON.stringify(seoMap, null, 2) + '\n');
  writeFileSync(join(ROOT, `src/i18n/ui/${loc}.json`), JSON.stringify(uiMap, null, 2) + '\n');
  console.log('ok');
  await sleep(1500);
}
console.log('Done.');
