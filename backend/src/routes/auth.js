const router = require('express').Router();
const { ah, business } = require('../utils/errors');
const { authenticate, requireRole } = require('../middleware/auth');
const { Role } = require('../utils/enums');
const { User } = require('../models');
const auth = require('../services/auth');

router.post('/otp/request', ah(async (req, res) => res.json(await auth.requestOtp(req.body.email))));
router.post('/otp/verify', ah(async (req, res) => res.json(await auth.verifyOtp(req.body.email, req.body.otp, req.body.deviceId))));
router.post('/login', ah(async (req, res) => res.json(await auth.login(req.body.email, req.body.password, req.body.deviceId))));
router.post('/refresh', ah(async (req, res) => res.json(await auth.refresh(req.body.refreshToken))));
router.post('/logout', authenticate, ah(async (req, res) => res.json(await auth.logout(req.user.userId, req.user.sessionId))));

router.get('/me', authenticate, ah(async (req, res) => {
  const user = await User.findById(req.user.userId);
  res.json({ user, activeStoreId: req.user.activeStoreId });
}));

// FR-AUTH-12: nhan vien chon chi nhanh lam viec
router.post('/select-store', authenticate, requireRole(Role.STORE_STAFF), ah(async (req, res) => {
  if (!req.body.storeId) throw business('STORE_REQUIRED', 'Vui lòng chọn chi nhánh.');
  res.json(await auth.selectStore(req.user.userId, req.user.sessionId, req.body.storeId));
}));

router.post('/activation/request', ah(async (req, res) => res.json(await auth.sendActivation(req.body.email))));
router.post('/activate', ah(async (req, res) => res.json(await auth.activate(req.body.email, req.body.token, req.body.password))));
router.post('/password-reset/request', ah(async (req, res) => res.json(await auth.requestPasswordReset(req.body.email))));
router.post('/password-reset/confirm', ah(async (req, res) => res.json(await auth.resetPassword(req.body.email, req.body.token, req.body.password))));

module.exports = router;
