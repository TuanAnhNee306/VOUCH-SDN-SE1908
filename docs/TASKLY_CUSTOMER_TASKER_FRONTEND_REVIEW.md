# TaskLy — Customer & Tasker Frontend Review

**Ngày review:** 27/09/2026  
**Phạm vi:** Flutter source hiện tại, mock state/repository, tài liệu bàn giao, test hiện có và đối chiếu tham chiếu Stitch v3. Đây là review nguồn; không sửa UI, navigation hay business logic.

## 1. Executive Summary

Hai role đã có một bộ frontend mock phong phú, có luồng chính chạy được khi tách riêng từng role. Kiến trúc trong từng role có hướng đúng: UI → Controller → Repository interface → Mock repository. Customer là phần hoàn thiện hơn và có luồng E2E độc lập khá đầy đủ. Tasker có đường đi core nhận việc → thực hiện → chờ duyệt → ví, nhưng các nhánh KYC, lọc việc, hỗ trợ/sự cố và logic ví còn thiếu hoặc mới là hiển thị.

**Kết luận quan trọng:** chưa thể demo một công việc chung giữa Customer và Tasker. Hai controller khởi tạo hai mock repository độc lập; cùng `#TL-8492` còn được seed với trạng thái khác nhau. Đây là blocker lớn nhất trước demo end-to-end hai role và trước khi thay backend.

| Hạng mục | Đánh giá |
|---|---|
| Customer isolated mock journey | **Complete** |
| Tasker isolated mock journey | **Partial** |
| Customer ↔ Tasker cùng task | **Broken** |
| UI consistency với Stitch | **Partial** |
| Readiness để nối backend | **Partial** |
| Readiness để demo role riêng | Customer: tốt; Tasker: cần vá logic ví/KYC/demo boundary |

## 2. Source Reviewed

- App shell: `lib/main.dart`, `lib/app/dependencies.dart`
- Controllers: `lib/app/customer_controller.dart`, `lib/app/tasker_controller.dart`
- Domain/policy: `lib/domain/models.dart`, `repositories.dart`, `task_policy.dart`, `tasker_models.dart`, `tasker_repositories.dart`
- Data: `lib/data/mock/mock_data_store.dart`, `mock_customer_repository.dart`, `mock_tasker_repository.dart`
- UI: `lib/features/customer_view.dart`, `booking_screens.dart`, `task_screens.dart`, `account_screens.dart`, `tasker_view.dart`, `lib/shared/widgets.dart`, `lib/core/theme.dart`
- Tests: repository tests, Customer journey tests, Tasker journey test (10 tests in current suite).
- Docs reviewed: Customer/Tasker completion reports and README. README vẫn là Flutter starter README, chưa phải tài liệu dự án.
- Design reference inspected: Stitch v3 Customer Home và Tasker Home, cùng danh mục màn hình export.

## 3. Screen Count

| Role | Tuyến/màn hình thực có | Ghi chú |
|---|---:|---|
| Customer | 35 route states | Create task là **một route 7 bước**, nên tương đương khoảng 41 trạng thái nhìn thấy nếu đếm từng bước. |
| Tasker | 27 route states | KYC chỉ là một màn trạng thái; chưa phải chuỗi 6 màn như Stitch. |
| Tổng | 62 route states | Không đồng nghĩa 62 màn thiết kế độc lập; nhiều là success/state step. |

## 4. Overall Architecture

### Điểm tốt

- UI không gọi Mock/API trực tiếp. Binding concrete tập trung ở `dependencies.dart`.
- Customer dùng một `MockDataStore` cho profile, task, conversation, notification, payment và complaint; draft/post/payment có validation và snapshot.
- `TaskPolicy` đã chuẩn hoá trạng thái chung `accepted → onTheWay → arrived → inProgress → completed`, chặn pay/rate sai thời điểm.
- Có loading/error state ở controller, component/theme dùng lại được và test journey thật thay vì chỉ test model.

### Gaps

