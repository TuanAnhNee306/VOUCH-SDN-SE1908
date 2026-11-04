const { RedeemToken, VoucherItem, RedemptionLog, Campaign, Store, StaffAssignment, AuditLog } = require('../models');
const { VoucherItemStatus, RedeemMethod } = require('../utils/enums');
const { business, notFound } = require('../utils/errors');
const { int } = require('../config/env');
const { MINUTE, formatVnDateTime, startOfVnDay } = require('../utils/time');
const { usageBlock, billRequired } = require('./rules');
const { newNonce, newOtp, buildQrPayload, verifyQrPayload } = require('./redeem-token');
const notifications = require('./notification');

const OTP_FAILED = 'REDEEM_OTP_FAILED';
const OTP_LOCKED = 'REDEEM_OTP_LOCKED';

// ================= Khach sinh ma QR + OTP 60 giay (FR-REDEEM-02/03, BR-06, BR-16) =================
async function requestToken(userId, voucherItemId) {
  const item = await VoucherItem.findById(voucherItemId).catch(() => null);
  if (!item || String(item.userId) !== String(userId)) throw notFound('Không tìm thấy voucher.');
  const now = new Date();
  const block = usageBlock(item, now);
  if (block) throw business(block.reason, block.message, block.details);

  // Gioi han 10 lan sinh ma / 10 phut moi khach
  const windowMin = int('REDEEM_TOKEN_RATE_WINDOW_MINUTES', 10);
  const max = int('REDEEM_TOKEN_MAX_PER_WINDOW', 10);
  const recent = await RedeemToken.find({ userId, issuedAt: { $gt: new Date(now.getTime() - windowMin * MINUTE) } }).sort({ issuedAt: 1 });
  if (recent.length >= max) {
    const retryAt = new Date(recent[recent.length - max].issuedAt.getTime() + windowMin * MINUTE);
    throw business('TOKEN_RATE_LIMITED', `Bạn đã tạo mã ${max} lần trong ${windowMin} phút. Vui lòng thử lại lúc ${formatVnDateTime(retryAt)}.`,
      { retryAt: retryAt.toISOString() }, 429);
  }

  const ttlSeconds = int('REDEEM_TOKEN_TTL_SECONDS', 60);
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
  // BR-06: moi voucher chi co mot ma con hieu luc - sinh ma moi thi vo hieu ma cu
  await RedeemToken.updateMany({ voucherItemId: item._id, usedAt: null, revokedAt: null }, { revokedAt: now });
  // OTP duy nhat trong cac ma con hieu luc de nhan vien nhap OTP xac dinh dung mot voucher
  let otpCode;
  for (let i = 0; i < 20 && !otpCode; i++) {
    const candidate = newOtp();
    const taken = await RedeemToken.exists({ otpCode: candidate, usedAt: null, revokedAt: null, expiresAt: { $gt: now } });
    if (!taken) otpCode = candidate;
  }
  if (!otpCode) throw business('OTP_UNAVAILABLE', 'Không sinh được mã OTP, vui lòng thử lại.', null, 503);
  const nonce = newNonce();
  await RedeemToken.create({ voucherItemId: item._id, userId, nonce, otpCode, issuedAt: now, expiresAt });
  return { qrPayload: buildQrPayload(nonce, expiresAt), otpCode, expiresAt, ttlSeconds };
}

// Trang thai voucher de man hinh ma QR tu chuyen sang "Da duoc su dung"
async function tokenStatus(userId, voucherItemId) {
  const item = await VoucherItem.findById(voucherItemId).catch(() => null);
  if (!item || String(item.userId) !== String(userId)) throw notFound('Không tìm thấy voucher.');
  const log = item.status === VoucherItemStatus.USED ? await RedemptionLog.findOne({ voucherItemId: item._id }) : null;
  const store = log ? await Store.findById(log.storeId).select('name') : null;
  return { status: item.status, usedAt: item.usedAt, storeName: store?.name ?? null };
}

