# vouch. – Voucher Platform (React + Express + MongoDB)

Viết lại theo tài liệu "Hướng dẫn sử dụng ứng dụng Voucher Platform":

| Thư mục | Nội dung |
|---|---|
| `backend/` | REST API Node.js + Express + MongoDB (Mongoose), cổng **3000** |
| `frontend/` | React (Vite), cổng **5173**: app khách hàng (giao diện máy tính và điện thoại) tại `/` và web quản lý (nhân viên cửa hàng, chủ thương hiệu, quản trị) tại `/web` |

## Yêu cầu

- Node.js 20 trở lên (đã thử với Node 24).
- MongoDB: **không bắt buộc cài**. Nếu không kết nối được `MONGO_URI` (mặc định `mongodb://127.0.0.1:27017`), backend tự bật MongoDB nhúng và lưu dữ liệu ở `backend/.mongo-data`. Lần chạy đầu cần mạng để tải bản MongoDB (~600 MB, lưu vào `%USERPROFILE%\.cache\mongodb-binaries`). Nếu đã cài MongoDB Community thì backend dùng luôn bản đó.

## Chạy

```bash
npm run setup     # cài thư viện cho backend và frontend (một lần)
npm run dev       # chạy backend + frontend
```

Mở http://localhost:5173 (app khách hàng) và http://localhost:5173/web (web quản lý).
Lần đầu backend tự nạp dữ liệu mẫu. Nạp lại từ đầu: `npm run seed`. Chạy test: `npm test`.

Mở bằng điện thoại cùng mạng Wi-Fi: dùng địa chỉ "Network" mà Vite in ra (ví dụ `http://192.168.1.7:5173`). Camera quét QR và định vị trên điện thoại chỉ hoạt động qua HTTPS hoặc localhost, nên khi demo qua mạng LAN hãy dùng ô nhập OTP.

## Tài khoản demo

| Vai trò | Đăng nhập |
|---|---|
| Khách hàng | Email thật thuộc tài khoản CUSTOMER đang ACTIVE, đăng nhập bằng OTP gửi qua SMTP. Không tự tạo tài khoản, không có OTP console/demo |
| Nhân viên cửa hàng | `staff@highlands.local` / `Voucher@123` (gán Highlands Lê Lợi và Nguyễn Huệ) |
| Chủ thương hiệu | `owner@highlands.local` / `Voucher@123` (thương hiệu khác: `owner@phuclong.local`, `owner@pizza4ps.local`...) |
| Quản trị viên | `admin@voucher.local` / `Voucher@123` |

## Các luồng demo

Kịch bản chi tiết từng chức năng: xem [DEMO.md](DEMO.md).

1. **Mua và thanh toán**: Khám phá → chọn voucher → Mua ngay → chọn số lượng → Tiến hành thanh toán (giữ chỗ 15 phút) → **Thanh toán thử (demo)** → voucher về ví và có thông báo. Màn chờ thanh toán có thêm các nút "Thanh toán thất bại" và "Thanh toán sai số tiền" để demo nhánh ngoại lệ. Đơn sai số tiền nằm trong *Quản trị → Hoàn tiền thủ công → Đơn lệch số tiền*.
2. **Sử dụng tại cửa hàng**: app Ví → Sử dụng ngay (QR + OTP 60 giây) → web nhân viên chọn chi nhánh → nhập OTP (hoặc quét QR bằng camera / dán nội dung QR) → **HỢP LỆ** → app tự chuyển sang "Voucher đã được sử dụng". Voucher mệnh giá bắt buộc nhập giá trị hóa đơn; thiếu thì mã chưa bị tiêu, nhập rồi gửi lại.
3. **Chiến dịch, phê duyệt, đối soát**: chủ thương hiệu tạo nháp → gửi duyệt → quản trị viên duyệt / từ chối kèm lý do → chiến dịch tự phát hành khi tới ngày bán. Quản trị → Đối soát → **Chốt đối soát tháng trước** → Đánh dấu đã chi trả. Dữ liệu mẫu có sẵn đơn tháng trước để chốt.
4. **Hoàn tiền**: app → chi tiết voucher → Yêu cầu hoàn tiền. Kết quả của cổng hoàn giả lập (Thành công / Từ chối / Không phản hồi) đổi được ở *Quản trị → Hoàn tiền thủ công*, không cần khởi động lại máy chủ.

## Cấu hình (`backend/.env`)

Tạo tự động từ `.env.example` khi chạy `npm run dev`. Các biến hay dùng:

- `MONGO_URI`: chuỗi kết nối MongoDB (máy cài sẵn hoặc Atlas).
- `MAIL_MODE=console | smtp`: `smtp` gửi OTP thật qua `SMTP_*` (Gmail cần App Password).
- Customer OTP yêu cầu `MAIL_MODE=smtp`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, `OTP_SECRET` tối thiểu 32 ký tự. Management vẫn đăng nhập email/mật khẩu khi chưa cấu hình SMTP. Hướng dẫn: [PASSWORDLESS_OTP_REPORT.md](PASSWORDLESS_OTP_REPORT.md).
- `VNPAY_TMN_CODE / VNPAY_HASH_SECRET`: cấu hình VNPAY Sandbox ở backend. Không đưa hash secret vào frontend hoặc Git. Return URL: `VNPAY_RETURN_URL`; IPN HTTPS public: `GET /api/orders/vnpay-ipn`.
- `PAYMENT_SIMULATOR=true`: chỉ bật nút "Thanh toán thử (demo)" trong môi trường phát triển/test.
- `REFUND_MODE=auto | manual`, `REFUND_SANDBOX_RESULT`.

## Tác vụ nền (giờ Việt Nam)

- 5 phút một lần: hủy đơn quá 15 phút giữ chỗ, chuyển trạng thái chiến dịch (phát hành / hết hàng / kết thúc). Quản trị viên chạy ngay được bằng nút "Chạy rà soát trạng thái".
- 01:00 ngày 01 hằng tháng: chốt đối soát tháng trước.
- 09:00 hằng ngày: nhắc voucher sắp hết hạn (trước 7 ngày và 1 ngày).
