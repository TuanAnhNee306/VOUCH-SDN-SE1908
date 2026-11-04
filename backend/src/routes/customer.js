const crypto = require('crypto');
const router = require('express').Router();
const { ah, badRequest, forbidden, notFound } = require('../utils/errors');
const { authenticate, requireRole } = require('../middleware/auth');
const { Role, FavoriteTargetType } = require('../utils/enums');
const { bool } = require('../config/env');
const { Notification, NotificationSetting, Favorite, Campaign, Brand, User, Order } = require('../models');
const orders = require('../services/order');
const wallet = require('../services/wallet');
const redeem = require('../services/redeem');
const refunds = require('../services/refund');
const reviews = require('../services/review');
const { NOTIFICATION_TYPE_LABELS } = require('../services/notification');
const { parseVnpayIpn, verifyWebhook, clientIp } = require('../services/payment-gateway');

// ---------- VNPAY IPN (server-to-server, GET, khong dung JWT) ----------
// Return URL in the browser must never update an order; only this signed IPN may do so.
router.get('/orders/vnpay-ipn', ah(async (req, res) => {
  const result = parseVnpayIpn(req.query);
  if (!result) return res.json({ RspCode: '97', Message: 'Invalid Checksum' });
  const order = await Order.findOne({ paymentOrderCode: result.orderCode });
  if (!order) return res.json({ RspCode: '01', Message: 'Order not found' });
  if (Number(order.totalAmount) !== result.amount) return res.json({ RspCode: '04', Message: 'Invalid amount' });
  const outcome = await orders.handleVnpayIpn(result);
  if (outcome === 'DUPLICATE') return res.json({ RspCode: '02', Message: 'Order already confirmed' });
  return res.json({ RspCode: '00', Message: 'Confirm Success' });
}));

// Fallback for the browser Return URL. The payload is still verified with the
// VNPAY checksum; it never trusts a client-provided payment status.
router.get('/orders/vnpay-return', ah(async (req, res) => {
  const result = parseVnpayIpn(req.query);
  if (!result) return res.status(400).json({ code: 'INVALID_SIGNATURE', message: 'Kết quả VNPAY không hợp lệ.' });
  const order = await Order.findOne({ paymentOrderCode: result.orderCode });
  if (!order) return res.status(404).json({ code: 'ORDER_NOT_FOUND', message: 'Không tìm thấy đơn hàng.' });
  if (Number(order.totalAmount) !== result.amount) return res.status(400).json({ code: 'INVALID_AMOUNT', message: 'Số tiền không khớp.' });
  const outcome = await orders.handleVnpayIpn(result);
  res.json({ outcome });
}));

router.post('/orders/payment-webhook', ah(async (req, res) => {
  // Compatibility hook for local automated tests only. Real VNPAY confirmations use vnpay-ipn.
  if (!bool('PAYMENT_SIMULATOR', false)) return res.status(404).json({ code: 'NOT_FOUND', message: 'API không tồn tại.' });
  const b = req.body || {};
  if (!verifyWebhook(b)) return res.status(401).json({ code: 'INVALID_SIGNATURE', message: 'Chữ ký webhook không hợp lệ.' });
  const outcome = await orders.processPaymentAndNotify({
    orderId: b.orderId, gatewayTxnId: String(b.gatewayTxnId), amount: Number(b.amount), success: b.status === 'SUCCESS', raw: b, gateway: 'WEBHOOK',
  });
  return res.json({ outcome });
}));

const customer = [authenticate, requireRole(Role.CUSTOMER)];

// ---------- Don hang (UC-01) ----------
router.post('/orders', customer, ah(async (req, res) => res.status(201).json(await orders.createOrder(req.user.userId, req.body, { ipAddress: clientIp(req) }))));
router.get('/orders/me', customer, ah(async (req, res) => res.json(await orders.findMyOrders(req.user.userId))));
router.get('/orders/:id', customer, ah(async (req, res) => res.json(await orders.findMyOrder(req.user.userId, req.params.id))));
router.post('/orders/:id/pay', customer, ah(async (req, res) => res.json(await orders.retryPayment(req.user.userId, req.params.id))));

// Gia lap thanh toan chi danh cho development/test (PAYMENT_SIMULATOR=true).
// chong xu ly trung, doi chieu so tien. result: success | failed | mismatch
router.post('/orders/:id/simulate-payment', customer, ah(async (req, res) => {
  if (!bool('PAYMENT_SIMULATOR', false)) throw forbidden('Chế độ giả lập thanh toán đang tắt.');
  const order = await orders.findMyOrderDoc(req.user.userId, req.params.id);
  const result = req.body?.result || 'success';
  const amount = result === 'mismatch' ? Math.max(1000, Math.round(order.totalAmount / 2)) : order.totalAmount;
  const outcome = await orders.processPaymentAndNotify({
    orderId: order._id, gatewayTxnId: `SIM-${crypto.randomUUID()}`, amount, success: result !== 'failed', raw: { simulator: true, result }, gateway: 'SIMULATOR',
  });
  res.json({ outcome, order: await orders.findMyOrder(req.user.userId, req.params.id) });
}));

