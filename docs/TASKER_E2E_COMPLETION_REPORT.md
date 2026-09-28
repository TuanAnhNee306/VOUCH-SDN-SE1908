# TaskLy Tasker E2E Completion Report

Ngày: 27/09/2026. Phạm vi: Flutter frontend + shared in-memory mock. Không tích hợp backend/provider thật.

## 1. Status

**Tasker E2E: DONE. Customer ↔ Tasker cross-flow: DONE trong cùng phiên app.**

Customer đăng task → Tasker thấy đúng ID → nhận việc → di chuyển → đến nơi → bắt đầu → gửi ảnh/ghi chú → Customer xem kết quả/thanh toán → Tasker ví tăng → đánh giá hai chiều. Các thay đổi cập nhật qua repository invalidation stream; đổi role không mất task.

## 2. Tasker Screens Reused

Source có **27 route states** trước thay đổi, không phải đúng 28 màn độc lập. Giữ cả 27 route; thêm 6, tổng **33**. Reused dưới đây nghĩa là giữ cấu trúc UI, nối vào nguồn chung; Refactor nghĩa là thay control/state/action/layout cục bộ.

| Screen hiện tại | Purpose / TaskerPage | Xử lý |
|---|---|---|
| Splash | splash | Reuse |
| Đăng nhập demo | login | Reuse |
| Việc gần bạn | home | Refactor |
| Bản đồ công việc | map | Refactor |
| Việc của tôi | jobs | Refactor |
| Chi tiết việc | jobDetail | Refactor |
| Xác nhận nhận việc | accept | Refactor |
| Việc đang làm | active | Refactor |
| Di chuyển | onTheWay | Reuse |
| Đã đến | arrived | Reuse |
| Xác nhận bắt đầu | start | Refactor |
| Đang làm | inProgress | Refactor |
| Gửi bằng chứng | complete | Reuse |
| Chờ nghiệm thu | waitingPayment | Refactor |
| Đánh giá Customer | rating | Refactor |
| Đánh giá thành công | ratingSuccess | Reuse |
| Ví thu nhập | wallet | Refactor binding |
| Giao dịch | transactions | Refactor |
| Rút tiền | withdraw | Refactor |
| Kết quả rút tiền | withdrawResult | Reuse |
| Hồ sơ | profile | Refactor |
| Dịch vụ/bán kính | services | Reuse |
| Xác minh | verification | Refactor: chuỗi trạng thái CCCD/selfie/duyệt |
| Hộp thư | messages | Refactor |
| Chat | chat | Refactor |
| Thông báo | notifications | Refactor |
| Cài đặt | settings | Refactor |

Tổng: 8 giữ bố cục, 19 chỉnh/nối logic, không bỏ route cũ. Tất cả ở `lib/features/tasker_view.dart`; các màn mới ở part `tasker_account_screens.dart`.

## 3. Tasker Screens Refactored

- Home/map dùng cùng task feed, có online/offline và bộ lọc service/distance/minimum earning/today; preferences dịch vụ/bán kính ảnh hưởng kết quả.
- Detail dùng cùng description/address/time/duration/gross/equipment/protection/fee/net với Customer.
- Accept có checkbox tương tác, repository chặn accept lặp/việc đã hủy/offline.
- Start có hai checkbox xác nhận; work checklist lưu theo task trong controller, cần hoàn tất trước CTA gửi ảnh.
- Timer hiển thị phút từ `startedAt` khi render, không phải ticker GPS/realtime.
- Waiting bỏ hoàn toàn `releaseDemo`: chỉ Customer `pay()` mới chuyển PAID.
- Withdraw hiển thị phí, tổng trừ ví và dialog xác nhận. Help/privacy/call không còn callback rỗng.

## 4. Screens Added

| Screen | Route | Kết quả |
|---|---|---|
| Bộ lọc việc | filters | service/distance/income/today, áp dụng/reset |
| Lịch rảnh | availability | 7 ngày × 3 ca, lưu repository |
| Tiền đảm bảo hoàn lại | deposit | noDeposit → pending → active → refundRequested → refunded, mô phỏng |
| Đánh giá từ Customer | reviews | đọc review trên task chung |
| Trợ giúp/quyền riêng tư | help | nội dung config, có đường về |
| Báo sự cố | report | issue/note/evidence, disputed, trạng thái chờ review |

KYC giữ một route và chuyển các trạng thái bên trong; không tạo màn trùng chỉ để đạt số lượng. Withdrawal method và summary được gộp trong form/dialog hiện có. Không có route bị bỏ/unused.

## 5. Tasker Navigation

