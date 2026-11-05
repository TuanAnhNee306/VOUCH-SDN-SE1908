# Vouch — Kết quả deployment public
Ngày xác minh: 05/11/2026 (giờ Việt Nam).

## URL hoạt động

- Customer Marketplace: https://vouch-sdn1908-web.onrender.com
- Customer login: https://vouch-sdn1908-web.onrender.com/login
- Management login: https://vouch-sdn1908-web.onrender.com/web/login
- API health: https://vouch-sdn1908-api.onrender.com/api/health

Đã mở web public trên Chrome, đọc đúng nội dung giảm giá/hoàn tiền và 32 voucher. API trả HTTP 200, database up. Không thay thế hoặc sửa hai service demo cũ.

## Source và hosting

- Repo: https://github.com/TuanAnhNee306/VOUCH-SDN-SE1908
- Nhánh: `tuananhdone`.
- Commit ứng dụng đã deploy: `17722f2` (bao gồm nội dung trang chủ từ `927e53a` và bản chuẩn bị `5803c85`).
- Blueprint: `exs-dblua656e07s73ah96gg`.
- Backend Free: `vouch-sdn1908-api`, ID `srv-dbluc956e07s73ahfp60`.
- Frontend Static Site: `vouch-sdn1908-web`, ID `srv-dbluc956e07s73ahfp40`.
- Frontend deployment Live đã quan sát: `dep-dbluh508v5cc73cvrdg0`, source `17722f2`.
- Frontend production asset đã kiểm tra: `/assets/index-DYMTMzUS.js`.
- Render đã được cập nhật bằng Blueprint Manual sync và frontend Manual Deploy. Không giả định push Git tự động triển khai; kiểm tra cấu hình auto-deploy trước những lần cập nhật sau.

## Dữ liệu

- MongoDB Atlas Cluster0, database deployment riêng `vouch_web_catalog_v1`.
- 32 campaign: **16 DISCOUNT + 16 CASHBACK**; 24 brand và 24 store.
- Không nhập campaign seed cũ, COMBO, PREPAID hoặc STORED_VALUE vào database deployment.
- Các ưu đãi là demo giả định, không phải xác nhận ưu đãi chính thức của thương hiệu.
- Không bịa đơn hàng, đánh giá hoặc doanh số.
- Nguồn: `backend/data/deploy-catalog.json`; audit dữ liệu local và tiêu chí loại bản ghi thử: `backend/data/deploy-source-audit.md`.
- Import đã chạy dry-run trước, sau đó apply. Đã đối chiếu aggregate trên Atlas và public API toàn bộ 32 campaign; dữ liệu vẫn đủ sau lần backend cập nhật môi trường/redeploy.
- Không xóa hoặc thay đổi database local/cluster cũ để tạo catalog này.

## Kiểm tra đã thực hiện

### Local

- Backend: **58/58 test pass**.
- Frontend: **10/10 test pass**, production build thành công.
- Importer dry-run không ghi DB; test import lặp giữ stock/timeline/password và không nhân đôi.
- Kiểm tra production không fallback MongoDB nhúng, không dùng signing secret mặc định.
- Test email dùng mock; được phân biệt với kiểm tra gửi thật bên dưới.

### Public

- API health HTTP 200, database up.
- Public catalog: total=32, DISCOUNT=16, CASHBACK=16; không lẫn loại khác.
- 24 logo trả HTTP 200 với Content-Type ảnh.
- CORS đúng origin frontend; frontend bundle trỏ đúng backend public.
- SPA refresh tại /, /login, /web/login và một URL campaign detail đều trả ứng dụng React.
- Trang chủ mới giới thiệu DISCOUNT/CASHBACK, bỏ phần giới thiệu voucher mệnh giá.
- ADMIN, BRAND_OWNER, STORE_STAFF đăng nhập password thành công; /auth/me, refresh rotation, logout và refresh sau logout đã kiểm tra.
- Customer password login bị chặn.
- Customer request OTP không trả code/token. **Người dùng nhận OTP qua Gmail và cung cấp mã để xác minh API thành công**, role CUSTOMER; dùng lại mã bị từ chối. Refresh và logout Customer thành công. Không lưu mã OTP hoặc token vào báo cáo.
- Thanh toán thử được bật theo yêu cầu rõ ràng của người dùng. Public /api/config xác nhận `paymentSimulator=true`, `vnpayConfigured=false`.
- Chưa tạo giao dịch thử public từ Customer tới phát hành voucher trong phiên cuối; luồng order/payment có test backend cô lập. Không coi việc bật simulator là xác minh VNPAY hoặc thanh toán thật.
- Browser QA dùng cây accessibility trên Chrome. Click native bị lỗi định vị; người dùng hỗ trợ bấm các nút Deploy/Sync. Chưa kiểm tra trực quan đầy đủ mọi trang dashboard hoặc mọi kích thước màn hình.

