import 'package:flutter/material.dart';

import 'app/customer_controller.dart';
import 'app/dependencies.dart';
import 'app/tasker_controller.dart';
import 'core/theme.dart';
import 'features/customer_view.dart';
import 'features/tasker_view.dart';
import 'data/mock/mock_data_store.dart';

void main() {
  runApp(const TaskLyApp());
}

class TaskLyApp extends StatefulWidget {
  const TaskLyApp({super.key, this.controller, this.taskerController});
  final CustomerController? controller;
  final TaskerController? taskerController;
  @override
  State<TaskLyApp> createState() => _TaskLyAppState();
}

class _TaskLyAppState extends State<TaskLyApp> {
  final session = MockDataStore();
  late final CustomerController controller =
      widget.controller ?? createCustomerController(store: session);
  late final TaskerController taskerController =
      widget.taskerController ?? createTaskerController(store: session);
  bool taskerMode = false;
  @override
  void dispose() {
    if (widget.controller == null) {
      controller.dispose();
    }
    if (widget.taskerController == null) {
      taskerController.dispose();
    }
    super.dispose();
    session.dispose();
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'TaskLy',
    debugShowCheckedModeBanner: false,
    theme: AppTheme.light,
    home: taskerMode
        ? TaskerView(
            controller: taskerController,
            onSwitchCustomer: taskerController.demoMode
                ? () {
                    controller.refresh();
                    setState(() => taskerMode = false);
                  }
                : null,
          )
        : CustomerView(
            controller: controller,
            onOpenTasker: controller.demoMode
                ? () {
                    taskerController.refresh();
                    setState(() => taskerMode = true);
                  }
                : null,
          ),
  );
}
