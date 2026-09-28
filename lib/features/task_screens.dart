part of 'customer_view.dart';

extension _TaskScreens on _CustomerViewState {
  List<Widget> trackingScreen() {
    final task = data.task(c.route.id!);
    final person = data.tasker(task.taskerId!);
    final travelling = task.status == TaskStatus.onTheWay;
    final next = taskStatusStyles[task.status]!.nextLabel;
    return [
      heading('Theo dõi ${person.name}', task.id),
      StatusChip(task.status),
      const SizedBox(height: 16),
      MockMap(
        task.draft.address.detail,
        eta: travelling ? data.config.etaMinutes : null,
        routePoints: data.config.routePoints,
      ),
      Panel(
        child: Column(
          children: [
            detailRow(
              Icons.person_outline,
              'Người thực hiện',
              '${person.name} • ${person.school}',
            ),
            detailRow(
              Icons.place_outlined,
              travelling ? 'Khoảng cách mô phỏng' : 'Địa điểm công việc',
              travelling
                  ? '${person.distance} km • ${data.config.mapDescription}'
                  : task.draft.address.detail,
            ),
          ],
        ),
      ),
      PrimaryButton(
        'Nhắn tin cho Tasker',
        () => c.chatFor(task.id),
        icon: Icons.chat_bubble_outline,
      ),
      if (c.demoMode && next != null)
        Panel(
          color: AppColors.mint,
          child: Column(
            children: [
              const Text('Điều khiển demo • không phải GPS thật'),
              const SizedBox(height: 12),
              PrimaryButton(next, () => c.advance(task.id)),
            ],
          ),
        ),
      OutlinedButton(
        onPressed: () => c.taskRoot(task.id),
        child: const Text('Về chi tiết công việc'),
      ),
    ];
  }

  List<Widget> matchingScreens() {
    final task = data.task(c.route.id!);
    if (c.route.page == PageId.matched) {
      final person = data.tasker(task.taskerId!);
      return [
        const SizedBox(height: 24),
        const Icon(Icons.check_circle, size: 80, color: AppColors.primary),
        heading(
          'Đã tìm được người hỗ trợ!',
          '${person.name} đã nhận công việc của bạn.',
        ),
        taskerCard(
          person,
          () => c.open(PageId.tasker, id: task.id, extra: person.id),
        ),
        taskCard(task),
        info(
          'Lịch hẹn ${dateLabel(task.draft.scheduledAt)} lúc ${timeLabel(task.draft.scheduledAt)}. Tasker sẽ cập nhật khi bắt đầu di chuyển.',
        ),
        PrimaryButton('Xem tiến trình công việc', () => c.taskRoot(task.id)),
        OutlinedButton(
          onPressed: () => c.chatFor(task.id),
          child: const Text('Nhắn tin cho Tasker'),
        ),
      ];
    }
    if (c.route.page == PageId.tasker) {
      final person = data.tasker(c.route.extra!);
      return [
        Center(child: UserAvatar(person.name, person.avatar, radius: 52)),
        heading(person.name, person.school),
        taskerCard(person, null),
        info(
          'Hồ sơ xác minh mô phỏng • ${person.jobs} công việc • ${person.match}% phù hợp',
        ),
        section('Giới thiệu'),
        Panel(child: Text(person.bio)),
        section('Kỹ năng hỗ trợ'),
        Wrap(
          spacing: 8,
          children: data.services
              .take(3)
              .map((s) => Chip(label: Text(s.name)))
              .toList(),
        ),
        const SizedBox(height: 20),
        if (task.status == TaskStatus.matching)
          PrimaryButton('Chọn ${person.name}', () async {
            if (await confirm(
              'Xác nhận chọn Tasker?',
              '${person.name} sẽ thực hiện công việc ${task.id} theo lịch và chi phí đã thống nhất.',
            )) {
              await c.selectTasker(task.id, person.id);
            }
          }, icon: Icons.handshake_outlined)
        else
          PrimaryButton('Về chi tiết công việc', () => c.taskRoot(task.id)),
      ];
    }
    return [
      heading(
        c.busy ? 'Đang tìm Tasker phù hợp…' : 'Tasker được đề xuất',
        'Công việc ${task.id} • ${data.service(task.draft.serviceId).name}',
      ),
      if (c.busy)
        const Panel(
          color: AppColors.mint,
          child: Column(
            children: [
              SizedBox(height: 22),
              Icon(Icons.radar, size: 90, color: AppColors.primary),
              SizedBox(height: 16),
              Text('Đã đăng → Đang tìm → Bạn chọn Tasker'),
              SizedBox(height: 22),
            ],
          ),
        )
      else if (c.recommendations.isEmpty)
        EmptyState(
          'Chưa tìm thấy Tasker',
          'Bạn có thể tìm lại hoặc quay về chi tiết công việc để hủy yêu cầu.',
          icon: Icons.person_search_outlined,
          action: PrimaryButton('Tìm lại', () => c.findTaskers(task.id)),
        )
      else ...[
        info(
          'AI mô phỏng sắp xếp theo độ phù hợp. Hãy xem hồ sơ trước khi quyết định.',
        ),
        ...c.recommendations.map(
          (t) => taskerCard(
            t,
            () => c.open(PageId.tasker, id: task.id, extra: t.id),
          ),
        ),
      ],
      OutlinedButton(
        onPressed: () => c.taskRoot(task.id),
        child: const Text('Xem công việc đã đăng'),
      ),
      if (c.demoMode)
        TextButton(
          onPressed: () {
            c.demoControls?.noMatchesNextSearch();
            c.findTaskers(task.id);
          },
          child: const Text('Demo: không tìm thấy Tasker'),
        ),
    ];
  }

