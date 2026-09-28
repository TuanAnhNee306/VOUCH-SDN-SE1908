import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:taskly_mobile/app/customer_controller.dart';
import 'package:taskly_mobile/app/tasker_controller.dart';
import 'package:taskly_mobile/data/mock/mock_customer_repository.dart';
import 'package:taskly_mobile/data/mock/mock_data_store.dart';
import 'package:taskly_mobile/data/mock/mock_tasker_repository.dart';
import 'package:taskly_mobile/domain/models.dart';
import 'package:taskly_mobile/main.dart';

Future<void> tapText(WidgetTester tester, String text) async {
  FocusManager.instance.primaryFocus?.unfocus();
  await tester.pumpAndSettle();
  tester
      .state<ScrollableState>(find.byType(Scrollable).first)
      .position
      .jumpTo(0);
  await tester.pumpAndSettle();
  final buttons = find.ancestor(
    of: find.text(text),
    matching: find.byWidgetPredicate(
      (w) => w is ButtonStyleButton || w is CheckboxListTile || w is FilterChip,
    ),
  );
  // Prefer actual controls over the same text in an AppBar heading.
  for (
    var i = 0;
    buttons.evaluate().isEmpty && find.text(text).evaluate().isEmpty && i < 50;
    i++
  ) {
    await tester.drag(find.byType(Scrollable).first, const Offset(0, -180));
    await tester.pumpAndSettle();
  }
  if (buttons.evaluate().isEmpty) {
    for (var i = 0; buttons.evaluate().isEmpty && i < 25; i++) {
      await tester.drag(find.byType(Scrollable).first, const Offset(0, -180));
      await tester.pumpAndSettle();
    }
  }
  final target = buttons.evaluate().isNotEmpty
      ? buttons.last
      : find.text(text).last;
  await tester.pumpAndSettle();
  await Scrollable.ensureVisible(tester.element(target), alignment: .5);
  await tester.pumpAndSettle();
  await tester.tap(target);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets(
    'Same task: Customer posts, Tasker executes, Customer pays, both rate through UI',
    (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final store = MockDataStore();
      final repo = MockCustomerRepository(store: store, latency: Duration.zero);
      final taskerRepo = MockTaskerRepository(
        store: store,
        latency: Duration.zero,
      );
      final customer = CustomerController(
        repo,
        demoMode: true,
        demoControls: repo,
      );
      final tasker = TaskerController(taskerRepo, demoMode: true);
      addTearDown(() {
        customer.dispose();
        tasker.dispose();
        store.dispose();
      });
      await tester.pumpWidget(
        TaskLyApp(controller: customer, taskerController: tasker),
      );
      await tester.pumpAndSettle();
      await tapText(tester, 'Bắt đầu');
      await tapText(tester, 'Tiếp tục đăng nhập');
      await tapText(tester, 'Điền tài khoản demo');
      await tapText(tester, 'Nhận mã OTP');
      await tester.enterText(
        find.byType(TextFormField).first,
        customer.data!.config.otp,
      );
      await tapText(tester, 'Xác minh & tiếp tục');
      await tapText(tester, 'Dùng địa chỉ đã lưu');
      await tester.tap(find.byIcon(Icons.add_circle));
      await tester.pumpAndSettle();
      for (var i = 0; i < 3; i++) {
        await tapText(tester, 'Tiếp tục');
      }
      await tester.enterText(
        find.byType(TextFormField).first,
        'Dọn phòng chung E2E, lau sàn và nhà tắm.',
      );
      await tapText(tester, 'Tiếp tục');
      await tapText(tester, 'Tiếp tục');
      await tapText(tester, 'Tiếp tục');
      await tapText(tester, 'Đăng công việc • 210.000đ');
      final id = customer.route.id!;
      expect(
        customer.data!
            .task(id)
            .timeline
            .any((e) => e.status == TaskStatus.posted),
        isTrue,
      );
      Future<void> switchTo(String role) async {
        await tester.tap(find.byTooltip('Demo: chuyển $role'));
        await tester.pumpAndSettle();
      }

      await switchTo('Tasker');
      await tapText(tester, 'Bắt đầu với vai trò Tasker');
      await tapText(tester, 'Đăng nhập Tasker demo');
      expect(tasker.data!.availableJobs.any((j) => j.id == id), isTrue);
      final card = find.byKey(ValueKey('tasker-job-$id'));
      await tester.scrollUntilVisible(
        card,
        180,
        scrollable: find.byType(Scrollable).first,
      );
      final action = find.descendant(
        of: card,
        matching: find.text('Xem việc →'),
      );
      await tester.ensureVisible(action);
      await tester.pumpAndSettle();
      await tester.tap(action);
      await tester.pumpAndSettle();
      expect(tasker.route.page, TaskerPage.jobDetail);
      await tapText(tester, 'Nhận công việc');
      await tapText(tester, 'Tôi có thể đến đúng giờ');
      await tapText(tester, 'Xác nhận nhận việc');
      expect(tasker.data!.availableJobs.any((j) => j.id == id), isFalse);
      expect(customer.data!.task(id).taskerId, 'minh-anh');
      await switchTo('Customer');
      expect(customer.route.page, PageId.task);
      expect(customer.data!.task(id).status, TaskStatus.accepted);
      await switchTo('Tasker');
      await tapText(tester, 'Bắt đầu di chuyển');
      await tapText(tester, 'Bắt đầu di chuyển');
      await switchTo('Customer');
      expect(customer.data!.task(id).status, TaskStatus.onTheWay);
      await switchTo('Tasker');
      await tapText(tester, 'Tôi đã đến nơi');
      await switchTo('Customer');
      expect(customer.data!.task(id).status, TaskStatus.arrived);
      await switchTo('Tasker');
      await tapText(tester, 'Bắt đầu công việc');
      await tapText(tester, 'Đã gặp Customer');
      await tapText(tester, 'Đã xác nhận yêu cầu');
      await tapText(tester, 'Bắt đầu ngay');
      await switchTo('Customer');
      expect(customer.data!.task(id).status, TaskStatus.inProgress);
      await switchTo('Tasker');
      for (final text in tasker.data!.service('cleaning').checklist) {
        await tapText(tester, text);
      }
      await tapText(tester, 'Hoàn thành công việc');
      await tester.tap(find.byType(Image).last);
      await tester.enterText(
        find.byType(TextFormField),
        'Đã làm xong, mời nghiệm thu.',
      );
      await tapText(tester, 'Xác nhận hoàn thành');
      expect(tasker.data!.wallet.pending, 190000);
      final balance = tasker.data!.wallet.available;
      await switchTo('Customer');
      expect(customer.data!.task(id).status, TaskStatus.completed);
      expect(
        customer.data!.task(id).completionNote,
        'Đã làm xong, mời nghiệm thu.',
      );
      await tapText(tester, 'Nghiệm thu & thanh toán');
      for (final text in customer.data!.service('cleaning').checklist) {
        await tapText(tester, text);
      }
      await tapText(tester, 'Thanh toán demo • 210.000đ');
      expect(tasker.data!.wallet.available, balance + 190000);
      expect(tasker.data!.wallet.pending, 0);
      await tapText(tester, 'Đánh giá Tasker');
      await tester.tap(find.byTooltip('5 sao'));
      await tapText(tester, 'Gửi đánh giá');
      await switchTo('Tasker');
      await tapText(tester, 'Đánh giá Customer');
      await tester.tap(find.byTooltip('5 sao'));
      await tapText(tester, 'Gửi đánh giá');
      await tapText(tester, 'Xem việc đã hoàn thành');
      expect(tasker.jobFilter, 2);
      expect(store.task(id).review!.stars, 5);
      expect(store.task(id).taskerReview!.revieweeId, 'customer-linh');
      expect(store.task(id).status, TaskStatus.paid);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'Tasker secondary routes: chat, notification, filters, KYC, deposit, withdrawal and reset',
    (tester) async {
      tester.view.physicalSize = const Size(360, 780);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final store = MockDataStore();
      final customerRepo = MockCustomerRepository(
        store: store,
        latency: Duration.zero,
      );
      final repo = MockTaskerRepository(store: store, latency: Duration.zero);
      final c = CustomerController(
        customerRepo,
        demoMode: true,
        demoControls: customerRepo,
      );
      final t = TaskerController(repo, demoMode: true);
      addTearDown(() {
        c.dispose();
        t.dispose();
        store.dispose();
      });
      await customerRepo.sendOtp(MockDataStore.config.phone);
      await customerRepo.verifyOtp(MockDataStore.config.otp);
      await tester.pumpWidget(TaskLyApp(controller: c, taskerController: t));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Demo: chuyển Tasker'));
      await tester.pumpAndSettle();
      await tapText(tester, 'Bắt đầu với vai trò Tasker');
      await tapText(tester, 'Đăng nhập Tasker demo');
      for (final page in [
        TaskerPage.map,
        TaskerPage.jobs,
        TaskerPage.wallet,
        TaskerPage.profile,
        TaskerPage.services,
        TaskerPage.verification,
        TaskerPage.messages,
        TaskerPage.notifications,
        TaskerPage.settings,
        TaskerPage.filters,
        TaskerPage.availability,
        TaskerPage.deposit,
        TaskerPage.reviews,
        TaskerPage.help,
      ]) {
        if (page == TaskerPage.services) {
          t.startServices();
        } else {
          t.root(page);
        }
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull, reason: page.name);
      }
      t.chatFor('TL-8492');
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextFormField), 'Mình đến rồi nhé');
      await tester.ensureVisible(find.byTooltip('Gửi tin nhắn'));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Gửi tin nhắn'));
      await tester.pumpAndSettle();
      expect(
        c.data!.conversations.first.messages.last.text,
        'Mình đến rồi nhé',
      );
      t.root(TaskerPage.verification);
      await tester.pumpAndSettle();
      for (final text in [
        'Bắt đầu xác minh mẫu',
        'Dùng ảnh mẫu mặt trước',
        'Dùng ảnh mẫu mặt sau',
        'Dùng selfie mẫu & gửi hồ sơ',
        'Mô phỏng duyệt hồ sơ',
      ]) {
        await tapText(tester, text);
      }
      expect(t.data!.profile.verified, isTrue);
      t.root(TaskerPage.deposit);
      await tester.pumpAndSettle();
      for (final text in [
        'Mô phỏng nộp đảm bảo',
        'Mô phỏng xác nhận đã nộp',
        'Yêu cầu hoàn lại',
        'Mô phỏng hoàn tiền thành công',
      ]) {
        await tapText(tester, text);
      }
      t.root(TaskerPage.wallet);
      await tester.pumpAndSettle();
      final before = t.data!.wallet.available;
      await tapText(tester, 'Rút tiền');
      await tester.enterText(find.byType(TextFormField), '500000');
      await tapText(tester, 'Tiếp tục rút tiền');
      await tester.tap(find.widgetWithText(FilledButton, 'Xác nhận'));
      await tester.pumpAndSettle();
      expect(t.route.page, TaskerPage.withdrawResult);
      expect(t.data!.wallet.available, before - 500000);
      c.open(PageId.chat, id: 'chat-TL-8492');
      await t.reset();
      await tester.pumpAndSettle();
      expect(c.route.page, PageId.splash);
      expect(t.route.page, TaskerPage.splash);
      expect(tester.takeException(), isNull);
    },
  );
}
