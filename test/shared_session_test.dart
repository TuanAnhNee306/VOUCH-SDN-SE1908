import 'package:flutter_test/flutter_test.dart';
import 'package:taskly_mobile/app/customer_controller.dart';
import 'package:taskly_mobile/app/tasker_controller.dart';
import 'package:taskly_mobile/data/mock/mock_customer_repository.dart';
import 'package:taskly_mobile/data/mock/mock_data_store.dart';
import 'package:taskly_mobile/data/mock/mock_tasker_repository.dart';
import 'package:taskly_mobile/domain/models.dart';
import 'package:taskly_mobile/domain/task_policy.dart';
import 'package:taskly_mobile/domain/tasker_models.dart';

void main() {
  late MockDataStore store;
  late MockCustomerRepository customer;
  late MockTaskerRepository tasker;
  setUp(() async {
    store = MockDataStore();
    customer = MockCustomerRepository(store: store, latency: Duration.zero);
    tasker = MockTaskerRepository(store: store, latency: Duration.zero);
    await customer.sendOtp(MockDataStore.config.phone);
    await customer.verifyOtp(MockDataStore.config.otp);
    await tasker.loginDemo();
  });
  tearDown(() => store.dispose());
  Future<String> post({bool equipment = false}) async {
    final draft = await customer.newDraft();
    draft.description = 'Dọn phòng dùng chung dữ liệu cho hai role';
    draft.equipment = equipment;
    return customer.post(draft, '${store.sequence}');
  }

  Future<String> complete() async {
    final id = await post(equipment: true);
    await tasker.accept(id);
    for (var i = 0; i < 3; i++) {
      await tasker.advance(id);
    }
    await tasker.submitCompletion(id, [
      MockDataStore.config.sampleImages.last,
    ], 'Bàn giao');
    return id;
  }

  test(
    'one assignment wins, both projections and observers see every transition',
    () async {
      final c = CustomerController(customer), t = TaskerController(tasker);
      addTearDown(c.dispose);
      addTearDown(t.dispose);
      await c.initialize();
      await t.initialize();
      final id = await post();
      expect((await tasker.load()).availableJobs.single.id, id);
      final outcomes = await Future.wait([
        tasker.accept(id).then((_) => true).catchError((_) => false),
        tasker.accept(id).then((_) => true).catchError((_) => false),
      ]);
      expect(outcomes.where((x) => x).length, 1);
      for (final expected in [
        TaskStatus.onTheWay,
        TaskStatus.arrived,
        TaskStatus.inProgress,
      ]) {
        await tasker.advance(id);
        await Future<void>.delayed(Duration.zero);
        expect(c.data!.task(id).status, expected);
        expect(t.data!.job(id).status, expected);
      }
      await expectLater(tasker.advance(id), throwsA(isA<RepositoryFailure>()));
      await expectLater(
        tasker.submitCompletion(id, [], ''),
        throwsA(isA<RepositoryFailure>()),
      );
      await tasker.submitCompletion(id, [
        MockDataStore.config.sampleImages.last,
      ], 'Kết quả');
      expect(store.task(id).completedAt, isNotNull);
      expect(store.task(id).acceptedAt, isNotNull);
      expect(store.task(id).startedAt, isNotNull);
    },
  );
  test('pending -> paid exactly once, equipment passed through, withdrawal includes fee', () async {
    final initial = (await tasker.load()).wallet.available;
    final id = await complete();
    expect((await tasker.load()).wallet.pending, 210000);
    customer.failNextPayment();
    await expectLater(
      customer.pay(id, 'momo'),
      throwsA(isA<RepositoryFailure>()),
    );
    expect((await tasker.load()).wallet.available, initial);
    await Future.wait([customer.pay(id, 'momo'), customer.pay(id, 'momo')]);
    final paid = await tasker.load();
    expect(paid.wallet.pending, 0);
    expect(paid.wallet.available, initial + 210000);
    expect(paid.wallet.transactions.where((t) => t.taskId == id).length, 1);
    expect(
      store.task(id).timeline.where((e) => e.status == TaskStatus.paid).length,
      1,
    );
    await tasker.withdraw(500000, false);
    expect((await tasker.load()).wallet.available, initial + 210000 - 500000);
    await tasker.withdraw(200000, true);
    expect(
      (await tasker.load()).wallet.available,
      initial + 210000 - 500000 - 201000,
    );
    await expectLater(
      tasker.withdraw(999999999, true),
      throwsA(isA<RepositoryFailure>()),
    );
  });
  test('bidirectional chat and ratings carry the same task and participant context', () async {
    final id = await complete();
    final chat = (await customer.load()).conversations.firstWhere(
      (c) => c.taskId == id,
    );
    await customer.sendMessage(chat.id, 'Cảm ơn bạn');
    expect(
      (await tasker.load()).conversations.first.messages.last.mine,
      isFalse,
    );
    await tasker.sendMessage(chat.id, 'Mời nghiệm thu');
    expect(
      (await customer.load()).conversations.first.messages.last.text,
      'Mời nghiệm thu',
    );
    expect(
      (await customer.load()).conversations.first.messages.last.mine,
      isFalse,
    );
    expect(
      store.notifications.any((n) => n.taskId == id && n.id.startsWith('MSG-')),
      isTrue,
    );
    await customer.pay(id, 'momo');
    await customer.rate(id, 5, 'Tốt');
    await tasker.rateCustomer(id, 4, 'Hợp tác', tags: ['Đúng hẹn']);
    expect(store.task(id).review!.revieweeId, 'minh-anh');
    expect(store.task(id).taskerReview!.revieweeId, store.task(id).customerId);
    expect(TaskPolicy.bucket(store.task(id), DateTime.now()), 2);
  });
  test('offline, cancellation, complaint, KYC, deposit, availability and reset guards', () async {
    final id = await post();
    await tasker.setOnline(false);
    await expectLater(tasker.accept(id), throwsA(isA<RepositoryFailure>()));
    await tasker.setOnline(true);
    await customer.cancel(id, 'Đổi kế hoạch');
    await expectLater(tasker.accept(id), throwsA(isA<RepositoryFailure>()));
    final active = await complete();
    await tasker.report(
      active,
      MockDataStore.config.issues.first,
      'Khách cần hỗ trợ xem xét kết quả',
      [],
    );
    await expectLater(
      customer.pay(active, 'momo'),
      throwsA(isA<RepositoryFailure>()),
    );
    expect(store.task(active).status, TaskStatus.disputed);
    for (final status in [
      VerificationStatus.front,
      VerificationStatus.back,
      VerificationStatus.selfie,
      VerificationStatus.pending,
      VerificationStatus.rejected,
      VerificationStatus.front,
      VerificationStatus.back,
      VerificationStatus.selfie,
      VerificationStatus.pending,
      VerificationStatus.verified,
    ]) {
      await tasker.verify(status);
    }
    expect((await tasker.load()).profile.verified, isTrue);
    for (final status in [
      DepositStatus.pending,
      DepositStatus.active,
      DepositStatus.refundRequested,
      DepositStatus.refunded,
    ]) {
      await tasker.updateDeposit(status);
    }
    expect((await tasker.load()).deposit, DepositStatus.refunded);
    await tasker.updateAvailability({1, 4, 20});
    expect((await tasker.load()).availability, {1, 4, 20});
    await tasker.reset();
    expect((await customer.load()).tasks.any((t) => t.id == active), isFalse);
    expect(
      (await tasker.load()).wallet.available,
      MockDataStore.config.openingWalletBalance,
    );
  });
}
