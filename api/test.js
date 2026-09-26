const { createClient } = require('@supabase/supabase-js');

module.exports = async function (req, res) {
  res.setHeader('Content-Type', 'application/json');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        headers: { apikey: key, Authorization: `Bearer ${key}` }
      }
    });

    const { data, error } = await db.from('menu').select('id, name').limit(3);

    if (error) {
      return res.end(JSON.stringify({
        ok: false,
        stage: 'supabase_query',
        error: error.message,
        code: error.code,
        hint: error.hint,
        url_preview: url ? url.substring(0, 40) : 'MISSING',
        key_type: key ? (key.startsWith('eyJ') ? 'JWT' : key.startsWith('sb_secret') ? 'sb_secret' : key.startsWith('sb_pub') ? 'sb_publishable' : 'unknown') : 'MISSING'
      }));
    }

    res.end(JSON.stringify({ ok: true, rows: data }));

  } catch (e) {
    res.end(JSON.stringify({
      ok: false,
      stage: 'exception',
      error: e.message,
      cause: e.cause ? String(e.cause) : undefined,
      url_preview: url ? url.substring(0, 40) : 'MISSING',
      key_type: key ? (key.startsWith('eyJ') ? 'JWT' : key.startsWith('sb_secret') ? 'sb_secret' : 'unknown') : 'MISSING'
    }));
  }
};