- `main.dart` khởi tạo `CustomerController` và `TaskerController` độc lập. `MockTaskerRepository` còn tự giữ jobs, wallet, notifications và chat riêng.
- Không có shared session/task store, event bus/realtime abstraction, assignment contract hay payment settlement contract dùng chung hai role.
- Điều hướng là enum + stack thủ công trong các widget lớn. Nó phù hợp prototype nhưng không có route guard/deep link/typed parameter cho production.
- `tasker_view.dart` dài ~1.475 dòng, kết hợp rendering, điều hướng và presentation state; khó thay API và khó regression-test hơn.

## 5. Customer Screen Inventory

| Screen / nhóm | Status | Issue | Recommendation |
|---|---|---|---|
| Splash, onboarding, login, register, recovery, OTP, location | Complete | Auth/OTP/location đều mock; onboarding không tách 3 màn như design | Giữ demo label; API auth và permission thật sau này |
| Home, services, service detail, AI draft | Complete | Voice/AI/search là mô phỏng | Có thể demo tốt nếu nói rõ mock |
| Create task 7 bước + review/post | Complete | Thiết kế yêu cầu 8 bước nhưng source gộp description+images và budget+payment | Chấp nhận MVP; ghi rõ mapping 7/8 trong demo script |
| Finding/recommendation/tasker profile/matched | Partial | Finding radar là busy state trong recommendation route, không có route riêng; tasker được chọn chỉ tồn tại Customer store | Thêm matching state/event dùng chung khi nối role |
| My tasks, detail, tracking, status transitions | Partial | Customer tự bấm demo để tiến trạng thái thay vì Tasker actor | Chuyển transition sang shared workflow/API |
| Payment, success, rating | Complete (isolated) | Tổng customer trả có thể gồm protection/equipment, trong khi Tasker net độc lập chỉ tính labor | Chuẩn hoá settlement breakdown chung |
| Messages/chat/notifications | Partial | Tốt trong Customer mock, nhưng không liên thông Tasker conversation/notification | Dùng conversation/task ID chung |
| Profile/edit/address/payment methods/reviews/settings/help | Complete | Một số thông tin chỉ mock in-memory | API profile/address/payment method sau |
| Cancel/reschedule/complaint/status | Partial | Có complaint Customer, không có lifecycle xử lý hay Admin/Tasker counterpart | Thêm case/dispute state + role visibility |

## 6. Customer Flow Review

### Auth & onboarding

Luồng splash → onboarding → login/register/recovery → OTP → location → Home có thể đi được. Điều kiện mock rõ (`0938000123`/OTP demo) và không tuyên bố auth thật. Thiếu: retry/network semantics thật, session persistence, account lock/rate limit và privacy consent thực thi.

### Create task

Wizard giữ draft khi Back, validates input, có AI helper mock, quote, protection/payment selection và snapshot khi post. Đây là phần tốt nhất của source Customer. Merge 7 bước không gây đứt flow, nhưng cần thống nhất với tài liệu Stitch nói 8 bước để người demo không tìm “bước 8”.

### Matching & select Tasker

Customer có post → matching → recommendation → profile/select → matched. Dữ liệu selected tasker, ETA, task ID giữ được trong Customer repository. Tuy nhiên đây là **Customer chọn Tasker bằng mock**, không phải Tasker chấp nhận việc.

### Tracking & completion

Detail/tracking hiển thị timeline hợp lý. Nhưng các CTA Demo trên Customer thay đổi status sang arrived/in progress/completed. Nó che mất actor thật của Tasker và không thể dùng làm live demo hai thiết bị.

### Payment/rating

Payment chỉ cho task completed, có retry/chống pay lặp và rating sau paid. Điều này ổn trong isolated mock. Disputed chặn payment là điểm tốt; chưa có resolve/refund sau dispute.

### Secondary

Các screen account/chat/notifications/support không dead-end chính trong Customer. Chat, GPS, ETA, AI, payment, escrow, support đều phải được giới thiệu là simulation.

## 7. Tasker Screen Inventory

