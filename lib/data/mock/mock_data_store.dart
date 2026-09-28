import 'dart:async';

import '../../domain/models.dart';
import '../../domain/tasker_models.dart';
import '../../domain/task_policy.dart';

class MockDataStore {
  MockDataStore() {
    reset();
  }
  final _events = StreamController<void>.broadcast();
  Stream<void> get changes => _events.stream;
  void changed() => _events.add(null);
  void dispose() => _events.close();
  late TaskerProfile taskerProfile;
  bool taskerAuthenticated = false, taskerNotificationsEnabled = true;
  List<WalletTransaction> withdrawals = [];
  List<AppNotification> taskerNotifications = [];
  VerificationStatus verification = VerificationStatus.verified;
  DepositStatus deposit = DepositStatus.noDeposit;
  Set<int> availability = {};

  CustomerTask task(String id) => tasks.firstWhere(
    (t) => t.id == id,
    orElse: () => throw const RepositoryFailure('Không tìm thấy công việc.'),
  );
  void saveTask(CustomerTask item) {
    tasks[tasks.indexWhere((t) => t.id == item.id)] = item;
    changed();
  }

  void progress(String id) {
    final item = task(id);
    final next = TaskPolicy.progression[item.status];
    if (next == null) {
      throw const RepositoryFailure('Không thể chuyển trạng thái này.');
    }
    saveTask(
      item.update(
        status: next,
        timeline: [...item.timeline, TaskEvent(next, DateTime.now())],
      ),
    );
    event('Tiến trình ${item.id}: ${next.name}', id);
  }

  void assign(String id, String taskerId) {
    final item = task(id);
    if (item.taskerId != null ||
        !{TaskStatus.posted, TaskStatus.matching}.contains(item.status)) {
      throw const RepositoryFailure(
        'Việc đã được nhận hoặc không còn sẵn sàng.',
      );
    }
    saveTask(
      item.update(
        taskerId: taskerId,
        status: TaskStatus.accepted,
        timeline: [
          ...item.timeline,
          TaskEvent(TaskStatus.accepted, DateTime.now()),
        ],
      ),
    );
    conversations.insert(
      0,
      Conversation('chat-$id', id, taskerId, [
        ChatMessage(
          'hello-$id',
          'Mình đã nhận công việc, hẹn gặp bạn đúng giờ.',
          false,
          DateTime.now(),
        ),
      ], unread: 1),
    );
    event('Tasker đã nhận công việc', id);
  }

  void event(String title, String taskId) {
    final id = 'EV-${sequence++}';
    notifications.insert(0, AppNotification(id, title, taskId, DateTime.now()));
    taskerNotifications.insert(
      0,
      AppNotification(id, title, taskId, DateTime.now()),
    );
    changed();
  }

  void message(
    String conversationId,
    String text, {
    required bool fromCustomer,
  }) {
    if (text.trim().isEmpty) {
      throw const RepositoryFailure('Nhập tin nhắn trước khi gửi.');
    }
    final index = conversations.indexWhere((c) => c.id == conversationId);
    if (index < 0) throw const RepositoryFailure('Không tìm thấy hội thoại.');
    final chat = conversations[index];
    conversations[index] = Conversation(chat.id, chat.taskId, chat.taskerId, [
      ...chat.messages,
      ChatMessage('M-${sequence++}', text.trim(), fromCustomer, DateTime.now()),
    ], unread: chat.unread + 1);
    final target = fromCustomer ? taskerNotifications : notifications;
    target.insert(
      0,
      AppNotification(
        'MSG-${sequence++}',
        'Tin nhắn mới',
        chat.taskId,
        DateTime.now(),
      ),
    );
    changed();
  }

  late Profile profile;
  int generation = 0;
  late List<Address> addresses;
  late List<CustomerTask> tasks;
  late List<Conversation> conversations;
  late List<AppNotification> notifications;
  late List<Complaint> complaints;
  late List<PaymentMethod> methods;
  bool notificationEnabled = true;
  int sequence = 8500;
  final Map<String, String> postedRequests = {};
  String? phoneChallenge;
  DateTime? otpExpires;
  bool authenticated = false;
  bool paymentFails = false, matchesEmpty = false, requestFails = false;

