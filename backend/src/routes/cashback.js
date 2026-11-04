const router = require('express').Router();
const { authenticate, requireRole, ownBrand } = require('../middleware/auth');
const { ah } = require('../utils/errors');
const cashback = require('../services/cashback');
const actor = req => ({ ...req.user, ...(req.params.brandId ? { scopeBrandId: req.params.brandId } : {}) });
const staff = [authenticate, requireRole('STORE_STAFF')];
const owner = [authenticate, requireRole('BRAND_OWNER'), ownBrand('brandId')];
const customer = [authenticate, requireRole('CUSTOMER')];
const admin = [authenticate, requireRole('ADMIN')];
for (const [prefix, guard] of [['/staff/cashback', staff], ['/brand/:brandId/cashback', owner]]) {
  router.get(prefix, guard, ah(async (req, res) => res.json(await cashback.list(actor(req), req.query.status))));
  router.get(prefix + '/:id', guard, ah(async (req, res) => res.json(await cashback.detail(actor(req), req.params.id))));
  router.post(prefix + '/:id/report-paid', guard, ah(async (req, res) => res.json(await cashback.reportPaid(actor(req), req.params.id, req.body))));
  router.post(prefix + '/:id/supplement', guard, ah(async (req, res) => res.json(await cashback.reportPaid(actor(req), req.params.id, req.body, true))));
}
router.get('/cashback/:id', customer, ah(async (req, res) => res.json(await cashback.detail(req.user, req.params.id))));
router.post('/cashback/:id/confirm', customer, ah(async (req, res) => res.json(await cashback.customerAction(req.user, req.params.id, 'confirm', req.body))));
router.post('/cashback/:id/dispute', customer, ah(async (req, res) => res.json(await cashback.customerAction(req.user, req.params.id, 'dispute', req.body))));
router.get('/admin/cashback', admin, ah(async (req, res) => res.json(await cashback.list(req.user, req.query.status || 'DISPUTED'))));
router.get('/admin/cashback/:id', admin, ah(async (req, res) => res.json(await cashback.detail(req.user, req.params.id))));
router.post('/admin/cashback/:id/resolve', admin, ah(async (req, res) => res.json(await cashback.resolve(req.user, req.params.id, req.body))));
module.exports = router;