Bottom navigation giữ Việc làm / Bản đồ / Việc của tôi / Ví / Hồ sơ. `TaskerController` vẫn dùng enum stack. Nút đổi role trên app bar hiển thị chỉ khi demo/debug được bật; tiện cho đổi role ở mỗi mốc. Nút chờ thanh toán cũng chuyển Customer. Khi quay lại, màn giữ task ID/route và tải dữ liệu mới.

## 6. Shared Task State

`TaskLyApp` sở hữu một `MockDataStore`, inject cùng instance qua `dependencies.dart` cho hai repositories. Tasker available/my jobs đều derive từ `store.tasks`, không còn `_available`/`_mine` datasets độc lập.

Model `CustomerTask` dùng chung; thêm `customerId`, khoảng cách mock, ảnh/ghi chú hoàn thành; timestamps lấy từ timeline. `PriceBreakdown` giữ tỷ lệ phí của quote và tính `platformFee`, `taskerEarning`. Không thêm Task model trùng.

`RepositoryUpdates.changes` là contract invalidation tùy chọn. Controllers subscribe/load lại snapshot, hủy subscription khi dispose. Shared reset tăng `sessionGeneration`, đưa cả hai controller về splash và dọn route/form có nguy cơ stale.

## 7. Customer ↔ Tasker Cross-Flow

Widget test `test/tasker_journey_test.dart` thực hiện đăng nhập Customer, tạo task bằng wizard, đổi role bằng nút app bar, click card/detail/accept, quay lại Customer kiểm tra accepted/assignedTasker rồi đổi role sau ON_THE_WAY, ARRIVED, IN_PROGRESS, COMPLETED. Customer thực hiện checklist/thanh toán/rating trên UI; Tasker nhìn wallet tăng và rating. Cùng ID từ lúc post tới PAID; không tạo seed task thay thế giữa flow.

## 8. Task Status Transitions

`TaskPolicy.progression` và `MockDataStore.progress()` tập trung accepted → onTheWay → arrived → inProgress → completed. Tasker advance không thể bỏ qua ảnh hoàn thành; phải `submitCompletion`. `assign()` kiểm tra task còn posted/matching và chưa được nhận; check/mutation không có await ở giữa. Customer `pay` giữ guard/idempotency vốn có. Cancel/dispute cập nhật cùng task, nên không nhận/tiến/pay sai trạng thái.

## 9. Wallet / Earnings

- COMPLETED: một transaction projection `earning-{taskId}`, pending.
- PAID: cùng ID transaction thành available, không thêm bản ghi trùng khi pay retry.
- Gross = labor + equipment; phí = phần trăm cấu hình trên labor; net = labor − fee + equipment. Protection thuộc Customer, không là thu nhập Tasker.
- Demo mặc định: labor 200k, fee 10k, net 190k, protection 10k, Customer total 210k. Khi có equipment 20k, total 230k, net 210k.
- Opening balance 1.250.000đ nằm trong DemoConfig; không phải thu nhập của task hiện tại.
- Available = opening + thu nhập đã paid + các withdrawal signed debits. Rút tiêu chuẩn miễn phí; rút nhanh mock 0,5% trong config. Check balance và reservation atomic trong memory.
- Rút tiền ở trạng thái xử lý nhưng đã giữ số dư để tránh rút lặp vượt balance. Chưa có callback ngân hàng/failure reversal thật.
- Complaint sau PAID không tự đảo khoản đã credited; policy hoàn tiền do backend/Admin tương lai xử lý.

## 10. Rating

Hai phía lưu `Review` trên task; có taskId/reviewerId/revieweeId, stars/comment; Customer có categories/tags, Tasker có optional tags. Chặn trước PAID và không ghi review trùng. Màn reviews Tasker đọc từ review Customer trên cùng task.

## 11. Chat / Notifications

Một conversation `chat-{taskId}` tạo khi assignment. Message chỉ thêm một lần, bỏ reply tự động giả. Store lưu hướng gửi Customer; Tasker projection đảo `mine` để bubble hiển thị đúng người gửi. Hai role thấy cùng text/ID/context. Notification store của từng role phát từ cùng domain event; new job mở detail, message mở đúng chat, owned task mở active. Notification không còn task hợp lệ quay về home.

## 12. Verification / Deposit / Withdraw

- KYC state nằm store: front → back → selfie → pending → verified/rejected → resubmit. Các nút dùng tài liệu mẫu, không đọc camera/CCCD thật; approve/reject chỉ trong demo.
- Deposit là collateral refundable mô phỏng, **tách khỏi ví thu nhập**. Trạng thái held đã có enum nhưng không có UI tự quyết định giữ tiền; policy/admin ngoài scope.
- Lịch rảnh và services/radius lưu store. Weekly schedule hiện lưu để demo profile; không tự khóa nhận việc theo lịch chưa chốt.
- Withdraw: fixed destination ngân hàng mẫu, standard/instant config fee, summary confirmation, processing result. Không có banking thật.

