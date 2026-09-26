const connectDB = require('./_lib/mongodb');
const mongoose  = require('mongoose');

// ── Schema ─────────────────────────────────────────────────────────────────
const orderSchema = new mongoose.Schema({
  orderNumber:   { type: String, required: true },
  customerName:  { type: String, required: true },
  customerPhone: { type: String, required: true },
  tableNumber:   { type: String, default: 'Takeaway' },
  items:         { type: Array,  required: true },
  total:         { type: Number, required: true },
  status:        { type: String, default: 'Pending' }
}, { timestamps: true });

const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

// ── Helpers ────────────────────────────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body) return resolve(req.body);
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch(e) { reject(e); } });
    req.on('error', reject);
  });
}

function toJSON(doc) {
  return {
    id:            doc._id,
    orderNumber:   doc.orderNumber,
    customerName:  doc.customerName,
    customerPhone: doc.customerPhone,
    tableNumber:   doc.tableNumber,
    items:         doc.items,
    total:         doc.total,
    status:        doc.status,
    createdAt:     doc.createdAt
  };
}

// ── Handler ────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await connectDB();

    if (req.method === 'GET') {
      const orders = await Order.find().sort({ createdAt: -1 }).lean();
      return res.json(orders.map(toJSON));
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const { customerName, customerPhone, tableNumber, items, total } = body;
      if (!customerName || !customerPhone || !items?.length)
        return res.status(400).json({ error: 'Name, phone and items required.' });

      const count = await Order.countDocuments();
      const order = await Order.create({
        orderNumber:   String(count + 1001),
        customerName,
        customerPhone,
        tableNumber:   tableNumber || 'Takeaway',
        items,
        total:         parseFloat(total),
        status:        'Pending'
      });
      return res.status(201).json(toJSON(order.toObject()));
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error('[orders]', err);
    return res.status(500).json({ error: err.message });
  }
};
