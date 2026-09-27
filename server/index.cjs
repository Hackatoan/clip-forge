// Clip Forge backend API — feature-request board + Pro (AI editor) billing.
// Runs standalone (no static frontend served here — that's Firebase Hosting
// now) on the Oracle box, behind NPMplus at clipforge-api.hackatoa.com.

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const https   = require('https');
const crypto  = require('crypto');
const Stripe  = require('stripe');

const app  = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
const FEATURES_FILE = path.join(DATA_DIR, 'features.json');
const SUBSCRIBERS_FILE = path.join(DATA_DIR, 'subscribers.json');

const ADMIN_TOKEN = process.env.FEATURE_ADMIN_TOKEN || '';
if (!ADMIN_TOKEN) console.warn('[clip-forge-api] FEATURE_ADMIN_TOKEN not set — PATCH /api/features/:id is disabled.');

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;
if (!stripe) console.warn('[clip-forge-api] STRIPE_SECRET_KEY not set — /api/subscribe/* is disabled.');

// Created once via the Stripe API (see repo README/memory) — same live
// account as Nucleus, its own Product/Price so it's a separate line item.
const PRICE_IDS = {
  monthly: 'price_1UKRGU8D3Tq7wYMfk0vvXdtP', // $20/mo
  yearly: 'price_1UKRGU8D3Tq7wYMfBCUFkPVO',   // $200/yr (2 months free)
};
const SITE_URL = process.env.SITE_URL || 'https://clip-forge.hackatoa.com';

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
function requireAdmin(req, res, next) {
  const header = req.get('authorization') || '';
  const provided = header.replace(/^Bearer\s+/i, '').trim();
  if (!ADMIN_TOKEN || !provided || !timingSafeEqual(provided, ADMIN_TOKEN)) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

const EMAIL_RE = /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/;
function normalizeEmail(raw) {
  const email = String(raw || '').trim().toLowerCase();
  return EMAIL_RE.test(email) && email.length <= 254 ? email : null;
}

fs.mkdirSync(DATA_DIR, { recursive: true });
function loadJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function saveJson(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }

const loadFeatures = () => loadJson(FEATURES_FILE, []);
const saveFeatures = (v) => saveJson(FEATURES_FILE, v);
const loadSubscribers = () => loadJson(SUBSCRIBERS_FILE, {});
const saveSubscribers = (v) => saveJson(SUBSCRIBERS_FILE, v);

const ALLOWED_ORIGINS = ['https://clip-forge.hackatoa.com', 'http://localhost:5173', 'http://localhost:3299'];
app.use(cors({ origin: ALLOWED_ORIGINS }));

// Transition period only: needed for ffmpeg.wasm (SharedArrayBuffer) on the
// homelab's still-bundled copy of the frontend — see the dist/ note below.
// Firebase Hosting sets these itself for the real deployment.
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});

// Registered before express.json() so the raw body survives for Stripe's
// signature check — a route-specific parser always wins over one added
// later with app.use(). Same pattern as cm-relay/nucleus.
app.post('/api/subscribe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) return res.status(503).json({ error: 'not configured' });
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[clip-forge-api] webhook signature check failed:', err.message);
    return res.status(400).send('invalid signature');
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.metadata?.product === 'clip-forge-pro' && typeof session.subscription === 'string') {
        await applySubscription(session.subscription, session.metadata.email);
      }
    } else if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const sub = event.data.object;
      if (sub.metadata?.product === 'clip-forge-pro' && sub.metadata?.email) {
        await applySubscription(sub.id, sub.metadata.email);
      }
    }
  } catch (err) {
    console.error('[clip-forge-api] webhook handling error:', err);
    return res.status(500).send('internal error');
  }
  res.json({ received: true });
});

app.use(express.json());

async function applySubscription(subscriptionId, email) {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const active = sub.status === 'active' || sub.status === 'trialing';
  const subscribers = loadSubscribers();
  subscribers[email] = {
    email,
    status: active ? 'active' : sub.status,
    plan: sub.items?.data[0]?.price?.id === PRICE_IDS.yearly ? 'yearly' : 'monthly',
    stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
    stripeSubscriptionId: sub.id,
    currentPeriodEnd: active ? new Date(sub.current_period_end * 1000).toISOString() : null,
    updatedAt: new Date().toISOString(),
  };
  saveSubscribers(subscribers);
}

