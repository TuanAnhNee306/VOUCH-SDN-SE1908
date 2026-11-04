# Customer Email OTP — kết quả triển khai

## Cơ chế đăng nhập

Customer đăng nhập bằng email OTP tại `/login`. Management tại `/web/login` dùng email và mật khẩu, không có form OTP. Ba tài khoản demo hiện có giữ mật khẩu `Voucher@123`: `admin@voucher.local`, `owner@highlands.local`, `staff@highlands.local`. Không chạy seed hoặc cập nhật tài khoản trong database thực.

Giữ API theo convention hiện có:

- `POST /api/auth/otp/request`: `{ "email": "customer@example.com" }`.
- `POST /api/auth/otp/verify`: `{ "email": "customer@example.com", "otp": "123456" }`.
- `POST /api/auth/login`: `{ "email": "admin@voucher.local", "password": "..." }`, chỉ Management.

Role luôn lấy từ database. Cả request và verify OTP chỉ chấp nhận Customer ACTIVE. Không tự tạo tài khoản khi nhập email; dự án hiện không cung cấp đăng ký Customer công khai. Tài khoản Customer có sẵn với email nhận thư thật là điều kiện để kiểm tra gửi thật. Tài khoản seed `.local` không nhận được email ngoài Internet.

## Bảo mật

OTP tạo bằng crypto, sáu chữ số, hết hạn năm phút, chỉ dùng một lần; lưu HMAC SHA-256 với OTP_SECRET và nonce. Không trả hoặc log mã. Tối đa năm lần thử, resend sau 60 giây và vô hiệu mã trước. MongoDB cập nhật nguyên tử ngăn xác minh đồng thời tạo nhiều session. Giới hạn request: 5/email/giờ, 30/IP/giờ; verify: 25/email/giờ, 100/IP/giờ. Bucket tính theo giờ, không phải cửa sổ trượt.

Email không tồn tại, bị vô hiệu hoặc thuộc Management nhận cùng phản hồi request; gửi SMTP chạy ngoài đường phản hồi để không lộ role qua thời gian chờ SMTP. Nếu SMTP gửi thất bại, challenge bị vô hiệu, chỉ log cảnh báo không chứa thông tin nhạy cảm. Phản hồi request là thông báo chung, không xác nhận thư đã giao. Thiếu cấu hình SMTP/OTP_SECRET trả 503, không giả lập OTP. Management không phụ thuộc cấu hình OTP/SMTP để đăng nhập.

JWT, refresh token xoay vòng, session, logout và middleware phân quyền hiện có được giữ lại. Customer bị chặn tại password endpoint, Management bị chặn tại OTP kể cả challenge cũ và role giả từ client.

## Cấu hình Gmail SMTP

Điền riêng trong `backend/.env` (không commit):

```env
MAIL_MODE=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-account@gmail.com
SMTP_PASS=your-google-app-password
EMAIL_FROM=Vouch <your-account@gmail.com>
OTP_SECRET=private-random-secret-at-least-32-characters
```

Tạo OTP_SECRET ngẫu nhiên bằng `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`, lưu riêng trên server. SMTP_PASSWORD/SMTP_FROM vẫn hỗ trợ như alias cũ. Port 587 dùng SMTP_SECURE=false và STARTTLS bắt buộc. Khởi động lại backend sau thay đổi cấu hình.

Bật Xác minh 2 bước cho tài khoản Google, mở [App Passwords](https://myaccount.google.com/apppasswords), tạo mật khẩu ứng dụng cho Vouch rồi dùng giá trị đó làm SMTP_PASS. Google có thể không cung cấp tùy chọn này với một số tài khoản tổ chức, Advanced Protection hoặc chỉ dùng khóa bảo mật. Xem [hướng dẫn Google](https://support.google.com/accounts/answer/185833).

## Kiểm thử và giới hạn

- Backend: 51/51 test pass, gồm 12 test auth chuyên biệt và 39 test luồng hiện có. Email transport được mock, database dùng MongoMemoryServer cô lập.
- Đã kiểm tra Customer OTP đúng/sai/hết hạn/dùng lại, resend, hash, rate limit email/IP, tài khoản vô hiệu, race condition; ba vai trò Management đăng nhập mật khẩu; chặn dùng chéo cơ chế; refresh rotation/logout và hồi quy RBAC/nghiệp vụ.
- Frontend: 8/8 test pass, gồm render Customer không có password, Management có password và tài khoản demo nhưng không có OTP; redirect role và bảo toàn next checkout hợp lệ.
- `npm run build` frontend thành công.
- Chưa chạy kiểm thử tương tác trình duyệt; render test không thay thế việc kiểm tra toàn bộ giao diện trên trình duyệt.
- Chưa xác minh gửi email thật: môi trường hiện thiếu SMTP_USER, SMTP_PASS và OTP_SECRET hợp lệ, MAIL_MODE=console. Không sửa `.env`, không gửi email thật trong automated tests. Sau khi cấu hình, kiểm tra một email Customer ACTIVE có thể nhận thư, nhập mã rồi kiểm tra resend/logout; không coi kết quả mock là bằng chứng Gmail đã nhận thư.

## File liên quan

Backend: `src/services/auth.js`, `src/services/passwordless.js`, `src/services/mail.js`, `src/models/index.js`, `src/routes/auth.js`, `.env.example`, `src/seed.js` (chỉ sửa chú thích), `package.json`, `test/auth.test.js`, `test/flows.test.js`.

Frontend: `src/components/EmailOtpLogin.jsx`, `src/components/ManagementLogin.jsx`, `src/customer/Account.jsx`, `src/web/WebApp.jsx`, `src/utils/auth-route.js`, `test/benefits.test.mjs`, `test/auth-route.test.mjs`, `package.json`.

Tài liệu: `README.md`, `DEMO.md`, báo cáo này. Không chỉnh dashboard, layout Marketplace, thanh toán, redemption hoặc dữ liệu production trong đợt sửa phạm vi Customer-only.
