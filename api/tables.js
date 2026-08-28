const { getSupabase } = require('./_lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase();

  try {
    // ── GET /api/tables ──────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .order('number', { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    }

    // ── POST /api/tables ─────────────────────────────────────────────────────
    if (req.method === 'POST') {
      const body = await readJson(req);
      const { number, name } = body;
      if (!number || !name)
        return res.status(400).json({ error: 'Table number and name are required.' });

      const { data: existing } = await supabase
        .from('tables').select('id').eq('number', number).single();
      if (existing)
        return res.status(400).json({ error: `Table ${number} already exists.` });

      const { data, error } = await supabase
        .from('tables').insert({ number, name }).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(data);
    }

    // ── DELETE /api/tables?id=xxx ────────────────────────────────────────────
    if (req.method === 'DELETE') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'Table ID is required.' });
      const { error } = await supabase.from('tables').delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ message: 'Table deleted successfully.' });
    }

    return res.status(405).json({ error: 'Method not allowed.' });

  } catch (err) {
    console.error('Tables handler error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};

function readJson(req) {
  return new Promise((resolve, reject) => {
    if (req.body) return resolve(req.body);
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}
