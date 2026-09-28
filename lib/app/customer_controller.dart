import 'dart:async';

import 'package:flutter/foundation.dart';

import '../domain/repository_updates.dart';

import '../domain/models.dart';
import '../domain/repositories.dart';

enum PageId {
  splash,
  onboarding,
  login,
  register,
  recovery,
  otp,
  locationPermission,
  home,
  services,
  serviceDetail,
  create,
  ai,
  recommendations,
  tasker,
  matched,
  tasks,
  task,
  tracking,
  payment,
  paymentSuccess,
  rating,
  ratingSuccess,
  messages,
  chat,
  notifications,
  profile,
  editProfile,
  addresses,
  paymentMethods,
  reviews,
  settings,
  help,
  support,
  complaint,
  complaintStatus,
}

class AppLocation {
  const AppLocation(this.page, {this.id, this.extra});
  final PageId page;
  final String? id, extra;
}

class CustomerController extends ChangeNotifier {
  CustomerController(
    this.repository, {
    this.demoControls,
    this.demoMode = false,
  }) {
    if (repository is RepositoryUpdates) {
      _subscription = (repository as RepositoryUpdates).changes.listen(
        (_) => refresh(),
      );
    }
  }
  StreamSubscription<void>? _subscription;
  int? _generation;
  Future<void> refresh() async {
    final snapshot = await repository.load();
    if (_disposed) return;
    if (_generation != null && _generation != snapshot.sessionGeneration) {
      draft = null;
      aiDraft = null;
      recommendations = [];
      checkedItems.clear();
      _stack
        ..clear()
        ..add(const AppLocation(PageId.splash));
    }
    _generation = snapshot.sessionGeneration;
    data = snapshot;
    if ({PageId.recommendations, PageId.tasker}.contains(route.page)) {
      final task = snapshot.tasks.where((t) => t.id == route.id).firstOrNull;
      if (task?.taskerId != null) {
        taskRoot(task!.id);
        return;
      }
    }
    if (route.id?.startsWith('TL-') == true &&
        !snapshot.tasks.any((t) => t.id == route.id)) {
      root(PageId.home);
    }
    changed();
  }

  final CustomerRepository repository;
  final DemoControls? demoControls;
  final bool demoMode;
  CustomerSnapshot? data;
  final List<AppLocation> _stack = [const AppLocation(PageId.splash)];
  AppLocation get route => _stack.last;
  bool get canBack => _stack.length > 1;
  bool busy = false;
  String? error;
  String phone = '',
      otp = '',
      registrationName = '',
      aiInput = '',
      messageInput = '';
  String profileName = '', profilePhone = '', profileEmail = '';
  String complaintIssue = '', complaintText = '', ratingComment = '';
  List<String> complaintEvidence = [];
  int ratingStars = 0;
  final Map<String, int> categoryRatings = {};
  final Set<String> reviewTags = {};
  final Set<int> checkedItems = {};
  int wizardStep = 0, taskFilter = 0;
  String search = '', conversationSearch = '';
  String paymentMethodId = '';
  TaskDraft? draft, aiDraft;
  PriceBreakdown? draftQuote;
  PriceSuggestion? suggestion;
  List<Tasker> recommendations = [];
  String _postRequestId = '';
  bool _disposed = false;

  void changed() {
    if (!_disposed) {
      notifyListeners();
    }
  }

  void open(PageId page, {String? id, String? extra}) {
    error = null;
    _stack.add(AppLocation(page, id: id, extra: extra));
    changed();
  }

  void replace(PageId page, {String? id, String? extra}) {
    error = null;
    _stack[_stack.length - 1] = AppLocation(page, id: id, extra: extra);
    changed();
  }

  void root(PageId page) {
    error = null;
    _stack
      ..clear()
      ..add(AppLocation(page));
    changed();
  }

  void taskRoot(String id) {
    error = null;
    _stack
      ..clear()
      ..add(const AppLocation(PageId.tasks))
      ..add(AppLocation(PageId.task, id: id));
    changed();
  }

  void back() {
    if (busy) {
      return;
    }
    error = null;
    if (canBack) {
      _stack.removeLast();
    } else {
      root(PageId.home);
    }
    changed();
  }

