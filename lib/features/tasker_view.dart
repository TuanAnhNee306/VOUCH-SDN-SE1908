import 'package:flutter/material.dart';

import '../app/tasker_controller.dart';
import '../core/theme.dart';
import '../domain/models.dart';
import '../domain/tasker_models.dart';
import '../domain/task_policy.dart';
import '../shared/widgets.dart';

part 'tasker_account_screens.dart';

class TaskerView extends StatefulWidget {
  const TaskerView({
    super.key,
    required this.controller,
    this.onSwitchCustomer,
  });
  final TaskerController controller;
  final VoidCallback? onSwitchCustomer;
  @override
  State<TaskerView> createState() => _TaskerViewState();
}

class _TaskerViewState extends State<TaskerView> {
  TaskerController get c => widget.controller;
  TaskerSnapshot get data => c.data!;
  static const tabs = [
    TaskerPage.home,
    TaskerPage.map,
    TaskerPage.jobs,
    TaskerPage.wallet,
    TaskerPage.profile,
  ];
  static const titles = {
    TaskerPage.splash: 'TaskLy',
    TaskerPage.login: 'Đăng nhập Tasker',
    TaskerPage.home: 'Việc làm gần bạn',
    TaskerPage.map: 'Bản đồ công việc',
    TaskerPage.jobs: 'Việc của tôi',
    TaskerPage.jobDetail: 'Chi tiết công việc',
    TaskerPage.accept: 'Xác nhận nhận việc',
    TaskerPage.active: 'Công việc đang làm',
    TaskerPage.onTheWay: 'Đang di chuyển',
    TaskerPage.arrived: 'Bạn đã đến nơi',
    TaskerPage.start: 'Bắt đầu công việc',
    TaskerPage.inProgress: 'Đang thực hiện',
    TaskerPage.complete: 'Gửi xác nhận hoàn thành',
    TaskerPage.waitingPayment: 'Chờ Customer nghiệm thu',
    TaskerPage.rating: 'Đánh giá Customer',
    TaskerPage.ratingSuccess: 'Cảm ơn bạn',
    TaskerPage.wallet: 'Ví thu nhập',
    TaskerPage.transactions: 'Lịch sử giao dịch',
    TaskerPage.withdraw: 'Rút tiền',
    TaskerPage.withdrawResult: 'Yêu cầu rút tiền',
    TaskerPage.profile: 'Hồ sơ Tasker',
    TaskerPage.services: 'Dịch vụ và lịch rảnh',
    TaskerPage.verification: 'Xác minh danh tính',
    TaskerPage.messages: 'Tin nhắn',
    TaskerPage.chat: 'Trò chuyện',
    TaskerPage.notifications: 'Thông báo',
    TaskerPage.settings: 'Cài đặt',
    TaskerPage.filters: 'Bộ lọc công việc',
    TaskerPage.availability: 'Lịch rảnh hàng tuần',
    TaskerPage.deposit: 'Tiền đảm bảo hoàn lại',
    TaskerPage.reviews: 'Đánh giá',
    TaskerPage.help: 'Trung tâm trợ giúp',
    TaskerPage.report: 'Báo sự cố',
  };
  @override
  void initState() {
    super.initState();
    c.initialize();
  }

