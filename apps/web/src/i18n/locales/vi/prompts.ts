export default {
  // status
  statusDraft: 'Bản nháp',
  statusPublic: 'Công khai',

  // Prompts list — toolbar / filters
  searchPlaceholder: 'Tìm prompt…',
  filter: 'Bộ lọc',
  filterStatus: 'Trạng thái',
  filterType: 'Loại',
  filterCategory: 'Danh mục',
  filterTags: 'Thẻ',
  filterProvider: 'Nhà cung cấp',
  filterCreatedBy: 'Người tạo',
  noPromptTags: 'Chưa có thẻ prompt',
  newPrompt: 'Prompt mới',

  // Prompts list — states
  loadingPrompts: 'Đang tải prompt…',
  emptyTitle: 'Xây dựng thư viện prompt của bạn',
  emptyBody: 'Lưu các prompt tái sử dụng, gắn thẻ và dùng chúng làm bước trong pipeline.',
  emptyCta: 'Tạo prompt đầu tiên',
  noMatch: 'Không có prompt nào khớp với bộ lọc.',

  // Prompts list — rows
  clickToRename: 'Nhấp để đổi tên',
  viewFullPrompt: 'Xem toàn bộ prompt',
  viewFullPromptFor: 'Xem toàn bộ prompt của {{title}}',
  toggleStatus: 'Chuyển Bản nháp / Công khai',
  openInChat: 'Mở trong chat',
  openInChatNamed: 'Mở {{title}} trong chat',
  deletePrompt: 'Xóa prompt',
  deletePromptNamed: 'Xóa {{title}}',
  updatedBy: 'Cập nhật bởi {{name}}',

  // breadcrumb origin label
  breadcrumb: 'Prompt',

  // pager
  prev: 'Trước',
  pagerInfo: 'Trang {{page}} / {{totalPages}} · {{total}} tổng',

  // delete dialog
  deleteTitle: 'Xóa prompt?',
  deleteRemoved: 'sẽ bị xóa khỏi thư viện. Không thể hoàn tác.',
  deleteUsageWarn_one: 'Đang được {{count}} pipeline sử dụng — các bước đó sẽ bị bỏ trống.',
  deleteUsageWarn_other: 'Đang được {{count}} pipeline sử dụng — các bước đó sẽ bị bỏ trống.',

  // errors
  errUpdate: 'Không thể cập nhật prompt',
  errDelete: 'Không thể xóa prompt',
  errLoad: 'Không thể tải prompt',
  errSave: 'Không thể lưu prompt',
  errUpload: 'Không thể tải lên {{name}}',
  errFileType: '{{name}}: loại tệp không được phép',
  errFileSize: '{{name}}: vượt quá 25 MB',

  // Output type — metadata badge + filter (PromptType: text/image/audio/video)
  typeLabel: 'Loại',
  type: {
    text: 'Văn bản',
    image: 'Hình ảnh',
    audio: 'Âm thanh',
    video: 'Video',
  },

  // Category — top-level taxonomy (PromptCategory). Values are proper nouns,
  // shown as-is (not translated); only the field/option labels are localized.
  categoryLabel: 'Danh mục',
  categoryNone: 'Không',

  // PromptEditor
  newTitle: 'Mới',
  editName: 'Sửa tên',
  untitled: 'Prompt chưa đặt tên',
  promptTitlePlaceholder: 'Tiêu đề prompt',
  saveChanges: 'Lưu thay đổi',
  createPrompt: 'Tạo prompt',
  label: 'Nhãn',
  status: 'Trạng thái',
  publicHint: 'Prompt công khai có thể tái sử dụng trong toàn workspace',
  publicLabel: 'Công khai',
  writeHeading: 'Viết prompt của bạn',
  writeHint: 'Nhập bên dưới — bản xem trước hiển thị tại đây.',
  variables: 'Biến',
  variablesPipeline: 'và trong pipeline,',
  variablesPrevStep: 'bước trước',
  variablesOr: 'hoặc',
  variablesAnyStep: 'bất kỳ bước nào trước đó',
  addPrompt: 'Thêm prompt',
  saveShortcut: 'để lưu',
  charCount: '{{chars}} ký tự',
  onlyEditOwn: 'Bạn chỉ có thể sửa prompt do mình tạo.',
  unsavedTitle: 'Lưu thay đổi?',
  unsavedBody: 'Bạn có thay đổi chưa lưu. Nếu rời đi, chúng sẽ bị mất.',
  discardLeave: 'Bỏ & rời đi',

  // PromptDetails
  editPrompt: 'Sửa prompt',
  noContent: 'Không có nội dung.',
  createdBy: 'Tạo bởi {{name}}',

  // SaveAsPromptModal
  saveAsPrompt: 'Lưu thành prompt',
  title: 'Tiêu đề',
  titlePlaceholder: 'vd. Trình tạo tiêu đề hero',
  prompt: 'Prompt',
  saveToLibrary: 'Lưu vào thư viện',

  // PromptPicker
  noTagsYet: 'Chưa có thẻ.',
  filterByTags: 'Lọc theo thẻ',
  noPublicPrompts: 'Chưa có prompt công khai — hãy xuất bản một prompt để dùng trong bước.',
  noMatchFilters: 'Không có prompt nào khớp với bộ lọc.',
} as const;