async function alreadyUsedError(item) {
  const log = await RedemptionLog.findOne({ voucherItemId: item._id });
  const store = log ? await Store.findById(log.storeId).select('name') : null;
  const usedAt = log?.redeemedAt ?? item.usedAt;
  const when = usedAt ? ` lúc ${formatVnDateTime(usedAt)}` : '';
  const where = store ? ` tại ${store.name}` : '';
  return business('VOUCHER_USED', `Voucher đã được sử dụng${when}${where}.`, {
    usedAt: usedAt ? new Date(usedAt).toISOString() : null, storeId: log ? String(log.storeId) : null, storeName: store?.name ?? null,
  });
}

// ================= Khoa nhap OTP: sai 5 lan / 5 phut -> khoa 15 phut (FR-REDEEM-12) =================
async function assertOtpNotLocked(staffUserId, now) {
  const lockMin = int('REDEEM_OTP_LOCK_MINUTES', 15);
  const lock = await AuditLog.findOne({ actorUserId: staffUserId, action: OTP_LOCKED, createdAt: { $gt: new Date(now.getTime() - lockMin * MINUTE) } }).sort({ createdAt: -1 });
  if (lock) throw otpLockedError(new Date(lock.createdAt.getTime() + lockMin * MINUTE));
}

const otpLockedError = (until) =>
  business('OTP_LOCKED', `Nhập sai OTP quá nhiều lần. Ô nhập OTP bị khóa đến ${formatVnDateTime(until)}; vẫn có thể quét mã QR.`,
    { lockedUntil: until.toISOString() }, 429);

async function recordOtpFailure(staffUserId, storeId) {
  const maxFails = int('REDEEM_OTP_MAX_FAILS', 5);
  const windowMin = int('REDEEM_OTP_FAIL_WINDOW_MINUTES', 5);
  await AuditLog.create({ actorUserId: staffUserId, action: OTP_FAILED, entityType: 'Store', entityId: String(storeId) });
  const now = new Date();
  const fails = await AuditLog.countDocuments({ actorUserId: staffUserId, action: OTP_FAILED, createdAt: { $gt: new Date(now.getTime() - windowMin * MINUTE) } });
  if (fails >= maxFails) {
    await AuditLog.create({ actorUserId: staffUserId, action: OTP_LOCKED, entityType: 'Store', entityId: String(storeId), detail: { fails } });
    return otpLockedError(new Date(now.getTime() + int('REDEEM_OTP_LOCK_MINUTES', 15) * MINUTE));
  }
  return business('OTP_INVALID', `Mã OTP không đúng. Còn ${maxFails - fails} lần thử trước khi bị khóa.`, { remainingAttempts: maxFails - fails });
}

