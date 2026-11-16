// Point d'entrée Vercel : toutes les routes /api/*
const { handle } = require('../lib/app');

let store;
try {
  store = require('../lib/store-redis');
} catch (e) {
  // Redis absent : la connexion reste possible, les autres routes renvoient l'erreur claire.
  const fail = async () => { throw e; };
  store = new Proxy({}, { get: () => fail });
}

module.exports = (req, res) => handle(req, res, store);
