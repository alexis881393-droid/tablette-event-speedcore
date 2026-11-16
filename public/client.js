const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- onglets ----------
const tabs = { tombola: $('#t-tombola'), concours: $('#t-concours') };
function show(name) {
  if (name === 'concours' && typeof loadCars === 'function') loadCars();
  for (const [k, btn] of Object.entries(tabs)) {
    btn.setAttribute('aria-selected', k === name);
    $('#' + k).hidden = k !== name;
  }
  try { localStorage.setItem('sc_tab', name); } catch {}
}
Object.entries(tabs).forEach(([k, b]) => b.addEventListener('click', () => show(k)));
try { show(localStorage.getItem('sc_tab') === 'concours' ? 'concours' : 'tombola'); } catch {}

// ---------- tombola ----------
let participants = [], lastSeq = null, spinning = false, winnerName = null;

function renderChips() {
  $('#count').textContent = participants.length;
  $('#tickets').textContent = participants.reduce((s, p) => s + p.tickets, 0);
  $('#chips').innerHTML = participants.length
    ? participants.map(p => `<div class="chip${p.name === winnerName ? ' winner' : ''}"><span>${esc(p.name)}</span><span class="n">${p.tickets} ticket${p.tickets > 1 ? 's' : ''}</span></div>`).join('')
    : '<div class="empty">Aucun participant pour le moment.</div>';
}

function spinTo(name, done) {
  const roll = $('#roll'); const pool = participants.map(p => p.name);
  $('#stageLabel').textContent = 'Tirage en cours…';
  roll.className = 'roll display spin';
  spinning = true;
  let i = 0, delay = 60;
  const total = reduced ? 1 : 28;
  (function step() {
    if (i >= total) {
      roll.textContent = name; roll.className = 'roll display win bronze';
      $('#stageLabel').textContent = 'Le gagnant est';
      winnerName = name; spinning = false; renderChips(); done && done(); return;
    }
    roll.textContent = pool[Math.floor(Math.random() * pool.length)] || name;
    i++; delay *= 1.09; setTimeout(step, delay);
  })();
}

async function pollTombola() {
  try {
    const d = await (await fetch('/api/tombola')).json();
    participants = d.participants;
    if (!spinning) {
      if (!d.winner) {
        winnerName = null; lastSeq = 0;
        $('#roll').textContent = '?'; $('#roll').className = 'roll display';
        $('#stageLabel').textContent = 'En attente du tirage';
        renderChips();
      } else if (d.winner.seq !== lastSeq) {
        const fresh = lastSeq !== null && Date.now() - d.winner.at < 15000;
        lastSeq = d.winner.seq;
        if (fresh) spinTo(d.winner.name);
        else { winnerName = d.winner.name; $('#roll').textContent = d.winner.name; $('#roll').className = 'roll display bronze'; $('#stageLabel').textContent = 'Le gagnant est'; renderChips(); }
      } else renderChips();
    }
  } catch {}
}

// ---------- concours ----------
let voteLock = false;
async function loadCars() {
  try {
    const r = await fetch('/api/contest?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const { cars } = await r.json();
    const box = $('#cars');
    const sig = JSON.stringify(cars);
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig;
    box.innerHTML = cars.length ? cars.map(c => `
      <button class="car" data-id="${c.id}" aria-label="Voter pour la voiture de ${esc(c.owner)}">
        <img src="${esc(c.photo)}" alt="Voiture de ${esc(c.owner)}" loading="lazy">
        <div class="info"><div><div class="owner">${esc(c.owner)}</div>${c.model ? `<div class="model">${esc(c.model)}</div>` : ''}</div><span class="vote">Voter</span></div>
      </button>`).join('') : '<div class="empty">Le concours démarre bientôt : les voitures arrivent.</div>';
  } catch {
    if (!$('#cars').children.length) $('#cars').innerHTML = '<div class="empty">Chargement impossible. Vérifie la connexion, la liste se rafraîchit toute seule.</div>';
  }
}

$('#cars').addEventListener('click', async e => {
  const card = e.target.closest('.car'); if (!card || voteLock) return;
  voteLock = true;
  try {
    const r = await fetch('/api/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ carId: card.dataset.id }) });
    if (r.ok) { card.classList.add('voted'); setTimeout(() => card.classList.remove('voted'), 1800); }
  } catch {}
  setTimeout(() => voteLock = false, 1500); // anti double-tap
});

pollTombola(); loadCars();
setInterval(pollTombola, 2500);
setInterval(loadCars, 5000);
