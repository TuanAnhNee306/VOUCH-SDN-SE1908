process.env.MAIL_MODE = 'smtp';
process.env.SMTP_USER = 'sender@example.test';
process.env.SMTP_PASS = 'test-only';
process.env.OTP_SECRET = require('crypto').randomBytes(32).toString('hex');
const { test, before, beforeEach, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');
const sent = [];
mock.method(require('nodemailer'), 'createTransport', () => ({ sendMail: async message => { sent.push(message); return { accepted: [message.to] }; } }));
const M = require('../src/models');
const auth = require('../src/services/auth');
const roles = ['CUSTOMER', 'ADMIN', 'BRAND_OWNER', 'STORE_STAFF'];
const email = role => `${role.toLowerCase()}@example.test`;
let mongo;
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('auth_test'));
  await Promise.all(Object.values(M).filter(model => model.init).map(model => model.init()));
  const passwordHash = await bcrypt.hash('Voucher@123', 10);
  await M.User.insertMany(roles.map(role => ({ email: email(role), role, status: 'ACTIVE', passwordHash })));
});
beforeEach(async () => {
  sent.length = 0;
  await Promise.all([M.LoginOtp.deleteMany({}), M.AuthLimit.deleteMany({}), M.Session.deleteMany({}), M.AuditLog.deleteMany({}), M.User.updateMany({}, { status: 'ACTIVE' })]);
});
after(async () => { await mongoose.disconnect(); await mongo?.stop(); });
async function challenge() {
  const result = await auth.requestOtp(email('CUSTOMER'), 'test');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(result.devOtp, undefined);
  return sent.at(-1).text.match(/\b\d{6}\b/)[0];
}
test('Customer OTP creates one session, rotates refresh and logs out', async () => {
  const code = await challenge();
  const result = await auth.verifyOtp(email('CUSTOMER'), code, 'device', 'test');
  assert.equal(result.user.role, 'CUSTOMER');
  await assert.rejects(auth.verifyOtp(email('CUSTOMER'), code, null, 'test'));
  const refreshed = await auth.refresh(result.refreshToken);
  await assert.rejects(auth.refresh(result.refreshToken));
  const session = await M.Session.findOne({});
  await auth.logout(result.user.id, session._id);
  await assert.rejects(auth.refresh(refreshed.refreshToken));
});
test('All three management roles retain password login; Customer cannot use it', async () => {
  for (const role of roles.slice(1)) assert.equal((await auth.login(email(role), 'Voucher@123')).user.role, role);
  await assert.rejects(auth.login(email('CUSTOMER'), 'Voucher@123'));
});
test('Management and unknown emails receive identical OTP response without delivery or account creation', async () => {
  const count = await M.User.countDocuments();
  const generic = await auth.requestOtp('unknown@example.test', 'test');
  for (const role of roles.slice(1)) {
    assert.deepEqual(await auth.requestOtp(email(role), 'test'), generic);
    await assert.rejects(auth.verifyOtp(email(role), '123456', null, 'test'));
  }
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(sent.length, 0);
  assert.equal(await M.User.countDocuments(), count);
  assert.equal(await M.Session.countDocuments(), 0);
});
test('Legacy management OTP cannot issue tokens even with correct hash', async () => {
  const user = await M.User.findOne({ role: 'ADMIN' });
  const hash = value => crypto.createHmac('sha256', process.env.OTP_SECRET).update(value).digest('hex');
  const key = hash(`email:${user.email}`);
  await M.LoginOtp.create({ _id: key, userId: user._id, nonce: 'legacy', codeHash: hash(`${key}:legacy:123456`), expiresAt: new Date(Date.now() + 300000), nextRequestAt: new Date() });
  await assert.rejects(auth.verifyOtp(user.email, '123456', null, 'test'));
  assert.equal(await M.Session.countDocuments(), 0);
});
test('OTP is hashed and rejects wrong attempts, including parallel attempts beyond five', async () => {
  const code = await challenge();
  const record = await M.LoginOtp.findOne({});
  assert.equal(record.codeHash.length, 64);
  assert.equal(JSON.stringify(record).includes(code), false);
  const wrong = code === '111111' ? '222222' : '111111';
  const results = await Promise.allSettled(Array.from({ length: 8 }, () => auth.verifyOtp(email('CUSTOMER'), wrong, null, 'test')));
  assert.ok(results.every(r => r.status === 'rejected'));
  assert.equal((await M.LoginOtp.findOne({})).attempts, 5);
  await assert.rejects(auth.verifyOtp(email('CUSTOMER'), code, null, 'test'));
});
test('Expiry and disabled Customer block valid codes', async () => {
  const code = await challenge();
  await M.LoginOtp.updateMany({}, { expiresAt: new Date(Date.now() - 1) });
  await assert.rejects(auth.verifyOtp(email('CUSTOMER'), code, null, 'test'));
  await M.LoginOtp.updateMany({}, { expiresAt: new Date(Date.now() + 300000) });
  await M.User.updateOne({ role: 'CUSTOMER' }, { status: 'INACTIVE' });
  await assert.rejects(auth.verifyOtp(email('CUSTOMER'), code, null, 'test'));
});
test('Parallel correct verification consumes code once', async () => {
  const code = await challenge();
  const results = await Promise.allSettled(Array.from({ length: 4 }, () => auth.verifyOtp(email('CUSTOMER'), code, null, 'test')));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(await M.Session.countDocuments(), 1);
});
test('Resend cooldown, invalidation and email rate limit', async () => {
  const old = await challenge();
  await assert.rejects(auth.requestOtp(email('CUSTOMER'), 'test'), { code: 'OTP_RESEND_COOLDOWN' });
  await M.LoginOtp.updateMany({}, { nextRequestAt: new Date(0) });
  const fresh = await challenge();
  assert.notEqual(old, fresh);
  await assert.rejects(auth.verifyOtp(email('CUSTOMER'), old, null, 'test'));
  assert.equal((await auth.verifyOtp(email('CUSTOMER'), fresh, null, 'test')).user.role, 'CUSTOMER');
  for (let i = 0; i < 2; i++) { await M.LoginOtp.updateMany({}, { nextRequestAt: new Date(0) }); await auth.requestOtp(email('CUSTOMER'), 'test'); }
  await assert.rejects(auth.requestOtp(email('CUSTOMER'), 'test'), { code: 'OTP_RATE_LIMITED' });
});
test('IP rate limit covers unknown addresses too', async () => {
  for (let i = 0; i < 30; i++) await auth.requestOtp(`unknown${i}@example.test`, 'same-ip');
  await assert.rejects(auth.requestOtp('another@example.test', 'same-ip'), { code: 'OTP_RATE_LIMITED' });
});
test('Missing SMTP never simulates delivery; management password login remains available', async () => {
  const previous = process.env.MAIL_MODE;
  try {
    process.env.MAIL_MODE = 'console';
    await assert.rejects(auth.requestOtp(email('CUSTOMER'), 'test'), { code: 'MAIL_NOT_CONFIGURED' });
    assert.equal((await auth.login(email('ADMIN'), 'Voucher@123')).user.role, 'ADMIN');
  } finally { process.env.MAIL_MODE = previous; }
});
test('Management password failures lock after five attempts and inactive accounts cannot login', async () => {
  for (let i = 0; i < 5; i++) await assert.rejects(auth.login(email('ADMIN'), 'wrong'));
  await assert.rejects(auth.login(email('ADMIN'), 'Voucher@123'), { code: 'LOGIN_LOCKED' });
  await M.User.updateOne({ role: 'BRAND_OWNER' }, { status: 'INACTIVE' });
  await assert.rejects(auth.login(email('BRAND_OWNER'), 'Voucher@123'));
});

