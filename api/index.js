// Point d'entrée Vercel unique : vercel.json réécrit /api/* vers ici (?p=chemin).
const { handle } = require('../lib/app');

let store;
try {
  store = require('../lib/store-redis');
} catch (e) {
  // Redis absent : la connexion reste possible, les autres routes renvoient l'erreur claire.
  const fail = async () => { throw e; };
  store = new Proxy({}, { get: () => fail });
}

module.exports = (req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = u.searchParams.get('p');
  if (p !== null) { u.searchParams.delete('p'); req.url = '/api/' + p + u.search; }
  return handle(req, res, store);
};
