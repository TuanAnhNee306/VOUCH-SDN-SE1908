import 'dart:async';

import 'package:flutter/foundation.dart';

import '../domain/repository_updates.dart';

import '../domain/models.dart';
import '../domain/tasker_models.dart';
import '../domain/tasker_repositories.dart';

enum TaskerPage {
  splash,
  login,
  home,
  map,
  jobs,
  jobDetail,
  accept,
  active,
  onTheWay,
  arrived,
  start,
  inProgress,
  complete,
  waitingPayment,
  rating,
  ratingSuccess,
  wallet,
  transactions,
  withdraw,
  withdrawResult,
  profile,
  services,
  verification,
  messages,
  chat,
  notifications,
  settings,
  filters,
  availability,
  deposit,
  reviews,
  help,
  report,
}

class TaskerLocation {
  const TaskerLocation(this.page, {this.id});
  final TaskerPage page;
  final String? id;
}

class TaskerController extends ChangeNotifier {
  TaskerController(this.repository, {this.demoMode = false}) {
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
      _stack
        ..clear()
        ..add(const TaskerLocation(TaskerPage.splash));
      _checklists.clear();
      completionImages.clear();
      ratingTags.clear();
    }
    _generation = snapshot.sessionGeneration;
    data = snapshot;
    if (route.id?.startsWith('TL-') == true &&
        ![
          ...snapshot.availableJobs,
          ...snapshot.myJobs,
        ].any((t) => t.id == route.id)) {
      root(TaskerPage.home);
    }
    changed();
  }

  String filterService = '', reportIssue = '', reportNote = '';
  int minEarning = 0;
  double maxDistance = 20;
  bool todayOnly = false, acceptConsent = false;
  final Set<String> ratingTags = {}, reportEvidence = {};
  final Set<int> selectedSlots = {};
  final Map<String, Set<int>> _checklists = {};
  Set<int> checklistFor(String id) => _checklists.putIfAbsent(id, () => {});
  List<CustomerTask> get filteredJobs => data!.availableJobs.where((j) {
    final date = j.draft.scheduledAt;
    final now = DateTime.now();
    return data!.profile.online &&
        data!.profile.serviceIds.contains(j.draft.serviceId) &&
        (filterService.isEmpty || j.draft.serviceId == filterService) &&
        j.distanceKm <= maxDistance &&
        j.distanceKm <= data!.profile.radius &&
        j.price.taskerEarning >= minEarning &&
        (!todayOnly ||
            (date.year == now.year &&
                date.month == now.month &&
                date.day == now.day));
  }).toList();
  void chatFor(String taskId) {
    final chat = data!.conversations
        .where((c) => c.taskId == taskId)
        .firstOrNull;
    if (chat != null) open(TaskerPage.chat, id: chat.id);
  }

  final TaskerRepository repository;
  final bool demoMode;
  final List<TaskerLocation> _stack = [const TaskerLocation(TaskerPage.splash)];
  TaskerSnapshot? data;
  TaskerLocation get route => _stack.last;
  bool get canBack => _stack.length > 1;
  bool busy = false;
  String? error;
  String chatInput = '', completionNote = '', ratingComment = '';
  int ratingStars = 0, jobFilter = 0, selectedRadius = 10, withdrawalAmount = 0;
  bool instantWithdrawal = false;
  final Set<String> completionImages = {}, selectedServices = {};
  bool _disposed = false;

  void changed() {
    if (!_disposed) notifyListeners();
  }

  void open(TaskerPage page, {String? id}) {
    error = null;
    _stack.add(TaskerLocation(page, id: id));
    changed();
  }

  void replace(TaskerPage page, {String? id}) {
    error = null;
    _stack[_stack.length - 1] = TaskerLocation(page, id: id);
    changed();
  }

  void root(TaskerPage page) {
    error = null;
    _stack
      ..clear()
      ..add(TaskerLocation(page));
    changed();
  }

  void jobRoot(String id) {
    error = null;
    _stack
      ..clear()
      ..add(const TaskerLocation(TaskerPage.jobs))
      ..add(TaskerLocation(TaskerPage.active, id: id));
    changed();
  }

  void back() {
    if (busy) return;
    error = null;
    if (canBack) {
      _stack.removeLast();
    } else {
      root(TaskerPage.home);
    }
    changed();
  }

  Future<bool> run(Future<void> Function() action) async {
    if (busy) return false;
    busy = true;
    error = null;
    changed();
    try {
      await action();
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
  });
  Future<void> login() async {
    if (await run(repository.loginDemo)) root(TaskerPage.home);
  }

  Future<void> setOnline(bool value) => run(() => repository.setOnline(value));
  Future<void> accept(String id) async {
    if (await run(() => repository.accept(id))) {
      _stack
        ..clear()
        ..add(const TaskerLocation(TaskerPage.jobs))
        ..add(TaskerLocation(TaskerPage.active, id: id));
      changed();
    }
  }

  Future<void> advance(String id) => run(() => repository.advance(id));
  void beginCompletion(String id) {
    completionImages.clear();
    completionNote = '';
    open(TaskerPage.complete, id: id);
  }

  Future<void> submitCompletion(String id) async {
    if (await run(
      () => repository.submitCompletion(
        id,
        completionImages.toList(),
        completionNote,
      ),
    )) {
      replace(TaskerPage.waitingPayment, id: id);
    }
  }

  void beginRating(String id) {
    ratingStars = 0;
    ratingComment = '';
    ratingTags.clear();
    replace(TaskerPage.rating, id: id);
  }

  Future<void> rate(String id) async {
    if (await run(
      () => repository.rateCustomer(
        id,
        ratingStars,
        ratingComment,
        tags: ratingTags.toList(),
      ),
    )) {
      replace(TaskerPage.ratingSuccess, id: id);
    }
  }

  void startServices() {
    selectedServices
      ..clear()
      ..addAll(data!.profile.serviceIds);
    selectedRadius = data!.profile.radius;
    open(TaskerPage.services);
  }

  Future<void> saveServices() async {
    if (await run(
      () =>
          repository.updateServices(selectedServices.toList(), selectedRadius),
    )) {
      back();
    }
  }

  Future<void> withdraw() async {
    if (await run(
      () => repository.withdraw(withdrawalAmount, instantWithdrawal),
    )) {
      replace(TaskerPage.withdrawResult);
    }
  }

  Future<void> sendMessage(String id) async {
    if (await run(() => repository.sendMessage(id, chatInput))) {
      chatInput = '';
      changed();
    }
  }

  Future<void> readNotification(AppNotification item) async {
    await run(() => repository.readNotification(item.id));
    if (item.id.startsWith('MSG-')) {
      chatFor(item.taskId);
      return;
    }
    if (data!.availableJobs.any((j) => j.id == item.taskId)) {
      open(TaskerPage.jobDetail, id: item.taskId);
    } else if (data!.myJobs.any((j) => j.id == item.taskId)) {
      jobRoot(item.taskId);
    } else {
      root(TaskerPage.home);
    }
  }

  Future<void> verify(VerificationStatus next) =>
      run(() => repository.verify(next));
  Future<void> deposit(DepositStatus next) =>
      run(() => repository.updateDeposit(next));
  void startAvailability() {
    selectedSlots
      ..clear()
      ..addAll(data!.availability);
    open(TaskerPage.availability);
  }

  Future<void> saveAvailability() async {
    if (await run(() => repository.updateAvailability(selectedSlots))) back();
  }

  void startReport(String id) {
    reportNote = '';
    reportEvidence.clear();
    reportIssue = data!.config.issues.first;
    open(TaskerPage.report, id: id);
  }

  Future<void> report(String id) async {
    if (await run(
      () => repository.report(
        id,
        reportIssue,
        reportNote,
        reportEvidence.toList(),
      ),
    )) {
      jobRoot(id);
    }
  }

  Future<void> setNotifications(bool value) =>
      run(() => repository.setNotifications(value));
  Future<void> reset() async {
    await run(repository.reset);
    root(TaskerPage.splash);
  }

  @override
  void dispose() {
    _subscription?.cancel();
    _disposed = true;
    super.dispose();
  }
}
