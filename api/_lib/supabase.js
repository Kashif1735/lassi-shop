const { createClient } = require('@supabase/supabase-js');

let client;

function getSupabase() {
  if (!client) {
    const url  = process.env.SUPABASE_URL;
    const key  = process.env.SUPABASE_SERVICE_ROLE_KEY;

    client = createClient(url, key, {
      auth: {
        persistSession:   false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      },
      global: {
        headers: {
          apikey:        key,
          Authorization: `Bearer ${key}`
        }
      }
    });
  }
  return client;
}

module.exports = { getSupabase };
