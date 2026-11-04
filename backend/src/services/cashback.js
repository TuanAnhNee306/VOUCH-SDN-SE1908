const crypto = require('crypto');
const { VoucherItem, Campaign, Brand, Store, StaffAssignment, User, Order } = require('../models');
const { badRequest, forbidden, notFound, business } = require('../utils/errors');
const { notify } = require('./notification');
const STATES = ['PENDING_CASHBACK', 'MERCHANT_REPORTED_PAID', 'DISPUTED', 'COMPLETED'];
const HOURS_72 = 72 * 3600000;
const text = (v, label, max = 2000) => {
  if (typeof v !== 'string' || !v.trim() || v.length > max || /https?:[/][/]|data:|<[a-z!]|<[/]/i.test(v)) throw badRequest(label + ' phải là nội dung văn bản hợp lệ, không chứa URL/HTML, tối đa ' + max + ' ký tự.');
  return v.trim();
};
function only(body, keys) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !keys.includes(k))) throw badRequest('Payload chứa trường không được phép thay đổi.');
}
function reminderDue(item, now = new Date()) {
  const at = item?.cashbackClaim?.merchantReportedAt;
  return item?.status === 'MERCHANT_REPORTED_PAID' && !!at && now.getTime() >= new Date(at).getTime() + HOURS_72;
}
function customerView(item, now = new Date()) {
  const c = item.cashbackClaim;
  if (!c || !STATES.includes(item.status)) return null;
  return { status: item.status, cashbackAmount: c.cashbackAmount, paymentReport: c.paymentReport ? {
    paymentMethod: c.paymentReport.paymentMethod, paidAt: c.paymentReport.paidAt, paymentReference: c.paymentReport.paymentReference,
    receiptId: c.paymentReport.evidence.id, merchantReportedAt: c.merchantReportedAt,
  } : null, reminderDue: reminderDue(item, now), confirmationSource: c.confirmationSource ?? null,
    customerConfirmedAt: c.customerConfirmedAt ?? null, completedAt: c.completedAt ?? null,
    disputeReason: c.disputeReason ?? null, resolutionNote: c.resolutionNote ?? null,
    evidenceRequested: c.evidenceRequested === true };
}
async function scope(actor) {
  if (actor.role === 'ADMIN') return {};
  if (actor.role === 'CUSTOMER') return { userId: actor.userId };
  if (actor.role === 'BRAND_OWNER') {
    const brands = await Brand.find({ ownerUserId: actor.userId, ...(actor.scopeBrandId ? { _id: actor.scopeBrandId } : {}) }).select('_id');
    return { brandId: { $in: brands.map(b => b._id) } };
  }
  if (actor.role === 'STORE_STAFF') {
    if (!actor.activeStoreId || !await StaffAssignment.exists({ userId: actor.userId, storeId: actor.activeStoreId, active: true })) throw forbidden('Chưa chọn chi nhánh hoặc không còn được phân công.');
    const store = await Store.findOne({ _id: actor.activeStoreId, status: true });
    if (!store) throw forbidden('Chi nhánh không còn hoạt động.');
    return { brandId: store.brandId, 'cashbackClaim.storeId': store._id };
  }
  throw forbidden();
}
async function load(actor, id) {
  const own = await scope(actor);
  const item = await VoucherItem.findOne({ _id: id, ...own, status: { $in: STATES }, 'cashbackClaim.cashbackAmount': { $gt: 0 } }).catch(() => null);
  if (!item) throw notFound('Không tìm thấy claim Cashback trong phạm vi của bạn.');
  const campaign = item.benefitSnapshot || await Campaign.findById(item.campaignId);
  if (campaign?.voucherType !== 'CASHBACK') throw badRequest('Thao tác chỉ áp dụng cho Cashback.');
  return item;
}
// Every update atomically appends an immutable event with the state and evidence.
// The revision also serializes notes/supplements that leave the state unchanged.
async function change(actor, item, to, action, fields = {}, data = {}) {
  const rev = item.cashbackClaim.revision;
  const query = { _id: item._id, status: item.status, 'cashbackClaim.revision': rev === undefined ? { $exists: false } : rev };
  const now = new Date();
  const event = { id: crypto.randomUUID(), at: now, actorId: actor.userId, actorRole: actor.role, action, from: item.status, to, data };
  const set = { status: to };
  for (const [k, v] of Object.entries(fields)) set['cashbackClaim.' + k] = v;
  let updated;
  try {
    updated = await VoucherItem.findOneAndUpdate(query, { $set: set, $inc: { 'cashbackClaim.revision': 1 }, $push: { cashbackHistory: event } }, { new: true, runValidators: true });
  } catch (e) {
    if (e.code === 11000) throw business('PAYMENT_REFERENCE_USED', 'Mã tham chiếu đã được sử dụng trong Brand và phương thức này.', null, 409);
    throw e;
  }
  if (!updated) throw business('CASHBACK_CONFLICT', 'Claim vừa được xử lý. Vui lòng tải lại.', null, 409);
  return updated;
}
const state = (item, expected) => {
  if (!expected.includes(item.status)) throw business('CASHBACK_STATE', 'Thao tác không hợp lệ ở trạng thái hiện tại.', { status: item.status }, 409);
};
async function notifyEvent(item, title, body, key, userId = item.userId) {
  return notify(userId, 'CASHBACK_UPDATE', { title, body, data: { voucherItemId: String(item._id) }, dedupeKey: 'CASHBACK:' + item._id + ':' + key });
}
async function detail(actor, id) {
  const item = await load(actor, id);
  if (actor.role === 'CUSTOMER') return { id: String(item._id), ...customerView(item) };
  const [campaign, customer, store, brand] = await Promise.all([
    Campaign.findById(item.campaignId).select('title'), User.findById(item.userId).select('fullName'),
    Store.findById(item.cashbackClaim.storeId).select('name'), Brand.findById(item.brandId).select('name'),
  ]);
  return { id: String(item._id), code: item.code, status: item.status, campaignTitle: campaign?.title,
    customer: { id: String(item.userId), name: customer?.fullName }, brand: { id: String(item.brandId), name: brand?.name }, storeName: store?.name,
    claim: item.cashbackClaim, history: item.cashbackHistory || [], reminderDue: reminderDue(item),
    redemption: { usedAt: item.usedAt, billAmount: item.cashbackClaim.billAmount, invoiceCode: item.cashbackClaim.billKey?.split(':').slice(1).join(':') } };
}
async function list(actor, statusFilter) {
  if (statusFilter && !STATES.includes(statusFilter)) throw badRequest('Trạng thái Cashback không hợp lệ.');
  const own = await scope(actor);
  const items = await VoucherItem.find({ ...own, status: statusFilter || { $in: STATES }, 'cashbackClaim.cashbackAmount': { $gt: 0 } }).sort({ usedAt: -1 }).limit(200).select('_id');
  return Promise.all(items.map(i => detail(actor, i._id)));
}
function receipt(body, item, actor, now) {
  if (!['BANK_TRANSFER', 'CASH'].includes(body.paymentMethod)) throw badRequest('Phương thức chỉ được là BANK_TRANSFER hoặc CASH.');
  const reference = text(body.paymentReference, 'Mã tham chiếu/biên nhận', 100).toUpperCase();
  if (!/^[A-Z0-9_-]+$/.test(reference)) throw badRequest('Mã tham chiếu chỉ gồm chữ, số, gạch ngang/gạch dưới.');
  const paidAt = typeof body.paidAt === 'string' ? new Date(body.paidAt) : new Date(NaN);
  if (!Number.isFinite(paidAt.getTime()) || paidAt > now || paidAt.getTime() < Math.floor(new Date(item.cashbackClaim.requestedAt || item.usedAt).getTime() / 1000) * 1000) throw badRequest('Thời điểm hoàn phải từ lúc claim đến hiện tại.');
  only(body.evidence, ['kind', 'statement']);
  if (body.evidence.kind !== 'ELECTRONIC_RECEIPT') throw badRequest('Cần biên nhận điện tử; chưa hỗ trợ upload hoặc URL chứng từ.');
  const statement = text(body.evidence.statement, 'Nội dung chứng từ giao nhận/chuyển khoản');
  if (body.attested !== true) throw badRequest('Merchant phải cam kết đã trực tiếp giao/chuyển đủ tiền.');
  const evidence = { id: crypto.randomUUID(), kind: 'ELECTRONIC_RECEIPT', statement, recordedAt: now, recordedBy: actor.userId, claimId: String(item._id), amount: item.cashbackClaim.cashbackAmount, paymentMethod: body.paymentMethod, paymentReference: reference, paidAt, source: 'MERCHANT_DECLARATION', verified: false };
  evidence.sha256 = crypto.createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
  return { paymentMethod: body.paymentMethod, paymentReference: reference, paidAt, evidence, note: body.note == null || body.note === '' ? null : text(body.note, 'Ghi chú'), amount: item.cashbackClaim.cashbackAmount, reportedAt: now, reportedBy: actor.userId };
}
async function reportPaid(actor, id, body, supplement = false) {
  if (!['BRAND_OWNER', 'STORE_STAFF'].includes(actor.role)) throw forbidden();
  only(body, ['paymentMethod', 'paymentReference', 'paidAt', 'evidence', 'attested', 'note']);
  const item = await load(actor, id);
  state(item, supplement ? ['DISPUTED'] : ['PENDING_CASHBACK']);
  if (supplement && !item.cashbackClaim.evidenceRequested) throw badRequest('Admin chưa yêu cầu bổ sung bằng chứng.');
  const brand = await Brand.findById(item.brandId);
  if (brand?.status !== 'APPROVED') throw forbidden('Thương hiệu không đủ điều kiện báo hoàn tiền.');
  const order = await Order.findOne({ _id: item.orderId, userId: item.userId, status: { $in: ['PAID', 'FULFILLED'] }, paidAt: { $ne: null } });
  if (!order) throw badRequest('Claim không có đơn đã thanh toán.');
  const now = new Date();
  const report = receipt(body, item, actor, now);
  await VoucherItem.init();
  const refKey = String(item.brandId) + ':' + report.paymentMethod + ':' + report.paymentReference;
  const keys = item.cashbackClaim.paymentReferenceKeys || [];
  const updated = await change(actor, item, supplement ? 'DISPUTED' : 'MERCHANT_REPORTED_PAID', supplement ? 'MERCHANT_SUPPLEMENTED' : 'MERCHANT_REPORTED_PAID', {
    paymentReport: report, merchantReportedAt: now, merchantReportedBy: actor.userId, evidenceRequested: false,
    paymentReferenceKeys: [...new Set([...keys, refKey])],
  }, { report });
  await notifyEvent(updated, supplement ? 'Đã bổ sung chứng từ Cashback' : 'Merchant đã báo hoàn Cashback', 'Vui lòng kiểm tra tiền thực nhận. Biên nhận Merchant chưa phải xác nhận nhận tiền.', 'REPORT:' + updated.cashbackClaim.revision);
  return detail(actor, id);
}
async function customerAction(actor, id, action, body) {
  if (actor.role !== 'CUSTOMER') throw forbidden();
  only(body, action === 'confirm' ? ['receivedInFull'] : ['reason', 'evidence']);
  const item = await load(actor, id);
  state(item, ['MERCHANT_REPORTED_PAID']);
  if (!item.cashbackClaim.paymentReport) throw badRequest('Thiếu khai báo hoàn tiền của Merchant.');
  let updated;
  const now = new Date();
  if (action === 'confirm') {
    if (body.receivedInFull !== true) throw badRequest('Bạn cần xác nhận đã nhận đủ số tiền Cashback.');
    updated = await change(actor, item, 'COMPLETED', 'CUSTOMER_CONFIRMED', { customerConfirmedAt: now, customerConfirmedBy: actor.userId, completedAt: now, confirmationSource: 'CUSTOMER_CONFIRMED', evidenceRequested: false });
  } else {
    const reason = text(body.reason, 'Lý do tranh chấp');
    const evidence = body.evidence === undefined || body.evidence === '' ? null : text(body.evidence, 'Thông tin/bằng chứng Customer');
    updated = await change(actor, item, 'DISPUTED', 'CUSTOMER_DISPUTED', { disputeReason: reason, disputedAt: now, disputedBy: actor.userId }, { reason, evidence });
    const admins = await User.find({ role: 'ADMIN', status: 'ACTIVE' }).select('_id');
    for (const admin of admins) await notifyEvent(updated, 'Tranh chấp Cashback cần xem xét', reason, 'DISPUTE:' + updated.cashbackClaim.revision + ':' + admin._id, admin._id);
  }
  const brand = await Brand.findById(item.brandId).select('ownerUserId');
  if (brand) await notifyEvent(updated, 'Cập nhật Cashback', action === 'confirm' ? 'Customer đã xác nhận nhận đủ tiền.' : 'Customer đã mở tranh chấp. Merchant không được tự đóng tranh chấp.', 'CUSTOMER:' + updated.cashbackClaim.revision, brand.ownerUserId);
  return detail(actor, id);
}
async function resolve(actor, id, body) {
  if (actor.role !== 'ADMIN') throw forbidden();
  only(body, ['action', 'note', 'verification']);
  const item = await load(actor, id);
  state(item, ['DISPUTED']);
  const note = text(body.note, 'Ghi chú/kết luận Admin');
  const now = new Date();
  let target = 'DISPUTED';
  const fields = { resolutionNote: note };
  const data = { note };
  if (body.action === 'REQUEST_EVIDENCE') fields.evidenceRequested = true;
  else if (body.action === 'NOTE') { /* append-only processing note */ }
  else if (body.action === 'REOPEN') {
    if (item.cashbackClaim.evidenceRequested || !item.cashbackClaim.paymentReport) throw badRequest('Cần Merchant bổ sung chứng từ trước khi chuyển lại chờ xác nhận.');
    target = 'MERCHANT_REPORTED_PAID';
    Object.assign(fields, { disputeResolvedAt: now, disputeResolvedBy: actor.userId });
  } else if (body.action === 'COMPLETE') {
    only(body.verification, ['source', 'reference', 'record', 'independentlyVerified']);
    if (!['INDEPENDENT_RECONCILIATION', 'CUSTOMER_ACKNOWLEDGEMENT'].includes(body.verification.source) || body.verification.independentlyVerified !== true) throw badRequest('Cần căn cứ độc lập hoặc xác nhận Customer được Admin kiểm chứng; không chấp nhận riêng biên nhận Merchant.');
    const verification = { source: body.verification.source, reference: text(body.verification.reference, 'Mã đối soát độc lập', 150), record: text(body.verification.record, 'Biên bản xác minh độc lập', 4000), verifiedAt: now, verifiedBy: actor.userId };
    if (verification.reference.toUpperCase() === item.cashbackClaim.paymentReport?.paymentReference || verification.reference === item.cashbackClaim.paymentReport?.evidence?.id) throw badRequest('Không được dùng riêng mã/chứng từ Merchant làm căn cứ độc lập.');
    target = 'COMPLETED';
    Object.assign(fields, { completedAt: now, confirmationSource: 'ADMIN_VERIFIED', disputeResolvedAt: now, disputeResolvedBy: actor.userId, verification, evidenceRequested: false });
    data.verification = verification;
  } else throw badRequest('Hành động Admin không hợp lệ.');
  const updated = await change(actor, item, target, 'ADMIN_' + body.action, fields, data);
  await notifyEvent(updated, 'Kết quả xử lý Cashback', note, 'ADMIN:' + updated.cashbackClaim.revision);
  const brand = await Brand.findById(item.brandId).select('ownerUserId');
  if (brand) await notifyEvent(updated, 'Admin cập nhật tranh chấp Cashback', note, 'ADMIN_OWNER:' + updated.cashbackClaim.revision, brand.ownerUserId);
  return detail(actor, id);
}
async function remind(now = new Date()) {
  const items = await VoucherItem.find({ status: 'MERCHANT_REPORTED_PAID', 'cashbackClaim.merchantReportedAt': { $lte: new Date(now.getTime() - HOURS_72) } });
  let sent = 0;
  for (const item of items) {
    // Re-read avoids notifying a claim already completed before this iteration.
    const fresh = await VoucherItem.findById(item._id);
    if (!reminderDue(fresh, now)) continue;
    const n = await notifyEvent(fresh, 'Nhắc xác nhận Cashback sau 72 giờ', 'Merchant đã báo hoàn tiền. Hãy kiểm tra và xác nhận hoặc báo chưa nhận. Hệ thống không tự hoàn tất.', 'REMINDER:' + new Date(fresh.cashbackClaim.merchantReportedAt).getTime());
    if (n) sent++;
  }
  return sent;
}
module.exports = { STATES, reminderDue, customerView, list, detail, reportPaid, customerAction, resolve, remind };
