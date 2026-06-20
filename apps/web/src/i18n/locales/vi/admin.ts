export default {
  // Page header
  heading: 'Quản trị',
  subtitle: 'Vận hành nền tảng',
  notAuthorized: 'Bạn không có quyền truy cập trang này.',

  // Tabs
  tab: {
    overview: 'Tổng quan',
    users: 'Người dùng',
    requests: 'Yêu cầu',
    platform: 'Nền tảng',
  },

  // Requests
  requestsTitle: 'Yêu cầu người dùng',
  requestsDesc: 'Yêu cầu nhà cung cấp và, sau này, báo lỗi từ khắp nền tảng.',
  reqFilterType: 'Lọc theo loại',
  reqFilterStatus: 'Lọc theo trạng thái',
  reqAllTypes: 'Tất cả loại',
  reqAllStatuses: 'Tất cả trạng thái',
  reqType: {
    provider: 'Nhà cung cấp',
    bug: 'Lỗi',
    'team-upgrade': 'Nâng cấp nhóm',
  },
  reqStatus: {
    open: 'Đang mở',
    resolved: 'Đã xử lý',
    declined: 'Từ chối',
  },
  reqBy: 'Bởi {{name}} · {{date}}',
  reqWorkspace: 'Không gian {{id}}',
  reqVotes: 'Lượt bình chọn',
  reqEmptyTitle: 'Chưa có yêu cầu',
  reqEmptyBody: 'Chưa có gì để xử lý. Yêu cầu nhà cung cấp từ Cài đặt sẽ hiện ở đây.',

  // Overview
  overviewDesc: 'Tổng số liệu toàn nền tảng trên mọi không gian làm việc.',
  stat: {
    users: 'Người dùng',
    workspaces: 'Không gian làm việc',
    projects: 'Dự án',
    pipelines: 'Quy trình',
    prompts: 'Câu lệnh',
    runs: 'Lần chạy',
    chats: 'Trò chuyện',
    signups30d: 'Mới trong 30 ngày',
  },
  recentSignups: 'Đăng ký gần đây',
  noSignups: 'Chưa có đăng ký nào.',

  // Users list
  usersDesc: 'Mọi người có tài khoản trên bản cài đặt này.',
  searchUsers: 'Tìm theo tên hoặc email…',
  noUsersTitle: 'Không có người dùng',
  noUsersBody: 'Chưa có tài khoản nào được tạo.',
  noMatch: 'Không có người dùng nào khớp với tìm kiếm.',
  openUser: 'Mở {{name}}',
  joinedOn: 'Tham gia {{date}}',
  workspaceCount: '{{count}} không gian',
  workspaceCount_other: '{{count}} không gian',
  backToUsers: 'Người dùng',
  col: {
    email: 'Email',
    name: 'Tên',
    joined: 'Tham gia',
    workspaces: 'Không gian',
    status: 'Trạng thái',
  },
  active: 'Hoạt động',
  inactive: 'Ngừng hoạt động',
  prev: 'Trước',
  next: 'Sau',
  pagerInfo: 'Trang {{page}} / {{totalPages}} · tổng {{total}}',

  // User detail
  workspaces: 'Không gian làm việc',
  noWorkspaces: 'Không thuộc không gian làm việc nào.',
  usage: 'Sử dụng',
  role: {
    owner: 'Chủ sở hữu',
    member: 'Thành viên',
  },
  deactivate: 'Vô hiệu hóa',
  reactivate: 'Kích hoạt lại',
  deactivateTitle: 'Vô hiệu hóa người dùng',
  deactivateConfirm: 'Vô hiệu hóa',
  cantDeactivateSelf: 'Bạn không thể vô hiệu hóa tài khoản của chính mình.',

  // Prompt catalog card (Platform)
  catalogTitle: 'Danh mục câu lệnh',
  catalogDesc: 'Danh mục prompts.chat dùng chung cấp nguồn cho Chợ câu lệnh.',
  catalogCount: 'Câu lệnh trong danh mục',
  lastSynced: 'Đồng bộ lần cuối',
  neverSynced: 'Chưa bao giờ',
  sync: 'Đồng bộ danh mục prompts.chat',
  syncing: 'Đang đồng bộ…',
  imported: 'Đã nhập {{count}} câu lệnh.',
  imported_other: 'Đã nhập {{count}} câu lệnh.',

  // States
  loading: 'Đang tải…',
  error: 'Đã xảy ra lỗi. Vui lòng thử lại.',
} as const;
