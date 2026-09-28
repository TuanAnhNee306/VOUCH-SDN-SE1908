# EXE201 TaskLy — Master Project Handover

> **Purpose:** a new ChatGPT/Codex account can read TASKER_E2E_COMPLETION_REPORT.md, this file plus the current repository and continue safely. This is an engineering/business handover, not marketing.  
> **Snapshot date:** 27/09/2026. **Updated after shared Customer–Tasker implementation.** See `TASKER_E2E_COMPLETION_REPORT.md` for validation and demo instructions.

## Source of truth order

When sources conflict, use: **(1) current working code, (2) current project docs, (3) this handover, (4) old plans/proposals.** A business requirement not yet implemented remains a requirement/planned item, not proof of implementation. The older isolated completion/review reports are historical. The newest `TASKER_E2E_COMPLETION_REPORT.md` supersedes their independent-store/wallet/KYC findings.

## 1. Project identity, problem and users

| Item | Confirmed context |
|---|---|
| Course/project | EXE201 |
| Product | **TaskLy** |
| Platform | Flutter mobile/web prototype (Android, iOS, Windows, macOS, Linux and web runner scaffolds exist) |
| Product type | Two-sided short-task marketplace |
| Core actors | **Customer** requests a short task; **Tasker** (student/freelancer) discovers and performs it |
| Current service categories | Cleaning, moving help, small furniture assembly, purchase-on-behalf, fast delivery, other errands |

### Problem

Customer needs fast, trustworthy ad-hoc help with a transparent price, job visibility and a way to report problems. Tasker needs flexible work around availability, a reputation signal and income from short jobs. Target direction is Gen Z 18–27, students, young workers, renters/living alone and freelancers. This segment is a **confirmed product direction from the supplied requirements**, not user-research data stored in source.

### Value proposition

- **Fast:** create a structured task and find/recommend nearby help.
- **Safe:** proposed identity verification, task protection and complaint process; all current UI is simulation.
- **Transparent:** quote, price breakdown, platform fee display and status timeline.
- **Flexible:** taskers choose services/radius/online status; weekly availability grid now persists in the shared mock store.
- **Verified Taskers:** profile/KYC concepts are shown, but verification is mock-only.
- **Convenient booking:** Customer wizard, saved addresses and post-task tracking.

## 2. Roles and scope

| Role | Goal / key permissions | Current screens/workflow | Status |
|---|---|---|---|
| Customer | Create/manage task, choose tasker, pay, rate, message, complain | Auth, home, 7-step create, matching, tracking, payment, rating, account | Implemented with shared task mock |
| Tasker | Browse/accept job, execute, submit proof, see wallet, rate Customer | Demo login, jobs/map, execution, wallet, profile, simple verification, chat | Implemented with shared task mock |
| Admin | Review disputes, protection claims, KYC and policy | No mobile Admin role | Planned/future |
| Company/Partner | Opportunities, training, certificates | No implementation | Future business direction |

## 3. Business model and policy status

| Topic | Current implementation | Requirement/proposal / confirmation needed |
|---|---|---|
| Platform fee | `PriceBreakdown` snapshots configured labor fee (demo 5%); equipment passes to Tasker and protection does not | 3–5% is proposed range. Make one backend-configured canonical fee policy; do not hard-code it. |
| Task protection | Customer can select mock protection; seed/config uses 10,000 VND | Optional paid protection is confirmed direction; complaint must be human-admin decided, not AI decided. |
| Customer payment / escrow | Customer pays after completed; Tasker observes pending → available. `releaseDemo` removed | No real payment/escrow/banking exists. Customer should be authoritative payment actor. |
| Trust Deposit | Mock screen + `DepositStatus` + repository transitions implemented | Proposed refundable Tasker deposit (e.g. 500k), statuses NO_DEPOSIT/DEPOSIT_PENDING/DEPOSIT_ACTIVE/REFUND_REQUESTED/REFUNDED/HELD; policy needs confirmation. Not a fee. |
| Withdrawal | Mock standard free/instant 0.5% configurable, confirmation and balance reservation; no real payout | Settlement period and 0.5% instant fee are proposals; backend policy needed. |
| Career Experience | No code | Future: work history, skills, training, partner-company experience, certificates. |

