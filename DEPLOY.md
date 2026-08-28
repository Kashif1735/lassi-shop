# Lassi Shop — Deployment Guide
## Stack: GitHub → Vercel · Supabase · Cloudinary

---

## What You Need (All Free)

| Service | Purpose | Sign up |
|---|---|---|
| GitHub | Store & deploy your code | github.com |
| Vercel | Host frontend + API | vercel.com |
| Supabase | PostgreSQL database | supabase.com |
| Cloudinary | Image storage | Already done ✅ (`adja4ma4`) |

---

## STEP 1 — Set Up Supabase Database

### 1a. Create a Project
1. Go to **https://supabase.com** → Sign up / Log in
2. Click **New Project** → give it a name like `lassi-shop` → set a password → Create

### 1b. Create the 3 Tables
Go to **SQL Editor** (left sidebar) → click **New Query** → paste this entire block and click **Run**:

```sql
-- MENU table
CREATE TABLE menu (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,
  price       NUMERIC NOT NULL,
  description TEXT DEFAULT '',
  image       TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ORDERS table
CREATE TABLE orders (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number   TEXT NOT NULL,
  customer_name  TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  table_number   TEXT DEFAULT 'Takeaway',
  items          JSONB NOT NULL,
  total          NUMERIC NOT NULL,
  status         TEXT DEFAULT 'Pending',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- TABLES table
CREATE TABLE tables (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  number     TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default menu items (uses your Cloudinary cloud name)
INSERT INTO menu (name, category, price, description, image) VALUES
  ('Alphonso Mango Lassi',    'Lassi',  120, 'Creamy yogurt drink blended with sweet Alphonso mango pulp, saffron, and cardamoms, topped with chopped pistachios.',          'https://res.cloudinary.com/adja4ma4/image/upload/f_auto,q_auto/mango_lassi'),
  ('Classic Sweet Lassi',     'Lassi',   90, 'Traditional Punjabi lassi churned with fresh yogurt, sweet cream (malai), and a hint of rose water.',                           'https://res.cloudinary.com/adja4ma4/image/upload/f_auto,q_auto/sweet_lassi'),
  ('Royal Kesar Pista Lassi', 'Lassi',  140, 'Luxurious saffron and pistachio infused lassi, garnished with slivered almonds, pistachios, and saffron strands.',              'https://res.cloudinary.com/adja4ma4/image/upload/f_auto,q_auto/kesar_pista'),
  ('Fragrant Rose Lassi',     'Lassi',  110, 'Refreshing, fragrant lassi blended with organic rose syrup, cream, and topped with aromatic rose petals.',                     'https://res.cloudinary.com/adja4ma4/image/upload/f_auto,q_auto/rose_lassi'),
  ('Punjabi Samosa (2 pcs)',  'Snacks',  70, 'Crispy golden pastry triangles stuffed with spiced potatoes and green peas, served with sweet tamarind and mint chutneys.',    'https://res.cloudinary.com/adja4ma4/image/upload/f_auto,q_auto/samosa'),
  ('Packaged Water Bottle',   'Drinks',  20, 'Chilled, pure packaged drinking water.',                                                                                        'https://res.cloudinary.com/adja4ma4/image/upload/f_auto,q_auto/water_bottle');
```

### 1c. Get Your API Keys
1. Go to **Project Settings** (gear icon, bottom left) → **API**
2. Copy two values:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **service_role** key (under "Project API keys") — the long secret one

---

## STEP 2 — Push Code to GitHub

### 2a. Install Git (if not installed)
Download from: **https://git-scm.com/download/win**

### 2b. Create a GitHub Repository
1. Go to **https://github.com** → Log in → click **+** → **New repository**
2. Name: `lassi-shop` → set to **Private** → click **Create repository**

### 2c. Push from Your PC
Open PowerShell inside your project folder and run these one by one:

```powershell
git init
git add .
git commit -m "Lassi Shop - Vercel + Supabase ready"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/lassi-shop.git
git push -u origin main
```

> When it asks for a password, use a **Personal Access Token** (not your GitHub password):
> GitHub → Settings → Developer Settings → Personal Access Tokens → Tokens (classic) → Generate new token → check `repo` → copy the token → use it as your password

---

## STEP 3 — Deploy on Vercel

### 3a. Connect GitHub to Vercel
1. Go to **https://vercel.com** → Sign up with GitHub (recommended)
2. Click **Add New Project**
3. Find `lassi-shop` in the list → click **Import**

### 3b. Configure the Project
On the configuration screen:
- **Framework Preset**: select **Other**
- **Root Directory**: leave as `/` (default)
- **Build Command**: leave blank (or `echo done`)
- **Output Directory**: type `public`

### 3c. Add Environment Variables
Still on the same screen, scroll to **Environment Variables** and add these 5:

| Name | Value |
|---|---|
| `SUPABASE_URL` | `https://your-project-id.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | your service_role key from Supabase |
| `CLOUDINARY_CLOUD_NAME` | `adja4ma4` |
| `CLOUDINARY_API_KEY` | your Cloudinary API key |
| `CLOUDINARY_API_SECRET` | your Cloudinary API secret |

### 3d. Deploy
Click **Deploy**. Vercel builds and deploys in about 30 seconds.

You'll get a live URL like: `https://lassi-shop-xyz.vercel.app`

---

## STEP 4 — Verify Everything Works

Open your Vercel URL in the browser:

| URL | Expected |
|---|---|
| `https://lassi-shop-xyz.vercel.app/` | Customer ordering page with menu items |
| `https://lassi-shop-xyz.vercel.app/admin.html` | Admin dashboard |
| `https://lassi-shop-xyz.vercel.app/api/menu` | JSON list of menu items |

---

## STEP 5 — QR Codes After Going Live

Open the admin panel at your **Vercel URL**:
```
https://lassi-shop-xyz.vercel.app/admin.html
```

Go to **Tables & QRs** → Register tables → click **QR Code**.
The QR will encode `https://lassi-shop-xyz.vercel.app/?table=X` — the correct public URL any phone can scan.

---

## Updating the App Later

Whenever you make changes in VS Code:

```powershell
git add .
git commit -m "describe your change"
git push
```

Vercel auto-detects the push and **redeploys in seconds** — no manual steps needed.

---

## Cloudinary — Where to Find Your API Key

1. Log into **https://cloudinary.com**
2. Dashboard → top right shows **Cloud Name**, **API Key**, **API Secret**
3. Click the eye icon next to API Secret to reveal it

---

## Supabase — Row Level Security Note

By default Supabase enables Row Level Security (RLS) which blocks all API access.
The code uses the `service_role` key which **bypasses RLS** — this is safe because
the key is only on the server (Vercel environment variables), never sent to the browser.

---

## Summary — 3 Things You Need Right Now

1. **Supabase** — create project + run the SQL above + copy URL and service_role key
2. **GitHub** — create repo + push code
3. **Vercel** — import repo + add 5 env vars + deploy
