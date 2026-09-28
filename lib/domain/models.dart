enum TaskStatus {
  draft,
  posted,
  matching,
  accepted,
  onTheWay,
  arrived,
  inProgress,
  completed,
  paid,
  cancelled,
  disputed,
  refunded,
}

enum PaymentStatus { unpaid, processing, failed, paid, refunded }

class Profile {
  const Profile(this.name, this.phone, this.email, this.avatar);
  final String name, phone, email, avatar;
}

class Address {
  const Address(
    this.id,
    this.label,
    this.detail,
    this.note, {
    this.isDefault = false,
  });
  final String id, label, detail, note;
  final bool isDefault;
}

class Service {
  const Service(
    this.id,
    this.name,
    this.subtitle,
    this.iconKey,
    this.hourlyRate,
    this.description,
    this.checklist,
  );
  final String id, name, subtitle, iconKey, description;
  final int hourlyRate;
  final List<String> checklist;
}

class Tasker {
  const Tasker(
    this.id,
    this.name,
    this.school,
    this.rating,
    this.jobs,
    this.distance,
    this.match,
    this.bio,
    this.avatar,
  );
  final String id, name, school, bio, avatar;
  final double rating, distance;
  final int jobs, match;
}

class PriceBreakdown {
  const PriceBreakdown({
    required this.labor,
    required this.equipment,
    required this.protection,
    this.platformFeePercent = 5,
  });
  final int labor, equipment, protection;
  final int platformFeePercent;
  int get platformFee => (labor * platformFeePercent / 100).round();
  int get taskerEarning => labor - platformFee + equipment;
  int get total => labor + equipment + protection;
}

class PriceSuggestion {
  const PriceSuggestion(this.minimum, this.recommended, this.maximum);
  final int minimum, recommended, maximum;
}

class PaymentMethod {
  const PaymentMethod(this.id, this.name, this.detail);
  final String id, name, detail;
}

class TaskDraft {
  TaskDraft({
    required this.serviceId,
    required this.address,
    required this.scheduledAt,
    this.duration = 2,
    this.description = '',
    List<String>? images,
    this.equipment = false,
    this.protection = true,
    this.paymentMethodId = '',
    this.labor,
    this.note = '',
    this.destination = '',
  }) : images = images ?? [];
  String serviceId, description, paymentMethodId, note, destination;
  Address address;
  DateTime scheduledAt;
  int duration;
  int? labor;
  List<String> images;
  bool equipment, protection;
  TaskDraft copy() => TaskDraft(
    serviceId: serviceId,
    address: address,
    scheduledAt: scheduledAt,
    duration: duration,
    description: description,
    images: List.of(images),
    equipment: equipment,
    protection: protection,
    paymentMethodId: paymentMethodId,
    labor: labor,
    note: note,
    destination: destination,
  );
}

class TaskEvent {
  const TaskEvent(this.status, this.at);
  final TaskStatus status;
  final DateTime at;
}

class CustomerTask {
  const CustomerTask({
    required this.id,
    required this.draft,
    required this.price,
    required this.status,
    required this.timeline,
    this.taskerId,
    this.paymentStatus = PaymentStatus.unpaid,
    this.receipt,
    this.review,
    this.taskerReview,
    this.cancelReason,
    this.customerId = 'customer-linh',
    this.distanceKm = 1.2,
    this.completionImages = const [],
    this.completionNote = '',
  });
  final String id;
  final String customerId, completionNote;
  final double distanceKm;
  final List<String> completionImages;
  DateTime? occurredAt(TaskStatus state) =>
      timeline.where((e) => e.status == state).firstOrNull?.at;
  DateTime? get createdAt => occurredAt(TaskStatus.posted);
  DateTime? get acceptedAt => occurredAt(TaskStatus.accepted);
  DateTime? get startedAt => occurredAt(TaskStatus.inProgress);
  DateTime? get completedAt => occurredAt(TaskStatus.completed);
  final TaskDraft draft;
  final PriceBreakdown price;
  final TaskStatus status;
  final List<TaskEvent> timeline;
  final String? taskerId, receipt, cancelReason;
  final PaymentStatus paymentStatus;
  final Review? review, taskerReview;
  CustomerTask update({
    TaskStatus? status,
    List<TaskEvent>? timeline,
    String? taskerId,
    PaymentStatus? paymentStatus,
    String? receipt,
    Review? review,
    Review? taskerReview,
    String? cancelReason,
    TaskDraft? draft,
    List<String>? completionImages,
    String? completionNote,
  }) => CustomerTask(
    id: id,
    customerId: customerId,
    distanceKm: distanceKm,
    completionImages: completionImages ?? this.completionImages,
    completionNote: completionNote ?? this.completionNote,
    draft: draft ?? this.draft,
    price: price,
    status: status ?? this.status,
    timeline: timeline ?? this.timeline,
    taskerId: taskerId ?? this.taskerId,
    paymentStatus: paymentStatus ?? this.paymentStatus,
    receipt: receipt ?? this.receipt,
    review: review ?? this.review,
    taskerReview: taskerReview ?? this.taskerReview,
    cancelReason: cancelReason ?? this.cancelReason,
  );
}

