const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { str, bool } = require('./env');

let embedded = null;
const EMBEDDED_PORT = 27027;

// Ket noi MONGO_URI; khong ket noi duoc (chua cai MongoDB) thi bat MongoDB nhung, du lieu luu o backend/.mongo-data
async function connectDb() {
  mongoose.set('strictQuery', true);
  if (!bool('USE_EMBEDDED_MONGO')) {
    const uri = str('MONGO_URI', 'mongodb://127.0.0.1:27017/voucher_platform');
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
      console.log(`[db] Da ket noi MongoDB: ${uri.replace(/\/\/[^@]+@/, '//***@')}`);
      return;
    } catch (e) {
      await mongoose.disconnect().catch(() => {});
      console.warn(`[db] Khong ket noi duoc ${uri} (${e.message}). Chuyen sang MongoDB nhung...`);
    }
  }
  // MongoDB nhung co the dang chay san (vd. backend dang chay khi goi `npm run seed`) -> dung chung
  const embeddedUri = `mongodb://127.0.0.1:${EMBEDDED_PORT}/voucher_platform`;
  try {
    await mongoose.connect(embeddedUri, { serverSelectionTimeoutMS: 1500 });
    console.log(`[db] Da ket noi MongoDB nhung dang chay san: ${embeddedUri}`);
    return;
  } catch {
    await mongoose.disconnect().catch(() => {});
  }
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const dbPath = path.join(__dirname, '..', '..', '.mongo-data');
  fs.mkdirSync(dbPath, { recursive: true });
  embedded = await MongoMemoryServer.create({ instance: { dbPath, storageEngine: 'wiredTiger', port: EMBEDDED_PORT } });
  await mongoose.connect(embeddedUri);
  console.log(`[db] Dang dung MongoDB nhung tai ${embeddedUri} (du lieu luu o ${dbPath})`);
}

async function disconnectDb() {
  await mongoose.disconnect();
  if (embedded) await embedded.stop({ doCleanup: false });
}

module.exports = { connectDb, disconnectDb };
