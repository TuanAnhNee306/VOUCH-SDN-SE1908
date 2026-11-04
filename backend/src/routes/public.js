const router = require('express').Router();
const { ah } = require('../utils/errors');
const { optionalAuth } = require('../middleware/auth');
const catalog = require('../services/catalog');
const { bool } = require('../config/env');
const { vnpayConfigured } = require('../services/payment-gateway');

router.get('/config', (_req, res) => res.json({ paymentSimulator: bool('PAYMENT_SIMULATOR', false), vnpayConfigured: vnpayConfigured() }));
router.get('/categories', ah(async (_req, res) => res.json(await catalog.listCategories())));
router.get('/campaigns', optionalAuth, ah(async (req, res) => res.json(await catalog.search(req.query, req.user?.userId))));
router.get('/campaigns/:id', optionalAuth, ah(async (req, res) => res.json(await catalog.detail(req.params.id, req.query, req.user?.userId))));
router.get('/brands/:id/public', optionalAuth, ah(async (req, res) => res.json(await catalog.brandProfile(req.params.id, req.user?.userId))));
router.get('/map/stores', ah(async (_req, res) => res.json(await catalog.mapStores())));

module.exports = router;