class Review {
  const Review(
    this.taskId,
    this.stars,
    this.comment,
    this.at, {
    this.categories = const {},
    this.tags = const [],
    this.reviewerId = 'customer-linh',
    this.revieweeId = 'minh-anh',
  });
  final String taskId, comment;
  final String reviewerId, revieweeId;
  final int stars;
  final DateTime at;
  final Map<String, int> categories;
  final List<String> tags;
}

class ChatMessage {
  const ChatMessage(this.id, this.text, this.mine, this.at);
  final String id, text;
  final bool mine;
  final DateTime at;
}

class Conversation {
  const Conversation(
    this.id,
    this.taskId,
    this.taskerId,
    this.messages, {
    this.unread = 0,
  });
  final String id, taskId, taskerId;
  final List<ChatMessage> messages;
  final int unread;
}

class AppNotification {
  const AppNotification(
    this.id,
    this.title,
    this.taskId,
    this.at, {
    this.read = false,
    this.complaintId,
  });
  final String id, title, taskId;
  final String? complaintId;
  final DateTime at;
  final bool read;
}

class Complaint {
  const Complaint(
    this.id,
    this.taskId,
    this.issue,
    this.description,
    this.evidence,
    this.status,
    this.createdAt,
  );
  final String id, taskId, issue, description, status;
  final List<String> evidence;
  final DateTime createdAt;
}

class DemoConfig {
  const DemoConfig({
    required this.phone,
    required this.otp,
    required this.aiExample,
    required this.equipmentFee,
    required this.protectionFee,
    required this.sampleImages,
    required this.issues,
    required this.help,
    required this.requirements,
    required this.mapDescription,
    required this.etaMinutes,
    required this.ratingCategories,
    required this.reviewTags,
    required this.routePoints,
    this.platformFeePercent = 5,
    this.openingWalletBalance = 1250000,
    this.instantWithdrawalRate = .005,
    this.trustDepositAmount = 500000,
    this.customerReviewTags = const [
      'Yêu cầu rõ ràng',
      'Hợp tác tốt',
      'Đúng hẹn',
    ],
  });
  final String phone, otp, aiExample, mapDescription;
  final int equipmentFee, protectionFee, etaMinutes;
  final int platformFeePercent, openingWalletBalance, trustDepositAmount;
  final double instantWithdrawalRate;
  final List<String> customerReviewTags;
  int withdrawalFee(int amount, bool instant) =>
      instant ? (amount * instantWithdrawalRate).round() : 0;
  final List<String> sampleImages, issues, requirements;
  final Map<String, String> help;
  final List<String> ratingCategories, reviewTags;
  final List<List<double>> routePoints;
}

class CustomerSnapshot {
  const CustomerSnapshot({
    required this.profile,
    required this.services,
    required this.addresses,
    required this.taskers,
    required this.tasks,
    required this.methods,
    required this.conversations,
    required this.notifications,
    required this.complaints,
    required this.config,
    required this.notificationEnabled,
    this.sessionGeneration = 0,
  });
  final Profile profile;
  final List<Service> services;
  final List<Address> addresses;
  final List<Tasker> taskers;
  final List<CustomerTask> tasks;
  final List<PaymentMethod> methods;
  final List<Conversation> conversations;
  final List<AppNotification> notifications;
  final List<Complaint> complaints;
  final DemoConfig config;
  final bool notificationEnabled;
  final int sessionGeneration;
  Service service(String id) => services.firstWhere((s) => s.id == id);
  Tasker tasker(String id) => taskers.firstWhere((t) => t.id == id);
  CustomerTask task(String id) => tasks.firstWhere((t) => t.id == id);
}

class RepositoryFailure implements Exception {
  const RepositoryFailure(this.message);
  final String message;
  @override
  String toString() => message;
}