  bool get shell => tabs.contains(c.route.page);

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: c,
    builder: (_, _) => PopScope(
      canPop: !c.canBack,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) c.back();
      },
      child: Scaffold(
        appBar: AppBar(
          leading: c.canBack
              ? IconButton(
                  tooltip: 'Quay lại',
                  onPressed: c.busy ? null : c.back,
                  icon: const Icon(Icons.arrow_back),
                )
              : const Padding(
                  padding: EdgeInsets.all(14),
                  child: Icon(Icons.task_alt, color: AppColors.primary),
                ),
          title: Text(
            titles[c.route.page]!,
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 19),
          ),
          actions: [
            if (c.demoMode && widget.onSwitchCustomer != null)
              IconButton(
                tooltip: 'Demo: chuyển Customer',
                onPressed: c.busy ? null : widget.onSwitchCustomer,
                icon: const Icon(Icons.swap_horiz),
              ),
            if (shell &&
                c.route.page != TaskerPage.splash &&
                c.route.page != TaskerPage.login)
              IconButton(
                tooltip: 'Thông báo',
                onPressed: () => c.open(TaskerPage.notifications),
                icon: Badge(
                  isLabelVisible:
                      c.data?.notifications.any((n) => !n.read) ?? false,
                  child: const Icon(Icons.notifications_none),
                ),
              ),
            if (c.demoMode)
              const Padding(
                padding: EdgeInsets.only(right: 14),
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
              if (c.error != null) errorBanner(),
              Expanded(
                child: c.data == null
                    ? const Center(child: CircularProgressIndicator())
                    : AbsorbPointer(
                        absorbing: c.busy,
                        child: Align(
                          alignment: Alignment.topCenter,
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 640),
                            child: ListView(
                              key: ValueKey('${c.route.page}-${c.route.id}'),
                              keyboardDismissBehavior:
                                  ScrollViewKeyboardDismissBehavior.onDrag,
                              padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
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
                selectedIndex: tabs.indexOf(c.route.page),
                onDestinationSelected: (index) => c.root(tabs[index]),
                destinations: const [
                  NavigationDestination(
                    icon: Icon(Icons.work_outline),
                    selectedIcon: Icon(Icons.work),
                    label: 'Việc làm',
                  ),
                  NavigationDestination(
                    icon: Icon(Icons.map_outlined),
                    selectedIcon: Icon(Icons.map),
                    label: 'Bản đồ',
                  ),
                  NavigationDestination(
                    icon: Icon(Icons.assignment_outlined),
                    selectedIcon: Icon(Icons.assignment),
                    label: 'Việc của tôi',
                  ),
                  NavigationDestination(
                    icon: Icon(Icons.account_balance_wallet_outlined),
                    selectedIcon: Icon(Icons.account_balance_wallet),
                    label: 'Ví',
                  ),
                  NavigationDestination(
                    icon: Icon(Icons.person_outline),
                    selectedIcon: Icon(Icons.person),
                    label: 'Hồ sơ',
                  ),
                ],
              )
            : null,
      ),
    ),
  );

  Widget errorBanner() => Container(
    width: double.infinity,
    color: Theme.of(context).colorScheme.errorContainer,
    padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
    child: Row(
      children: [
        const Icon(Icons.error_outline, color: AppColors.error),
        const SizedBox(width: 8),
        Expanded(child: Text(c.error!, key: const Key('tasker-error-message'))),
        IconButton(
          tooltip: 'Đóng lỗi',
          onPressed: () {
            c.error = null;
            c.changed();
          },
          icon: const Icon(Icons.close),
        ),
      ],
    ),
  );
  List<Widget> screen() => switch (c.route.page) {
    TaskerPage.splash => splash(),
    TaskerPage.login => login(),
    TaskerPage.home => home(),
    TaskerPage.map => map(),
    TaskerPage.jobs => jobs(),
    TaskerPage.jobDetail => jobDetail(),
    TaskerPage.accept => accept(),
    TaskerPage.active => active(),
    TaskerPage.onTheWay => travel(),
    TaskerPage.arrived => arrived(),
    TaskerPage.start => start(),
    TaskerPage.inProgress => inProgress(),
    TaskerPage.complete => complete(),
    TaskerPage.waitingPayment => waiting(),
    TaskerPage.rating || TaskerPage.ratingSuccess => rating(),
    TaskerPage.wallet => wallet(),
    TaskerPage.transactions => transactions(),
    TaskerPage.withdraw || TaskerPage.withdrawResult => withdraw(),
    TaskerPage.profile => profile(),
    TaskerPage.services => services(),
    TaskerPage.verification => verification(),
    TaskerPage.messages || TaskerPage.chat => messages(),
    TaskerPage.notifications => notifications(),
    TaskerPage.settings => settings(),
    TaskerPage.filters ||
    TaskerPage.availability ||
    TaskerPage.deposit ||
    TaskerPage.reviews ||
    TaskerPage.help ||
    TaskerPage.report => extraScreens(),
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
  Widget info(String text, {IconData icon = Icons.verified_user_outlined}) =>
      Panel(
        color: AppColors.mint,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: AppColors.primary),
            const SizedBox(width: 12),
            Expanded(child: Text(text, style: const TextStyle(height: 1.45))),
          ],
        ),
      );
  Widget row(IconData icon, String label, String value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 20, color: AppColors.primary),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: Theme.of(context).textTheme.bodySmall),
              Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ],
    ),
  );
  CustomerTask get job => data.job(c.route.id!);
  int earn(CustomerTask item) => item.price.taskerEarning;

  List<Widget> splash() => [
    const SizedBox(height: 80),
    const Icon(Icons.task_alt, size: 88, color: AppColors.primary),
    const SizedBox(height: 24),
    Center(
      child: Text('TASKLY', style: Theme.of(context).textTheme.headlineLarge),
    ),
    const SizedBox(height: 8),
    const Center(
      child: Text(
        'Làm việc linh hoạt, thu nhập minh bạch',
        textAlign: TextAlign.center,
      ),
    ),
    const SizedBox(height: 46),
    PrimaryButton(
      'Bắt đầu với vai trò Tasker',
      () => c.replace(TaskerPage.login),
      icon: Icons.work,
    ),
  ];
  List<Widget> login() => [
    heading(
      'Chào Minh Anh 👋',
      'Đây là tài khoản Tasker mô phỏng đã xác minh.',
    ),
    info(
      'Không cần nhập dữ liệu thật. Đăng nhập demo để xem việc gần bạn, thực hiện và theo dõi thu nhập.',
      icon: Icons.lock_outline,
    ),
    PrimaryButton('Đăng nhập Tasker demo', c.login),
    if (widget.onSwitchCustomer != null)
      OutlinedButton.icon(
        onPressed: widget.onSwitchCustomer,
        icon: const Icon(Icons.swap_horiz),
        label: const Text('Chuyển sang Customer'),
      ),
  ];

  List<Widget> home() => [
    Row(
      children: [
        Expanded(
          child: heading(
            'Chào ${data.profile.profile.name} 👋',
            'Sẵn sàng nhận việc hôm nay?',
          ),
        ),
        Switch(value: data.profile.online, onChanged: c.setOnline),
      ],
    ),
    Panel(
      color: AppColors.navy,
      child: Row(
        children: [
          const Icon(
            Icons.account_balance_wallet,
            color: Colors.white,
            size: 32,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Thu nhập có thể rút',
                  style: TextStyle(color: Colors.white70),
                ),
                Text(
                  money(data.wallet.available),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 25,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: () => c.root(TaskerPage.wallet),
            child: const Text('Ví', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    ),
    section(
      'Việc đang làm',
      action: 'Xem tất cả',
      tap: () => c.root(TaskerPage.jobs),
    ),
    if (data.myJobs
        .where(
          (item) => !{
            TaskStatus.paid,
            TaskStatus.cancelled,
            TaskStatus.refunded,
          }.contains(item.status),
        )
        .isEmpty)
      EmptyState(
        'Chưa có việc đang làm',
        'Nhận một công việc phù hợp gần bạn.',
        action: PrimaryButton('Tìm việc', () => c.root(TaskerPage.home)),
      )
    else
      ...data.myJobs
          .where(
            (item) => !{
              TaskStatus.paid,
              TaskStatus.cancelled,
              TaskStatus.refunded,
            }.contains(item.status),
          )
          .map(jobCard),
    section(
      'Việc gần bạn',
      action: 'Bộ lọc',
      tap: () => c.open(TaskerPage.filters),
    ),
    Wrap(
      spacing: 8,
      children: [
        ChoiceChip(
          label: const Text('Tất cả'),
          selected: c.filterService.isEmpty,
          onSelected: (_) {
            c.filterService = '';
            c.changed();
          },
        ),
        ...data.services.map(
          (s) => ChoiceChip(
            label: Text(s.name),
            selected: c.filterService == s.id,
            onSelected: (_) {
              c.filterService = s.id;
              c.changed();
            },
          ),
        ),
      ],
    ),
    const SizedBox(height: 10),
    if (!data.profile.online)
      info(
        'Bạn đang tắt trạng thái nhận việc. Bật Online để nhận công việc mới.',
        icon: Icons.toggle_off_outlined,
      ),
    if (c.filteredJobs.isEmpty)
      const EmptyState(
        'Chưa có việc phù hợp',
        'Tạo Task ở Customer hoặc thay đổi bộ lọc.',
      ),
    ...c.filteredJobs.map(jobCard),
  ];
  Widget section(String title, {String? action, VoidCallback? tap}) => Padding(
    padding: const EdgeInsets.only(top: 9, bottom: 11),
    child: Row(
      children: [
        Expanded(
          child: Text(title, style: Theme.of(context).textTheme.titleMedium),
        ),
        if (action != null) TextButton(onPressed: tap, child: Text(action)),
      ],
    ),
  );
  Widget jobCard(CustomerTask item) => Panel(
    key: ValueKey('tasker-job-${item.id}'),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                data.service(item.draft.serviceId).name,
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            StatusChip(item.status),
          ],
        ),
        const SizedBox(height: 7),
        Text(item.id, style: Theme.of(context).textTheme.bodySmall),
        Text(
          item.draft.description,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        row(
          Icons.schedule,
          '${dateLabel(item.draft.scheduledAt)} • ${timeLabel(item.draft.scheduledAt)}',
          '${item.draft.duration} giờ • ${item.draft.address.detail}',
        ),
        Row(
          children: [
            Expanded(
              child: Text(
                'Bạn nhận ${money(earn(item))}',
                style: const TextStyle(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w800,
                  fontSize: 18,
                ),
              ),
            ),
            TextButton(
              onPressed: () => c.open(
                data.availableJobs.any((job) => job.id == item.id)
                    ? TaskerPage.jobDetail
                    : TaskerPage.active,
                id: item.id,
              ),
              child: const Text('Xem việc →'),
            ),
          ],
        ),
      ],
    ),
  );
  List<Widget> map() => [
    heading(
      'Bản đồ công việc',
      '${c.filteredJobs.length} việc trong bán kính ${data.profile.radius} km',
    ),
    MockMap(data.config.mapDescription, routePoints: data.config.routePoints),
    OutlinedButton(
      onPressed: () => c.open(TaskerPage.filters),
      child: const Text('Lọc công việc'),
    ),
    if (c.filteredJobs.isEmpty)
      const EmptyState(
        'Không có việc phù hợp',
        'Thay đổi bộ lọc hoặc bật Online.',
      ),
    ...c.filteredJobs.map(jobCard),
  ];
  List<Widget> jobs() {
    final labels = ['Đang làm', 'Sắp tới', 'Hoàn thành', 'Đã hủy'];
    final filtered = data.myJobs
        .where((item) => TaskPolicy.bucket(item, DateTime.now()) == c.jobFilter)
        .toList();
    return [
      heading('Việc của tôi', 'Theo dõi tiến độ và thu nhập từng công việc.'),
      Wrap(
        spacing: 4,
        children: List.generate(
          4,
          (i) => ChoiceChip(
            label: Text(labels[i]),
            selected: c.jobFilter == i,
            onSelected: (_) {
              c.jobFilter = i;
              c.changed();
            },
          ),
        ),
      ),
      const SizedBox(height: 16),
      if (filtered.isEmpty)
        const EmptyState(
          'Chưa có công việc',
          'Các công việc phù hợp sẽ xuất hiện tại đây.',
          icon: Icons.assignment_outlined,
        )
      else
        ...filtered.map(jobCard),
    ];
  }

  List<Widget> jobDetail() => [
    heading(
      data.service(job.draft.serviceId).name,
      'Việc mới từ ${data.customer.name}',
    ),
    Panel(
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Ngân sách',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              Text(
                money(job.price.total),
                style: const TextStyle(
                  fontSize: 23,
                  color: AppColors.primary,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const Divider(),
          row(Icons.payments_outlined, 'Giá công việc', money(job.price.labor)),
          row(
            Icons.cleaning_services,
            'Phụ phí dụng cụ chuyển Tasker',
            money(job.price.equipment),
          ),
          row(
            Icons.shield_outlined,
            'Gói bảo vệ Customer',
            money(job.price.protection),
          ),
          row(
            Icons.percent,
            'Phí nền tảng ${job.price.platformFeePercent}% (demo)',
            '-${money(job.price.platformFee)}',
          ),
          row(
            Icons.account_balance_wallet_outlined,
            'Bạn dự kiến nhận',
            money(earn(job)),
          ),
        ],
      ),
    ),
    Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Yêu cầu', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Text(job.draft.description),
          row(
            Icons.schedule,
            'Lịch thực hiện',
            '${dateLabel(job.draft.scheduledAt)} • ${timeLabel(job.draft.scheduledAt)} • ${job.draft.duration} giờ',
          ),
          if (job.draft.note.isNotEmpty)
            row(Icons.notes, 'Lưu ý', job.draft.note),
          if (job.draft.destination.isNotEmpty)
            row(Icons.flag_outlined, 'Điểm đến', job.draft.destination),
          if (job.draft.images.isNotEmpty) ...[
            const SizedBox(height: 12),
            Image.asset(
              job.draft.images.first,
              height: 130,
              width: double.infinity,
              fit: BoxFit.cover,
            ),
          ],
        ],
      ),
    ),
    MockMap(
      job.draft.address.detail,
      eta: data.config.etaMinutes,
      routePoints: data.config.routePoints,
    ),
    info(
      'Customer ${data.customer.name} • đánh giá ${data.customerRating} ★ • ${job.draft.protection ? 'Có Bảo vệ công việc' : 'Không có gói bảo vệ'}',
    ),
    PrimaryButton('Nhận công việc', () {
      c.acceptConsent = false;
      c.open(TaskerPage.accept, id: job.id);
    }, icon: Icons.handshake_outlined),
    OutlinedButton.icon(
      onPressed: () => c.back(),
      icon: const Icon(Icons.bookmark_border),
      label: const Text('Quay lại danh sách'),
    ),
  ];
  List<Widget> accept() => [
    heading('Nhận công việc này?', 'Xác nhận khả năng đến đúng lịch.'),
    jobCard(job),
    info(
      'Bạn chỉ nên nhận khi có thể có mặt đúng giờ. Hủy sau khi nhận có thể ảnh hưởng uy tín Tasker.',
      icon: Icons.info_outline,
    ),
    CheckboxListTile(
      contentPadding: EdgeInsets.zero,
      value: c.acceptConsent,
      onChanged: (v) {
        c.acceptConsent = v ?? false;
        c.changed();
      },
      title: const Text('Tôi có thể đến đúng giờ'),
    ),
    PrimaryButton(
      'Xác nhận nhận việc',
      c.acceptConsent ? () => c.accept(job.id) : null,
    ),
  ];
  List<Widget> active() {
    final item = job;
    final action = switch (item.status) {
      TaskStatus.accepted => ('Bắt đầu di chuyển', TaskerPage.onTheWay),
      TaskStatus.onTheWay => ('Mở theo dõi di chuyển', TaskerPage.onTheWay),
      TaskStatus.arrived => ('Bắt đầu công việc', TaskerPage.start),
      TaskStatus.inProgress => ('Tiếp tục công việc', TaskerPage.inProgress),
      TaskStatus.completed => (
        'Xem trạng thái nghiệm thu',
        TaskerPage.waitingPayment,
      ),
      TaskStatus.paid =>
        item.taskerReview == null
            ? ('Đánh giá Customer', TaskerPage.rating)
            : ('Xem thu nhập', TaskerPage.wallet),
      _ => ('Xem việc của tôi', TaskerPage.jobs),
    };
    return [
      heading(data.service(item.draft.serviceId).name, item.id),
      StatusChip(item.status),
      const SizedBox(height: 14),
      customerCard(),
      Panel(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Tổng quan', style: Theme.of(context).textTheme.titleMedium),
            row(
              Icons.location_on_outlined,
              'Địa chỉ',
              item.draft.address.detail,
            ),
            row(
              Icons.notes_outlined,
              'Ghi chú',
              item.draft.note.isEmpty
                  ? 'Không có ghi chú thêm'
                  : item.draft.note,
            ),
            row(Icons.payments_outlined, 'Bạn nhận', money(earn(item))),
          ],
        ),
      ),
      timeline(item),
      PrimaryButton(action.$1, () {
        if (action.$2 == TaskerPage.rating) {
          c.beginRating(item.id);
        } else {
          c.open(action.$2, id: item.id);
        }
      }, icon: Icons.arrow_forward),
      OutlinedButton.icon(
        onPressed: () => c.chatFor(item.id),
        icon: const Icon(Icons.chat_outlined),
        label: const Text('Nhắn tin Customer'),
      ),
      if (TaskPolicy.reportable.contains(item.status))
        OutlinedButton(
          onPressed: () => c.startReport(item.id),
          child: const Text('Báo sự cố'),
        ),
      ...data.complaints
          .where((report) => report.taskId == item.id)
          .map(
            (report) =>
                info('${report.id} • ${report.status}\n${report.description}'),
          ),
    ];
  }

  Widget customerCard() => Panel(
    child: Row(
      children: [
        UserAvatar(data.customer.name, data.customer.avatar),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                data.customer.name,
                style: Theme.of(context).textTheme.titleMedium,
              ),
              Text('Customer • ★ ${data.customerRating} • đã xác minh'),
            ],
          ),
        ),
        IconButton(
          tooltip: 'Gọi Customer (mô phỏng)',
          onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Cuộc gọi mô phỏng tới ${data.customer.phone}'),
            ),
          ),
          icon: const Icon(Icons.call_outlined),
        ),
        IconButton(
          tooltip: 'Nhắn tin Customer',
          onPressed: () => c.chatFor(job.id),
          icon: const Icon(Icons.chat_bubble_outline),
        ),
      ],
    ),
  );
  Widget timeline(CustomerTask item) => Panel(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Tiến trình', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        ...item.timeline.map(
          (event) => Padding(
            padding: const EdgeInsets.symmetric(vertical: 5),
            child: Row(
              children: [
                Icon(
                  taskStatusStyles[event.status]!.icon,
                  size: 18,
                  color: AppColors.primary,
                ),
                const SizedBox(width: 9),
                Expanded(child: Text(taskStatusStyles[event.status]!.label)),
                Text(
                  timeLabel(event.at),
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
        ),
      ],
    ),
  );
  List<Widget> travel() => [
    heading(
      'Đang di chuyển',
      'Đi đến ${job.draft.address.label} trong khoảng ${data.config.etaMinutes} phút.',
    ),
    MockMap(
      job.draft.address.detail,
      eta: data.config.etaMinutes,
      routePoints: data.config.routePoints,
    ),
    customerCard(),
    info(
      'Vị trí và tuyến đường là dữ liệu mô phỏng, không dùng GPS thật.',
      icon: Icons.location_searching,
    ),
    if (job.status == TaskStatus.accepted)
      PrimaryButton(
        'Bắt đầu di chuyển',
        () => c.advance(job.id),
        icon: Icons.two_wheeler,
      )
    else
      PrimaryButton('Tôi đã đến nơi', () async {
        await c.advance(job.id);
        if (c.error == null) c.replace(TaskerPage.arrived, id: job.id);
      }, icon: Icons.location_on),
  ];
  List<Widget> arrived() => [
    const SizedBox(height: 24),
    const Center(
      child: Icon(Icons.location_on, size: 72, color: AppColors.primary),
    ),
    heading('Bạn đã đến nơi', 'Check-in mô phỏng đã được ghi nhận.'),
    jobCard(job),
    customerCard(),
    PrimaryButton(
      'Bắt đầu công việc',
      () => c.open(TaskerPage.start, id: job.id),
    ),
    OutlinedButton.icon(
      onPressed: () => c.open(TaskerPage.messages),
      icon: const Icon(Icons.support_agent),
      label: const Text('Cần hỗ trợ?'),
    ),
  ];
  List<Widget> start() => [
    heading(
      'Bắt đầu công việc',
      'Xác nhận lại yêu cầu với Customer trước khi thực hiện.',
    ),
    jobCard(job),
    CheckboxListTile(
      contentPadding: EdgeInsets.zero,
      value: c.checklistFor('start-${job.id}').contains(0),
      onChanged: (v) {
        if (v == true) {
          c.checklistFor('start-${job.id}').add(0);
        } else {
          c.checklistFor('start-${job.id}').remove(0);
        }
        c.changed();
      },
      title: const Text('Đã gặp Customer'),
    ),
    CheckboxListTile(
      contentPadding: EdgeInsets.zero,
      value: c.checklistFor('start-${job.id}').contains(1),
      onChanged: (v) {
        if (v == true) {
          c.checklistFor('start-${job.id}').add(1);
        } else {
          c.checklistFor('start-${job.id}').remove(1);
        }
        c.changed();
      },
      title: const Text('Đã xác nhận yêu cầu'),
    ),
    PrimaryButton(
      'Bắt đầu ngay',
      c.checklistFor('start-${job.id}').length != 2
          ? null
          : () async {
              await c.advance(job.id);
              if (c.error == null) c.replace(TaskerPage.inProgress, id: job.id);
            },
    ),
  ];
  List<Widget> inProgress() => [
    heading(
      'Đang thực hiện',
      'Bắt đầu ${job.startedAt == null ? "" : timeLabel(job.startedAt!)}',
    ),
    Panel(
      color: AppColors.mint,
      child: Row(
        children: [
          const Icon(Icons.timer_outlined, color: AppColors.primary, size: 32),
          const SizedBox(width: 12),
          Text(
            '${DateTime.now().difference(job.startedAt ?? DateTime.now()).inMinutes} phút',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
        ],
      ),
    ),
    customerCard(),
    Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Checklist công việc',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          ...data
              .service(job.draft.serviceId)
              .checklist
              .map(
                (item) => CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: c
                      .checklistFor(job.id)
                      .contains(
                        data
                            .service(job.draft.serviceId)
                            .checklist
                            .indexOf(item),
                      ),
                  onChanged: (v) {
                    final index = data
                        .service(job.draft.serviceId)
                        .checklist
                        .indexOf(item);
                    if (v == true) {
                      c.checklistFor(job.id).add(index);
                    } else {
                      c.checklistFor(job.id).remove(index);
                    }
                    c.changed();
                  },
                  title: Text(item),
                ),
              ),
        ],
      ),
    ),
    PrimaryButton(
      'Hoàn thành công việc',
      c.checklistFor(job.id).length ==
              data.service(job.draft.serviceId).checklist.length
          ? () => c.beginCompletion(job.id)
          : null,
      icon: Icons.task_alt,
    ),
    OutlinedButton(
      onPressed: () => c.startReport(job.id),
      child: const Text('Báo sự cố'),
    ),
  ];
  List<Widget> complete() => [
    heading(
      'Gửi xác nhận hoàn thành',
      'Đính kèm ảnh mẫu và ghi chú cho Customer.',
    ),
    Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Ảnh trước / sau',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: data.config.sampleImages
                .map(
                  (asset) => InkWell(
                    onTap: () {
                      if (c.completionImages.contains(asset)) {
                        c.completionImages.remove(asset);
                      } else {
                        c.completionImages.add(asset);
                      }
                      c.changed();
                    },
                    child: Stack(
                      children: [
                        Image.asset(
                          asset,
                          width: 128,
                          height: 94,
                          fit: BoxFit.cover,
                        ),
                        Positioned(
                          right: 4,
                          top: 4,
                          child: Icon(
                            c.completionImages.contains(asset)
                                ? Icons.check_circle
                                : Icons.add_circle,
                            color: c.completionImages.contains(asset)
                                ? AppColors.primary
                                : Colors.white,
                          ),
                        ),
                      ],
                    ),
                  ),
                )
                .toList(),
          ),
        ],
      ),
    ),
    TextFormField(
      initialValue: c.completionNote,
      maxLines: 3,
      maxLength: 300,
      onChanged: (v) => c.completionNote = v,
      decoration: const InputDecoration(
        labelText: 'Ghi chú cho Customer',
        hintText: 'Ví dụ: Đã dọn xong và bàn giao khu vực...',
      ),
    ),
    Panel(
      color: AppColors.mint,
      child: Text(
        '${money(earn(job))} • Chờ Customer xác nhận thanh toán. Đây là mô phỏng, không có giao dịch thật.',
      ),
    ),
    PrimaryButton('Xác nhận hoàn thành', () => c.submitCompletion(job.id)),
  ];
  List<Widget> waiting() => [
    const SizedBox(height: 24),
    const Center(
      child: Icon(Icons.hourglass_top, size: 72, color: AppColors.warning),
    ),
    heading(
      'Đã gửi kết quả',
      'Customer sẽ nghiệm thu trước khi thu nhập được cộng.',
    ),
    if (data.completions[job.id] != null)
      Panel(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Ghi chú đã gửi',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            Text(
              data.completions[job.id]!.note.isEmpty
                  ? 'Không có ghi chú.'
                  : data.completions[job.id]!.note,
            ),
          ],
        ),
      ),
    info(
      job.status == TaskStatus.paid
          ? 'Customer đã thanh toán. Thu nhập đã có trong ví.'
          : 'Thu nhập đang chờ. Chuyển Customer để nghiệm thu và thanh toán cùng công việc.',
    ),
    if (job.status == TaskStatus.paid)
      PrimaryButton('Đánh giá Customer', () => c.beginRating(job.id))
    else if (c.demoMode && widget.onSwitchCustomer != null)
      PrimaryButton('Chuyển Customer để thanh toán', widget.onSwitchCustomer),
    OutlinedButton(
      onPressed: () => c.root(TaskerPage.wallet),
      child: const Text('Xem thu nhập'),
    ),
    OutlinedButton(
      onPressed: () => c.open(TaskerPage.active, id: job.id),
      child: const Text('Về chi tiết công việc'),
    ),
  ];
  List<Widget> rating() {
    if (c.route.page == TaskerPage.ratingSuccess) {
      return [
        const SizedBox(height: 40),
        const Center(
          child: Icon(Icons.favorite, size: 76, color: AppColors.primary),
        ),
        heading(
          'Cảm ơn bạn!',
          'Đánh giá của bạn đã được lưu trong dữ liệu mock.',
        ),
        PrimaryButton('Xem việc đã hoàn thành', () {
          c.jobFilter = 2;
          c.root(TaskerPage.jobs);
        }),
        OutlinedButton(
          onPressed: () => c.root(TaskerPage.wallet),
          child: const Text('Mở ví thu nhập'),
        ),
      ];
    }
    return [
      heading(
        'Đánh giá ${data.customer.name}',
        'Trải nghiệm làm việc cùng Customer thế nào?',
      ),
      customerCard(),
      Center(
        child: Wrap(
          spacing: 4,
          children: List.generate(
            5,
            (i) => IconButton(
              tooltip: '${i + 1} sao',
              onPressed: () {
                c.ratingStars = i + 1;
                c.changed();
              },
              icon: Icon(
                i < c.ratingStars ? Icons.star : Icons.star_border,
                color: Colors.amber,
                size: 36,
              ),
            ),
          ),
        ),
      ),
      Wrap(
        spacing: 8,
        runSpacing: 6,
        children: data.config.customerReviewTags
            .map(
              (item) => FilterChip(
                label: Text(item),
                selected: c.ratingTags.contains(item),
                onSelected: (value) {
                  if (value) {
                    c.ratingTags.add(item);
                  } else {
                    c.ratingTags.remove(item);
                  }
                  c.changed();
                },
              ),
            )
            .toList(),
      ),
      const SizedBox(height: 12),
      TextFormField(
        maxLines: 4,
        maxLength: 300,
        onChanged: (v) => c.ratingComment = v,
        decoration: const InputDecoration(
          labelText: 'Chia sẻ thêm trải nghiệm',
        ),
      ),
      PrimaryButton('Gửi đánh giá', () => c.rate(job.id)),
    ];
  }

  List<Widget> wallet() => [
    heading('Ví thu nhập', 'Số dư và lịch sử trong bản demo.'),
    Panel(
      color: AppColors.navy,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Có thể rút', style: TextStyle(color: Colors.white70)),
          Text(
            money(data.wallet.available),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 31,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Đang chờ ${money(data.wallet.pending)}',
            style: const TextStyle(color: Colors.white70),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () {
              c.withdrawalAmount = data.wallet.available;
              c.open(TaskerPage.withdraw);
            },
            child: const Text('Rút tiền'),
          ),
        ],
      ),
    ),
    info(
      'Thu nhập mô phỏng được cộng sau khi Customer thanh toán. Không liên kết ví hoặc tài khoản ngân hàng thật.',
      icon: Icons.info_outline,
    ),
    section(
      'Giao dịch gần đây',
      action: 'Xem tất cả',
      tap: () => c.open(TaskerPage.transactions),
    ),
    ...data.wallet.transactions.take(3).map(transaction),
    OutlinedButton(
      onPressed: () => c.root(TaskerPage.profile),
      child: const Text('Quản lý hồ sơ Tasker'),
    ),
  ];
  Widget transaction(WalletTransaction item) => Panel(
    padding: 14,
    child: Row(
      children: [
        Icon(
          item.isWithdrawal ? Icons.south_east : Icons.south_west,
          color: item.amount < 0 ? AppColors.warning : AppColors.primary,
        ),
        const SizedBox(width: 11),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                item.title,
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              Text(
                '${dateLabel(item.at)} • ${item.status}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              if (item.taskId != null)
                Text(
                  'Gốc ${money(item.gross)} • Phí ${money(item.fee)}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              if (item.isWithdrawal)
                Text(
                  'Nhận ${money(item.gross)} • Phí ${money(item.fee)}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
            ],
          ),
        ),
        Text(
          '${item.amount < 0 ? '-' : '+'}${money(item.amount.abs())}',
          style: TextStyle(
            fontWeight: FontWeight.w800,
            color: item.amount < 0 ? AppColors.warning : AppColors.primary,
          ),
        ),
      ],
    ),
  );
  List<Widget> transactions() => [
    heading('Lịch sử giao dịch', 'Thu nhập và yêu cầu rút tiền mô phỏng.'),
    ...data.wallet.transactions.map(transaction),
    if (data.wallet.transactions.isEmpty)
      const EmptyState(
        'Chưa có giao dịch',
        'Thu nhập sẽ hiển thị sau khi công việc được thanh toán.',
      ),
  ];
  List<Widget> withdraw() {
    if (c.route.page == TaskerPage.withdrawResult) {
      return [
        const SizedBox(height: 36),
        const Center(
          child: Icon(Icons.check_circle, size: 76, color: AppColors.primary),
        ),
        heading(
          'Yêu cầu rút tiền đã được gửi',
          'Trạng thái đang xử lý trong dữ liệu demo.',
        ),
        Panel(
          child: Text(
            'Số tiền: ${money(c.withdrawalAmount)}\nTài khoản demo ••• 582\nKhông có kết nối ngân hàng thật.',
          ),
        ),
        PrimaryButton(
          'Xem lịch sử giao dịch',
          () => c.root(TaskerPage.transactions),
        ),
        OutlinedButton(
          onPressed: () => c.root(TaskerPage.wallet),
          child: const Text('Về Ví'),
        ),
      ];
    }
    return [
      heading('Rút tiền', 'Số dư có thể rút: ${money(data.wallet.available)}'),
      TextFormField(
        initialValue: c.withdrawalAmount.toString(),
        keyboardType: TextInputType.number,
        onChanged: (v) {
          c.withdrawalAmount = int.tryParse(v) ?? 0;
          c.changed();
        },
        decoration: const InputDecoration(
          labelText: 'Số tiền muốn rút',
          suffixText: 'đ',
        ),
      ),
      const SizedBox(height: 12),
      Wrap(
        spacing: 8,
        children: [
          ChoiceChip(
            label: const Text('Rút tiêu chuẩn • miễn phí'),
            selected: !c.instantWithdrawal,
            onSelected: (_) {
              c.instantWithdrawal = false;
              c.changed();
            },
          ),
          ChoiceChip(
            label: const Text('Rút nhanh • mô phỏng'),
            selected: c.instantWithdrawal,
            onSelected: (_) {
              c.instantWithdrawal = true;
              c.changed();
            },
          ),
        ],
      ),
      info(
        'Tài khoản nhận: Ngân hàng demo ••• 582. Không có chuyển tiền thật.',
      ),
      row(
        Icons.receipt,
        'Phí rút tiền',
        money(
          data.config.withdrawalFee(c.withdrawalAmount, c.instantWithdrawal),
        ),
      ),
      row(
        Icons.account_balance_wallet,
        'Tổng trừ ví',
        money(
          c.withdrawalAmount +
              data.config.withdrawalFee(
                c.withdrawalAmount,
                c.instantWithdrawal,
              ),
        ),
      ),
      PrimaryButton('Tiếp tục rút tiền', () async {
        final ok = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Xác nhận rút tiền mô phỏng'),
            content: Text(
              'Nhận ${money(c.withdrawalAmount)}\nPhí ${money(data.config.withdrawalFee(c.withdrawalAmount, c.instantWithdrawal))}',
            ),
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
        );
        if (ok == true) await c.withdraw();
      }),
    ];
  }

  List<Widget> profile() => [
    heading('Hồ sơ Tasker', 'Hoàn thiện hồ sơ để tăng cơ hội nhận việc.'),
    Panel(
      child: Row(
        children: [
          UserAvatar(
            data.profile.profile.name,
            data.profile.profile.avatar,
            radius: 34,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  data.profile.profile.name,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                Text(
                  '${data.profile.verified ? 'Đã xác minh' : 'Chưa xác minh'} • ★ ${data.profile.rating}',
                ),
                Text(
                  '${data.profile.completedJobs} việc • ${(data.profile.completionRate * 100).round()}% hoàn thành',
                ),
              ],
            ),
          ),
        ],
      ),
    ),
    menu(
      'Dịch vụ và lịch rảnh',
      Icons.tune,
      c.startServices,
      subtitle:
          '${data.profile.serviceIds.length} dịch vụ • ${data.profile.radius} km',
    ),
    menu(
      'Xác minh danh tính',
      Icons.verified_user_outlined,
      () => c.open(TaskerPage.verification),
      subtitle: data.profile.verified ? 'Đã xác minh (demo)' : 'Chưa xác minh',
    ),
    menu(
      'Ví thu nhập',
      Icons.account_balance_wallet_outlined,
      () => c.root(TaskerPage.wallet),
    ),
    menu(
      'Tin nhắn',
      Icons.chat_bubble_outline,
      () => c.open(TaskerPage.messages),
    ),
    menu('Cài đặt', Icons.settings_outlined, () => c.open(TaskerPage.settings)),
    menu('Lịch rảnh hàng tuần', Icons.calendar_month, c.startAvailability),
    menu(
      'Tiền đảm bảo hoàn lại',
      Icons.shield_outlined,
      () => c.open(TaskerPage.deposit),
    ),
    menu(
      'Đánh giá từ khách hàng',
      Icons.star_outline,
      () => c.open(TaskerPage.reviews),
    ),
    menu(
      'Trung tâm trợ giúp',
      Icons.help_outline,
      () => c.open(TaskerPage.help),
    ),
    if (widget.onSwitchCustomer != null)
      menu('Chuyển sang Customer', Icons.swap_horiz, widget.onSwitchCustomer!),
    if (c.demoMode)
      OutlinedButton.icon(
        onPressed: c.reset,
        icon: const Icon(Icons.restart_alt),
        label: const Text('Đặt lại toàn bộ phiên demo'),
      ),
  ];
  Widget menu(
    String title,
    IconData icon,
    VoidCallback action, {
    String? subtitle,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: ListTile(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      tileColor: Colors.white,
      leading: Icon(icon, color: AppColors.primary),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
      subtitle: subtitle == null ? null : Text(subtitle),
      trailing: const Icon(Icons.chevron_right),
      onTap: action,
    ),
  );
  List<Widget> services() => [
    heading('Dịch vụ và lịch rảnh', 'Chọn các việc bạn muốn nhận.'),
    Wrap(
      spacing: 8,
      runSpacing: 8,
      children: data.services
          .map(
            (service) => FilterChip(
              label: Text(service.name),
              selected: c.selectedServices.contains(service.id),
              onSelected: (v) {
                if (v) {
                  c.selectedServices.add(service.id);
                } else {
                  c.selectedServices.remove(service.id);
                }
                c.changed();
              },
            ),
          )
          .toList(),
    ),
    const SizedBox(height: 22),
    Text('Bán kính nhận việc', style: Theme.of(context).textTheme.titleMedium),
    Slider(
      value: c.selectedRadius.toDouble(),
      min: 1,
      max: 20,
      divisions: 19,
      label: '${c.selectedRadius} km',
      onChanged: (v) {
        c.selectedRadius = v.round();
        c.changed();
      },
    ),
    Center(child: Text('${c.selectedRadius} km')),
    info(
      'Lịch rảnh sáng / chiều / tối là cài đặt mô phỏng. Hệ thống không dùng vị trí thật.',
    ),
    PrimaryButton('Lưu thay đổi', c.saveServices),
  ];
  List<Widget> verification() => verificationFlow();
  List<Widget> messages() {
    if (c.route.page == TaskerPage.chat) {
      final chat = data.conversations.firstWhere(
        (item) => item.id == c.route.id,
      );
      return [
        Panel(
          color: AppColors.mint,
          child: Text(
            '${data.service(data.job(chat.taskId).draft.serviceId).name} • ${data.job(chat.taskId).id}',
          ),
        ),
        ...chat.messages.map(
          (message) => Align(
            alignment: message.mine
                ? Alignment.centerRight
                : Alignment.centerLeft,
            child: Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: message.mine ? AppColors.primary : Colors.white,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Text(
                message.text,
                style: TextStyle(
                  color: message.mine ? Colors.white : AppColors.navy,
                ),
              ),
            ),
          ),
        ),
        TextFormField(
          key: ValueKey('tasker-compose-${chat.id}-${chat.messages.length}'),
          onChanged: (v) => c.chatInput = v,
          decoration: InputDecoration(
            labelText: 'Nhắn tin cho ${data.customer.name}',
            suffixIcon: IconButton(
              tooltip: 'Gửi tin nhắn',
              onPressed: () => c.sendMessage(chat.id),
              icon: const Icon(Icons.send),
            ),
          ),
        ),
      ];
    }
    return [
      heading('Tin nhắn', 'Trao đổi theo từng công việc đã nhận.'),
      if (data.conversations.isEmpty)
        const EmptyState('Chưa có hội thoại', 'Chat mở khi bạn nhận công việc.')
      else
        ...data.conversations.map((chat) {
          final latest = chat.messages.last;
          return Panel(
            padding: 14,
            child: ListTile(
              contentPadding: EdgeInsets.zero,
              leading: UserAvatar(data.customer.name, data.customer.avatar),
              title: Text(data.customer.name),
              subtitle: Text(
                latest.text,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              trailing: Text(
                timeLabel(latest.at),
                style: Theme.of(context).textTheme.bodySmall,
              ),
              onTap: () => c.open(TaskerPage.chat, id: chat.id),
            ),
          );
        }),
    ];
  }

  List<Widget> notifications() => [
    heading('Thông báo', 'Cập nhật công việc và thu nhập.'),
    if (data.notifications.isEmpty)
      const EmptyState(
        'Chưa có thông báo',
        'Thông báo mới sẽ xuất hiện ở đây.',
        icon: Icons.notifications_none,
      )
    else
      ...data.notifications.map(
        (item) => Panel(
          padding: 14,
          color: item.read ? Colors.white : AppColors.mint,
          child: ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(
              Icons.notifications_active_outlined,
              color: AppColors.primary,
            ),
            title: Text(item.title),
            subtitle: Text(dateLabel(item.at)),
            onTap: () => c.readNotification(item),
          ),
        ),
      ),
  ];
  List<Widget> settings() => [
    heading('Cài đặt', 'Quản lý thông báo và dữ liệu demo.'),
    SwitchListTile(
      value: data.notificationEnabled,
      onChanged: c.setNotifications,
      title: const Text('Thông báo trong ứng dụng'),
      subtitle: const Text('Các cập nhật công việc mô phỏng.'),
    ),
    menu(
      'Trung tâm trợ giúp',
      Icons.help_outline,
      () => c.open(TaskerPage.help),
      subtitle: 'Thông tin chỉ để demo',
    ),
    menu(
      'Quyền riêng tư',
      Icons.privacy_tip_outlined,
      () => c.open(TaskerPage.help),
      subtitle: 'Không nhập thông tin nhạy cảm',
    ),
    if (widget.onSwitchCustomer != null)
      menu('Chuyển sang Customer', Icons.swap_horiz, widget.onSwitchCustomer!),
    if (c.demoMode)
      OutlinedButton.icon(
        onPressed: c.reset,
        icon: const Icon(Icons.restart_alt),
        label: const Text('Đặt lại toàn bộ phiên demo'),
      ),
  ];
}
