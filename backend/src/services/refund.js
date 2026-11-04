const { RefundRequest, VoucherItem, Campaign, Order, Payment, PaymentRefund, AuditLog, User } = require('../models');
const {
  CampaignStatus, OrderStatus, PaymentStatus, PaymentRefundMode, PaymentRefundReason, PaymentRefundStatus,
  RefundRequestStatus, VoucherItemStatus,
} = require('../utils/enums');
const { badRequest, business, notFound } = require('../utils/errors');
const { str } = require('../config/env');
const { OPEN_REFUND_STATUSES, refundEligibility, statusAfterFailedRefund } = require('./rules');
const { sandboxRefund } = require('./payment-gateway');
const { getRefundSandboxMode } = require('./config');
const notifications = require('./notification');

const REFUND_STATUS_LABELS = {
  REQUESTED: 'Đã gửi yêu cầu',
  PROCESSING: 'Đang xử lý qua cổng thanh toán',
  MANUAL_PENDING: 'Chờ quản trị viên hoàn tiền',
  COMPLETED: 'Hoàn tiền thành công',
  REJECTED: 'Không đủ điều kiện',
  FAILED: 'Hoàn tiền không thành công',
};

async function notifyResult(refund) {
  const messages = {
    COMPLETED: 'Yêu cầu hoàn tiền của bạn đã hoàn tất, tiền sẽ về tài khoản thanh toán.',
    REJECTED: `Yêu cầu hoàn tiền bị từ chối: ${refund.rejectReason ?? 'không đủ điều kiện'}.`,
    MANUAL_PENDING: 'Yêu cầu hoàn tiền đang được quản trị viên xử lý thủ công.',
    FAILED: `Hoàn tiền không thành công: ${refund.rejectReason ?? 'cổng thanh toán từ chối'}. Voucher đã được khôi phục.`,
  };
  if (messages[refund.status]) await notifications.refundResult(refund.userId, refund._id, refund.status, messages[refund.status]);
}

async function successPayment(orderId) {
  return Payment.findOne({ orderId, status: PaymentStatus.SUCCESS }).sort({ createdAt: 1 });
}

async function completedRefundTotal(paymentId) {
  const rows = await PaymentRefund.find({ paymentId, status: PaymentRefundStatus.COMPLETED });
  return rows.reduce((s, r) => s + r.amount, 0);
}

// ================= UC-03, FR-REFUND-01..06, BR-05: khach yeu cau hoan, he thong tu xet =================
async function requestRefund(userId, { voucherItemId, reason }) {
  const item = await VoucherItem.findById(voucherItemId).catch(() => null);
  if (!item || String(item.userId) !== String(userId)) throw notFound('Không tìm thấy voucher.');
  const cleanReason = reason ? String(reason).trim().slice(0, 500) : undefined;

  const hasOpen = await RefundRequest.exists({ voucherItemId: item._id, status: { $in: OPEN_REFUND_STATUSES } });
  const eligibility = refundEligibility(item, !!hasOpen);
  if (!eligibility.canRefund) {
    // Khong du dieu kien: ghi yeu cau REJECTED kem ly do va gui thong bao tu choi
    const rejected = await RefundRequest.create({
      voucherItemId: item._id, userId, reason: cleanReason, status: RefundRequestStatus.REJECTED,
      rejectReason: eligibility.reason, decidedAt: new Date(), amount: item.unitPrice,
    });
    await notifyResult(rejected);
    return view(rejected._id);
  }

  // Du dieu kien: voucher ACTIVE -> REFUND_PENDING co dieu kien (khong redeem duoc trong luc cho - BR-22)
  const now = new Date();
  const locked = await VoucherItem.findOneAndUpdate(
    { _id: item._id, status: VoucherItemStatus.ACTIVE, expireAt: { $gt: now }, refundableUntil: { $gte: now } },
    { status: VoucherItemStatus.REFUND_PENDING },
  );
  if (!locked) throw business('REFUND_NOT_ALLOWED', 'Voucher vừa thay đổi trạng thái, không thể hoàn tiền.');
  const refund = await RefundRequest.create({
    voucherItemId: item._id, userId, reason: cleanReason, status: RefundRequestStatus.PROCESSING, amount: item.unitPrice,
  });

  if (str('REFUND_MODE', 'auto').toLowerCase() === 'manual') {
    await RefundRequest.updateOne({ _id: refund._id }, { status: RefundRequestStatus.MANUAL_PENDING });
  } else {
    await callGateway(refund._id);
  }
  await notifyResult(await RefundRequest.findById(refund._id));
  return view(refund._id);
}

