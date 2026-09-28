import 'models.dart';

abstract final class TaskPolicy {
  static int bucket(CustomerTask task, DateTime now) {
    if ({TaskStatus.completed, TaskStatus.paid}.contains(task.status)) {
      return 2;
    }
    if ({TaskStatus.cancelled, TaskStatus.refunded}.contains(task.status)) {
      return 3;
    }
    if ({
      TaskStatus.onTheWay,
      TaskStatus.arrived,
      TaskStatus.inProgress,
      TaskStatus.disputed,
    }.contains(task.status)) {
      return 0;
    }
    return task.draft.scheduledAt.isAfter(
          DateTime(now.year, now.month, now.day + 1),
        )
        ? 1
        : 0;
  }

  static const progression = {
    TaskStatus.accepted: TaskStatus.onTheWay,
    TaskStatus.onTheWay: TaskStatus.arrived,
    TaskStatus.arrived: TaskStatus.inProgress,
    TaskStatus.inProgress: TaskStatus.completed,
  };
  static const cancellable = {
    TaskStatus.posted,
    TaskStatus.matching,
    TaskStatus.accepted,
    TaskStatus.onTheWay,
  };
  static const reportable = {
    TaskStatus.accepted,
    TaskStatus.onTheWay,
    TaskStatus.arrived,
    TaskStatus.inProgress,
    TaskStatus.completed,
    TaskStatus.paid,
  };
  static bool canPay(CustomerTask task) =>
      task.status == TaskStatus.completed &&
      task.paymentStatus != PaymentStatus.paid;
  static bool canRate(CustomerTask task) =>
      task.status == TaskStatus.paid && task.review == null;
  static bool canReschedule(CustomerTask task) =>
      cancellable.contains(task.status);
  static bool isClosed(CustomerTask task) => {
    TaskStatus.paid,
    TaskStatus.cancelled,
    TaskStatus.refunded,
  }.contains(task.status);
}
