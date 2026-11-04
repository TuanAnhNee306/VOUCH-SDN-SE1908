const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, OtpCode, Session, StaffAssignment, Store, AuditLog } = require('../models');
const { Role, UserStatus, OtpPurpose } = require('../utils/enums');
const { badRequest, unauthorized, tooMany } = require('../utils/errors');
const { str, int } = require('../config/env');
const { sendMail, isConsoleMode, otpEmail } = require('./mail');
const { formatVnDateTime } = require('../utils/time');

const sha = (v) => crypto.createHash('sha256').update(v).digest('hex');
const normalize = (email) => String(email || '').trim().toLowerCase();
const HOUR = 3600 * 1000;
const accessSecret = () => str('JWT_ACCESS_SECRET', 'change_me_access_secret');
const refreshSecret = () => str('JWT_REFRESH_SECRET', 'change_me_refresh_secret');

function assertEmail(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw badRequest('Email không hợp lệ.');
}

async function issueTokens(user, deviceId, previous) {
  const session = previous || new Session({ userId: user._id, deviceId: deviceId || crypto.randomUUID(), tokenHash: 'pending', expiresAt: new Date() });
  const payload = { sub: String(user._id), sid: String(session._id), email: user.email, role: user.role };
  const accessToken = jwt.sign({ ...payload, type: 'access' }, accessSecret(), { expiresIn: str('JWT_ACCESS_EXPIRES_IN', '15m') });
  const refreshToken = jwt.sign({ ...payload, type: 'refresh', jti: crypto.randomUUID() }, refreshSecret(), { expiresIn: '60d' });
  session.tokenHash = sha(refreshToken);
  session.expiresAt = new Date(Date.now() + 60 * 24 * HOUR);
  await session.save();
  return {
    accessToken,
    refreshToken,
    user: { id: String(user._id), email: user.email, role: user.role, fullName: user.fullName ?? null, phone: user.phone ?? null },
    activeStoreId: session.activeStoreId ? String(session.activeStoreId) : null,
  };
}

// ---------- Khach hang: dang nhap bang OTP qua email (FR-AUTH-01..03) ----------

async function requestOtp(rawEmail) {
  const email = normalize(rawEmail);
  assertEmail(email);
  let user = await User.findOne({ email });
  if (!user) user = await User.create({ email, role: Role.CUSTOMER, fullName: email.split('@')[0] });
  if (user.role !== Role.CUSTOMER || user.status !== UserStatus.ACTIVE) {
    throw badRequest('Tài khoản không thể đăng nhập bằng OTP.');
  }
  const max = int('OTP_MAX_REQUESTS_PER_HOUR', 5);
  const count = await OtpCode.countDocuments({ email, purpose: OtpPurpose.LOGIN, createdAt: { $gt: new Date(Date.now() - HOUR) } });
  if (count >= max) {
    throw tooMany('OTP_RATE_LIMITED', `Bạn đã yêu cầu OTP quá ${max} lần trong một giờ. Vui lòng thử lại sau.`);
  }
  const code = crypto.randomInt(100000, 1000000).toString();
  const ttl = int('OTP_TTL_MINUTES', 5);
  const { text, html } = otpEmail(code, ttl);
  // Gui email truoc: gui that bai thi ma cu van dung duoc va khong bi tinh vao gioi han 5 lan / gio
  await sendMail(email, `${code} là mã đăng nhập Voucher Platform`, text, html);
  await OtpCode.updateMany({ email, purpose: OtpPurpose.LOGIN, usedAt: null }, { usedAt: new Date() });
  await OtpCode.create({ email, purpose: OtpPurpose.LOGIN, codeHash: await bcrypt.hash(code, 8), expiresAt: new Date(Date.now() + ttl * 60000) });
  // Chi khi MAIL_MODE=console (phat trien khong co SMTP) moi tra kem ma cho app
  return { message: 'Mã OTP đã được gửi qua email.', expiresInMinutes: ttl, ...(isConsoleMode() ? { devOtp: code } : {}) };
}