## Authentication và demo

- Customer chỉ email OTP. Đã provision Customer email người dùng chọn vào database deployment; không tự tạo tài khoản khi request OTP.
- Management chỉ email/password.
- Tài khoản demo: `admin@voucher.local`, `owner@highlands.local`, `staff@highlands.local`.
- Mật khẩu demo giữ `Voucher@123`; đây là môi trường demo với dữ liệu giả định, không phải tài khoản production thực.
- Owner Highlands thấy hai campaign Highlands; nhân viên được gán chi nhánh Highlands trong manifest.
- Hoa hồng mặc định 0.1, tức 10%.

## Email và cấu hình riêng

- Backend dùng Resend HTTPS, phù hợp Render Free.
- Sender test `Vouch <onboarding@resend.dev>`; chỉ gửi tới chủ tài khoản Resend hiện tại. Muốn Customer khác nhận OTP cần domain/sender được xác minh.
- SMTP local được giữ trong code, không dùng SMTP 465/587 trên Render Free.
- Secret DB/email/signing được nhập riêng; `backend/.env.deploy` bị Git ignore và không được commit.
- Người dùng đã gửi một số secrets trong chat. Cần thay/thu hồi chúng trước khi mở rộng sử dụng; cập nhật Render env và file riêng tương ứng. Không chép lại giá trị cũ vào báo cáo.
- Khi đổi OTP_SECRET, các challenge đang chờ sẽ không còn xác minh được; khi đổi JWT secrets, người dùng cần đăng nhập lại.

## Cập nhật và rollback

1. Sửa code trên nhánh tuananhdone, chạy kiểm tra phù hợp, review và push khi được phép.
2. Nếu đổi render.yaml, dùng Manual sync trên Blueprint và xem diff trước khi áp dụng.
3. Nếu chưa bật auto-deploy, vào service tương ứng → Manual Deploy → Deploy latest commit.
4. Xác minh lại health, /api/config, CORS, catalog và phiên đăng nhập; không chỉ dựa vào build pass.
5. Không chạy npm run seed hoặc seed:catalog trên database deployment.
6. Importer chỉ thêm manifest, không reset dữ liệu cũ. Không chạy lại để gia hạn ngày bán hoặc làm mới số lượng.
7. Rollback app qua Render deployment trước hoặc commit được chỉ định. Nếu cần phục hồi DB, dùng bản backup/export riêng đã kiểm tra; không chạy script seed xóa toàn bộ.
8. Hai service demo cũ vẫn giữ nguyên để đối chiếu, nhưng dùng repo và dữ liệu cũ; chúng không phải bản rollback tương đương mọi chức năng/data của catalog mới.

## Giới hạn và việc cần làm trước production

- Render Free có cold start, filesystem tạm và không bảo đảm cron trong process chạy khi service ngủ. Atlas giữ dữ liệu bền vững; cần scheduler/service luôn chạy cho job đúng giờ.
- VNPAY chưa được cấu hình ở service mới; thanh toán hiện chỉ là simulator đã được người dùng bật.
- IP rate limit: code mặc định không tin header proxy; cần xác minh CIDR/topology của Render và cấu hình TRUST_PROXY_CIDRS phù hợp trước khi dùng cho nhiều người. Không bật trust proxy=true tùy ý; các kiểm tra rate limit hiện tại chủ yếu trong test cô lập.
- Audit runtime dependencies đã phát hiện: backend 8 advisory (5 high, 3 moderate); frontend 3 high. Các package được npm nêu gồm Express/body-parser/path-to-regexp, Mongoose, Nodemailer và React Router. Không chạy npm audit fix --force hoặc nâng major ngoài phạm vi trong lúc deploy. Cần xử lý và test hồi quy trước production; bản demo public này không được coi là đã hoàn tất hardening.
- Các cảnh báo dependency build/dev trong Render không được tự động coi là exploit trên bundle public; kết quả audit runtime ở trên là kiểm tra riêng với npm audit --omit=dev.

## Tham khảo chính thức

- [Render Free limitations](https://render.com/docs/free)
- [Resend test sender](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain)
- [Express behind proxies](https://expressjs.com/en/guide/behind-proxies/)
