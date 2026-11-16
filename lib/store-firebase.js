// Stockage Vercel : Firebase Firestore via firebase-admin (clé de service, côté serveur uniquement).
// Variable : FIREBASE_SERVICE_ACCOUNT = contenu complet du fichier JSON de la clé de service.
const admin = require('firebase-admin');

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) throw new Error('Firebase non configuré : ajoute FIREBASE_SERVICE_ACCOUNT dans Vercel (Settings > Environment Variables).');

let cred;
try { cred = JSON.parse(raw); } catch { throw new Error('FIREBASE_SERVICE_ACCOUNT n\'est pas un JSON valide : colle le fichier complet.'); }
if (cred.private_key) cred.private_key = cred.private_key.replace(/\\n/g, '\n');

if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(cred) });
const fs = admin.firestore();

const dbDoc = fs.collection('sc').doc('db');
const photos = fs.collection('sc_photos');
const votes = fs.collection('sc_votes');
const voters = fs.collection('sc_voters');
const ips = fs.collection('sc_ips');

module.exports = {
  async load() {
    const s = await dbDoc.get();
    return s.exists ? JSON.parse(s.data().json) : { participants: [], cars: [], draw: null };
  },
  async save(db) { await dbDoc.set({ json: JSON.stringify(db) }); },
  async vote(id) { await votes.doc(id).set({ count: admin.firestore.FieldValue.increment(1) }, { merge: true }); },
  async votes() {
    const out = {}; (await votes.get()).forEach(d => { out[d.id] = d.data().count || 0; }); return out;
  },
  async delVote(id) { await votes.doc(id).delete(); },
  async resetVotes() {
    for (const col of [votes, voters, ips]) {
      const snap = await col.get(); const docs = snap.docs;
      for (let i = 0; i < docs.length; i += 400) {
        const b = fs.batch(); docs.slice(i, i + 400).forEach(d => b.delete(d.ref)); await b.commit();
      }
    }
  },
  // Vote contrôlé, atomique : un appareil (cookie) + plafond par connexion (IP hachée)
  async castVote(carId, dev, ipH, rules) {
    const vRef = votes.doc(carId), dRef = voters.doc(dev), iRef = ips.doc(ipH);
    return fs.runTransaction(async tx => {
      const d = await tx.get(dRef);
      const i = rules.ipMax ? await tx.get(iRef) : null;
      const now = Date.now();
      if (d.exists) {
        const x = d.data();
        if (rules.mode === 'once') return { ok: false, reason: 'already', voted: x.car };
        if (now - x.last < rules.cooldownMs) return { ok: false, reason: 'wait', retryMs: rules.cooldownMs - (now - x.last) };
      }
      if (rules.ipMax && i.exists && (i.data().n || 0) >= rules.ipMax) return { ok: false, reason: 'ip' };
      tx.set(dRef, { car: carId, last: now });
      if (rules.ipMax) tx.set(iRef, { n: (i.exists ? i.data().n || 0 : 0) + 1 });
      tx.set(vRef, { count: admin.firestore.FieldValue.increment(1) }, { merge: true });
      return { ok: true, voted: carId };
    });
  },
  async voterCar(dev) { const s = await voters.doc(dev).get(); return s.exists ? s.data().car : null; },
  async putPhoto(id, dataUrl) { await photos.doc(id).set({ data: dataUrl }); },
  async getPhoto(id) {
    const s = await photos.doc(id).get();
    const m = s.exists && /^data:(image\/\w+);base64,(.+)$/.exec(s.data().data);
    return m ? { mime: m[1], buf: Buffer.from(m[2], 'base64') } : null;
  },
  async delPhoto(id) { await photos.doc(id).delete(); },
};
