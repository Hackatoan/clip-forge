const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, '../data/features.json');

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

// GET all features
app.get('/api/features', (req, res) => {
  res.json(loadFeatures());
});

// POST new feature
app.post('/api/features', (req, res) => {
  const { title, description } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title required' });

  const features = loadFeatures();
  const feature = {
    id: Date.now(),
    title: title.trim(),
    description: description?.trim() || '',
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  features.push(feature);
  saveFeatures(features);
  console.log(`[feature-request] New: #${feature.id} "${feature.title}"`);
  res.status(201).json(feature);
});

// PATCH status
app.patch('/api/features/:id', (req, res) => {
  const { status } = req.body;
  if (!['pending','working','done'].includes(status))
    return res.status(400).json({ error: 'invalid status' });

  const features = loadFeatures();
  const f = features.find(x => String(x.id) === req.params.id);
  if (!f) return res.status(404).json({ error: 'not found' });
  f.status = status;
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
