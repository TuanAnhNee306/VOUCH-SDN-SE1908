const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { AppError } = require('./utils/errors');
const { str } = require('./config/env');

function createApp() {
  const app = express();
  const origins = str('CORS_ORIGIN', 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean);
  app.use(cors({ origin: (origin, cb) => cb(null, !origin || origins.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) }));
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'up' : 'down' }));
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api', require('./routes/public'));
  app.use('/api', require('./routes/customer'));
  app.use('/api/staff', require('./routes/staff'));
  app.use('/api/brand', require('./routes/brand'));
  app.use('/api/admin', require('./routes/admin'));

  app.use('/api', (_req, res) => res.status(404).json({ code: 'NOT_FOUND', message: 'API không tồn tại.' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof AppError) return res.status(err.status).json({ code: err.code, message: err.message, details: err.details });
    if (err instanceof mongoose.Error.CastError) return res.status(404).json({ code: 'NOT_FOUND', message: 'Không tìm thấy dữ liệu.' });
    if (err instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: Object.values(err.errors).map((e) => e.message).join('; ') });
    }
    if (err.type === 'entity.parse.failed') return res.status(400).json({ code: 'BAD_JSON', message: 'Dữ liệu gửi lên không đúng định dạng JSON.' });
    console.error('[error]', err);
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Lỗi máy chủ, vui lòng thử lại.' });
  });
  return app;
}

module.exports = { createApp };
