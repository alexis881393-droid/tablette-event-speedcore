// Point d'entrée Vercel : toutes les routes /api/*
const { handle } = require('../lib/app');
let store, initError;
try { store = require('../lib/store-redis'); } catch (e) { initError = e; }

module.exports = (req, res) => {
  if (initError) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: initError.message }));
  }
  return handle(req, res, store);
};
