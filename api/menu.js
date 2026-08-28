const { getSupabase } = require('./_lib/supabase');
const { parseForm } = require('./_lib/parseForm');
const { uploadToCloudinary, deleteFromCloudinary } = require('./_lib/cloudinary');

// Vercel needs raw body for multipart — disable built-in body parser
export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase();

  // ── GET /api/menu ──────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('menu')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // ── POST /api/menu ─────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { fields, file } = await parseForm(req);
    const { name, category, price, description } = fields;

    if (!name || !category || !price) {
      return res.status(400).json({ error: 'Name, category, and price are required.' });
    }

    let imageUrl = '';
    if (file) {
      imageUrl = await uploadToCloudinary(file.buffer, file.filename);
    }

    const { data, error } = await supabase
      .from('menu')
      .insert({
        name,
        category,
        price: parseFloat(price),
        description: description || '',
        image: imageUrl
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  // ── PUT /api/menu?id=xxx ───────────────────────────────────────────────────
  if (req.method === 'PUT') {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'Item ID is required.' });

    // Fetch existing item to get old image URL
    const { data: existing, error: fetchErr } = await supabase
      .from('menu')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) return res.status(404).json({ error: 'Menu item not found.' });

    const { fields, file } = await parseForm(req);
    const { name, category, price, description } = fields;

    let imageUrl = existing.image;
    if (file) {
      // Delete old image from Cloudinary (non-fatal)
      await deleteFromCloudinary(existing.image);
      imageUrl = await uploadToCloudinary(file.buffer, file.filename);
    }

    const { data, error } = await supabase
      .from('menu')
      .update({
        name:        name        || existing.name,
        category:    category    || existing.category,
        price:       price       ? parseFloat(price) : existing.price,
        description: description !== undefined ? description : existing.description,
        image:       imageUrl
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // ── DELETE /api/menu?id=xxx ────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'Item ID is required.' });

    // Fetch image URL before deleting row
    const { data: existing } = await supabase
      .from('menu')
      .select('image')
      .eq('id', id)
      .single();

    if (existing?.image) await deleteFromCloudinary(existing.image);

    const { error } = await supabase.from('menu').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ message: 'Menu item deleted successfully.' });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
