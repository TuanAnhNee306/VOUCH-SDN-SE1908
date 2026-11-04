const nodemailer = require('nodemailer');
const { str, int, bool } = require('../config/env');
const { AppError } = require('../utils/errors');

// MAIL_MODE=smtp: gui email that qua SMTP.
// MAIL_MODE=console: no delivery; Customer OTP requires real SMTP.
// Production phai dat ro MAIL_MODE=smtp va cac bien SMTP_*.
const isConsoleMode = () => str('MAIL_MODE', 'console').toLowerCase() === 'console';

let transport = null;
function getTransport() {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: str('SMTP_HOST', 'smtp.gmail.com'),
      port: int('SMTP_PORT', 465),
      secure: bool('SMTP_SECURE', int('SMTP_PORT', 465) === 465),
      requireTLS: !bool('SMTP_SECURE', int('SMTP_PORT', 465) === 465),
      auth: str('SMTP_USER') ? { user: str('SMTP_USER'), pass: (str('SMTP_PASS') || str('SMTP_PASSWORD')).replace(/\s+/g, '') } : undefined,
      connectionTimeout: 10000,
      socketTimeout: 15000,
    });
  }
  return transport;
}

const fromAddress = () => str('EMAIL_FROM') || str('SMTP_FROM') || `Voucher Marketplace <${str('SMTP_USER')}>`;

function assertOtpConfigured() {
  if (str('MAIL_MODE', 'console').toLowerCase() !== 'smtp' || !str('SMTP_USER') || !(str('SMTP_PASS') || str('SMTP_PASSWORD'))) {
    throw new AppError(503, 'MAIL_NOT_CONFIGURED', 'Cần cấu hình MAIL_MODE=smtp, SMTP_HOST/PORT, SMTP_USER, SMTP_PASS và EMAIL_FROM để gửi OTP thật.');
  }
}

async function sendOtp(to, code) {
  assertOtpConfigured();
  const { text, html } = otpEmail(code, 5);
  try {
    await getTransport().sendMail({ from: fromAddress(), to, subject: 'Mã xác thực đăng nhập Voucher Marketplace', text, html });
  } catch {
    throw new AppError(503, 'MAIL_FAILED', 'Không gửi được email xác thực.');
  }
}

// Kiem tra dang nhap SMTP luc khoi dong de bao loi cau hinh som, khong doi toi luc khach bam "Gui ma OTP"
async function verifyMail() {
  if (isConsoleMode()) {
    console.warn('[mail] MAIL_MODE=console: email không được gửi; đăng nhập OTP yêu cầu SMTP thật.');
    return;
  }
  if (!str('SMTP_USER') || !(str('SMTP_PASS') || str('SMTP_PASSWORD'))) {
    console.error('[mail] Cần cấu hình SMTP_USER và SMTP_PASS để gửi email.');
    return;
  }
  try {
    await getTransport().verify();
    console.log(`[mail] SMTP san sang, gui tu ${fromAddress()}`);
  } catch (e) {
    console.error('[mail] Không xác minh được kết nối SMTP. Kiểm tra cấu hình máy chủ.');
  }
}

async function sendMail(to, subject, text, html) {
  if (isConsoleMode()) {
    console.log('[mail] Console mode: message not delivered.');
    return;
  }
  if (!str('SMTP_USER') || !(str('SMTP_PASS') || str('SMTP_PASSWORD'))) {
    throw new AppError(503, 'MAIL_NOT_CONFIGURED', 'Hệ thống chưa cấu hình gửi email. Vui lòng liên hệ quản trị viên.');
  }
  try {
    await getTransport().sendMail({ from: fromAddress(), to, subject, text, html });
  } catch (e) {
    console.warn('[mail] Email delivery failed.');
    throw new AppError(503, 'MAIL_FAILED', 'Không gửi được email. Vui lòng thử lại sau.');
  }
}

// Email ma OTP dang HTML
function otpEmail(code, minutes) {
  const text = `Mã OTP đăng nhập Voucher Platform của bạn là ${code}. Mã có hiệu lực ${minutes} phút. Không chia sẻ mã này cho bất kỳ ai.`;
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e5e9f1;border-radius:14px;background:#fff">
  <div style="font-size:28px;font-weight:900;color:#4f46e5">vouch.</div>
  <h1 style="font-size:22px;color:#1e293b">Xác thực đăng nhập</h1>
  <p style="color:#475569">Mã xác thực đăng nhập Voucher Marketplace của bạn:</p>
  <div style="font-size:32px;font-weight:800;letter-spacing:6px;color:#3730a3;background:#eef2ff;border-radius:12px;padding:14px;text-align:center">${code}</div>
  <p style="color:#475569;font-size:14px;line-height:1.7">Mã có hiệu lực trong ${minutes} phút và chỉ dùng một lần. Không chia sẻ mã này cho bất kỳ ai, kể cả nhân viên Voucher Marketplace.</p>
  <p style="color:#475569;font-size:13px">Nếu bạn không yêu cầu đăng nhập, hãy bỏ qua email này.</p>
</div>`;
  return { text, html };
}

module.exports = { sendMail, sendOtp, assertOtpConfigured, isConsoleMode, verifyMail, otpEmail };
