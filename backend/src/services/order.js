const crypto = require('crypto');
const { Order, Campaign, VoucherItem, Payment, PaymentRefund, AuditLog } = require('../models');
const { CampaignStatus, OrderStatus, PaymentStatus, PaymentRefundReason, PaymentRefundMode, PaymentRefundStatus } = require('../utils/enums');
const { badRequest, notFound, forbidden } = require('../utils/errors');
const { int } = require('../config/env');
const rules = require('./rules');
const notifications = require('./notification');
const { createVnpayUrl } = require('./payment-gateway');
const { getCommissionRate } = require('./config');

// Ton kho kha dung tinh tren MongoDB (DC-03)
const AVAILABLE = { $subtract: [{ $subtract: ['$totalQuantity', '$soldQuantity'] }, '$reservedQuantity'] };

async function issuedAndPending(userId, campaignId) {
  const [issued, pending] = await Promise.all([
    VoucherItem.countDocuments({ userId, campaignId }),
    Order.find({ userId, campaignId, status: OrderStatus.PENDING }).select('quantity'),
  ]);
  return { issued, pendingQty: pending.reduce((s, o) => s + o.quantity, 0) };
}

// ================= Tao don (UC-01, FR-ORDER-01..04, BR-01, BR-02, DC-03) =================
const newPaymentOrderCode = (now = Date.now()) => String(now * 1000 + crypto.randomInt(0, 1000));

async function createOrder(userId, { campaignId, quantity }, { ipAddress } = {}) {
  const q = Math.trunc(Number(quantity));
  if (!Number.isSafeInteger(q) || q < 1) throw badRequest('Số lượng phải là số nguyên lớn hơn 0.');
  const campaign = await Campaign.findById(campaignId).catch(() => null);
  if (!campaign) throw notFound('Không tìm thấy chiến dịch.');
  if (campaign.status !== CampaignStatus.PUBLISHED || !rules.isOnSale(campaign)) {
    throw badRequest('Chiến dịch không còn đang bán.', 'CAMPAIGN_NOT_ON_SALE');
  }
  if (q > rules.availableStock(campaign)) {
    throw badRequest(`Chỉ còn ${Math.max(0, rules.availableStock(campaign))} voucher, vui lòng giảm số lượng.`, 'OUT_OF_STOCK');
  }
  // BR-01: tinh ca voucher da mua va don dang cho thanh toan
  const { issued, pendingQty } = await issuedAndPending(userId, campaign._id);
  const quota = rules.remainingPurchaseQuota(campaign.limitPerUser, issued, pendingQty);
  if (q > quota) {
    throw badRequest(
      quota === 0
        ? `Bạn đã đạt giới hạn ${campaign.limitPerUser} voucher cho chiến dịch này.`
        : `Bạn chỉ còn được mua tối đa ${quota} voucher cho chiến dịch này.`,
      'PURCHASE_LIMIT',
      { limitPerUser: campaign.limitPerUser, remaining: quota },
    );
  }

  // Giu cho bang mot lenh cap nhat co dieu kien, nguyen tu: hai nguoi mua voucher cuoi cung thi chi mot nguoi thanh cong
  const reserved = await Campaign.findOneAndUpdate(
    { _id: campaign._id, status: CampaignStatus.PUBLISHED, $expr: { $gte: [AVAILABLE, q] } },
    { $inc: { reservedQuantity: q } },
    { new: true },
  );
  if (!reserved) throw badRequest('Voucher vừa hết, vui lòng chọn số lượng khác.', 'OUT_OF_STOCK');
  if (rules.availableStock(reserved) <= 0) {
    await Campaign.updateOne({ _id: reserved._id, status: CampaignStatus.PUBLISHED }, { status: CampaignStatus.SOLD_OUT });
  }

  const order = await Order.create({
    userId,
    campaignId: campaign._id,
    quantity: q,
    unitPrice: campaign.salePrice,
    totalAmount: campaign.salePrice * q,
    status: OrderStatus.PENDING,
    paymentOrderCode: newPaymentOrderCode(),
    reservedUntil: new Date(Date.now() + int('ORDER_RESERVATION_TTL_MINUTES', 15) * 60000),
  });
  await notifications.orderCreated(userId, order._id, campaign.title);
  return { order: await present(order), paymentUrl: await ensurePaymentLink(order, ipAddress) };
}