test('HTTP APIs ignore client-supplied roles and preserve session/RBAC', async () => {
  const server = require('../src/app').createApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const post = async (path, body) => {
    const response = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  try {
    const request = await post('/auth/otp/request', { email: email('ADMIN'), role: 'CUSTOMER' });
    assert.equal(request.status, 200);
    assert.equal(request.body.accessToken, undefined);
    assert.equal((await post('/auth/otp/verify', { email: email('ADMIN'), otp: '123456', role: 'CUSTOMER' })).status, 401);
    assert.equal((await post('/auth/login', { email: email('CUSTOMER'), password: 'Voucher@123', role: 'ADMIN' })).status, 401);
    const code = await challenge();
    const verified = await post('/auth/otp/verify', { email: email('CUSTOMER'), otp: code, role: 'ADMIN' });
    assert.equal(verified.status, 200);
    assert.equal(verified.body.user.role, 'CUSTOMER');
    const me = await fetch(base + '/auth/me', { headers: { authorization: `Bearer ${verified.body.accessToken}` } });
    assert.equal(me.status, 200);
    const restricted = await fetch(base + '/auth/select-store', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${verified.body.accessToken}` }, body: '{}' });
    assert.equal(restricted.status, 403);
    for (const role of roles.slice(1)) {
      const result = await post('/auth/login', { email: email(role), password: 'Voucher@123', role: 'CUSTOMER' });
      assert.equal(result.status, 200);
      assert.equal(result.body.user.role, role);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});
