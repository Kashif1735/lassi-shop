const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload a file buffer to Cloudinary.
 * @param {Buffer} buffer - File data
 * @param {string} filename - Original filename (used as public_id base)
 * @returns {Promise<string>} Secure URL of the uploaded image
 */
function uploadToCloudinary(buffer, filename) {
  return new Promise((resolve, reject) => {
    // Strip extension for public_id
    const publicId = filename.replace(/\.[^/.]+$/, '').replace(/\s+/g, '_');

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        overwrite: true,
        transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }]
      },
      (error, result) => {
        if (error) return reject(error);
        // Use f_auto,q_auto URL for best performance
        const url = cloudinary.url(result.public_id, {
          fetch_format: 'auto',
          quality: 'auto'
        });
        resolve(url);
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Delete an image from Cloudinary by its full URL.
 * Silently ignores errors.
 */
async function deleteFromCloudinary(imageUrl) {
  if (!imageUrl) return;
  try {
    const match = imageUrl.match(/\/upload\/(?:v\d+\/|f_auto,q_auto\/)?(.+?)(?:\.[a-z]+)?$/i);
    if (match) await cloudinary.uploader.destroy(match[1]);
  } catch (_) {
    // Non-fatal — image may already be gone
  }
}

module.exports = { uploadToCloudinary, deleteFromCloudinary };
