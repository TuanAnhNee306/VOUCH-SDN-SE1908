import 'package:flutter/material.dart';

import '../domain/models.dart';

abstract final class AppColors {
  static const primary = Color(0xFF078C5C),
      navy = Color(0xFF0F2D3D),
      mint = Color(0xFFE5F8EF),
      background = Color(0xFFF4F9F6),
      muted = Color(0xFF62776D),
      border = Color(0xFFDCE8E0),
      warning = Color(0xFF986100),
      error = Color(0xFFB3261E);
}

abstract final class AppSpacing {
  static const small = 8.0, medium = 16.0, large = 24.0;
}

abstract final class AppRadius {
  static const card = 20.0, input = 14.0;
}

abstract final class AppTheme {
  static ThemeData get light => ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(seedColor: AppColors.primary).copyWith(
      primary: AppColors.primary,
      onPrimary: Colors.white,
      secondaryContainer: AppColors.mint,
      surface: AppColors.background,
      onSurface: AppColors.navy,
    ),
    scaffoldBackgroundColor: AppColors.background,
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.background,
      foregroundColor: AppColors.navy,
      centerTitle: false,
      scrolledUnderElevation: 0,
    ),
    textTheme: const TextTheme(
      headlineLarge: TextStyle(
        fontSize: 32,
        fontWeight: FontWeight.w800,
        color: AppColors.navy,
        height: 1.25,
      ),
      headlineSmall: TextStyle(
        fontSize: 24,
        fontWeight: FontWeight.w800,
        color: AppColors.navy,
        height: 1.3,
      ),
      titleLarge: TextStyle(
        fontSize: 20,
        fontWeight: FontWeight.w700,
        height: 1.35,
      ),
      titleMedium: TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w700,
        height: 1.4,
      ),
      bodyMedium: TextStyle(fontSize: 14, height: 1.5),
      bodySmall: TextStyle(fontSize: 12, height: 1.45, color: AppColors.muted),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.all(16),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.input),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.input),
        borderSide: const BorderSide(color: AppColors.border),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(0, 52),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(0, 48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    navigationBarTheme: const NavigationBarThemeData(
      backgroundColor: Colors.white,
      indicatorColor: AppColors.mint,
      labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
    ),
    dividerColor: AppColors.border,
  );
}

class TaskStatusStyle {
  const TaskStatusStyle(this.label, this.icon, this.color, {this.nextLabel});
  final String label;
  final IconData icon;
  final Color color;
  final String? nextLabel;
}

const taskStatusStyles = {
  TaskStatus.draft: TaskStatusStyle(
    'Bản nháp',
    Icons.edit_note,
    AppColors.muted,
  ),
  TaskStatus.posted: TaskStatusStyle(
    'Đã đăng',
    Icons.check_circle_outline,
    AppColors.primary,
  ),
  TaskStatus.matching: TaskStatusStyle(
    'Đang tìm Tasker',
    Icons.radar,
    AppColors.warning,
  ),
  TaskStatus.accepted: TaskStatusStyle(
    'Đã nhận việc',
    Icons.handshake_outlined,
    AppColors.primary,
    nextLabel: 'Tasker bắt đầu di chuyển',
  ),
  TaskStatus.onTheWay: TaskStatusStyle(
    'Đang di chuyển',
    Icons.two_wheeler,
    AppColors.primary,
    nextLabel: 'Tasker đã đến nơi',
  ),
  TaskStatus.arrived: TaskStatusStyle(
    'Đã đến nơi',
    Icons.location_on_outlined,
    AppColors.primary,
    nextLabel: 'Bắt đầu công việc',
  ),
  TaskStatus.inProgress: TaskStatusStyle(
    'Đang thực hiện',
    Icons.cleaning_services_outlined,
    AppColors.primary,
    nextLabel: 'Tasker hoàn thành công việc',
  ),
  TaskStatus.completed: TaskStatusStyle(
    'Chờ nghiệm thu',
    Icons.fact_check_outlined,
    AppColors.warning,
  ),
  TaskStatus.paid: TaskStatusStyle(
    'Đã hoàn tất',
    Icons.verified_outlined,
    AppColors.primary,
  ),
  TaskStatus.cancelled: TaskStatusStyle(
    'Đã hủy',
    Icons.cancel_outlined,
    AppColors.muted,
  ),
  TaskStatus.disputed: TaskStatusStyle(
    'Đang khiếu nại',
    Icons.support_agent,
    AppColors.error,
  ),
  TaskStatus.refunded: TaskStatusStyle(
    'Đã hoàn tiền',
    Icons.currency_exchange,
    AppColors.primary,
  ),
};

String money(int amount) =>
    '${amount.toString().replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+(?!\d))'), (m) => '${m[1]}.')}đ';
String dateLabel(DateTime d) =>
    '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
String timeLabel(DateTime d) =>
    '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
IconData serviceIcon(String key) => switch (key) {
  'cleaning' => Icons.cleaning_services_outlined,
  'moving' => Icons.local_shipping_outlined,
  'assembly' => Icons.handyman_outlined,
  'shopping' => Icons.shopping_basket_outlined,
  'delivery' => Icons.inventory_2_outlined,
  _ => Icons.grid_view_rounded,
};
