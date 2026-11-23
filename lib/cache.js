// Petit cache mémoire (3 s) pour les lectures publiques : limite les lectures Firestore
// quand beaucoup d'écrans interrogent le site en même temps (quota gratuit : 50 000 lectures/jour).
module.exports = store => {
  const TTL = 3000; let db = null, dbAt = 0, vt = null, vtAt = 0;
  return {
    async load() {
      if (db && Date.now() - dbAt < TTL) return structuredClone(db);
      db = await store.load(); dbAt = Date.now(); return structuredClone(db);
    },
    async votes() {
      if (vt && Date.now() - vtAt < TTL) return vt;
      vt = await store.votes(); vtAt = Date.now(); return vt;
    },
  };
};
