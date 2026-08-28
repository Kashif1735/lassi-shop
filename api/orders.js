const { getSupabase } = require('./_lib/supabase');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase();

  // ── GET /api/orders ────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // ── POST /api/orders ───────────────────────────────────────────────────────
  if (req.method === 'POST') {
    let body = req.body;

    // If body-parser is off, read raw JSON manually
    if (!body) {
      body = await new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', c => { raw += c; });
        req.on('end', () => {
          try { resolve(JSON.parse(raw || '{}')); } catch (e) { reject(e); }
        });
        req.on('error', reject);
      });
    }

    const { customerName, customerPhone, tableNumber, items, total } = body;

    if (!customerName || !customerPhone || !items || items.length === 0) {
      return res.status(400).json({ error: 'Name, phone, and cart items are required.' });
    }

    // Get current order count to build a friendly order number
    const { count } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });

    const orderNumber = String((count || 0) + 1001);

    const { data, error } = await supabase
      .from('orders')
      .insert({
        order_number:   orderNumber,
        customer_name:  customerName,
        customer_phone: customerPhone,
        table_number:   tableNumber || 'Takeaway',
        items,                  // stored as JSONB array
        total:          parseFloat(total),
        status:         'Pending'
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // Map snake_case DB columns → camelCase for frontend compatibility
    return res.status(201).json(mapOrder(data));
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}

/**
 * Map Supabase row (snake_case) to the shape the frontend expects (camelCase).
 */
function mapOrder(row) {
  return {
    id:             row.id,
    orderNumber:    row.order_number,
    customerName:   row.customer_name,
    customerPhone:  row.customer_phone,
    tableNumber:    row.table_number,
    items:          row.items,
    total:          row.total,
    status:         row.status,
    createdAt:      row.created_at
  };
}
