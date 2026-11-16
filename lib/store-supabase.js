// Stockage Vercel : Supabase (API REST, clé secrète côté serveur uniquement).
// Variables : SUPABASE_URL et SUPABASE_SERVICE_KEY (clé service_role / secret).
const URL_ = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const KEY = (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
if (!URL_ || !KEY) throw new Error('Supabase non configuré : ajoute SUPABASE_URL et SUPABASE_SERVICE_KEY dans Vercel (Settings > Environment Variables).');

const base = { apikey: KEY, 'Content-Type': 'application/json' };
if (KEY.startsWith('eyJ')) base.Authorization = `Bearer ${KEY}`; // ancienne clé JWT

async function rest(method, path, body, extra = {}) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, {
    method, headers: { ...base, ...extra }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status} : ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

const getKV = async key => {
  const rows = await rest('GET', `sc_kv?key=eq.${encodeURIComponent(key)}&select=value`);
  return rows && rows[0] ? rows[0].value : null;
};
const setKV = (key, value) =>
  rest('POST', 'sc_kv', { key, value }, { Prefer: 'resolution=merge-duplicates,return=minimal' });
const delKV = key => rest('DELETE', `sc_kv?key=eq.${encodeURIComponent(key)}`);

module.exports = {
  async load() { return (await getKV('db')) || { participants: [], cars: [], draw: null }; },
  async save(db) { await setKV('db', db); },
  async vote(id) { await rest('POST', 'rpc/sc_vote', { p_car: id }); },
  async votes() {
    const rows = await rest('GET', 'sc_votes?select=car_id,count'); const out = {};
    for (const r of rows || []) out[r.car_id] = r.count; return out;
  },
  async delVote(id) { await rest('DELETE', `sc_votes?car_id=eq.${encodeURIComponent(id)}`); },
  async resetVotes() { await rest('DELETE', 'sc_votes?car_id=not.is.null'); },
  async putPhoto(id, dataUrl) { await setKV(`photo:${id}`, dataUrl); },
  async getPhoto(id) {
    const d = await getKV(`photo:${id}`);
    const m = typeof d === 'string' && /^data:(image\/\w+);base64,(.+)$/.exec(d);
    return m ? { mime: m[1], buf: Buffer.from(m[2], 'base64') } : null;
  },
  async delPhoto(id) { await delKV(`photo:${id}`); },
};
