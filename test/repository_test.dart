import 'package:flutter_test/flutter_test.dart';
import 'package:taskly_mobile/data/mock/mock_customer_repository.dart';
import 'package:taskly_mobile/domain/models.dart';
import 'package:taskly_mobile/domain/task_policy.dart';

void main() {
  late MockCustomerRepository repo;
  setUp(() async {
    repo = MockCustomerRepository(latency: Duration.zero);
    final config = (await repo.load()).config;
    await repo.sendOtp(config.phone);
    await repo.verifyOtp(config.otp);
  });
  Future<String> create() async {
    final draft = await repo.newDraft();
    draft.description = 'Dọn phòng trọ, lau sàn và nhà tắm.';
    return repo.post(draft, 'test-post');
  }

  Future<String> completed() async {
    final id = await create();
    final candidates = await repo.findTaskers(id);
    await repo.match(id, candidates.first.id);
    for (var i = 0; i < 4; i++) {
      await repo.advance(id);
    }
    return id;
  }

  test('quote carries equipment and protection, no double charge', () async {
    final draft = await repo.newDraft();
    expect((await repo.quote(draft)).total, 210000);
    draft.equipment = true;
    expect((await repo.quote(draft)).total, 230000);
    draft.protection = false;
    expect((await repo.quote(draft)).total, 220000);
    draft.duration = 3;
    expect((await repo.quote(draft)).total, 320000);
  });
  test('post is idempotent and task keeps draft snapshot', () async {
    final draft = await repo.newDraft();
    draft.description = 'Một công việc cần hỗ trợ.';
    final id = await repo.post(draft, 'same-request');
    expect(await repo.post(draft, 'same-request'), id);
    draft.description = 'Changed draft';
    expect(
      (await repo.load()).task(id).draft.description,
      'Một công việc cần hỗ trợ.',
    );
    expect((await repo.load()).tasks.where((t) => t.id == id).length, 1);
  });
  test(
    'full lifecycle, payment failure retry, duplicate payment and review',
    () async {
      final id = await completed();
      var task = (await repo.load()).task(id);
      expect(task.status, TaskStatus.completed);
      expect(TaskPolicy.bucket(task, DateTime.now()), 2);
      repo.failNextPayment();
      await expectLater(
        repo.pay(id, task.draft.paymentMethodId),
        throwsA(isA<RepositoryFailure>()),
      );
      expect((await repo.load()).task(id).status, TaskStatus.completed);
      expect((await repo.load()).task(id).paymentStatus, PaymentStatus.failed);
      await repo.pay(id, task.draft.paymentMethodId);
      await repo.pay(id, task.draft.paymentMethodId);
      await repo.rate(id, 5, 'Cẩn thận và đúng giờ.');
      await repo.rate(id, 1, 'Must not duplicate');
      task = (await repo.load()).task(id);
      expect(task.status, TaskStatus.paid);
      expect(task.timeline.where((e) => e.status == TaskStatus.paid).length, 1);
      expect(task.review!.stars, 5);
      expect(task.receipt, isNotNull);
    },
  );
  test(
    'no matches retry, assignment creates chat, counters share store',
    () async {
      final id = await create();
      repo.noMatchesNextSearch();
      expect(await repo.findTaskers(id), isEmpty);
      final people = await repo.findTaskers(id);
      await repo.match(id, people.first.id);
      final snapshot = await repo.load();
      final chat = snapshot.conversations.firstWhere((c) => c.taskId == id);
      await repo.sendMessage(chat.id, 'Tôi đang chờ ở cổng.');
      await repo.readConversation(chat.id);
      final next = await repo.load();
      expect(
        next.conversations.firstWhere((c) => c.id == chat.id).messages.length,
        2,
      );
      expect(next.conversations.firstWhere((c) => c.id == chat.id).unread, 0);
      expect(next.notifications.any((n) => n.taskId == id), isTrue);
    },
  );
  test('complaint blocks payment and preserves evidence', () async {
    final id = await completed();
    final snapshot = await repo.load();
    final issue = await repo.submitComplaint(
      id,
      snapshot.config.issues.first,
      'Nhà tắm chưa được vệ sinh như mô tả.',
      [snapshot.config.sampleImages.first],
    );
    expect((await repo.load()).task(id).status, TaskStatus.disputed);
    expect((await repo.load()).complaints.first.id, issue);
    expect((await repo.load()).complaints.first.evidence.length, 1);
    await expectLater(
      repo.pay(id, snapshot.methods.first.id),
      throwsA(isA<RepositoryFailure>()),
    );
  });
  test(
    'cancel, invalid progression, OTP expiry and missing fields are rejected',
    () async {
      final id = await create();
      await repo.cancel(id, 'Thay đổi kế hoạch');
      expect((await repo.load()).task(id).status, TaskStatus.cancelled);
      await expectLater(repo.advance(id), throwsA(isA<RepositoryFailure>()));
      final draft = await repo.newDraft();
      await expectLater(
        repo.post(draft, 'invalid'),
        throwsA(isA<RepositoryFailure>()),
      );
      await repo.sendOtp((await repo.load()).config.phone);
      await expectLater(
        repo.verifyOtp('000000'),
        throwsA(isA<RepositoryFailure>()),
      );
      repo.store.otpExpires = DateTime.now().subtract(
        const Duration(seconds: 1),
      );
      await expectLater(
        repo.verifyOtp((await repo.load()).config.otp),
        throwsA(isA<RepositoryFailure>()),
      );
    },
  );
  test(
    'address and profile mutations propagate without changing booked task',
    () async {
      final oldTask = (await repo.load()).tasks.first;
      await repo.saveAddress(
        const Address(
          'home',
          'Nhà mới',
          '99 Đường mới, Thủ Đức',
          'Gọi trước',
          isDefault: true,
        ),
      );
      await repo.saveProfile(
        'Khách hàng mới',
        '0900000001',
        'customer@example.test',
      );
      final snapshot = await repo.load();
      expect(snapshot.addresses.where((a) => a.isDefault).length, 1);
      expect(snapshot.profile.name, 'Khách hàng mới');
      expect(
        snapshot.task(oldTask.id).draft.address.detail,
        oldTask.draft.address.detail,
      );
      await repo.deleteAddress('home');
      expect((await repo.load()).addresses.first.isDefault, isTrue);
    },
  );
}
