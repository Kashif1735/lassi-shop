const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body) return resolve(req.body);
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch(e) { reject(e); } });
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const db = getSupabase();

  try {
    if (req.method === 'GET') {
      const { data, error } = await db.from('tables').select('*').order('number', { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data);
    }

    if (req.method === 'POST') {
      const { number, name } = await readBody(req);
      if (!number || !name) return res.status(400).json({ error: 'Number and name required.' });
      const { data: exists } = await db.from('tables').select('id').eq('number', number).single();
      if (exists) return res.status(400).json({ error: `Table ${number} already exists.` });
      const { data, error } = await db.from('tables').insert({ number, name }).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(data);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID required.' });
      const { error } = await db.from('tables').delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ message: 'Deleted.' });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error('[tables]', err);
    return res.status(500).json({ error: err.message });
  }
};
