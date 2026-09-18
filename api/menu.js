const { createClient } = require('@supabase/supabase-js');
const Busboy = require('busboy');
const cloudinary = require('cloudinary').v2;

// Disable Vercel body parser — we handle multipart manually
const config = { api: { bodyParser: false } };

function getDB() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';

    // JSON body
    if (contentType.includes('application/json')) {
      let raw = '';
      req.on('data', c => { raw += c; });
      req.on('end', () => {
        try { resolve({ fields: JSON.parse(raw || '{}'), file: null }); }
        catch (e) { reject(e); }
      });
      req.on('error', reject);
      return;
    }

    // Multipart form
    if (contentType.includes('multipart/form-data')) {
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

    // URL-encoded
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => {
      resolve({ fields: Object.fromEntries(new URLSearchParams(raw)), file: null });
    });
    req.on('error', reject);
  });
}

function uploadImage(buffer, filename) {
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

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const db = getDB();

  try {
    // ── GET ────────────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const { data, error } = await db
        .from('menu').select('*').order('created_at', { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    }

    // ── POST ───────────────────────────────────────────────────────────────────
    if (req.method === 'POST') {
      const { fields, file } = await parseForm(req);
      const { name, category, price, description } = fields;
      if (!name || !category || !price)
        return res.status(400).json({ error: 'Name, category and price are required.' });
      const image = file ? await uploadImage(file.buffer, file.filename) : '';
      const { data, error } = await db.from('menu')
        .insert({ name, category, price: parseFloat(price), description: description || '', image })
        .select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(data);
    }

    // ── PUT ────────────────────────────────────────────────────────────────────
    if (req.method === 'PUT') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'ID required.' });
      const { data: existing } = await db.from('menu').select('*').eq('id', id).single();
      if (!existing) return res.status(404).json({ error: 'Item not found.' });
      const { fields, file } = await parseForm(req);
      const image = file ? await uploadImage(file.buffer, file.filename) : existing.image;
      const { data, error } = await db.from('menu').update({
        name:        fields.name        || existing.name,
        category:    fields.category    || existing.category,
        price:       fields.price       ? parseFloat(fields.price) : existing.price,
        description: fields.description !== undefined ? fields.description : existing.description,
        image
      }).eq('id', id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    }

    // ── DELETE ─────────────────────────────────────────────────────────────────
    if (req.method === 'DELETE') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'ID required.' });
      const { error } = await db.from('menu').delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ message: 'Deleted.' });
    }

    return res.status(405).json({ error: 'Method not allowed.' });

  } catch (err) {
    console.error('[menu]', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}

module.exports = handler;
module.exports.config = config;
