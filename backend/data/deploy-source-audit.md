# Kiểm tra nguồn catalog deployment — 05/11/2026

Đã kiểm tra read-only database local `voucher_platform` qua kết nối đang cấu hình, không chạy seed hoặc sửa dữ liệu.

- Có 18 campaign: 15 campaign ban đầu khớp dữ liệu seed cũ; ba campaign tạo sau có tiêu đề thử `abasd`, `ABC`, `ádasdasdasd`.
- Hai trong ba bản ghi mới là STORED_VALUE, không thuộc phạm vi deployment. Bản CASHBACK tên ABC không đủ nội dung để đưa nguyên trạng lên catalog public.
- Artifact `voucher-creation-demo/database-evidence.json` chỉ là snapshot thao tác trước, có ví dụ electronics gắn Highlands Coffee và voucher mệnh giá; không dùng làm bản dump nhập production.
- Không tìm thấy database Vouch khác trong inventory MongoDB local đang kết nối. Không khởi chạy MongoDB nhúng hoặc import vào database local.

Kết quả: không có campaign mới hoàn chỉnh phù hợp để giữ nguyên khi nhập. Manifest `deploy-catalog.json` chứa **32 campaign mới được định nghĩa trong DEPLOY_RENDER_HANDOFF.md**: 16 DISCOUNT và 16 CASHBACK. Metadata thương hiệu/chi nhánh tham chiếu catalog phát triển, không copy campaign hoặc lịch sử từ seed cũ. Các ưu đãi được ghi rõ là dữ liệu demo giả định.

Importer yêu cầu database deployment riêng, từ chối trộn campaign ngoài manifest và không tự sửa dữ liệu nguồn. Mật khẩu, session, OTP, đơn hàng và thông tin người dùng không nằm trong manifest. Tài khoản quản lý mới lấy mật khẩu từ biến riêng lúc import; account đã tồn tại không bị đổi mật khẩu.