async function callGateway(refundId) {
  const refund = await RefundRequest.findById(refundId);
  const item = await VoucherItem.findById(refund.voucherItemId);
  const payment = await successPayment(item.orderId);
  if (!payment) {
    // Khong co giao dich goc de hoan tu dong -> quan tri vien xu ly
    await RefundRequest.updateOne({ _id: refundId }, { status: RefundRequestStatus.MANUAL_PENDING });
    return;
  }
  // DC-12: tong tien hoan khong vuot so da thanh toan
  if ((await completedRefundTotal(payment._id)) + item.unitPrice > payment.amount) {
    await failRefund(refundId, 'Tổng tiền hoàn vượt số tiền đã thanh toán (DC-12).', null);
    return;
  }
  let result;
  try {
    result = await sandboxRefund(await getRefundSandboxMode());
  } catch {
    result = { status: 'UNAVAILABLE', message: 'Không kết nối được cổng thanh toán.' };
  }
  if (result.status === 'SUCCESS') {
    await completeRefund(refundId, { mode: PaymentRefundMode.AUTO, gatewayRefundId: result.gatewayRefundId });
  } else if (result.status === 'DECLINED') {
    await failRefund(refundId, result.message, { paymentId: payment._id, orderId: item.orderId, amount: item.unitPrice });
  } else {
    // Cong khong phan hoi -> hang doi hoan thu cong (UC-07)
    await RefundRequest.updateOne({ _id: refundId }, { status: RefundRequestStatus.MANUAL_PENDING });
  }
}

// Hoan thanh cong: REFUNDED, ghi PaymentRefund, cong refundedAmount, tra lai ton kho neu con thoi gian ban (FR-REFUND-05, BR-13)
async function completeRefund(refundId, { mode, gatewayRefundId, actorUserId }) {
  const expected = mode === PaymentRefundMode.MANUAL ? RefundRequestStatus.MANUAL_PENDING : RefundRequestStatus.PROCESSING;
  // Gianh quyen xu ly yeu cau: hai quan tri vien bam cung luc thi chi mot nguoi thanh cong
  const refund = await RefundRequest.findOneAndUpdate({ _id: refundId, status: expected }, { status: RefundRequestStatus.REQUESTED });
  if (!refund) {
    throw badRequest(mode === PaymentRefundMode.MANUAL ? 'Yêu cầu không còn chờ hoàn thủ công.' : 'Yêu cầu không còn ở trạng thái xử lý.');
  }
  const rollback = () => RefundRequest.updateOne({ _id: refundId }, { status: expected });
  const item = await VoucherItem.findById(refund.voucherItemId);
  const payment = await successPayment(item.orderId);
  if (item.status !== VoucherItemStatus.REFUND_PENDING || !payment) {
    await rollback();
    throw badRequest('Voucher không ở trạng thái chờ hoàn hoặc không có giao dịch gốc.');
  }
  if ((await completedRefundTotal(payment._id)) + item.unitPrice > payment.amount) {
    await rollback();
    throw badRequest('Số tiền hoàn vượt giao dịch đã nhận (DC-12).');
  }
  const now = new Date();
  const paymentRefund = await PaymentRefund.create({
    paymentId: payment._id, orderId: item.orderId, amount: item.unitPrice, reasonType: PaymentRefundReason.CUSTOMER_REQUEST,
    mode, status: PaymentRefundStatus.COMPLETED, gatewayRefundId: String(gatewayRefundId).trim(),
    processedBy: actorUserId ?? null, completedAt: now,
  });
  await VoucherItem.updateOne({ _id: item._id }, { status: VoucherItemStatus.REFUNDED });
  await Order.updateOne({ _id: item.orderId }, { $inc: { refundedAmount: item.unitPrice } });
  await RefundRequest.updateOne({ _id: refundId }, { status: RefundRequestStatus.COMPLETED, decidedAt: now, paymentRefundId: paymentRefund._id });
  // Cong tra ton kho khi chien dich chua ket thuc ban
  const campaign = await Campaign.findOneAndUpdate(
    { _id: item.campaignId, status: { $ne: CampaignStatus.ENDED }, saleEndAt: { $gt: now }, soldQuantity: { $gt: 0 } },
    { $inc: { soldQuantity: -1 } },
    { new: true },
  );
  if (campaign?.status === CampaignStatus.SOLD_OUT) await Campaign.updateOne({ _id: campaign._id }, { status: CampaignStatus.PUBLISHED });
  return paymentRefund;
}

