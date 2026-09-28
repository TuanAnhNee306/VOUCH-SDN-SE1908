# TaskLy — Hướng dẫn test E2E thủ công

Tài liệu này dùng để test một công việc xuyên suốt giữa Customer và Tasker trong **cùng một phiên app demo**.

## Chuẩn bị

Chạy app ở chế độ demo:

```bash
flutter run -d chrome --dart-define=TASKLY_DEMO=true
```

Hoặc sau khi build web:

```bash
dart tool/serve_demo.dart
```

Mở `http://127.0.0.1:8765`.

Quy ước trong tài liệu:

- OTP demo: `123456`.
- Nút đổi role: biểu tượng đổi chiều ở AppBar, chỉ hiện trong demo.
- Không refresh trang khi đang test vì mock state chỉ lưu trong bộ nhớ.
- Không dùng task seed `TL-8492` cho test chính; hãy tạo task mới và dùng đúng mã `TL-...` vừa tạo.

## Mục tiêu đạt

```text
Customer tạo Task
  → Tasker thấy cùng Task ID và nhận việc
  → Tasker cập nhật tiến độ
  → Customer thấy đúng tiến độ và bằng chứng hoàn thành
  → Customer thanh toán
  → Tasker nhận thu nhập
  → Hai bên đánh giá nhau
```

## A. Customer đăng nhập và tạo task

1. Mở app ở Customer.
2. Chọn **Bắt đầu** → **Tiếp tục đăng nhập** → **Điền tài khoản demo**.
3. Chọn **Nhận mã OTP**, nhập `123456`, sau đó chọn **Xác minh & tiếp tục**.
4. Chọn **Dùng địa chỉ đã lưu** để vào trang chủ.
5. Chọn tab **Tạo Task**.
6. Chọn dịch vụ, ví dụ **Dọn phòng**, rồi đi tiếp qua các bước địa chỉ và lịch hẹn.
7. Ở bước mô tả, nhập ít nhất 10 ký tự, ví dụ:

   `Dọn phòng trọ 25m², lau sàn và vệ sinh nhà tắm.`

8. Có thể chọn **Thêm ảnh mẫu**. Hoàn tất các bước còn lại và chọn phương thức thanh toán.
9. Ở màn review, chọn **Đăng công việc**.
10. Ghi lại mã task `TL-...` trên màn tìm Tasker.

Kết quả mong đợi:

- Task có trạng thái `POSTED` hoặc `MATCHING`.
- Task hiển thị trong danh sách **Việc của tôi** của Customer.
- Task chưa có Tasker nhận và chưa có thanh toán.

## B. Tasker nhìn thấy và nhận đúng task

1. Bấm nút đổi role trên AppBar để chuyển sang Tasker.
2. Chọn **Bắt đầu với vai trò Tasker** → **Đăng nhập Tasker demo**.
3. Trong **Việc gần bạn**, tìm card có đúng mã task `TL-...` vừa tạo.
4. Chọn **Xem việc →**.
5. Kiểm tra thông tin service, địa chỉ, lịch, mô tả, tổng giá, phí nền tảng và thu nhập dự kiến.
6. Chọn **Nhận công việc**.
7. Tích **Tôi có thể đến đúng giờ** rồi chọn **Xác nhận nhận việc**.

Kết quả mong đợi:

- Task biến mất khỏi danh sách việc có thể nhận.
- Task xuất hiện trong **Việc của tôi** / **Công việc đang làm** của Tasker.
- Task có trạng thái `ACCEPTED` và Tasker là Minh Anh.

## C. Kiểm tra Customer nhận cập nhật ghép task

1. Đổi về Customer bằng nút đổi role.
2. Mở task vừa tạo nếu app chưa tự mở chi tiết.

Kết quả mong đợi:

- Cùng mã `TL-...` có trạng thái `ACCEPTED`.
- Hiển thị Tasker Minh Anh.
- Có thể mở chat với Tasker.

## D. Tasker thực hiện công việc

Đổi sang Tasker. Với mỗi bước, đổi nhanh sang Customer để kiểm tra trạng thái trước khi tiếp tục.

| Bước Tasker | Thao tác | Customer phải thấy |
|---|---|---|
| 1 | Mở active job → **Bắt đầu di chuyển** → bấm **Bắt đầu di chuyển** trên màn di chuyển | `ON_THE_WAY` / Đang di chuyển |
| 2 | **Tôi đã đến nơi** | `ARRIVED` / Đã đến nơi |
| 3 | **Bắt đầu công việc** → tích hai xác nhận → **Bắt đầu ngay** | `IN_PROGRESS` / Đang thực hiện |
| 4 | Tích toàn bộ checklist → **Hoàn thành công việc** | Mở màn gửi nghiệm thu |
| 5 | Chọn ít nhất một ảnh mẫu, nhập ghi chú, chọn **Xác nhận hoàn thành** | `COMPLETED` / Đã hoàn thành |

Kết quả mong đợi sau bước hoàn thành:

- Customer thấy ảnh và ghi chú do Tasker gửi.
- Ví Tasker hiển thị thu nhập task ở phần **Đang chờ**.
- Số dư có thể rút chưa tăng.

## E. Customer nghiệm thu, thanh toán và đánh giá Tasker

1. Đổi về Customer và mở đúng task.
2. Chọn **Nghiệm thu & thanh toán**.
3. Kiểm tra ảnh/ghi chú, tích toàn bộ checklist.
4. Chọn **Thanh toán demo**.
5. Ở màn thành công, chọn **Đánh giá Tasker**.
6. Chọn số sao, có thể thêm nhận xét/tag/tiêu chí, rồi chọn **Gửi đánh giá**.

