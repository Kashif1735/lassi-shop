const connectDB = require('../../_lib/mongodb');
const mongoose  = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber:   String,
  customerName:  String,
  customerPhone: String,
  tableNumber:   String,
  items:         Array,
  total:         Number,
  status:        String
}, { timestamps: true });

const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body) return resolve(req.body);
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch(e) { reject(e); } });
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed.' });

  try {
    await connectDB();

    const { id } = req.query;
    const { status } = await readBody(req);
    const valid = ['Pending', 'Preparing', 'Ready', 'Completed'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status.' });

    const order = await Order.findByIdAndUpdate(id, { status }, { new: true }).lean();
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    return res.json({
      id:            order._id,
      orderNumber:   order.orderNumber,
      customerName:  order.customerName,
      customerPhone: order.customerPhone,
      tableNumber:   order.tableNumber,
      items:         order.items,
      total:         order.total,
      status:        order.status,
      createdAt:     order.createdAt
    });
  } catch (err) {
    console.error('[status]', err);
    return res.status(500).json({ error: err.message });
  }
};
