const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-to-a-strong-secret-key';

app.use(cors());
app.use(express.json({ limit: '5mb' })); // Allows base64 stock photos

// Helper: Normalize SA phone numbers to last 9 digits
const pn9 = (t) => String(t || '').replace(/\D/g, '').slice(-9);

// Middleware: Verify JWT token
const auth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Not logged in' });
  try {
    req.user = jwt.verify(header.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Session expired' });
  }
};

// Helper: Assemble full user object matching frontend schema
function getFullUser(userId) {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!u) return null;
  const tx = db.prepare('SELECT id, type, amt, cat, desc, d, item, q FROM transactions WHERE user_id = ? ORDER BY d DESC').all(userId);
  const stock = db.prepare('SELECT id, name, qty, cost, price, img FROM stock WHERE user_id = ?').all(userId);
  return {
    id: u.id,
    role: u.role,
    email: u.email,
    plan: u.plan,
    off: u.off,
    owner: u.owner,
    biz: u.biz,
    type: u.type,
    reg: u.reg,
    regno: u.regno,
    phone: u.phone,
    prov: u.prov,
    yrs: u.yrs,
    emp: u.emp,
    bud: { b: u.bud_b, g: u.bud_g },
    tx,
    stock
  };
}

// --- PUBLIC ROUTES ---

app.get('/api/config', (req, res) => {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get('cfg');
  const hasAdmin = !!db.prepare("SELECT id FROM users WHERE role = 'admin'").get();
  res.json({ cfg: JSON.parse(row.value), hasAdmin });
});

app.post('/api/admin/setup', async (req, res) => {
  const exists = db.prepare("SELECT id FROM users WHERE role = 'admin'").get();
  if (exists) return res.status(403).json({ error: 'Admin already exists' });

  const { email, pw } = req.body;
  if (!pw || pw.length < 10) return res.status(400).json({ error: 'Password needs 10 or more characters' });

  const id = crypto.randomUUID();
  const hash = await bcrypt.hash(pw, 10);
  db.prepare('INSERT INTO users (id, role, email, hash) VALUES (?, ?, ?, ?)').run(id, 'admin', email.trim().toLowerCase(), hash);
  res.json({ ok: true });
});