## 13. Mock Architecture

UI → ChangeNotifier controller → repository interface → role projection repository → **one MockDataStore**. Concrete binding ở `dependencies.dart`, session lifetime ở `main.dart`. Giữ framework/state-management, không thêm package.

File mới: `lib/domain/repository_updates.dart`, `lib/features/tasker_account_screens.dart`, `test/shared_session_test.dart`, báo cáo này. `test/tasker_journey_test.dart` được nâng cấp từ isolated flow sang shared UI E2E và secondary smoke test.

## 14. Implementation Assumptions

- Demo một Customer Linh và một Tasker Minh Anh trong **cùng phiên app**, không sync hai browser/tab/device riêng.
- Seed TL-8492 được lấy từ Customer store duy nhất; các job JOB-940x riêng của Tasker đã bỏ. Tạo task ở Customer để có available feed mới.
- Customer chọn Tasker và demo advance cũ vẫn giữ để không phá isolated Customer demo; cross-role acceptance test không dùng các shortcut đó.
- KYC mặc định verified; không thêm policy khóa app vì chưa KYC/deposit khi chưa được chốt.
- Fee/protection/deposit/instant fee đều là config thử nghiệm, chưa phải business policy production.

## 15. Known Issues

Không còn blocker được phát hiện trong core mock demo đã test. Dữ liệu in-memory, reload mất thay đổi. Chưa có production auth/API/payment/KYC/GPS/push/upload/Admin; không có xử lý hoàn tiền/held deposit tự động. Read receipts chat đơn giản, không phải per-user realtime receipt. Be Vietnam Pro chưa bundle. Chưa QA Android/iOS thiết bị thật hoặc browser tương tác trực tiếp trong lượt này; widget tests không thay thế kiểm thử thiết bị.

## 16. Backend Integration Points

CustomerRepository giữ aggregate interfaces sẵn có; TaskerRepository có accept/advance/submit/rate/withdraw/verification/deposit/availability/report. `releaseDemo` đã bỏ. Backend cần enforce authorization, atomic assignment, idempotent settlement, server clock, upload/evidence, identity/participant ownership và persistent transactions.

## 17. How To Replace Mock With Backend

Inject API repositories trong dependencies; giữ controller/view contracts. Implement RepositoryUpdates từ socket/poll invalidation nếu cần. Backend phải authoritative cho ledger/task/actor, không dùng phép projection frontend làm nguồn tiền thật. Map các status/fees/timestamps sang domain hiện có.

## 18. Commands Run

```text
dart format lib test
dart fix --apply --code=curly_braces_in_flow_control_structures
flutter analyze --no-pub
flutter test --no-pub
flutter build web --no-pub --no-web-resources-cdn --dart-define=TASKLY_DEMO=true
```

Môi trường chạy lệnh Flutter qua Dart SDK + `flutter_tools.snapshot --no-version-check --suppress-analytics` để dùng SDK đã cài; cần quyền cache SDK. Không thêm dependency.

## 19. Analyze / Build Result

- Analyze: PASS, no issues.
- Tests: PASS, 15 tests (7 Customer repository, 4 shared-session, 2 Customer widget journeys, 2 shared/Tasker widget journeys).
- Web build: PASS. `build/web` chứa demo và CanvasKit local.

## Demo nhanh

Chạy `flutter run -d chrome --dart-define=TASKLY_DEMO=true` hoặc sau build chạy `dart tool/serve_demo.dart` rồi mở `http://127.0.0.1:8765`.

1. Customer: tài khoản demo → OTP 123456 → tạo task → đăng. Ghi nhớ mã TL mới.
2. Bấm nút đổi role trên app bar (tooltip Demo: chuyển Tasker); login Tasker demo.
3. Chọn đúng TL mới từ Việc gần bạn, xác nhận checkbox/nhận việc.
4. Đổi Customer để thấy accepted; đổi Tasker, di chuyển/đến nơi/bắt đầu, kiểm checklist, chọn ảnh mẫu/gửi hoàn thành.
5. Đổi Customer, mở task nếu đang ở màn khác, nghiệm thu/checklist/thanh toán, đánh giá.
6. Đổi Tasker, kiểm ví tăng đúng net, pending về 0; đánh giá Customer và xem tab Hoàn thành.
7. Reset toàn phiên ở cài đặt/hồ sơ demo nếu cần làm lại.
