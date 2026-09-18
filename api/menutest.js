// Bare minimum Supabase test — no busboy, no cloudinary
const { createClient } = require('@supabase/supabase-js');

module.exports = async function(req, res) {
  res.setHeader('Content-Type', 'application/json');
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return res.end(JSON.stringify({ error: 'Missing env vars', url: !!url, key: !!key }));

    const db = createClient(url, key);
    const { data, error } = await db.from('menu').select('id, name').limit(3);
    if (error) return res.end(JSON.stringify({ supabaseError: error.message, code: error.code, hint: error.hint }));
    return res.end(JSON.stringify({ ok: true, count: data.length, sample: data }));
  } catch(e) {
    return res.end(JSON.stringify({ thrown: e.message, stack: e.stack?.split('\n').slice(0,3) }));
  }
};