## 4. Product modules

| Module | Current status |
|---|---|
| Authentication | Customer mock OTP/recovery/register; Tasker one-tap demo login |
| Customer / Task / matching | Shared Customer post/Tasker accept/task events implemented |
| Payment / wallet | Mock only; signed withdrawal reservation and single earning per paid task |
| Chat / notification | Shared task conversations; role notifications from the same events |
| Review / complaint | Customer→Tasker rating and complaint mock; Tasker→Customer rating mock |
| Identity verification | Mock front/back/selfie/pending/verified/rejected/resubmit workflow |
| Location/GPS, AI | Mock maps, ETA, draft/price suggestions; no device/API integration |
| Profile/settings/help | Both role utilities connected; Tasker help/privacy/call provide navigation or mock feedback |
| Career Experience | Future only |

## 5. Current technology and architecture

| Concern | Actual implementation |
|---|---|
| Framework/language | Flutter / Dart, SDK constraint `^3.13.3` |
| State management | `ChangeNotifier` controllers; no third-party state library |
| Router | No routing package; enum page state plus manually managed navigation stack in UI/controller |
| DI | Factory functions in `lib/app/dependencies.dart` instantiate repositories/controllers |
| Pattern | UI → Controller → repository interface → mock repository → in-memory data |
| Theme | Material 3-style `AppTheme` / `AppColors` in `lib/core/theme.dart`; colors target emerald `#078C5C`, navy `#0F2D3D`, mint `#E5F8EF` |
| Packages | Only Flutter SDK, `cupertino_icons`, test/lints. No networking, storage, maps, image picker, router, localization or state package. |
| Assets | `avatar.png`, `room_before.png`, `room_after.png`; no Be Vietnam Pro font bundled. |

### Architecture decision that must be preserved

Do **not** hard-code business/mock data in screen widgets. Keep repository interfaces. A future API implementation should replace a Mock repository at the binding point; UI should not be rewritten.

### Current shared architecture

`TaskLyApp` owns one `MockDataStore` injected into both role repositories. `RepositoryUpdates.changes` triggers controller snapshot refresh. Tasks, completion proof, conversations, reviews and settlement source are shared. Reset increments sessionGeneration and clears both navigation sessions. Data is still memory-only, within one app instance (not cross-browser/device).

## 6. Repository structure

```text
taskly_mobile/
  lib/
    main.dart                         # app shell, role switch
    app/ customer_controller.dart, tasker_controller.dart, dependencies.dart
    core/ theme.dart
    data/mock/ mock_data_store.dart, mock_customer_repository.dart,
               mock_tasker_repository.dart
    domain/ models.dart, repositories.dart, task_policy.dart,
            tasker_models.dart, tasker_repositories.dart, repository_updates.dart
    features/ customer_view.dart, booking_screens.dart, task_screens.dart,
              account_screens.dart, tasker_view.dart, tasker_account_screens.dart
    shared/ widgets.dart
  assets/images/
  test/ customer_journey_test.dart, repository_test.dart, tasker_journey_test.dart,
        shared_session_test.dart
  docs/ CUSTOMER_FRONTEND_COMPLETION_REPORT.md,
        TASKER_FRONTEND_COMPLETION_REPORT.md,
        TASKLY_CUSTOMER_TASKER_FRONTEND_REVIEW.md, this file
  tool/serve_demo.dart
```

`README.md` is still the default Flutter starter README. It is stale and must not be used as product truth.

## 7. Domain, mock data and repository contracts

### Implemented models

`models.dart`: `TaskStatus`, `PaymentStatus`, `Profile`, `Address`, `Service`, `Tasker`, `PriceBreakdown`, `PriceSuggestion`, `PaymentMethod`, `TaskDraft`, `TaskEvent`, `CustomerTask`, `Review`, `ChatMessage`, `Conversation`, `AppNotification`, `Complaint`, `DemoConfig`, `CustomerSnapshot`, `RepositoryFailure`.

`tasker_models.dart`: `VerificationStatus`, `DepositStatus`, `TaskerProfile`, `TaskerWallet`, `WalletTransaction`, `TaskCompletion`, `TaskerSnapshot`.

### Repository interfaces

