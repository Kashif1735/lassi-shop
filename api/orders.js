const { getSupabase } = require('./_lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase();

  try {
    // ── GET /api/orders ──────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data.map(mapOrder));
    }

    // ── POST /api/orders ─────────────────────────────────────────────────────
    if (req.method === 'POST') {
      const body = await readJson(req);
      const { customerName, customerPhone, tableNumber, items, total } = body;

      if (!customerName || !customerPhone || !items || items.length === 0)
        return res.status(400).json({ error: 'Name, phone, and cart items are required.' });

      const { count } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });

      const { data, error } = await supabase
        .from('orders')
        .insert({
          order_number:   String((count || 0) + 1001),
          customer_name:  customerName,
          customer_phone: customerPhone,
          table_number:   tableNumber || 'Takeaway',
          items,
          total:          parseFloat(total),
          status:         'Pending'
        })
        .select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(mapOrder(data));
    }

    return res.status(405).json({ error: 'Method not allowed.' });

  } catch (err) {
    console.error('Orders handler error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};

function mapOrder(row) {
  return {
    id:            row.id,
    orderNumber:   row.order_number,
    customerName:  row.customer_name,
    customerPhone: row.customer_phone,
    tableNumber:   row.table_number,
    items:         row.items,
    total:         row.total,
    status:        row.status,
    createdAt:     row.created_at
  };
}

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
