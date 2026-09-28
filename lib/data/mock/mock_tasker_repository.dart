import '../../domain/models.dart';
import '../../domain/repository_updates.dart';
import '../../domain/task_policy.dart';
import '../../domain/tasker_models.dart';
import '../../domain/tasker_repositories.dart';
import 'mock_data_store.dart';

/// Tasker projection over the Customer session. Tasks are never copied into a second store.
class MockTaskerRepository implements TaskerRepository, RepositoryUpdates {
  MockTaskerRepository({
    MockDataStore? store,
    this.latency = const Duration(milliseconds: 220),
    this.demoMode = true,
  }) : store = store ?? MockDataStore();
  final MockDataStore store;
  final Duration latency;
  final bool demoMode;
  @override
  Stream<void> get changes => store.changes;
  Future<void> _wait() => Future<void>.delayed(latency);
  void _login() {
    if (!store.taskerAuthenticated) {
      throw const RepositoryFailure('Vui lòng đăng nhập Tasker demo.');
    }
  }

  void _requireDemo() {
    if (!demoMode) {
      throw const RepositoryFailure('Chỉ khả dụng trong chế độ demo.');
    }
  }

  CustomerTask _owned(String id) {
    _login();
    final job = store.task(id);
    if (job.taskerId != 'minh-anh') {
      throw const RepositoryFailure('Bạn chưa nhận công việc này.');
    }
    return job;
  }

  List<CustomerTask> get _mine =>
      store.tasks.where((j) => j.taskerId == 'minh-anh').toList();
  int get _balance =>
      MockDataStore.config.openingWalletBalance +
      store.withdrawals.fold<int>(0, (sum, t) => sum + t.amount) +
      _mine
          .where((j) => j.paymentStatus == PaymentStatus.paid)
          .fold<int>(0, (sum, j) => sum + j.price.taskerEarning);
  @override
  Future<TaskerSnapshot> load() async {
    final earnings = _mine
        .where(
          (j) =>
              j.status == TaskStatus.completed ||
              j.paymentStatus == PaymentStatus.paid,
        )
        .map(
          (j) => WalletTransaction(
            'earning-${j.id}',
            'Thu nhập ${j.id}',
            j.price.taskerEarning,
            j.occurredAt(TaskStatus.paid) ?? j.completedAt ?? DateTime.now(),
            j.paymentStatus == PaymentStatus.paid
                ? 'Đã cộng ví'
                : 'Chờ Customer thanh toán',
            taskId: j.id,
            gross: j.price.labor + j.price.equipment,
            fee: j.price.platformFee,
            pending: j.paymentStatus != PaymentStatus.paid,
          ),
        )
        .toList();
    final transactions = [...earnings, ...store.withdrawals]
      ..sort((a, b) => b.at.compareTo(a.at));
    return TaskerSnapshot(
      sessionGeneration: store.generation,
      profile: store.taskerProfile,
      customer: store.profile,
      services: MockDataStore.services,
      availableJobs: List.unmodifiable(
        store.tasks.where(
          (j) =>
              j.taskerId == null &&
              {TaskStatus.posted, TaskStatus.matching}.contains(j.status),
        ),
      ),
      myJobs: List.unmodifiable(_mine),
      wallet: TaskerWallet(
        _balance,
        earnings
            .where((t) => t.pending)
            .fold<int>(0, (sum, t) => sum + t.amount),
        List.unmodifiable(transactions),
      ),
      notifications: List.unmodifiable(store.taskerNotifications),
      conversations: store.conversations
          .where((chat) => chat.taskerId == 'minh-anh')
          .map(
            (chat) => Conversation(
              chat.id,
              chat.taskId,
              chat.taskerId,
              chat.messages
                  .map((m) => ChatMessage(m.id, m.text, !m.mine, m.at))
                  .toList(),
              unread: chat.unread,
            ),
          )
          .toList(),
      completions: {
        for (final j in _mine.where((j) => j.completedAt != null))
          j.id: TaskCompletion(
            j.completionImages,
            j.completionNote,
            j.completedAt!,
          ),
      },
      config: MockDataStore.config,
      notificationEnabled: store.taskerNotificationsEnabled,
      customerRating: 4.9,
      platformFeePercent: MockDataStore.config.platformFeePercent,
      verification: store.verification,
      deposit: store.deposit,
      availability: Set.unmodifiable(store.availability),
      complaints: List.unmodifiable(store.complaints),
    );
  }

  @override
  Future<void> loginDemo() async {
    await _wait();
    _requireDemo();
    store.taskerAuthenticated = true;
    store.changed();
  }

  @override
  Future<void> setOnline(bool value) async {
    _login();
    store.taskerProfile = store.taskerProfile.copy(online: value);
    store.changed();
  }

  @override
  Future<void> accept(String taskId) async {
    await _wait();
    _login();
    if (!store.taskerProfile.online) {
      throw const RepositoryFailure('Bật Online trước khi nhận việc.');
    }
    store.assign(taskId, 'minh-anh');
  }

  @override
  Future<void> advance(String taskId) async {
    await _wait();
    final job = _owned(taskId);
    if (job.status == TaskStatus.inProgress) {
      throw const RepositoryFailure(
        'Gửi ảnh nghiệm thu để hoàn tất công việc.',
      );
    }
    store.progress(taskId);
  }

  @override
  Future<void> submitCompletion(
    String taskId,
    List<String> images,
    String note,
  ) async {
    await _wait();
    final job = _owned(taskId);
    if (job.status != TaskStatus.inProgress ||
        images.isEmpty ||
        images.any((i) => !MockDataStore.config.sampleImages.contains(i))) {
      throw const RepositoryFailure(
        'Thêm ảnh mẫu khi công việc đang thực hiện.',
      );
    }
    store.saveTask(
      job.update(
        completionImages: List.unmodifiable(images),
        completionNote: note.trim(),
      ),
    );
    store.progress(taskId);
  }

