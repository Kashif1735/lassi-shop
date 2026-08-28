module.exports = function handler(req, res) {
  res.json({
    ok: true,
    env: {
      supabase_url:      !!process.env.SUPABASE_URL,
      supabase_key:      !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      cloudinary_name:   !!process.env.CLOUDINARY_CLOUD_NAME,
      cloudinary_key:    !!process.env.CLOUDINARY_API_KEY,
      cloudinary_secret: !!process.env.CLOUDINARY_API_SECRET
    }
  });
};