async function verifyOtp(rawEmail, otp, deviceId) {
  const email = normalize(rawEmail);
  const fail = () => unauthorized('Mã OTP không hợp lệ, đã hết hạn hoặc đã nhập sai quá 5 lần.');
  const user = await User.findOne({ email });
  if (!user || user.role !== Role.CUSTOMER || user.status !== UserStatus.ACTIVE) throw fail();
  const record = await OtpCode.findOne({ email, purpose: OtpPurpose.LOGIN, usedAt: null }).sort({ createdAt: -1 });
  if (!record || record.expiresAt <= new Date() || record.attempts >= 5) throw fail();
  if (!(await bcrypt.compare(String(otp || ''), record.codeHash))) {
    await OtpCode.updateOne({ _id: record._id }, { $inc: { attempts: 1 } });
    throw fail();
  }
  // Danh dau da dung co dieu kien: hai request cung ma chi mot request thanh cong
  const used = await OtpCode.findOneAndUpdate({ _id: record._id, usedAt: null }, { usedAt: new Date() });
  if (!used) throw fail();
  return issueTokens(user, deviceId);
}

// ---------- Web: chu thuong hieu / nhan vien / quan tri dang nhap bang mat khau ----------

async function login(rawEmail, password, deviceId) {
  const email = normalize(rawEmail);
  const wrong = (extra = '') => unauthorized(`Email hoặc mật khẩu không đúng.${extra}`);
  const user = await User.findOne({ email });
  if (!user) throw wrong();
  if (user.role === Role.CUSTOMER) throw unauthorized('Tài khoản khách hàng đăng nhập bằng mã OTP trên app khách hàng.');
  if (user.status === UserStatus.PENDING_ACTIVATION || !user.passwordHash) {
    throw unauthorized('Tài khoản chưa kích hoạt. Vui lòng mở liên kết kích hoạt trong email.');
  }
  if (user.status !== UserStatus.ACTIVE) throw unauthorized('Tài khoản đã bị vô hiệu hóa.');

  // Sai 5 lan trong 15 phut -> khoa 15 phut; dang nhap thanh cong thi dem lai tu dau
  const MAX = 5;
  const LOCK_MS = 15 * 60000;
  const lastSuccess = await AuditLog.findOne({ actorUserId: user._id, action: { $in: ['LOGIN_SUCCESS', 'PASSWORD_RESET'] } }).sort({ createdAt: -1 });
  const since = new Date(Math.max(Date.now() - LOCK_MS, lastSuccess ? lastSuccess.createdAt.getTime() : 0));
  const failures = await AuditLog.find({ actorUserId: user._id, action: 'LOGIN_FAILURE', createdAt: { $gt: since } }).sort({ createdAt: -1 });
  const locked = () => {
    const until = new Date(failures[MAX - 1].createdAt.getTime() + LOCK_MS);
    return tooMany('LOGIN_LOCKED', `Tài khoản tạm khóa do nhập sai mật khẩu ${MAX} lần. Vui lòng thử lại sau ${formatVnDateTime(until)} hoặc dùng "Quên mật khẩu".`, { lockedUntil: until });
  };
  if (failures.length >= MAX) throw locked();
  if (!(await bcrypt.compare(String(password || ''), user.passwordHash))) {
    const log = await AuditLog.create({ actorUserId: user._id, action: 'LOGIN_FAILURE', entityType: 'User', entityId: String(user._id) });
    failures.unshift(log);
    if (failures.length >= MAX) throw locked();
    throw wrong(` Còn ${MAX - failures.length} lần thử trước khi tài khoản bị tạm khóa 15 phút.`);
  }
  await AuditLog.create({ actorUserId: user._id, action: 'LOGIN_SUCCESS', entityType: 'User', entityId: String(user._id) });
  return issueTokens(user, deviceId);
}

