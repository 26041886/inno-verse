const Database = require('better-sqlite3');
const db = new Database('innoverse.db');

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    role TEXT DEFAULT 'user',
    email TEXT UNIQUE,
    phone TEXT,
    hash TEXT NOT NULL,
    plan INTEGER DEFAULT 0,
    off INTEGER DEFAULT 0,
    owner TEXT,
    biz TEXT,
    type TEXT,
    reg TEXT,
    regno TEXT,
    prov TEXT,
    yrs INTEGER DEFAULT 0,
    emp INTEGER DEFAULT 0,
    bud_b REAL DEFAULT 0,
    bud_g REAL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL, -- 'in' or 'out'
    amt REAL NOT NULL,
    cat TEXT,
    desc TEXT,
    d TEXT NOT NULL,    -- YYYY-MM-DD
    item TEXT,
    q INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS stock (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    qty INTEGER DEFAULT 0,
    cost REAL DEFAULT 0,
    price REAL DEFAULT 0,
    img TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS login_fails (
    identifier TEXT PRIMARY KEY,
    count INTEGER DEFAULT 0,
    last_attempt INTEGER DEFAULT 0
  );
`);

// Seed default pricing config if missing
const initCfg = db.prepare('INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)');
initCfg.run('cfg', JSON.stringify({ prices: [0, 20, 50, 100], free: 30 }));

module.exports = db;
