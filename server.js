const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const db = new Database(process.env.DB_PATH || path.join(__dirname, 'data.db'));

db.exec(`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS vendors(id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, stall TEXT, description TEXT);
CREATE TABLE IF NOT EXISTS site(id INTEGER PRIMARY KEY CHECK(id=1), name TEXT, tagline TEXT, email TEXT, phone TEXT, address TEXT, hours TEXT);
`);

// Seed the admin account (credentials come from environment variables)
if (!db.prepare('SELECT 1 FROM users').get()) {
  const user = process.env.ADMIN_USER || 'admin';
  const pass = process.env.ADMIN_PASS || 'changeme123';
  db.prepare('INSERT INTO users(username, hash) VALUES(?, ?)').run(user, bcrypt.hashSync(pass, 10));
}
// Seed starter content
if (!db.prepare('SELECT 1 FROM site').get()) {
  db.prepare('INSERT INTO site VALUES(1,?,?,?,?,?,?)').run(
    'Green Table Market',
    'A weekend farmers market bringing local growers, bakers and makers together.',
    'hello@greentablemarket.example', '(555) 010-2040', '120 Orchard Lane, Springfield',
    'Saturdays 8am–2pm, Sundays 9am–1pm');
  const ins = db.prepare('INSERT INTO vendors(name,category,stall,description) VALUES(?,?,?,?)');
  [['Lena’s Greens','Produce','A1','Seasonal vegetables and salad mixes picked the morning of the market.'],
   ['Sunrise Bakery','Baked goods','B4','Sourdough, seeded rye and cardamom buns baked in a wood-fired oven.'],
   ['Hilltop Honey','Pantry','C2','Raw wildflower honey, beeswax candles and small-batch preserves.']
  ].forEach(v => ins.run(...v));
}

app.set('trust proxy', 1);
app.use(express.json({ limit: '10kb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 8 }
}));
app.use(express.static(path.join(__dirname, 'public')));

const s = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const requireAdmin = (req, res, next) =>
  req.session.userId ? next() : res.status(401).json({ error: 'Please log in.' });

// ---- Public API ----
app.get('/api/site', (req, res) => res.json(db.prepare('SELECT * FROM site WHERE id=1').get()));
app.get('/api/vendors', (req, res) => res.json(db.prepare('SELECT * FROM vendors ORDER BY name').all()));

// ---- Auth ----
const attempts = new Map();
app.post('/api/login', (req, res) => {
  const key = req.ip, now = Date.now();
  const a = attempts.get(key) || { n: 0, t: now };
  if (now - a.t > 15 * 60 * 1000) { a.n = 0; a.t = now; }
  if (a.n >= 10) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  const user = db.prepare('SELECT * FROM users WHERE username=?').get(s(req.body.username, 60));
  if (!user || !bcrypt.compareSync(String(req.body.password || ''), user.hash)) {
    a.n++; attempts.set(key, a);
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
  attempts.delete(key);
  req.session.regenerate(() => {
    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ username: user.username });
  });
});
app.post('/api/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));
app.get('/api/me', (req, res) => res.json({ username: req.session.username || null }));

// ---- Admin API (add, edit, delete) ----
function vendorFields(b) {
  const v = { name: s(b.name, 60), category: s(b.category, 40), stall: s(b.stall, 10), description: s(b.description, 240) };
  return v.name && v.category ? v : null;
}
app.post('/api/vendors', requireAdmin, (req, res) => {
  const v = vendorFields(req.body);
  if (!v) return res.status(400).json({ error: 'Name and category are required.' });
  const r = db.prepare('INSERT INTO vendors(name,category,stall,description) VALUES(@name,@category,@stall,@description)').run(v);
  res.status(201).json({ id: r.lastInsertRowid, ...v });
});
app.put('/api/vendors/:id', requireAdmin, (req, res) => {
  const v = vendorFields(req.body);
  if (!v) return res.status(400).json({ error: 'Name and category are required.' });
  const r = db.prepare('UPDATE vendors SET name=@name,category=@category,stall=@stall,description=@description WHERE id=@id').run({ ...v, id: req.params.id });
  r.changes ? res.json({ ok: true }) : res.status(404).json({ error: 'Vendor not found.' });
});
app.delete('/api/vendors/:id', requireAdmin, (req, res) => {
  const r = db.prepare('DELETE FROM vendors WHERE id=?').run(req.params.id);
  r.changes ? res.json({ ok: true }) : res.status(404).json({ error: 'Vendor not found.' });
});
app.put('/api/site', requireAdmin, (req, res) => {
  const b = req.body, email = s(b.email, 100);
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  db.prepare('UPDATE site SET name=?,tagline=?,email=?,phone=?,address=?,hours=? WHERE id=1')
    .run(s(b.name, 60) || 'Market', s(b.tagline, 200), email, s(b.phone, 30), s(b.address, 120), s(b.hours, 120));
  res.json({ ok: true });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Green Table Market running on port ${port}`));
