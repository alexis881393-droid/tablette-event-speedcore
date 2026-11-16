/* Speedcore Auto : interface client (tombola, concours, classement en direct) */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mem = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch {} };

async function getJSON(url) {
  const r = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
function anim(dur, fn) {
  return new Promise(res => {
    const t0 = performance.now();
    (function f(now) {
      const t = Math.min(1, (now - t0) / dur); fn(t);
      t < 1 ? requestAnimationFrame(f) : res();
    })(t0);
  });
}

/* ================= SON (WebAudio, rien à télécharger) ================= */
let actx = null, soundOn = mem.get('sc_snd', '1') === '1', lastTick = 0;
function ac() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} }
  if (actx && actx.state === 'suspended') actx.resume();
  return actx;
}
addEventListener('pointerdown', () => { if (soundOn) ac(); }, { passive: true });
function tone({ f = 440, f2, t = .1, type = 'sine', v = .15, at = 0 }) {
  if (!soundOn) return; const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime + at;
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + t);
  g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + .008); g.gain.exponentialRampToValueAtTime(.0001, t0 + t);
  o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + t + .03);
}
const sfx = {
  tick(k = 0) { const n = performance.now(); if (n - lastTick < 45) return; lastTick = n; tone({ f: 620 + k * 520, t: .035, type: 'square', v: .04 }); },
  beep() { tone({ f: 520, t: .18, v: .22 }); },
  go() { tone({ f: 880, t: .4, type: 'square', v: .1 }); tone({ f: 1320, t: .4, v: .14 }); },
  beat() { tone({ f: 80, f2: 38, t: .2, v: .6 }); tone({ f: 80, f2: 38, t: .2, v: .45, at: .2 }); },
  win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ f, t: .55, type: 'triangle', v: .17, at: i * .09 })); tone({ f: 100, f2: 40, t: .7, v: .7 }); },
  vote() { tone({ f: 520, f2: 1040, t: .13, v: .2 }); },
  nav() { tone({ f: 700, t: .04, type: 'triangle', v: .06 }); },
};
function syncSoundBtn() {
  const b = $('#snd'); b.setAttribute('aria-pressed', soundOn);
  b.innerHTML = `<i class="ph ph-speaker-${soundOn ? 'high' : 'slash'}"></i>`;
}
$('#snd').addEventListener('click', () => { soundOn = !soundOn; mem.set('sc_snd', soundOn ? '1' : '0'); syncSoundBtn(); if (soundOn) { ac(); sfx.nav(); } });
syncSoundBtn();

/* ================= CONFETTIS ================= */
const fx = $('#fx'), cx = fx.getContext('2d');
let parts = [], fxRaf = 0;
function sizeFx() { const d = Math.min(devicePixelRatio || 1, 2); fx.width = innerWidth * d; fx.height = innerHeight * d; cx.setTransform(d, 0, 0, d, 0, 0); }
addEventListener('resize', sizeFx); sizeFx();
const COLORS = ['#3b7bff', '#7ea5ff', '#e8b878', '#f6dfba', '#ffffff', '#c18d58'];
function burst(x, y, n, angle, spread, power) {
  for (let i = 0; i < n; i++) {
    const a = angle + (Math.random() - .5) * spread, s = power * (.45 + Math.random() * .75);
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, w: 6 + Math.random() * 7, h: 4 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: COLORS[(Math.random() * COLORS.length) | 0] });
  }
  if (!fxRaf) fxRaf = requestAnimationFrame(fxLoop);
}
function fxLoop() {
  cx.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter(p => p.y < innerHeight + 40);
  for (const p of parts) {
    p.vy += .36; p.vx *= .992; p.x += p.vx; p.y += p.vy; p.r += p.vr;
    cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.fillStyle = p.c; cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); cx.restore();
  }
  fxRaf = parts.length ? requestAnimationFrame(fxLoop) : 0;
  if (!parts.length) cx.clearRect(0, 0, innerWidth, innerHeight);
}
async function confettiShow() {
  if (reduced) return;
  const w = innerWidth, h = innerHeight;
  for (let k = 0; k < 4; k++) {
    burst(0, h, 70, -Math.PI / 3, .8, 26); burst(w, h, 70, -Math.PI * 2 / 3, .8, 26); burst(w / 2, h * .9, 60, -Math.PI / 2, 1.2, 30);
    await sleep(420);
  }
  for (let k = 0; k < 6; k++) { burst(Math.random() * w, -10, 30, Math.PI / 2, .6, 5); await sleep(260); }
}

