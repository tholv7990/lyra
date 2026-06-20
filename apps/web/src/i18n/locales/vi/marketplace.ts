export default {
  // Page heading
  heading: 'Chợ câu lệnh',
  subtitle:
    'Danh mục câu lệnh có sẵn từ cộng đồng. Tìm một cái, rồi thêm vào thư viện workspace chỉ với một cú nhấp.',

  // Category pills + sort + result meta
  allCategories: 'Tất cả',
  sortLabel: 'Sắp xếp',
  sortNewest: 'Mới nhất',
  sortAz: 'A–Z',
  showingRange: 'Hiển thị {{start}}–{{end}} trong {{total}} câu lệnh',

  // AI filter
  aiSearch: 'AI',
  aiRank: 'Xếp hạng AI',
  aiBannerTitle: 'Xếp hạng AI đang bật.',
  aiBannerBody: 'Các thẻ được chấm điểm 0–100 theo tìm kiếm của bạn và sắp xếp theo mức phù hợp nhất.',
  match: 'Phù hợp',
  aiSearchHint: 'Tìm prompt phù hợp bằng AI (dùng nội dung tìm kiếm)',
  aiRunning: 'Đang xếp hạng…',
  aiResultsFor: 'AI gợi ý cho “{{query}}”',
  aiHint: 'Xếp theo mức độ liên quan',
  browseAll: 'Xem tất cả',
  clear: 'Xóa',
  relevance: '{{score}}% phù hợp',

  // Browse mode
  searchPlaceholder: 'Tìm trong danh mục…',
  aiPlaceholder: 'Mô tả điều bạn cần — AI sẽ xếp hạng danh mục…',

  // Browse filter popover (Type / For developers)
  filter: 'Bộ lọc',
  filterType: 'Loại',
  filterCategory: 'Danh mục',
  filterTags: 'Thẻ',
  filterForDevs: 'Cho nhà phát triển',
  preview: 'Xem trước',
  adopt: 'Thêm',
  done: 'Xong',

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
  confirmEmailToAdd: 'Xác nhận email để thêm',
  added: 'Đã thêm ✓',

  // Adopt confirmation
  confirmAddTitle: 'Thêm vào thư viện?',
  confirmAddBody: 'Thao tác này sao chép “{{title}}” vào thư viện prompt của workspace dưới dạng bản nháp có thể chỉnh sửa.',
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
