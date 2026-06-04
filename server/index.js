const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'features.db');
const QUEUE_PATH = process.env.QUEUE_PATH || path.join(__dirname, 'pending_features.json');

// Init DB
const db = new Database(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS features (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`);

app.use(cors());
app.use(express.json());

// Serve built frontend
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// ── Feature request API ──────────────────────────────────

// GET all features
app.get('/api/features', (req, res) => {
  const rows = db.prepare('SELECT * FROM features ORDER BY id DESC').all();
  res.json(rows);
});

// POST new feature
app.post('/api/features', (req, res) => {
  const { title, description } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title required' });

  const info = db.prepare(
    'INSERT INTO features (title, description) VALUES (?, ?)'
  ).run(title.trim(), description?.trim() || null);

  const feature = db.prepare('SELECT * FROM features WHERE id = ?').get(info.lastInsertRowid);

  // Write to queue file for Claude scheduled task pickup
  const queue = fs.existsSync(QUEUE_PATH)
    ? JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8'))
    : [];
  queue.push({ id: feature.id, title: feature.title, description: feature.description, created_at: feature.created_at });
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2));

  console.log(`[feature-request] New: #${feature.id} "${feature.title}"`);
  res.status(201).json(feature);
});

// PATCH status (used by Claude scheduled task)
app.patch('/api/features/:id', (req, res) => {
  const { status } = req.body;
  if (!['pending','working','done'].includes(status)) return res.status(400).json({ error: 'invalid status' });
  db.prepare('UPDATE features SET status=?, updated_at=datetime(\'now\') WHERE id=?').run(status, req.params.id);
  res.json(db.prepare('SELECT * FROM features WHERE id=?').get(req.params.id));
});

// SPA fallback
app.get('*', (req, res) => {
  const index = path.join(distPath, 'index.html');
  if (fs.existsSync(index)) res.sendFile(index);
  else res.send('Clip Forge API running. Build frontend with: npm run build');
});

app.listen(PORT, () => {
  console.log(`Clip Forge server on :${PORT}`);
  console.log(`  API:  http://localhost:${PORT}/api/features`);
});
