const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const M = require('../src/models');
const manifest = require('../data/deploy-catalog.json');
const { importCatalog, validateManifest, id } = require('../src/import-deploy-catalog');
let mongo;
before(async () => { mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri('vouch_web_test')); });
after(async () => { await mongoose.disconnect(); await mongo?.stop(); });
test('Manifest validates all 32 two-type campaigns and local brand assets', () => {
  validateManifest();
  assert.equal(manifest.campaigns.length, 32);
  for (const brand of manifest.brands) assert.ok(fs.existsSync(path.join(__dirname, '../../frontend/public', brand.logo)), brand.logo);
});
test('Dry-run does not write; retry import preserves stock, dates, hashes and accounts', async () => {
  await importCatalog();
  assert.equal(await M.User.countDocuments(), 0);
  await importCatalog({ apply: true, password: 'test-private-password', customerEmail: 'customer@example.test' });
  assert.equal(await M.Campaign.countDocuments(), 32);
  assert.equal(await M.Campaign.countDocuments({ voucherType: 'DISCOUNT' }), 16);
  assert.equal(await M.Campaign.countDocuments({ voucherType: 'CASHBACK' }), 16);
  const campaign = await M.Campaign.findById(id(manifest.campaigns[0].key));
  await M.Campaign.updateOne({ _id: campaign._id }, { soldQuantity: 2, reservedQuantity: 1, purchaseCounts: { customer: 2 } });
  const account = await M.User.findOne({ email: 'admin@voucher.local' });
  const before = await M.Campaign.findById(campaign._id).lean();
  await importCatalog({ apply: true, password: 'different-password' });
  const after = await M.Campaign.findById(campaign._id).lean();
  // Mongoose timestamps may change on no-op upsert, benefits and stock must not.
  for (const key of ['soldQuantity', 'reservedQuantity', 'purchaseCounts', 'saleStartAt', 'saleEndAt', 'voucherExpireAt']) assert.deepEqual(after[key], before[key]);
  assert.equal((await M.User.findById(account._id)).passwordHash, account.passwordHash);
  assert.equal(await M.AuditLog.countDocuments({ action: 'DEPLOY_CATALOG_IMPORT' }), 32);
  assert.equal(await M.Campaign.countDocuments(), 32);
});
test('Importer refuses to mix foreign campaigns without deleting them', async () => {
  const row = await M.Campaign.findOne({});
  const foreign = await M.Campaign.create({ ...row.toObject(), _id: new mongoose.Types.ObjectId(), title: 'Existing protected campaign' });
  await assert.rejects(importCatalog({ apply: true }), /outside this manifest/);
  assert.ok(await M.Campaign.exists({ _id: foreign._id }));
});
test('Discount order snapshots minimum and cap; small invoice never consumes QR', async () => {
  const customer = await M.User.findOne({ role: 'CUSTOMER' });
  const campaign = await M.Campaign.findById(id('DC-HIGHLANDS-20'));
  const orders = require('../src/services/order');
  const redeem = require('../src/services/redeem');
  const result = await orders.createOrder(customer._id, { campaignId: campaign._id, quantity: 1 });
  assert.equal(result.order.benefitSnapshot.minOrderValue, 80000);
  assert.equal(result.order.benefitSnapshot.discountValue, 20);
  await orders.processPayment({ orderId: result.order.id, gatewayTxnId: 'DEPLOY-DISCOUNT-TEST', amount: result.order.totalAmount, success: true });
  const item = await M.VoucherItem.findOne({ orderId: result.order.id });
  const token = await redeem.requestToken(customer._id, item._id);
  const employee = await M.User.findOne({ role: 'STORE_STAFF' });
  const input = { storeId: campaign.storeIds[0], qrPayload: token.qrPayload };
  await assert.rejects(redeem.redeem(employee._id, { ...input, billAmount: 79999 }), { code: 'BILL_TOO_SMALL' });
  const record = await M.RedeemToken.findOne({ voucherItemId: item._id });
  assert.equal(record.usedAt, null);
  // Future edits to campaign cannot alter a benefit already purchased.
  await M.Campaign.updateOne({ _id: campaign._id }, { discountValue: 1, minOrderValue: 999999 });
  const used = await redeem.redeem(employee._id, { ...input, billAmount: 200000 });
  assert.equal(used.discountAmount, 30000);
  assert.equal(used.status, 'USED');
  await assert.rejects(redeem.updateBill(employee._id, used.redemptionLogId, 50000), { code: 'BILL_TOO_SMALL' });
  await assert.rejects(redeem.redeem(employee._id, { ...input, billAmount: 200000 }));
});
test('Production DB rejects missing URI and embedded mode without connecting', async () => {
  const prior = { mode: process.env.NODE_ENV, uri: process.env.MONGO_URI, embedded: process.env.USE_EMBEDDED_MONGO };
  try {
    process.env.NODE_ENV = 'production'; delete process.env.MONGO_URI;
    await assert.rejects(require('../src/config/db').connectDb(), /Production requires/);
    process.env.MONGO_URI = 'mongodb://not-used.test/vouch_web_test'; process.env.USE_EMBEDDED_MONGO = 'true';
    await assert.rejects(require('../src/config/db').connectDb(), /Production requires/);
  } finally {
    for (const [key, value] of Object.entries({ NODE_ENV: prior.mode, MONGO_URI: prior.uri, USE_EMBEDDED_MONGO: prior.embedded })) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
test('Production startup rejects unsafe default signing secrets', () => {
  const keys = ['NODE_ENV', 'MONGO_URI', 'USE_EMBEDDED_MONGO', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'OTP_SECRET', 'REDEEM_HMAC_SECRET', 'PAYMENT_WEBHOOK_SECRET', 'CORS_ORIGIN', 'WEB_APP_URL'];
  const prior = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  try {
    process.env.NODE_ENV = 'production'; process.env.MONGO_URI = 'mongodb://unused.test/vouch_web_test'; process.env.USE_EMBEDDED_MONGO = 'false';
    process.env.CORS_ORIGIN = process.env.WEB_APP_URL = 'https://vouch.example.test';
    for (const key of keys.slice(3, 8)) process.env[key] = require('crypto').randomBytes(32).toString('hex');
    const { validateProduction } = require('../src/config/production');
    validateProduction();
    process.env.JWT_ACCESS_SECRET = 'change_me_access_secret';
    assert.throws(validateProduction, /JWT_ACCESS_SECRET/);
  } finally { for (const [key, value] of Object.entries(prior)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
});
test('Resend HTTPS sends real payload contract, no console fallback on rejection', async () => {
  const previous = { mode: process.env.MAIL_MODE, key: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM };
  process.env.MAIL_MODE = 'resend'; process.env.RESEND_API_KEY = 'test-only'; process.env.EMAIL_FROM = 'Vouch <test@example.test>';
  const calls = [];
  const fetchMock = mock.method(global, 'fetch', async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ id: 'test-message' }) }; });
  try {
    const mail = require('../src/services/mail');
    await mail.sendOtp('recipient@example.test', '123456');
    assert.equal(calls[0].url, 'https://api.resend.com/emails');
    const body = JSON.parse(calls[0].options.body);
    assert.deepEqual(body.to, ['recipient@example.test']);
    assert.match(body.text, /123456/);
    assert.doesNotMatch(body.subject, /123456/);
    fetchMock.mock.mockImplementation(async () => ({ ok: false }));
    await assert.rejects(mail.sendOtp('recipient@example.test', '123456'), { code: 'MAIL_FAILED' });
    delete process.env.RESEND_API_KEY;
    assert.throws(mail.assertOtpConfigured, { code: 'MAIL_NOT_CONFIGURED' });
  } finally {
    fetchMock.mock.restore();
    for (const [key, value] of Object.entries({ MAIL_MODE: previous.mode, RESEND_API_KEY: previous.key, EMAIL_FROM: previous.from })) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
