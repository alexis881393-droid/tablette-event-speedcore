const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let state = { participants: [], cars: [], draw: null };
let editingId = null;

async function call(method, url, body) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  if (r.status === 401 && url !== '/api/admin/login') { showLogin(); throw new Error('Connexion requise'); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Erreur');
  return d;
}

// ---------- login ----------
function showLogin() { $('#app').hidden = true; $('#loginView').hidden = false; $('#pin').focus(); }
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  try { await call('POST', '/api/admin/login', { pin: $('#pin').value }); $('#pin').value = ''; $('#loginErr').textContent = ''; await boot(); }
  catch (err) { $('#loginErr').textContent = err.message; }
});

async function boot() {
  try { await refresh(); $('#loginView').hidden = true; $('#app').hidden = false; } catch { showLogin(); }
}
async function refresh() { state = await call('GET', '/api/admin/state'); render(); }

// ---------- onglets ----------
function show(name) {
  for (const k of ['tombola', 'concours']) { $('#t-' + k).setAttribute('aria-selected', k === name); $('#' + k).hidden = k !== name; }
}
$('#t-tombola').onclick = () => show('tombola');
$('#t-concours').onclick = () => show('concours');

// ---------- rendu ----------
function render() {
  const P = state.participants;
  $('#pCount').textContent = P.length;
  $('#pTotal').textContent = P.reduce((s, p) => s + p.tickets, 0);
  $('#pRows').innerHTML = P.length ? P.map(p => `
    <tr><td>${esc(p.firstName)} ${esc(p.lastName)}</td><td>${esc(p.phone) || '-'}</td><td class="votes">${p.tickets}</td>
    <td class="act"><button class="btn small ghost" data-edit="${p.id}">Modifier</button> <button class="btn small danger" data-del="${p.id}">Supprimer</button></td></tr>`).join('')
    : '<tr><td colspan="4"><div class="empty">Ajoute le premier participant avec le formulaire.</div></td></tr>';

  const w = state.draw;
  $('#winbox').hidden = !w;
  if (w) $('#winbox').innerHTML = `Gagnant : <b class="bronze">${esc(w.fullName)}</b> · ${esc(w.phone) || 'pas de numéro'}`;

  const C = state.cars;
  $('#cCount').textContent = C.length;
  $('#cVotes').textContent = C.reduce((s, c) => s + c.votes, 0);
  const max = Math.max(0, ...C.map(c => c.votes));
  $('#cRows').innerHTML = C.length ? C.map(c => `
    <tr><td><img class="thumb" src="${esc(c.photo)}" alt=""></td>
    <td>${esc(c.owner)}${c.model ? `<br><span class="model" style="color:var(--muted)">${esc(c.model)}</span>` : ''}</td>
    <td class="votes"${max && c.votes === max ? ' title="En tête"' : ''}>${c.votes}${max && c.votes === max ? ' ★' : ''}</td>
    <td class="act"><button class="btn small danger" data-delcar="${c.id}">Supprimer</button></td></tr>`).join('')
    : '<tr><td colspan="4"><div class="empty">Ajoute la première voiture avec le formulaire.</div></td></tr>';
}

// ---------- participants ----------
function resetPForm() {
  editingId = null; $('#pForm').reset(); $('#pTickets').value = 1;
  $('#pFormTitle').textContent = 'Nouveau participant'; $('#pSubmit').textContent = 'Ajouter'; $('#pCancel').hidden = true; $('#pErr').textContent = '';
}
$('#pCancel').onclick = resetPForm;
$('#pForm').addEventListener('submit', async e => {
  e.preventDefault();
  const body = { firstName: $('#pFirst').value, lastName: $('#pLast').value, phone: $('#pPhone').value, tickets: $('#pTickets').value };
  try {
    await call(editingId ? 'PUT' : 'POST', editingId ? `/api/admin/participants/${editingId}` : '/api/admin/participants', body);
    resetPForm(); await refresh(); $('#pFirst').focus();
  } catch (err) { $('#pErr').textContent = err.message; }
});
$('#pRows').addEventListener('click', async e => {
  const ed = e.target.dataset.edit, del = e.target.dataset.del;
  if (ed) {
    const p = state.participants.find(x => x.id === ed); editingId = ed;
    $('#pFirst').value = p.firstName; $('#pLast').value = p.lastName; $('#pPhone').value = p.phone; $('#pTickets').value = p.tickets;
    $('#pFormTitle').textContent = 'Modifier le participant'; $('#pSubmit').textContent = 'Enregistrer'; $('#pCancel').hidden = false; $('#pFirst').focus();
  }
  if (del) {
    const p = state.participants.find(x => x.id === del);
    if (confirm(`Supprimer ${p.firstName} ${p.lastName} ?`)) { await call('DELETE', `/api/admin/participants/${del}`); if (editingId === del) resetPForm(); refresh(); }
  }
});
$('#drawBtn').onclick = async () => {
  if (state.draw && !confirm('Un gagnant existe déjà. Lancer un nouveau tirage ?')) return;
  try { await call('POST', '/api/admin/draw'); refresh(); } catch (err) { alert(err.message); }
};
$('#drawReset').onclick = async () => { await call('POST', '/api/admin/draw/reset'); refresh(); };

// ---------- concours ----------
// Réduit la photo (max 1200 px, JPEG) avant envoi : upload rapide, tablette légère.
function shrink(file) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 1200 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => reject(new Error('Image illisible'));
    img.src = url;
  });
}
let photoData = null;
$('#cPhoto').addEventListener('change', async e => {
  const f = e.target.files[0]; photoData = null; $('#cPreview').hidden = true;
  if (!f) return;
  try { photoData = await shrink(f); $('#cPreview').src = photoData; $('#cPreview').hidden = false; $('#cErr').textContent = ''; }
  catch (err) { $('#cErr').textContent = err.message; }
});
$('#cForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (!photoData) { $('#cErr').textContent = 'Choisis une photo.'; return; }
  $('#cSubmit').disabled = true;
  try {
    await call('POST', '/api/admin/cars', { owner: $('#cOwner').value, model: $('#cModel').value, photo: photoData });
    $('#cForm').reset(); photoData = null; $('#cPreview').hidden = true; $('#cErr').textContent = ''; await refresh();
  } catch (err) { $('#cErr').textContent = err.message; }
  $('#cSubmit').disabled = false;
});
$('#cRows').addEventListener('click', async e => {
  const id = e.target.dataset.delcar; if (!id) return;
  const c = state.cars.find(x => x.id === id);
  if (confirm(`Supprimer la voiture de ${c.owner} ?`)) { await call('DELETE', `/api/admin/cars/${id}`); refresh(); }
});
$('#votesReset').onclick = async () => { if (confirm('Remettre tous les votes à zéro ?')) { await call('POST', '/api/admin/votes/reset'); refresh(); } };

boot();
setInterval(() => { if (!$('#app').hidden && !document.activeElement.matches('input')) refresh().catch(() => {}); }, 5000);