app.post('/api/subscribe/checkout', async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'not configured' });
  const email = normalizeEmail(req.body?.email);
  const plan = req.body?.plan === 'yearly' ? 'yearly' : req.body?.plan === 'monthly' ? 'monthly' : null;
  if (!email) return res.status(400).json({ error: 'valid email required' });
  if (!plan) return res.status(400).json({ error: 'plan must be monthly or yearly' });

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: email,
    line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
    metadata: { email, product: 'clip-forge-pro' },
    subscription_data: { metadata: { email, product: 'clip-forge-pro' } },
    // Query string before the hash: App.jsx's router does a strict
    // `hash === '#editor'` check, so anything after #editor would fail it.
    success_url: `${SITE_URL}/?pro=1#editor`,
    cancel_url: `${SITE_URL}/#editor`,
  });
  res.json({ url: session.url });
});

app.get('/api/subscribe/status', (req, res) => {
  const email = normalizeEmail(req.query.email);
  if (!email) return res.status(400).json({ error: 'valid email required' });
  const sub = loadSubscribers()[email];
  if (!sub) return res.json({ active: false });
  res.json({ active: sub.status === 'active', plan: sub.plan || null, until: sub.currentPeriodEnd || null });
});

app.post('/api/subscribe/portal', async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'not configured' });
  const email = normalizeEmail(req.body?.email);
  if (!email) return res.status(400).json({ error: 'valid email required' });
  const customerId = loadSubscribers()[email]?.stripeCustomerId;
  if (!customerId) return res.status(404).json({ error: 'no subscription found for that email' });

  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${SITE_URL}/#editor`,
  });
  res.json({ url: portal.url });
});

// ── Feature-request board (unchanged behaviour, moved from the homelab) ──

app.get('/api/features', (req, res) => {
  res.json(loadFeatures().map(({ email, ...rest }) => rest));
});

app.post('/api/features', (req, res) => {
  const { title, description, email } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title required' });

  const features = loadFeatures();
  const feature = {
    id: Date.now(),
    title: title.trim(),
    description: description?.trim() || '',
    email: (email || '').trim().slice(0, 254),
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  features.push(feature);
  saveFeatures(features);
  console.log(`[feature-request] New: #${feature.id} "${feature.title}"${feature.email ? ` (contact: ${feature.email})` : ''}`);
  const { email: _e, ...publicFeature } = feature;
  res.status(201).json(publicFeature);
});

app.patch('/api/features/:id', requireAdmin, (req, res) => {
  const { status, response } = req.body;
  if (status !== undefined && !['pending', 'working', 'done', 'wontfix'].includes(status)) {
    return res.status(400).json({ error: 'invalid status' });
  }
  const features = loadFeatures();
  const f = features.find(x => String(x.id) === req.params.id);
  if (!f) return res.status(404).json({ error: 'not found' });
  if (status !== undefined) f.status = status;
  if (response !== undefined) f.response = String(response);
  f.updated_at = new Date().toISOString();
  saveFeatures(features);
  res.json(f);
});

// Transition period only: the homelab's own deploy still bundles the built
// frontend into this same image (see Dockerfile) so the currently-live site
// doesn't break the moment this ships — it just also gets the new Stripe
// endpoints, unused there since STRIPE_SECRET_KEY isn't set on that host.
// Safe to delete once clip-forge.hackatoa.com is cut over to Firebase
// Hosting and this box is the only thing serving the API.
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) app.use(express.static(distPath));
app.use((req, res) => {
  const index = path.join(distPath, 'index.html');
  if (fs.existsSync(index)) return res.sendFile(index);
  res.status(404).json({ error: 'not found' });
});

// Self-signed cert: NPMplus (the public TLS-terminating edge for
// hackatoa.com) forwards to this over the open internet, so the hop is
// encrypted even though the cert isn't CA-trusted — nginx doesn't validate
// upstream certs by default, so this "just works" as an origin cert.
const CERT_DIR = process.env.CERT_DIR || path.join(DATA_DIR, 'tls');
const keyPath = path.join(CERT_DIR, 'key.pem');
const certPath = path.join(CERT_DIR, 'cert.pem');
if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  https.createServer({ key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }, app)
    .listen(PORT, () => console.log(`Clip Forge API (https, self-signed) on :${PORT}`));
} else {
  console.warn('[clip-forge-api] No TLS cert found — falling back to plain HTTP.');
  app.listen(PORT, () => console.log(`Clip Forge API (http) on :${PORT}`));
}
