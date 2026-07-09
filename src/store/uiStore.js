// UI/appearance settings — separate from project data. Persisted to
// localStorage and applied to CSS variables on the document root so the whole
// app re-themes/re-layouts live without a React re-render.

const KEY = 'clipforge.ui.v1';

export const THEMES = {
  Ember:    { '--bg': '#1a0f0c', '--bg-surface': '#2a1c17', '--bg-surface2': '#341f18', '--border': '#4a2e22', '--primary': '#ff4b3a', '--primary-glow': '#ff8a4a', '--accent': '#f472b6', '--text': '#f5ede8', '--text-dim': '#c4a090' },
  Midnight: { '--bg': '#0d1117', '--bg-surface': '#161b22', '--bg-surface2': '#1c2430', '--border': '#30363d', '--primary': '#3b82f6', '--primary-glow': '#60a5fa', '--accent': '#a78bfa', '--text': '#e6edf3', '--text-dim': '#8b949e' },
  Slate:    { '--bg': '#18181b', '--bg-surface': '#27272a', '--bg-surface2': '#323238', '--border': '#3f3f46', '--primary': '#f43f5e', '--primary-glow': '#fb7185', '--accent': '#22d3ee', '--text': '#f4f4f5', '--text-dim': '#a1a1aa' },
  Forest:   { '--bg': '#0c1410', '--bg-surface': '#15201a', '--bg-surface2': '#1c2b22', '--border': '#2c4034', '--primary': '#34d399', '--primary-glow': '#6ee7b7', '--accent': '#fbbf24', '--text': '#e8f5ee', '--text-dim': '#9ab5a6' },
  Light:    { '--bg': '#f5f5f4', '--bg-surface': '#ffffff', '--bg-surface2': '#ececea', '--border': '#d6d3d1', '--primary': '#ff4b3a', '--primary-glow': '#ff8a4a', '--accent': '#db2777', '--text': '#1c1917', '--text-dim': '#78716c' },
};

const DEFAULTS = {
  theme: 'Ember',
  accent: '',          // '' → use the theme's accent; otherwise a hex override
  accentGlow: '',
  sidebarPos: 'left',  // left | right
  sidebarWidth: 268,
  timelineHeight: 220,
  fontSize: 13,
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function load() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
}

let state = load();
const listeners = new Set();

function apply() {
  const root = document.documentElement.style;
  const theme = THEMES[state.theme] || THEMES.Ember;
  for (const [k, v] of Object.entries(theme)) root.setProperty(k, v);
  if (state.accent) {
    root.setProperty('--primary', state.accent);
    root.setProperty('--primary-glow', state.accentGlow || state.accent);
  }
  root.setProperty('--panel-w', clamp(state.sidebarWidth, 180, 560) + 'px');
  root.setProperty('--timeline-h', clamp(state.timelineHeight, 120, 560) + 'px');
  root.setProperty('font-size', clamp(state.fontSize, 10, 18) + 'px');
}

export const uiStore = {
  getState: () => state,
  subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
  set(patch) {
    state = { ...state, ...patch };
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
    apply();
    listeners.forEach(f => f(state));
  },
  reset() { this.set({ ...DEFAULTS }); },
  clamp,
};

apply(); // apply persisted settings at import time (before first paint)