  static const config = DemoConfig(
    phone: '0938000123',
    otp: '123456',
    aiExample: 'Mai 3 giờ chiều cần người dọn phòng 2 tiếng ở Thủ Đức',
    equipmentFee: 20000,
    protectionFee: 10000,
    etaMinutes: 8,
    ratingCategories: ['Chất lượng', 'Đúng giờ', 'Giao tiếp'],
    reviewTags: ['Cẩn thận', 'Thân thiện', 'Đúng yêu cầu', 'Sẽ đặt lại'],
    routePoints: [
      [.15, .72],
      [.5, .75],
      [.58, .45],
      [.8, .5],
    ],
    mapDescription: 'Võ Văn Ngân • Linh Chiểu • Thủ Đức',
    sampleImages: [
      'assets/images/room_before.png',
      'assets/images/room_after.png',
    ],
    issues: [
      'Chất lượng chưa đạt',
      'Tasker đến trễ',
      'Hư hại tài sản',
      'Vấn đề thanh toán',
      'Vấn đề khác',
    ],
    requirements: [
      'Có thú cưng',
      'Tầng 3 thang bộ',
      'Gọi trước khi đến',
      'Có chỗ gửi xe',
      'Hạn chế tiếng ồn',
    ],
    help: {
      'Demo này có trừ tiền không?': 'Không. Mọi giao dịch, ví và kết quả thanh toán đều là mô phỏng. Demo thu tiền một lần sau khi công việc hoàn tất.',
      'Tôi có thể hủy hoặc đổi lịch không?': 'Trong demo, bạn có thể hủy trước khi bắt đầu làm việc và đổi lịch trước khi Tasker đến. Không áp dụng phí hủy thật.',
      'Nếu công việc chưa đạt yêu cầu?': 'Mở hỗ trợ từ chi tiết công việc, mô tả vấn đề và đính kèm ảnh mẫu. Khiếu nại sẽ ở trạng thái chờ xử lý; không giải ngân khi đang tranh chấp.',
      'Dữ liệu được lưu ở đâu?': 'Dữ liệu demo chỉ giữ trong bộ nhớ của phiên chạy. Tải lại app hoặc đặt lại demo sẽ khôi phục dữ liệu mẫu.',
      'Quyền riêng tư & điều khoản demo': 'Không nhập dữ liệu nhạy cảm. GPS, AI, xác minh danh tính và ảnh đính kèm là mô phỏng; không có kết nối dịch vụ bên ngoài.',
    },
  );
  static const services = [
    Service(
      'cleaning',
      'Dọn phòng',
      'Phòng trọ & căn hộ mini',
      'cleaning',
      100000,
      'Không gian sạch sẽ, thêm thời gian cho bạn. Chọn thời lượng và các hạng mục cần hỗ trợ.',
      [
        'Quét và lau sàn',
        'Vệ sinh nhà tắm',
        'Lau bàn và kệ sách',
        'Thu gom rác',
      ],
    ),
    Service(
      'moving',
      'Chuyển trọ',
      'Bê đồ & sắp xếp',
      'moving',
      150000,
      'Hỗ trợ đóng gói và chuyển đồ giữa hai địa điểm.',
      ['Đóng gói đồ dùng', 'Bê và sắp xếp đồ', 'Kiểm tra đồ khi bàn giao'],
    ),
    Service(
      'assembly',
      'Lắp nội thất',
      'Bàn ghế, kệ sách',
      'assembly',
      100000,
      'Hỗ trợ lắp ráp đồ gia dụng theo hướng dẫn.',
      ['Kiểm tra phụ kiện', 'Lắp ráp', 'Kiểm tra độ chắc chắn'],
    ),
    Service(
      'shopping',
      'Mua hộ',
      'Đi chợ & nhu yếu phẩm',
      'shopping',
      40000,
      'Mua và giao vật dụng theo danh sách. Tiền hàng sẽ cần thỏa thuận riêng ngoài demo.',
      ['Đối chiếu danh sách', 'Giao hàng', 'Bàn giao hóa đơn'],
    ),
    Service(
      'delivery',
      'Giao đồ',
      'Nhận & giao nội thành',
      'delivery',
      30000,
      'Hỗ trợ giao nhận tại hai địa điểm bạn chọn.',
      ['Nhận hàng', 'Vận chuyển', 'Xác nhận bàn giao'],
    ),
    Service(
      'other',
      'Việc khác',
      'Theo nhu cầu của bạn',
      'other',
      80000,
      'Mô tả công việc để tìm người hỗ trợ phù hợp.',
      ['Thống nhất yêu cầu', 'Thực hiện', 'Bàn giao kết quả'],
    ),
  ];
  static const taskers = [
    Tasker(
      'minh-anh',
      'Minh Anh',
      'ĐH Sư Phạm Kỹ Thuật',
      4.9,
      320,
      1.2,
      96,
      'Cẩn thận, đúng giờ. Có kinh nghiệm dọn phòng trọ và căn hộ mini. Hồ sơ xác minh mô phỏng.',
      'assets/images/avatar.png',
    ),
    Tasker(
      'tuan-kiet',
      'Tuấn Kiệt',
      'ĐH Bách Khoa',
      4.8,
      184,
      2.4,
      92,
      'Hỗ trợ việc nhà, lắp ráp và chuyển đồ. Ưu tiên trao đổi rõ yêu cầu trước khi nhận.',
      '',
    ),
    Tasker(
      'thu-ha',
      'Thu Hà',
      'ĐH Kinh Tế',
      4.9,
      210,
      1.8,
      94,
      'Thân thiện và tỉ mỉ, sẵn sàng hỗ trợ công việc theo lịch hẹn.',
      '',
    ),
  ];

