const mongoose = require('mongoose');

let cached = global._mongoConn;
if (!cached) cached = global._mongoConn = { conn: null, promise: null };

async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGODB_URI, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000
    }).then(m => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = connectDB;
