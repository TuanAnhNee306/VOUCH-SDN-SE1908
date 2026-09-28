import '../../domain/models.dart';
import '../../domain/repository_updates.dart';
import '../../domain/repositories.dart';
import '../../domain/task_policy.dart';
import 'mock_data_store.dart';

class MockCustomerRepository
    implements CustomerRepository, DemoControls, RepositoryUpdates {
  MockCustomerRepository({
    MockDataStore? store,
    this.latency = const Duration(milliseconds: 280),
  }) : store = store ?? MockDataStore();
  final MockDataStore store;
  final Duration latency;
  @override
  Stream<void> get changes => store.changes;
  Future<void> _wait() async {
    if (latency > Duration.zero) {
      await Future<void>.delayed(latency);
    }
    if (store.requestFails) {
      store.requestFails = false;
      throw const RepositoryFailure(
        'Kết nối mô phỏng bị gián đoạn. Hãy thử lại.',
      );
    }
  }

  void _requireSession() {
    if (!store.authenticated) {
      throw const RepositoryFailure('Vui lòng đăng nhập.');
    }
  }

  CustomerTask _task(String id) => store.tasks.firstWhere(
    (t) => t.id == id,
    orElse: () => throw const RepositoryFailure('Không tìm thấy công việc.'),
  );
  void _save(CustomerTask task) {
    final i = store.tasks.indexWhere((t) => t.id == task.id);
    store.tasks[i] = task;
    store.changed();
  }

  void _transition(CustomerTask task, TaskStatus next) {
    _save(
      task.update(
        status: next,
        timeline: [...task.timeline, TaskEvent(next, DateTime.now())],
      ),
    );
  }

  void _notify(String title, String taskId, {String? complaintId}) {
    store.taskerNotifications.insert(
      0,
      AppNotification('TN-${store.sequence++}', title, taskId, DateTime.now()),
    );
    store.changed();
    store.notifications.insert(
      0,
      AppNotification(
        'N-${store.sequence++}',
        title,
        taskId,
        DateTime.now(),
        complaintId: complaintId,
      ),
    );
  }

  @override
  Future<CustomerSnapshot> load() async => store.snapshot();
  @override
  Future<void> sendOtp(String phone) async {
    await _wait();
    if (!RegExp(r'^0[0-9]{9}$').hasMatch(phone)) {
      throw const RepositoryFailure(
        'Nhập số điện thoại gồm 10 chữ số, bắt đầu bằng 0.',
      );
    }
    store.phoneChallenge = phone;
    store.otpExpires = DateTime.now().add(const Duration(minutes: 3));
  }

  @override
  Future<void> verifyOtp(String code) async {
    await _wait();
    if (store.otpExpires == null || DateTime.now().isAfter(store.otpExpires!)) {
      throw const RepositoryFailure('Mã OTP đã hết hạn. Vui lòng gửi lại mã.');
    }
    if (code != MockDataStore.config.otp) {
      throw const RepositoryFailure('Mã OTP chưa đúng. Vui lòng thử lại.');
    }
    store.authenticated = true;
    store.profile = Profile(
      store.profile.name,
      store.phoneChallenge!,
      store.profile.email,
      store.profile.avatar,
    );
    store.otpExpires = null;
  }

  @override
  Future<void> signOut() async {
    store.authenticated = false;
    store.otpExpires = null;
  }

  @override
  Future<TaskDraft> newDraft() async {
    final now = DateTime.now();
    return TaskDraft(
      serviceId: MockDataStore.services.first.id,
      address: store.addresses.isEmpty
          ? const Address('', 'Địa chỉ mới', '', '')
          : store.addresses.firstWhere(
              (a) => a.isDefault,
              orElse: () => store.addresses.first,
            ),
      scheduledAt: DateTime(now.year, now.month, now.day + 1, 15),
      paymentMethodId: store.methods.isEmpty ? '' : store.methods.first.id,
    );
  }

  @override
  Future<PriceBreakdown> quote(TaskDraft draft) async {
    final service = MockDataStore.services.firstWhere(
      (s) => s.id == draft.serviceId,
    );
    return PriceBreakdown(
      labor: draft.labor ?? service.hourlyRate * draft.duration,
      platformFeePercent: MockDataStore.config.platformFeePercent,
      equipment: draft.equipment ? MockDataStore.config.equipmentFee : 0,
      protection: draft.protection ? MockDataStore.config.protectionFee : 0,
    );
  }

  @override
  Future<PriceSuggestion> priceSuggestion(TaskDraft draft) async {
    final rate =
        MockDataStore.services
            .firstWhere((s) => s.id == draft.serviceId)
            .hourlyRate *
        draft.duration;
    return PriceSuggestion((rate * .9).round(), rate, (rate * 1.1).round());
  }

  @override
  Future<TaskDraft> suggestDraft(String prompt) async {
    await _wait();
    if (prompt.trim().length < 8) {
      throw const RepositoryFailure(
        'Hãy mô tả yêu cầu rõ hơn để tạo bản nháp.',
      );
    }
    final draft = await newDraft();
    draft.description = 'Dọn phòng trọ: quét lau sàn, vệ sinh nhà tắm, lau bàn học. Kiểm tra lại địa chỉ và lịch trước khi đăng.';
    return draft;
  }

  void _validateDraft(TaskDraft draft) {
    if (draft.address.detail.trim().length < 8 ||
        draft.description.trim().length < 10 ||
        draft.duration < 1 ||
        draft.duration > 8 ||
        !draft.scheduledAt.isAfter(DateTime.now()) ||
        (draft.labor != null && draft.labor! <= 0)) {
      throw const RepositoryFailure(
        'Kiểm tra địa chỉ, mô tả (ít nhất 10 ký tự), thời lượng và thời gian trong tương lai.',
      );
    }
    if ({'moving', 'delivery'}.contains(draft.serviceId) &&
        draft.destination.trim().length < 8) {
      throw const RepositoryFailure('Vui lòng bổ sung địa chỉ điểm đến.');
    }
    if (!store.methods.any((m) => m.id == draft.paymentMethodId)) {
      throw const RepositoryFailure('Vui lòng chọn phương thức thanh toán.');
    }
  }

  @override
  Future<String> post(TaskDraft draft, String requestId) async {
    await _wait();
    _requireSession();
    if (store.postedRequests.containsKey(requestId)) {
      return store.postedRequests[requestId]!;
    }
    _validateDraft(draft);
    final price = await quote(draft);
    final id = 'TL-${store.sequence++}';
    store.tasks.insert(
      0,
      CustomerTask(
        id: id,
        draft: draft.copy(),
        price: price,
        status: TaskStatus.posted,
        timeline: [TaskEvent(TaskStatus.posted, DateTime.now())],
      ),
    );
    store.postedRequests[requestId] = id;
    _notify('Đã đăng công việc của bạn', id);
    return id;
  }

  @override
  Future<List<Tasker>> findTaskers(String taskId) async {
    await _wait();
    _requireSession();
    final task = _task(taskId);
    if (task.status == TaskStatus.posted) {
      _transition(task, TaskStatus.matching);
    } else if (task.status != TaskStatus.matching) {
      throw const RepositoryFailure(
        'Công việc không còn ở trạng thái tìm người.',
      );
    }
    if (store.matchesEmpty) {
      store.matchesEmpty = false;
      return [];
    }
    return List.of(MockDataStore.taskers)
      ..sort((a, b) => b.match.compareTo(a.match));
  }

  @override
  Future<void> match(String taskId, String taskerId) async {
    await _wait();
    _requireSession();
    final task = _task(taskId);
    if (task.taskerId == taskerId) {
      return;
    }
    if (task.status != TaskStatus.matching ||
        !MockDataStore.taskers.any((t) => t.id == taskerId)) {
      throw const RepositoryFailure('Không thể ghép Tasker ở trạng thái này.');
    }
    store.assign(taskId, taskerId);
  }

  @override
  Future<void> advance(String taskId) async {
    await _wait();
    _requireSession();
    store.progress(taskId);
  }

  @override
  Future<void> cancel(String taskId, String reason) async {
    await _wait();
    _requireSession();
    final task = _task(taskId);
    if (!TaskPolicy.cancellable.contains(task.status)) {
      throw const RepositoryFailure(
        'Không thể hủy lúc này. Hãy gửi yêu cầu hỗ trợ.',
      );
    }
    if (reason.trim().isEmpty) {
      throw const RepositoryFailure('Vui lòng nhập lý do hủy.');
    }
    _save(task.update(cancelReason: reason));
    _transition(_task(taskId), TaskStatus.cancelled);
    _notify('Công việc đã hủy • chưa thu tiền', taskId);
  }

  @override
  Future<void> reschedule(String taskId, DateTime time) async {
    await _wait();
    _requireSession();
    final task = _task(taskId);
    if (!TaskPolicy.canReschedule(task) || !time.isAfter(DateTime.now())) {
      throw const RepositoryFailure(
        'Chọn lịch tương lai trước khi Tasker đến.',
      );
    }
    final draft = task.draft.copy()..scheduledAt = time;
    _save(task.update(draft: draft));
    _notify('Lịch thực hiện đã thay đổi', taskId);
  }

  @override
  Future<void> pay(String taskId, String methodId) async {
    await _wait();
    _requireSession();
    final task = _task(taskId);
    if (task.paymentStatus == PaymentStatus.paid) {
      return;
    }
    if (!TaskPolicy.canPay(task)) {
      throw const RepositoryFailure(
        'Chỉ thanh toán khi công việc đã hoàn tất và không có tranh chấp.',
      );
    }
    if (!store.methods.any((m) => m.id == methodId)) {
      throw const RepositoryFailure(
        'Vui lòng chọn phương thức thanh toán hợp lệ.',
      );
    }
    if (store.paymentFails) {
      store.paymentFails = false;
      _save(task.update(paymentStatus: PaymentStatus.failed));
      throw const RepositoryFailure(
        'Thanh toán mô phỏng thất bại. Chưa trừ tiền; bạn có thể thử lại.',
      );
    }
    _save(
      task.update(
        paymentStatus: PaymentStatus.paid,
        receipt: 'DEMO-$taskId',
        draft: task.draft.copy()..paymentMethodId = methodId,
      ),
    );
    _transition(_task(taskId), TaskStatus.paid);
    _notify('Thanh toán thành công', taskId);
  }

  @override
  Future<void> rate(
    String taskId,
    int stars,
    String comment, {
    Map<String, int> categories = const {},
    List<String> tags = const [],
  }) async {
    await _wait();
    _requireSession();
    final task = _task(taskId);
    if (task.review != null) {
      return;
    }
    if (!TaskPolicy.canRate(task) || stars < 1 || stars > 5) {
      throw const RepositoryFailure('Chọn từ 1 đến 5 sao sau khi thanh toán.');
    }
    if (categories.entries.any(
          (e) =>
              !MockDataStore.config.ratingCategories.contains(e.key) ||
              e.value < 1 ||
              e.value > 5,
        ) ||
        tags.any((tag) => !MockDataStore.config.reviewTags.contains(tag))) {
      throw const RepositoryFailure('Kiểm tra tiêu chí và nhãn đánh giá.');
    }
    _save(
      task.update(
        review: Review(
          taskId,
          stars,
          comment.trim(),
          DateTime.now(),
          reviewerId: task.customerId,
          revieweeId: task.taskerId!,
          categories: Map.unmodifiable(categories),
          tags: List.unmodifiable(tags),
        ),
      ),
    );
    _notify('Customer đã đánh giá công việc', taskId);
  }

  @override
  Future<void> saveProfile(String name, String phone, String email) async {
    await _wait();
    _requireSession();
    if (name.trim().length < 2 ||
        !RegExp(r'^0[0-9]{9}$').hasMatch(phone) ||
        (email.isNotEmpty && !email.contains('@'))) {
      throw const RepositoryFailure('Kiểm tra tên, số điện thoại và email.');
    }
    store.profile = Profile(
      name.trim(),
      phone,
      email.trim(),
      store.profile.avatar,
    );
  }

  @override
  Future<void> saveAddress(Address address) async {
    await _wait();
    _requireSession();
    if (address.label.trim().isEmpty || address.detail.trim().length < 8) {
      throw const RepositoryFailure('Nhập tên và địa chỉ chi tiết.');
    }
    final id = address.id.isEmpty ? 'A-${store.sequence++}' : address.id;
    final existingDefault = store.addresses.any(
      (a) => a.id == id && a.isDefault,
    );
    final saved = Address(
      id,
      address.label.trim(),
      address.detail.trim(),
      address.note.trim(),
      isDefault:
          store.addresses.isEmpty || existingDefault || address.isDefault,
    );
    store.addresses = [...store.addresses.where((a) => a.id != id), saved];
    if (saved.isDefault) {
      _defaultAddress(id);
    }
  }

  void _defaultAddress(String id) {
    store.addresses = store.addresses
        .map(
          (a) =>
              Address(a.id, a.label, a.detail, a.note, isDefault: a.id == id),
        )
        .toList();
  }

  @override
  Future<void> deleteAddress(String id) async {
    await _wait();
    _requireSession();
    store.addresses = store.addresses.where((a) => a.id != id).toList();
    if (store.addresses.isNotEmpty &&
        !store.addresses.any((a) => a.isDefault)) {
      _defaultAddress(store.addresses.first.id);
    }
  }

  @override
  Future<void> setDefaultAddress(String id) async {
    await _wait();
    _requireSession();
    _defaultAddress(id);
  }

  @override
  Future<void> addPaymentMethod(String name, String detail) async {
    await _wait();
    _requireSession();
    if (name.trim().isEmpty || detail.trim().isEmpty) {
      throw const RepositoryFailure(
        'Nhập tên và nhãn nhận diện phương thức demo.',
      );
    }
    store.methods = [
      ...store.methods,
      PaymentMethod('PM-${store.sequence++}', name.trim(), detail.trim()),
    ];
  }

  @override
  Future<void> removePaymentMethod(String id) async {
    await _wait();
    _requireSession();
    store.methods = store.methods.where((m) => m.id != id).toList();
  }

  @override
  Future<void> setNotifications(bool enabled) async {
    _requireSession();
    store.notificationEnabled = enabled;
  }

  @override
  Future<void> sendMessage(String conversationId, String text) async {
    await _wait();
    _requireSession();
    store.message(conversationId, text, fromCustomer: true);
  }

  @override
  Future<void> readConversation(String id) async {
    final i = store.conversations.indexWhere((c) => c.id == id);
    final c = store.conversations[i];
    store.conversations[i] = Conversation(
      c.id,
      c.taskId,
      c.taskerId,
      c.messages,
    );
  }

  @override
  Future<void> readNotification(String id) async {
    store.notifications = store.notifications
        .map(
          (n) => n.id == id
              ? AppNotification(
                  n.id,
                  n.title,
                  n.taskId,
                  n.at,
                  read: true,
                  complaintId: n.complaintId,
                )
              : n,
        )
        .toList();
  }

  @override
  Future<String> submitComplaint(
    String taskId,
    String issue,
    String description,
    List<String> evidence,
  ) async {
    await _wait();
    _requireSession();
    final task = _task(taskId);
    if (!TaskPolicy.reportable.contains(task.status)) {
      throw const RepositoryFailure(
        'Không thể mở khiếu nại mới cho trạng thái này.',
      );
    }
    if (!MockDataStore.config.issues.contains(issue) ||
        description.trim().length < 10) {
      throw const RepositoryFailure(
        'Chọn loại vấn đề và mô tả ít nhất 10 ký tự.',
      );
    }
    final id = 'KN-${store.sequence++}';
    store.complaints.insert(
      0,
      Complaint(
        id,
        taskId,
        issue,
        description.trim(),
        List.of(evidence),
        'Đang chờ xem xét',
        DateTime.now(),
      ),
    );
    _transition(task, TaskStatus.disputed);
    _notify('Đã tiếp nhận khiếu nại', taskId, complaintId: id);
    return id;
  }

  @override
  void failNextPayment() {
    store.paymentFails = true;
  }

  @override
  void noMatchesNextSearch() {
    store.matchesEmpty = true;
  }

  @override
  void failNextRequest() {
    store.requestFails = true;
  }

  @override
  Future<void> reset() async {
    store.reset();
  }
}