// ---------- Vi voucher ----------
router.get('/wallet', customer, ah(async (req, res) => res.json(await wallet.list(req.user.userId, req.query.tab))));
router.get('/wallet/:id', customer, ah(async (req, res) => res.json(await wallet.detail(req.user.userId, req.params.id))));

// ---------- Ma su dung (UC-02) ----------
router.post('/redeem/token', customer, ah(async (req, res) => res.json(await redeem.requestToken(req.user.userId, req.body.voucherItemId))));
router.get('/redeem/status/:voucherItemId', customer, ah(async (req, res) => res.json(await redeem.tokenStatus(req.user.userId, req.params.voucherItemId))));

// ---------- Hoan tien (UC-03) ----------
router.post('/refunds', customer, ah(async (req, res) => res.status(201).json(await refunds.requestRefund(req.user.userId, req.body))));
router.get('/refunds/me', customer, ah(async (req, res) => res.json(await refunds.findMine(req.user.userId))));

// ---------- Danh gia ----------
router.post('/reviews', customer, ah(async (req, res) => res.status(201).json(await reviews.create(req.user.userId, req.body))));

// ---------- Thong bao ----------
router.get('/notifications', customer, ah(async (req, res) => {
  const items = await Notification.find({ userId: req.user.userId }).sort({ createdAt: -1 }).limit(100);
  const unread = await Notification.countDocuments({ userId: req.user.userId, readAt: null });
  res.json({ items, unread });
}));
router.patch('/notifications/read-all', customer, ah(async (req, res) => {
  const r = await Notification.updateMany({ userId: req.user.userId, readAt: null }, { readAt: new Date() });
  res.json({ updated: r.modifiedCount });
}));
router.patch('/notifications/:id/read', customer, ah(async (req, res) => {
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user.userId }, { readAt: new Date() }, { new: true }).catch(() => null);
  if (!n) throw notFound('Không tìm thấy thông báo.');
  res.json(n);
}));

async function settings(userId) {
  const rows = await NotificationSetting.find({ userId });
  return Object.entries(NOTIFICATION_TYPE_LABELS).map(([type, label]) => ({ type, label, enabled: rows.find((r) => r.type === type)?.enabled ?? true }));
}
router.get('/notifications/settings', customer, ah(async (req, res) => res.json(await settings(req.user.userId))));
router.put('/notifications/settings', customer, ah(async (req, res) => {
  const { type, enabled } = req.body;
  if (!NOTIFICATION_TYPE_LABELS[type]) throw badRequest('Nhóm thông báo không hợp lệ.');
  await NotificationSetting.updateOne({ userId: req.user.userId, type }, { enabled: !!enabled }, { upsert: true });
  res.json(await settings(req.user.userId));
}));

// ---------- Yeu thich / theo doi thuong hieu ----------
router.post('/favorites', customer, ah(async (req, res) => {
  const { targetType, targetId } = req.body;
  if (!Object.values(FavoriteTargetType).includes(targetType)) throw badRequest('Loại yêu thích không hợp lệ.');
  const Model = targetType === 'BRAND' ? Brand : Campaign;
  if (!(await Model.exists({ _id: targetId }).catch(() => null))) throw notFound();
  const removed = await Favorite.findOneAndDelete({ userId: req.user.userId, targetType, targetId });
  if (removed) return res.json({ favorited: false });
  try {
    await Favorite.create({ userId: req.user.userId, targetType, targetId });
  } catch (e) {
    // Bam nhanh hai lan: request kia vua tao xong -> van la "da yeu thich", khong tra loi 500
    if (e.code !== 11000) throw e;
  }
  return res.json({ favorited: true });
}));
router.get('/favorites', customer, ah(async (req, res) => {
  const favs = await Favorite.find({ userId: req.user.userId }).sort({ createdAt: -1 });
  const [campaigns, brands] = await Promise.all([
    Campaign.find({ _id: { $in: favs.filter((f) => f.targetType === 'CAMPAIGN').map((f) => f.targetId) } }),
    Brand.find({ _id: { $in: favs.map((f) => f.targetId) } }).select('name logo status'),
  ]);
  const c = new Map(campaigns.map((x) => [String(x._id), x]));
  const b = new Map(brands.map((x) => [String(x._id), x]));
  res.json(favs.map((f) => {
    if (f.targetType === 'CAMPAIGN') {
      const camp = c.get(String(f.targetId));
      return { ...f.toJSON(), title: camp?.title ?? null, image: camp?.image ?? null, salePrice: camp?.salePrice ?? null, faceValue: camp?.faceValue ?? null, status: camp?.status ?? null, brandName: camp ? b.get(String(camp.brandId))?.name ?? null : null };
    }
    const brand = b.get(String(f.targetId));
    return { ...f.toJSON(), title: brand?.name ?? null, image: brand?.logo ?? null, status: brand?.status ?? null };
  }));
}));

// ---------- Ho so ----------
router.patch('/profile', customer, ah(async (req, res) => {
  const update = {};
  for (const k of ['fullName', 'phone']) if (req.body[k] !== undefined) update[k] = String(req.body[k]).trim().slice(0, 100);
  res.json(await User.findByIdAndUpdate(req.user.userId, update, { new: true }));
}));

module.exports = router;
