// Stockage Vercel : Upstash Redis (Marketplace). Variables lues automatiquement.
const { Redis } = require('@upstash/redis');

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
if (!url || !token) throw new Error('Base Redis non connectée : ajoute Upstash Redis au projet Vercel (Storage).');
const r = new Redis({ url, token });

const DB = 'sc:db', VOTES = 'sc:votes', photo = id => `sc:photo:${id}`;

module.exports = {
  async load() { return (await r.get(DB)) || { participants: [], cars: [], draw: null }; },
  async save(db) { await r.set(DB, db); },
  async vote(id) { await r.hincrby(VOTES, id, 1); },
  async votes() {
    const v = (await r.hgetall(VOTES)) || {}; const out = {};
    for (const k in v) out[k] = Number(v[k]); return out;
  },
  async delVote(id) { await r.hdel(VOTES, id); },
  async resetVotes() { await r.del(VOTES); },
  async putPhoto(id, dataUrl) { await r.set(photo(id), dataUrl); },
  async getPhoto(id) {
    const d = await r.get(photo(id));
    const m = d && /^data:(image\/\w+);base64,(.+)$/.exec(d);
    return m ? { mime: m[1], buf: Buffer.from(m[2], 'base64') } : null;
  },
  async delPhoto(id) { await r.del(photo(id)); },
};
