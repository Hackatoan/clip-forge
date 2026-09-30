// Clip Forge Pro (AI editor) subscription state — tied to a Google account
// via Firebase Auth. The backend verifies the ID token on every request, so
// status/portal answers are for the actual signed-in user, not whatever
// email string a client happens to send.

import { API_BASE } from '../apiBase';
import { auth, signInWithGoogle, signOutUser, onAuthChange, getIdToken } from '../firebase';

const KEY = 'clipforge.pro.v1';
const FUNCTIONS_BASE = `${API_BASE}/api/subscribe`;

const DEFAULTS = { user: null, active: false, plan: null, until: null, checkedAt: null };

function load() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}'), user: null }; }
  catch { return { ...DEFAULTS }; }
}

let state = load();
const listeners = new Set();

function save() {
  // Never persist the live Firebase user object itself — auth.currentUser
  // is the source of truth on reload; only cache the last-known plan info
  // so the UI doesn't flash "not subscribed" for a frame before refreshStatus() lands.
  try {
    const { user, ...rest } = state;
    localStorage.setItem(KEY, JSON.stringify(rest));
  } catch { /* private mode */ }
}

function setState(patch) {
  state = { ...state, ...patch };
  save();
  listeners.forEach((f) => f(state));
}

async function authedFetch(path, opts = {}) {
  const idToken = await getIdToken();
  if (!idToken) throw new Error('Sign in first.');
  return fetch(`${FUNCTIONS_BASE}${path}`, {
    ...opts,
    headers: { ...(opts.headers || {}), Authorization: `Bearer ${idToken}` },
  });
}

onAuthChange((user) => {
  setState({ user });
  if (user) proStore.refreshStatus();
  else setState({ active: false, plan: null, until: null });
});

export const proStore = {
  getState: () => state,
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  async signIn() { await signInWithGoogle(); },
  async signOut() { await signOutUser(); },

  async refreshStatus() {
    if (!auth.currentUser) return;
    try {
      const r = await authedFetch('/status');
      const d = await r.json();
      setState({ active: !!d.active, plan: d.plan || null, until: d.until || null, checkedAt: new Date().toISOString() });
    } catch { /* offline — keep last known state */ }
  },

  // Redirects the browser to Stripe Checkout; there's no return value because
  // the tab navigates away.
  async startCheckout(plan) {
    const r = await authedFetch('/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || 'Checkout failed');
    const { url } = await r.json();
    window.location.href = url;
  },

  async openPortal() {
    const r = await authedFetch('/portal', { method: 'POST' });
    if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || 'Could not open billing portal');
    const { url } = await r.json();
    window.location.href = url;
  },
};
