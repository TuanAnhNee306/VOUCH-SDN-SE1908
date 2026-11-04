const crypto = require('crypto');
const { User, LoginOtp, AuthLimit } = require('../models');
const { AppError, badRequest, unauthorized, tooMany } = require('../utils/errors');
const { str } = require('../config/env');
const mail = require('./mail');

const MINUTE = 60000;
const HOUR = 60 * MINUTE;
const RESPONSE = { message: 'Nếu email thuộc tài khoản đang hoạt động, mã xác thực sẽ được gửi. Vui lòng kiểm tra hộp thư.', expiresInSeconds: 300, resendAfterSeconds: 60 };
const fail = () => unauthorized('Mã OTP không hợp lệ, đã hết hạn hoặc đã vượt số lần thử. Vui lòng yêu cầu mã mới.');

function secret() {
  const value = str('OTP_SECRET');
  if (value.length < 32) throw new AppError(503, 'OTP_NOT_CONFIGURED', 'Hệ thống chưa cấu hình OTP_SECRET (ít nhất 32 ký tự). Vui lòng liên hệ quản trị viên.');
  return value;
}
const digest = value => crypto.createHmac('sha256', secret()).update(value).digest('hex');
function emailOf(value) {
  const email = String(value || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw badRequest('Email không hợp lệ.');
  return email;
}

async function limit(scope, identity, maximum) {
  const bucket = Math.floor(Date.now() / HOUR);
  const _id = `${scope}:${digest(identity)}:${bucket}`;
  let record;
  try {
    record = await AuthLimit.findOneAndUpdate({ _id, count: { $lt: maximum } }, {
      $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 1) * HOUR) },
    }, { upsert: true, new: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  if (!record) throw tooMany('OTP_RATE_LIMITED', 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.', { retryAfterSeconds: Math.ceil(((bucket + 1) * HOUR - Date.now()) / 1000) });
}

async function requestOtp(rawEmail, ip) {
  const email = emailOf(rawEmail);
  secret();
  mail.assertOtpConfigured(); // Identical configuration error even for unknown emails.
  await limit('request-ip', ip || 'unknown', 30);
  await limit('request-email', email, 5);
  const now = new Date();
  const key = digest(`email:${email}`);
  const nonce = crypto.randomBytes(24).toString('hex');
  const previous = await LoginOtp.findById(key);
  let code;
  do { code = crypto.randomInt(100000, 1000000).toString(); }
  while (previous && digest(`${key}:${previous.nonce}:${code}`) === previous.codeHash);
  const user = await User.findOne({ email, status: 'ACTIVE', role: 'CUSTOMER' });
  try {
    await LoginOtp.findOneAndUpdate({ _id: key, nextRequestAt: { $lte: now } }, { $set: {
      userId: user?._id || null, nonce, codeHash: digest(`${key}:${nonce}:${code}`), attempts: 0,
      expiresAt: new Date(now.getTime() + 5 * MINUTE), nextRequestAt: new Date(now.getTime() + MINUTE), usedAt: null,
    } }, { upsert: true, new: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
    // This also applies to unknown/disabled accounts: never reveal existence.
    throw tooMany('OTP_RESEND_COOLDOWN', 'Vui lòng chờ ít nhất 60 giây trước khi yêu cầu mã mới.', { retryAfterSeconds: 60 });
  }
  if (user) {
    // Keep SMTP latency out of the public response to avoid exposing account roles.
    Promise.resolve().then(() => mail.sendOtp(email, code)).catch(async () => {
      try { await LoginOtp.updateOne({ _id: key, nonce }, { $set: { usedAt: new Date() } }); } catch { /* challenge expires */ }
      // Delivery failures must not turn this into an account-enumeration endpoint.
      console.warn('[auth] OTP delivery failed; challenge invalidated.');
    });
  }
  return { ...RESPONSE };
}

async function verifyOtp(rawEmail, rawCode, deviceId, ip) {
  const email = emailOf(rawEmail);
  secret();
  await limit('verify-ip', ip || 'unknown', 100);
  await limit('verify-email', email, 25);
  const key = digest(`email:${email}`);
  // Reserve an attempt atomically before comparing. Parallel requests can never
  // each observe an old attempts counter and exceed the five-attempt budget.
  const record = await LoginOtp.findOneAndUpdate({ _id: key, usedAt: null, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } }, { $inc: { attempts: 1 } }, { new: true });
  if (!record) throw fail();
  const code = typeof rawCode === 'string' && /^\d{6}$/.test(rawCode) ? rawCode : '';
  const actual = Buffer.from(digest(`${key}:${record.nonce}:${code}`), 'hex');
  const expected = Buffer.from(record.codeHash, 'hex');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw fail();
  const user = record.userId && await User.findOne({ _id: record.userId, email, status: 'ACTIVE', role: 'CUSTOMER' });
  if (!user) throw fail();
  const consumed = await LoginOtp.findOneAndUpdate({ _id: key, nonce: record.nonce, codeHash: record.codeHash, usedAt: null, expiresAt: { $gt: new Date() }, attempts: { $lte: 5 } }, { $set: { usedAt: new Date() } });
  if (!consumed) throw fail();
  // Lazy require avoids a cycle while retaining the existing token/session code.
  return require('./auth').issueTokens(user, deviceId);
}

module.exports = { requestOtp, verifyOtp };
