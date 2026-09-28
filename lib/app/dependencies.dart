import 'package:flutter/foundation.dart';

import '../data/mock/mock_customer_repository.dart';
import '../data/mock/mock_data_store.dart';
import '../data/mock/mock_tasker_repository.dart';
import 'customer_controller.dart';
import 'tasker_controller.dart';

// The only application binding that knows the concrete mock implementation.
CustomerController createCustomerController({MockDataStore? store}) {
  const demoMode = bool.fromEnvironment(
    'TASKLY_DEMO',
    defaultValue: kDebugMode,
  );
  final repository = MockCustomerRepository(store: store);
  return CustomerController(
    repository,
    demoMode: demoMode,
    demoControls: demoMode ? repository : null,
  );
}

TaskerController createTaskerController({MockDataStore? store}) {
  const demoMode = bool.fromEnvironment(
    'TASKLY_DEMO',
    defaultValue: kDebugMode,
  );
  return TaskerController(
    MockTaskerRepository(store: store, demoMode: demoMode),
    demoMode: demoMode,
  );
}
