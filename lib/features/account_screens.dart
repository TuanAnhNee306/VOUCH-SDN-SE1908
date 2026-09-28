part of 'customer_view.dart';

extension _AccountScreens on _CustomerViewState {
  List<Widget> communicationScreens() {
    if (c.route.page == PageId.notifications) {
      return [
        heading(
          'Cập nhật dành cho bạn',
          '${data.notifications.where((n) => !n.read).length} thông báo chưa đọc',
        ),
        if (data.notifications.isEmpty)
          const EmptyState(
            'Chưa có thông báo',
            'Cập nhật công việc sẽ xuất hiện tại đây.',
          ),
        ...data.notifications.map(
          (n) => menu(
            n.title,
            n.read
                ? Icons.notifications_none
                : Icons.notifications_active_outlined,
            () => c.readNotification(n),
            subtitle: '${n.taskId} • ${dateLabel(n.at)} ${timeLabel(n.at)}',
          ),
        ),
      ];
    }
    if (c.route.page == PageId.chat) {
      final chat = data.conversations.firstWhere(
        (item) => item.id == c.route.id,
      );
      final person = data.tasker(chat.taskerId);
      final task = data.task(chat.taskId);
      return [
        Panel(
          color: AppColors.mint,
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
                          '${data.service(task.draft.serviceId).name} • ${task.id}',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              StatusChip(task.status),
              TextButton(
                onPressed: () => c.open(PageId.task, id: task.id),
                child: const Text('Xem tiến trình công việc'),
              ),
            ],
          ),
        ),
        ...chat.messages.map(
          (message) => Align(
            alignment: message.mine
                ? Alignment.centerRight
                : Alignment.centerLeft,
            child: Container(
              constraints: const BoxConstraints(maxWidth: 390),
              margin: EdgeInsets.only(
                bottom: 14,
                left: message.mine ? 36 : 0,
                right: message.mine ? 0 : 36,
              ),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: message.mine ? AppColors.primary : Colors.white,
                borderRadius: BorderRadius.circular(18),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    message.text,
                    style: TextStyle(
                      color: message.mine ? Colors.white : AppColors.navy,
                      height: 1.5,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    timeLabel(message.at),
                    style: TextStyle(
                      fontSize: 11,
                      color: message.mine ? AppColors.mint : AppColors.muted,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: () {
            c.messageInput =
                'Địa chỉ công việc: ${task.draft.address.detail}. ${task.draft.address.note}';
            c.changed();
          },
          icon: const Icon(Icons.place_outlined),
          label: const Text('Điền vị trí công việc'),
        ),
        const SizedBox(height: 12),
        field(
          'Tin nhắn',
          c.messageInput,
          (v) => c.messageInput = v,
          lines: 2,
          key: ValueKey(
            'message-${chat.messages.length}-${c.messageInput.startsWith('Địa chỉ công việc:')}',
          ),
        ),
        PrimaryButton(
          'Gửi tin nhắn',
          () => c.sendMessage(chat.id),
          icon: Icons.send_outlined,
        ),
      ];
    }
    final chats = data.conversations.where(
      (chat) =>
          data
              .tasker(chat.taskerId)
              .name
              .toLowerCase()
              .contains(c.conversationSearch.toLowerCase()) ||
          chat.taskId.toLowerCase().contains(
            c.conversationSearch.toLowerCase(),
          ),
    );
    return [
      heading('Giữ kết nối,\nan tâm giao việc.'),
      field('Tìm tên hoặc mã công việc', c.conversationSearch, (v) {
        c.conversationSearch = v;
        c.changed();
      }),
      if (chats.isEmpty)
        const EmptyState(
          'Chưa có hội thoại phù hợp',
          'Chat mở sau khi bạn ghép Tasker. Thử từ khóa khác nếu đang tìm kiếm.',
        ),
      ...chats.map((chat) {
        final person = data.tasker(chat.taskerId);
        return InkWell(
          onTap: () => c.chatFor(chat.taskId),
          borderRadius: BorderRadius.circular(20),
          child: Panel(
            child: Row(
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
                        chat.taskId,
                        style: const TextStyle(
                          color: AppColors.primary,
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        chat.messages.lastOrNull?.text ??
                            'Bắt đầu cuộc trò chuyện',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                if (chat.unread > 0)
                  Padding(
                    padding: const EdgeInsets.only(left: 8),
                    child: Badge(label: Text('${chat.unread}')),
                  ),
              ],
            ),
          ),
        );
      }),
      info(
        'Tin nhắn trong bản demo chỉ lưu trong phiên chạy.',
        icon: Icons.chat_bubble_outline,
      ),
    ];
  }

  List<Widget> accountScreens() {
    switch (c.route.page) {
      case PageId.editProfile:
        return [
          heading('Thông tin của bạn'),
          field('Họ tên', c.profileName, (v) => c.profileName = v),
          field(
            'Số điện thoại',
            c.profilePhone,
            (v) => c.profilePhone = v,
            keyboard: TextInputType.phone,
          ),
          field(
            'Email',
            c.profileEmail,
            (v) => c.profileEmail = v,
            keyboard: TextInputType.emailAddress,
          ),
          PrimaryButton('Lưu thông tin', c.saveProfile),
        ];
      case PageId.addresses:
        return [
          heading(
            'Địa chỉ đã lưu',
            'Chọn địa chỉ mặc định để điền nhanh khi tạo công việc mới.',
          ),
          if (data.addresses.isEmpty)
            const EmptyState(
              'Chưa có địa chỉ',
              'Thêm nơi bạn thường cần hỗ trợ.',
            ),
          ...data.addresses.map(
            (a) => Panel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(a.label, style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 8),
                  Text(a.detail),
                  Text(a.note, style: Theme.of(context).textTheme.bodySmall),
                  if (a.isDefault)
                    const Chip(
                      label: Text('Mặc định'),
                      avatar: Icon(Icons.check, size: 16),
                    ),
                  Wrap(
                    spacing: 8,
                    children: [
                      TextButton(
                        onPressed: () => addressDialog(a),
                        child: const Text('Chỉnh sửa'),
                      ),
                      if (!a.isDefault)
                        TextButton(
                          onPressed: () => c.setDefaultAddress(a.id),
                          child: const Text('Đặt mặc định'),
                        ),
                      IconButton(
                        tooltip: 'Xóa địa chỉ',
                        onPressed: () async {
                          if (await confirm(
                            'Xóa địa chỉ?',
                            'Các công việc đã đăng vẫn giữ địa chỉ ban đầu.',
                          )) {
                            await c.deleteAddress(a.id);
                          }
                        },
                        icon: const Icon(Icons.delete_outline),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          PrimaryButton(
            'Thêm địa chỉ mới',
            () => addressDialog(null),
            icon: Icons.add_location_alt_outlined,
          ),
        ];
      case PageId.paymentMethods:
        return [
          heading(
            'Thanh toán theo cách của bạn',
            'Phương thức mô phỏng; không nhập số thẻ hoặc tài khoản thật.',
          ),
          if (data.methods.isEmpty)
            const EmptyState(
              'Chưa có phương thức',
              'Thêm phương thức demo để tiếp tục đặt việc.',
            ),
          ...data.methods.map(
            (m) => Panel(
              child: Row(
                children: [
                  const Icon(
                    Icons.account_balance_wallet_outlined,
                    color: AppColors.primary,
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          m.name,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        Text(m.detail),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: 'Xóa phương thức',
                    onPressed: () async {
                      if (await confirm(
                        'Xóa phương thức?',
                        'Bạn có thể thêm lại một phương thức demo sau.',
                      )) {
                        c.removePaymentMethod(m.id);
                      }
                    },
                    icon: const Icon(Icons.delete_outline),
                  ),
                ],
              ),
            ),
          ),
          PrimaryButton(
            'Thêm phương thức demo',
            paymentMethodDialog,
            icon: Icons.add_card,
          ),
        ];
      case PageId.reviews:
        final tasks = data.tasks.where((t) => t.review != null);
        return [
          heading('Những trải nghiệm đã chia sẻ'),
          if (tasks.isEmpty)
            const EmptyState(
              'Chưa có đánh giá',
              'Sau khi hoàn tất và thanh toán công việc, bạn có thể đánh giá Tasker.',
            ),
          ...tasks.map(
            (task) => Panel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    data.tasker(task.taskerId!).name,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  Text(
                    '${'★' * task.review!.stars} • ${dateLabel(task.review!.at)}',
                    style: const TextStyle(color: AppColors.primary),
                  ),
                  const SizedBox(height: 10),
                  Text(task.review!.comment),
                  if (task.review!.tags.isNotEmpty)
                    Wrap(
                      spacing: 6,
                      children: task.review!.tags
                          .map((tag) => Chip(label: Text(tag)))
                          .toList(),
                    ),
                  ...task.review!.categories.entries.map(
                    (entry) => Text('${entry.key}: ${entry.value}/5'),
                  ),
                  TextButton(
                    onPressed: () => c.open(PageId.task, id: task.id),
                    child: Text('Xem ${task.id}'),
                  ),
                ],
              ),
            ),
          ),
        ];
      case PageId.settings:
        return [
          heading('Thiết lập trải nghiệm'),
          Panel(
            child: SwitchListTile(
              contentPadding: EdgeInsets.zero,
              value: data.notificationEnabled,
              onChanged: c.setNotifications,
              title: const Text('Thông báo trong ứng dụng'),
              subtitle: const Text(
                'Tùy chọn demo được lưu trong phiên. Không đăng ký push thật.',
              ),
            ),
          ),
          menu(
            'Trợ giúp & quyền riêng tư',
            Icons.policy_outlined,
            () => c.open(PageId.help),
          ),
          if (c.demoMode) ...[
            section('Công cụ demo'),
            menu('Mô phỏng lỗi ở thao tác tiếp theo', Icons.wifi_off, () {
              c.demoControls?.failNextRequest();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text(
                    'Thao tác repository tiếp theo sẽ báo lỗi để kiểm tra retry.',
                  ),
                ),
              );
            }),
            menu('Đặt lại toàn bộ dữ liệu demo', Icons.restart_alt, () async {
              if (await confirm(
                'Đặt lại demo?',
                'Xóa các thay đổi trong phiên và khôi phục dữ liệu mẫu.',
              )) {
                c.resetDemo();
              }
            }),
          ],
        ];
      case PageId.help:
        return [
          heading(
            'Chúng tôi có thể giúp gì?',
            'Thông tin cho phiên trải nghiệm TaskLy',
          ),
          ...data.config.help.entries.map(
            (entry) => Panel(
              padding: 4,
              child: ExpansionTile(
                shape: const Border(),
                collapsedShape: const Border(),
                title: Text(
                  entry.key,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                children: [Text(entry.value)],
              ),
            ),
          ),
        ];
      default:
        final profile = data.profile;
        return [
          Panel(
            child: Column(
              children: [
                UserAvatar(profile.name, profile.avatar, radius: 42),
                const SizedBox(height: 14),
                Text(
                  profile.name,
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                Text(
                  profile.phone,
                  style: const TextStyle(color: AppColors.muted),
                ),
                const SizedBox(height: 16),
                Wrap(
                  alignment: WrapAlignment.center,
                  spacing: 16,
                  children: [
                    Chip(label: Text('${data.tasks.length} công việc')),
                    Chip(
                      label: Text(
                        '${data.tasks.where((t) => t.status == TaskStatus.paid).length} hoàn tất',
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          menu('Chỉnh sửa hồ sơ', Icons.person_outline, c.editProfile),
          menu(
            'Địa chỉ đã lưu',
            Icons.location_on_outlined,
            () => c.open(PageId.addresses),
            subtitle: '${data.addresses.length} địa chỉ',
          ),
          menu(
            'Phương thức thanh toán',
            Icons.account_balance_wallet_outlined,
            () => c.open(PageId.paymentMethods),
          ),
          menu(
            'Đánh giá của tôi',
            Icons.star_outline,
            () => c.open(PageId.reviews),
          ),
          menu(
            'Cài đặt',
            Icons.settings_outlined,
            () => c.open(PageId.settings),
          ),
          menu(
            'Trung tâm trợ giúp',
            Icons.support_agent,
            () => c.open(PageId.help),
          ),
          if (widget.onOpenTasker != null)
            menu(
              'Chuyển sang bản demo Tasker',
              Icons.swap_horiz,
              widget.onOpenTasker!,
              subtitle: 'Nhận việc, theo dõi tiến độ và ví thu nhập',
            ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: () async {
              if (await confirm(
                'Đăng xuất?',
                'Dữ liệu công việc vẫn còn trong phiên demo này.',
              )) {
                c.logout();
              }
            },
            icon: const Icon(Icons.logout),
            label: const Text('Đăng xuất'),
          ),
        ];
    }
  }

  Future<void> addressDialog(Address? address) async {
    String label = address?.label ?? '',
        detail = address?.detail ?? '',
        note = address?.note ?? '';
    final form = GlobalKey<FormState>();
    final result = await showDialog<Address>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(address == null ? 'Thêm địa chỉ' : 'Sửa địa chỉ'),
        content: SingleChildScrollView(
          child: Form(
            key: form,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  initialValue: label,
                  onChanged: (v) => label = v,
                  decoration: const InputDecoration(labelText: 'Tên địa chỉ'),
                  validator: (v) =>
                      v == null || v.trim().isEmpty ? 'Nhập tên địa chỉ' : null,
                ),
                const SizedBox(height: 14),
                TextFormField(
                  initialValue: detail,
                  onChanged: (v) => detail = v,
                  maxLines: 2,
                  decoration: const InputDecoration(
                    labelText: 'Địa chỉ chi tiết',
                  ),
                  validator: (v) => v == null || v.trim().length < 8
                      ? 'Nhập địa chỉ ít nhất 8 ký tự'
                      : null,
                ),
                const SizedBox(height: 14),
                TextFormField(
                  initialValue: note,
                  onChanged: (v) => note = v,
                  decoration: const InputDecoration(labelText: 'Ghi chú'),
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () {
              if (form.currentState!.validate()) {
                Navigator.pop(
                  ctx,
                  Address(
                    address?.id ?? '',
                    label,
                    detail,
                    note,
                    isDefault: address?.isDefault ?? false,
                  ),
                );
              }
            },
            child: const Text('Lưu địa chỉ'),
          ),
        ],
      ),
    );
    if (result != null) {
      await c.saveAddress(result);
    }
  }

  Future<void> paymentMethodDialog() async {
    String name = '', detail = '';
    final form = GlobalKey<FormState>();
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Phương thức demo'),
        content: SingleChildScrollView(
          child: Form(
            key: form,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  onChanged: (v) => name = v,
                  decoration: const InputDecoration(labelText: 'Tên hiển thị'),
                  validator: (v) =>
                      (v?.trim().isEmpty ?? true) ? 'Nhập tên' : null,
                ),
                const SizedBox(height: 14),
                TextFormField(
                  onChanged: (v) => detail = v,
                  decoration: const InputDecoration(
                    labelText: 'Nhãn nhận diện',
                    helperText: 'Không nhập số tài khoản thật',
                  ),
                  validator: (v) => (v?.trim().isEmpty ?? true)
                      ? 'Nhập nhãn nhận diện'
                      : null,
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () {
              if (form.currentState!.validate()) {
                Navigator.pop(ctx, true);
              }
            },
            child: const Text('Thêm'),
          ),
        ],
      ),
    );
    if (result == true) {
      await c.addPaymentMethod(name, detail);
    }
  }
}
