const I = {
  "shop": "images/shop.jpg",
  "jar": "images/jar.jpg",
  "score": "images/score.jpg",
  "arrow": "images/arrow.jpg",
  "key": "images/key.jpg",
  "coins": "images/coins.jpg"
};
const TYPES = ['Small clothing shop', 'Hair salon', 'Restaurant', 'Small technology business', 'Spaza shop', 'Small farming business'];
const CAT = ['Sales', 'Stock purchase', 'Rent', 'Wages', 'Transport', 'Electricity and airtime', 'Other'];
const PROV = ['Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'];
const BG = { home: 'arrow', about: 'coins', ask: 'key', analytics: 'arrow', signup: 'shop', login: 'key', terms: 'score', privacy: 'score', admin: 'score', dash: 'coins', tx: 'jar', stock: 'shop', budget: 'coins', reports: 'arrow', qr: 'key', plan: 'coins' };
const MENU = [['dash', 'Dashboard'], ['tx', 'Transactions'], ['stock', 'Stock'], ['analytics', 'Analytics'], ['budget', 'Budget'], ['reports', 'Reports'], ['qr', 'QR code'], ['ask', 'Ask'], ['plan', 'Plans']];
const PUB = ['home', 'about', 'signup', 'login', 'terms', 'privacy', 'admin'];
const $ = s => document.querySelector(s);

// --- BACKEND API LAYER ---
const API = 'http://localhost:3000/api';
let token = localStorage.getItem('bl_tok');
let currentUser = null;
let appCfg = { prices: [0, 20, 50, 100], free: 30 };
let hasAdminUser = false;

