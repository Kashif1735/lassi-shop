const connectDB = require('./_lib/mongodb');
const mongoose  = require('mongoose');

module.exports = async function (req, res) {
  res.setHeader('Content-Type', 'application/json');
  try {
    await connectDB();
    const state = mongoose.connection.readyState;
    // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    res.end(JSON.stringify({
      ok:    state === 1,
      state: states[state] || 'unknown',
      mongo: process.env.MONGODB_URI
        ? process.env.MONGODB_URI.replace(/:\/\/.*@/, '://***@')
        : 'MISSING'
    }));
  } catch (e) {
    res.end(JSON.stringify({ ok: false, error: e.message }));
  }
};
