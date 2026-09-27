// Custom text fonts (ttf/otf/woff/woff2) uploaded by the user. Persisted to
// localStorage as data URLs and registered with the CSS Font Loading API
// (document.fonts) so they're usable in the text tool and in the render
// canvas (ctx.font) the same way a system font is.

const KEY = 'clipforge.fonts.v1';
const MAX_BYTES = 8 * 1024 * 1024; // keep localStorage sane
const EXT_RE = /\.(ttf|otf|woff2?|)$/i;

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  catch { return []; }
}

let fonts = load(); // [{ id, name, dataUrl }]
const listeners = new Set();
const loaded = new Set(); // family names already registered this session

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(fonts)); } catch { /* private mode / quota */ }
}

function register(font) {
  if (loaded.has(font.name) || typeof FontFace === 'undefined') return;
  try {
    const face = new FontFace(font.name, `url(${font.dataUrl})`);
    document.fonts.add(face);
    loaded.add(font.name);
    face.load().catch(() => {}); // swallow decode errors; UI will just fall back visually
  } catch { /* unsupported format */ }
}

fonts.forEach(register); // register persisted fonts at import time

export const fontStore = {
  getState: () => fonts,
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  async addFont(file) {
    if (!EXT_RE.test(file.name) || !/\.(ttf|otf|woff2?)$/i.test(file.name)) {
      throw new Error('Use a .ttf, .otf, .woff or .woff2 file');
    }
    if (file.size > MAX_BYTES) throw new Error('Font file too large (max 8MB)');
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    const name = file.name.replace(/\.(ttf|otf|woff2?)$/i, '');
    const font = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name, dataUrl };
    register(font);
    fonts = [...fonts, font];
    save();
    listeners.forEach(f => f(fonts));
    return font;
  },

  removeFont(id) {
    fonts = fonts.filter(f => f.id !== id);
    save();
    listeners.forEach(f => f(fonts));
    // Note: doesn't unregister from document.fonts — a clip already using it
    // keeps rendering fine for the rest of the session, it just drops off the list.
  },
};
