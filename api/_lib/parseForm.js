/**
 * Parse multipart/form-data and application/json bodies
 * for Vercel serverless functions (no Express, no multer).
 * Uses the built-in `busboy` which ships with Node.js >= 18.
 */
const Busboy = require('busboy');

/**
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<{ fields: Record<string, string>, file?: { buffer: Buffer, filename: string, mimetype: string } }>}
 */
function parseForm(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';

    // ── JSON body ─────────────────────────────────────────────────────────────
    if (contentType.includes('application/json')) {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          resolve({ fields: JSON.parse(body || '{}'), file: undefined });
        } catch (e) {
          reject(new Error('Invalid JSON body'));
        }
      });
      req.on('error', reject);
      return;
    }

    // ── Multipart form ────────────────────────────────────────────────────────
    if (contentType.includes('multipart/form-data')) {
      const bb = Busboy({ headers: req.headers });
      const fields = {};
      let file;

      bb.on('field', (name, value) => {
        fields[name] = value;
      });

      bb.on('file', (fieldname, stream, info) => {
        const chunks = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => {
          file = {
            buffer: Buffer.concat(chunks),
            filename: info.filename,
            mimetype: info.mimeType
          };
        });
      });

      bb.on('finish', () => resolve({ fields, file }));
      bb.on('error', reject);

      req.pipe(bb);
      return;
    }

    // ── URL-encoded ───────────────────────────────────────────────────────────
    if (contentType.includes('application/x-www-form-urlencoded')) {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        const fields = Object.fromEntries(new URLSearchParams(body));
        resolve({ fields, file: undefined });
      });
      req.on('error', reject);
      return;
    }

    // Fallback — empty
    resolve({ fields: {}, file: undefined });
  });
}

module.exports = { parseForm };
