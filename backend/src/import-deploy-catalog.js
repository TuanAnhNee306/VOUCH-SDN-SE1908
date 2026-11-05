// Explicit deployment target, additive imports only; never invokes old seeds.
require('./config/env');
const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const M = require('./models');
const manifest = require('../data/deploy-catalog.json');
const { foldVietnamese, validateValueFields, validateTimeline } = require('./services/rules');
const id = key => new mongoose.Types.ObjectId(crypto.createHash('sha256').update(`${manifest.version}:${key}`).digest('hex').slice(0, 24));
const slug = name => foldVietnamese(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const ownerEmail = name => name === 'Highlands Coffee' ? 'owner@highlands.local' : `owner+${slug(name)}@voucher.local`;
const terms = type => `${manifest.disclaimer} Một lần sử dụng, không cộng dồn. Áp dụng hóa đơn tối thiểu và trần quyền lợi đã công bố. ${type === 'CASHBACK' ? 'Customer thanh toán đầy đủ hóa đơn; Merchant trực tiếp hoàn tiền bằng tiền mặt hoặc chuyển khoản sau khi xác minh. Marketplace không chi trả Cashback.' : 'Merchant giảm trực tiếp trên hóa đơn đủ điều kiện; số tiền giảm không vượt giá trị hóa đơn.'}`;
function campaignData(row, brandId, storeId, categoryId, now = new Date()) {
  const { key, brand, ...benefits } = row;
  return { ...benefits, title: `${row.title} — ${brand}`, brandId, categoryId, storeIds: [storeId], description: manifest.disclaimer,
    terms: terms(row.voucherType), totalQuantity: 200, limitPerUser: 3, status: 'PUBLISHED',
    saleStartAt: new Date(now.getTime() - 60000), saleEndAt: new Date(now.getTime() + 60 * 86400000), voucherExpireAt: new Date(now.getTime() + 90 * 86400000),
    approvedAt: now, approvedBy: null, searchText: foldVietnamese(`${row.title} ${brand}`) };
}
function validateManifest() {
  if (new Set(manifest.campaigns.map(r => r.key)).size !== manifest.campaigns.length) throw Error('Duplicate campaign keys.');
  if (new Set(manifest.brands.map(r => r.name)).size !== manifest.brands.length) throw Error('Duplicate brands.');
  for (const row of manifest.campaigns) {
    if (!['DISCOUNT', 'CASHBACK'].includes(row.voucherType) || !manifest.brands.some(b => b.name === row.brand) || /combo|mua\s*1\s*tặng\s*1/i.test(row.title)) throw Error('Unsupported campaign.');
    const data = campaignData(row, id(row.brand), id(`store:${row.brand}`), id('category'));
    validateValueFields(data); validateTimeline(data);
  }
}
async function importCatalog({ apply = false, password, customerEmail } = {}) {
  validateManifest();
  if (!mongoose.connection.db) throw Error('Connect to an explicit deployment database first.');
  const allowed = new Set(manifest.campaigns.map(r => String(id(r.key))));
  const campaigns = await M.Campaign.find({}).select('_id voucherType');
  if (campaigns.some(c => !allowed.has(String(c._id)))) throw Error('Database has campaigns outside this manifest. Use a new deployment database; existing data was not changed.');
  const existingUsers = await M.User.find({}).select('email role status');
  const required = [['admin@voucher.local', 'ADMIN'], ['staff@highlands.local', 'STORE_STAFF'], ...manifest.brands.map(b => [ownerEmail(b.name), 'BRAND_OWNER'])];
  if (customerEmail) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) throw Error('Invalid deployment Customer email.');
    required.push([customerEmail.toLowerCase(), 'CUSTOMER']);
  }
  if (new Set(required.map(([email]) => email)).size !== required.length) throw Error('Deployment Customer email conflicts with a management account.');
  for (const [email, role] of required) {
    const user = existingUsers.find(u => u.email === email);
    if (user && (user.role !== role || user.status !== 'ACTIVE')) throw Error('Existing deployment account has an incompatible role/status; refusing to change it.');
  }
  const summary = { database: mongoose.connection.name, apply, brands: manifest.brands.length, campaigns: manifest.campaigns.length, existingCampaigns: campaigns.length,
    discounts: manifest.campaigns.filter(c => c.voucherType === 'DISCOUNT').length, cashbacks: manifest.campaigns.filter(c => c.voucherType === 'CASHBACK').length };
  if (!apply) return summary;
  if (required.some(([email, role]) => role !== 'CUSTOMER' && !existingUsers.some(u => u.email === email)) && (!password || password.length < 8)) throw Error('Set DEPLOY_ACCOUNT_PASSWORD privately (at least 8 characters) to provision new management accounts.');
  const passwordHash = password ? await bcrypt.hash(password, 12) : null;
  // Only setOnInsert: retries never overwrite accounts, stock or timelines.
  for (const [email, role] of required) await M.User.updateOne({ email }, { $setOnInsert: { _id: id(`user:${email}`), email, fullName: role === 'CUSTOMER' ? 'Khách hàng Vouch' : `Vouch Demo ${role}`, role, status: 'ACTIVE', passwordHash: role === 'CUSTOMER' ? null : passwordHash } }, { upsert: true, runValidators: true });
  const categories = new Map();
  for (const name of new Set(manifest.brands.map(b => b.category))) {
    const category = await M.Category.findOneAndUpdate({ name }, { $setOnInsert: { _id: id(`category:${name}`), name, displayOrder: categories.size + 1 } }, { upsert: true, new: true });
    categories.set(name, category._id);
  }
  for (const row of manifest.brands) {
    const owner = await M.User.findOne({ email: ownerEmail(row.name) });
    const brand = await M.Brand.findOneAndUpdate({ name: row.name }, { $setOnInsert: { _id: id(`brand:${row.name}`), ownerUserId: owner._id, name: row.name, logo: row.logo, description: manifest.disclaimer, categoryId: categories.get(row.category), status: 'APPROVED', approvedAt: new Date() } }, { upsert: true, new: true, runValidators: true });
    if (String(brand.ownerUserId) !== String(owner._id) || brand.status !== 'APPROVED') throw Error('Existing brand ownership/status mismatch.');
    const store = await M.Store.findOneAndUpdate({ brandId: brand._id, name: row.store.name }, { $setOnInsert: { _id: id(`store:${row.name}`), ...row.store, brandId: brand._id, status: true, openingHours: '08:00 - 22:00' } }, { upsert: true, new: true, runValidators: true });
    if (!store.status) throw Error('Existing deployment store is inactive.');
    if (row.name === 'Highlands Coffee') {
      const staff = await M.User.findOne({ email: 'staff@highlands.local' });
      await M.StaffAssignment.updateOne({ userId: staff._id, storeId: store._id }, { $setOnInsert: { active: true } }, { upsert: true });
    }
    for (const offer of manifest.campaigns.filter(c => c.brand === row.name)) {
      const _id = id(offer.key);
      const data = campaignData(offer, brand._id, store._id, categories.get(row.category));
      await M.Campaign.updateOne({ _id }, { $setOnInsert: data }, { upsert: true, runValidators: true });
      await M.AuditLog.updateOne({ action: 'DEPLOY_CATALOG_IMPORT', entityType: 'Campaign', entityId: String(_id) }, { $setOnInsert: { detail: { manifest: manifest.version, key: offer.key, source: manifest.source } } }, { upsert: true });
    }
  }
  return summary;
}
async function main() {
  const uri = process.env.DEPLOY_MONGO_URI;
  const expected = process.env.DEPLOY_DB_NAME;
  if (!uri || !expected || !/^vouch_web_[a-z0-9_]+$/.test(expected)) throw Error('Set private DEPLOY_MONGO_URI and explicit DEPLOY_DB_NAME=vouch_web_<name>. No local fallback.');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  if (mongoose.connection.name !== expected) throw Error('Deployment database name does not match. Nothing imported.');
  return importCatalog({ apply: process.argv.includes('--apply'), password: process.env.DEPLOY_ACCOUNT_PASSWORD, customerEmail: process.env.DEPLOY_CUSTOMER_EMAIL });
}
if (require.main === module) main().then(summary => console.log(JSON.stringify(summary))).catch(() => { console.error('Catalog import failed. Check explicit deployment target, manifest and private credentials; no URI logged.'); process.exitCode = 1; }).finally(() => mongoose.disconnect());
module.exports = { importCatalog, validateManifest, campaignData, id };
