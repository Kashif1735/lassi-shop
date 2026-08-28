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

function mapOrder(r) {
  return {
    id: r.id, orderNumber: r.order_number, customerName: r.customer_name,
    customerPhone: r.customer_phone, tableNumber: r.table_number,
    items: r.items, total: r.total, status: r.status, createdAt: r.created_at
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const db = getSupabase();

  try {
    if (req.method === 'GET') {
      const { data, error } = await db.from('orders').select('*').order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data.map(mapOrder));
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const { customerName, customerPhone, tableNumber, items, total } = body;
      if (!customerName || !customerPhone || !items?.length)
        return res.status(400).json({ error: 'Name, phone and items required.' });

      const { count } = await db.from('orders').select('*', { count: 'exact', head: true });
      const { data, error } = await db.from('orders').insert({
        order_number: String((count || 0) + 1001),
        customer_name: customerName, customer_phone: customerPhone,
        table_number: tableNumber || 'Takeaway',
        items, total: parseFloat(total), status: 'Pending'
      }).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(mapOrder(data));
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error('[orders]', err);
    return res.status(500).json({ error: err.message });
  }
};
