import 'package:flutter/material.dart';

import '../app/customer_controller.dart';
import '../core/theme.dart';
import '../domain/models.dart';
import '../domain/task_policy.dart';
import '../shared/widgets.dart';

part 'booking_screens.dart';
part 'task_screens.dart';
part 'account_screens.dart';

class CustomerView extends StatefulWidget {
  const CustomerView({super.key, required this.controller, this.onOpenTasker});
  final CustomerController controller;
  final VoidCallback? onOpenTasker;
  @override
  State<CustomerView> createState() => _CustomerViewState();
}

class _CustomerViewState extends State<CustomerView> {
  CustomerController get c => widget.controller;
  CustomerSnapshot get data => c.data!;
  @override
  void initState() {
    super.initState();
    c.initialize();
  }

  static const tabPages = [
    PageId.home,
    PageId.tasks,
    PageId.create,
    PageId.messages,
    PageId.profile,
  ];
  static const titles = {
    PageId.splash: 'TaskLy',
    PageId.onboarding: 'Chào mừng đến TaskLy',
    PageId.login: 'Đăng nhập',
    PageId.register: 'Tạo tài khoản',
    PageId.recovery: 'Khôi phục truy cập',
    PageId.otp: 'Xác minh số điện thoại',
    PageId.locationPermission: 'Chọn vị trí',
    PageId.home: 'TaskLy',
    PageId.services: 'Dịch vụ',
    PageId.serviceDetail: 'Chi tiết dịch vụ',
    PageId.create: 'Tạo Task',
    PageId.ai: 'TaskLy AI',
    PageId.recommendations: 'Tìm Tasker',
    PageId.tasker: 'Hồ sơ Tasker',
    PageId.matched: 'Ghép thành công',
    PageId.tasks: 'Việc của tôi',
    PageId.task: 'Chi tiết công việc',
    PageId.tracking: 'Theo dõi Tasker',
    PageId.payment: 'Nghiệm thu & thanh toán',
    PageId.paymentSuccess: 'Thanh toán thành công',
    PageId.rating: 'Đánh giá Tasker',
    PageId.ratingSuccess: 'Cảm ơn bạn',
    PageId.messages: 'Tin nhắn',
    PageId.chat: 'Cuộc trò chuyện',
    PageId.notifications: 'Thông báo',
    PageId.profile: 'Hồ sơ',
    PageId.editProfile: 'Thông tin cá nhân',
    PageId.addresses: 'Địa chỉ đã lưu',
    PageId.paymentMethods: 'Phương thức thanh toán',
    PageId.reviews: 'Đánh giá của tôi',
    PageId.settings: 'Cài đặt',
    PageId.help: 'Trợ giúp & điều khoản',
    PageId.support: 'Hỗ trợ công việc',
    PageId.complaint: 'Gửi khiếu nại',
    PageId.complaintStatus: 'Chi tiết khiếu nại',
  };

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: c,
    builder: (context, _) {
      final page = c.route.page;
      final shell = [
        PageId.home,
        PageId.tasks,
        PageId.messages,
        PageId.profile,
      ].contains(page);
      return PopScope(
        canPop: !c.canBack,
        onPopInvokedWithResult: (didPop, result) {
          if (!didPop) {
            page == PageId.create ? c.previousStep() : c.back();
          }
        },
        child: Scaffold(
          appBar: AppBar(
            leading: c.canBack
                ? IconButton(
                    tooltip: 'Quay lại',
                    onPressed: c.busy
                        ? null
                        : () {
                            page == PageId.create ? c.previousStep() : c.back();
                          },
                    icon: const Icon(Icons.arrow_back),
                  )
                : const Padding(
                    padding: EdgeInsets.all(14),
                    child: Icon(Icons.task_alt, color: AppColors.primary),
                  ),
            title: Text(
              titles[page] ?? 'TaskLy',
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 19),
            ),
            actions: [
              if (c.demoMode && widget.onOpenTasker != null)
                IconButton(
                  tooltip: 'Demo: chuyển Tasker',
                  onPressed: c.busy ? null : widget.onOpenTasker,
                  icon: const Icon(Icons.swap_horiz),
                ),
              if (shell)
                IconButton(
                  tooltip: 'Thông báo',
                  onPressed: () => c.open(PageId.notifications),
                  icon: Badge(
                    isLabelVisible: data.notifications.any((n) => !n.read),
                    child: const Icon(Icons.notifications_none),
                  ),
                ),
              if (c.demoMode)
                const Padding(
                  padding: EdgeInsets.only(right: 16),
                  child: Chip(
                    label: Text('DEMO', style: TextStyle(fontSize: 10)),
                    visualDensity: VisualDensity.compact,
                  ),
                ),
            ],
          ),
          body: SafeArea(
            child: Column(
              children: [
                if (c.busy) const LinearProgressIndicator(minHeight: 3),
                if (c.error != null)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
                    color: Theme.of(context).colorScheme.errorContainer,
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline, color: AppColors.error),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            c.error!,
                            key: const Key('error-message'),
                          ),
                        ),
                        IconButton(
                          tooltip: 'Đóng thông báo lỗi',
                          onPressed: () {
                            c.error = null;
                            c.changed();
                          },
                          icon: const Icon(Icons.close),
                        ),
                      ],
                    ),
                  ),
                Expanded(
                  child: c.data == null
                      ? Center(
                          child: c.error == null
                              ? const CircularProgressIndicator()
                              : PrimaryButton('Thử lại', c.initialize),
                        )
                      : AbsorbPointer(
                          absorbing: c.busy,
                          child: Align(
                            alignment: Alignment.topCenter,
                            child: ConstrainedBox(
                              constraints: const BoxConstraints(maxWidth: 640),
                              child: ListView(
                                key: ValueKey(
                                  '${page.name}-${c.route.id}-${page == PageId.create ? c.wizardStep : ''}',
                                ),
                                keyboardDismissBehavior:
                                    ScrollViewKeyboardDismissBehavior.onDrag,
                                padding: const EdgeInsets.fromLTRB(
                                  20,
                                  8,
                                  20,
                                  24,
                                ),
                                children: screen(),
                              ),
                            ),
                          ),
                        ),
                ),
              ],
            ),
          ),
          bottomNavigationBar: shell
              ? NavigationBar(
                  selectedIndex: tabPages.indexOf(page),
                  onDestinationSelected: (i) {
                    if (i == 2) {
                      c.startCreate();
                    } else {
                      c.root(tabPages[i]);
                    }
                  },
                  destinations: const [
                    NavigationDestination(
                      icon: Icon(Icons.home_outlined),
                      selectedIcon: Icon(Icons.home),
                      label: 'Trang chủ',
                    ),
                    NavigationDestination(
                      icon: Icon(Icons.assignment_outlined),
                      label: 'Công việc',
                    ),
                    NavigationDestination(
                      icon: Icon(Icons.add_circle, color: AppColors.primary),
                      label: 'Tạo Task',
                    ),
                    NavigationDestination(
                      icon: Icon(Icons.chat_bubble_outline),
                      label: 'Tin nhắn',
                    ),
                    NavigationDestination(
                      icon: Icon(Icons.person_outline),
                      label: 'Hồ sơ',
                    ),
                  ],
                )
              : null,
        ),
      );
    },
  );

  List<Widget> screen() => switch (c.route.page) {
    PageId.splash ||
    PageId.onboarding ||
    PageId.login ||
    PageId.register ||
    PageId.recovery ||
    PageId.otp ||
    PageId.locationPermission => authScreens(),
    PageId.home => homeScreen(),
    PageId.services => serviceList(),
    PageId.serviceDetail => serviceDetail(),
    PageId.create => createScreen(),
    PageId.ai => aiScreen(),
    PageId.recommendations ||
    PageId.tasker ||
    PageId.matched => matchingScreens(),
    PageId.tasks => taskList(),
    PageId.task => taskDetail(),
    PageId.tracking => trackingScreen(),
    PageId.payment ||
    PageId.paymentSuccess ||
    PageId.rating ||
    PageId.ratingSuccess => paymentScreens(),
    PageId.messages ||
    PageId.chat ||
    PageId.notifications => communicationScreens(),
    PageId.support ||
    PageId.complaint ||
    PageId.complaintStatus => supportScreens(),
    _ => accountScreens(),
  };

  Widget heading(String title, [String? subtitle]) => Padding(
    padding: const EdgeInsets.only(top: 8, bottom: 20),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.headlineSmall),
        if (subtitle != null) ...[
          const SizedBox(height: 6),
          Text(
            subtitle,
            style: const TextStyle(color: AppColors.muted, height: 1.5),
          ),
        ],
      ],
    ),
  );
  Widget section(
    String title, {
    String? action,
    VoidCallback? onTap,
  }) => Padding(
    padding: const EdgeInsets.only(top: 8, bottom: 12),
    child: Row(
      children: [
        Expanded(
          child: Text(title, style: Theme.of(context).textTheme.titleMedium),
        ),
        if (action != null) TextButton(onPressed: onTap, child: Text(action)),
      ],
    ),
  );
  Widget field(
    String label,
    String value,
    ValueChanged<String> onChanged, {
    int lines = 1,
    TextInputType? keyboard,
    int? maxLength,
    String? helper,
    Key? key,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: TextFormField(
      key: key ?? ValueKey(label),
      initialValue: value,
      onChanged: onChanged,
      minLines: lines,
      maxLines: lines,
      maxLength: maxLength,
      keyboardType: keyboard,
      decoration: InputDecoration(
        labelText: label,
        helperText: helper,
        alignLabelWithHint: lines > 1,
      ),
    ),
  );
  Widget info(String text, {IconData icon = Icons.verified_user_outlined}) =>
      Panel(
        color: AppColors.mint,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: AppColors.primary, size: 22),
            const SizedBox(width: 12),
            Expanded(child: Text(text, style: const TextStyle(height: 1.5))),
          ],
        ),
      );
  Widget detailRow(IconData icon, String title, String value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 9),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: AppColors.primary, size: 22),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: 3),
              Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ],
    ),
  );
  Widget menu(
    String title,
    IconData icon,
    VoidCallback tap, {
    String? subtitle,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: ListTile(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      tileColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
      leading: Icon(icon, color: AppColors.primary),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
      subtitle: subtitle == null ? null : Text(subtitle),
      trailing: const Icon(Icons.chevron_right, size: 20),
      onTap: tap,
    ),
  );
  Widget taskerCard(Tasker person, VoidCallback? onTap) => Panel(
    child: Column(
      children: [
        Row(
          children: [
            UserAvatar(person.name, person.avatar),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    person.name,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  Text(
                    person.school,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  Text(
                    '★ ${person.rating} • ${person.jobs} việc • ${person.distance} km',
                    style: const TextStyle(fontSize: 12),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: Text(
                '${person.match}% phù hợp • AI demo',
                style: const TextStyle(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            if (onTap != null)
              TextButton(onPressed: onTap, child: const Text('Xem hồ sơ')),
          ],
        ),
      ],
    ),
  );
  Widget taskCard(CustomerTask task) => Panel(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                task.id,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
            Flexible(child: StatusChip(task.status)),
          ],
        ),
        const SizedBox(height: 12),
        Text(
          data.service(task.draft.serviceId).name,
          style: Theme.of(context).textTheme.titleLarge,
        ),
        detailRow(
          Icons.schedule,
          '${dateLabel(task.draft.scheduledAt)} • ${timeLabel(task.draft.scheduledAt)}',
          '${task.draft.duration} giờ',
        ),
        Text(task.draft.address.detail),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: Text(
                money(task.price.total),
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: AppColors.primary,
                ),
              ),
            ),
            TextButton(
              onPressed: () => c.open(PageId.task, id: task.id),
              child: const Text('Xem chi tiết →'),
            ),
          ],
        ),
      ],
    ),
  );
  Future<bool> confirm(String title, String message) async =>
      await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(title),
          content: Text(message),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Quay lại'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Xác nhận'),
            ),
          ],
        ),
      ) ??
      false;
}
