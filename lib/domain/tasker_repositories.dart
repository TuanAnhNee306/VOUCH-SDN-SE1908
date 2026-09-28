import 'tasker_models.dart';

abstract interface class TaskerRepository {
  Future<TaskerSnapshot> load();
  Future<void> loginDemo();
  Future<void> setOnline(bool online);
  Future<void> accept(String taskId);
  Future<void> advance(String taskId);
  Future<void> submitCompletion(
    String taskId,
    List<String> images,
    String note,
  );
  Future<void> rateCustomer(
    String taskId,
    int stars,
    String comment, {
    List<String> tags = const [],
  });
  Future<void> updateAvailability(Set<int> slots);
  Future<void> verify(VerificationStatus next);
  Future<void> updateDeposit(DepositStatus next);
  Future<void> report(
    String id,
    String issue,
    String note,
    List<String> evidence,
  );
  Future<void> updateServices(List<String> ids, int radius);
  Future<void> withdraw(int amount, bool instant);
  Future<void> sendMessage(String conversationId, String text);
  Future<void> readNotification(String id);
  Future<void> setNotifications(bool enabled);
  Future<void> reset();
}
