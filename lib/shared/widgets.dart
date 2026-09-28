import 'package:flutter/material.dart';

import '../core/theme.dart';
import '../domain/models.dart';

class Panel extends StatelessWidget {
  const Panel({
    super.key,
    required this.child,
    this.color = Colors.white,
    this.padding = 18,
  });
  final Widget child;
  final Color color;
  final double padding;
  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    margin: const EdgeInsets.only(bottom: 16),
    padding: EdgeInsets.all(padding),
    decoration: BoxDecoration(
      color: color,
      borderRadius: BorderRadius.circular(AppRadius.card),
      border: Border.all(color: AppColors.border.withValues(alpha: .6)),
    ),
    child: Material(color: color, child: child),
  );
}

class PrimaryButton extends StatelessWidget {
  const PrimaryButton(this.label, this.onPressed, {super.key, this.icon});
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: SizedBox(
      width: double.infinity,
      child: FilledButton(
        onPressed: onPressed,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 20),
              const SizedBox(width: 8),
            ],
            Flexible(child: Text(label, textAlign: TextAlign.center)),
          ],
        ),
      ),
    ),
  );
}

class EmptyState extends StatelessWidget {
  const EmptyState(
    this.title,
    this.message, {
    super.key,
    this.action,
    this.icon = Icons.inbox_outlined,
  });
  final String title, message;
  final Widget? action;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Panel(
    child: Column(
      children: [
        const SizedBox(height: 20),
        Icon(icon, size: 52, color: AppColors.primary),
        const SizedBox(height: 16),
        Text(
          title,
          style: Theme.of(context).textTheme.titleLarge,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(message, textAlign: TextAlign.center),
        const SizedBox(height: 20),
        ?action,
      ],
    ),
  );
}

class UserAvatar extends StatelessWidget {
  const UserAvatar(this.name, this.asset, {super.key, this.radius = 24});
  final String name, asset;
  final double radius;
  @override
  Widget build(BuildContext context) => SizedBox(
    width: radius * 2,
    height: radius * 2,
    child: ClipOval(
      child: asset.isNotEmpty
          ? Image.asset(
              asset,
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => _fallback(),
            )
          : _fallback(),
    ),
  );
  Widget _fallback() => ColoredBox(
    color: AppColors.mint,
    child: Center(
      child: Text(
        name.isEmpty ? '?' : name.characters.first,
        style: const TextStyle(
          fontWeight: FontWeight.bold,
          color: AppColors.primary,
          fontSize: 22,
        ),
      ),
    ),
  );
}

class StatusChip extends StatelessWidget {
  const StatusChip(this.status, {super.key});
  final TaskStatus status;
  @override
  Widget build(BuildContext context) {
    final style = taskStatusStyles[status]!;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: style.color.withValues(alpha: .09),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(style.icon, size: 15, color: style.color),
          const SizedBox(width: 5),
          Flexible(
            child: Text(
              style.label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: style.color,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class PriceSummary extends StatelessWidget {
  const PriceSummary(this.price, {super.key});
  final PriceBreakdown price;
  @override
  Widget build(BuildContext context) => Panel(
    child: Column(
      children: [
        const Align(
          alignment: Alignment.centerLeft,
          child: Text(
            'Chi tiết chi phí',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 17),
          ),
        ),
        const SizedBox(height: 14),
        _row('Thù lao công việc', price.labor),
        _row('Dụng cụ', price.equipment),
        _row('Gói bảo vệ demo', price.protection),
        const Divider(height: 24),
        _row('Tổng thanh toán', price.total, bold: true),
      ],
    ),
  );
  Widget _row(String label, int value, {bool bold = false}) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 5),
    child: Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: TextStyle(
              fontWeight: bold ? FontWeight.w700 : FontWeight.w400,
            ),
          ),
        ),
        Text(
          money(value),
          style: TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: bold ? 20 : 14,
            color: bold ? AppColors.primary : AppColors.navy,
          ),
        ),
      ],
    ),
  );
}

class MockMap extends StatelessWidget {
  const MockMap(
    this.address, {
    super.key,
    this.eta,
    this.routePoints = const [],
  });
  final String address;
  final int? eta;
  final List<List<double>> routePoints;
  @override
  Widget build(BuildContext context) => Panel(
    color: AppColors.mint,
    child: Column(
      children: [
        SizedBox(
          height: 100,
          width: double.infinity,
          child: CustomPaint(painter: _MapPainter(routePoints)),
        ),
        const SizedBox(height: 8),
        Text(
          address,
          textAlign: TextAlign.center,
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        Text(
          eta == null
              ? 'Bản đồ minh họa • không dùng GPS'
              : 'Dự kiến $eta phút • vị trí mô phỏng',
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    ),
  );
}

class _MapPainter extends CustomPainter {
  _MapPainter(this.points);
  final List<List<double>> points;
  @override
  void paint(Canvas canvas, Size size) {
    final road = Paint()
      ..color = Colors.white
      ..strokeWidth = 12;
    for (var i = 1; i < 5; i++) {
      canvas.drawLine(
        Offset(size.width * i / 5, 0),
        Offset(size.width * i / 5 - 35, size.height),
        road,
      );
    }
    canvas.drawLine(
      Offset(0, size.height * .35),
      Offset(size.width, size.height * .55),
      road,
    );
    canvas.drawLine(
      Offset(0, size.height * .8),
      Offset(size.width, size.height * .7),
      road,
    );
    if (points.isEmpty) {
      return;
    }
    final path = Path()
      ..moveTo(size.width * points.first[0], size.height * points.first[1]);
    for (final point in points.skip(1)) {
      path.lineTo(size.width * point[0], size.height * point[1]);
    }
    canvas.drawPath(
      path,
      Paint()
        ..color = AppColors.primary
        ..strokeWidth = 5
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
    canvas.drawCircle(
      Offset(size.width * points.last[0], size.height * points.last[1]),
      10,
      Paint()..color = AppColors.primary,
    );
    canvas.drawCircle(
      Offset(size.width * points.first[0], size.height * points.first[1]),
      8,
      Paint()..color = AppColors.navy,
    );
  }

  @override
  bool shouldRepaint(covariant _MapPainter oldDelegate) =>
      oldDelegate.points != points;
}
