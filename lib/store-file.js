// Stockage local (fichier JSON). Pour le développement uniquement.
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data');
const FILE = path.join(DATA, 'db.json');
fs.mkdirSync(path.join(DATA, 'photos'), { recursive: true });

let mem = { participants: [], cars: [], draw: null, votes: {} };
try { mem = { ...mem, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; } catch {}
const flush = () => fs.writeFileSync(FILE, JSON.stringify(mem, null, 2));

module.exports = {
  async load() { return { participants: mem.participants, cars: mem.cars, draw: mem.draw }; },
  async save(db) { mem.participants = db.participants; mem.cars = db.cars; mem.draw = db.draw; flush(); },
  async vote(id) { mem.votes[id] = (mem.votes[id] || 0) + 1; flush(); },
  async votes() { return mem.votes; },
  async delVote(id) { delete mem.votes[id]; flush(); },
  async resetVotes() { mem.votes = {}; flush(); },
  async putPhoto(id, dataUrl) { fs.writeFileSync(path.join(DATA, 'photos', id), dataUrl); },
  async getPhoto(id) {
    try {
      const d = fs.readFileSync(path.join(DATA, 'photos', path.basename(id)), 'utf8');
      const m = /^data:(image\/\w+);base64,(.+)$/.exec(d); return m && { mime: m[1], buf: Buffer.from(m[2], 'base64') };
    } catch { return null; }
  },
  async delPhoto(id) { fs.rm(path.join(DATA, 'photos', path.basename(id)), () => {}); },
};
