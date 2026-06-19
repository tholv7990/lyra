export default {
  greeting: 'Rất vui được gặp lại, {{name}}',
  workspaceMeta: '{{name}} · workspace {{type}} · bạn là {{role}}',
  noWorkspace: 'Chưa chọn workspace.',
  soon: 'Sắp có',
  chatsTitle: 'Trò chuyện',
  chatsBody:
    'Trợ lý AI luôn sẵn sàng — mở từ nút ở góc màn hình. Trò chuyện nhiều lượt với mọi nhà cung cấp·model, rồi lưu những câu trả lời nổi bật vào một prompt hoặc đưa một tin nhắn vào thư viện.',
  chatsCta: 'Bắt đầu trò chuyện',
  promptsTitle: 'Câu lệnh',
  promptsBody:
    'Thư viện các prompt tái sử dụng, đúng thương hiệu với media, thẻ, {placeholders} và những câu trả lời tốt nhất đã lưu từ chat. Mở trong chat để tinh chỉnh, hoặc gắn vào một bước pipeline.',
  promptsCta: 'Mở câu lệnh',
  pipelinesTitle: 'Quy trình',
  pipelinesBody:
    'Tạo các luồng bước tuyến tính — mỗi bước gắn một prompt với nhà cung cấp·model ở chế độ cổng hoặc tự động. Gán vào dự án và chạy; luồng sáng dần theo từng bước.',
  pipelinesCta: 'Mở quy trình',
  projectsTitle: 'Dự án',
  projectsBody:
    'Mỗi dự án cho một thương hiệu, sản phẩm hoặc cửa hàng. Nó cung cấp ngữ cảnh chạy ({product}, {niche}, {homepage}) và là nơi bạn gán pipeline và khởi chạy.',
  projectsCta: 'Mở dự án',
  keysTitle: 'Khóa nhà cung cấp',
  keysBody:
    'Dùng khóa nhà cung cấp của riêng bạn theo từng workspace, mã hóa khi lưu. Một bước chỉ chạy được khi đã đặt khóa của nhà cung cấp — khóa không bao giờ rời khỏi máy chủ.',
  keysCta: 'Quản lý khóa',
  membersTitle: 'Thành viên',
  membersBody:
    'Mời đồng đội qua email và quản lý vai trò. Dùng menu workspace (góc trên bên trái) để chuyển hoặc tạo workspace.',

  // ===== Danh sách bắt đầu nhanh =====
  gsTitle: 'Bắt đầu',
  gsSubtitle: 'Bốn bước đến lần chạy AI đầu tiên.',
  gsProgress: '{{done}} / {{total}}',
  gsDismiss: 'Ẩn',
  gsStepDone: 'Xong',
  gsKeysTitle: 'Thêm khóa nhà cung cấp',
  gsKeysBody:
    'Kết nối OpenAI, Anthropic hoặc nhà cung cấp khác để các bước có thể chạy. Khóa được mã hóa và không bao giờ rời khỏi máy chủ.',
  gsKeysCta: 'Thêm khóa',
  gsPromptTitle: 'Tạo một prompt',
  gsPromptBody: 'Trò chuyện với bất kỳ model nào, rồi lưu kết quả tốt nhất vào thư viện prompt.',
  gsPromptCta: 'Mở Trò chuyện',
  gsPipelineTitle: 'Dựng một pipeline',
  gsPipelineBody:
    'Nối các prompt thành một luồng — mỗi bước chọn một model và chạy tự động hoặc chờ bạn phê duyệt.',
  gsPipelineCta: 'Dựng pipeline',
  gsProjectTitle: 'Tạo dự án và chạy',
  gsProjectBody: 'Dự án giữ ngữ cảnh thương hiệu của bạn. Gán một pipeline và khởi chạy lần đầu.',
  gsProjectCta: 'Dự án mới',
} as const;
