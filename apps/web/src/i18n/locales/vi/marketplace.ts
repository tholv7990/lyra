export default {
  // Page heading (sr-only landmark)
  heading: 'Chợ câu lệnh',
  subtitle: 'Duyệt câu lệnh cộng đồng, để AI tìm đúng cái bạn cần và thêm vào thư viện.',

  // AI filter
  aiPlaceholder: 'Mô tả nhu cầu của bạn…',
  aiRun: 'Tìm câu lệnh',
  aiRunning: 'Đang xếp hạng…',
  aiResultsFor: 'AI gợi ý cho “{{query}}”',
  aiHint: 'Xếp theo mức độ liên quan',
  browseAll: 'Xem tất cả',
  clear: 'Xóa',
  relevance: '{{score}}% phù hợp',

  // Browse mode
  searchPlaceholder: 'Tìm trong danh mục…',
  forDevs: 'Cho nhà phát triển',
  forDevsHint: 'Chỉ hiện câu lệnh dành cho lập trình viên',

  // Card
  by: 'bởi {{name}}',
  byUnknown: 'Cộng đồng',
  devBadge: 'Dev',
  typeText: 'Văn bản',
  typeStructured: 'Có cấu trúc',
  variables: 'Biến',
  view: 'Xem prompt',
  copy: 'Sao chép prompt',
  copied: 'Đã sao chép ✓',
  copiedToast: 'Đã sao chép “{{title}}” vào clipboard.',
  openInChat: 'Mở trong chat',
  add: 'Thêm vào thư viện',
  adding: 'Đang thêm…',
  added: 'Đã thêm ✓',
  openSource: 'Nguồn: {{source}}',

  // States
  loading: 'Đang tải danh mục…',
  emptyTitle: 'Danh mục chưa có gì',
  emptyBody: 'Khi câu lệnh cộng đồng được nhập, chúng sẽ hiện ở đây để bạn duyệt và thêm.',
  noMatch: 'Không có câu lệnh nào khớp với tìm kiếm.',
  noRanked: 'AI không tìm thấy kết quả phù hợp. Hãy thử mô tả khác.',
  error: 'Đã xảy ra lỗi. Vui lòng thử lại.',
  errRank: 'Không thể xếp hạng danh mục. Vui lòng thử lại.',
  errAdopt: 'Không thể thêm câu lệnh này vào thư viện.',
  adoptedToast: 'Đã thêm “{{title}}” vào thư viện.',

  // Refresh / sync (admin)
  refresh: 'Làm mới danh mục',
  refreshing: 'Đang làm mới…',
  refreshed: 'Đã nhập {{count}} câu lệnh.',
  refreshed_other: 'Đã nhập {{count}} câu lệnh.',

  // pager
  prev: 'Trước',
  next: 'Sau',
  pagerInfo: 'Trang {{page}}/{{totalPages}} · {{total}} tổng',
} as const;
