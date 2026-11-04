const nodemailer = require('nodemailer');
const { str, int, bool } = require('../config/env');
const { AppError } = require('../utils/errors');

// MAIL_MODE=smtp (mac dinh): gui email that qua SMTP.
// MAIL_MODE=console: chi in noi dung ra man hinh may chu, dung khi phat trien khong co SMTP.
const isConsoleMode = () => str('MAIL_MODE', 'smtp').toLowerCase() === 'console';

let transport = null;
function getTransport() {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: str('SMTP_HOST', 'smtp.gmail.com'),
      port: int('SMTP_PORT', 587),
      secure: bool('SMTP_SECURE'),
      auth: str('SMTP_USER') ? { user: str('SMTP_USER'), pass: str('SMTP_PASSWORD').replace(/\s+/g, '') } : undefined,
      connectionTimeout: 10000,
      socketTimeout: 15000,
    });
  }
  return transport;
}

const fromAddress = () => str('SMTP_FROM') || `Voucher Platform <${str('SMTP_USER')}>`;

// Kiem tra dang nhap SMTP luc khoi dong de bao loi cau hinh som, khong doi toi luc khach bam "Gui ma OTP"
async function verifyMail() {
  if (isConsoleMode()) {
    console.warn('[mail] MAIL_MODE=console: email KHONG duoc gui that, ma OTP chi in ra man hinh may chu.');
    return;
  }
  if (!str('SMTP_USER') || !str('SMTP_PASSWORD')) {
    console.error('[mail] Chua cau hinh SMTP_USER / SMTP_PASSWORD trong backend/.env -> khong gui duoc OTP.');
    return;
  }
  try {
    await getTransport().verify();
    console.log(`[mail] SMTP san sang, gui tu ${fromAddress()}`);
  } catch (e) {
    console.error(`[mail] Dang nhap SMTP that bai: ${e.message}`);
  }
}

async function sendMail(to, subject, text, html) {
  if (isConsoleMode()) {
    console.log(`\n[mail] Gui toi ${to}\n       Tieu de: ${subject}\n       ${text}\n`);
    return;
  }
  if (!str('SMTP_USER') || !str('SMTP_PASSWORD')) {
    throw new AppError(503, 'MAIL_NOT_CONFIGURED', 'Hệ thống chưa cấu hình gửi email. Vui lòng liên hệ quản trị viên.');
  }
  try {
    await getTransport().sendMail({ from: fromAddress(), to, subject, text, html });
  } catch (e) {
    console.warn(`[mail] Gui email toi ${to} that bai: ${e.message}`);
    throw new AppError(503, 'MAIL_FAILED', 'Không gửi được email. Vui lòng thử lại sau.');
  }
}

// Email ma OTP dang HTML
function otpEmail(code, minutes) {
  const text = `Mã OTP đăng nhập Voucher Platform của bạn là ${code}. Mã có hiệu lực ${minutes} phút. Không chia sẻ mã này cho bất kỳ ai.`;
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #dbe6e2;border-radius:14px">
  <div style="font-size:28px;font-weight:900;color:#0b7a65">vouch.</div>
  <p style="color:#17302a">Mã xác thực đăng nhập Voucher Platform của bạn:</p>
  <div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#0b7a65;background:#e3f2ee;border-radius:12px;padding:14px;text-align:center">${code}</div>
  <p style="color:#6a7d77;font-size:13px">Mã có hiệu lực trong ${minutes} phút. Không chia sẻ mã này cho bất kỳ ai, kể cả nhân viên Voucher Platform.</p>
  <p style="color:#6a7d77;font-size:13px">Nếu bạn không yêu cầu đăng nhập, hãy bỏ qua email này.</p>
</div>`;
  return { text, html };
}

module.exports = { sendMail, isConsoleMode, verifyMail, otpEmail };