| Screen / nhóm | Status | Issue | Recommendation |
|---|---|---|---|
| Splash/login demo | Partial | Login một chạm demo có sẵn cả khi demo flag không rõ ràng | Gate demo action bằng build config/feature flag |
| Home, online toggle, nearby jobs | Partial | Jobs là data riêng, không phải job Customer post | Nối shared available-task feed |
| Map jobs | Partial | Mock map có pin; không có filter screen/logic filter hoàn chỉnh | Bổ sung Job Filters theo Stitch |
| Job detail + accept | Partial | Accept checkbox hằng `true`, không xác nhận điều khoản thật; accept chỉ update Tasker store | Stateful consent + shared assignment transaction |
| My jobs / active detail / travel / arrived / start / in progress | Complete (isolated) | Status update không về Customer | Workflow/API/event chung |
| Complete proof / waiting payment / rating Customer | Partial | “Customer approved” được Tasker tự bấm action demo | Customer payment phải là actor duy nhất release funds |
| Wallet/transactions/withdraw/result | Partial | Số dư available không trừ withdrawal; baseline magic 1.060.000đ; instant fee không được áp | Fix ledger/accounting trước mọi demo tài chính |
| Profile/services/radius | Partial | Có service/radius, chưa có availability weekly schedule và reviews list | Bổ sung schedule matrix/review history |
| KYC | Missing / Partial | Chỉ có một status mock; thiếu start, CCCD 2 mặt, selfie, student card, pending/rejected/resubmit model | Tách KYC flow và VerificationStatus rõ ràng |
| Messages/chat/notifications | Partial | Local Tasker data, không phải chat Customer; notification deep link không theo semantic | Shared conversation/event routing |
| Settings/switch role | Partial | Một số Help/Privacy/Call callbacks no-op; switch role không sync state | Có feedback hoặc route thật; role session chung |
| Trust deposit / support / complaint | Missing | Không có model, route, UI hoặc policy | Thêm trước release nếu là requirement Tasker |

## 8. Tasker Main Journey Review

Đường demo được test: login → mở `JOB-9401` → accept → travel → arrived → start → checklist → proof → waiting → demo release → rating → completed/wallet. Không có exception theo test, vì vậy **Tasker core isolated mock chạy được**.

Nó vẫn là Partial vì bốn lý do: (1) `JOB-9401` không phải task Customer tạo, (2) release/payment do Tasker giả lập, (3) ví sau withdrawal sai ledger, (4) KYC/trust deposit/filters/support không đạt bộ UI Tasker đã bàn giao.

## 9. Cross-role Contract Review

| Contract cần có | Hiện trạng | Verdict |
|---|---|---|
| Customer post → Tasker thấy available | Customer tạo `TL-*`; Tasker list giữ `JOB-*` riêng | Broken |
| Tasker accept → Customer thấy matched/assigned | Chỉ Tasker store cập nhật | Broken |
| Cùng task/status | Customer seed `TL-8492` = `onTheWay`; Tasker seed `TL-8492` = `accepted` | Broken |
| Tasker progress → Customer tracking | Customer tự advance demo | Broken |
| Customer pay → Tasker wallet/transaction | Customer pay chỉ Customer repository; Tasker `releaseDemo` tự cộng tiền | Broken |
| Chat/notification giữa hai role | Hai datasets conversations/notifications độc lập | Broken |
| Complaint/dispute/resolve | Chỉ Customer chuyển `disputed`; Tasker không nhận case | Broken |

## 10. Main Cross-role Findings

1. Cùng `taskId` không đảm bảo cùng object/state.
2. Có hai nguồn sự thật về task, assignment, timeline, payment và chat.
3. Price settlement không dùng một breakdown canonical: Customer total có protection/equipment; Tasker earnings hard-code 95% labor.
4. Role switch chỉ đổi UI controller, không đổi sang cùng phiên data.
5. Status policy dùng chung là nền tốt, nhưng các repository không cùng áp dụng transaction/event chung.

## 11. One-task Demo Feasibility

**Không thể demo đúng kịch bản “Customer đăng task → Tasker nhận cùng task → Tasker cập nhật → Customer tracking → Customer pay → Tasker nhận tiền” ở trạng thái hiện tại.** Có thể demo hai role nối tiếp như hai câu chuyện độc lập, nhưng không được trình bày như một giao dịch live end-to-end.

## 12. Missing vs Stitch/Requirements

