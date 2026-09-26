const connectDB = require('./_lib/mongodb');
const mongoose  = require('mongoose');

// ── Schema ─────────────────────────────────────────────────────────────────
const tableSchema = new mongoose.Schema({
  number: { type: Number, required: true, unique: true },
  name:   { type: String, required: true }
}, { timestamps: true });

const Table = mongoose.models.Table || mongoose.model('Table', tableSchema);

// ── Helpers ────────────────────────────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body) return resolve(req.body);
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch(e) { reject(e); } });
    req.on('error', reject);
  });
}

// ── Handler ────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await connectDB();

    if (req.method === 'GET') {
      const tables = await Table.find().sort({ number: 1 }).lean();
      return res.json(tables.map(t => ({ id: t._id, number: t.number, name: t.name })));
    }

    if (req.method === 'POST') {
      const { number, name } = await readBody(req);
      if (!number || !name) return res.status(400).json({ error: 'Number and name required.' });

      const exists = await Table.findOne({ number });
      if (exists) return res.status(400).json({ error: `Table ${number} already exists.` });

      const table = await Table.create({ number, name });
      return res.status(201).json({ id: table._id, number: table.number, name: table.name });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID required.' });
      await Table.findByIdAndDelete(id);
      return res.json({ message: 'Deleted.' });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error('[tables]', err);
    return res.status(500).json({ error: err.message });
  }
};
