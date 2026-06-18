export default {
  greeting: 'Rất vui được gặp lại, {{name}}',
  workspaceMeta: '{{name}} · workspace {{type}} · bạn là {{role}}',
  noWorkspace: 'Chưa chọn workspace.',
  soon: 'Sắp có',
  chatsTitle: 'Trò chuyện',
  chatsBody:
    'Nơi bạn tạo prompt. Trò chuyện nhiều lượt với mọi nhà cung cấp·model, so sánh câu trả lời và lưu những prompt ưng ý vào thư viện. Mọi lượt đều được lưu tự động.',
  chatsCta: 'Bắt đầu trò chuyện',
  promptsTitle: 'Câu lệnh',
  promptsBody:
    'Thư viện các prompt tái sử dụng, đúng thương hiệu với media, thẻ và {placeholders}. Mở lại trong chat để tinh chỉnh, hoặc gắn vào một bước pipeline.',
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
} as const;