### Customer

- Không có route độc lập cho radar “đang tìm Tasker”; nằm trong recommendation busy state.
- 7 bước create thay vì 8 visual steps; không phải blocker nếu thống nhất story.
- Không có admin resolution/dispute settlement, lịch sử escalation hay realtime map/chat thật.
- Font Be Vietnam Pro chưa được bundle; source dùng typography Flutter mặc định.

### Tasker

- Job Filters bottom sheet/screen.
- KYC 6-state flow: start, CCCD front/back, selfie, student card, pending/rejected/resubmit.
- Trust Deposit: balance, recharge, withdrawal, status/history (hoặc xác nhận requirement này bị loại).
- Availability weekly schedule; Tasker review list.
- Report issue/cancel/reschedule/support lifecycle từ Tasker.
- Notification categories và deep links đúng từng đối tượng.
- Customer-shared chat and task tracking.

## 13. State, Models and Data Quality

`CustomerTask`, `TaskStatus`, `PaymentStatus` và `TaskPolicy` là nền domain tốt cho flow Customer. Dù vậy, có các lỗ hổng model:

- Không có shared `Assignment`, `TaskEvent`, `EscrowTransaction`, `Settlement`, `DisputeCase`, `VerificationCase` hay `TrustDepositAccount`.
- `TaskerWallet` tính available bằng positive transactions + magic baseline, bỏ qua transaction âm.
- Withdrawal không có immutable payout/fee/status lifecycle.
- KYC chỉ boolean `verified`, không biểu diễn pending/rejected/reason/document status.
- Review/tag/checklist/proof có UI data nhưng chưa đủ canonical model cross-role.

## 14. Customer Repository / Mock Review

`MockCustomerRepository` có validation, idempotency post/payment, quote tập trung và complaint chuyển status. Đây là mock tốt cho Customer. Giới hạn là state chỉ sống memory, automation reply/GPS/AI/payment đều simulation, và không phát event sang Tasker.

## 15. Tasker Repository / Mock Review

`MockTaskerRepository` có API dễ thay thế nhưng intentionally independent. Logic accept/progress/complete hoạt động trên `_mine`; `releaseDemo` trực tiếp paid + add wallet transaction. Điều này cần được thay bằng API/hub chung, không chỉ “map endpoint”.

## 16. UI / Design-system Consistency

Màu emerald/navy/mint, cards, chip, CTA và bottom navigation trong source bám khá sát visual Stitch. Hai home tham chiếu đều có hierarchy hợp lý, card task/earnings rõ và nền đồng nhất. Tuy nhiên không thể gọi pixel-perfect vì:

- Be Vietnam Pro chưa có asset/font config.
- Một số Stitch screen chi tiết được nêu trong bàn giao chưa tồn tại riêng trong code (đặc biệt Tasker KYC/filter/trust deposit).
- Mock map/image/avatar dùng ít asset; avatar Tasker có thể dùng asset cùng nhân vật Customer hoặc fallback initial, làm identity visual kém tin cậy.
- Chưa có browser/device visual QA của review này.

## 17. UX & Interaction Review

**Tốt:** wizard có back/draft, status CTA theo flow, error/banner/empty state ở phần lớn Customer, transaction/proof/rating có nhãn mô phỏng.

**Cần sửa:** Tasker accept consent không thực sự tương tác; Tasker rating chips không phải selection có state; no-op call/help/privacy nên có feedback; notification của Tasker đưa mọi item về active job; completed-but-unpaid nằm tab Completed Customer có thể gây hiểu nhầm; demo action quá gần production UI.

## 18. Loading, Error, Empty & Retry

Controller hai role có `busy/error` và phần Customer có các state trống tương đối tốt (messages, notifications, task/payment method, matching). Retry/payment error đã được test Customer. Tasker thiếu scenario no jobs/failed accept/withdrawal failure/KYC reject rõ ràng. Không có offline/cache/reconnect/realtime conflict strategy.

## 19. Navigation / Deep Link Review

Enum stack đủ cho prototype và root nav five tabs hoạt động. Không có URL/deep link, route guard auth/role, state restoration hoặc typed route payload. Notification Tasker chưa route theo object type. Khi tích hợp backend, nên tách route coordinator trước khi lượng screen tăng thêm.