Kết quả mong đợi:

- Task chuyển `PAID`.
- Customer thấy biên nhận mock và review đã lưu.
- Không thể thanh toán lần thứ hai cho cùng task.

## F. Tasker kiểm tra earnings và đánh giá Customer

1. Đổi sang Tasker.
2. Mở **Ví thu nhập**.
3. Tìm giao dịch chứa đúng mã `TL-...`.
4. Mở active job hoặc tab **Hoàn thành**, chọn **Đánh giá Customer**.
5. Chọn số sao, tag/nhận xét rồi gửi.

Kết quả mong đợi:

- Khoản đang chờ của task về `0đ`.
- Số dư khả dụng tăng đúng `taskerEarning`.
- Ví dụ task Dọn phòng có labor `200.000đ`, protection `10.000đ`, phí nền tảng `5%`: Customer trả `210.000đ`, Tasker nhận `190.000đ`.
- Task xuất hiện trong tab **Hoàn thành** của Tasker.
- Review Tasker → Customer được lưu trên cùng task.

## G. Test chat hai chiều

Thực hiện sau khi Tasker đã nhận task.

1. Customer mở chat của task, gửi một tin nhắn.
2. Đổi Tasker, mở **Tin nhắn**, vào đúng hội thoại có cùng mã task.
3. Kiểm tra tin nhắn Customer xuất hiện ở phía nhận.
4. Tasker gửi phản hồi.
5. Đổi Customer, kiểm tra phản hồi hiển thị trong chính hội thoại đó.

Kết quả mong đợi:

- Hai role dùng chung một conversation `chat-{taskId}`.
- Không tạo một hội thoại giả khác cho Tasker.
- Notification tin nhắn mở đúng chat hoặc task liên quan.

## H. Test ví và rút tiền

1. Trong Tasker → **Ví thu nhập**, ghi lại số dư khả dụng hiện tại.
2. Chọn **Rút tiền**, nhập `500000`.
3. Chọn rút tiêu chuẩn, xác nhận dialog.
4. Quay lại ví.
5. Lặp lại với rút nhanh, ví dụ `200000`.

Kết quả mong đợi:

- Rút tiêu chuẩn giảm số dư đúng `500.000đ`.
- Rút nhanh giảm số dư bằng số rút + phí mock `0,5%`.
- Transaction hiển thị trạng thái **Đang xử lý • đã giữ số dư**.
- Không thể rút vượt số dư còn lại.

## I. Test các màn phụ Tasker

| Màn | Cách test | Kết quả mong đợi |
|---|---|---|
| Bộ lọc | Home/Map → Bộ lọc | Lọc theo service, khoảng cách, thu nhập, hôm nay; card thay đổi theo state chung |
| Lịch rảnh | Hồ sơ → Lịch rảnh hàng tuần | Bật/tắt ca, lưu lại; mở lại vẫn thấy selection trong phiên |
| Dịch vụ/bán kính | Hồ sơ → Dịch vụ và lịch rảnh | Lưu service/radius; job gợi ý bị lọc theo preference |
| KYC | Hồ sơ → Xác minh danh tính | Đi qua CCCD trước/sau, selfie, pending, duyệt hoặc yêu cầu bổ sung; chỉ là tài liệu mẫu |
| Tiền đảm bảo | Hồ sơ → Tiền đảm bảo hoàn lại | Đi qua nộp → active → yêu cầu hoàn → refunded; không trừ ví thật |
| Báo sự cố | Active job → Báo sự cố | Gửi issue/note/evidence; task thành `DISPUTED`, Customer không thanh toán được |
| Thông báo | Chuông AppBar | Mở job/chat phù hợp và đánh dấu đã đọc |
| Trợ giúp | Hồ sơ/Cài đặt → Trợ giúp | Nội dung mock hiển thị, không dead-end |

## J. Reset demo

1. Trong Tasker → Hồ sơ hoặc Cài đặt, chọn **Đặt lại toàn bộ phiên demo**.
2. Kiểm tra Customer.

Kết quả mong đợi:

- Cả hai role trở về Splash.
- Task mới tạo, chat, review, rút tiền và thay đổi KYC/deposit bị xóa khỏi memory.
- Có thể bắt đầu lại từ phần A.

## Checklist nghiệm thu cuối

- [ ] Customer tạo được task mới `TL-...`.
- [ ] Tasker thấy đúng task đó, không phải dữ liệu seed khác.
- [ ] Tasker chỉ nhận được task một lần.
- [ ] Customer nhận trạng thái `ACCEPTED`, `ON_THE_WAY`, `ARRIVED`, `IN_PROGRESS`, `COMPLETED`, `PAID` tương ứng.
- [ ] Ảnh và ghi chú hoàn thành xuất hiện ở Customer.
- [ ] Customer thanh toán một lần; Tasker earnings tăng một lần.
- [ ] Customer và Tasker đánh giá trên cùng task.
- [ ] Chat dùng chung task context.
- [ ] Rút tiền làm giảm số dư đúng.
- [ ] Không có màn chính bị dead-end hoặc exception.

## Giới hạn của demo

- Chỉ đồng bộ trong một phiên app/browser tab; mở tab khác hoặc refresh sẽ có state mới.
- Không có backend, ngân hàng, GPS, KYC, upload ảnh, AI, push notification hay Admin thật.
- Deposit, withdrawal, protection, payment, ETA và bản đồ là dữ liệu mô phỏng.
- Khi task `DISPUTED`, chưa có Admin UI để giải quyết hoàn tiền/giải ngân.
