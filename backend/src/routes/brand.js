const router = require('express').Router();
const { ah, notFound } = require('../utils/errors');
const { authenticate, requireRole, ownBrand } = require('../middleware/auth');
const { Role } = require('../utils/enums');
const { Campaign, Store, StaffAssignment, Settlement } = require('../models');
const brands = require('../services/brand');
const campaigns = require('../services/campaign');
const reviews = require('../services/review');
const reports = require('../services/report');
const settlements = require('../services/settlement');

router.use(authenticate, requireRole(Role.BRAND_OWNER));

router.get('/me', ah(async (req, res) => res.json(await brands.findMyBrands(req.user.userId))));
router.post('/', ah(async (req, res) => res.status(201).json(await brands.createBrand(req.user.userId, req.body))));

const own = ownBrand('brandId');
router.patch('/:brandId', own, ah(async (req, res) => res.json(await brands.updateBrand(req.params.brandId, req.body))));

// ---------- Chi nhanh ----------
router.get('/:brandId/stores', own, ah(async (req, res) => res.json(await brands.findStores(req.params.brandId))));
router.post('/:brandId/stores', own, ah(async (req, res) => res.status(201).json(await brands.createStore(req.params.brandId, req.body))));
router.patch('/:brandId/stores/:storeId', own, ah(async (req, res) => {
  if (!(await Store.exists({ _id: req.params.storeId, brandId: req.params.brandId }).catch(() => null))) throw notFound('Không tìm thấy chi nhánh.');
  res.json(await brands.updateStore(req.params.storeId, req.body));
}));

// ---------- Nhan vien ----------
router.get('/:brandId/staff', own, ah(async (req, res) => res.json(await brands.findStaff(req.params.brandId))));
router.post('/:brandId/staff', own, ah(async (req, res) => res.status(201).json(await brands.assignStaff(req.params.brandId, req.body))));
router.patch('/:brandId/staff/:assignmentId/deactivate', own, ah(async (req, res) => {
  const a = await StaffAssignment.findById(req.params.assignmentId).catch(() => null);
  if (!a || !(await Store.exists({ _id: a.storeId, brandId: req.params.brandId }))) throw notFound('Không tìm thấy nhân viên.');
  res.json(await brands.deactivateStaff(req.params.assignmentId));
}));

// ---------- Chien dich (UC-04) ----------
router.get('/:brandId/campaigns', own, ah(async (req, res) => res.json(await campaigns.findByBrand(req.params.brandId))));
router.post('/:brandId/campaigns', own, ah(async (req, res) => res.status(201).json(await campaigns.create(req.params.brandId, req.body))));

const ownCampaign = ah(async (req, _res, next) => {
  if (!(await Campaign.exists({ _id: req.params.id, brandId: req.params.brandId }).catch(() => null))) throw notFound('Không tìm thấy chiến dịch.');
  next();
});
router.patch('/:brandId/campaigns/:id', own, ownCampaign, ah(async (req, res) => res.json(await campaigns.update(req.params.id, req.body))));
for (const action of ['submit', 'withdraw', 'pause', 'resume']) {
  router.patch(`/:brandId/campaigns/:id/${action}`, own, ownCampaign, ah(async (req, res) => res.json(await campaigns[action](req.params.id))));
}

// ---------- Danh gia, bao cao, doi soat ----------
router.get('/:brandId/reviews', own, ah(async (req, res) => res.json(await reviews.listByBrand(req.params.brandId))));
router.patch('/:brandId/reviews/:id/reply', own, ah(async (req, res) => res.json(await reviews.reply(req.params.id, req.params.brandId, req.body.reply))));
router.get('/:brandId/report', own, ah(async (req, res) => res.json(await reports.brandReport(req.params.brandId, req.query))));
router.get('/:brandId/settlements', own, ah(async (req, res) => res.json(await settlements.findByBrand(req.params.brandId))));
router.get('/:brandId/settlements/:id', own, ah(async (req, res) => {
  if (!(await Settlement.exists({ _id: req.params.id, brandId: req.params.brandId }).catch(() => null))) throw notFound('Không tìm thấy phiếu đối soát.');
  res.json(await settlements.detail(req.params.id));
}));

module.exports = router;
