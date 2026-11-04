# Bàn giao — Demo đăng nhập Customer bằng email OTP

Hãy tiếp tục công việc dưới đây. Trao đổi bằng tiếng Việt, chủ động thao tác khi đủ điều kiện.

## Dự án và mục tiêu

Vouch — Voucher Marketplace, React/Vite + Express/MongoDB, chạy trên Windows PowerShell.

Thư mục dự án:

```text
C:\Users\PC\Downloads\VOUCH-SDN-SE1925-main\VOUCH-SDN-SE1925-main
```

Mục tiêu hiện tại: thao tác trực tiếp trên Chrome để người dùng xem demo Customer đăng nhập bằng OTP gửi email thật tới **tanhdang306@gmail.com**.

## Đã triển khai

- CUSTOMER chỉ đăng nhập email OTP, không dùng password.
- ADMIN / BRAND_OWNER / STORE_STAFF đăng nhập email + password hiện có, không dùng OTP.
- Management demo password: `Voucher@123`.
  - `admin@voucher.local`
  - `owner@highlands.local`
  - `staff@highlands.local`
- API hiện có:
  - `POST /api/auth/otp/request` — `{ "email": "..." }`
  - `POST /api/auth/otp/verify` — `{ "email": "...", "otp": "..." }`
  - `POST /api/auth/login` — `{ "email": "...", "password": "..." }`, chỉ Management.
- OTP crypto sáu số, HMAC có secret/nonce, hạn năm phút, một lần sử dụng, tối đa năm lần thử, resend sau 60 giây, rate limit email/IP, xác minh nguyên tử.
- Backend kiểm tra CUSTOMER ACTIVE ở cả request và verify, bỏ qua role client tự gửi. Không tự tạo Customer mới.
- Không trả/log OTP. SMTP gửi nền; lỗi gửi vô hiệu challenge. Request trả thông báo chung tránh lộ tài khoản; không xác nhận email đã giao thành công.
- Giữ JWT/session/refresh/logout/RBAC.
- Kết quả kiểm thử: **51 backend test + 8 frontend test pass; frontend build thành công**. Test dùng mock mail và MongoMemoryServer, không chứng minh email thật đã được nhận.

## Trạng thái khi bàn giao

Ứng dụng đang chạy tại thời điểm kiểm tra gần nhất; cần xác minh lại:

- Backend: `http://localhost:3000`
- Frontend: `http://localhost:5173`
- Chrome đã mở `http://localhost:5173/login`, email `tanhdang306@gmail.com` đã có trong form.

Đã bấm **Gửi mã OTP** và thấy lỗi thiếu OTP_SECRET. Sau đó người dùng **đã cho phép assistant cấu hình `.env` giúp mình**.

Assistant đã sửa riêng `backend/.env`:

```env
MAIL_MODE=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=tanhdang306@gmail.com
EMAIL_FROM=Vouch <tanhdang306@gmail.com>
```

Đã tạo và lưu OTP_SECRET ngẫu nhiên bằng `crypto.randomBytes(32)`. **Không in hoặc tiết lộ giá trị.** Các thiết lập khác được giữ nguyên.

**SMTP_PASS còn trống. Chưa khởi động lại backend sau thay đổi cấu hình. Chưa gửi email thật thành công.**

## Việc cần làm tiếp

1. Hướng dẫn người dùng bật Google 2-Step Verification và tạo Gmail App Password tại <https://myaccount.google.com/apppasswords>.
2. Người dùng tự điền App Password vào `SMTP_PASS=` trong `backend/.env`. **Không yêu cầu gửi mật khẩu hoặc nội dung `.env` vào chat.** Không tự thao tác trang bảo mật Google. Tham khảo hướng dẫn chính thức: <https://support.google.com/accounts/answer/185833>.
3. Khi người dùng báo xong, kiểm tra cấu hình bằng boolean, không xuất secrets.
4. Khởi động lại backend an toàn; tránh chạy hai backend cùng cổng, không seed/reset dữ liệu.
5. Kiểm tra read-only xem `tanhdang306@gmail.com` có User CUSTOMER ACTIVE trong database hay chưa. OTP không tự đăng ký; nếu chưa có, trao đổi cách tạo tài khoản test rõ ràng, không âm thầm đổi role/tài khoản khác hoặc reset DB.
6. Demo trực tiếp trên Chrome: gửi OTP, người dùng xem hộp thư, nhập mã rồi xác nhận đăng nhập. Chỉ gửi số lượng nhỏ có kiểm soát.
7. Kiểm tra redirect Customer, session restore và logout nếu phù hợp. Báo đúng kết quả, không coi mock là gửi thật.

## File liên quan

Backend:

- `backend/src/services/auth.js`
- `backend/src/services/passwordless.js`
- `backend/src/services/mail.js`
- `backend/src/models/index.js`
- `backend/src/routes/auth.js`
- `backend/test/auth.test.js`
- `backend/test/flows.test.js`

Frontend:

- `frontend/src/components/EmailOtpLogin.jsx`
- `frontend/src/components/ManagementLogin.jsx`
- `frontend/src/customer/Account.jsx`
- `frontend/src/web/WebApp.jsx`
- `frontend/src/utils/auth-route.js`
- `frontend/test/benefits.test.mjs`
- `frontend/test/auth-route.test.mjs`

Báo cáo: `PASSWORDLESS_OTP_REPORT.md`. Báo cáo ghi trạng thái SMTP trước khi assistant vừa điền `.env`, nên phần cấu hình cần cập nhật sau demo.

## Công cụ thao tác máy

Đã dùng skill Computer Use ở đường dẫn sau; phiên mới cần đọc lại skill và tài liệu guidance/api/confirmations theo hướng dẫn:

```text
C:\Users\PC\.codex\plugins\cache\openai-bundled\computer-use\26.1027.51404\skills\computer-use\SKILL.md
```

Browser automation host trước đó báo unavailable, nên đã dùng **node_repl + `@oai/sky`** để thao tác Chrome.

Khởi tạo trong phiên node_repl mới:

```js
if (!globalThis.sky) {
  const { sky } = await import('@oai/sky');
  globalThis.sky = sky;
}
```

Sau đó dùng `sky.list_apps()` chọn cửa sổ mới, không dùng index/screenshot cũ. Cửa sổ Chrome mục tiêu có tiêu đề **vouch. - Voucher Platform - Google Chrome**. Window ID trước đó là `24053200`, nhưng cần lấy lại từ danh sách thực tế.

Không xuất toàn bộ tool result chứa ảnh base64 bằng `text()`. Quan sát trạng thái mới sau mỗi thao tác. Nếu người dùng nhấn Escape dừng Computer Use thì ngừng input.

## Ràng buộc

- Người dùng muốn thao tác thực tế để xem demo, không chỉ nhận hướng dẫn.
- Không đổi dashboard, layout Marketplace hoặc nghiệp vụ thanh toán/voucher.
- Không commit/push, không seed/reset database.
- Repo có nhiều thay đổi từ các tác vụ trước; giữ nguyên thay đổi không liên quan.
- Không tiết lộ secrets. `.env` chỉ sửa theo phạm vi người dùng đã cho phép.
- Chỉ tập trung tiếp tục demo email OTP thật, không làm lại phần triển khai đã hoàn tất.
