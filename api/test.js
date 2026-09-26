const { createClient } = require('@supabase/supabase-js');

module.exports = async function (req, res) {
  res.setHeader('Content-Type', 'application/json');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data, error } = await db.from('menu').select('count').limit(1);
    if (error) {
      return res.end(JSON.stringify({
        ok: false,
        error: error.message,
        code: error.code,
        hint: error.hint,
        url_preview: url ? url.substring(0, 30) + '...' : 'MISSING',
        key_preview: key ? key.substring(0, 15) + '...' : 'MISSING'
      }));
    }
    res.end(JSON.stringify({ ok: true, data }));
  } catch (e) {
    res.end(JSON.stringify({
      ok: false,
      error: e.message,
      cause: e.cause ? String(e.cause) : undefined,
      url_preview: url ? url.substring(0, 30) + '...' : 'MISSING',
      key_preview: key ? key.substring(0, 15) + '...' : 'MISSING'
    }));
  }
};
