const router = require('express').Router();
const { ah, business } = require('../utils/errors');
const { authenticate, requireRole } = require('../middleware/auth');
const { Role } = require('../utils/enums');
const redeem = require('../services/redeem');

router.use(authenticate, requireRole(Role.STORE_STAFF));

router.get('/my-stores', ah(async (req, res) => res.json(await redeem.myStores(req.user.userId))));

// Nhan vien xac nhan su dung tai chi nhanh dang lam trong phien (FR-REDEEM-05..13)
router.post('/redeem', ah(async (req, res) => {
  if (!req.user.activeStoreId) {
    throw business('STORE_NOT_SELECTED', 'Vui lòng chọn chi nhánh làm việc trước khi xác nhận sử dụng voucher.');
  }
  res.json(await redeem.redeem(req.user.userId, { ...req.body, storeId: req.user.activeStoreId }));
}));

router.get('/history/today', ah(async (req, res) => res.json(await redeem.historyToday(req.user.userId, req.user.activeStoreId))));
router.patch('/logs/:id/bill', ah(async (req, res) => res.json(await redeem.updateBill(req.user.userId, req.params.id, req.body.billAmount))));

module.exports = router;