async function ensurePaymentLink(order, ipAddress) {
  if (order.paymentUrl) return order.paymentUrl;
  try {
    const url = await createVnpayUrl({ orderCode: order.paymentOrderCode, amount: order.totalAmount, expiresAt: order.reservedUntil, ipAddress });
    if (url) await Order.updateOne({ _id: order._id }, { paymentUrl: url });
    return url;
  } catch (e) {
    console.warn(`[order] Khong tao duoc link VNPAY cho don ${order._id}: ${e.message}`);
    return null;
  }
}

// FR-ORDER-12: thanh toan lai don PENDING con trong thoi gian giu cho, tra lai dung link cu
async function retryPayment(userId, orderId) {
  const order = await findMyOrderDoc(userId, orderId);
  if (order.status !== OrderStatus.PENDING) throw badRequest('Đơn hàng không còn chờ thanh toán.');
  if (order.reservedUntil.getTime() <= Date.now()) throw badRequest('Đơn hàng đã hết thời gian giữ chỗ, vui lòng đặt lại.');
  return { order: await present(order), paymentUrl: await ensurePaymentLink(order) };
}

async function findMyOrderDoc(userId, orderId) {
  const order = await Order.findById(orderId).catch(() => null);
  if (!order) throw notFound('Không tìm thấy đơn hàng.');
  if (String(order.userId) !== String(userId)) throw forbidden('Bạn không có quyền xem đơn hàng này.');
  return order;
}

async function present(order) {
  const campaign = await Campaign.findById(order.campaignId).select('title image voucherType faceValue brandId');
  return { ...order.toJSON(), campaign: campaign ? campaign.toJSON() : null };
}

async function findMyOrders(userId) {
  const orders = await Order.find({ userId }).sort({ createdAt: -1 });
  const campaigns = await Campaign.find({ _id: { $in: orders.map((o) => o.campaignId) } }).select('title image');
  const byId = new Map(campaigns.map((c) => [String(c._id), c.toJSON()]));
  return orders.map((o) => ({ ...o.toJSON(), campaign: byId.get(String(o.campaignId)) ?? null }));
}

async function findMyOrder(userId, orderId) {
  return present(await findMyOrderDoc(userId, orderId));
}

// ================= Ket qua thanh toan (FR-ORDER-05..08, BR-11, BR-18, BR-20, DC-04, DC-11) =================

async function audit(order, outcome, detail = {}) {
  await AuditLog.create({ action: `PAYMENT_${outcome}`, entityType: 'Order', entityId: String(order._id), detail: { ...detail } });
  return outcome;
}

// Nha giu cho; chien dich SOLD_OUT co hang lai va con thoi gian ban -> PUBLISHED
async function releaseReservation(order) {
  await Campaign.updateOne({ _id: order.campaignId }, { $inc: { reservedQuantity: -order.quantity } });
  await Campaign.updateOne(
    { _id: order.campaignId, status: CampaignStatus.SOLD_OUT, saleEndAt: { $gt: new Date() }, $expr: { $gt: [AVAILABLE, 0] } },
    { status: CampaignStatus.PUBLISHED },
  );
}

