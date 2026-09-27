// Clip Forge Pro (AI editor) subscription state — email-only, no password.
// The email typed into the upsell panel is remembered locally and used to
// ask the billing backend "is this email active?" There's no login: anyone
// who knows the email could ask the same question, but the answer is just
// "show the Pro UI or don't" — nothing sensitive is gated behind it.

const KEY = 'clipforge.pro.v1';

// Cloud Functions v2 HTTPS function, reachable at the stable
// https://{region}-{project}.cloudfunctions.net/{name} compatibility URL.
const FUNCTIONS_BASE = 'https://us-central1-clip-forge-pro.cloudfunctions.net/api';

const DEFAULTS = { email: '', active: false, plan: null, until: null, checkedAt: null };

function load() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
}

let state = load();
const listeners = new Set();

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
}

function setState(patch) {
  state = { ...state, ...patch };
  save();
  listeners.forEach(f => f(state));
}

export const proStore = {
  getState: () => state,
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  setEmail(email) { setState({ email: email.trim() }); },

  async refreshStatus() {
    if (!state.email) return;
    try {
      const r = await fetch(`${FUNCTIONS_BASE}/status?email=${encodeURIComponent(state.email)}`);
      const d = await r.json();
      setState({ active: !!d.active, plan: d.plan || null, until: d.until || null, checkedAt: new Date().toISOString() });
    } catch { /* offline — keep last known state */ }
  },

  // Redirects the browser to Stripe Checkout; there's no return value because
  // the tab navigates away.
  async startCheckout(plan) {
    const r = await fetch(`${FUNCTIONS_BASE}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: state.email, plan }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || 'Checkout failed');
    const { url } = await r.json();
    window.location.href = url;
  },

  async openPortal() {
    const r = await fetch(`${FUNCTIONS_BASE}/portal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: state.email }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || 'Could not open billing portal');
    const { url } = await r.json();
    window.location.href = url;
  },
};
