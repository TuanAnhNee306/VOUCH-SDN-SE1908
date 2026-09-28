import 'models.dart';

abstract interface class AuthRepository {
  Future<void> sendOtp(String phone);
  Future<void> verifyOtp(String code);
  Future<void> signOut();
}

abstract interface class TaskRepository {
  Future<TaskDraft> newDraft();
  Future<PriceBreakdown> quote(TaskDraft draft);
  Future<PriceSuggestion> priceSuggestion(TaskDraft draft);
  Future<TaskDraft> suggestDraft(String prompt);
  Future<String> post(TaskDraft draft, String requestId);
  Future<List<Tasker>> findTaskers(String taskId);
  Future<void> match(String taskId, String taskerId);
  Future<void> cancel(String taskId, String reason);
  Future<void> reschedule(String taskId, DateTime time);
  Future<void> rate(
    String taskId,
    int stars,
    String comment, {
    Map<String, int> categories = const {},
    List<String> tags = const [],
  });
}

abstract interface class PaymentRepository {
  Future<void> pay(String taskId, String methodId);
  Future<void> addPaymentMethod(String name, String detail);
  Future<void> removePaymentMethod(String id);
}

abstract interface class UserRepository {
  Future<void> saveProfile(String name, String phone, String email);
  Future<void> saveAddress(Address address);
  Future<void> deleteAddress(String id);
  Future<void> setDefaultAddress(String id);
  Future<void> setNotifications(bool enabled);
}

abstract interface class MessageRepository {
  Future<void> sendMessage(String conversationId, String text);
  Future<void> readConversation(String id);
}

abstract interface class NotificationRepository {
  Future<void> readNotification(String id);
}

abstract interface class ComplaintRepository {
  Future<String> submitComplaint(
    String taskId,
    String issue,
    String description,
    List<String> evidence,
  );
}

// A small aggregate keeps composition simple while each feature retains a contract.
abstract interface class CustomerRepository
    implements
        AuthRepository,
        TaskRepository,
        PaymentRepository,
        UserRepository,
        MessageRepository,
        NotificationRepository,
        ComplaintRepository {
  Future<CustomerSnapshot> load();
}

// This separate capability is bound only in a demo build, never required by API UI.
abstract interface class DemoControls {
  Future<void> advance(String taskId);
  void failNextPayment();
  void noMatchesNextSearch();
  void failNextRequest();
  Future<void> reset();
}
