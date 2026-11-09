import fs from "fs";
import path from "path";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, ShadingType } from "docx";
import PptxGenJS from "pptxgenjs";

// ─── 1. TẠO FILE WORD (.DOCX) CHUẨN HỌC THUẬT KHÔNG GHI "PHẦN 1, 2" ──────────────
async function createWordDocument() {
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }
          }
        },
        children: [
          // TRANG BÌA HỌC THUẬT
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "BỘ GIÁO DỤC VÀ ĐÀO TẠO", bold: true, size: 24, font: "Times New Roman" }),
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "TRƯỜNG ĐẠI HỌC THỦ DẦU MỘT - VIỆN CÔNG NGHỆ SỐ", bold: true, size: 26, font: "Times New Roman" }),
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 400 },
            children: [
              new TextRun({ text: "---------------------------------------", bold: true, size: 24, font: "Times New Roman" }),
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 600, after: 300 },
            children: [
              new TextRun({ text: "BÁO CÁO GIẢI TRÌNH ĐỀ TÀI ĐỒ ÁN TỐT NGHIỆP", bold: true, size: 32, color: "1B365D", font: "Times New Roman" }),
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 800 },
            children: [
              new TextRun({ text: "ĐỀ TÀI: XÂY DỰNG WEBSITE ĐỌC TRUYỆN TRANH TRỰC TUYẾN TÍCH HỢP GAMIFICATION RPG VÀ CHATBOT HỖ TRỢ NGƯỜI DÙNG", bold: true, size: 28, color: "00B4D8", font: "Times New Roman" }),
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 400, after: 100 },
            children: [
              new TextRun({ text: "   • Sinh viên thực hiện: ", bold: true, size: 26, font: "Times New Roman" }),
              new TextRun({ text: "Nguyễn Đình Đức", size: 26, font: "Times New Roman" }),
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 100, after: 100 },
            children: [
              new TextRun({ text: "   • Mã số sinh viên: ", bold: true, size: 26, font: "Times New Roman" }),
              new TextRun({ text: "2124802010233", size: 26, font: "Times New Roman" }),
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 100, after: 100 },
            children: [
              new TextRun({ text: "   • Lớp: ", bold: true, size: 26, font: "Times New Roman" }),
              new TextRun({ text: "D21CNTT04", size: 26, font: "Times New Roman" }),
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 100, after: 600 },
            children: [
              new TextRun({ text: "   • Giảng viên hướng dẫn: ", bold: true, size: 26, font: "Times New Roman" }),
              new TextRun({ text: "ThS. Võ Thị Diễm Hương", size: 26, font: "Times New Roman" }),
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 1000, after: 0 },
            children: [
              new TextRun({ text: "Bình Dương, Năm 2026", italic: true, size: 24, font: "Times New Roman" }),
            ]
          }),

          // MỤC I
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 600, after: 200 },
            children: [new TextRun({ text: "I. SẢN PHẨM CỦA ĐỀ TÀI", bold: true, size: 28, color: "1B365D", font: "Times New Roman" })]
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({ text: "Sản phẩm của đề tài là một ", font: "Times New Roman", size: 26 }),
              new TextRun({ text: "Hệ thống Website Đọc Truyện Tranh Trực Tuyến Toàn Diện (Full-stack Web Application)", bold: true, font: "Times New Roman", size: 26 }),
              new TextRun({ text: " tích hợp cơ chế Game hóa (Gamification RPG Irminsul) và Trợ lý Chatbot AI thông minh.", font: "Times New Roman", size: 26 }),
            ]
          }),
          new Paragraph({
            spacing: { after: 150 },
            children: [new TextRun({ text: "Sản phẩm bao gồm 4 thành phần nền tảng cốt lõi:", bold: true, font: "Times New Roman", size: 26 })]
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: "1. Nền tảng Web Frontend (React.js): ", bold: true, color: "00B4D8", font: "Times New Roman", size: 26 }),
              new TextRun({ text: "Giao diện hiện đại, responsive 100% trên PC và Mobile. Cung cấp trình đọc cuộn mượt mà, tối ưu dark mode, theo dõi, đánh giá, bình luận và hiển thị chỉ số RPG.", font: "Times New Roman", size: 26 })
            ]
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: "2. Server Backend & Database (Node.js & MySQL): ", bold: true, color: "00B4D8", font: "Times New Roman", size: 26 }),
              new TextRun({ text: "RESTful API kết nối Cơ sở dữ liệu MySQL local, lưu trữ hàng ngàn bộ truyện, danh sách chương, tài khoản người dùng, lịch sử đọc và dữ liệu RPG.", font: "Times New Roman", size: 26 })
            ]
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: "3. Gamified RPG Engine (Irminsul Core): ", bold: true, color: "00B4D8", font: "Times New Roman", size: 26 }),
              new TextRun({ text: "Động cơ tính toán điểm kinh nghiệm (XP), cấp độ (Level), danh hiệu (Title), điểm Cực Tinh (World Crystal), bản đồ Cây Thế Giới Irminsul và Cửa hàng linh vật 2D.", font: "Times New Roman", size: 26 })
            ]
          }),
          new Paragraph({
            spacing: { after: 300 },
            children: [
              new TextRun({ text: "4. Trợ lý Chatbot AI Thông Minh (Nahida AI): ", bold: true, color: "00B4D8", font: "Times New Roman", size: 26 }),
              new TextRun({ text: "Cửa sổ chat AI kết nối mô hình ngôn ngữ lớn (LLM), phân tích sở thích độc giả, gợi ý bộ truyện phù hợp, tóm tắt cốt truyện và giải đáp 24/7.", font: "Times New Roman", size: 26 })
            ]
          }),

          // MỤC II
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
            children: [new TextRun({ text: "II. PHÂN QUYỀN & 4 NHÓM NGƯỜI DÙNG", bold: true, size: 28, color: "1B365D", font: "Times New Roman" })]
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({ text: "Hệ thống được thiết kế phân quyền chặt chẽ thành ", font: "Times New Roman", size: 26 }),
              new TextRun({ text: "4 Nhóm Đối Tượng Người Dùng Chính:", bold: true, font: "Times New Roman", size: 26 })
            ]
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: "• 1. Độc Giả Mới (Guest): ", bold: true, font: "Times New Roman", size: 26 }),
              new TextRun({ text: "Người truy cập vãng lai chưa đăng ký hoặc chưa đăng nhập.", font: "Times New Roman", size: 26 })
            ]
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: "• 2. Độc Giả Thành Viên (Registered User / Player RPG): ", bold: true, font: "Times New Roman", size: 26 }),
              new TextRun({ text: "Người dùng đã tạo tài khoản (mặc định nhận danh xưng NEWBIE và bắt đầu hành trình cày XP RPG).", font: "Times New Roman", size: 26 })
            ]
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: "• 3. Dịch Giả / Nhóm Dịch (Translator / Content Creator): ", bold: true, color: "00B4D8", font: "Times New Roman", size: 26 }),
              new TextRun({ text: "Người đóng góp nội dung, chuyên dịch thuật các bộ truyện nước ngoài (Manga, Manhwa, Manhua) và đăng tải lên hệ thống.", font: "Times New Roman", size: 26 })
            ]
          }),
          new Paragraph({
            spacing: { after: 300 },
            children: [
              new TextRun({ text: "• 4. Quản Trị Viên (Super Admin): ", bold: true, font: "Times New Roman", size: 26 }),
              new TextRun({ text: "Người có quyền quản trị tối cao toàn bộ dữ liệu, tài khoản, kiểm duyệt truyện và vận hành công cụ cào tự động.", font: "Times New Roman", size: 26 })
            ]
          }),

          // MỤC III
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
            children: [new TextRun({ text: "III. CHỨC NĂNG CỤ THỂ CỦA TỪNG NHÓM NGƯỜI DÙNG", bold: true, size: 28, color: "1B365D", font: "Times New Roman" })]
          }),

          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
            children: [new TextRun({ text: "1. Nhóm Độc Giả Mới (Guest)", bold: true, size: 26, color: "00B4D8", font: "Times New Roman" })]
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: "• Tìm kiếm & Tìm duyệt truyện: ", bold: true, font: "Times New Roman", size: 26 }),
              new TextRun({ text: "Xem danh sách truyện mới, truyện nổi bật, tìm kiếm từ khóa, lọc thể loại (Manga, Manhua, Action...).", font: "Times New Roman", size: 26 })
            ]
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: "• Đọc truyện công khai: ", bold: true, font: "Times New Roman", size: 26 }),
              new TextRun({ text: "Xem nội dung các chương truyện với trình đọc mượt mà, xem bình luận và đánh giá.", font: "Times New Roman", size: 26 })
            ]
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({ text: "• Đăng ký & Đăng nhập: ", bold: true, font: "Times New Roman", size: 26 }),
              new TextRun({ text: "Tạo tài khoản mới (tự động gán Avatar NEWBIE và tạo hồ sơ Cây Thế Giới).", font: "Times New Roman", size: 26 })
            ]
          }),

          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
            children: [new TextRun({ text: "2. Nhóm Độc Giả Thành Viên (Player RPG)", bold: true, size: 26, color: "00B4D8", font: "Times New Roman" })]
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: "• Quản lý Trang Cá Nhân & Avatar: ", bold: true, font: "Times New Roman", size: 26 }),
              new TextRun({ text: "Đổi ảnh đại diện cá nhân hoặc chọn avatar Linh vật 2D; xem thanh kinh nghiệm XP, Level, Cực Tinh và danh hiệu.", font: "Times New Roman", size: 26 })
            ]
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: "• Tương tác Đọc truyện: ", bold: true, font: "Times New Roman", size: 26 }),
              new TextRun({ text: "Bấm Theo dõi (Follow), lưu Lịch sử đọc, Đánh giá 5 sao, Bình luận & Thả tim bình luận.", font: "Times New Roman", size: 26 })
            ]
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: "• Gamification RPG Irminsul: ", bold: true, font: "Times New Roman", size: 26 }),
              new TextRun({ text: "Đọc chương tích lũy điểm XP & Tri thức; Lên cấp mở khóa danh hiệu; Bản đồ Cây Thế Giới; Mua linh vật 2D trong Cửa hàng.", font: "Times New Roman", size: 26 })
            ]
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({ text: "• Trợ lý Chatbot AI (Nahida): ", bold: true, font: "Times New Roman", size: 26 }),
              new TextRun({ text: "Khung chat AI gợi ý truyện hợp gu cá nhân hóa, tóm tắt chương & giải thích tính năng RPG.", font: "Times New Roman", size: 26 })
            ]
          }),

          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
            children: [new TextRun({ text: "3. Nhóm Dịch Giả / Nhóm Dịch (Translator)", bold: true, size: 26, color: "00B4D8", font: "Times New Roman" })]
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: "• Khởi tạo & Đăng bộ truyện mới: ", bold: true, font: "Times New Roman", size: 26 }),
              new TextRun({ text: "Đăng tải bộ truyện dịch mới (Tên truyện, Tác giả gốc, Thể loại, Ảnh bìa, Tóm tắt nội dung).", font: "Times New Roman", size: 26 })
            ]
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: "• Đăng tải & Quản lý Chương: ", bold: true, font: "Times New Roman", size: 26 }),
              new TextRun({ text: "Upload bộ ảnh từng chương truyện do nhóm dịch biên soạn; Đặt tên tiêu đề chương.", font: "Times New Roman", size: 26 })
            ]
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: "• Translator Dashboard: ", bold: true, font: "Times New Roman", size: 26 }),
              new TextRun({ text: "Thống kê tổng lượt xem (Views), lượt theo dõi (Followers) và điểm đánh giá của các bộ truyện do nhóm mình đăng.", font: "Times New Roman", size: 26 })
            ]
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({ text: "• Đặc quyền RPG Dịch giả: ", bold: true, font: "Times New Roman", size: 26 }),
              new TextRun({ text: "Ghim bình luận thông báo, nhận danh hiệu độc quyền (Dịch Giả Uy Vũ, Nhóm Dịch Bậc Thầy) và điểm Cực Tinh thưởng theo lượt xem.", font: "Times New Roman", size: 26 })
            ]
          }),

          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
            children: [new TextRun({ text: "4. Nhóm Quản Trị Viên (Super Admin)", bold: true, size: 26, color: "00B4D8", font: "Times New Roman" })]
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: "• Kiểm duyệt Kho Truyện: ", bold: true, font: "Times New Roman", size: 26 }),
              new TextRun({ text: "Kiểm duyệt truyện do Dịch giả đăng, gỡ bỏ truyện vi phạm bản quyền/nội dung; Quản lý thể loại.", font: "Times New Roman", size: 26 })
            ]
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: "• Quản lý Thành viên & Phân quyền: ", bold: true, font: "Times New Roman", size: 26 }),
              new TextRun({ text: "Cấp quyền Dịch giả/Admin, cộng/trừ XP, khóa/mở khóa tài khoản vi phạm.", font: "Times New Roman", size: 26 })
            ]
          }),
          new Paragraph({
            spacing: { after: 300 },
            children: [
              new TextRun({ text: "• Công cụ cào tự động OTruyen API: ", bold: true, font: "Times New Roman", size: 26 }),
              new TextRun({ text: "Đồng bộ tự động hàng ngàn truyện và link CDN ảnh từ OTruyen API qua Dashboard & file sync-otruyen.bat.", font: "Times New Roman", size: 26 })
            ]
          }),

          // MỤC IV
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
            children: [new TextRun({ text: "IV. MINH CHỨNG YẾU TỐ TÊN ĐỀ TÀI TRÊN SẢN PHẨM", bold: true, size: 28, color: "1B365D", font: "Times New Roman" })]
          }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 35, type: WidthType.PERCENTAGE },
                    shading: { fill: "1B365D", type: ShadingType.CLEAR },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Yếu tố trong Tên Đề tài", bold: true, color: "FFFFFF", font: "Times New Roman", size: 24 })] })]
                  }),
                  new TableCell({
                    width: { size: 65, type: WidthType.PERCENTAGE },
                    shading: { fill: "1B365D", type: ShadingType.CLEAR },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Chứng minh thể hiện ở đâu trong Sản phẩm? (Minh chứng)", bold: true, color: "FFFFFF", font: "Times New Roman", size: 24 })] })]
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "1. Đọc truyện tranh trực tuyến", bold: true, font: "Times New Roman", size: 24 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "• Trang chủ, Trang Chi tiết & Trình đọc chương cuộn mượt mà.\n• Phân quyền Dịch giả tự đăng truyện & Script cào tự động sync-otruyen.bat.", font: "Times New Roman", size: 24 })] })] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "2. Tích hợp Gamification RPG", bold: true, font: "Times New Roman", size: 24 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "• ProfileCard (Level, XP, Danh hiệu, Cực Tinh).\n• Động cơ irminsulSystem.js tích XP khi đọc chương.\n• Danh hiệu riêng cho Dịch giả, Cây Thế Giới & Shop Linh vật 2D.", font: "Times New Roman", size: 24 })] })] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "3. Chatbot hỗ trợ người dùng", bold: true, font: "Times New Roman", size: 24 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "• Cửa sổ Chatbot AI Nahida nổi ở góc màn hình (AIChatWindow.jsx).\n• Phản hồi Tiếng Việt tự nhiên gợi ý truyện & hướng dẫn tính năng RPG.", font: "Times New Roman", size: 24 })] })] })
                ]
              })
            ]
          }),

          // MỤC V
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 500, after: 200 },
            children: [new TextRun({ text: "V. PHÂN TÍCH SẢN PHẨM MẪU TRÊN THỊ TRƯỜNG & ĐỊNH HƯỚNG NÂNG CẤP", bold: true, size: 28, color: "1B365D", font: "Times New Roman" })]
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({ text: "1. Khảo sát các sản phẩm đọc truyện mẫu thực tế trên thị trường: ", bold: true, font: "Times New Roman", size: 26 }),
              new TextRun({ text: "Trên thị trường hiện nay có các mô hình tiêu biểu như Nettruyen, TruyenQQ (Website truyền thống trong nước) và Kakao Webtoon, Naver Webtoon, MangaDEX (Nền tảng quốc tế).", font: "Times New Roman", size: 26 })
            ]
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({ text: "• Điểm mạnh của các sản phẩm mẫu: ", bold: true, color: "00B4D8", font: "Times New Roman", size: 26 }),
              new TextRun({ text: "Kho truyện khổng lồ, giao diện cuộn mượt mà, phân loại thể loại đa dạng và tốc độ tải trang nhanh.", font: "Times New Roman", size: 26 })
            ]
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({ text: "• Hạn chế của các sản phẩm mẫu: ", bold: true, color: "FF4D4F", font: "Times New Roman", size: 26 }),
              new TextRun({ text: "Thiếu tính tương tác dài hạn (chỉ có level tĩnh đơn điệu), tràn ngập quảng cáo che mắt độc giả, không có công cụ AI gợi ý truyện cá nhân hóa và chưa tạo động lực gắn kết cho cộng đồng dịch giả.", font: "Times New Roman", size: 26 })
            ]
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({ text: "2. Định hướng Nâng cấp Đột phá của Đề tài (Mộng Truyện Irminsul): ", bold: true, font: "Times New Roman", size: 26 }),
              new TextRun({ text: "Từ việc nghiên cứu sản phẩm mẫu, đề tài đã kế thừa ưu điểm đọc mượt mà và nâng cấp vượt trội 3 trụ cột:", font: "Times New Roman", size: 26 })
            ]
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: "   (+) Nâng cấp Gamification RPG: ", bold: true, color: "00B4D8", font: "Times New Roman", size: 26 }),
              new TextRun({ text: "Biến việc đọc truyện thành hành trình phiêu lưu cày XP, nâng Level, săn Danh hiệu và đổi Linh vật 2D độc quyền.", font: "Times New Roman", size: 26 })
            ]
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: "   (+) Nâng cấp Trợ lý AI Nahida: ", bold: true, color: "00B4D8", font: "Times New Roman", size: 26 }),
              new TextRun({ text: "Tương tác 24/7 gợi ý truyện theo gu đọc cá nhân và giải đáp cốt truyện.", font: "Times New Roman", size: 26 })
            ]
          }),
          new Paragraph({
            spacing: { after: 300 },
            children: [
              new TextRun({ text: "   (+) Nâng cấp Phân quyền Dịch giả & Cào tự động: ", bold: true, color: "00B4D8", font: "Times New Roman", size: 26 }),
              new TextRun({ text: "Trao quyền tự đăng truyện cho Dịch giả kết hợp công cụ sync-otruyen.bat nạp hàng ngàn bộ truyện tự động.", font: "Times New Roman", size: 26 })
            ]
          }),

          new Paragraph({
            spacing: { before: 400, after: 0 },
            children: [
              new TextRun({ text: " KẾT LUẬN: ", bold: true, color: "1B365D", font: "Times New Roman", size: 26 }),
              new TextRun({ text: "Sản phẩm tham khảo hợp lý từ mẫu thị trường và nâng cấp đột phá, đáp ứng 100% yêu cầu báo cáo đồ án tốt nghiệp.", italic: true, font: "Times New Roman", size: 26 })
            ]
          })
        ]
      }
    ]
  });

  try {
    const buffer = await Packer.toBuffer(doc);
    const outPath = "d:/AI/Bao_Cao_De_Cuong_Theo_Yeu_Cau_Co.docx";
    fs.writeFileSync(outPath, buffer);
    console.log("✅ Updated Word Document at:", outPath);
  } catch (e) {
    console.warn("⚠️ Khởi tạo file Word bị bỏ qua (file đang mở):", e.message);
  }
}

