const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Step 1 — check env vars
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Missing Supabase env vars' });
  }

  let db;
  try {
    db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  } catch (e) {
    return res.status(500).json({ error: 'Supabase init failed: ' + e.message });
  }

  if (req.method === 'GET') {
    try {
      const { data, error } = await db.from('menu').select('*').order('created_at', { ascending: true });
      if (error) return res.status(500).json({ error: 'Supabase query error: ' + error.message, code: error.code });
      return res.status(200).json(data);
    } catch (e) {
      return res.status(500).json({ error: 'GET failed: ' + e.message });
    }
  }

  if (req.method === 'POST') {
    try {
      // Lazy-load busboy and cloudinary only when needed
      const Busboy = require('busboy');
      const cloudinary = require('cloudinary').v2;
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key:    process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
      });

      const { fields, file } = await parseForm(req, Busboy);
      const { name, category, price, description } = fields;
      if (!name || !category || !price)
        return res.status(400).json({ error: 'Name, category and price are required.' });

      let image = '';
      if (file) image = await uploadImage(cloudinary, file.buffer, file.filename);

      const { data, error } = await db.from('menu')
        .insert({ name, category, price: parseFloat(price), description: description || '', image })
        .select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(data);
    } catch (e) {
      return res.status(500).json({ error: 'POST failed: ' + e.message });
    }
  }

  if (req.method === 'PUT') {
    try {
      const Busboy = require('busboy');
      const cloudinary = require('cloudinary').v2;
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key:    process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
      });

      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'ID required.' });
      const { data: existing } = await db.from('menu').select('*').eq('id', id).single();
      if (!existing) return res.status(404).json({ error: 'Not found.' });

      const { fields, file } = await parseForm(req, Busboy);
      let image = existing.image;
      if (file) image = await uploadImage(cloudinary, file.buffer, file.filename);

      const { data, error } = await db.from('menu').update({
        name:        fields.name        || existing.name,
        category:    fields.category    || existing.category,
        price:       fields.price       ? parseFloat(fields.price) : existing.price,
        description: fields.description !== undefined ? fields.description : existing.description,
        image
      }).eq('id', id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    } catch (e) {
      return res.status(500).json({ error: 'PUT failed: ' + e.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'ID required.' });
      await db.from('menu').delete().eq('id', id);
      return res.status(200).json({ message: 'Deleted.' });
    } catch (e) {
      return res.status(500).json({ error: 'DELETE failed: ' + e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed.' });
};

module.exports.config = { api: { bodyParser: false } };

function parseForm(req, Busboy) {
  return new Promise((resolve, reject) => {
    const bb = Busboy({ headers: req.headers });
    const fields = {};
    let file;
    bb.on('field', (name, val) => { fields[name] = val; });
    bb.on('file', (_f, stream, info) => {
      const chunks = [];
      stream.on('data', c => chunks.push(c));
      stream.on('end', () => { file = { buffer: Buffer.concat(chunks), filename: info.filename }; });
    });
    bb.on('finish', () => resolve({ fields, file }));
    bb.on('error', reject);
    req.pipe(bb);
  });
}

function uploadImage(cloudinary, buffer, filename) {
  return new Promise((resolve, reject) => {
    const publicId = filename.replace(/\.[^/.]+$/, '').replace(/\s+/g, '_');
    cloudinary.uploader.upload_stream(
      { public_id: publicId, overwrite: true },
      (err, result) => {
        if (err) return reject(err);
        resolve(`https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto/${result.public_id}`);
      }
    ).end(buffer);
  });
}
