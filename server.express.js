require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { MongoClient, ObjectId } = require('mongodb');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Cloudinary Config ────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ─── Multer → Cloudinary Storage ─────────────────────────────────────────────
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: '',   // root level — matches where your images already are
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }]
  }
});
const upload = multer({ storage });

// ─── MongoDB Connection ───────────────────────────────────────────────────────
let db;

async function connectDB() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  db = client.db(process.env.DB_NAME || 'lassi-shop');
  console.log('Connected to MongoDB Atlas');

  // Seed default menu items if the menu collection is empty
  const menuCol = db.collection('menu');
  const count = await menuCol.countDocuments();
  if (count === 0) {
    // Base URL uses f_auto,q_auto for automatic format + quality optimisation
    const cdn = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto`;
    await menuCol.insertMany([
      {
        id: 'item_1',
        name: 'Alphonso Mango Lassi',
        category: 'Lassi',
        price: 120,
        description: 'Creamy yogurt drink blended with sweet Alphonso mango pulp, saffron, and cardamoms, topped with chopped pistachios.',
        image: `${cdn}/mango_lassi`
      },
      {
        id: 'item_2',
        name: 'Classic Sweet Lassi',
        category: 'Lassi',
        price: 90,
        description: 'Traditional Punjabi lassi churned with fresh yogurt, sweet cream (malai), and a hint of rose water.',
        image: `${cdn}/sweet_lassi`
      },
      {
        id: 'item_3',
        name: 'Royal Kesar Pista Lassi',
        category: 'Lassi',
        price: 140,
        description: 'Luxurious saffron and pistachio infused lassi, garnished with slivered almonds, pistachios, and saffron strands.',
        image: `${cdn}/kesar_pista`
      },
      {
        id: 'item_4',
        name: 'Fragrant Rose Lassi',
        category: 'Lassi',
        price: 110,
        description: 'Refreshing, fragrant lassi blended with organic rose syrup, cream, and topped with aromatic rose petals.',
        image: `${cdn}/rose_lassi`
      },
      {
        id: 'item_5',
        name: 'Punjabi Samosa (2 pcs)',
        category: 'Snacks',
        price: 70,
        description: 'Crispy golden pastry triangles stuffed with spiced potatoes and green peas, served with sweet tamarind and mint chutneys.',
        image: `${cdn}/samosa`
      },
      {
        id: 'item_6',
        name: 'Packaged Water Bottle (1L)',
        category: 'Drinks',
        price: 20,
        description: 'Chilled, pure packaged drinking water to keep you hydrated.',
        image: `${cdn}/water_bottle`
      }
    ]);
    console.log('Default menu items seeded.');
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// ─── MENU API ─────────────────────────────────────────────────────────────────

// GET all menu items
app.get('/api/menu', async (req, res) => {
  try {
    const items = await db.collection('menu').find({}, { projection: { _id: 0 } }).toArray();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch menu.' });
  }
});

// POST create menu item (image → Cloudinary)
app.post('/api/menu', upload.single('image'), async (req, res) => {
  try {
    const { name, category, price, description } = req.body;
    if (!name || !category || !price) {
      return res.status(400).json({ error: 'Name, category, and price are required.' });
    }

    const newItem = {
      id: 'item_' + Date.now(),
      name,
      category,
      price: parseFloat(price),
      description: description || '',
      image: req.file ? req.file.path : ''   // Cloudinary secure URL
    };

    await db.collection('menu').insertOne(newItem);
    // Return without MongoDB _id
    const { _id, ...itemOut } = newItem;
    res.status(201).json(itemOut);
  } catch (err) {
    console.error('Error creating menu item:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT update menu item
app.put('/api/menu/:id', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, price, description } = req.body;

    const existing = await db.collection('menu').findOne({ id }, { projection: { _id: 0 } });
    if (!existing) return res.status(404).json({ error: 'Menu item not found.' });

    // If a new image was uploaded, delete the old one from Cloudinary
    if (req.file && existing.image) {
      const publicId = extractCloudinaryPublicId(existing.image);
      if (publicId) await cloudinary.uploader.destroy(publicId).catch(() => {});
    }

    const updated = {
      ...existing,
      name:        name        || existing.name,
      category:    category    || existing.category,
      price:       price       ? parseFloat(price) : existing.price,
      description: description !== undefined ? description : existing.description,
      image:       req.file    ? req.file.path : existing.image
    };

    await db.collection('menu').updateOne({ id }, { $set: updated });
    res.json(updated);
  } catch (err) {
    console.error('Error updating menu item:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE menu item
app.delete('/api/menu/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const item = await db.collection('menu').findOne({ id });
    if (!item) return res.status(404).json({ error: 'Menu item not found.' });

    // Delete image from Cloudinary if it was uploaded there
    if (item.image) {
      const publicId = extractCloudinaryPublicId(item.image);
      if (publicId) await cloudinary.uploader.destroy(publicId).catch(() => {});
    }

    await db.collection('menu').deleteOne({ id });
    res.json({ message: 'Menu item deleted successfully.' });
  } catch (err) {
    console.error('Error deleting menu item:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─── TABLES API ───────────────────────────────────────────────────────────────

// GET all tables
app.get('/api/tables', async (req, res) => {
  try {
    const tables = await db.collection('tables').find({}, { projection: { _id: 0 } }).toArray();
    res.json(tables);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tables.' });
  }
});

// POST create table
app.post('/api/tables', async (req, res) => {
  try {
    const { number, name } = req.body;
    if (!number || !name) return res.status(400).json({ error: 'Table number and name are required.' });

    const exists = await db.collection('tables').findOne({ number });
    if (exists) return res.status(400).json({ error: 'Table number already exists.' });

    const newTable = { id: 'table_' + Date.now(), number, name };
    await db.collection('tables').insertOne(newTable);
    const { _id, ...tableOut } = newTable;
    res.status(201).json(tableOut);
  } catch (err) {
    console.error('Error creating table:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE table
app.delete('/api/tables/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.collection('tables').deleteOne({ id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Table not found.' });
    res.json({ message: 'Table deleted successfully.' });
  } catch (err) {
    console.error('Error deleting table:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─── ORDERS API ───────────────────────────────────────────────────────────────

// GET all orders (sorted newest first)
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await db.collection('orders')
      .find({}, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders.' });
  }
});

// POST place order
app.post('/api/orders', async (req, res) => {
  try {
    const { customerName, customerPhone, tableNumber, items, total } = req.body;
    if (!customerName || !customerPhone || !items || items.length === 0) {
      return res.status(400).json({ error: 'Name, phone, and cart items are required.' });
    }

    const count = await db.collection('orders').countDocuments();
    const newOrder = {
      id:            'order_' + Date.now(),
      orderNumber:   (count + 1001).toString(),
      customerName,
      customerPhone,
      tableNumber:   tableNumber || 'Takeaway',
      items,
      total:         parseFloat(total),
      status:        'Pending',
      createdAt:     new Date().toISOString()
    };

    await db.collection('orders').insertOne(newOrder);
    const { _id, ...orderOut } = newOrder;
    res.status(201).json(orderOut);
  } catch (err) {
    console.error('Error placing order:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PATCH update order status
app.patch('/api/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['Pending', 'Preparing', 'Ready', 'Completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid order status.' });
    }

    const result = await db.collection('orders').findOneAndUpdate(
      { id },
      { $set: { status } },
      { returnDocument: 'after', projection: { _id: 0 } }
    );

    if (!result) return res.status(404).json({ error: 'Order not found.' });
    res.json(result);
  } catch (err) {
    console.error('Error updating order status:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─── Catch-all → Customer Page ────────────────────────────────────────────────
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Helper: extract Cloudinary public_id from URL ───────────────────────────
function extractCloudinaryPublicId(url) {
  try {
    // URL format: https://res.cloudinary.com/<cloud>/image/upload/v123/<folder>/<filename>.<ext>
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// ─── Start Server ─────────────────────────────────────────────────────────────
connectDB()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Lassi Shop server is running on http://0.0.0.0:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });
