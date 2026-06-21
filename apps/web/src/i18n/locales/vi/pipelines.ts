export default {
  // Heading
  subtitle:
    'Nối các prompt thành luồng lặp lại — mỗi bước gắn một prompt với một model và chạy tự động hoặc dừng ở cổng.',
  showingRange: 'Hiển thị {{start}}–{{end}} trong {{total}} pipeline',

  // Toolbar / filters
  searchPlaceholder: 'Tìm pipeline…',
  filter: '+ Bộ lọc',
  filterLabel: 'Bộ lọc',
  filterAiOnly: 'Chỉ AI tạo',
  filterGate: 'Có cổng',
  gateHint: 'Cổng — dừng chờ phê duyệt',
  tags: 'Thẻ',
  noTags: 'Chưa có thẻ pipeline',
  createdBy: 'Người tạo',
  newPipeline: 'Pipeline mới',
  open: 'Mở',
  next: 'Sau',
  duplicateNamed: 'Nhân bản {{name}}',
  duplicateError: 'Không thể nhân bản pipeline',
  copyName: '{{name}} (bản sao)',

  // AI builder
  buildWithAi: 'Tạo bằng AI',
  buildWithAiTitle: 'Tạo pipeline bằng AI',
  buildWithAiHint:
    'Mô tả pipeline này cần làm gì — AI sẽ thiết kế từ thư viện prompt của bạn. Bạn có thể chỉnh sửa trước khi lưu.',
  goalPlaceholder: 'vd. Thu thập một cửa hàng, viết creative brief, rồi tạo hình ảnh thương hiệu',
  generate: 'Tạo',
  generating: 'Đang tạo…',
  generateError: 'Không thể tạo pipeline',
  aiBuilt: 'Tạo bởi AI',
  needsPrompt: 'Cần một prompt',

  // AI edit (revise an existing pipeline)
  editWithAi: 'Sửa bằng AI',
  builderLabel: 'Trình dựng',
  aiBuilder: 'AI builder',
  editWithAiTitle: 'Sửa pipeline này bằng AI',
  editWithAiHint:
    'Mô tả thay đổi — AI sẽ chỉnh sửa toàn bộ pipeline từ thư viện prompt của bạn. Xem lại trước khi lưu.',
  editGoalPlaceholder: 'vd. Thêm bước tạo ảnh sau bước branding; đặt bước 2 thành cổng duyệt',
  revise: 'Chỉnh sửa',
  applyToBuilder: 'Áp dụng vào trình dựng',
  send: 'Gửi',
  askPlaceholder: 'Mô tả pipeline, hoặc trả lời để tinh chỉnh…',

  // List states
  loading: 'Đang tải pipeline…',
  noMatch: 'Không có pipeline nào khớp với tìm kiếm của bạn.',
  emptyTitle: 'Tạo pipeline đầu tiên của bạn',
  emptyBody:
    'Nối các prompt thành một luồng — mỗi bước chạy một prompt trên model bạn chọn và đưa kết quả sang bước tiếp theo.',

  // Rows
  clickToRename: 'Nhấn để đổi tên',
  steps_one: '{{count}} bước',
  steps_other: '{{count}} bước',
  createdByName: 'Tạo bởi {{name}}',
  openPipeline: 'Mở pipeline',
  openNamed: 'Mở {{name}}',
  deletePipeline: 'Xóa pipeline',
  deleteNamed: 'Xóa {{name}}',

  // Pager
  prev: 'Trước',
  pageInfo: 'Trang {{page}} / {{totalPages}} · tổng {{total}}',

  // Delete confirm
  deleteConfirmTitle: 'Xóa pipeline?',
  deleteConfirmBefore: 'Pipeline ',
  deleteConfirmAfter:
    ' sẽ bị xóa. Các dự án đang dùng nó sẽ mất quyền truy cập. Hành động này không thể hoàn tác.',

  // Duplicate confirm
  duplicateConfirmTitle: 'Nhân bản pipeline?',
  duplicateConfirmBefore: 'Một bản sao của ',
  duplicateConfirmAfter: ' sẽ được tạo thành một pipeline mới mà bạn có thể chỉnh sửa.',

  // Errors
  updateError: 'Không thể cập nhật pipeline',
  deleteError: 'Không thể xóa pipeline',
  loadError: 'Không thể tải pipeline',
  createError: 'Không thể tạo pipeline',
  saveError: 'Không thể lưu pipeline',
  startTestError: 'Không thể bắt đầu chạy thử',
  pickPromptError: 'Hãy chọn một prompt cho bước này.',

  // Builder header / actions
  breadcrumbNew: 'Mới',
  namePlaceholder: 'Tên pipeline',
  notePlaceholder: 'Ghi chú (tùy chọn) — prompt có thể dùng qua {note}',
  defaultStepName: 'Bước',
  createTitle: 'Tạo pipeline',
  saveChanges: 'Lưu thay đổi',
  testHint: 'Chạy không gắn dự án · {note} lấy từ ghi chú',
  test: 'Chạy thử',
  testRunLabel: 'Chạy thử',
  testing: 'Đang chạy thử…',

  // Test run bar
  backToEditing: 'Quay lại chỉnh sửa',
  testRun: 'Lần chạy thử',

  // No prompts notice
  noPromptsBefore: 'Chưa có prompt nào — hãy ',
  noPromptsLink: 'tạo một prompt',
  noPromptsAfter: ' trước để thêm bước.',

  // Flow
  flowStart: 'Bắt đầu',
  flowEnd: 'Kết thúc',
  loadingCanvas: 'Đang tải canvas…',

  // Step drawer
  addStep: 'Thêm bước',
  editStep: 'Sửa bước',
  addStepTitle: 'Thêm bước',
  saveStepTitle: 'Lưu bước',

  // Fan-out
  fanOut: 'Phân nhánh',
  fanOutDesc: '— chạy bước này một lần cho mỗi mục trong một bộ sưu tập, song song với nhau',
  collectionName: 'Tên bộ sưu tập',
  collectionPlaceholder: 'ví dụ: images',
  fanOutHelpBefore: 'Mỗi mục sẽ điền vào ',
  fanOutHelpMid: ' (và ',
  fanOutHelpAfter: ') trong prompt. Bạn nhập các mục khi chạy.',

  // Condition
  condition: 'Điều kiện',
  conditionDesc: '— chỉ chạy bước này khi một biến thỏa điều kiện (nếu không thì bỏ qua)',
  when: 'khi',
  variablePlaceholder: 'biến',
  valuePlaceholder: 'giá trị',
  condOpExists: 'đã được đặt',
  condOpEmpty: 'để trống',
  condOpEq: 'bằng',
  condOpNe: 'khác',
  condOpContains: 'chứa',
  condOpGt: 'lớn hơn',
  condOpLt: 'nhỏ hơn',
} as const;
