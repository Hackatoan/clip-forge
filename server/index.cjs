const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');

const app  = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, '../data/features.json');

// Shared secret for the maintainer-only PATCH endpoint below. Without it the
// endpoint is disabled (fail closed) rather than silently open to anyone.
const ADMIN_TOKEN = process.env.FEATURE_ADMIN_TOKEN || '';
if (!ADMIN_TOKEN) {
  console.warn('[feature-request] FEATURE_ADMIN_TOKEN not set — PATCH /api/features/:id is disabled.');
}

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

// Ensure data dir exists
fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });

function loadFeatures() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return []; }
}

function saveFeatures(features) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(features, null, 2));
}

app.use(cors());
app.use(express.json());

// Cross-origin isolation — required for FFmpeg.wasm (SharedArrayBuffer) in prod.
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});

// Serve built frontend
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) app.use(express.static(distPath));

// GET all features. The submitter's email is private — strip it from the
// public listing so it's never exposed to other visitors.
app.get('/api/features', (req, res) => {
  res.json(loadFeatures().map(({ email, ...rest }) => rest));
});

// POST new feature
app.post('/api/features', (req, res) => {
  const { title, description, email } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title required' });

  const features = loadFeatures();
  const feature = {
    id: Date.now(),
    title: title.trim(),
    description: description?.trim() || '',
    email: (email || '').trim().slice(0, 254), // optional, private; never returned by GET
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

// PATCH status and/or maintainer response — maintainer-only, requires
// `Authorization: Bearer <FEATURE_ADMIN_TOKEN>`. This was previously
// unauthenticated: since GET returns each feature's id, anyone could change
// the status or spoof a maintainer "response" on any request.
app.patch('/api/features/:id', requireAdmin, (req, res) => {
  const { status, response } = req.body;
  if (status !== undefined && !['pending','working','done','wontfix'].includes(status))
    return res.status(400).json({ error: 'invalid status' });

  const features = loadFeatures();
  const f = features.find(x => String(x.id) === req.params.id);
  if (!f) return res.status(404).json({ error: 'not found' });
  if (status !== undefined) f.status = status;
  if (response !== undefined) f.response = String(response);
  f.updated_at = new Date().toISOString();
  saveFeatures(features);
  res.json(f);
});

// SPA fallback (Express 5: use a catch-all middleware, not app.get('*'))
app.use((req, res) => {
  const index = path.join(distPath, 'index.html');
  if (fs.existsSync(index)) res.sendFile(index);
  else res.send('Clip Forge API running.');
});

app.listen(PORT, () => console.log(`Clip Forge on :${PORT}`));