  Future<bool> run(Future<void> Function() operation) async {
    if (busy) {
      return false;
    }
    busy = true;
    error = null;
    changed();
    try {
      await operation();
      data = await repository.load();
      return true;
    } on RepositoryFailure catch (e) {
      error = e.message;
      data = await repository.load();
      return false;
    } catch (_) {
      error = 'Không thể hoàn tất thao tác. Vui lòng thử lại.';
      return false;
    } finally {
      _generation ??= data?.sessionGeneration;
      busy = false;
      changed();
    }
  }

  Future<void> initialize() => run(() async {
    data = await repository.load();
  }).then((_) {});
  Future<void> sendOtp() async {
    if (await run(() => repository.sendOtp(phone))) {
      open(PageId.otp);
    }
  }

  Future<void> resendOtp() async {
    await run(() => repository.sendOtp(phone));
  }

  Future<void> verifyOtp() async {
    if (await run(() async {
      await repository.verifyOtp(otp);
      if (registrationName.trim().isNotEmpty) {
        await repository.saveProfile(
          registrationName,
          phone,
          data!.profile.email,
        );
      }
    })) {
      replace(PageId.locationPermission);
    }
  }

  Future<void> logout() async {
    if (await run(repository.signOut)) {
      draft = null;
      draftQuote = null;
      aiDraft = null;
      otp = '';
      phone = '';
      registrationName = '';
      messageInput = '';
      root(PageId.login);
    }
  }

  Future<void> startCreate({String? serviceId, CustomerTask? repeat}) async {
    await run(() async {
      draft ??= await repository.newDraft();
      if (repeat != null) {
        draft = repeat.draft.copy()
          ..scheduledAt = (await repository.newDraft()).scheduledAt;
      }
      if (serviceId != null) {
        draft!.serviceId = serviceId;
        draft!.labor = null;
      }
      _postRequestId = 'draft-${DateTime.now().microsecondsSinceEpoch}';
      await refreshQuote();
    });
    if (error == null) {
      wizardStep = 0;
      open(PageId.create);
    }
  }

  Future<void> refreshQuote() async {
    draftQuote = await repository.quote(draft!);
    suggestion = await repository.priceSuggestion(draft!);
    changed();
  }

  Future<void> updateDraft(void Function(TaskDraft) change) async {
    change(draft!);
    await refreshQuote();
  }

  void previousStep() {
    if (wizardStep > 0) {
      wizardStep--;
      error = null;
      changed();
    } else {
      back();
    }
  }

  void nextStep() {
    final d = draft!;
    if (wizardStep == 1 &&
        (d.address.detail.trim().length < 8 ||
            ({'moving', 'delivery'}.contains(d.serviceId) &&
                d.destination.trim().length < 8))) {
      error = 'Nhập địa chỉ đầy đủ và điểm đến nếu cần.';
    } else if (wizardStep == 2 && !d.scheduledAt.isAfter(DateTime.now())) {
      error = 'Vui lòng chọn thời gian trong tương lai.';
    } else if (wizardStep == 3 && d.description.trim().length < 10) {
      error = 'Mô tả công việc ít nhất 10 ký tự.';
    } else if (wizardStep == 5 &&
        !data!.methods.any((m) => m.id == d.paymentMethodId)) {
      error = 'Chọn phương thức thanh toán.';
    } else {
      error = null;
      wizardStep++;
    }
    changed();
  }

  Future<void> generateAi() async {
    await run(() async {
      aiDraft = await repository.suggestDraft(aiInput);
    });
  }

  Future<void> applyAi() async {
    draft = aiDraft!.copy();
    aiDraft = null;
    _postRequestId = 'draft-${DateTime.now().microsecondsSinceEpoch}';
    await refreshQuote();
    wizardStep = 1;
    replace(PageId.create);
  }

  Future<void> post() async {
    String? id;
    if (await run(() async {
      id = await repository.post(draft!, _postRequestId);
    })) {
      draft = null;
      draftQuote = null;
      _stack
        ..clear()
        ..add(const AppLocation(PageId.tasks))
        ..add(AppLocation(PageId.recommendations, id: id));
      recommendations = [];
      changed();
      await findTaskers(id!);
    }
  }

