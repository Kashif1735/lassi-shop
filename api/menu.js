const connectDB = require('./_lib/mongodb');
const mongoose  = require('mongoose');

// ── Schema ─────────────────────────────────────────────────────────────────
const menuSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  category:    { type: String, required: true },
  price:       { type: Number, required: true },
  description: { type: String, default: '' },
  image:       { type: String, default: '' },
}, { timestamps: true });

const Menu = mongoose.models.Menu || mongoose.model('Menu', menuSchema);

// ── Handler ────────────────────────────────────────────────────────────────
async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await connectDB();

    // ── GET ──────────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const items = await Menu.find().sort({ createdAt: 1 }).lean();
      return res.status(200).json(items.map(toJSON));
    }

    // ── POST ─────────────────────────────────────────────────────────────────
    if (req.method === 'POST') {
      const { fields, file } = await parseForm(req);
      const { name, category, price, description } = fields;
      if (!name || !category || !price)
        return res.status(400).json({ error: 'Name, category and price are required.' });

      let image = '';
      if (file) image = await uploadImage(file.buffer, file.filename);

      const item = await Menu.create({
        name, category, price: parseFloat(price),
        description: description || '', image
      });
      return res.status(201).json(toJSON(item.toObject()));
    }

    // ── PUT ──────────────────────────────────────────────────────────────────
    if (req.method === 'PUT') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'ID required.' });

      const existing = await Menu.findById(id).lean();
      if (!existing) return res.status(404).json({ error: 'Item not found.' });

      const { fields, file } = await parseForm(req);
      const image = file ? await uploadImage(file.buffer, file.filename) : existing.image;

      const updated = await Menu.findByIdAndUpdate(id, {
        name:        fields.name        || existing.name,
        category:    fields.category    || existing.category,
        price:       fields.price       ? parseFloat(fields.price) : existing.price,
        description: fields.description !== undefined ? fields.description : existing.description,
        image
      }, { new: true }).lean();

      return res.status(200).json(toJSON(updated));
    }

    // ── DELETE ───────────────────────────────────────────────────────────────
    if (req.method === 'DELETE') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'ID required.' });
      await Menu.findByIdAndDelete(id);
      return res.status(200).json({ message: 'Deleted.' });
    }

    return res.status(405).json({ error: 'Method not allowed.' });

  } catch (err) {
    console.error('[menu]', err);
    return res.status(500).json({ error: err.message });
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function toJSON(doc) {
  return {
    id:          doc._id,
    name:        doc.name,
    category:    doc.category,
    price:       doc.price,
    description: doc.description,
    image:       doc.image,
    createdAt:   doc.createdAt
  };
}

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const ct = req.headers['content-type'] || '';

    if (ct.includes('application/json')) {
      let raw = '';
      req.on('data', c => { raw += c; });
      req.on('end', () => {
        try { resolve({ fields: JSON.parse(raw || '{}'), file: null }); }
        catch (e) { reject(e); }
      });
      req.on('error', reject);
      return;
    }

    if (ct.includes('multipart/form-data')) {
      const Busboy = require('busboy');
      const bb = Busboy({ headers: req.headers });
      const fields = {};
      let file = null;
      bb.on('field', (name, val) => { fields[name] = val; });
      bb.on('file', (_f, stream, info) => {
        const chunks = [];
        stream.on('data', c => chunks.push(c));
        stream.on('end', () => {
          file = { buffer: Buffer.concat(chunks), filename: info.filename };
        });
      });
      bb.on('finish', () => resolve({ fields, file }));
      bb.on('error', reject);
      req.pipe(bb);
      return;
    }

    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => {
      resolve({ fields: raw ? Object.fromEntries(new URLSearchParams(raw)) : {}, file: null });
    });
    req.on('error', reject);
  });
}

function uploadImage(buffer, filename) {
  const cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  return new Promise((resolve, reject) => {
    const publicId = (filename || 'item').replace(/\.[^/.]+$/, '').replace(/\s+/g, '_');
    cloudinary.uploader.upload_stream(
      { public_id: publicId, overwrite: true },
      (err, result) => {
        if (err) return reject(err);
        resolve(`https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto/${result.public_id}`);
      }
    ).end(buffer);
  });
}

handler.config = { api: { bodyParser: false } };
module.exports = handler;