- `CustomerRepository` aggregates `AuthRepository`, `TaskRepository`, `PaymentRepository`, `UserRepository`, `MessageRepository`, `NotificationRepository`, `ComplaintRepository`, with `load()`.
- `TaskerRepository`: `load`, demo login, online/accept/advance/submit completion/rate/update services/withdraw/message/notification/settings/reset, availability/verification/deposit/report. No Tasker payment release method.
- `DemoControls` is Customer-only capability for advance/reset/failure simulation.

### Mock source files

| Data | Source |
|---|---|
| Customer profile, addresses, services, taskers, tasks, reviews, conversations, notifications, payment methods, config | `lib/data/mock/mock_data_store.dart` via `mock_customer_repository.dart` |
| Tasker profile, available jobs, owned jobs, wallet, transactions, completion, local messages/notifications | Shared `mock_data_store.dart`, projected by `mock_tasker_repository.dart` |

**Important:** `TL-8492` is one shared seed object (onTheWay). Customer-created `TL-*` tasks appear directly in Tasker feed; obsolete independent `JOB-940x` seeds are removed.

### Planned backend entities (not current model guarantees)

User, CustomerProfile, TaskerProfile, Service, Task, Address, TaskAssignment/Match, Payment, Transaction, Wallet, Review, Complaint, Message, Conversation, Notification, IdentityVerification, TaskProtection and TrustDeposit. Add canonical settlement/dispute/verification entities rather than duplicating role-specific fields.

## 8. State machine

Implemented enum: `draft, posted, matching, accepted, onTheWay, arrived, inProgress, completed, paid, cancelled, disputed, refunded` plus payment `unpaid, processing, failed, paid, refunded`.

| Current → action → next | Intended actor | Code reality |
|---|---|---|
| DRAFT → post → POSTED/MATCHING | Customer/system | Customer mock implements |
| MATCHING → match/accept → ACCEPTED | Tasker/system | Both paths use shared atomic assignment; cross-role demo uses Tasker accept |
| ACCEPTED → start travel → ON_THE_WAY | Tasker | Tasker updates shared task via TaskPolicy/store.progress |
| ON_THE_WAY → arrive → ARRIVED | Tasker | Shared task state |
| ARRIVED → start → IN_PROGRESS | Tasker | Shared task state |
| IN_PROGRESS → submit completion → COMPLETED | Tasker | Shared task state |
| COMPLETED → pay → PAID | Customer | Only Customer payment sets PAID; Tasker wallet derives its earning once |
| active → cancel/dispute/refund | Customer/system/Admin | Customer cancel/complaint exists; resolution/admin lifecycle absent |

`TaskPolicy` validates the core active transitions and Customer payment/rating timing. Cross-role execution now uses this same policy and task. Legacy Customer-only demo advance remains for isolated testing.

## 9. Customer E2E flow and screen inventory

**Status: Complete for shared frontend/mock journey.** Customer flow is splash → onboarding → login/register/recovery → OTP → location permission → home → service/detail → create wizard → AI helper → recommendation/find → tasker profile/select/matched → task detail/tracking → payment/success → rating/success → tasks/profile/secondary pages.

| Group / actual route states | File | Purpose | Status |
|---|---|---|---|
| Splash, onboarding, login, register, recovery, OTP, location | `customer_view.dart` | mock entry/auth | IMPLEMENTED |
| Home, services, service detail, AI draft | `customer_view.dart`, `booking_screens.dart` | discover/create entry | IMPLEMENTED |
| Create task (7 wizard steps), review/post | `booking_screens.dart` | service/address/time/description+images/equipment/price+payment/review | IMPLEMENTED |
| Recommendations, tasker profile, matched | `booking_screens.dart` | matching/select simulation | IMPLEMENTED: shared Tasker acceptance |
| My tasks, task detail, tracking | `task_screens.dart` | state/timeline/task actions | IMPLEMENTED: listens to shared Tasker transitions; demo helper retained |
| Payment, payment success, rating, rating success | `task_screens.dart` | mock checkout/review | IMPLEMENTED mock |
| Messages/chat, notifications | `task_screens.dart` | local Customer conversation/events | IMPLEMENTED: shared conversation data |
| Profile/edit/addresses/payment methods/reviews/settings/help | `account_screens.dart` | account management | IMPLEMENTED mock |
| Support, complaint, complaint status | `account_screens.dart` | evidence/issue submission | PARTIAL: no Admin resolution |

