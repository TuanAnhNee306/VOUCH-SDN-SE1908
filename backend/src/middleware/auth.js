const jwt = require('jsonwebtoken');
const { User, Session, Brand } = require('../models');
const { UserStatus, Role } = require('../utils/enums');
const { unauthorized, forbidden, notFound } = require('../utils/errors');
const { accessSecret } = require('../services/auth');

async function resolveUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  let payload;
  try {
    payload = jwt.verify(token, accessSecret());
  } catch {
    throw unauthorized('Phiên đăng nhập đã hết hạn.');
  }
  if (payload.type !== 'access') throw unauthorized();
  // Kiem tra phien con hieu luc: dang xuat / vo hieu nhan vien thu hoi ngay
  const [session, user] = await Promise.all([
    Session.findOne({ _id: payload.sid, userId: payload.sub, revokedAt: null }),
    User.findById(payload.sub),
  ]);
  if (!session || !user || user.status !== UserStatus.ACTIVE) throw unauthorized('Phiên đăng nhập không còn hiệu lực.');
  return {
    userId: String(user._id), role: user.role, email: user.email, sessionId: String(session._id),
    activeStoreId: session.activeStoreId ? String(session.activeStoreId) : null,
  };
}

const authenticate = (req, _res, next) =>
  resolveUser(req).then((u) => {
    if (!u) throw unauthorized();
    req.user = u;
    next();
  }).catch(next);

// Khach vang lai van xem duoc; neu co token thi gan req.user
const optionalAuth = (req, _res, next) =>
  resolveUser(req).then((u) => { req.user = u; next(); }).catch(() => { req.user = null; next(); });

const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  if (!roles.includes(req.user.role)) return next(forbidden());
  return next();
};

// BR-19: chu thuong hieu chi thao tac tren thuong hieu cua minh (quan tri vien duoc xem tat ca)
const ownBrand = (param = 'brandId') => async (req, _res, next) => {
  try {
    const brand = await Brand.findById(req.params[param]).catch(() => null);
    if (!brand) throw notFound('Không tìm thấy thương hiệu.');
    if (req.user.role !== Role.ADMIN && String(brand.ownerUserId) !== req.user.userId) throw forbidden('Bạn không quản lý thương hiệu này.');
    req.brand = brand;
    next();
  } catch (e) {
    next(e);
  }
};

module.exports = { authenticate, optionalAuth, requireRole, ownBrand };