// ================= Nhan vien xac nhan su dung (FR-REDEEM-05..13, BR-03, BR-06, BR-07, BR-12) =================
async function redeem(staffUserId, { storeId, qrPayload, otpCode, billAmount }) {
  if (!!qrPayload === !!otpCode) throw business('CODE_REQUIRED', 'Cần gửi đúng một trong hai: mã QR hoặc mã OTP.');
  if (otpCode && !/^\d{6}$/.test(String(otpCode))) throw business('OTP_INVALID', 'Mã OTP gồm đúng 6 chữ số.');
  const bill = billAmount === undefined || billAmount === null || billAmount === '' ? null : Number(billAmount);
  if (bill !== null && (!Number.isInteger(bill) || bill < 0)) throw business('BILL_INVALID', 'Giá trị hóa đơn không hợp lệ.');
  const now = new Date();

  // BR-07: chi xac nhan tai chi nhanh dang duoc gan va dang hoat dong
  const assignment = await StaffAssignment.findOne({ userId: staffUserId, storeId, active: true });
  const store = assignment && (await Store.findOne({ _id: storeId, status: true }));
  if (!store) throw business('STAFF_NOT_ASSIGNED', 'Bạn không được gán cho chi nhánh này.', null, 403);

  // 1) Tim token
  let token;
  const method = qrPayload ? RedeemMethod.QR : RedeemMethod.OTP;
  if (qrPayload) {
    const qr = verifyQrPayload(qrPayload);
    if (!qr) throw business('TOKEN_INVALID', 'Mã QR không hợp lệ hoặc không phải mã của hệ thống.');
    if (qr.expiresAt.getTime() <= now.getTime()) throw business('TOKEN_EXPIRED', 'Mã QR đã hết hiệu lực, nhờ khách làm mới mã trên ứng dụng.');
    token = await RedeemToken.findOne({ nonce: qr.nonce });
    if (!token) throw business('TOKEN_INVALID', 'Mã QR không còn tồn tại trên hệ thống.');
  } else {
    await assertOtpNotLocked(staffUserId, now);
    token = await RedeemToken.findOne({ otpCode, usedAt: null, revokedAt: null, expiresAt: { $gt: now } });
    // OTP khong khop ma con hieu luc: neu la ma cu cua khach (trong 1 gio) thi bao ro ly do, nguoc lai tinh la nhap sai
    if (!token) token = await RedeemToken.findOne({ otpCode, issuedAt: { $gt: new Date(now.getTime() - 60 * MINUTE) } }).sort({ issuedAt: -1 });
    if (!token) throw await recordOtpFailure(staffUserId, storeId);
  }
  // Ma bi thay khi con han -> bao da thay; ma da qua 60 giay -> roi xuong nhanh "het hieu luc" ben duoi
  if (token.revokedAt && token.expiresAt.getTime() > now.getTime()) {
    throw business('TOKEN_REVOKED', 'Mã đã được thay bằng mã mới, nhờ khách mở mã mới nhất trên ứng dụng.');
  }

  // 2) Xet voucher
  const item = await VoucherItem.findById(token.voucherItemId);
  if (!item) throw business('TOKEN_INVALID', 'Không tìm thấy voucher của mã này.');
  if (item.status === VoucherItemStatus.USED) throw await alreadyUsedError(item);
  if (token.usedAt) throw business('TOKEN_USED', 'Mã này đã được dùng.');
  if (token.expiresAt.getTime() <= now.getTime()) throw business('TOKEN_EXPIRED', 'Mã đã hết hiệu lực (quá 60 giây), nhờ khách làm mới mã trên ứng dụng.');

  const block = usageBlock(item, now);
  let failure = block ? business(block.reason, block.message, block.details) : null;
  const campaign = await Campaign.findById(item.campaignId);
  if (!failure && !campaign.storeIds.some((id) => String(id) === String(storeId))) {
    const stores = await Store.find({ _id: { $in: campaign.storeIds }, status: true }).select('name address');
    failure = business('WRONG_STORE',
      `Voucher không áp dụng tại chi nhánh này. Áp dụng tại: ${stores.map((s) => s.name).join(', ') || 'không có chi nhánh nào'}.`,
      { stores: stores.map((s) => ({ id: String(s._id), name: s.name, address: s.address })) });
  }
  // Moi thu hop le, chi thieu hoa don: CHUA tieu ma de nhan vien nhap hoa don roi gui lai ngay (BR-03)
  if (!failure && billRequired(campaign.voucherType, bill)) {
    throw business('BILL_REQUIRED', 'Voucher mệnh giá bắt buộc nhập giá trị hóa đơn. Mã của khách vẫn còn hiệu lực, nhập hóa đơn rồi gửi lại.',
      { voucherType: campaign.voucherType, faceValue: campaign.faceValue });
  }

  // 3) Tieu ma co dieu kien (ke ca khi voucher khong hop le - FR-REDEEM-13): hai quay cung quet mot ma thi chi mot ben di tiep
  const consumed = await RedeemToken.findOneAndUpdate({ _id: token._id, usedAt: null }, { usedAt: now });
  if (!consumed) {
    const fresh = await VoucherItem.findById(item._id);
    if (fresh.status === VoucherItemStatus.USED) throw await alreadyUsedError(fresh);
    throw business('TOKEN_USED', 'Mã này đã được dùng.');
  }
  if (failure) throw failure;

  // 4) ACTIVE -> USED co dieu kien (BR-12), ghi lich su, vo hieu cac ma con lai
  const marked = await VoucherItem.findOneAndUpdate(
    { _id: item._id, status: VoucherItemStatus.ACTIVE, expireAt: { $gt: now } },
    { status: VoucherItemStatus.USED, usedAt: now },
  );
  if (!marked) {
    const fresh = await VoucherItem.findById(item._id);
    if (fresh.status === VoucherItemStatus.USED) throw await alreadyUsedError(fresh);
    const b = usageBlock(fresh, now);
    throw business(b?.reason || 'VOUCHER_UNAVAILABLE', b?.message || 'Voucher không còn sử dụng được.');
  }
  await RedeemToken.updateMany({ voucherItemId: item._id, usedAt: null, revokedAt: null }, { revokedAt: now });
  const log = await RedemptionLog.create({ voucherItemId: item._id, storeId, staffUserId, billAmount: bill, method, redeemedAt: now });

  await notifications.voucherUsed(item.userId, item._id, campaign.title, store.name);
  return {
    message: 'Xác nhận sử dụng thành công.',
    redemptionLogId: String(log._id),
    voucherItemId: String(item._id),
    voucherCode: item.code,
    redeemedAt: now,
    method,
    billAmount: bill,
    billEditableUntil: new Date(now.getTime() + int('BILL_EDIT_WINDOW_MINUTES', 10) * MINUTE),
    storeName: store.name,
    campaign: { id: String(campaign._id), title: campaign.title, voucherType: campaign.voucherType, faceValue: campaign.faceValue },
  };
}