### Create-task design

`TaskDraft` retains service, location, schedule/duration, description, images, equipment/notes, protection/payment and quote inputs. Controller/repository create quote/suggestion/post; Back preserves draft. Documentation/design sometimes says **8 steps**, while current UI has **7** by merging description+images and budget+payment. Code is source truth; update demo language accordingly.

### Customer data/actions

Post creates snapshot ID (`TL-*`); matching/find/select occurs inside Customer mock. Payment occurs only after completion and rating after payment. Complaint turns task to `disputed` and blocks payment. GPS/ETA/AI/image/gallery/payment are mock; memory resets on restart/reset.

## 10. Tasker E2E flow and screen inventory

**DONE for frontend/mock:** login → shared available task → detail/accept → travel → arrived → start → checklist/proof → waiting → Customer pays → earning available → rating → completed.

27 existing route states were preserved (8 layouts reused, 19 adjusted/bound); 6 routes added: filters, availability, deposit, reviews, help, report. Total 33, not an artificial target of 28. See completion report for exact route-by-route mapping. New auxiliary screens are in `tasker_account_screens.dart`; existing screens remain in `tasker_view.dart`.

KYC uses a single route with mock front/back/selfie/pending/verified/rejected/resubmit states in repository. Deposit is a separate refundable mock collateral state, not a wallet fee. Schedule stores 21 weekly slots; service/radius preferences filter recommendations. Filters support service, distance, minimum earning and today. Report submits evidence/note and creates shared disputed state.

Tasker cannot release payment. Work must submit sample photo; Customer sees the same proof/note. Start and work checklists are interactive and kept per task by controller.

## 11. Customer ↔ Tasker cross-flow

**DONE in one app session.** Customer creates TL-* → Tasker sees and accepts same ID → both see assigned Tasker/accepted → Tasker travels/arrives/starts/submits proof → Customer sees each transition → Customer pays → Tasker wallet credits exactly once → two-way reviews.

`MockDataStore` is the single source for tasks/conversations/reviews; repositories provide role projections. Change streams refresh both controllers, including the inactive role. App-bar role switch is demo/debug only. Do not claim synchronization between separate browser tabs/devices: no backend/persistence exists.

## 12. Navigation, UI system and reusable components

### Navigation

- Customer bottom nav: Home, Tasks, Create, Messages, Profile.
- Tasker bottom nav: Jobs, Map, My Jobs, Wallet, Profile.
- Role switch: Customer login/profile can open Tasker; Tasker settings can switch back. Shared data stays synchronized through repository changes.
- No `go_router`/Navigator route table, no deep links, route guards, state restoration or nested route framework.

### Actual shared widgets

`Panel`, `PrimaryButton`, `EmptyState`, `UserAvatar`, `StatusChip`, `PriceSummary`, `MockMap` (and private map painter) in `lib/shared/widgets.dart`. Do not claim generic `AppTextField`, `SecondaryButton`, `TaskCard`, `AppDialog` etc.—they are not shared components in this repo.

### Design system

`AppTheme`/`AppColors`/`TaskStatusStyle` centralize much of visual styling; Material Icons are used. Screens still contain local layout/style choices. Intended Stitch colors are emerald/navy/mint; Be Vietnam Pro is **not** configured in `pubspec.yaml`, so pixel-perfect typography is unconfirmed.

## 13. Payment, wallet, chat, notification, review and complaint

Customer quote = labor + equipment + protection. Fee is snapshotted in PriceBreakdown (demo 5% of labor); Tasker net = labor − fee + equipment. Protection is not a Tasker earning. Example: 200k labor + 10k protection → Customer 210k, Tasker 190k. With equipment 20k → Customer 230k, Tasker 210k.

COMPLETED creates pending earning projection; Customer PAID makes the same `earning-{taskId}` available. Opening wallet balance is explicitly configured 1.25M. Signed withdrawals reserve amount + fee atomically. Standard is free, instant defaults to 0.5%, both mock config; withdrawal result stays processing. Post-paid complaint does not silently reverse credited funds. Real payout failure/reversal/refund handling remains backend work.

