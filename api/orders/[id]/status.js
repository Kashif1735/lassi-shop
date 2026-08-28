const { getSupabase } = require('../../_lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed.' });

  try {
    const { id } = req.query;
    const body = await readJson(req);
    const { status } = body;

    const valid = ['Pending', 'Preparing', 'Ready', 'Completed'];
    if (!valid.includes(status))
      return res.status(400).json({ error: 'Invalid status.' });

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', id)
      .select().single();

    if (error || !data) return res.status(404).json({ error: 'Order not found.' });

    return res.status(200).json({
      id:            data.id,
      orderNumber:   data.order_number,
      customerName:  data.customer_name,
      customerPhone: data.customer_phone,
      tableNumber:   data.table_number,
      items:         data.items,
      total:         data.total,
      status:        data.status,
      createdAt:     data.created_at
    });

  } catch (err) {
    console.error('Status handler error:', err);
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