async function refresh(refreshToken) {
  const fail = () => unauthorized('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
  let payload;
  try {
    payload = jwt.verify(String(refreshToken || ''), refreshSecret());
  } catch {
    throw fail();
  }
  if (payload.type !== 'refresh') throw fail();
  const user = await User.findById(payload.sub);
  if (!user || user.status !== UserStatus.ACTIVE) throw fail();
  const session = await Session.findOne({ _id: payload.sid, userId: user._id, tokenHash: sha(refreshToken), revokedAt: null, expiresAt: { $gt: new Date() } });
  if (!session) throw fail();
  return issueTokens(user, session.deviceId, session);
}

async function logout(userId, sessionId) {
  await Session.updateOne({ _id: sessionId, userId }, { revokedAt: new Date() });
  return { message: 'Đã đăng xuất.' };
}

// FR-AUTH-12: nhan vien chon chi nhanh lam viec dau ca, luu vao phien
async function selectStore(userId, sessionId, storeId) {
  const assignment = await StaffAssignment.findOne({ userId, storeId, active: true });
  const store = assignment && (await Store.findOne({ _id: storeId, status: true }));
  if (!store) throw badRequest('Bạn không được phân công tại chi nhánh đang hoạt động này.');
  await Session.updateOne({ _id: sessionId, userId, revokedAt: null }, { activeStoreId: store._id });
  return { activeStoreId: String(store._id), store };
}

// ---------- Kich hoat tai khoan nhan vien / dat lai mat khau (lien ket dung mot lan, 24 gio) ----------

async function sendLink(user, purpose, subject, path) {
  const recent = await OtpCode.countDocuments({ email: user.email, purpose, createdAt: { $gt: new Date(Date.now() - HOUR) } });
  if (recent >= 5) return null;
  await OtpCode.updateMany({ email: user.email, purpose, usedAt: null }, { usedAt: new Date() });
  const token = crypto.randomBytes(32).toString('hex');
  await OtpCode.create({ email: user.email, purpose, codeHash: sha(token), expiresAt: new Date(Date.now() + 24 * HOUR) });
  const url = `${str('WEB_APP_URL', 'http://localhost:5173')}${path}?${new URLSearchParams({ email: user.email, token })}`;
  await sendMail(user.email, subject, `Truy cập ${url} để đặt mật khẩu. Liên kết chỉ dùng một lần và có hiệu lực 24 giờ.`);
  return url;
}

async function sendActivation(rawEmail) {
  const user = await User.findOne({ email: normalize(rawEmail) });
  let devLink = null;
  if (user && user.status === UserStatus.PENDING_ACTIVATION) {
    devLink = await sendLink(user, OtpPurpose.ACTIVATE, 'Kích hoạt tài khoản Voucher Platform', '/web/activate');
  }
  return { message: 'Nếu tài khoản cần kích hoạt, email sẽ được gửi.', ...(isConsoleMode() && devLink ? { devLink } : {}) };
}

async function consumeLink(email, purpose, token) {
  return OtpCode.findOneAndUpdate(
    { email, purpose, codeHash: sha(String(token || '')), usedAt: null, expiresAt: { $gt: new Date() } },
    { usedAt: new Date() },
  );
}

function assertPassword(password) {
  if (typeof password !== 'string' || password.length < 8) throw badRequest('Mật khẩu cần ít nhất 8 ký tự.');
}

async function activate(rawEmail, token, password) {
  assertPassword(password);
  const user = await User.findOne({ email: normalize(rawEmail), status: UserStatus.PENDING_ACTIVATION });
  if (!user || !(await consumeLink(user.email, OtpPurpose.ACTIVATE, token))) {
    throw badRequest('Liên kết kích hoạt không hợp lệ hoặc đã hết hạn.');
  }
  user.passwordHash = await bcrypt.hash(password, 10);
  user.status = UserStatus.ACTIVE;
  await user.save();
  return { message: 'Đã kích hoạt tài khoản. Bạn có thể đăng nhập.' };
}

async function requestPasswordReset(rawEmail) {
  const user = await User.findOne({ email: normalize(rawEmail) });
  let devLink = null;
  if (user && user.role !== Role.CUSTOMER && user.status === UserStatus.ACTIVE) {
    devLink = await sendLink(user, OtpPurpose.RESET_PASSWORD, 'Đặt lại mật khẩu Voucher Platform', '/web/reset-password');
  }
  return { message: 'Nếu tài khoản phù hợp, hướng dẫn đặt lại mật khẩu sẽ được gửi.', ...(isConsoleMode() && devLink ? { devLink } : {}) };
}

async function resetPassword(rawEmail, token, password) {
  assertPassword(password);
  const user = await User.findOne({ email: normalize(rawEmail), status: UserStatus.ACTIVE });
  if (!user || user.role === Role.CUSTOMER || !(await consumeLink(user.email, OtpPurpose.RESET_PASSWORD, token))) {
    throw badRequest('Liên kết không hợp lệ hoặc đã hết hạn.');
  }
  user.passwordHash = await bcrypt.hash(password, 10);
  await user.save();
  await Session.updateMany({ userId: user._id, revokedAt: null }, { revokedAt: new Date() });
  // Dat lai mat khau thanh cong thi mo khoa dang nhap ngay
  await AuditLog.create({ actorUserId: user._id, action: 'PASSWORD_RESET', entityType: 'User', entityId: String(user._id) });
  return { message: 'Đã đổi mật khẩu. Vui lòng đăng nhập lại.' };
}

module.exports = {
  accessSecret, requestOtp, verifyOtp, login, refresh, logout, selectStore,
  sendActivation, activate, requestPasswordReset, resetPassword,
};