/* ================= ONGLETS ================= */
const TABS = ['tombola', 'concours', 'classement'];
let tab = 'tombola';
function show(name, silent) {
  if (!TABS.includes(name)) name = 'tombola';
  tab = name;
  TABS.forEach(t => { $('#' + t).hidden = t !== name; });
  document.querySelectorAll('.dock button').forEach(b => {
    if (b.dataset.tab === name) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  mem.set('sc_tab', name);
  if (name !== 'tombola') loadCars();
  if (name === 'tombola') drawReel(reelP);
  if (!silent) sfx.nav();
  scrollTo({ top: 0 });
}
document.querySelectorAll('.dock button').forEach(b => b.addEventListener('click', () => show(b.dataset.tab)));

/* ================= TOMBOLA : ROULEAU ================= */
let participants = [], winner = null, lastSeq = null, busy = false;
let reelMode = 'idle'; // idle | static | draw
let reelP = 0, H = 78;
const reel = $('#reel'), wrap = $('#reelWrap'), drawBox = $('#draw'), statusEl = $('#status');
const rows = Array.from({ length: 6 }, () => { const d = document.createElement('div'); d.className = 'ri'; reel.appendChild(d); return d; });
function measure() { H = wrap.clientHeight / 3 || 78; }
addEventListener('resize', () => { measure(); drawReel(reelP); }); measure();

const idleName = i => {
  const n = participants.map(p => p.name);
  return n.length ? n[((i % n.length) + n.length) % n.length] : 'En attente';
};
let nameFn = idleName;

function drawReel(p) {
  reelP = p;
  const base = Math.floor(p) - 2;
  for (let k = 0; k < 6; k++) {
    const i = base + k, el = rows[k], d = Math.abs(i - p);
    el.style.transform = `translateY(${(i - p + 1) * H}px) scale(${1 - Math.min(d, 1.6) * .11})`;
    el.style.opacity = Math.max(.16, 1 - d * .58);
    const t = nameFn(i);
    if (el._t !== t) { el.textContent = t; el._t = t; }
    el.classList.toggle('on', d < .5);
  }
}

let lastFrame = performance.now();
function idleLoop(now) {
  const dt = Math.min(.1, (now - lastFrame) / 1000); lastFrame = now;
  if (reelMode === 'idle' && tab === 'tombola' && !document.hidden && participants.length > 1) drawReel(reelP + dt * .5);
  requestAnimationFrame(idleLoop);
}
requestAnimationFrame(idleLoop);

function setStatus(t, hot) { statusEl.textContent = t; statusEl.classList.toggle('hot', !!hot); }

/* ---------- chiffres animés ---------- */
const shown = { count: 0, tickets: 0 };
function countTo(id, key, to) {
  if (shown[key] === to) return;
  const from = shown[key]; shown[key] = to;
  anim(reduced ? 1 : 600, t => { $(id).textContent = Math.round(from + (to - from) * t); });
}
function renderStats() {
  countTo('#count', 'count', participants.length);
  countTo('#tickets', 'tickets', participants.reduce((s, p) => s + p.tickets, 0));
}
function renderChips() {
  $('#chips').innerHTML = participants.length
    ? participants.map(p => `<span class="chip${winner && winner.name === p.name && !busy ? ' win' : ''}">${esc(p.name)}<em>x${p.tickets}</em></span>`).join('')
    : '<div class="empty">Les participants apparaissent ici dès qu\'ils sont inscrits.</div>';
}

function applyIdleStatus() {
  if (winner) { setStatus('Dernier gagnant : ' + winner.name, true); return; }
  setStatus(participants.length ? 'Le tirage va bientôt commencer' : 'Aucun participant pour l\'instant');
}
function setStatic(w) {
  reelMode = 'static'; winner = w;
  nameFn = i => i === 0 ? w.name : idleName(i + 7);
  drawReel(0); applyIdleStatus();
}

/* ---------- le tirage ---------- */
async function countdown() {
  const box = $('#cd'), n = $('#cdN'); box.hidden = false;
  for (const d of ['3', '2', '1', 'GO']) {
    n.textContent = d; n.classList.toggle('go', d === 'GO');
    n.style.animation = 'none'; void n.offsetWidth; n.style.animation = '';
    if (d === 'GO') { sfx.go(); buzz([30, 40, 60]); } else { sfx.beep(); buzz(18); }
    await sleep(d === 'GO' ? 650 : 880);
  }
  box.hidden = true;
}

function buildSequence(w, T) {
  const total = participants.reduce((s, p) => s + p.tickets, 0) || 1;
  const pick = () => { let r = Math.random() * total; for (const p of participants) { if ((r -= p.tickets) < 0) return p.name; } return w.name; };
  const seq = [];
  for (let i = 0; i < T + 8; i++) {
    let n = pick(), g = 0;
    while (g++ < 8 && (n === seq[i - 1] || (i >= T - 1 && i <= T + 1 && n === w.name))) n = pick();
    seq.push(n);
  }
  seq[T] = w.name;
  return seq;
}

async function runDraw(w) {
  busy = true; reelMode = 'draw'; winner = null;
  show('tombola', true); renderChips();
  const T = 58, seq = buildSequence(w, T);
  nameFn = i => (i >= 0 && seq[i] !== undefined) ? seq[i] : idleName(i);
  drawReel(0);
  setStatus('Attention, ça va partir', true);
  await countdown();

  // phase 1 : le rouleau part vite et ralentit
  drawBox.classList.add('spin');
  const P1 = T - 1; let said = 0;
  await anim(reduced ? 500 : 7600, t => {
    drawReel(P1 * (1 - Math.pow(1 - t, 3.7)));
    sfx.tick(1 - t);
    if (t > .3 && said < 1) { said = 1; setStatus('Ça ralentit'); }
    if (t > .62 && said < 2) { said = 2; setStatus('Qui va être tiré ?', true); $('#tension').classList.add('on'); }
  });

  // phase 2 : arrêt sur le voisin, battements de coeur (le faux arrêt qui fait monter la tension)
  drawBox.classList.remove('spin'); drawBox.classList.add('final');
  setStatus('Ce n\'est pas fini', true);
  if (!reduced) { sfx.beat(); buzz([60, 60, 90]); await sleep(650); sfx.beat(); buzz([60, 60, 90]); await sleep(750); }

  // phase 3 : un dernier cran lent jusqu'au gagnant
  await anim(reduced ? 300 : 1900, t => {
    drawReel(P1 + (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2));
    if (t > .5 && t < .53) sfx.tick(.6);
  });
  drawReel(T);

  // révélation
  $('#tension').classList.remove('on'); drawBox.classList.remove('final');
  const fl = $('#flash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
  document.body.classList.add('shake'); setTimeout(() => document.body.classList.remove('shake'), 600);
  sfx.win(); buzz([120, 60, 120, 60, 260]);
  winner = w;
  showWinner(w); confettiShow();
}

function showWinner(w) {
  $('#wName').innerHTML = [...w.name].map((ch, i) => `<span style="--i:${i}">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('');
  $('#wMeta').textContent = w.tickets && w.total
    ? `${w.tickets} ticket${w.tickets > 1 ? 's' : ''} sur ${w.total}, soit ${Math.max(1, Math.round(w.tickets / w.total * 100))}% de chances`
    : 'Félicitations !';
  $('#win').hidden = false;
  setTimeout(() => $('#wClose').focus(), 400);
}
$('#wClose').addEventListener('click', () => {
  $('#win').hidden = true; busy = false; sfx.nav();
  if (winner) setStatic(winner);
  renderChips();
});

/* ---------- sondage de la tombola ---------- */
async function pollTombola() {
  if (document.hidden) return;
  try {
    const d = await getJSON('/api/tombola');
    participants = d.participants;
    renderStats();
    if (busy) return;
    const w = d.winner;
    if (!w) {
      if (winner || reelMode === 'static') { winner = null; reelMode = 'idle'; nameFn = idleName; }
      lastSeq = 0; applyIdleStatus(); renderChips(); return;
    }
    if (w.seq !== lastSeq) {
      const first = lastSeq === null, age = d.now - w.at;
      lastSeq = w.seq; winner = w;
      if (!first && age < 30000) { runDraw(w); return; }
      setStatic(w);
    }
    renderChips();
  } catch {}
}

/* ================= CONCOURS + CLASSEMENT ================= */
let cars = [], voteLock = false, prevVotes = {}, voteMode = 'once', votedCar = null;
async function loadCars() {
  try {
    const d = await getJSON('/api/contest');
    cars = d.cars.map(c => ({ ...c, votes: c.votes || 0 }));
    voteMode = d.voteMode || 'once'; votedCar = d.voted || null;
    renderCars(); renderRank();
  } catch {
    if (!$('#cars').children.length) $('#cars').innerHTML = '<div class="empty">Chargement impossible. La liste se rafraîchit toute seule.</div>';
  }
}
const rankOf = () => { const m = {}; [...cars].sort((a, b) => b.votes - a.votes).forEach((c, i) => { m[c.id] = i + 1; }); return m; };

function renderCars() {
  const box = $('#cars'), sig = cars.map(c => c.id + c.photo).join('|');
  if (box.dataset.sig !== sig) {
    box.dataset.sig = sig;
    box.innerHTML = cars.length ? cars.map(c => `
      <article class="car" data-id="${c.id}">
        <div class="ph">
          <img src="${esc(c.photo)}" alt="Voiture de ${esc(c.owner)}" loading="lazy">
          <span class="pill rk"></span><span class="pill vt"><i class="ph-fill ph-fire"></i><b></b></span>
          <div class="meta"><div class="owner">${esc(c.owner)}</div>${c.model ? `<div class="model">${esc(c.model)}</div>` : ''}</div>
        </div>
        <div class="vote-row"><button class="vote" aria-label="Voter pour la voiture de ${esc(c.owner)}"><i class="ph-fill ph-fire"></i><span>Voter</span></button></div>
      </article>`).join('') : '<div class="empty">Le concours démarre bientôt : les voitures arrivent.</div>';
  }
  const rk = rankOf();
  box.querySelectorAll('.car').forEach(el => {
    const c = cars.find(x => x.id === el.dataset.id); if (!c) return;
    el.querySelector('.rk').textContent = '#' + rk[c.id];
    el.querySelector('.vt b').textContent = c.votes;
    const b = el.querySelector('.vote'), lab = b.querySelector('span');
    if (voteMode === 'once' && votedCar) {
      b.disabled = true; b.classList.toggle('done', c.id === votedCar);
      lab.textContent = c.id === votedCar ? 'Ton vote' : 'Vote déjà fait';
    } else if (!voteLock) { b.disabled = false; b.classList.remove('done'); lab.textContent = 'Voter'; }
  });
}

let toastT = 0;
function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3200);
}

$('#cars').addEventListener('click', async e => {
  const btn = e.target.closest('.vote'); if (!btn || btn.disabled || voteLock) return;
  const card = btn.closest('.car'), c = cars.find(x => x.id === card.dataset.id); if (!c) return;
  voteLock = true; btn.disabled = true; btn.querySelector('span').textContent = 'Envoi';
  let r;
  try {
    const res = await fetch('/api/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ carId: c.id }) });
    r = await res.json();
  } catch { r = { ok: false, reason: 'net' }; }

  if (r.ok) {
    sfx.vote(); buzz(25);
    c.votes++; if (voteMode === 'once') votedCar = c.id;
    btn.classList.add('done'); btn.querySelector('span').textContent = 'Merci !';
    const b = btn.getBoundingClientRect(), pl = document.createElement('span');
    pl.className = 'plus'; pl.textContent = '+1'; pl.style.left = (b.left + b.width / 2 - 14) + 'px'; pl.style.top = (b.top - 10) + 'px'; pl.style.position = 'fixed';
    document.body.appendChild(pl); setTimeout(() => pl.remove(), 1000);
    if (!reduced) burst(b.left + b.width / 2, b.top, 22, -Math.PI / 2, 1.6, 11);
    renderRank();
  } else {
    buzz([40, 50, 40]);
    if (r.reason === 'already') { votedCar = r.voted || votedCar || c.id; toast('Tu as déjà voté. Merci !'); }
    else if (r.reason === 'wait') toast('Patiente ' + Math.ceil((r.retryMs || 15000) / 1000) + ' s avant de revoter.');
    else if (r.reason === 'ip') toast('Trop de votes depuis cette connexion.');
    else toast('Vote non envoyé, réessaie.');
  }
  setTimeout(() => { voteLock = false; loadCars(); }, r.ok ? 1400 : 300);
});

/* ---------- classement ---------- */
function renderRank() {
  const sorted = [...cars].sort((a, b) => b.votes - a.votes);
  const total = sorted.reduce((s, c) => s + c.votes, 0), leader = sorted[0]?.votes || 0;
  $('#totalVotes').textContent = total;
  const sig = sorted.map(c => c.id + ':' + c.votes).join('|');
  if (renderRank.sig === sig) return;
  renderRank.sig = sig;

  const podium = $('#podium');
  if (!sorted.length) { podium.innerHTML = '<div class="empty" style="grid-column:1/-1">Aucune voiture inscrite pour l\'instant.</div>'; $('#rows').innerHTML = ''; return; }
  const slot = (c, r) => c ? `
    <div class="pod r${r}">
      <div class="face">${r === 1 ? '<i class="ph-fill ph-crown-simple crown"></i>' : ''}<img src="${esc(c.photo)}" alt="Voiture de ${esc(c.owner)}"></div>
      <div class="nm">${esc(c.owner)}</div>
      <div class="pv${prevVotes[c.id] !== undefined && prevVotes[c.id] !== c.votes ? ' bump' : ''}"><b>${c.votes}</b> vote${c.votes > 1 ? 's' : ''}</div>
      <div class="step">${r}</div>
    </div>` : '<div></div>';
  podium.innerHTML = slot(sorted[1], 2) + slot(sorted[0], 1) + slot(sorted[2], 3);

  // lignes 4+ avec animation de changement de place (FLIP)
  const list = $('#rows'), before = {};
  list.querySelectorAll('.row').forEach(r => { before[r.dataset.id] = r.getBoundingClientRect().top; });
  list.innerHTML = sorted.slice(3).map((c, i) => `
    <div class="row" data-id="${c.id}">
      <div class="n">${i + 4}</div><img src="${esc(c.photo)}" alt="">
      <div style="min-width:0"><div class="nm">${esc(c.owner)}</div><div class="bar2"><i style="width:${leader ? Math.max(4, c.votes / leader * 100) : 4}%"></i></div></div>
      <div class="v">${c.votes}</div>
    </div>`).join('');
  if (!reduced) list.querySelectorAll('.row').forEach(r => {
    const old = before[r.dataset.id]; if (old === undefined) return;
    const dy = old - r.getBoundingClientRect().top; if (!dy) return;
    r.style.transition = 'none'; r.style.transform = `translateY(${dy}px)`;
    requestAnimationFrame(() => requestAnimationFrame(() => { r.style.transition = ''; r.style.transform = ''; }));
  });
  prevVotes = Object.fromEntries(cars.map(c => [c.id, c.votes]));
}

/* ================= DÉMARRAGE ================= */
let tickN = 0;
setInterval(() => {
  if (document.hidden) return; tickN++;
  pollTombola();
  if ((tab !== 'tombola' && tickN % 2 === 0) || tickN % 6 === 0) loadCars();
}, 2000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { pollTombola(); loadCars(); } });

show(location.hash.slice(1) || mem.get('sc_tab', 'tombola'), true);
pollTombola(); loadCars();
