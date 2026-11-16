// Logique API partagée (Vercel + local). Stockage injecté via "store".
const crypto = require('crypto');

const ADMIN_PIN = () => (process.env.ADMIN_PIN || 'speedcore').trim();
const SECRET = () => process.env.SESSION_SECRET || ('sc-' + ADMIN_PIN());
const rid = () => crypto.randomBytes(6).toString('hex');
const clean = (s, max = 80) => String(s ?? '').trim().slice(0, max);

function send(res, code, body, headers = {}) {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(code, { 'Content-Type': isObj ? 'application/json' : 'text/plain', 'Cache-Control': 'no-store', ...headers });
  res.end(isObj ? JSON.stringify(body) : body);
}

async function readBody(req) {
  if (req.body !== undefined && req.body !== null && req.body !== '') {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return chunks.length ? JSON.parse(Buffer.concat(chunks)) : {};
}

// Session sans état (compatible serverless) : "expiration.signature"
const sign = exp => crypto.createHmac('sha256', SECRET()).update(String(exp)).digest('hex');
function makeToken() { const exp = Date.now() + 12 * 3600e3; return `${exp}.${sign(exp)}`; }
function isAdmin(req) {
  return true; // accès entreprise sans code (choix du propriétaire)
}
function isAdminWithCode(req) {
  const m = /(?:^|;\s*)sc_admin=(\d+)\.([a-f0-9]+)/.exec(req.headers.cookie || '');
  if (!m || Number(m[1]) < Date.now()) return false;
  const a = Buffer.from(m[2]), b = Buffer.from(sign(m[1]));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Identifiant d'appareil : cookie posé par le serveur (impossible à falsifier côté page)
function device(req) {
  const m = /(?:^|;\s*)sc_dev=([a-f0-9]{24})/.exec(req.headers.cookie || '');
  if (m) return { id: m[1], headers: {} };
  const id = crypto.randomBytes(12).toString('hex');
  return { id, headers: { 'Set-Cookie': `sc_dev=${id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000` } };
}
const ipHash = req => {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'x';
  return crypto.createHash('sha256').update(ip + SECRET()).digest('hex').slice(0, 24);
};
const voteRules = db => (db.settings?.voteMode === 'cooldown')
  ? { mode: 'cooldown', cooldownMs: 15000, ipMax: 0 }
  : { mode: 'once', cooldownMs: 0, ipMax: 40 };

const publicParticipants = db => db.participants.map(p => ({
  id: p.id, name: `${p.firstName} ${p.lastName.charAt(0).toUpperCase()}.`, tickets: p.tickets,
}));

async function handle(req, res, store) {
  const url = new URL(req.url, 'http://x');
  const path = url.pathname.replace(/\/+$/, '');
  const route = `${req.method} ${path}`;
  let m;

  try {
    // ---------- public ----------
    if (route === 'GET /api/tombola') {
      const db = await store.load();
      const d = db.draw;
      const w = d && { name: d.name, at: d.at, seq: d.seq, tickets: d.tickets, total: d.total };
      return send(res, 200, { now: Date.now(), participants: publicParticipants(db), winner: w || null });
    }
    if (route === 'GET /api/contest') {
      const db = await store.load();
      const votes = await store.votes();
      const dev = device(req), rules = voteRules(db);
      const voted = rules.mode === 'once' ? await store.voterCar(dev.id) : null;
      return send(res, 200, { voteMode: rules.mode, voted, cars: db.cars.map(c => ({ id: c.id, owner: c.owner, model: c.model, photo: c.photo, votes: votes[c.id] || 0 })) }, dev.headers);
    }
    if (route === 'POST /api/vote') {
      const { carId } = await readBody(req);
      const db = await store.load();
      if (!db.cars.some(c => c.id === carId)) return send(res, 404, { error: 'Voiture introuvable' });
      const dev = device(req);
      const r = await store.castVote(carId, dev.id, ipHash(req), voteRules(db));
      return send(res, r.ok ? 200 : 429, r, dev.headers);
    }
    if ((m = /^\/api\/photo\/(\w+)$/.exec(path)) && req.method === 'GET') {
      const p = await store.getPhoto(m[1]);
      if (!p) return send(res, 404, 'Not found');
      res.writeHead(200, { 'Content-Type': p.mime, 'Cache-Control': 'public, max-age=31536000, immutable' });
      return res.end(p.buf);
    }

    // ---------- auth ----------
    if (route === 'POST /api/admin/login') {
      const { pin } = await readBody(req);
      if (String(pin).trim() !== ADMIN_PIN()) return send(res, 401, { error: 'Code incorrect' });
      return send(res, 200, { ok: true }, { 'Set-Cookie': `sc_admin=${makeToken()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200` });
    }
    if (route === 'POST /api/admin/logout') {
      return send(res, 200, { ok: true }, { 'Set-Cookie': 'sc_admin=; Path=/; Max-Age=0' });
    }

    if (!path.startsWith('/api/admin/')) return send(res, 404, { error: 'Not found' });
    if (!isAdmin(req)) return send(res, 401, { error: 'Connexion requise' });

    // ---------- admin ----------
    if (route === 'GET /api/admin/state') {
      const db = await store.load(); const votes = await store.votes();
      return send(res, 200, { participants: db.participants, cars: db.cars.map(c => ({ ...c, votes: votes[c.id] || 0 })), draw: db.draw, settings: { voteMode: db.settings?.voteMode || 'once' } });
    }
    if (route === 'POST /api/admin/participants') {
      const b = await readBody(req); const db = await store.load();
      const p = { id: rid(), firstName: clean(b.firstName), lastName: clean(b.lastName), phone: clean(b.phone, 30), tickets: Math.max(1, Math.min(999, parseInt(b.tickets, 10) || 1)) };
      if (!p.firstName || !p.lastName) return send(res, 400, { error: 'Nom et prénom requis' });
      db.participants.push(p); await store.save(db); return send(res, 200, p);
    }
    if ((m = /^\/api\/admin\/participants\/(\w+)$/.exec(path))) {
      const db = await store.load(); const i = db.participants.findIndex(p => p.id === m[1]);
      if (i < 0) return send(res, 404, { error: 'Introuvable' });
      if (req.method === 'DELETE') { db.participants.splice(i, 1); await store.save(db); return send(res, 200, { ok: true }); }
      if (req.method === 'PUT') {
        const b = await readBody(req); const p = db.participants[i];
        p.firstName = clean(b.firstName) || p.firstName; p.lastName = clean(b.lastName) || p.lastName;
        p.phone = clean(b.phone, 30); p.tickets = Math.max(1, Math.min(999, parseInt(b.tickets, 10) || 1));
        await store.save(db); return send(res, 200, p);
      }
    }
    if (route === 'POST /api/admin/draw') {
      const db = await store.load(); const pool = db.participants;
      const total = pool.reduce((s, p) => s + p.tickets, 0);
      if (!total) return send(res, 400, { error: 'Aucun participant' });
      let r = crypto.randomInt(total), win = pool[0];
      for (const p of pool) { if (r < p.tickets) { win = p; break; } r -= p.tickets; }
      db.draw = { seq: Date.now(), at: Date.now(), tickets: win.tickets, total, id: win.id, name: `${win.firstName} ${win.lastName.charAt(0).toUpperCase()}.`, fullName: `${win.firstName} ${win.lastName}`, phone: win.phone };
      await store.save(db); return send(res, 200, db.draw);
    }
    if (route === 'POST /api/admin/draw/reset') { const db = await store.load(); db.draw = null; await store.save(db); return send(res, 200, { ok: true }); }

    if (route === 'POST /api/admin/cars') {
      const b = await readBody(req); const db = await store.load();
      const owner = clean(b.owner);
      if (!owner || !/^data:image\/(jpeg|png|webp);base64,/.test(b.photo || '')) return send(res, 400, { error: 'Propriétaire et photo requis' });
      const car = { id: rid(), owner, model: clean(b.model), photo: '' };
      car.photo = `/api/photo/${car.id}`;
      await store.putPhoto(car.id, b.photo);
      db.cars.push(car); await store.save(db); return send(res, 200, car);
    }
    if ((m = /^\/api\/admin\/cars\/(\w+)$/.exec(path)) && req.method === 'DELETE') {
      const db = await store.load(); const i = db.cars.findIndex(c => c.id === m[1]);
      if (i < 0) return send(res, 404, { error: 'Introuvable' });
      db.cars.splice(i, 1); await store.save(db); await store.delPhoto(m[1]); await store.delVote(m[1]);
      return send(res, 200, { ok: true });
    }
    if (route === 'POST /api/admin/settings') {
      const b = await readBody(req); const db = await store.load();
      db.settings = { ...(db.settings || {}), voteMode: b.voteMode === 'cooldown' ? 'cooldown' : 'once' };
      await store.save(db); return send(res, 200, db.settings);
    }
    if (route === 'POST /api/admin/votes/reset') { await store.resetVotes(); return send(res, 200, { ok: true }); }

    return send(res, 404, { error: 'Not found' });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'Erreur serveur : ' + e.message });
  }
}

module.exports = { handle };