  List<Widget> taskList() {
    final now = DateTime.now();
    bool matches(CustomerTask task, int filter) =>
        TaskPolicy.bucket(task, now) == filter;
    const labels = ['Đang hoạt động', 'Sắp tới', 'Hoàn thành', 'Đã hủy'];
    final tasks = data.tasks.where((t) => matches(t, c.taskFilter));
    return [
      heading(
        'Mọi công việc,\ntrong một nơi.',
        '${data.tasks.length} công việc trong phiên demo',
      ),
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: List.generate(
            4,
            (i) => Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                label: Text(
                  '${labels[i]} (${data.tasks.where((t) => matches(t, i)).length})',
                ),
                selected: c.taskFilter == i,
                onSelected: (_) {
                  c.taskFilter = i;
                  c.changed();
                },
              ),
            ),
          ),
        ),
      ),
      const SizedBox(height: 20),
      if (tasks.isEmpty)
        EmptyState(
          'Chưa có công việc',
          'Công việc ở trạng thái này sẽ xuất hiện tại đây.',
          action: PrimaryButton('Tạo Task mới', () => c.startCreate()),
        )
      else
        ...tasks.map(taskCard),
    ];
  }

  List<Widget> taskDetail() {
    final task = data.task(c.route.id!);
    final person = task.taskerId == null ? null : data.tasker(task.taskerId!);
    final next = taskStatusStyles[task.status]!.nextLabel;
    return [
      Row(
        children: [
          Expanded(
            child: Text(
              task.id,
              style: const TextStyle(color: AppColors.muted),
            ),
          ),
          StatusChip(task.status),
        ],
      ),
      heading(data.service(task.draft.serviceId).name, task.draft.description),
      if (task.status == TaskStatus.onTheWay)
        MockMap(
          task.draft.address.detail,
          eta: data.config.etaMinutes,
          routePoints: data.config.routePoints,
        ),
      if ({
        TaskStatus.onTheWay,
        TaskStatus.arrived,
        TaskStatus.inProgress,
      }.contains(task.status))
        PrimaryButton(
          'Mở theo dõi Tasker',
          () => c.open(PageId.tracking, id: task.id),
          icon: Icons.map_outlined,
        ),
      if (person != null) ...[
        taskerCard(
          person,
          () => c.open(PageId.tasker, id: task.id, extra: person.id),
        ),
        PrimaryButton(
          'Nhắn tin cho ${person.name}',
          () => c.chatFor(task.id),
          icon: Icons.chat_bubble_outline,
        ),
      ],
      Panel(
        child: Column(
          children: [
            detailRow(
              Icons.calendar_today,
              'Thời gian',
              '${dateLabel(task.draft.scheduledAt)} • ${timeLabel(task.draft.scheduledAt)} • ${task.draft.duration} giờ',
            ),
            detailRow(
              Icons.place_outlined,
              'Địa chỉ',
              task.draft.address.detail,
            ),
            if (task.draft.destination.isNotEmpty)
              detailRow(
                Icons.flag_outlined,
                'Điểm đến',
                task.draft.destination,
              ),
            detailRow(
              Icons.notes,
              'Lưu ý',
              '${task.draft.address.note}\n${task.draft.note}'.trim(),
            ),
          ],
        ),
      ),
      section('Tiến trình thực tế'),
      Panel(
        child: Column(
          children: task.timeline
              .map(
                (event) => Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: Row(
                    children: [
                      Icon(
                        taskStatusStyles[event.status]!.icon,
                        color: AppColors.primary,
                        size: 24,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          taskStatusStyles[event.status]!.label,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                      ),
                      Text(
                        timeLabel(event.at),
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
              )
              .toList(),
        ),
      ),
      PriceSummary(task.price),
      info(
        task.paymentStatus == PaymentStatus.paid
            ? 'Đã thanh toán mô phỏng • ${task.receipt}'
            : 'Chưa thu tiền. Bạn sẽ thanh toán mô phỏng sau khi nghiệm thu.',
      ),
      if (task.status == TaskStatus.posted ||
          task.status == TaskStatus.matching)
        PrimaryButton('Xem Tasker được đề xuất', () {
          c.open(PageId.recommendations, id: task.id);
          c.findTaskers(task.id);
        }, icon: Icons.person_search),
      if (task.status == TaskStatus.completed) ...[
        section('Kết quả thực hiện'),
        imageStrip(
          task.completionImages.isEmpty
              ? data.config.sampleImages
              : task.completionImages,
        ),
        if (task.completionNote.isNotEmpty) info(task.completionNote),
        PrimaryButton('Nghiệm thu & thanh toán', () {
          c.checkedItems.clear();
          c.paymentMethodId = task.draft.paymentMethodId;
          c.open(PageId.payment, id: task.id);
        }, icon: Icons.fact_check_outlined),
      ],
      if (task.status == TaskStatus.paid) ...[
        if (task.review == null)
          PrimaryButton('Đánh giá Tasker', () {
            c.ratingStars = 0;
            c.ratingComment = '';
            c.categoryRatings.clear();
            c.reviewTags.clear();
            c.open(PageId.rating, id: task.id);
          }, icon: Icons.star_outline)
        else
          info(
            'Bạn đã đánh giá ${task.review!.stars}/5 sao. ${task.review!.comment}',
          ),
        OutlinedButton(
          onPressed: () => c.open(PageId.paymentSuccess, id: task.id),
          child: const Text('Xem biên nhận'),
        ),
        const SizedBox(height: 12),
        OutlinedButton(
          onPressed: () => c.startCreate(repeat: task),
          child: const Text('Đặt lại dịch vụ'),
        ),
      ],
      if (task.cancelReason != null)
        info(
          'Lý do hủy: ${task.cancelReason}. Không phát sinh giao dịch trong demo.',
        ),
      if (task.status == TaskStatus.disputed)
        ...data.complaints
            .where((caseItem) => caseItem.taskId == task.id)
            .map(
              (caseItem) => menu(
                'Theo dõi khiếu nại ${caseItem.id}',
                Icons.support_agent,
                () => c.open(PageId.complaintStatus, id: caseItem.id),
                subtitle: caseItem.status,
              ),
            ),
      if (TaskPolicy.cancellable.contains(task.status) ||
          TaskPolicy.reportable.contains(task.status))
        TextButton(
          onPressed: () => c.open(PageId.support, id: task.id),
          child: const Text('Báo sự cố / Hủy / Đổi lịch'),
        ),
      if (c.demoMode && next != null) ...[
        const Divider(height: 32),
        Panel(
          color: AppColors.mint,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'ĐIỀU KHIỂN DEMO',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Mô phỏng hành động của Tasker. Chỉ hiển thị trong chế độ demo.',
              ),
              const SizedBox(height: 14),
              PrimaryButton(
                next,
                () => c.advance(task.id),
                icon: Icons.skip_next,
              ),
            ],
          ),
        ),
      ],
    ];
  }

  List<Widget> paymentScreens() {
    final task = data.task(c.route.id!);
    final person = data.tasker(task.taskerId!);
    if (c.route.page == PageId.paymentSuccess) {
      return [
        const SizedBox(height: 20),
        const Icon(Icons.check_circle, color: AppColors.primary, size: 76),
        heading(
          'Thanh toán thành công',
          'Giao dịch mô phỏng • Không có tiền thật được chuyển',
        ),
        Panel(
          child: Column(
            children: [
              Text(
                money(task.price.total),
                style: const TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.w800,
                  color: AppColors.primary,
                ),
              ),
              detailRow(Icons.receipt_long, 'Mã giao dịch', task.receipt ?? ''),
              detailRow(Icons.assignment_outlined, 'Công việc', task.id),
              detailRow(
                Icons.account_balance_wallet_outlined,
                'Phương thức',
                data.methods
                        .where((m) => m.id == task.draft.paymentMethodId)
                        .firstOrNull
                        ?.name ??
                    task.draft.paymentMethodId,
              ),
            ],
          ),
        ),
        if (task.review == null)
          PrimaryButton(
            'Đánh giá Tasker',
            () => c.startRating(task.id),
            icon: Icons.star_outline,
          ),
        OutlinedButton(
          onPressed: () => c.taskRoot(task.id),
          child: const Text('Về công việc đã hoàn tất'),
        ),
      ];
    }
    if (c.route.page == PageId.ratingSuccess) {
      return [
        const Icon(Icons.favorite, size: 76, color: AppColors.primary),
        heading(
          'Cảm ơn bạn đã chia sẻ!',
          'Đánh giá giúp những khách hàng tiếp theo tìm được người phù hợp.',
        ),
        info(
          'Đã lưu đánh giá ${task.review?.stars ?? 0}/5 sao cho ${person.name}.',
        ),
        PrimaryButton('Xem công việc đã hoàn tất', () => c.taskRoot(task.id)),
        OutlinedButton(
          onPressed: () {
            c.taskFilter = 2;
            c.root(PageId.tasks);
          },
          child: const Text('Về Việc của tôi'),
        ),
      ];
    }
    if (c.route.page == PageId.rating) {
      return [
        Center(child: UserAvatar(person.name, person.avatar, radius: 44)),
        heading(
          'Bạn hài lòng thế nào?',
          'Đánh giá ${person.name} cho công việc ${task.id}',
        ),
        Wrap(
          alignment: WrapAlignment.center,
          children: List.generate(
            5,
            (i) => IconButton(
              tooltip: '${i + 1} sao',
              onPressed: () {
                c.ratingStars = i + 1;
                c.changed();
              },
              icon: Icon(
                i < c.ratingStars ? Icons.star : Icons.star_outline,
                size: 38,
                color: AppColors.primary,
              ),
            ),
          ),
        ),
        const SizedBox(height: 20),
        field(
          'Nhận xét của bạn',
          c.ratingComment,
          (v) => c.ratingComment = v,
          lines: 4,
          maxLength: 500,
        ),
        section('Đánh giá theo tiêu chí (tùy chọn)'),
        ...data.config.ratingCategories.map(
          (category) => Panel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  category,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                Wrap(
                  children: List.generate(
                    5,
                    (i) => IconButton(
                      tooltip: '$category: ${i + 1} sao',
                      onPressed: () {
                        c.categoryRatings[category] = i + 1;
                        c.changed();
                      },
                      icon: Icon(
                        i < (c.categoryRatings[category] ?? 0)
                            ? Icons.star
                            : Icons.star_outline,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        section('Điều bạn ấn tượng'),
        Wrap(
          spacing: 8,
          children: data.config.reviewTags
              .map(
                (tag) => FilterChip(
                  label: Text(tag),
                  selected: c.reviewTags.contains(tag),
                  onSelected: (selected) {
                    selected ? c.reviewTags.add(tag) : c.reviewTags.remove(tag);
                    c.changed();
                  },
                ),
              )
              .toList(),
        ),
        const SizedBox(height: 20),
        PrimaryButton('Gửi đánh giá', () => c.rate(task.id)),
        TextButton(
          onPressed: () => c.taskRoot(task.id),
          child: const Text('Đánh giá sau'),
        ),
      ];
    }
    final checklist = data.service(task.draft.serviceId).checklist;
    return [
      heading(
        'Kiểm tra trước khi thanh toán',
        'Hãy xác nhận các hạng mục đã hoàn thành.',
      ),
      section('Ảnh trước & sau (mẫu)'),
      imageStrip(
        [...task.draft.images, ...task.completionImages].isEmpty
            ? data.config.sampleImages
            : [...task.draft.images, ...task.completionImages],
      ),
      if (task.completionNote.isNotEmpty) info(task.completionNote),
      Panel(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${c.checkedItems.length}/${checklist.length} hạng mục đã kiểm tra',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            ...checklist.asMap().entries.map(
              (item) => CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                value: c.checkedItems.contains(item.key),
                title: Text(item.value),
                onChanged: (value) {
                  if (value == true) {
                    c.checkedItems.add(item.key);
                  } else {
                    c.checkedItems.remove(item.key);
                  }
                  c.changed();
                },
              ),
            ),
          ],
        ),
      ),
      PriceSummary(task.price),
      section('Chọn phương thức'),
      ...data.methods.map(
        (method) => methodTile(method, c.paymentMethodId, () {
          c.paymentMethodId = method.id;
          c.changed();
        }),
      ),
      if (data.methods.isEmpty)
        menu(
          'Thêm phương thức thanh toán',
          Icons.add_card,
          () => c.open(PageId.paymentMethods),
        ),
      info(
        'Bạn thanh toán một lần sau nghiệm thu. Đây là mô phỏng, không mở MoMo hay ứng dụng ngân hàng.',
      ),
      PrimaryButton(
        'Thanh toán demo • ${money(task.price.total)}',
        c.checkedItems.length == checklist.length ? () => c.pay(task.id) : null,
        icon: Icons.lock_outline,
      ),
      TextButton(
        onPressed: () => c.startComplaint(task.id),
        child: const Text('Công việc chưa đạt? Gửi khiếu nại'),
      ),
      if (c.demoMode)
        TextButton(
          onPressed: () {
            c.demoControls?.failNextPayment();
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text(
                  'Lần thanh toán tiếp theo sẽ thất bại để kiểm tra thử lại.',
                ),
              ),
            );
          },
          child: const Text('Demo: thanh toán thất bại lần tới'),
        ),
    ];
  }

  List<Widget> supportScreens() {
    if (c.route.page == PageId.complaintStatus) {
      final complaint = data.complaints.firstWhere((v) => v.id == c.route.id);
      return [
        heading('Đã tiếp nhận yêu cầu', complaint.id),
        info(complaint.status, icon: Icons.pending_actions),
        Panel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              detailRow(
                Icons.assignment_outlined,
                'Công việc',
                complaint.taskId,
              ),
              detailRow(Icons.help_outline, 'Vấn đề', complaint.issue),
              detailRow(Icons.notes, 'Mô tả', complaint.description),
              detailRow(
                Icons.schedule,
                'Ngày gửi',
                '${dateLabel(complaint.createdAt)} ${timeLabel(complaint.createdAt)}',
              ),
            ],
          ),
        ),
        imageStrip(complaint.evidence),
        info(
          'Trong demo, yêu cầu dừng ở trạng thái chờ xem xét. Không có Admin hay quyết định hoàn tiền tự động.',
        ),
        PrimaryButton('Quay về công việc', () => c.taskRoot(complaint.taskId)),
      ];
    }
    final task = data.task(c.route.id!);
    if (c.route.page == PageId.complaint) {
      return [
        heading('Hãy cho chúng tôi biết', 'Công việc ${task.id}'),
        section('Chọn vấn đề'),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: data.config.issues
              .map(
                (issue) => ChoiceChip(
                  label: Text(issue),
                  selected: c.complaintIssue == issue,
                  onSelected: (_) {
                    c.complaintIssue = issue;
                    c.changed();
                  },
                ),
              )
              .toList(),
        ),
        const SizedBox(height: 20),
        field(
          'Mô tả vấn đề',
          c.complaintText,
          (v) => c.complaintText = v,
          lines: 5,
          maxLength: 1000,
        ),
        section('Bằng chứng (${c.complaintEvidence.length}/4)'),
        imagePicker(c.complaintEvidence, c.changed),
        info(
          'Ảnh minh họa dùng cho demo. Khiếu nại sẽ chuyển công việc sang trạng thái đang tranh chấp.',
        ),
        PrimaryButton('Gửi yêu cầu hỗ trợ', () => c.submitComplaint(task.id)),
      ];
    }
    return [
      heading(
        'Bạn cần hỗ trợ gì?',
        'Công việc ${task.id} • ${money(task.price.total)}',
      ),
      if (TaskPolicy.canReschedule(task))
        menu(
          'Đổi lịch thực hiện',
          Icons.edit_calendar,
          () async {
            final day = await showDatePicker(
              context: context,
              initialDate: task.draft.scheduledAt.isBefore(DateTime.now())
                  ? DateTime.now()
                  : task.draft.scheduledAt,
              firstDate: DateTime.now(),
              lastDate: DateTime.now().add(const Duration(days: 365)),
            );
            if (day == null || !mounted) {
              return;
            }
            final time = await showTimePicker(
              context: context,
              initialTime: TimeOfDay.fromDateTime(task.draft.scheduledAt),
            );
            if (time != null) {
              await c.reschedule(
                task.id,
                DateTime(day.year, day.month, day.day, time.hour, time.minute),
              );
            }
          },
          subtitle:
              '${dateLabel(task.draft.scheduledAt)} • ${timeLabel(task.draft.scheduledAt)}',
        ),
      if (TaskPolicy.cancellable.contains(task.status))
        menu(
          'Hủy công việc',
          Icons.cancel_outlined,
          () => cancelTaskDialog(task),
          subtitle: 'Chưa thu tiền • không có phí hủy thật trong demo',
        ),
      if (TaskPolicy.reportable.contains(task.status))
        menu(
          'Báo sự cố / Khiếu nại',
          Icons.report_problem_outlined,
          () => c.startComplaint(task.id),
          subtitle: 'Mô tả, đính kèm bằng chứng và theo dõi xử lý',
        ),
      menu('Trung tâm trợ giúp', Icons.help_outline, () => c.open(PageId.help)),
      const SizedBox(height: 16),
      PrimaryButton('Về chi tiết công việc', () => c.taskRoot(task.id)),
    ];
  }

  Future<void> cancelTaskDialog(CustomerTask task) async {
    String reason = '';
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Hủy công việc?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Công việc chưa thanh toán. Hủy sẽ dừng quá trình thực hiện trong demo.',
            ),
            const SizedBox(height: 16),
            TextField(
              onChanged: (v) => reason = v,
              decoration: const InputDecoration(labelText: 'Lý do hủy'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Giữ công việc'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, reason),
            child: const Text('Xác nhận hủy'),
          ),
        ],
      ),
    );
    if (result != null) {
      await c.cancel(task.id, result);
      if (c.error == null) {
        c.taskRoot(task.id);
      }
    }
  }
}