## 20. Demo-state Leakage

Customer demo controls được gate phần nào bởi demo mode. Ngược lại Tasker login demo, `releaseDemo`, KYC/payment simulated actions không có hàng rào đủ chặt trong source. Đây là rủi ro nếu build không-demo được phát hành nhầm. Cần feature flag tập trung và visual label nhất quán.

## 21. Test Coverage

Suite có **10 tests**: 7 repository, 2 Customer widget journeys và 1 Tasker journey. Tài liệu ghi analyze/test/web build đã pass. Coverage tốt cho happy path Customer và Tasker isolated. Chưa có integration test cross-role, withdrawal ledger test, KYC status test, cancellation/tasker dispute test, no-op accessibility/semantics, device/browser visual regression hay permission/network test thật.

## 22. Risks

| Rủi ro | Mức | Tác động |
|---|---|---|
| Two independent stores | Blocker | Không demo/handoff E2E hai role được |
| Wallet withdrawal không trừ balance | High | Demo tiền sai, mất niềm tin |
| Demo payment release từ Tasker | High | Sai quyền actor/settlement |
| KYC/trust deposit missing | High nếu là scope cam kết | Không đủ bộ Tasker đã hứa |
| Hard-coded fee/baseline | High | Sai khi backend/config thay đổi |
| Mock action lộ non-demo build | High | Rủi ro trình diễn/production |
| README/documentation stale | Medium | Onboarding developer sai |
| Manual navigation/large widget | Medium | Khó mở rộng/test |
| No device/browser QA | Medium | Layout/gesture không chắc |
| No real privacy/payment/GPS controls | Expected prototype | Không được mô tả như chức năng thật |

## 23. Top 10 Issues

1. **[Blocker]** Không shared task store/API giữa Customer và Tasker.
2. **[Blocker]** `TL-8492` seed đã khác status hai role.
3. **[High]** Tasker withdrawal không giảm available balance.
4. **[High]** Tasker tự demo giải ngân thay Customer payment.
5. **[High]** Settlement/fee không canonical, hard-coded theo labor.
6. **[High]** KYC Tasker chỉ status screen, thiếu flow/model trạng thái.
7. **[High nếu scope bắt buộc]** Trust Deposit hoàn toàn chưa có.
8. **[Medium]** Thiếu Job Filters và weekly availability/review list theo Stitch.
9. **[Medium]** Demo actions chưa được feature-flag/gate nhất quán.
10. **[Medium]** Chat/notifications/dispute không liên thông; một số Tasker callbacks no-op.

## 24. Priority Fix List

### Must Fix Before Demo

1. Chọn một `SharedMockTaskRepository`/in-memory app session cho cả hai controller; mọi task/assignment/status/payment/chat dùng cùng task ID.
2. Di chuyển quyền action: Tasker chỉ submit proof; Customer approve/pay; settlement event mới cộng Tasker wallet.
3. Sửa ledger wallet: available = opening balance + sum signed settled transactions; withdrawal tạo pending/settled/failed, áp phí rõ ràng.
4. Hoặc hoàn thiện Trust Deposit, hoặc loại nó khỏi script/scope đã bàn giao.
5. Feature-flag toàn bộ simulated payment/KYC/reset/release và gắn label hiển thị.
6. Chuẩn bị script demo chỉ dùng một task, một ID, một price breakdown.

### Should Fix Before Backend

1. Chốt shared domain contracts: task, assignment, status event, conversation, escrow/settlement, dispute, KYC, withdrawal.
2. Tách `TaskerView` và manual route code thành screen/coordinator nhỏ hơn.
3. Implement KYC state machine và Tasker filters/schedule/support required by UI spec.
4. Dùng configuration/payment policy thay magic 5%/1.060.000đ.
5. Add cross-role integration tests và financial invariant tests.

### Nice to Have

- Bundle Be Vietnam Pro, thêm asset/avatar đúng người.
- Browser/Android/iOS visual QA, accessibility/semantics, analytics, offline/retry polish.
- Realtime indicators, read receipts, map/GPS adapter sau khi API sẵn sàng.

