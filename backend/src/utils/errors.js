// Loi nghiep vu tra ve cho client: { code, message, details }
class AppError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const badRequest = (message, code = 'BAD_REQUEST', details = null) => new AppError(400, code, message, details);
const business = (code, message, details = null, status = 400) => new AppError(status, code, message, details);
const notFound = (message = 'Không tìm thấy dữ liệu.') => new AppError(404, 'NOT_FOUND', message);
const forbidden = (message = 'Bạn không có quyền thực hiện thao tác này.') => new AppError(403, 'FORBIDDEN', message);
const unauthorized = (message = 'Vui lòng đăng nhập.') => new AppError(401, 'UNAUTHORIZED', message);
const tooMany = (code, message, details = null) => new AppError(429, code, message, details);

// Bao route async de loi nem ra di vao error handler
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { AppError, badRequest, business, notFound, forbidden, unauthorized, tooMany, ah };