// ─── 2. TẠO FILE POWERPOINT (.PPTX) KHÔNG GHI "PHẦN 1, 2" & CHUẨN ĐẸP ────────────
async function createPowerPointPresentation() {
  const pptx = new PptxGenJS();

  pptx.defineLayout({ name: "MY_16x9", width: 13.333, height: 7.5 });
  pptx.layout = "MY_16x9";
  pptx.title = "Báo Cáo Đề Cương Tốt Nghiệp - Nguyễn Đình Đức";

  // SLIDE 1: BÌA HỌC THUẬT
  let s1 = pptx.addSlide();
  s1.background = { color: "0A192F" };
  s1.addText("TRƯỜNG ĐẠI HỌC THỦ DẦU MỘT - VIỆN CÔNG NGHỆ SỐ", { x: 0.8, y: 0.6, w: 11.73, h: 0.5, fontFace: "Arial", fontSize: 20, color: "90E0EF", align: "center", bold: true });
  s1.addText("BÁO CÁO GIẢI TRÌNH ĐỀ TÀI ĐỒ ÁN TỐT NGHIỆP", { x: 0.8, y: 1.6, w: 11.73, h: 0.8, fontFace: "Arial", fontSize: 30, color: "FFFFFF", align: "center", bold: true });
  s1.addText("XÂY DỰNG WEBSITE ĐỌC TRUYỆN TRANH TRỰC TUYẾN TÍCH HỢP GAMIFICATION RPG VÀ CHATBOT HỖ TRỢ NGƯỜI DÙNG", { x: 0.8, y: 2.7, w: 11.73, h: 1.2, fontFace: "Arial", fontSize: 22, color: "00B4D8", align: "center", bold: true });
  
  s1.addShape(pptx.ShapeType.rect, { x: 1.5, y: 4.4, w: 10.33, h: 2.1, fill: { color: "1B365D" }, line: { color: "00B4D8", width: 2 } });
  s1.addText("• Sinh viên thực hiện: Nguyễn Đình Đức (MSSV: 2124802010233 - Lớp: D21CNTT04)\n• Giảng viên hướng dẫn: ThS. Võ Thị Diễm Hương", { x: 1.8, y: 4.7, w: 9.73, h: 1.5, fontFace: "Arial", fontSize: 18, color: "FFFFFF", align: "center" });

  // SLIDE 2: SẢN PHẨM CỦA ĐỀ TÀI
  let s2 = pptx.addSlide();
  s2.background = { color: "0A192F" };
  s2.addText("I. SẢN PHẨM CỦA ĐỀ TÀI", { x: 0.8, y: 0.5, w: 11.73, h: 0.6, fontFace: "Arial", fontSize: 26, color: "00B4D8", bold: true });
  s2.addText("Hệ thống Website Đọc Truyện Tranh Trực Tuyến Toàn Diện tích hợp Gamification RPG & Chatbot AI", { x: 0.8, y: 1.2, w: 11.73, h: 0.4, fontFace: "Arial", fontSize: 16, color: "CCCCCC" });

  const compBox = [
    { title: "1. WEB FRONTEND (React.js)", desc: "Giao diện hiện đại, 100% Responsive trên PC & Mobile. Trình đọc cuộn mượt mà." },
    { title: "2. BACKEND & DATABASE", desc: "API Node.js/Express & CSDL MySQL lưu trữ hàng ngàn truyện, chương & dữ liệu RPG." },
    { title: "3. GAMIFIED RPG ENGINE", desc: "Tích điểm XP, tăng Cấp, Danh hiệu, Cực Tinh, Cây Thế Giới & Shop Linh vật 2D." },
    { title: "4. CHATBOT AI NAHIDA", desc: "Trợ lý AI nổi gợi ý truyện theo sở thích độc giả & giải đáp thắc mắc 24/7." }
  ];

  compBox.forEach((b, idx) => {
    const xPos = (idx % 2 === 0) ? 0.8 : 6.8;
    const yPos = (idx < 2) ? 1.8 : 4.4;
    s2.addShape(pptx.ShapeType.rect, { x: xPos, y: yPos, w: 5.7, h: 2.3, fill: { color: "1B365D" }, line: { color: "00B4D8", width: 1.5 } });
    s2.addText(b.title, { x: xPos + 0.3, y: yPos + 0.25, w: 5.1, h: 0.45, fontFace: "Arial", fontSize: 17, color: "90E0EF", bold: true });
    s2.addText(b.desc, { x: xPos + 0.3, y: yPos + 0.75, w: 5.1, h: 1.35, fontFace: "Arial", fontSize: 14, color: "FFFFFF" });
  });

  // SLIDE 3: 4 NHÓM NGƯỜI DÙNG & CHỨC NĂNG
  let s3 = pptx.addSlide();
  s3.background = { color: "0A192F" };
  s3.addText("II & III. 4 NHÓM ĐỐI TƯỢNG NGƯỜI DÙNG & CHỨC NĂNG", { x: 0.8, y: 0.5, w: 11.73, h: 0.6, fontFace: "Arial", fontSize: 24, color: "00B4D8", bold: true });

  const groups = [
    { title: "1. ĐỘC GIẢ MỚI", desc: "• Chưa có tài khoản.\n• Duyệt truyện, lọc thể loại, đọc chương công khai.\n• Đăng ký tài khoản mới." },
    { title: "2. THÀNH VIÊN RPG", desc: "• Đã có tài khoản.\n• Cày XP, lên cấp, danh hiệu.\n• Theo dõi, Bình luận, Đánh giá & Chat AI." },
    { title: "3. DỊCH GIẢ / NHÓM DỊCH", desc: "• Đóng góp nội dung.\n• Đăng truyện dịch mới, quản lý chương.\n• Thống kê lượt đọc & Danh hiệu Dịch giả." },
    { title: "4. QUẢN TRỊ VIÊN", desc: "• Quyền Super Admin.\n• Kiểm duyệt nội dung truyện.\n• Quản lý User & Công cụ cào tự động." }
  ];

  groups.forEach((g, idx) => {
    const xPos = 0.8 + idx * 2.95;
    s3.addShape(pptx.ShapeType.rect, { x: xPos, y: 1.5, w: 2.8, h: 5.3, fill: { color: "1B365D" }, line: { color: "00B4D8", width: 2 } });
    s3.addText(g.title, { x: xPos + 0.1, y: 1.7, w: 2.6, h: 0.6, fontFace: "Arial", fontSize: 15, color: "90E0EF", align: "center", bold: true });
    s3.addText(g.desc, { x: xPos + 0.15, y: 2.5, w: 2.5, h: 4.1, fontFace: "Arial", fontSize: 13, color: "FFFFFF" });
  });

  // SLIDE 4: CHỨNG MINH TÊN ĐỀ TÀI
  let s4 = pptx.addSlide();
  s4.background = { color: "0A192F" };
  s4.addText("IV. MINH CHỨNG YẾU TỐ TÊN ĐỀ TÀI TRÊN SẢN PHẨM", { x: 0.8, y: 0.5, w: 11.73, h: 0.6, fontFace: "Arial", fontSize: 24, color: "00B4D8", bold: true });

  const proof = [
    { key: "1. Đọc truyện tranh trực tuyến", proof: "• Trang chủ, Chi tiết truyện & Trình đọc chương mượt mà.\n• Quyền Dịch giả tự đăng truyện & Script cào tự động sync-otruyen.bat." },
    { key: "2. Tích hợp Gamification RPG", proof: "• ProfileCard (Level, XP, Danh hiệu, Cực Tinh).\n• Động cơ irminsulSystem.js tích XP khi đọc chương.\n• Shop Linh vật 2D & Danh hiệu riêng cho Dịch giả." },
    { key: "3. Chatbot AI hỗ trợ", proof: "• Cửa sổ Chatbot AI Nahida nổi ở góc màn hình (AIChatWindow).\n• Phản hồi Tiếng Việt tự nhiên gợi ý truyện & hướng dẫn tính năng RPG." }
  ];

  proof.forEach((p, idx) => {
    const yPos = 1.4 + idx * 1.8;
    s4.addShape(pptx.ShapeType.rect, { x: 0.8, y: yPos, w: 3.8, h: 1.5, fill: { color: "00B4D8" } });
    s4.addText(p.key, { x: 0.9, y: yPos + 0.3, w: 3.6, h: 0.9, fontFace: "Arial", fontSize: 16, color: "0A192F", bold: true });

    s4.addShape(pptx.ShapeType.rect, { x: 4.8, y: yPos, w: 7.7, h: 1.5, fill: { color: "1B365D" }, line: { color: "00B4D8", width: 1 } });
    s4.addText(p.proof, { x: 5.0, y: yPos + 0.15, w: 7.3, h: 1.2, fontFace: "Arial", fontSize: 13, color: "FFFFFF" });
  });

  // SLIDE 5: PHÂN TÍCH SẢN PHẨM MẪU THỊ TRƯỜNG & ĐỊNH HƯỚNG NÂNG CẤP
  let s5 = pptx.addSlide();
  s5.background = { color: "0A192F" };
  s5.addText("V. PHÂN TÍCH SẢN PHẨM MẪU THỊ TRƯỜNG & NÂNG CẤP", { x: 0.8, y: 0.5, w: 11.73, h: 0.6, fontFace: "Arial", fontSize: 24, color: "00B4D8", bold: true });

  const marketCards = [
    { title: "📌 KHẢO SÁT SẢN PHẨM MẪU THỰC TẾ", desc: "• Các mẫu thị trường: Nettruyen, TruyenQQ (Website Việt Nam), Kakao Webtoon, MangaDEX (Quốc tế).\n• Điểm hay học hỏi: Kho truyện phong phú, giao diện cuộn mượt mà, phân loại thể loại đa dạng." },
    { title: "⚠️ HẠN CHẾ CỦA THỊ TRƯỜNG", desc: "• Thiếu tính tương tác dài hạn (chỉ có level 1-6 tĩnh đơn điệu).\n• Tràn ngập quảng cáo che mắt người đọc.\n• Chưa có công cụ AI hỗ trợ gợi ý truyện cá nhân hóa." },
    { title: "🚀 NÂNG CẤP ĐỘT PHÁ CỦA ĐỀ TÀI (MỘNG TRUYỆN)", desc: "1. Nâng cấp Gamification RPG: Đọc truyện cày XP, Level, Danh hiệu & Shop Linh vật 2D.\n2. Nâng cấp Chatbot AI Nahida: Gợi ý truyện cá nhân hóa & hỗ trợ 24/7.\n3. Nâng cấp Phân quyền Dịch giả & Cào tự động OTruyen API." }
  ];

  marketCards.forEach((c, idx) => {
    const yPos = 1.4 + idx * 1.85;
    s5.addShape(pptx.ShapeType.rect, { x: 0.8, y: yPos, w: 11.73, h: 1.65, fill: { color: "1B365D" }, line: { color: "00B4D8", width: 1.5 } });
    s5.addText(c.title, { x: 1.1, y: yPos + 0.15, w: 11.13, h: 0.4, fontFace: "Arial", fontSize: 16, color: "90E0EF", bold: true });
    s5.addText(c.desc, { x: 1.1, y: yPos + 0.55, w: 11.13, h: 1.0, fontFace: "Arial", fontSize: 13, color: "FFFFFF" });
  });

  const outPptx = "d:/AI/Bao_Cao_De_Cuong_Theo_Yeu_Cau_Co.pptx";
  await pptx.writeFile({ fileName: outPptx });
  console.log("✅ Updated PowerPoint Presentation at:", outPptx);
}

async function main() {
  await createWordDocument();
  await createPowerPointPresentation();
}

main().catch(console.error);