app.post('/api/signup', async (req, res) => {
  const d = req.body;
  const em = (d.email || '').trim().toLowerCase() || null;
  const ph = pn9(d.phone);

  if (ph.length < 9) return res.status(400).json({ error: 'Enter a valid phone number' });
  if (em && db.prepare('SELECT id FROM users WHERE email = ?').get(em)) {
    return res.status(400).json({ error: 'This email is already registered' });
  }
  const allPhones = db.prepare('SELECT phone FROM users WHERE phone IS NOT NULL').all();
  if (allPhones.some(u => pn9(u.phone) === ph)) {
    return res.status(400).json({ error: 'This phone number is already registered' });
  }
  if (!d.pw || d.pw.length < 6) return res.status(400).json({ error: 'Password needs at least 6 characters' });
  if (d.reg === 'Formal' && !(d.regno || '').trim()) {
    return res.status(400).json({ error: 'Enter your registration number' });
  }

  const id = crypto.randomUUID();
  const hash = await bcrypt.hash(d.pw, 10);

  db.prepare(`
    INSERT INTO users (id, role, email, phone, hash, owner, biz, type, reg, regno, prov, yrs, emp)
    VALUES (?, 'user', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, em, d.phone.trim(), hash, d.owner.trim(), d.biz.trim(), d.type, d.reg, (d.regno || '').trim(), d.prov, +d.yrs || 0, +d.emp || 0);

  const token = jwt.sign({ id, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: getFullUser(id) });
});

app.post('/api/login', async (req, res) => {
  const { email, pw, role = 'user' } = req.body;
  const em = (email || '').trim().toLowerCase();

  // Check rate-limit lockout (5 fails -> 5 min cooldown)
  const fail = db.prepare('SELECT * FROM login_fails WHERE identifier = ?').get(em);
  if (fail && fail.count >= 5 && Date.now() - fail.last_attempt < 300000) {
    return res.status(429).json({ error: 'Too many attempts. Try again in 5 minutes' });
  }

  const candidates = db.prepare('SELECT * FROM users WHERE role = ?').all(role);
  const u = candidates.find(a => (a.email && a.email === em) || (a.phone && pn9(em).length > 8 && pn9(a.phone) === pn9(em)));

  if (!u || !(await bcrypt.compare(pw || '', u.hash))) {
    const nextCount = (fail ? fail.count : 0) + 1;
    db.prepare('INSERT OR REPLACE INTO login_fails (identifier, count, last_attempt) VALUES (?, ?, ?)').run(em, nextCount, Date.now());
    return res.status(401).json({ error: 'Wrong email or password' });
  }

  if (u.off) return res.status(403).json({ error: 'This account is suspended' });

  db.prepare('DELETE FROM login_fails WHERE identifier = ?').run(em);
  const token = jwt.sign({ id: u.id, role: u.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: getFullUser(u.id) });
});

// --- PROTECTED USER ROUTES ---

app.get('/api/me', auth, (req, res) => {
  const user = getFullUser(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

// Transactions
app.post('/api/tx', auth, (req, res) => {
  const { type, amt, cat, desc, d, item, q } = req.body;
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO transactions (id, user_id, type, amt, cat, desc, d, item, q) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.user.id, type, +amt, cat || '', desc || '', d, item || null, +q || 0);
  res.json({ id, user: getFullUser(req.user.id) });
});

app.delete('/api/tx/:id', auth, (req, res) => {
  db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ user: getFullUser(req.user.id) });
});

// Stock
app.post('/api/stock', auth, (req, res) => {
  const { name, qty, cost, price, img } = req.body;
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO stock (id, user_id, name, qty, cost, price, img) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.user.id, name.trim(), +qty || 0, +cost || 0, +price || 0, img || null);
  res.json({ id, user: getFullUser(req.user.id) });
});

app.patch('/api/stock/:id', auth, (req, res) => {
  const { qty, cost, price, img } = req.body;
  const item = db.prepare('SELECT * FROM stock WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  db.prepare('UPDATE stock SET qty = ?, cost = ?, price = ?, img = ? WHERE id = ?')
    .run(
      qty !== undefined ? +qty : item.qty,
      cost !== undefined ? +cost : item.cost,
      price !== undefined ? +price : item.price,
      img !== undefined ? img : item.img,
      item.id
    );
  res.json({ user: getFullUser(req.user.id) });
});

// Atomic "Sell" endpoint: decrements stock AND logs income transaction together
app.post('/api/stock/:id/sell', auth, (req, res) => {
  const q = +req.body.q || 1;
  const d = req.body.d || new Date().toISOString().slice(0, 10);
  const item = db.prepare('SELECT * FROM stock WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);

  if (!item) return res.status(404).json({ error: 'Item not found' });
  if (item.qty < q) return res.status(400).json({ error: 'Not enough stock' });

  const sellTx = db.transaction(() => {
    db.prepare('UPDATE stock SET qty = qty - ? WHERE id = ?').run(q, item.id);
    db.prepare('INSERT INTO transactions (id, user_id, type, amt, cat, desc, d, item, q) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(crypto.randomUUID(), req.user.id, 'in', q * item.price, 'Sales', `${q} x ${item.name}`, d, item.name, q);
  });
  sellTx();

  res.json({ user: getFullUser(req.user.id) });
});

app.delete('/api/stock/:id', auth, (req, res) => {
  db.prepare('DELETE FROM stock WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ user: getFullUser(req.user.id) });
});

// Budget & Plan
app.put('/api/budget', auth, (req, res) => {
  const { b, g } = req.body;
  db.prepare('UPDATE users SET bud_b = ?, bud_g = ? WHERE id = ?').run(+b || 0, +g || 0, req.user.id);
  res.json({ user: getFullUser(req.user.id) });
});

app.put('/api/plan', auth, (req, res) => {
  const plan = +req.body.plan;
  if (![0, 1, 2, 3].includes(plan)) return res.status(400).json({ error: 'Invalid plan' });
  db.prepare('UPDATE users SET plan = ? WHERE id = ?').run(plan, req.user.id);
  res.json({ user: getFullUser(req.user.id) });
});

// --- ADMIN ROUTES ---

app.get('/api/admin/users', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const users = db.prepare("SELECT id, email, phone, owner, biz, type, prov, plan, off, created_at FROM users WHERE role = 'user'").all();
  res.json({ users });
});

app.patch('/api/admin/users/:id', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { off, plan } = req.body;
  if (off !== undefined) db.prepare('UPDATE users SET off = ? WHERE id = ?').run(off ? 1 : 0, req.params.id);
  if (plan !== undefined) db.prepare('UPDATE users SET plan = ? WHERE id = ?').run(+plan, req.params.id);
  res.json({ ok: true });
});

app.put('/api/admin/config', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run('cfg', JSON.stringify(req.body.cfg));
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Inno-Verse API running on http://localhost:${PORT}`));