  Future<void> findTaskers(String id) async {
    await run(() async {
      recommendations = await repository.findTaskers(id);
    });
  }

  Future<void> selectTasker(String taskId, String taskerId) async {
    if (await run(() => repository.match(taskId, taskerId))) {
      _stack
        ..clear()
        ..add(const AppLocation(PageId.tasks))
        ..add(AppLocation(PageId.matched, id: taskId));
      changed();
    }
  }

  Future<void> advance(String id) async {
    if (demoMode && demoControls != null) {
      await run(() => demoControls!.advance(id));
    }
  }

  Future<void> cancel(String id, String reason) async {
    await run(() => repository.cancel(id, reason));
  }

  Future<bool> reschedule(String id, DateTime time) =>
      run(() => repository.reschedule(id, time));
  Future<bool> setDefaultAddress(String id) =>
      run(() => repository.setDefaultAddress(id));
  Future<bool> deleteAddress(String id) =>
      run(() => repository.deleteAddress(id));
  Future<bool> saveAddress(Address address) =>
      run(() => repository.saveAddress(address));
  Future<bool> removePaymentMethod(String id) =>
      run(() => repository.removePaymentMethod(id));
  Future<bool> addPaymentMethod(String name, String detail) =>
      run(() => repository.addPaymentMethod(name, detail));
  Future<bool> setNotifications(bool enabled) =>
      run(() => repository.setNotifications(enabled));

  Future<void> pay(String id) async {
    if (await run(() => repository.pay(id, paymentMethodId))) {
      replace(PageId.paymentSuccess, id: id);
    }
  }

  Future<void> rate(String id) async {
    if (await run(
      () => repository.rate(
        id,
        ratingStars,
        ratingComment,
        categories: categoryRatings,
        tags: reviewTags.toList(),
      ),
    )) {
      replace(PageId.ratingSuccess, id: id);
    }
  }

  void startRating(String id) {
    ratingStars = 0;
    ratingComment = '';
    categoryRatings.clear();
    reviewTags.clear();
    replace(PageId.rating, id: id);
  }

  Future<void> chatFor(String taskId) async {
    final chat = data!.conversations
        .where((c) => c.taskId == taskId)
        .firstOrNull;
    if (chat == null) {
      error = 'Chat sẽ mở sau khi ghép Tasker.';
      changed();
      return;
    }
    await run(() => repository.readConversation(chat.id));
    messageInput = '';
    open(PageId.chat, id: chat.id);
  }

  Future<void> sendMessage(String id) async {
    if (await run(() => repository.sendMessage(id, messageInput))) {
      messageInput = '';
      changed();
    }
  }

  Future<void> readNotification(AppNotification notification) async {
    await run(() => repository.readNotification(notification.id));
    if (notification.complaintId != null) {
      open(PageId.complaintStatus, id: notification.complaintId);
    } else {
      open(PageId.task, id: notification.taskId);
    }
  }

  void editProfile() {
    final p = data!.profile;
    profileName = p.name;
    profilePhone = p.phone;
    profileEmail = p.email;
    open(PageId.editProfile);
  }

  Future<void> saveProfile() async {
    if (await run(
      () => repository.saveProfile(profileName, profilePhone, profileEmail),
    )) {
      back();
    }
  }

  void startComplaint(String id) {
    complaintIssue = data!.config.issues.first;
    complaintText = '';
    complaintEvidence = [];
    open(PageId.complaint, id: id);
  }

  Future<void> submitComplaint(String taskId) async {
    String? id;
    if (await run(() async {
      id = await repository.submitComplaint(
        taskId,
        complaintIssue,
        complaintText,
        complaintEvidence,
      );
    })) {
      replace(PageId.complaintStatus, id: id);
    }
  }

  Future<void> resetDemo() async {
    if (!demoMode || demoControls == null) {
      return;
    }
    await run(demoControls!.reset);
    draft = null;
    aiDraft = null;
    phone = '';
    otp = '';
    root(PageId.splash);
  }

  @override
  void dispose() {
    _subscription?.cancel();
    _disposed = true;
    super.dispose();
  }
}