  @override
  Future<void> rateCustomer(
    String taskId,
    int stars,
    String comment, {
    List<String> tags = const [],
  }) async {
    await _wait();
    final job = _owned(taskId);
    if (job.status != TaskStatus.paid || stars < 1 || stars > 5) {
      throw const RepositoryFailure('Đánh giá từ 1–5 sao sau thanh toán.');
    }
    if (job.taskerReview != null) return;
    store.saveTask(
      job.update(
        taskerReview: Review(
          taskId,
          stars,
          comment.trim(),
          DateTime.now(),
          reviewerId: 'minh-anh',
          revieweeId: job.customerId,
          tags: List.unmodifiable(tags),
        ),
      ),
    );
    store.event('Có đánh giá mới từ Tasker', taskId);
  }

  @override
  Future<void> updateServices(List<String> ids, int radius) async {
    _login();
    if (ids.isEmpty ||
        ids.any((id) => !MockDataStore.services.any((s) => s.id == id)) ||
        radius < 1 ||
        radius > 20) {
      throw const RepositoryFailure('Chọn dịch vụ và bán kính hợp lệ.');
    }
    store.taskerProfile = store.taskerProfile.copy(
      serviceIds: List.of(ids),
      radius: radius,
    );
    store.changed();
  }

  @override
  Future<void> withdraw(int amount, bool instant) async {
    await _wait();
    _login();
    final fee = MockDataStore.config.withdrawalFee(amount, instant);
    // No await between balance check and reservation: concurrent requests cannot overspend.
    if (amount <= 0 || amount + fee > _balance) {
      throw const RepositoryFailure('Số tiền và phí vượt số dư có thể rút.');
    }
    store.withdrawals.insert(
      0,
      WalletTransaction(
        'W-${store.sequence++}',
        instant ? 'Rút nhanh demo' : 'Rút tiêu chuẩn demo',
        -(amount + fee),
        DateTime.now(),
        'Đang xử lý • đã giữ số dư',
        isWithdrawal: true,
        gross: amount,
        fee: fee,
      ),
    );
    store.changed();
  }

  @override
  Future<void> sendMessage(String id, String text) async {
    _login();
    final chat = store.conversations.firstWhere((c) => c.id == id);
    _owned(chat.taskId);
    store.message(id, text, fromCustomer: false);
  }

  @override
  Future<void> readNotification(String id) async {
    store.taskerNotifications = store.taskerNotifications
        .map(
          (n) => n.id == id
              ? AppNotification(n.id, n.title, n.taskId, n.at, read: true)
              : n,
        )
        .toList();
    store.changed();
  }

  @override
  Future<void> setNotifications(bool value) async {
    _login();
    store.taskerNotificationsEnabled = value;
    store.changed();
  }

  @override
  Future<void> updateAvailability(Set<int> slots) async {
    _login();
    if (slots.any((s) => s < 0 || s > 20)) {
      throw const RepositoryFailure('Ca làm không hợp lệ.');
    }
    store.availability = Set.of(slots);
    store.changed();
  }

  @override
  Future<void> verify(VerificationStatus next) async {
    _login();
    _requireDemo();
    final allowed = switch (store.verification) {
      VerificationStatus.notVerified ||
      VerificationStatus.rejected ||
      VerificationStatus.verified => {VerificationStatus.front},
      VerificationStatus.front => {VerificationStatus.back},
      VerificationStatus.back => {VerificationStatus.selfie},
      VerificationStatus.selfie => {VerificationStatus.pending},
      VerificationStatus.pending => {
        VerificationStatus.verified,
        VerificationStatus.rejected,
      },
    };
    if (!allowed.contains(next)) {
      throw const RepositoryFailure('Hoàn thành bước xác minh trước.');
    }
    store.verification = next;
    store.taskerProfile = store.taskerProfile.copy(
      verified: next == VerificationStatus.verified,
    );
    store.changed();
  }

  @override
  Future<void> updateDeposit(DepositStatus next) async {
    _login();
    _requireDemo();
    final allowed = switch (store.deposit) {
      DepositStatus.noDeposit ||
      DepositStatus.refunded => {DepositStatus.pending},
      DepositStatus.pending => {DepositStatus.active},
      DepositStatus.active => {DepositStatus.refundRequested},
      DepositStatus.refundRequested => {DepositStatus.refunded},
      DepositStatus.held => <DepositStatus>{},
    };
    if (!allowed.contains(next)) {
      throw const RepositoryFailure('Trạng thái tiền đảm bảo không hợp lệ.');
    }
    store.deposit = next;
    store.changed();
  }

  @override
  Future<void> report(
    String id,
    String issue,
    String note,
    List<String> evidence,
  ) async {
    final job = _owned(id);
    if (!TaskPolicy.reportable.contains(job.status) ||
        note.trim().length < 10 ||
        !MockDataStore.config.issues.contains(issue)) {
      throw const RepositoryFailure(
        'Chọn loại sự cố và mô tả ít nhất 10 ký tự.',
      );
    }
    store.complaints.insert(
      0,
      Complaint(
        'KN-${store.sequence++}',
        id,
        issue,
        note.trim(),
        List.of(evidence),
        'Đang chờ xem xét',
        DateTime.now(),
      ),
    );
    store.saveTask(
      job.update(
        status: TaskStatus.disputed,
        timeline: [
          ...job.timeline,
          TaskEvent(TaskStatus.disputed, DateTime.now()),
        ],
      ),
    );
    store.event('Đã nhận báo sự cố từ Tasker', id);
  }

  @override
  Future<void> reset() async {
    _requireDemo();
    store.reset();
  }
}