## 25. Recommended Shared Mock Design

```text
Customer UI ─┐
             ├─ Customer/Tasker Controllers ─ Shared Task Session / Repository Interface
Tasker UI ───┘                                      │
                         ┌──────────────────────────┼─────────────────────────┐
                         ▼                          ▼                         ▼
                    Task + Assignment          Conversation/Event         Escrow Ledger
                         │                          │                         │
                    one task ID              status notifications      settlement → wallet
```

Không cần backend để làm bước này: dùng một singleton `MockTaskSession` inject vào cả repositories, transaction methods atomic, và event stream/mock notifier. Sau đó API Repository thay implementation nhưng giữ contract.

## 26. Suggested Demo Script After Must-fix

1. Customer đăng `TL-xxxx`, thấy matching.
2. Tasker online thấy đúng `TL-xxxx`, mở detail và accept.
3. Customer nhận assignment/matched; cả hai thấy cùng ETA/status.
4. Tasker travel → arrived → in progress → submit proof; Customer tracking đổi theo.
5. Customer review proof, payment/approve; shared settlement sinh transaction net Tasker.
6. Tasker wallet hiển thị balance tăng đúng một lần; withdrawal pending làm balance khả dụng giảm đúng quy tắc.
7. Chat/notification cùng conversation/task ID.

## 27. Backend Integration Difficulty

**Medium–High.** Per-role interface sẵn nên thay datasource của từng role không khó. Phần khó là hợp nhất contract đang bị duplicate: assignment concurrency, actor authorization, realtime status, escrow ledger idempotency, notification/chat, dispute/KYC/withdrawal states. Không nên nối hai mock trực tiếp bằng vài callback; hãy chốt backend contract/shared domain trước.

## 28. What Is Good Enough to Show Now

- Customer: onboarding/auth demo, create task, quote, matching visualization, task tracking simulation, payment/rating simulation, profile/chat/support.
- Tasker: near-job discovery, job detail, core execution timeline, proof upload simulation, wallet visual, profile/service setting.
- Cần luôn nói: hai role hiện là **two separate mock stories**, không phải một giao dịch đồng bộ.

## 29. What Should Not Be Claimed in Demo

- Customer và Tasker đang làm cùng một task realtime.
- Escrow/payment/banking/KYC/GPS/AI/insurance là thật.
- Tasker withdrawal đã phản ánh số dư chuẩn.
- Bộ Tasker đã bao phủ đủ KYC/Trust Deposit/filter/support theo toàn bộ Canvas.

## 30. Final Answers

| Câu hỏi | Trả lời ngắn |
|---|---|
| Customer E2E đã xong? | **Có, Complete trong isolated frontend + mock.** |
| Tasker E2E đã xong? | **Partial.** Core isolated chạy, nhưng wallet/KYC/trust deposit/filter/support và cross-role chưa đạt. |
| Cross-role flow đã xong? | **Broken.** Không chung state/task/payment/chat. |
| Tổng số màn hình? | Customer 35 route states (7-step create); Tasker 27 route states; tổng 62 route states. |
| Những màn hình còn thiếu? | Tasker filters, KYC flow đầy đủ, Trust Deposit, weekly availability, review list, Tasker support/dispute/cancel lifecycle; Customer admin dispute/realtime là future gap. |
| Top issue? | Shared task/session + canonical settlement/ledger. |
| Có demo cùng một task được không? | **Chưa được.** |

## 31. Final Recommendation

Không xây thêm nhiều screen trước. Làm một sprint “shared mock integration” nhỏ, sửa ledger, sau đó lấp đầy Tasker KYC/filter/trust deposit theo scope đã hứa. Khi đó bộ UI sẽ có câu chuyện end-to-end đáng tin cậy, và cũng là nền thay Mock Repository bằng API Repository với ít rewrite hơn.

## 32. Completion Note

Review này không thay đổi source application. Các kết luận “Complete/Partial/Broken” là readiness cho trải nghiệm và integration, không phủ nhận các screen mock đã được triển khai hoặc test theo từng role.