const api = async (path, method = 'GET', body) => {
  try {
    const res = await fetch(API + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    if (data.user) currentUser = data.user;
    return data;
  } catch (e) {
    throw e;
  }
};

let tm, rm = '', lang = localStorage.getItem('bl_lang') || 'en';
const h = (t, a = {}, ...c) => {
  const e = document.createElement(t);
  for (const k in a) {
    if (k.startsWith('on')) e.addEventListener(k.slice(2), a[k]);
    else e.setAttribute(k, a[k]);
  }
  c.flat(9).forEach(x => e.append(x));
  return e;
};

const U = () => currentUser;
const R = n => (n < 0 ? '-R' : 'R') + Math.abs(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const month = () => new Date().toISOString().slice(0, 7);
const sum = (a, t) => a.filter(x => x.type === t).reduce((s, x) => s + x.amt, 0);
const stats = (u, m) => { const t = u.tx.filter(x => x.d.startsWith(m)), i = sum(t, 'in'), e = sum(t, 'out'), p = i - e; return { t, i, e, p } };
const hx = async (p, s) => { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s + p)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('') };
const say = (f, t) => { f.querySelector('.m').textContent = t };
const go = v => { if (location.hash === '#' + v) render(); else location.hash = v };
const idle = () => { clearTimeout(tm); if (currentUser) tm = setTimeout(() => { currentUser = null; token = null; localStorage.removeItem('bl_tok'); go('login') }, 6e5) };
addEventListener('click', idle); addEventListener('keydown', idle);

const btn = (t, v, alt) => h('button', { class: alt ? 'alt' : '', onclick: () => go(v) }, t);
const card = (l, v) => h('div', { class: 'g' }, h('span', {}, l), h('b', {}, v));
const F = (l, n, t = 'text', o, opt, v) => { const a = { name: n, type: t }; if (!opt) a.required = ''; if (t === 'number') { a.step = 'any'; a.min = '0' } if (v !== undefined) a.value = v; return h('label', {}, l, o ? h('select', { name: n }, o.map(x => h('option', { value: x }, x))) : h('input', a)) };
const form = (k, fn, b) => { const f = h('form', { onsubmit: async e => { e.preventDefault(); await fn(Object.fromEntries(new FormData(f)), f) } }, k, h('p', { class: 'm' }), h('button', {}, b)); return f };
const tbl = (hd, rows) => h('div', { class: 'sc' }, h('table', {}, h('thead', {}, h('tr', {}, hd.map(x => h('th', {}, x)))), h('tbody', {}, rows.map(r => h('tr', {}, r.map(c => h('td', {}, c)))))));
const PN = ['Free', 'Starter', 'Business', 'Pro'];
const lock = (u, l, w) => u.plan >= l ? 0 : h('div', { class: 'g' }, h('h2', {}, w + ' needs the ' + PN[l] + ' plan'), h('p', {}, 'Upgrade to use this page.'), btn('See plans', 'plan'));
const pn9 = t => String(t).replace(/\D/g, '').slice(-9);

const doSignup = async (d, f) => {
  const em = d.email.trim().toLowerCase(), ph = pn9(d.phone);
  if (ph.length < 9) return say(f, 'Enter a valid phone number');
  if (d.pw.length < 6) return say(f, 'Password needs at least 6 characters');
  if (d.pw !== d.pw2) return say(f, 'Passwords do not match');
  if (d.reg === 'Formal' && !d.regno.trim()) return say(f, 'Enter your registration number');
  try {
    const res = await api('/signup', 'POST', d);
    token = res.token;
    localStorage.setItem('bl_tok', token);
    currentUser = res.user;
    idle();
    go('dash');
  } catch (err) {
    say(f, err.message);
  }
};

const doLogin = role => async (d, f) => {
  try {
    const res = await api('/login', 'POST', { email: d.email, pw: d.pw, role });
    token = res.token;
    localStorage.setItem('bl_tok', token);
    currentUser = res.user;
    idle();
    go(role === 'admin' ? 'admin' : 'dash');
  } catch (err) {
    say(f, err.message);
  }
};

const doSetup = async (d, f) => {
  if (d.pw.length < 10) return say(f, 'Password needs 10 or more characters');
  try {
    await api('/admin/setup', 'POST', { email: d.email, pw: d.pw });
    render();
  } catch (err) {
    say(f, err.message);
  }
};

const loginBox = role => h('div', { class: 'g narrow' }, h('h2', {}, role === 'admin' ? 'Admin log in' : 'Log in'), form([F('Email or phone number', 'email', 'text'), F('Password', 'pw', 'password')], doLogin(role), 'Log in'), role === 'user' ? h('p', {}, 'No account? ', h('a', { href: '#signup' }, 'Register your business')) : '');
const sv = (t, a = {}, ...c) => { const e = document.createElementNS('http://www.w3.org/2000/svg', t); for (const k in a) e.setAttribute(k, a[k]); c.flat().forEach(x => e.append(x)); return e };
const NW = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'], TW = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const words = n => n < 20 ? NW[n] : n < 100 ? TW[Math.floor(n / 10)] + (n % 10 ? ' ' + NW[n % 10] : '') : n < 1e3 ? NW[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + words(n % 100) : '') : n < 1e6 ? words(Math.floor(n / 1e3)) + ' thousand' + (n % 1e3 ? (n % 1e3 < 100 ? ' and ' : ' ') + words(n % 1e3) : '') : words(Math.floor(n / 1e6)) + ' million' + (n % 1e6 ? ' ' + words(n % 1e6) : '');
const spoken = t => t.replace(/(-?)R([\d,.\u00a0\u202f ]*\d)/g, (m, ng, q) => { const i = Math.max(q.lastIndexOf(','), q.lastIndexOf('.')), a = +q.slice(0, i).replace(/[^\d]/g, ''), c = +q.slice(i + 1); return (ng ? 'minus ' : '') + words(a) + ' rand' + (c ? ' and ' + words(c) + ' cents' : '') });
const pickVoice = () => { const v = speechSynthesis.getVoices().filter(x => /^en/i.test(x.lang)); return v.find(x => /natural|neural|online/i.test(x.name)) || v.find(x => /google|samantha|karen|aria|jenny|moira|serena/i.test(x.name)) || v.find(x => /en-ZA/i.test(x.lang)) || v[0] };
const speak = (t, done) => { try { speechSynthesis.cancel(); const p = spoken(t).split(/(?<=[.!?])\s+/).filter(Boolean), v = pickVoice(); p.forEach((x, i) => { const m = new SpeechSynthesisUtterance(x); if (v) m.voice = v; m.rate = .93; m.pitch = 1.02; if (i === p.length - 1) m.onend = m.onerror = () => done && done(); speechSynthesis.speak(m) }) } catch (e) { done && done() } };
const price = i => 'R' + appCfg.prices[i];
const verdict = s => s.p > 0 ? ['win', `You made a profit of ${R(s.p)} this month.`] : s.p < 0 ? ['lose', `You made a loss of ${R(-s.p)} this month. Your expenses are higher than your income.`] : ['', s.i ? 'You broke even this month.' : 'No records this month yet.'];
const voice = (u, t) => u.plan >= 3 ? h('button', { class: 'alt', onclick: () => speak(t) }, 'Listen') : h('p', { class: 'm' }, 'Voice over is on the Pro plan.');
const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const sp = p => {
  const n = p.length, dx = [], m = [], t = []; for (let i = 0; i < n - 1; i++) { dx[i] = p[i + 1][0] - p[i][0]; m[i] = (p[i + 1][1] - p[i][1]) / dx[i] }
  t[0] = m[0]; t[n - 1] = m[n - 2]; for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : 2 * m[i - 1] * m[i] / (m[i - 1] + m[i]);
  let d = `M${p[0][0]} ${p[0][1]}`; for (let i = 0; i < n - 1; i++) { const k = dx[i] / 3; d += ` C${p[i][0] + k} ${p[i][1] + t[i] * k} ${p[i + 1][0] - k} ${p[i + 1][1] - t[i + 1] * k} ${p[i + 1][0]} ${p[i + 1][1]}` } return d
};
const stat = (l, v) => h('div', { class: 'stat' }, h('small', {}, l), h('b', {}, v));
const plot = (ttl, LB, d, n, hl, bl, pr, fd) => {
  const A = d.concat(fd || []), E = A.map(a => a.e), P = A.map(a => a.p);
  const mx = Math.max(1, ...E, ...P), mi = Math.min(0, ...P), s0 = (mx - mi) / 4, pw = 10 ** Math.floor(Math.log10(s0)), st = [1, 2, 5, 10].map(k => k * pw).find(k => k >= s0), hi = Math.ceil(mx / st) * st, lo = Math.floor(mi / st) * st;
  const L = 62, Rt = 688, T = 26, B = 262, W = (Rt - L) / LB.length, x = i => L + (i + .5) * W, yy = v => B - (v - lo) / (hi - lo) * (B - T);
  const tk = [...Array(Math.round((hi - lo) / st) + 1)].map((_, i) => lo + i * st);
  const tx = (a, b, t, o = {}) => sv('text', { x: a, y: b, fill: 'rgba(255,255,255,.85)', 'font-size': 11, ...o }, t);
  const lab = v => Math.abs(v) >= 1000 ? +(v / 1000).toFixed(1) + 'k' : +v.toFixed(2);
  const ls = [[E.slice(0, n), '#e0b04a', 'ge'], [P.slice(0, n), '#5fd08b', 'gp']], fs = fd && fd.length ? [[E, '#e0b04a'], [P, '#5fd08b']] : [], pts = a => a.map((v, i) => [x(i), yy(v)]);
  const fz = fs.length ? [sv('rect', { x: x(n - 1) + W / 2, y: T, width: Rt - x(n - 1) - W / 2, height: B - T, fill: '#fff', 'fill-opacity': .05 }), tx(Rt - 4, T + 12, 'Forecast', { 'text-anchor': 'end', 'font-style': 'italic' }), ...fs.flatMap(([a, c]) => [sv('path', { d: sp(pts(a).slice(n - 1)), fill: 'none', stroke: c, 'stroke-width': 2, 'stroke-dasharray': '6 4' }), ...a.slice(n).map((v, i) => sv('circle', { cx: x(n + i), cy: yy(v), r: 3.5, fill: 'rgba(6,21,26,.9)', stroke: c, 'stroke-width': 1.5 }))])] : [];
  const defs = sv('defs', {}, ls.map(([a, c, id]) => sv('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 }, sv('stop', { offset: 0, 'stop-color': c, 'stop-opacity': .35 }), sv('stop', { offset: 1, 'stop-color': c, 'stop-opacity': 0 }))));
  const gd = sv('line', { y1: T, y2: B, stroke: 'rgba(255,255,255,.55)', 'stroke-dasharray': '4 3' }), ce = sv('circle', { r: 6, fill: 'none', stroke: '#e0b04a', 'stroke-width': 2 }), cp = sv('circle', { r: 6, fill: 'none', stroke: '#5fd08b', 'stroke-width': 2 });
  const tb = sv('rect', { width: 172, height: 80, rx: 6, fill: 'rgba(6,21,26,.94)', stroke: 'rgba(255,255,255,.4)' }), tt = [0, 1, 2, 3].map(k => sv('text', { x: 0, y: 0, fill: '#fff', 'font-size': 12, 'font-weight': k ? 400 : 700 }));
  const show = i => {
    const a = A[i], X = x(i), bx = X > 400 ? X - 184 : X + 12;
    gd.setAttribute('x1', X); gd.setAttribute('x2', X);
    [[ce, E[i]], [cp, P[i]]].forEach(([c, v]) => { c.setAttribute('cx', X); c.setAttribute('cy', yy(v)) });
    tb.setAttribute('x', bx); tb.setAttribute('y', T);
    [LB[i] + (i >= n ? ' (forecast)' : ''), 'Income ' + R(a.i), 'Expenses ' + R(a.e), (a.p < 0 ? 'Loss ' : 'Profit ') + R(Math.abs(a.p))].forEach((t, k) => { tt[k].setAttribute('x', bx + 10); tt[k].setAttribute('y', T + 18 + k * 17); tt[k].textContent = t })
  };
  const ov = sv('rect', { x: L, y: T, width: Rt - L, height: B - T, fill: 'transparent', style: 'touch-action:pan-y' });
  const mv = e => { const r = ov.getBoundingClientRect(); show(Math.max(0, Math.min(A.length - 1, Math.floor((e.clientX - r.left) / r.width * LB.length)))) };
  ov.addEventListener('pointermove', mv); ov.addEventListener('pointerdown', mv); ov.addEventListener('pointerleave', () => show(n - 1));
  show(n - 1);
  const I = d.reduce((a, v) => a + v.i, 0), X = d.reduce((a, v) => a + v.e, 0), yp = I - X, bi = P.slice(0, n).indexOf(Math.max(...P.slice(0, n)));
  return h('div', { class: 'g' }, h('h2', {}, ttl), h('div', { class: 'stats' }, stat('Total expenses', R(X)), stat(yp < 0 ? 'Total loss' : 'Total profit', R(Math.abs(yp))), stat('Profit margin', I ? Math.round(yp / I * 100) + '%' : 'No income yet'), stat('Best ' + bl, I || X ? LB[bi] + ' ' + R(P[bi]) : 'No records yet')),
    h('p', {}, h('span', { class: 'k1' }, 'Expenses'), ' ', h('span', { class: 'k2' }, 'Profit'), ' ', h('span', { class: 'k3' }, 'Loss'), ' ', h('small', {}, 'Hover or tap a month for the figures.')),
    h('div', { class: 'sc' }, sv('svg', { viewBox: '0 0 700 296', style: `min-width:${Math.max(560, LB.length * 34)}px;width:100%` }, defs,
      hl ? sv('rect', { x: x(n - 1) - W / 2, y: T, width: W, height: B - T, fill: '#fff', 'fill-opacity': .07 }) : '',
      tk.map(v => sv('line', { x1: L, x2: Rt, y1: yy(v), y2: yy(v), stroke: v === 0 ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.2)', 'stroke-dasharray': v === 0 ? '' : '3 4' })),
      tk.map(v => tx(L - 8, yy(v) + 4, 'R' + lab(v), { 'text-anchor': 'end' })),
      tx(L - 8, T - 10, 'Rand', { 'text-anchor': 'end', 'font-style': 'italic' }),
      LB.map((m, i) => tx(x(i), B + 20, m, { 'text-anchor': 'middle', opacity: i < A.length ? 1 : .4 })),
      n > 1 ? ls.map(([a, c, id]) => sv('path', { d: sp(pts(a)) + ` L${x(n - 1)} ${yy(0)} L${x(0)} ${yy(0)} Z`, fill: `url(#${id})` })) : '',
      n > 1 ? ls.map(([a, c]) => sv('path', { d: sp(pts(a)), fill: 'none', stroke: c, 'stroke-width': 2.5, 'stroke-linecap': 'round' })) : '',
      ls.flatMap(([a, c]) => a.map((v, i) => sv('circle', { cx: x(i), cy: yy(v), r: 3.5, fill: c === '#5fd08b' && v < 0 ? '#ff7a6b' : c, stroke: 'rgba(6,21,26,.9)', 'stroke-width': 1.5 }))),
      fz, gd, ce, cp, tb, tt, ov)),
    h('p', { class: 'v ' + (yp > 0 ? 'win' : yp < 0 ? 'lose' : '') }, yp > 0 ? `${pr} you are in profit by ${R(yp)}.` : yp < 0 ? `${pr} you are at a loss of ${R(-yp)}.` : 'No profit or loss recorded yet.'))
};
const chart = (u, y) => { const n = y === month().slice(0, 4) ? +month().slice(5, 7) : 12; return plot('Expenses and profit in ' + y, MN, [...Array(n)].map((_, i) => stats(u, `${y}-${String(i + 1).padStart(2, '0')}`)), n, y === month().slice(0, 4), 'month', 'This year so far') };
const AB = () => [['What is Inno-Verse', 'A digital platform where small businesses record daily sales, expenses and stock. At month end it calculates your profit or loss, and at year end it generates your annual financial statements for you.'], ['Who it is for', TYPES.join(', ') + '. Formal and informal businesses are welcome.'], ['What you get', 'Daily records, stock taking with the profit you will make, budget and cost analysis, a graph of expenses and profit, annual statements, a payment QR code and voice over.'], ['Plans', PN.map((n, i) => n + ' ' + price(i)).join(', ') + ' per month.'], ['Not a bank', 'Inno-Verse is a bookkeeping platform. It does not hold your money.']];
const today = () => new Date().toLocaleDateString('sv');
let chat = [];
const LX = {
  today: /today|vandag|namhlanje|lehono|namusi|namuntlha/, yest: /yesterday|gister|izolo|maabane|mulovha|\btolo\b/, week: /week|isonto|beke/, month: /month|maand|inyanga|kgwedi/, year: /year|annual|jaar|unyaka|ngwaga/, last: /last|previous|past|laaste|verlede|odlule|go feta/,
  profit: /profit|loss|\bmade\b|\bmake\b|making|doing well|how am i doing|how is (my )?business|\bwins\b|verlies|inzuzo|ilahleko|poelo|tahlegelo|\bnet\b/,
  income: /income|sales|\bsold\b|\bsell\b|revenue|earn|takings|turnover|inkomste|verkope|verkoop|imali engenayo|ukuthengisa|dithekišo|letseno/,
  exp: /expens|spend|spent|cost|bills|outgoing|uitgawe|koste|izindleko|ditshenyegelo/, most: /most|highest|biggest|\btop\b|worst|meeste|duurste|kakhulu|kgolo/,
  goal: /goal|target|doel|inhloso|nepo/, budget: /budget|begroting|isabelomali|tekanyetšo/, stock: /stock|inventory|voorraad|isitoko|setoko/,
  low: /\blow\b|running out|run out|reorder|restock|almost finished/, best: /best.?sell|popular|sells the most|most sold|top seller/, fore: /forecast|predict|projection|next (week|month)|will i|voorspel|verwag/,
  avg: /average|per day|gemiddeld/, cmp: /compare|versus|\bvs\b|better than|worse than|than last|growth/, margin: /margin/,
  tips: /\btips?\b|advice|improve|increase profit|make more|save money|advise|suggest|grow my/, plan: /\bplan\b|upgrade|subscri|starter|pro plan/,
  how: /how (do|can|to|should)|where (do|can)|show me how/, hi: /^(hi|hello|hey|howzit|sawubona|dumela|hallo|molo)\b|good (morning|afternoon|evening)/,
  thanks: /thank|siyabonga|dankie|ke a leboga|cheers/, what: /who are you|what are you|what can you|can you do|^help\b|what is inno/
};
const CATQ = [[/rent/, 'Rent'], [/wage
