import 'models.dart';

enum VerificationStatus {
  notVerified,
  front,
  back,
  selfie,
  pending,
  verified,
  rejected,
}

enum DepositStatus {
  noDeposit,
  pending,
  active,
  refundRequested,
  refunded,
  held,
}

class TaskerProfile {
  const TaskerProfile({
    required this.profile,
    required this.rating,
    required this.completedJobs,
    required this.completionRate,
    required this.verified,
    required this.online,
    required this.serviceIds,
    required this.radius,
  });
  final Profile profile;
  final double rating, completionRate;
  final int completedJobs, radius;
  final bool verified, online;
  final List<String> serviceIds;
  TaskerProfile copy({
    bool? online,
    bool? verified,
    List<String>? serviceIds,
    int? radius,
  }) => TaskerProfile(
    profile: profile,
    rating: rating,
    completedJobs: completedJobs,
    completionRate: completionRate,
    verified: verified ?? this.verified,
    online: online ?? this.online,
    serviceIds: serviceIds ?? this.serviceIds,
    radius: radius ?? this.radius,
  );
}

class TaskerWallet {
  const TaskerWallet(this.available, this.pending, this.transactions);
  final int available, pending;
  final List<WalletTransaction> transactions;
}

class WalletTransaction {
  const WalletTransaction(
    this.id,
    this.title,
    this.amount,
    this.at,
    this.status, {
    this.isWithdrawal = false,
    this.taskId,
    this.gross = 0,
    this.fee = 0,
    this.pending = false,
  });
  final String id, title, status;
  final int amount;
  final DateTime at;
  final bool isWithdrawal;
  final String? taskId;
  final int gross, fee;
  final bool pending;
}

class TaskCompletion {
  const TaskCompletion(this.images, this.note, this.at);
  final List<String> images;
  final String note;
  final DateTime at;
}

class TaskerSnapshot {
  const TaskerSnapshot({
    required this.profile,
    required this.customer,
    required this.services,
    required this.availableJobs,
    required this.myJobs,
    required this.wallet,
    required this.notifications,
    required this.conversations,
    required this.completions,
    required this.config,
    required this.notificationEnabled,
    required this.customerRating,
    required this.platformFeePercent,
    this.verification = VerificationStatus.verified,
    this.deposit = DepositStatus.noDeposit,
    this.availability = const {},
    this.complaints = const [],
    this.sessionGeneration = 0,
  });
  final TaskerProfile profile;
  final Profile customer;
  final List<Service> services;
  final List<CustomerTask> availableJobs, myJobs;
  final TaskerWallet wallet;
  final List<AppNotification> notifications;
  final List<Conversation> conversations;
  final Map<String, TaskCompletion> completions;
  final DemoConfig config;
  final bool notificationEnabled;
  final double customerRating;
  final int platformFeePercent;
  final VerificationStatus verification;
  final DepositStatus deposit;
  final Set<int> availability;
  final List<Complaint> complaints;
  final int sessionGeneration;
  CustomerTask job(String id) =>
      [...availableJobs, ...myJobs].firstWhere((job) => job.id == id);
  Service service(String id) => services.firstWhere((s) => s.id == id);
}
