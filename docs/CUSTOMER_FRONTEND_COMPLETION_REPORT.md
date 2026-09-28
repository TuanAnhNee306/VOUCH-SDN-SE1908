# TaskLy — Customer Frontend Completion

Ngày: 27/09/2026. **Customer E2E: DONE trong phạm vi frontend + mock.**

Project đã sửa trực tiếp: `C:\Users\Admin\Documents\Codex\2026-09-25\tr-c-khi-l-m-b\taskly_mobile`.

## Kết quả và màn hình

- Main flow: Splash → Onboarding → Login/OTP → Home → Create Task → Matching → Recommended Taskers → Tasker Profile/Select → Matched → Task Detail → ON_THE_WAY → Tracking → ARRIVED → IN_PROGRESS → COMPLETED → Payment → Success → Rating → My Tasks/Completed.
- Create Task: chọn dịch vụ, địa chỉ, lịch/thời lượng, mô tả/ảnh mẫu, dụng cụ/lưu ý, giá/bảo vệ/phương thức thanh toán, review/post; giữ draft khi quay lại. Có AI draft mô phỏng.
- Secondary: danh sách hội thoại/chat, thông báo, hồ sơ/sửa hồ sơ, địa chỉ CRUD, phương thức thanh toán, đánh giá, cài đặt/trợ giúp; hủy/đổi lịch, báo sự cố/khiếu nại/trạng thái khiếu nại.
- Bổ sung cuối: Tracking riêng, rating theo tiêu chí và quick tags, phân nhóm Active/Upcoming/Completed/Cancelled theo cùng nguồn task.
- Tái sử dụng: toàn bộ Customer code đã có ở trạng thái trước lượt hoàn thiện; theme/component chung; bố cục và ảnh từ Stitch. Khi bắt đầu triển khai ban đầu, project Flutter chỉ có counter boilerplate, không có Customer screen chạy sẵn. Không thay framework, không tạo project mới.

## Acceptance checklist

| Nhóm kiểm tra | Kết quả / bằng chứng |
|---|---|
| App mở, Splash/Onboarding/Login → Home | Đạt trong widget journey test |
| Chọn service, location, date/time, description, images | Đạt; widget journey đi qua wizard, kiểm tra ảnh/mô tả; validation ở controller/repository. Journey dùng địa chỉ/lịch mặc định hợp lệ, không tự động thao tác mọi date-picker option |
| Draft/back, giá/bảo vệ, review/post | Đạt; test quay lại sửa bước, giữ draft, tính phụ phí; post snapshot + idempotency repository test |
| Finding/recommendations/profile/select/matched | Đạt; cùng task ID và Tasker đã chọn xuyên suốt |
| Detail/status/tracking/arrived/in-progress/completed | Đạt; widget journey bấm các CTA tiến trạng thái và tracking |
| Payment/success/rating/completed list | Đạt; widget journey lưu sao/tiêu chí/tag/comment; repository test lỗi thanh toán/retry/chống thanh toán lặp |
| Bottom navigation Home/Tasks/Create/Messages/Profile | Đạt; widget test bấm cả 5 tab |
| Main flow không dead-end | Đạt cho hành trình chính đã kiểm thử tới My Tasks/Completed |
| Chat/complaint, secondary routes trên màn hẹp | Đạt; gửi tin, gửi bằng chứng, trạng thái disputed; 360×780 và 390×844 không phát sinh Flutter exception trong test |
| Mock/business data không nằm trong screen | Nguồn tập trung ngoài UI; UI gọi controller → interface; kiểm tra import, call repository, TODO và dữ liệu mẫu |
| Static analysis/build | Không lỗi blocking; web build thành công |

## Main files changed / architecture

- `lib/main.dart`, `lib/core/theme.dart`, `lib/shared/widgets.dart`: app shell, theme và component dùng chung.
- `lib/features/{customer_view,booking_screens,task_screens,account_screens}.dart`: Customer UI và điều hướng.
- `lib/app/customer_controller.dart`: draft, state, thao tác và route stack theo enum.
- `lib/domain/{models,repositories,task_policy}.dart`: model, hợp đồng repository và quy tắc trạng thái.
- `lib/data/mock/mock_data_store.dart`: một nguồn dữ liệu mẫu tập trung.
- `lib/data/mock/mock_customer_repository.dart`: hành vi mock, validation và cập nhật dữ liệu.
- `lib/app/dependencies.dart`: điểm gắn Mock Repository; sau này thay bằng API Repository triển khai cùng interface, không gọi API trực tiếp từ UI.
- `test/repository_test.dart`, `test/customer_journey_test.dart`: 7 repository tests + 2 widget journey tests.
- `pubspec.yaml`, `assets/images`, `web/index.html`, `web/manifest.json`, `tool/serve_demo.dart`: assets, metadata và static preview server.