Both roles send/read the same task conversation; no fake automatic reply. Direction is converted in Tasker projection. Notifications from shared domain events open job/detail/chat appropriately; role read state is maintained separately, chat read receipts remain simplified.

Review stores taskId/reviewerId/revieweeId, stars/comment and optional tags (Customer also categories). Report flow exists for both roles, with evidence and disputed status blocking unpaid checkout. Human Admin resolution is not implemented; AI never makes the decision.

## 14. AI, GPS and other integrations

| Capability | Current | Future direction |
|---|---|---|
| AI task creation | Mock draft suggestion; user confirms before post | Natural language → structured draft |
| AI price | Mock suggestion/quote | Inputs: service/duration/distance/complexity/history |
| Smart matching | Customer local recommendation | score by distance/rating/availability/skills/history; recommendation only |
| AI review/dispute | Not implemented | assist analysis/summarization only |
| GPS/maps/ETA | `MockMap`, static simulated ETA | device permissions, maps, route/realtime adapters |
| Payment/KYC/banking | Not integrated | provider/API integration, server-authoritative |

## 15. Completion status

- [x] Customer full wizard/matching/tracking/payment/rating/account UI.
- [x] Tasker shared feed/accept/execution/proof/wallet/rating and 33 route states.
- [x] Same-task Customer ↔ Tasker flow, shared messages/events/reset.
- [x] Signed withdrawal balance/fees and idempotent earning projection.
- [x] Mock KYC workflow, refundable deposit workflow, filters/schedule/reviews/help/report.
- [x] 15 tests pass, analyzer clean, web demo builds (see completion report).
- [~] Mock only: KYC uses sample confirmations, deposit uses external collateral state, maps/ETA/AI are illustrative, bank destination fixed, chat read receipt simple.
- [ ] Backend/auth provider, real payments/KYC/GPS/upload/push, Admin dispute/refund resolution, career/partner features.
- [ ] Device and direct browser visual QA; Be Vietnam Pro font.

## 16. Known issues and discrepancies

The former blockers (independent stores, TL-8492 mismatch, withdrawal not deducted, Tasker self-release) are resolved. Earlier `TASKLY_CUSTOMER_TASKER_FRONTEND_REVIEW.md` is a historical pre-fix review.

| Severity | Remaining limitation | Next action |
|---|---|---|
| Medium | Memory-only single app session | Backend persistence/auth/realtime when authorized |
| Medium | Mock payout processing, no reversal/refund/Admin decisions | Define server ledger and policy |
| Medium | KYC/deposit are illustrative workflows, no real documents/provider | Provider, consent and lifecycle integration |
| Medium | Chat read receipts simplified; weekly schedule saved but not hard eligibility gate | Confirm product policy before enforcing |
| Low | Manual navigation / large existing Tasker widget | Incremental screen extraction as features grow |
| Low | Default font, no device/browser visual QA | QA and asset polish |

No known blocking issue remains for the tested same-task frontend demo. Do not describe this as production ready.

## 17. Backend integration plan

Keep current repository interfaces, but extend/replace deliberately:

1. Establish API auth/session and role-aware current user.
2. Define canonical task/assignment/status-event contract; implement Customer and Tasker API repositories against the same IDs.
3. Implement matching/availability/concurrency so only one Tasker can accept.
4. Add server-authoritative payment/escrow/settlement and immutable wallet ledger; all mutations idempotent.
5. Add conversations/messages/read receipts, notifications/push and realtime task events.
6. Add review, complaint/evidence/dispute resolution, KYC and protection APIs.
7. Replace mock Trust Deposit transitions with server policy after requirements are confirmed.

Planned REST modules (not present): `/auth`, `/users`, `/services`, `/tasks`, `/taskers`, `/matching`, `/payments`, `/wallet`, `/messages`, `/notifications`, `/reviews`, `/complaints`, `/verification`, `/ai`.

## 18. MVP definition and future scope

**Target demo MVP:** Customer login → create → match → track → complete/pay/rate; Tasker login → see/accept → travel/start/complete → earnings/rate; shared chat/notification/profile. The shared mock now covers this journey; backend/provider features remain out of this phase.

