import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:taskly_mobile/app/customer_controller.dart';
import 'package:taskly_mobile/data/mock/mock_customer_repository.dart';
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
  final target = find.text(text);
  await tester.scrollUntilVisible(
    target,
    220,
    scrollable: find.byType(Scrollable).first,
    maxScrolls: 40,
  );
  await tester.pumpAndSettle();
  await Scrollable.ensureVisible(tester.element(target.first), alignment: 0.5);
  await tester.pumpAndSettle();
  await tester.tap(target.first);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets(
    'Customer completes booking, tracking, payment and review through UI',
    (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final repo = MockCustomerRepository(
        latency: const Duration(milliseconds: 20),
      );
      final c = CustomerController(repo, demoControls: repo, demoMode: true);
      addTearDown(c.dispose);
      await tester.pumpWidget(TaskLyApp(controller: c));
      await tester.pumpAndSettle();
      await tapText(tester, 'Bắt đầu');
      await tapText(tester, 'Tiếp tục đăng nhập');
      await tapText(tester, 'Điền tài khoản demo');
      await tapText(tester, 'Nhận mã OTP');
      await tester.enterText(
        find.byType(TextFormField).first,
        c.data!.config.otp,
      );
      await tapText(tester, 'Xác minh & tiếp tục');
      await tapText(tester, 'Dùng địa chỉ đã lưu');
      expect(c.route.page, PageId.home);
      await tester.tap(find.byIcon(Icons.add_circle));
      await tester.pumpAndSettle();
      await tapText(tester, 'Tiếp tục'); // service
      await tapText(tester, 'Tiếp tục'); // address
      await tapText(tester, 'Tiếp tục'); // schedule
      final description = find.byWidgetPredicate(
        (w) => w is TextFormField && w.initialValue == '',
      );
      await tester.enterText(
        description.last,
        'Dọn phòng trọ 25m², lau sàn và nhà tắm.',
      );
      await tapText(tester, 'Thêm ảnh mẫu');
      await tester.tap(find.byType(Image).first);
      await tester.pumpAndSettle();
      expect(c.draft!.images, isNotEmpty);
      await tapText(tester, 'Tiếp tục');
      await tapText(tester, 'Cần Tasker mang dụng cụ');
      await tapText(tester, 'Tiếp tục');
      expect(c.draftQuote!.total, 230000);
      await tapText(tester, 'Tiếp tục');
      await tapText(tester, 'Sửa địa điểm');
      expect(c.draft!.equipment, isTrue);
      await tapText(tester, 'Tiếp tục');
      await tapText(tester, 'Tiếp tục');
      expect(c.draft!.description, contains('25m²'));
      await tapText(tester, 'Tiếp tục');
      await tapText(tester, 'Tiếp tục');
      await tapText(tester, 'Tiếp tục');
      await tapText(tester, 'Đăng công việc • 230.000đ');
      expect(c.route.page, PageId.recommendations);
      final id = c.route.id!;
      expect(c.data!.task(id).draft.images, isNotEmpty);
      // Open the first recommended profile without scrolling to a different candidate.
      await tester.scrollUntilVisible(
        find.text('Xem hồ sơ').first,
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text('Xem hồ sơ').first);
      await tester.pumpAndSettle();
      final tasker = c.data!.tasker(c.route.extra!);
      await tapText(tester, 'Chọn ${tasker.name}');
      await tapText(tester, 'Xác nhận');
      await tapText(tester, 'Xem tiến trình công việc');
      await tapText(tester, 'Tasker bắt đầu di chuyển');
      await tapText(tester, 'Mở theo dõi Tasker');
      expect(c.route.page, PageId.tracking);
      expect(c.data!.task(id).taskerId, tasker.id);
      await tapText(tester, 'Tasker đã đến nơi');
      expect(c.data!.task(id).status, TaskStatus.arrived);
      await tapText(tester, 'Về chi tiết công việc');
      await tapText(tester, 'Bắt đầu công việc');
      await tapText(tester, 'Tasker hoàn thành công việc');
      await tapText(tester, 'Nghiệm thu & thanh toán');
      for (final item
          in c.data!.service(c.data!.task(id).draft.serviceId).checklist) {
        await tapText(tester, item);
      }
      await tapText(tester, 'Thanh toán demo • 230.000đ');
      expect(c.route.page, PageId.paymentSuccess);
      await tapText(tester, 'Đánh giá Tasker');
      await tester.tap(find.byTooltip('5 sao'));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byType(TextFormField),
        'Dọn sạch và rất đúng giờ.',
      );
      await tapText(tester, c.data!.config.reviewTags.first);
      final criterion = find.byTooltip(
        '${c.data!.config.ratingCategories.first}: 4 sao',
      );
      await tester.ensureVisible(criterion);
      await tester.pumpAndSettle();
      await tester.tap(criterion);
      await tester.pumpAndSettle();
      await tapText(tester, 'Gửi đánh giá');
      await tapText(tester, 'Về Việc của tôi');
      expect(c.taskFilter, 2);
      expect(c.data!.task(id).status, TaskStatus.paid);
      expect(c.data!.task(id).review!.stars, 5);
      expect(c.data!.task(id).review!.categories.values.single, 4);
      expect(
        c.data!.task(id).review!.tags,
        contains(c.data!.config.reviewTags.first),
      );
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'secondary routes, chat and complaint work on a narrow viewport',
    (tester) async {
      tester.view.physicalSize = const Size(360, 780);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final repo = MockCustomerRepository(latency: Duration.zero);
      final config = (await repo.load()).config;
      await repo.sendOtp(config.phone);
      await repo.verifyOtp(config.otp);
      final c = CustomerController(repo, demoControls: repo, demoMode: true);
      addTearDown(c.dispose);
      await tester.pumpWidget(TaskLyApp(controller: c));
      await tester.pumpAndSettle();
      c.root(PageId.home);
      await tester.pumpAndSettle();
      for (final entry in {
        1: PageId.tasks,
        3: PageId.messages,
        4: PageId.profile,
        0: PageId.home,
        2: PageId.create,
      }.entries) {
        await tester.tap(find.byType(NavigationDestination).at(entry.key));
        await tester.pumpAndSettle();
        expect(c.route.page, entry.value);
        expect(tester.takeException(), isNull);
      }
      for (final page in [
        PageId.home,
        PageId.tasks,
        PageId.messages,
        PageId.profile,
        PageId.notifications,
        PageId.addresses,
        PageId.paymentMethods,
        PageId.reviews,
        PageId.settings,
        PageId.help,
      ]) {
        c.root(page);
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull, reason: page.name);
      }
      final id = c.data!.tasks.first.id;
      c.taskRoot(id);
      await tester.pumpAndSettle();
      await tapText(
        tester,
        'Nhắn tin cho ${c.data!.tasker(c.data!.task(id).taskerId!).name}',
      );
      await tester.scrollUntilVisible(
        find.byType(TextFormField),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.enterText(
        find.byType(TextFormField),
        'Mình đang chờ ở cổng nhé.',
      );
      await tapText(tester, 'Gửi tin nhắn');
      expect(
        c.data!.conversations.first.messages.any(
          (m) => m.text == 'Mình đang chờ ở cổng nhé.',
        ),
        isTrue,
      );
      c.taskRoot(id);
      await tester.pumpAndSettle();
      await tapText(tester, 'Báo sự cố / Hủy / Đổi lịch');
      await tapText(tester, 'Báo sự cố / Khiếu nại');
      await tester.scrollUntilVisible(
        find.byType(TextFormField),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.enterText(
        find.byType(TextFormField),
        'Cần hỗ trợ kiểm tra lịch hẹn của công việc.',
      );
      await tapText(tester, 'Thêm ảnh mẫu');
      await tester.tap(find.byType(Image).first);
      await tester.pumpAndSettle();
      await tapText(tester, 'Gửi yêu cầu hỗ trợ');
      expect(c.route.page, PageId.complaintStatus);
      expect(c.data!.complaints.first.evidence, isNotEmpty);
      expect(c.data!.task(id).status, TaskStatus.disputed);
      expect(tester.takeException(), isNull);
    },
  );
}