// Cong tu choi / quan tri vien khong hoan duoc: yeu cau FAILED, voucher ve ACTIVE (hoac EXPIRED)
async function failRefund(refundId, reason, gatewayAttempt, actorUserId, fromStatus = RefundRequestStatus.PROCESSING) {
  const now = new Date();
  const refund = await RefundRequest.findOneAndUpdate(
    { _id: refundId, status: fromStatus },
    { status: RefundRequestStatus.FAILED, rejectReason: reason, decidedAt: now },
    { new: true },
  );
  if (!refund) throw badRequest('Yêu cầu không còn ở trạng thái có thể đánh dấu không hoàn được.');
  if (gatewayAttempt) {
    await PaymentRefund.create({
      paymentId: gatewayAttempt.paymentId, orderId: gatewayAttempt.orderId, amount: gatewayAttempt.amount,
      reasonType: PaymentRefundReason.CUSTOMER_REQUEST, mode: PaymentRefundMode.AUTO, status: PaymentRefundStatus.FAILED, completedAt: now,
    });
  }
  const item = await VoucherItem.findById(refund.voucherItemId);
  if (item.status === VoucherItemStatus.REFUND_PENDING) {
    await VoucherItem.updateOne({ _id: item._id, status: VoucherItemStatus.REFUND_PENDING }, { status: statusAfterFailedRefund(item.expireAt, now) });
  }
  if (actorUserId) {
    await AuditLog.create({ actorUserId, action: 'FAIL_MANUAL_REFUND', entityType: 'RefundRequest', entityId: String(refundId), detail: { reason } });
  }
}

// ================= UC-07: hang doi quan tri vien =================
async function confirmManualRefund(id, actorUserId, gatewayRefundId) {
  if (!gatewayRefundId || !String(gatewayRefundId).trim()) throw badRequest('Vui lòng nhập mã giao dịch hoàn.');
  const pr = await completeRefund(id, { mode: PaymentRefundMode.MANUAL, gatewayRefundId, actorUserId });
  await AuditLog.create({ actorUserId, action: 'CONFIRM_MANUAL_REFUND', entityType: 'RefundRequest', entityId: String(id), detail: { paymentRefundId: String(pr._id) } });
  await notifyResult(await RefundRequest.findById(id));
  return { message: 'Đã ghi nhận hoàn tiền thủ công.' };
}

async function failManualRefund(id, actorUserId, reason) {
  if (!reason || !String(reason).trim()) throw badRequest('Vui lòng nhập lý do.');
  await failRefund(id, String(reason).trim(), null, actorUserId, RefundRequestStatus.MANUAL_PENDING);
  await notifyResult(await RefundRequest.findById(id));
  return { message: 'Đã ghi nhận không hoàn được tiền, voucher đã được khôi phục cho khách.' };
}

// Don lech so tien (BR-20): quan tri vien hoan so tien da nhan tren trang cong roi xac nhan kem ma giao dich
async function paymentMismatches() {
  const orders = await Order.find({ status: OrderStatus.PAYMENT_MISMATCH }).sort({ createdAt: 1 });
  return Promise.all(orders.map(async (o) => {
    const [campaign, user, payments] = await Promise.all([
      Campaign.findById(o.campaignId).select('title'),
      User.findById(o.userId).select('email fullName phone'),
      Payment.find({ orderId: o._id, status: PaymentStatus.SUCCESS }),
    ]);
    return {
      ...o.toJSON(),
      campaignTitle: campaign?.title ?? null,
      customer: user ? { id: String(user._id), email: user.email, fullName: user.fullName ?? null, phone: user.phone ?? null } : null,
      payments: payments.map((p) => ({ id: String(p._id), gatewayTxnId: p.gatewayTxnId, amount: p.amount })),
      receivedAmount: payments.reduce((s, p) => s + p.amount, 0),
    };
  }));
}

