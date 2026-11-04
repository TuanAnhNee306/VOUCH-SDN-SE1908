// Isolated creation-only demo: never connects to the configured project database.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('node:assert/strict');
// The normal app reads dotenv in config/env; suppress it only in this isolated runner.
require('dotenv').config = () => ({ parsed: {} });
process.env.MAIL_MODE = 'console';
process.env.PAYMENT_SIMULATOR = 'false';
process.env.CORS_ORIGIN = 'http://localhost:5183,http://127.0.0.1:5183';
process.env.JWT_ACCESS_SECRET = crypto.randomBytes(32).toString('hex');
process.env.JWT_REFRESH_SECRET = crypto.randomBytes(32).toString('hex');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');
const M = require('../src/models');
const { createApp } = require('../src/app');
const { foldVietnamese } = require('../src/services/rules');
const artifactDir = path.resolve(__dirname, '../../artifacts/voucher-creation-demo');
(async () => {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('voucher_creation_demo'));
  assert.equal(mongoose.connection.name, 'voucher_creation_demo');
  await Promise.all(Object.values(M).map(model => model.init()));
  // Only minimal demo identity/brand/store fixtures, no Orders or VoucherItems.
  const passwordHash = await bcrypt.hash('Voucher@123', 10);
  const owner = await M.User.create({ email: 'owner@highlands.local', fullName: 'Chủ Highlands (demo riêng)', role: 'BRAND_OWNER', status: 'ACTIVE', passwordHash });
  await M.User.create({ email: 'owner@phuclong.local', fullName: 'Owner ngoài Brand (test quyền)', role: 'BRAND_OWNER', status: 'ACTIVE', passwordHash });
  await M.User.create({ email: 'admin@voucher.local', fullName: 'Admin (demo riêng)', role: 'ADMIN', status: 'ACTIVE', passwordHash });
  const category = await M.Category.create({ name: 'Mua sắm', displayOrder: 1 });
  const brand = await M.Brand.create({ name: 'Highlands Coffee', ownerUserId: owner._id, categoryId: category._id, status: 'APPROVED', approvedAt: new Date(), description: 'Brand mẫu dùng riêng cho demo kỹ thuật, không phải chương trình kinh doanh thật.' });
  const store = await M.Store.create({ brandId: brand._id, name: 'Highlands Lê Lợi (Demo)', address: 'Chi nhánh mẫu trong database test', status: true });
  const server = createApp().listen(3101, '127.0.0.1', () => {
    fs.mkdirSync(artifactDir, { recursive: true });
    fs.writeFileSync(path.join(artifactDir, 'runtime.json'), JSON.stringify({ backend: 'http://127.0.0.1:3101', frontend: 'http://localhost:5183', database: mongoose.connection.name, brandId: String(brand._id), storeId: String(store._id), accounts: { owner: owner.email, admin: 'admin@voucher.local' } }, null, 2));
    console.log('DEMO_READY backend=3101 database=voucher_creation_demo frontend=5183');
  });
  // Read-only database evidence. No endpoint can mutate workflow or bypass approval.
  const evidenceTimer = setInterval(async () => {
    try {
      const campaigns = await M.Campaign.find().lean();
      const totals = {};
      for (const key of ['Order', 'Payment', 'VoucherItem', 'RedemptionLog', 'PaymentRefund']) totals[key] = await M[key].countDocuments();
      fs.writeFileSync(path.join(artifactDir, 'database-evidence.json'), JSON.stringify({ database: mongoose.connection.name, capturedAt: new Date(), campaigns, totals }, null, 2));
    } catch (e) { console.error('Evidence capture:', e.message); }
  }, 1000);
  async function stop() { clearInterval(evidenceTimer); await new Promise(r => server.close(r)); await mongoose.disconnect(); await mongo.stop(); process.exit(0); }
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
})().catch(e => { console.error(e); process.exit(1); });
