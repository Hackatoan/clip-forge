// Clip Forge Pro billing — Stripe checkout/webhook/status/portal, backed by
// Firestore. This is billing scaffolding only: it gates a "coming soon"
// placeholder in the editor, not an actual AI-editing pipeline yet.
//
// One Cloud Function running a small Express app, mirroring the same shape
// as Clip Forge's existing homelab server (server/index.cjs) — a single
// process with a handful of routes, not one function per route.

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');

admin.initializeApp();
const db = admin.firestore();

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

// Created once via the Stripe API — see the repo's deploy notes. Same live
// Stripe account as Nucleus, a separate Product/Price so it's its own line
// item on invoices/reports.
const PRICE_IDS = {
  monthly: 'price_1UKRGU8D3Tq7wYMfk0vvXdtP', // $20/mo
  yearly: 'price_1UKRGU8D3Tq7wYMfBCUFkPVO',   // $200/yr (2 months free)
};

const ALLOWED_ORIGINS = ['https://clip-forge.hackatoa.com', 'http://localhost:5173'];
const SITE_URL = 'https://clip-forge.hackatoa.com';

const EMAIL_RE = /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/;
function normalizeEmail(raw) {
  const email = String(raw || '').trim().toLowerCase();
  return EMAIL_RE.test(email) && email.length <= 254 ? email : null;
}

const app = express();
app.use(cors({ origin: ALLOWED_ORIGINS }));

// Registered before express.json() so the raw body survives for Stripe's
// signature check — a route-specific parser always wins over one added
// later with app.use(). See cm-relay/nucleus for the same pattern.
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripe = new Stripe(STRIPE_SECRET_KEY.value());
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET.value());
  } catch (err) {
    console.error('[clip-forge-pro] webhook signature check failed:', err.message);
    return res.status(400).send('invalid signature');
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.metadata?.product === 'clip-forge-pro' && typeof session.subscription === 'string') {
        await applySubscription(stripe, session.subscription, session.metadata.email);
      }
    } else if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const sub = event.data.object;
      if (sub.metadata?.product === 'clip-forge-pro' && sub.metadata?.email) {
        await applySubscription(stripe, sub.id, sub.metadata.email);
      }
    }
  } catch (err) {
    console.error('[clip-forge-pro] webhook handling error:', err);
    return res.status(500).send('internal error');
  }
  res.json({ received: true });
});

app.use(express.json());

// Pull the current subscription state from Stripe and write it to Firestore.
// Shared by the webhook and (as a fallback, same as Nucleus does) anything
// that wants to force a resync.
async function applySubscription(stripe, subscriptionId, email) {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const active = sub.status === 'active' || sub.status === 'trialing';
  await db.collection('subscribers').doc(email).set({
    email,
    status: active ? 'active' : sub.status,
    plan: sub.items?.data[0]?.price?.id === PRICE_IDS.yearly ? 'yearly' : 'monthly',
    stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
    stripeSubscriptionId: sub.id,
    currentPeriodEnd: active ? new Date(sub.current_period_end * 1000).toISOString() : null,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

app.post('/checkout', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const plan = req.body?.plan === 'yearly' ? 'yearly' : req.body?.plan === 'monthly' ? 'monthly' : null;
  if (!email) return res.status(400).json({ error: 'valid email required' });
  if (!plan) return res.status(400).json({ error: 'plan must be monthly or yearly' });

  const stripe = new Stripe(STRIPE_SECRET_KEY.value());
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: email,
    line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
    metadata: { email, product: 'clip-forge-pro' },
    subscription_data: { metadata: { email, product: 'clip-forge-pro' } },
    // The query string goes BEFORE the hash: App.jsx's router does a strict
    // `hash === '#editor'` check, so anything appended after #editor (like
    // ?pro=1) would fail that check and bounce to the landing page instead.
    success_url: `${SITE_URL}/?pro=1#editor`,
    cancel_url: `${SITE_URL}/#editor`,
  });
  res.json({ url: session.url });
});

app.get('/status', async (req, res) => {
  const email = normalizeEmail(req.query.email);
  if (!email) return res.status(400).json({ error: 'valid email required' });

  const snap = await db.collection('subscribers').doc(email).get();
  if (!snap.exists) return res.json({ active: false });
  const d = snap.data();
  res.json({ active: d.status === 'active', plan: d.plan || null, until: d.currentPeriodEnd || null });
});

// Stripe-hosted billing portal — cancel/manage without any UI of our own,
// same idea as Nucleus's /api/plus/portal.
app.post('/portal', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email) return res.status(400).json({ error: 'valid email required' });

  const snap = await db.collection('subscribers').doc(email).get();
  const customerId = snap.data()?.stripeCustomerId;
  if (!customerId) return res.status(404).json({ error: 'no subscription found for that email' });

  const stripe = new Stripe(STRIPE_SECRET_KEY.value());
  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${SITE_URL}/#editor`,
  });
  res.json({ url: portal.url });
});

exports.api = onRequest({ secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET], region: 'us-central1' }, app);
