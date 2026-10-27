import mongoose from 'mongoose';
import { env } from './env.js';

let isConnected = false;

export async function connectDB(retries = 3, delay = 2000) {
  if (isConnected || mongoose.connection.readyState === 1) {
    isConnected = true;
    return;
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const conn = await mongoose.connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 15000,
        autoIndex: true,
      });

      isConnected = true;
      console.log(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
      return;
    } catch (err) {
      console.error(`❌ MongoDB Connection Error (attempt ${attempt}/${retries}):`, err.message);
      if (attempt < retries) {
        console.log(`🔄 Retrying MongoDB connection in ${delay / 1000}s...`);
        await new Promise((res) => setTimeout(res, delay));
      } else {
        if (env.NODE_ENV === 'production') {
          process.exit(1);
        } else {
          console.warn('⚠️ Could not establish MongoDB connection after retries.');
        }
      }
    }
  }

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    console.warn('⚠️ MongoDB disconnected.');
  });

  mongoose.connection.on('reconnected', () => {
    isConnected = true;
    console.log('🔄 MongoDB reconnected.');
  });
}

export function disconnectDB() {
  return mongoose.disconnect();
}
