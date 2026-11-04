const router = require('express').Router();
const { ah, badRequest, notFound } = require('../utils/errors');
const { authenticate, requireRole } = require('../middleware/auth');
const { Role, ReviewStatus } = require('../utils/enums');
const { Category, SystemConfig, Campaign, Brand } = require('../models');
const brands = require('../services/brand');
const campaigns = require('../services/campaign');
const settlements = require('../services/settlement');
const refunds = require('../services/refund');
const reviews = require('../services/review');
const reports = require('../services/report');
const orders = require('../services/order');
const { REFUND_SANDBOX_KEY, getRefundSandboxMode } = require('../services/config');

router.use(authenticate, requireRole(Role.ADMIN));

router.get('/dashboard', ah(async (req, res) => res.json(await reports.adminDashboard(req.query))));

// ---------- Thuong hieu ----------
router.get('/brands', ah(async (req, res) => res.json(await brands.findAll(req.query.status))));
router.patch('/brands/:id/approve', ah(async (req, res) => res.json(await brands.approve(req.params.id))));
router.patch('/brands/:id/reject', ah(async (req, res) => res.json(await brands.reject(req.params.id, req.body.reason))));
router.patch('/brands/:id/suspend', ah(async (req, res) => res.json(await brands.suspend(req.params.id, req.body.reason, req.user.userId))));
router.patch('/brands/:id/reinstate', ah(async (req, res) => res.json(await brands.reinstate(req.params.id, req.user.userId))));

// ---------- Chien dich (UC-04) ----------
router.get('/campaigns', ah(async (req, res) => res.json(await campaigns.findAllAdmin(req.query.status))));
router.get('/campaigns/pending', ah(async (_req, res) => res.json(await campaigns.findPending())));
router.patch('/campaigns/:id/approve', ah(async (req, res) => res.json(await campaigns.approve(req.params.id, req.user.userId))));
router.patch('/campaigns/:id/reject', ah(async (req, res) => res.json(await campaigns.reject(req.params.id, req.body.reason))));
// Chay ngay tac vu ra soat trang thai (binh thuong 5 phut / lan)
router.post('/jobs/campaign-transitions', ah(async (_req, res) => {
  const cancelled = await orders.cancelExpiredOrders();
  res.json({ ...(await campaigns.runStatusTransitions()), cancelledOrders: cancelled });
}));

// ---------- Hoa hong, doi soat (UC-05) ----------
router.get('/commission-rate', ah(async (_req, res) => res.json(await settlements.getCommissionRateInfo())));
router.post('/commission-rate', ah(async (req, res) => res.json(await settlements.setCommissionRate(req.body.rate, req.user.userId))));
router.get('/settlements', ah(async (_req, res) => res.json(await settlements.findAll())));
router.post('/settlements/run-previous-month', ah(async (_req, res) => res.json(await settlements.runPreviousMonth())));
router.post('/settlements/run', ah(async (req, res) => {
  const created = await settlements.runSettlement(req.body.periodStart, req.body.periodEnd);
  res.json({ created: created.length, settlements: created });
}));
router.get('/settlements/:id', ah(async (req, res) => res.json(await settlements.detail(req.params.id))));
router.patch('/settlements/:id/mark-paid', ah(async (req, res) => res.json(await settlements.markPaid(req.params.id, req.body.bankTxnRef, req.user.userId))));

// ---------- Hoan tien thu cong (UC-07) va don lech so tien (BR-20) ----------
router.get('/refunds/manual-pending', ah(async (_req, res) => res.json(await refunds.findManualPending())));
router.patch('/refunds/:id/confirm-manual', ah(async (req, res) => res.json(await refunds.confirmManualRefund(req.params.id, req.user.userId, req.body.gatewayRefundId))));
router.patch('/refunds/:id/fail-manual', ah(async (req, res) => res.json(await refunds.failManualRefund(req.params.id, req.user.userId, req.body.reason))));
router.get('/payment-mismatches', ah(async (_req, res) => res.json(await refunds.paymentMismatches())));
router.patch('/payment-mismatches/:orderId/confirm', ah(async (req, res) => res.json(await refunds.confirmMismatch(req.params.orderId, req.user.userId, req.body.gatewayRefundId))));

// Che do cong hoan gia lap (demo 3 nhanh cua Luong 4 ma khong can khoi dong lai may chu)
router.get('/refund-sandbox', ah(async (_req, res) => res.json({ mode: await getRefundSandboxMode() })));
router.put('/refund-sandbox', ah(async (req, res) => {
  const mode = String(req.body.mode || '').toLowerCase();
  if (!['success', 'declined', 'unavailable'].includes(mode)) throw badRequest('Chế độ phải là success, declined hoặc unavailable.');
  await SystemConfig.updateOne({ key: REFUND_SANDBOX_KEY }, { value: mode, updatedBy: req.user.userId }, { upsert: true });
  res.json({ mode });
}));

// ---------- Danh gia ----------
router.get('/reviews', ah(async (req, res) => res.json(await reviews.listAdmin(req.query.status))));
router.patch('/reviews/:id/hide', ah(async (req, res) => res.json(await reviews.setStatus(req.params.id, req.user.userId, ReviewStatus.HIDDEN, req.body.reason))));
router.patch('/reviews/:id/unhide', ah(async (req, res) => res.json(await reviews.setStatus(req.params.id, req.user.userId, ReviewStatus.VISIBLE))));

// ---------- Danh muc nganh hang ----------
router.get('/categories', ah(async (_req, res) => res.json(await Category.find().sort({ displayOrder: 1 }))));
router.post('/categories', ah(async (req, res) => {
  if (!req.body.name?.trim()) throw badRequest('Vui lòng nhập tên danh mục.');
  res.status(201).json(await Category.create({ name: req.body.name.trim(), icon: req.body.icon, displayOrder: Number(req.body.displayOrder) || 0 }));
}));
router.patch('/categories/:id', ah(async (req, res) => {
  const c = await Category.findByIdAndUpdate(req.params.id, { name: req.body.name, icon: req.body.icon, displayOrder: req.body.displayOrder }, { new: true, omitUndefined: true }).catch(() => null);
  if (!c) throw notFound();
  res.json(c);
}));
router.delete('/categories/:id', ah(async (req, res) => {
  const used = await Campaign.exists({ categoryId: req.params.id }) || await Brand.exists({ categoryId: req.params.id });
  if (used) throw badRequest('Danh mục đang được sử dụng, không thể xóa.');
  await Category.deleteOne({ _id: req.params.id });
  res.json({ message: 'Đã xóa danh mục.' });
}));

module.exports = router;
