# TaskLy — Tasker Frontend Completion

Ngày: 27/09/2026. **Tasker E2E: DONE trong phạm vi frontend + mock.**

## Luồng hoàn tất

Tasker splash/login demo → Việc làm gần bạn/Bản đồ → Job Detail → xác nhận nhận việc → Việc đang làm → bắt đầu di chuyển → đến nơi → bắt đầu → đang thực hiện/checklist → ảnh mẫu + ghi chú hoàn thành → chờ Customer nghiệm thu → Customer thanh toán (nút demo) → thu nhập Ví → đánh giá Customer → Việc của tôi/Hoàn thành.

## Màn hình đã thêm

- Home Tasker có Online toggle, thu nhập, active job và việc gần bạn.
- Map mock, Job Detail với breakdown thu nhập, Accept confirmation, My Jobs bốn tab.
- Active detail/timeline, On-the-way map, Arrived, Start, In Progress, Complete proof, Waiting Payment và Rating Customer.
- Ví, giao dịch, rút tiền mock, Profile, dịch vụ/bán kính, xác minh danh tính mock, chat, notifications và settings.
- App có entry rõ từ Login Customer và mục Hồ sơ Customer để chuyển sang role Tasker; Tasker có thể chuyển lại Customer.

## Architecture

`TaskerView → TaskerController → TaskerRepository → MockTaskerRepository`.

Mock dữ liệu Tasker nằm tập trung tại `lib/data/mock/mock_tasker_repository.dart`; model/snapshot tại `lib/domain/tasker_models.dart`; không gọi backend, GPS, payment, KYC hay banking thật. Dữ liệu Tasker mock độc lập với phiên Customer mock; đây là lựa chọn phù hợp cho demo role trước khi backend/common session tồn tại.

## Validation

- `dart format lib test`
- `flutter analyze --no-pub`: không còn issue.
- `flutter test --no-pub`: gồm Customer, repository và Tasker widget journeys. Tasker test kiểm tra accept → execution → completion → payment → rating/wallet.
- `flutter build web --no-pub --no-web-resources-cdn --dart-define=TASKLY_DEMO=true`: thành công.

## Assumptions / non-blocking

- Login Tasker là một chạm demo; xác minh danh tính hiển thị trạng thái đã xác minh, không tải CCCD/selfie thật.
- Check-in, GPS, map, ETA, ảnh, chat response, Customer approval/payment, wallet/withdrawal và rating đều mô phỏng, chỉ lưu trong memory.
- Phí nền tảng demo là cấu hình mock 5%; thu nhập chỉ được cộng sau action Customer payment demo.
- Chưa có customer–tasker cùng session/backend realtime; khi tích hợp API, thay `MockTaskerRepository` bằng API implementation cùng interface và dùng assignment/task ID chung.
