part of 'tasker_view.dart';

extension _TaskerExtras on _TaskerViewState {
  List<Widget> extraScreens() {
    switch (c.route.page) {
      case TaskerPage.filters:
        return [
          heading('Tìm việc phù hợp'),
          DropdownButtonFormField<String>(
            initialValue: c.filterService,
            decoration: const InputDecoration(labelText: 'Dịch vụ'),
            items: [
              const DropdownMenuItem(value: '', child: Text('Tất cả')),
              ...data.services.map(
                (s) => DropdownMenuItem(value: s.id, child: Text(s.name)),
              ),
            ],
            onChanged: (v) {
              c.filterService = v ?? '';
              c.changed();
            },
          ),
          const SizedBox(height: 16),
          Text('Khoảng cách tối đa ${c.maxDistance.round()} km'),
          Slider(
            value: c.maxDistance,
            min: 1,
            max: 20,
            divisions: 19,
            onChanged: (v) {
              c.maxDistance = v;
              c.changed();
            },
          ),
          TextFormField(
            initialValue: '${c.minEarning}',
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Thu nhập tối thiểu'),
            onChanged: (v) {
              c.minEarning = int.tryParse(v) ?? 0;
              c.changed();
            },
          ),
          SwitchListTile(
            title: const Text('Chỉ việc hôm nay'),
            value: c.todayOnly,
            onChanged: (v) {
              c.todayOnly = v;
              c.changed();
            },
          ),
          PrimaryButton('Áp dụng (${c.filteredJobs.length} việc)', c.back),
          OutlinedButton(
            onPressed: () {
              c.filterService = '';
              c.minEarning = 0;
              c.maxDistance = 20;
              c.todayOnly = false;
              c.back();
            },
            child: const Text('Xóa bộ lọc'),
          ),
        ];
      case TaskerPage.availability:
        return [
          heading(
            'Lịch rảnh hàng tuần',
            'Các ca được lưu trong hồ sơ của phiên demo.',
          ),
          ...List.generate(
            7,
            (day) => Panel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(day == 6 ? 'Chủ nhật' : 'Thứ ${day + 2}'),
                  Wrap(
                    spacing: 8,
                    children: List.generate(3, (shift) {
                      final slot = day * 3 + shift;
                      return FilterChip(
                        label: Text(['Sáng', 'Chiều', 'Tối'][shift]),
                        selected: c.selectedSlots.contains(slot),
                        onSelected: (v) {
                          if (v) {
                            c.selectedSlots.add(slot);
                          } else {
                            c.selectedSlots.remove(slot);
                          }
                          c.changed();
                        },
                      );
                    }),
                  ),
                ],
              ),
            ),
          ),
          PrimaryButton('Lưu lịch rảnh', c.saveAvailability),
        ];
      case TaskerPage.deposit:
        final state = data.deposit;
        final labels = {
          DepositStatus.noDeposit: 'Chưa nộp',
          DepositStatus.pending: 'Đang xử lý',
          DepositStatus.active: 'Đang đảm bảo',
          DepositStatus.refundRequested: 'Đã yêu cầu hoàn lại',
          DepositStatus.refunded: 'Đã hoàn lại',
          DepositStatus.held: 'Đang tạm giữ',
        };
        final next = switch (state) {
          DepositStatus.noDeposit ||
          DepositStatus.refunded => DepositStatus.pending,
          DepositStatus.pending => DepositStatus.active,
          DepositStatus.active => DepositStatus.refundRequested,
          DepositStatus.refundRequested => DepositStatus.refunded,
          DepositStatus.held => null,
        };
        return [
          heading('Tiền đảm bảo hoàn lại', labels[state]),
          info(
            '${money(data.config.trustDepositAmount)} • Không phải phí. Đây là mô phỏng khoản đảm bảo bên ngoài ví thu nhập, không trừ tiền thật.',
          ),
          if (c.demoMode && next != null)
            PrimaryButton(switch (next) {
              DepositStatus.pending => 'Mô phỏng nộp đảm bảo',
              DepositStatus.active => 'Mô phỏng xác nhận đã nộp',
              DepositStatus.refundRequested => 'Yêu cầu hoàn lại',
              _ => 'Mô phỏng hoàn tiền thành công',
            }, () => c.deposit(next)),
          info(
            'Chính sách giữ/hoàn tiền thật sẽ do backend và người quản trị quyết định.',
          ),
        ];
      case TaskerPage.reviews:
        final jobs = data.myJobs.where((j) => j.review != null).toList();
        return [
          heading('Đánh giá từ khách hàng'),
          if (jobs.isEmpty)
            const EmptyState(
              'Chưa có đánh giá',
              'Đánh giá Customer sẽ xuất hiện sau thanh toán.',
            ),
          ...jobs.map(
            (j) => Panel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${j.id} • ${j.review!.stars}/5 sao'),
                  Text(j.review!.comment),
                  Text(j.review!.tags.join(' • ')),
                ],
              ),
            ),
          ),
        ];
      case TaskerPage.help:
        return [
          heading('Trung tâm trợ giúp'),
          ...data.config.help.entries.map(
            (e) => Panel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    e.key,
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Text(e.value),
                ],
              ),
            ),
          ),
        ];
      case TaskerPage.report:
        return [
          heading('Báo sự cố', job.id),
          DropdownButtonFormField<String>(
            initialValue: c.reportIssue,
            items: data.config.issues
                .map((i) => DropdownMenuItem(value: i, child: Text(i)))
                .toList(),
            onChanged: (v) => c.reportIssue = v!,
          ),
          const SizedBox(height: 12),
          TextFormField(
            maxLines: 4,
            decoration: const InputDecoration(labelText: 'Mô tả sự cố'),
            onChanged: (v) => c.reportNote = v,
          ),
          ...data.config.sampleImages.map(
            (asset) => CheckboxListTile(
              title: Text(asset.split('/').last),
              subtitle: const Text('Bằng chứng mẫu'),
              value: c.reportEvidence.contains(asset),
              onChanged: (v) {
                if (v == true) {
                  c.reportEvidence.add(asset);
                } else {
                  c.reportEvidence.remove(asset);
                }
                c.changed();
              },
            ),
          ),
          info(
            'Gửi báo cáo sẽ tạm dừng tiến trình thanh toán, chờ người hỗ trợ xem xét.',
          ),
          PrimaryButton('Gửi báo sự cố', () => c.report(job.id)),
        ];
      default:
        return [];
    }
  }

  List<Widget> verificationFlow() {
    final state = data.verification;
    final labels = {
      VerificationStatus.notVerified: 'Chưa xác minh',
      VerificationStatus.front: 'CCCD mặt trước',
      VerificationStatus.back: 'CCCD mặt sau',
      VerificationStatus.selfie: 'Ảnh selfie',
      VerificationStatus.pending: 'Chờ duyệt',
      VerificationStatus.verified: 'Đã xác minh',
      VerificationStatus.rejected: 'Cần bổ sung: ảnh mẫu chưa rõ',
    };
    final next = switch (state) {
      VerificationStatus.notVerified ||
      VerificationStatus.verified ||
      VerificationStatus.rejected => VerificationStatus.front,
      VerificationStatus.front => VerificationStatus.back,
      VerificationStatus.back => VerificationStatus.selfie,
      VerificationStatus.selfie => VerificationStatus.pending,
      VerificationStatus.pending => null,
    };
    return [
      heading('Xác minh danh tính', labels[state]),
      info(
        'Quy trình thử nghiệm: CCCD hai mặt → selfie → gửi hồ sơ → duyệt. Chỉ chọn tài liệu mẫu, không chụp hoặc lưu CCCD thật.',
      ),
      Panel(
        child: Column(
          children: [
            Icon(
              state == VerificationStatus.selfie
                  ? Icons.face
                  : Icons.badge_outlined,
              size: 90,
              color: AppColors.primary,
            ),
            const SizedBox(height: 12),
            Text(labels[state]!),
            const Text('TÀI LIỆU MẪU • DEMO'),
          ],
        ),
      ),
      if (c.demoMode && next != null)
        PrimaryButton(switch (state) {
          VerificationStatus.front => 'Dùng ảnh mẫu mặt trước',
          VerificationStatus.back => 'Dùng ảnh mẫu mặt sau',
          VerificationStatus.selfie => 'Dùng selfie mẫu & gửi hồ sơ',
          VerificationStatus.rejected => 'Bổ sung hồ sơ',
          _ => 'Bắt đầu xác minh mẫu',
        }, () => c.verify(next)),
      if (c.demoMode && state == VerificationStatus.pending) ...[
        PrimaryButton(
          'Mô phỏng duyệt hồ sơ',
          () => c.verify(VerificationStatus.verified),
        ),
        OutlinedButton(
          onPressed: () => c.verify(VerificationStatus.rejected),
          child: const Text('Mô phỏng yêu cầu bổ sung'),
        ),
      ],
    ];
  }
}