const voucherCode = () => `VC-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;

// Sinh voucher (ma duy nhat, han dung, han hoan) roi don -> FULFILLED
async function issueVouchers(order, campaign, paidAt) {
  const until = rules.refundableUntil(paidAt, campaign.voucherExpireAt, int('REFUND_WINDOW_DAYS', 7), int('REFUND_MIN_DAYS_BEFORE_EXPIRE', 3));
  const existing = await VoucherItem.countDocuments({ orderId: order._id });
  for (let i = existing; i < order.quantity; i++) {
    for (let attempt = 0; ; attempt++) {
      try {
        await VoucherItem.create({
          orderId: order._id, campaignId: campaign._id, brandId: campaign.brandId, userId: order.userId,
          code: voucherCode(), unitPrice: order.unitPrice, issuedAt: paidAt,
          expireAt: campaign.voucherExpireAt, refundableUntil: until,
        });
        break;
      } catch (e) {
        if (e.code !== 11000 || attempt >= 5) throw e;
      }
    }
  }
  await Order.updateOne({ _id: order._id }, { status: OrderStatus.FULFILLED });
  await Campaign.updateOne(
    { _id: campaign._id, status: CampaignStatus.PUBLISHED, $expr: { $lte: [AVAILABLE, 0] } },
    { status: CampaignStatus.SOLD_OUT },
  );
}

async function refundFull(payment, reason) {
  await PaymentRefund.create({
    paymentId: payment._id, orderId: payment.orderId, amount: payment.amount, reasonType: reason,
    mode: PaymentRefundMode.AUTO, status: PaymentRefundStatus.COMPLETED,
    gatewayRefundId: `RF-${Date.now()}`, completedAt: new Date(),
  });
}

// Xu ly mot ket qua thanh toan da xac thuc chu ky. Idempotent theo gatewayTxnId.
async function processPayment(p) {
  const order = await Order.findById(p.orderId).catch(() => null);
  if (!order) throw notFound('Không tìm thấy đơn hàng.');

  // DC-04: chi muc duy nhat tren gatewayTxnId -> cong gui lai cung giao dich thi khong xu ly them
  let payment;
  try {
    payment = await Payment.create({
      orderId: order._id, gateway: p.gateway || 'VNPAY', gatewayTxnId: p.gatewayTxnId, amount: p.amount,
      status: p.success ? PaymentStatus.SUCCESS : PaymentStatus.FAILED, rawPayload: p.raw,
    });
  } catch (e) {
    if (e.code === 11000) return 'DUPLICATE';
    throw e;
  }
  const now = new Date();

  // Thanh toan that bai / bi huy: don PENDING -> CANCELLED, nha giu cho ngay
  if (!p.success) {
    const prev = await Order.findOneAndUpdate({ _id: order._id, status: OrderStatus.PENDING }, { status: OrderStatus.CANCELLED, cancelledAt: now });
    if (!prev) return audit(order, 'IGNORED', { reason: 'failed-not-pending' });
    await releaseReservation(prev);
    return audit(order, 'CANCELLED', { gatewayTxnId: p.gatewayTxnId });
  }

  // BR-20: so tien phai khop tong don; lech -> PAYMENT_MISMATCH, khong phat hanh voucher, vao hang doi quan tri
  if (Number(p.amount) !== Number(order.totalAmount)) {
    const prev = await Order.findOneAndUpdate(
      { _id: order._id, status: { $in: [OrderStatus.PENDING, OrderStatus.CANCELLED] } },
      { status: OrderStatus.PAYMENT_MISMATCH },
    );
    if (prev?.status === OrderStatus.PENDING) await releaseReservation(prev);
    return audit(order, 'PAYMENT_MISMATCH', { paid: Number(p.amount), expected: order.totalAmount });
  }

  const commissionRate = await getCommissionRate();

  // Luong chinh: PENDING -> PAID (chot ty le hoa hong - BR-09) -> giu cho thanh da ban -> sinh voucher -> FULFILLED
  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, status: OrderStatus.PENDING },
    { status: OrderStatus.PAID, paidAt: now, commissionRate },
    { new: true },
  );
  if (claimed) {
    const campaign = await Campaign.findByIdAndUpdate(
      claimed.campaignId,
      { $inc: { reservedQuantity: -claimed.quantity, soldQuantity: claimed.quantity } },
      { new: true },
    );
    await issueVouchers(claimed, campaign, now);
    return audit(order, 'FULFILLED', { gatewayTxnId: p.gatewayTxnId });
  }

  // BR-11: thanh toan thanh cong den muon khi don da huy
  const current = await Order.findById(order._id);
  if (current.status === OrderStatus.CANCELLED) {
    const campaign = await Campaign.findById(current.campaignId);
    const { issued, pendingQty } = await issuedAndPending(current.userId, campaign._id);
    const quota = rules.remainingPurchaseQuota(campaign.limitPerUser, issued, pendingQty);
    let taken = null;
    if (quota >= current.quantity) {
      taken = await Campaign.findOneAndUpdate(
        { _id: campaign._id, status: { $ne: CampaignStatus.ENDED }, $expr: { $gte: [AVAILABLE, current.quantity] } },
        { $inc: { soldQuantity: current.quantity } },
        { new: true },
      );
    }
    if (taken) {
      const late = await Order.findOneAndUpdate(
        { _id: current._id, status: OrderStatus.CANCELLED },
        { status: OrderStatus.PAID, paidAt: now, commissionRate, cancelledAt: null },
        { new: true },
      );
      if (late) {
        await issueVouchers(late, taken, now);
        return audit(order, 'FULFILLED_LATE', { gatewayTxnId: p.gatewayTxnId });
      }
      await Campaign.updateOne({ _id: campaign._id }, { $inc: { soldQuantity: -current.quantity } });
    }
    // Het hang / vuot gioi han: hoan 100%
    await refundFull(payment, PaymentRefundReason.OVERSOLD);
    await Order.updateOne({ _id: current._id, status: OrderStatus.CANCELLED }, { status: OrderStatus.REFUNDED_OVERSOLD, refundedAmount: current.totalAmount });
    return audit(order, 'REFUNDED_OVERSOLD', { gatewayTxnId: p.gatewayTxnId });
  }

  // DC-11: don da co mot giao dich thanh cong -> giao dich thua, hoan 100%
  await refundFull(payment, PaymentRefundReason.MISMATCH);
  return audit(order, 'IGNORED', { reason: 'duplicate-success', gatewayTxnId: p.gatewayTxnId });
}

// Thong bao gui sau khi xu ly xong
async function processPaymentAndNotify(p) {
  const outcome = await processPayment(p);
  if (['FULFILLED', 'FULFILLED_LATE', 'REFUNDED_OVERSOLD'].includes(outcome)) {
    const order = await Order.findById(p.orderId);
    const campaign = await Campaign.findById(order.campaignId).select('title');
    const title = campaign?.title ?? 'Voucher';
    if (outcome === 'REFUNDED_OVERSOLD') {
      await notifications.refundResult(order.userId, order._id, 'REFUNDED_OVERSOLD', `Xin lỗi, "${title}" đã hết khi thanh toán của bạn đến. Bạn được hoàn 100% số tiền.`);
    } else {
      await notifications.vouchersIssued(order.userId, order._id, title, order.quantity);
    }
  }
  return outcome;
}

async function handleVnpayIpn(result) {
  const order = await Order.findOne({ paymentOrderCode: result.orderCode });
  if (!order) return 'UNKNOWN_ORDER';
  return processPaymentAndNotify({ ...result, orderId: order._id });
}

// ================= Tac vu nen: huy don qua 15 phut giu cho (FR-ORDER-03) =================
async function cancelExpiredOrders(now = new Date()) {
  const expired = await Order.find({ status: OrderStatus.PENDING, reservedUntil: { $lt: now } }).select('_id');
  let cancelled = 0;
  for (const { _id } of expired) {
    // Webhook co the vua xu ly don nay: chi huy khi van PENDING
    const prev = await Order.findOneAndUpdate({ _id, status: OrderStatus.PENDING }, { status: OrderStatus.CANCELLED, cancelledAt: now });
    if (!prev) continue;
    await releaseReservation(prev);
    cancelled++;
  }
  return cancelled;
}

module.exports = {
  createOrder, retryPayment, findMyOrders, findMyOrder, findMyOrderDoc,
  processPayment, processPaymentAndNotify, handleVnpayIpn, cancelExpiredOrders, AVAILABLE,
};
