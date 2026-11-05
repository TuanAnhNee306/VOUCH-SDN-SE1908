# Trạng thái triển khai Vouch — 05/11/2026

## Nguồn và phạm vi

- Người dùng chọn deploy nhánh `tuananhdone`.
- Repository được GitHub xác nhận đã đổi tên thành `TuanAnhNee306/VOUCH-SDN-SE1908` (repository ID 1393042777); remote local tên SE1925 chuyển hướng tới cùng repo.
- Base local/remote trước thay đổi: `143cfe3908afc21d8c7d40b20cacc8624d834272`.
- Deployment mới dùng 32 voucher demo: 16 DISCOUNT, 16 CASHBACK, 24 thương hiệu và 24 chi nhánh. Không nhập campaign seed cũ, combo hoặc voucher mệnh giá.
- Nguồn dữ liệu và các bản ghi bị loại: `backend/data/deploy-source-audit.md`. Manifest: `backend/data/deploy-catalog.json`.

## Kết quả chuẩn bị

- Form/API tạo mới chỉ DISCOUNT/CASHBACK; đọc và kiểm thử lịch sử STORED_VALUE vẫn được giữ.
- Giảm giá kiểm tra hóa đơn tối thiểu, trần giảm, snapshot quyền lợi theo đơn, không tiêu QR khi hóa đơn chưa đủ điều kiện.
- Production tắt cả hai seed startup, không fallback MongoDB nhúng, không log URI DB khi kết nối lỗi. Kiểm tra signing secrets và URL HTTPS trước khởi động.
- Render Blueprint: `render.yaml`, backend Free + frontend Static, SPA rewrite và các secret nhập riêng.
- Gửi mail HTTPS qua Resend (`MAIL_MODE=resend`, `RESEND_API_KEY`, `EMAIL_FROM`); Gmail SMTP local vẫn giữ.
- Backend: 58 test pass. Frontend: 10 test pass. Frontend production build thành công.
- Các test importer và business flow chạy trên MongoMemoryServer; email HTTPS dùng mock, chưa xác minh thư thật.

## Service cũ đã kiểm tra read-only

- Workspace Render có Static Site `vouchvn`, ID `srv-dblae7gae00c73blm43g`.
- Backend Free `voucher-platform-vnpay-1`, ID `srv-dblf10rncjis73dmhkhg`.
- API cũ: `https://voucher-platform-vnpay-1.onrender.com/api/health` trả HTTP 200 và database up.
- Backend cũ lấy repo `TuanAnhNee306/voucher-platform-vnpay`, branch main, commit `442f604379ed7da3132ea0a3a3b73ff6fb26c51f`. Đây chưa phải bản deploy mới.
- Chưa thay đổi service cũ hoặc dữ liệu của nó.

## Input riêng và bước còn lại

`backend/.env.deploy` được Git ignore, chứa secret signing mới tạo riêng; không commit hoặc xuất nội dung. Người dùng có Atlas, chưa có Resend tại lần xác nhận gần nhất.

1. Điền `DEPLOY_MONGO_URI` trỏ Atlas database mới `vouch_web_catalog_v1`.
2. Đăng ký/đăng nhập Resend và điền `RESEND_API_KEY`. Với sender test `onboarding@resend.dev`, chỉ gửi được đến email của tài khoản Resend; gửi cho khách hàng khác cần domain được xác minh.
3. Importer không tự chạy. Trong thư mục backend, nạp `.env.deploy` rồi chạy dry-run:

```powershell
node -r dotenv/config src/import-deploy-catalog.js dotenv_config_path=.env.deploy
```

Sau khi dry-run đúng database và manifest mới được nhập:

```powershell
node -r dotenv/config src/import-deploy-catalog.js --apply dotenv_config_path=.env.deploy
```

Importer từ chối database có campaign ngoài manifest, chỉ dùng setOnInsert để giữ stock/timeline/account khi retry. Mật khẩu env chỉ dùng provision tài khoản quản lý mới. Không chạy `npm run seed` hoặc `npm run seed:catalog`.

4. Tạo/cấu hình service mới lấy đúng repo + nhánh tuananhdone; nhập env riêng trong Render. `VITE_API_URL` là origin backend không có `/api`; CORS_ORIGIN và WEB_APP_URL là URL frontend.
5. Xác minh public URL, health, catalog hai loại, đăng nhập Management, Customer nhận OTP thật, refresh/logout và việc lưu dữ liệu sau restart.

## Tiến độ cấu hình thực tế

- Đã push code deploy lên `tuananhdone`, commit đầu `5803c859607fa662eb39d6be6a865f4deea1e642`.
- Resend HTTPS đã trả HTTP 200 và chấp nhận gửi một email kiểm tra đến Gmail người dùng chọn. Chưa coi đây là xác minh OTP đăng nhập hoặc bằng chứng inbox đã nhận thư.
- Đã kết nối Atlas Cluster0; nhập vào database mới `vouch_web_catalog_v1`: **32 campaign, 16 DISCOUNT, 16 CASHBACK, 24 brand, 24 store**. Đã kiểm tra bằng aggregate trực tiếp, không chạy seed cũ.
- Service mới dự kiến: `vouch-sdn1908-api` và `vouch-sdn1908-web`; các URL trong Blueprint phải được đối chiếu lại khi Render tạo service.
- Secret DB/email được lưu trong `.env.deploy` đã Git ignore, không xuất ra báo cáo hoặc commit.

**Chưa hoàn tất deploy public trong báo cáo này.** Cần cập nhật URL/commit/kết quả thực tế sau khi deploy.

## Giới hạn hosting

[Render Free](https://render.com/docs/free) chặn SMTP cổng 25/465/587, có cold start và filesystem tạm. Dữ liệu phải nằm trên Atlas. Cron trong process không bảo đảm chạy lúc service ngủ. [Resend test sender](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain) chỉ gửi cho chủ tài khoản khi chưa xác minh domain.