async function confirmMismatch(orderId, actorUserId, gatewayRefundId) {
  if (!gatewayRefundId || !String(gatewayRefundId).trim()) throw badRequest('Vui lòng nhập mã giao dịch hoàn.');
  const order = await Order.findOneAndUpdate({ _id: orderId, status: OrderStatus.PAYMENT_MISMATCH }, { status: OrderStatus.CANCELLED, cancelledAt: new Date() });
  if (!order) throw badRequest('Đơn không còn chờ hoàn tiền do lệch số tiền.');
  const payments = await Payment.find({ orderId, status: PaymentStatus.SUCCESS });
  let total = 0;
  for (const payment of payments) {
    const remaining = payment.amount - (await completedRefundTotal(payment._id));
    if (remaining <= 0) continue;
    await PaymentRefund.create({
      paymentId: payment._id, orderId, amount: remaining, reasonType: PaymentRefundReason.MISMATCH, mode: PaymentRefundMode.MANUAL,
      status: PaymentRefundStatus.COMPLETED, gatewayRefundId: String(gatewayRefundId).trim(), processedBy: actorUserId, completedAt: new Date(),
    });
    total += remaining;
  }
  await Order.updateOne({ _id: orderId }, { $inc: { refundedAmount: total } });
  await AuditLog.create({ actorUserId, action: 'CONFIRM_MISMATCH_REFUND', entityType: 'Order', entityId: String(orderId), detail: { amount: total, gatewayRefundId } });
  await notifications.refundResult(order.userId, order._id, 'MISMATCH_REFUNDED', `Đã hoàn ${total.toLocaleString('vi-VN')} ₫ do số tiền thanh toán không khớp đơn hàng.`);
  return { message: 'Đã ghi nhận hoàn tiền cho đơn lệch số tiền.', amount: total };
}

// Yeu cau dung o PROCESSING (dang goi cong) / REQUESTED (dang chot ket qua) qua lau nghia la may chu da dung giua chung:
// dua vao hang doi hoan thu cong (UC-07) de quan tri vien xu ly, khong de voucher bi khoa REFUND_PENDING ma khong ai thay
const STALE_REFUND_MINUTES = 10;
async function escalateStaleRefunds(now = new Date()) {
  const r = await RefundRequest.updateMany(
    { status: { $in: [RefundRequestStatus.PROCESSING, RefundRequestStatus.REQUESTED] }, updatedAt: { $lt: new Date(now.getTime() - STALE_REFUND_MINUTES * 60000) } },
    { status: RefundRequestStatus.MANUAL_PENDING },
  );
  return r.modifiedCount;
}

// ================= Danh sach =================
async function toView(r) {
  const item = await VoucherItem.findById(r.voucherItemId);
  const campaign = item ? await Campaign.findById(item.campaignId).select('title') : null;
  const pr = r.paymentRefundId ? await PaymentRefund.findById(r.paymentRefundId) : null;
  return {
    id: String(r._id), voucherItemId: String(r.voucherItemId), userId: String(r.userId), status: r.status,
    statusLabel: REFUND_STATUS_LABELS[r.status], reason: r.reason ?? null, rejectReason: r.rejectReason ?? null,
    createdAt: r.createdAt, updatedAt: r.updatedAt, decidedAt: r.decidedAt ?? null, amount: r.amount ?? item?.unitPrice ?? null,
    voucherCode: item?.code ?? null, voucherStatus: item?.status ?? null, refundableUntil: item?.refundableUntil ?? null,
    campaignId: item ? String(item.campaignId) : null, campaignTitle: campaign?.title ?? null,
    paymentRefund: pr ? { id: String(pr._id), mode: pr.mode, status: pr.status, gatewayRefundId: pr.gatewayRefundId, completedAt: pr.completedAt } : null,
  };
}

const view = async (id) => toView(await RefundRequest.findById(id));

async function findMine(userId) {
  const list = await RefundRequest.find({ userId }).sort({ createdAt: -1 });
  return Promise.all(list.map(toView));
}

async function findManualPending() {
  const list = await RefundRequest.find({ status: RefundRequestStatus.MANUAL_PENDING }).sort({ createdAt: 1 });
  return Promise.all(list.map(async (r) => {
    const v = await toView(r);
    const item = await VoucherItem.findById(r.voucherItemId);
    const [user, payment] = await Promise.all([User.findById(r.userId).select('email fullName phone'), item ? successPayment(item.orderId) : null]);
    return {
      ...v,
      customer: user ? { id: String(user._id), email: user.email, fullName: user.fullName ?? null, phone: user.phone ?? null } : null,
      payment: payment ? { id: String(payment._id), gateway: payment.gateway, gatewayTxnId: payment.gatewayTxnId, amount: payment.amount } : null,
    };
  }));
}

module.exports = {
  REFUND_STATUS_LABELS, requestRefund, confirmManualRefund, failManualRefund, paymentMismatches, confirmMismatch,
  findMine, findManualPending, escalateStaleRefunds,
};