Luồng dữ liệu: **UI → CustomerController → Repository Interface → MockCustomerRepository → MockDataStore**. DemoControls là capability riêng, chỉ gắn trong debug hoặc `TASKLY_DEMO=true`.

## Implementation Assumptions

- Theo yêu cầu mới nhất, thu tiền một lần sau COMPLETED; không tạm thu escrow trước khi đăng việc. Task PAID cũng cập nhật PaymentStatus; không thu thêm khi nhấn lại.
- Auth/register/recovery dùng OTP demo; không có password/backend thật. SĐT demo `0938000123`, OTP `123456`.
- Wizard gồm 7 bước nhập liệu; AI helper tách riêng. Back giữ draft, đăng việc tạo snapshot, đặt lại tạo draft mới với lịch tương lai.
- Dữ liệu trong bộ nhớ; refresh/restart/reset demo khôi phục seed. Không có database hay lưu bền.
- Ảnh lấy từ gallery mẫu; GPS/route, ETA, AI, chat reply, bảo vệ và thanh toán đều mô phỏng. Không xác nhận bất kỳ quyền lợi bảo hiểm, KYC hay escrow thật nào.
- Task đang di chuyển/đến nơi/đang làm vào Active; COMPLETED/PAID vào Completed; task chưa thực hiện có lịch tương lai vào Upcoming; hủy/hoàn tiền vào Cancelled.
- Khiếu nại chuyển task sang disputed và chặn thanh toán cho tới xử lý; không xây luồng Admin xử lý tranh chấp trong phạm vi này.

## Validation / commands run

- `dart format lib test tool`: hoàn tất.
- `flutter analyze --no-pub`: **No issues found**.
- `flutter test --no-pub`: **9/9 passed**, gồm widget journey thật, không chỉ kiểm tra state.
- `flutter build web --no-pub --no-web-resources-cdn --dart-define=TASKLY_DEMO=true`: **Built build/web**; CanvasKit được đóng gói local.
- `flutter pub get --offline`: thành công; không thêm thư viện bên thứ ba.
- Flutter launcher trong môi trường này bị treo; các lệnh tương đương được chạy bằng Dart SDK và `flutter_tools.snapshot`, cùng `--no-version-check --suppress-analytics`, PUB_CACHE cục bộ.
- Đã rà import/mock constants/TODO blocking và route enum; không phát hiện vấn đề chặn main flow.

## Remaining non-blocking issues

- Chưa kiểm tra tương tác trực tiếp trên browser: công cụ Browser bị hệ thống xét duyệt tự động chặn vì hạn mức, không phải xác định thao tác không an toàn. Không tìm cách vượt chặn; cần hạn mức công cụ hoạt động lại để kiểm tra browser.
- Chưa chạy Android/iOS trên thiết bị thật. Widget tests và web build không thay thế device/browser QA.
- Chưa bundle Be Vietnam Pro; hiện dùng font Flutter mặc định. Không tuyên bố pixel-perfect với toàn bộ bản Stitch.
- Không có backend, GPS, auth, AI, payment, escrow, KYC hoặc CSKH thật; Tasker mock frontend đã được bổ sung sau báo cáo Customer, Admin không thuộc phạm vi.

## Chạy demo

Tại thư mục project: `flutter run -d chrome --dart-define=TASKLY_DEMO=true`.

Hoặc dùng bản đã build: `dart tool/serve_demo.dart`, mở `http://127.0.0.1:8765` (không mở index.html bằng file://).

Đăng nhập bằng tài khoản demo; sau khi chọn Tasker, dùng nút Demo tiến trạng thái trong Task Detail/Tracking. Hoàn thành checklist nghiệm thu → thanh toán → đánh giá → Việc của tôi/Hoàn thành. Có reset demo trong Cài đặt. Không nhập dữ liệu nhạy cảm.