// ================= Lich su trong ca, sua hoa don (FR-REDEEM-08/10) =================
async function toHistoryItem(log) {
  const [item, store] = await Promise.all([VoucherItem.findById(log.voucherItemId), Store.findById(log.storeId).select('name')]);
  const campaign = item ? await Campaign.findById(item.campaignId).select('title voucherType') : null;
  const editableUntil = new Date(log.redeemedAt.getTime() + int('BILL_EDIT_WINDOW_MINUTES', 10) * MINUTE);
  return {
    id: String(log._id), voucherItemId: String(log.voucherItemId), voucherCode: item?.code ?? null,
    campaignTitle: campaign?.title ?? null, voucherType: campaign?.voucherType ?? null,
    storeId: String(log.storeId), storeName: store?.name ?? null, method: log.method, billAmount: log.billAmount,
    billUpdatedAt: log.billUpdatedAt, redeemedAt: log.redeemedAt, billEditableUntil: editableUntil,
    billEditable: Date.now() <= editableUntil.getTime(),
  };
}

async function historyToday(staffUserId, storeId) {
  const filter = { staffUserId, redeemedAt: { $gte: startOfVnDay() } };
  if (storeId) filter.storeId = storeId;
  const logs = await RedemptionLog.find(filter).sort({ redeemedAt: -1 });
  return Promise.all(logs.map(toHistoryItem));
}

async function updateBill(staffUserId, logId, billAmount) {
  const bill = Number(billAmount);
  if (!Number.isInteger(bill) || bill < 0) throw business('BILL_INVALID', 'Giá trị hóa đơn không hợp lệ.');
  const log = await RedemptionLog.findById(logId).catch(() => null);
  if (!log || String(log.staffUserId) !== String(staffUserId)) throw notFound('Không tìm thấy lượt xác nhận.');
  const windowMin = int('BILL_EDIT_WINDOW_MINUTES', 10);
  const until = new Date(log.redeemedAt.getTime() + windowMin * MINUTE);
  if (Date.now() > until.getTime()) {
    throw business('BILL_EDIT_EXPIRED', `Chỉ sửa được giá trị hóa đơn trong ${windowMin} phút sau khi xác nhận.`, { editableUntil: until.toISOString() });
  }
  log.billAmount = bill;
  log.billUpdatedAt = new Date();
  await log.save();
  return toHistoryItem(log);
}

async function myStores(staffUserId) {
  const assignments = await StaffAssignment.find({ userId: staffUserId, active: true });
  return Store.find({ _id: { $in: assignments.map((a) => a.storeId) }, status: true }).sort({ name: 1 });
}

module.exports = { requestToken, tokenStatus, redeem, historyToday, updateBill, myStores };