**Out of MVP/future:** production AI/payment/KYC/Admin/fraud detection, analytics, career experience, partner companies, certificate, advanced matching/recommendation.

## 19. Development history (evidence-based)

1. Product/workflow and Stitch screen direction were defined.
2. Customer frontend was implemented from an initial Flutter counter app; completion report documents isolated mock flow.
3. Tasker frontend was added with an independent mock repository; completion report explicitly notes no shared session.
4. Cross-role frontend review identified the independent-store blocker, wallet defect and missing Tasker scope.
5. Master handover was created, then updated after shared-session implementation, 15 passing tests and web build. No git history is available in this directory, so no commit timeline is asserted.

## 20. Important terminology

| Term | Meaning |
|---|---|
| Customer | person requesting short-term help |
| Tasker | student/freelancer performing a task |
| Task | customer request with status/timeline/price/assignment |
| Matching | selecting/assigning suitable Tasker; recommendation, not final AI decision |
| Task Protection | optional per-task protection concept, currently mock |
| Trust Deposit | refundable Tasker collateral mock state, separate from platform fee/earnings |
| Platform Fee | platform share of transaction; current Tasker demo is 5% labor |
| Instant Withdrawal | proposed accelerated payout with possible fee |
| Settlement | server-authoritative transition from eligible completion to wallet funds |
| Career Experience | future profile/training/partner-company progression |

## 21. Next development priorities

1. Demo the exact shared flow in the completion report on target devices; check accessibility, typography and maps/scroll layout.
2. Confirm production policies for KYC eligibility, refundable deposit/holds, fee payer, equipment pass-through, settlement, payout failures and disputes.
3. Design backend canonical task/assignment/event/ledger contracts, then API repositories and auth.
4. Add persistent chat/read receipts, upload/evidence and notifications; preserve existing screen/controller architecture.
5. Integrate providers only when explicitly in scope. Keep financial authorization and idempotency server-side.

## 22. Instructions for the next AI/Codex

1. Read this file, then scan `lib/`, `test/`, `docs/`, `pubspec.yaml` before coding.
2. Do not create a new Flutter project or replace existing screens unnecessarily.
3. Preserve UI → controller → repository interface; never put mock business data in widgets.
4. Reuse `TaskStatus`/`CustomerTask` and extend canonical models rather than duplicate Customer/Tasker task states.
5. Preserve the now-tested shared cross-role session and finance invariants. Run shared_session_test.dart and tasker_journey_test.dart for regression.
6. Do not implement real payment/KYC/GPS/AI in frontend-only code or imply data is real.
7. Keep disputes human-admin decided; AI can only assist.
8. Run formatting, analyzer and relevant tests after changes; add regression tests for any state transition/ledger behavior.
9. Avoid unrelated refactors, destructive git commands and broad UI changes in a bug-fix task.
10. Update this handover whenever architecture, scope or major status changes.

## 23. Quick start for a new ChatGPT / Codex account

**TaskLy** is an EXE201 Flutter prototype for a two-sided marketplace: Customers book short local tasks and Taskers perform them. The project currently has rich Customer and Tasker UI with in-memory mocks, `ChangeNotifier` controllers and repository interfaces; it has **no backend** and no real financial/KYC/GPS/AI integration.

Read first: this file; `docs/TASKLY_CUSTOMER_TASKER_FRONTEND_REVIEW.md`; `lib/main.dart`; `lib/app/dependencies.dart`; `lib/domain/models.dart`; `lib/domain/task_policy.dart`; `lib/data/mock/mock_customer_repository.dart`; `lib/data/mock/mock_tasker_repository.dart`; then controller/view/test files.

Customer and Tasker now share one MockDataStore in TaskLyApp. Customer-created TL-* appears in Tasker jobs; accept/progress/proof update both roles; only Customer payment credits Tasker; both rate/chat on the same task. Fifteen tests pass including UI role switching. KYC/deposit/filter/schedule/support screens now have mock state. Read TASKER_E2E_COMPLETION_REPORT.md for the demo script and limits.

Next: device/browser QA, policy confirmation and backend contract design. Preserve repository abstraction, shared models, atomic assignment and payment idempotency. Do not promise real payment/KYC/AI. Admin dispute decisions stay human. Mock data resets on reload; only a single app instance is synchronized.