  void reset() {
    generation++;
    profile = const Profile(
      'Linh Nguyễn',
      '0938000123',
      'linh@example.test',
      'assets/images/avatar.png',
    );
    addresses = const [
      Address(
        'home',
        'Nhà trọ',
        '12 Võ Văn Ngân, Linh Chiểu, Thủ Đức',
        'Phòng 302, tầng 3; gọi trước khi đến.',
        isDefault: true,
      ),
      Address(
        'school',
        'Trường học',
        '1 Võ Văn Ngân, Thủ Đức',
        'Gặp ở cổng chính.',
      ),
    ];
    methods = const [
      PaymentMethod('momo', 'MoMo', 'Ví demo ••• 123'),
      PaymentMethod('bank', 'Ngân hàng', 'Tài khoản demo ••• 582'),
      PaymentMethod('visa', 'Visa', 'Thẻ demo ••• 8824'),
    ];
    final now = DateTime.now();
    tasks = [
      CustomerTask(
        id: 'TL-8492',
        draft: TaskDraft(
          serviceId: 'cleaning',
          address: addresses.first,
          scheduledAt: now.add(const Duration(hours: 1)),
          description: 'Dọn phòng trọ 25m², lau sàn, bàn học và nhà tắm.',
          images: [config.sampleImages.first],
          paymentMethodId: 'momo',
        ),
        price: const PriceBreakdown(
          labor: 200000,
          equipment: 0,
          protection: 10000,
        ),
        status: TaskStatus.onTheWay,
        taskerId: 'minh-anh',
        timeline: [
          TaskEvent(
            TaskStatus.posted,
            now.subtract(const Duration(minutes: 30)),
          ),
          TaskEvent(
            TaskStatus.matching,
            now.subtract(const Duration(minutes: 29)),
          ),
          TaskEvent(
            TaskStatus.accepted,
            now.subtract(const Duration(minutes: 20)),
          ),
          TaskEvent(
            TaskStatus.onTheWay,
            now.subtract(const Duration(minutes: 5)),
          ),
        ],
      ),
      CustomerTask(
        id: 'TL-8204',
        draft: TaskDraft(
          serviceId: 'assembly',
          address: addresses.first,
          scheduledAt: now.subtract(const Duration(days: 5)),
          description: 'Lắp kệ sách và bàn học.',
          paymentMethodId: 'visa',
        ),
        price: const PriceBreakdown(
          labor: 200000,
          equipment: 0,
          protection: 10000,
        ),
        status: TaskStatus.paid,
        taskerId: 'tuan-kiet',
        paymentStatus: PaymentStatus.paid,
        receipt: 'DEMO-8204',
        review: Review(
          'TL-8204',
          5,
          'Đúng giờ, cẩn thận. Cảm ơn bạn!',
          now.subtract(const Duration(days: 5)),
        ),
        timeline: [
          TaskEvent(TaskStatus.paid, now.subtract(const Duration(days: 5))),
        ],
      ),
    ];
    conversations = [
      Conversation('chat-TL-8492', 'TL-8492', 'minh-anh', [
        ChatMessage(
          'm1',
          'Chào chị Linh! Em đang trên đường tới, chị gửi thêm hướng dẫn vào nhà nhé.',
          false,
          now.subtract(const Duration(minutes: 2)),
        ),
      ], unread: 1),
    ];
    notifications = [
      AppNotification(
        'notice-1',
        'Minh Anh đang trên đường đến',
        'TL-8492',
        now,
      ),
    ];
    complaints = [];
    postedRequests.clear();
    sequence = 8500;
    authenticated = false;
    phoneChallenge = null;
    otpExpires = null;
    notificationEnabled = true;
    paymentFails = false;
    matchesEmpty = false;
    requestFails = false;
    taskerProfile = const TaskerProfile(
      profile: Profile('Minh Anh', '0987000111', 'minhanh@example.test', ''),
      rating: 4.9,
      completedJobs: 320,
      completionRate: .98,
      verified: true,
      online: true,
      serviceIds: [
        'cleaning',
        'assembly',
        'moving',
        'delivery',
        'shopping',
        'other',
      ],
      radius: 10,
    );
    taskerAuthenticated = false;
    taskerNotificationsEnabled = true;
    withdrawals = [];
    taskerNotifications = [];
    verification = VerificationStatus.verified;
    deposit = DepositStatus.noDeposit;
    availability = Set.of(List.generate(21, (i) => i));
    changed();
  }

  CustomerSnapshot snapshot() => CustomerSnapshot(
    sessionGeneration: generation,
    profile: profile,
    services: services,
    addresses: List.unmodifiable(addresses),
    taskers: taskers,
    tasks: List.unmodifiable(tasks),
    methods: List.unmodifiable(methods),
    conversations: List.unmodifiable(conversations),
    notifications: List.unmodifiable(notifications),
    complaints: List.unmodifiable(complaints),
    config: config,
    notificationEnabled: notificationEnabled,
  );
}
