/**
 * 🌳 SEED ADVANCED DATA FOR MYSQL
 * - Tạo thêm nhiều tài khoản (số tăng dần, pass: 123456)
 * - Tăng lượt view thực tế cho các bộ truyện và chương
 * - Thêm bình luận phong phú (hợp ý & trái chiều)
 * - Thêm bình luận 18+ / không phù hợp (độ rủi ro AI cao)
 * - Thêm bình luận bị báo cáo (hiển thị trong Hàng Đợi Báo Cáo Vi Phạm & AI Cảnh Báo Rủi Ro)
 */
import bcrypt from "bcryptjs";
import { sequelize } from "./config/database.js";
import { User } from "./models/User.js";
import { Comic } from "./models/Comic.js";
import { Chapter } from "./models/Chapter.js";
import { Comment } from "./models/Comment.js";
import { UserGamification } from "./models/UserGamification.js";

async function runSeed() {
  console.log("🚀 Bắt đầu quá trình nạp dữ liệu phong phú vào CSDL MySQL...");

  const defaultPassword = "123456";
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  // 1. TẠO TÀI KHOẢN MỚI (user01 -> user15 + spam_bot + whale_user)
  console.log("👤 Đang tạo các tài khoản người dùng...");
  const accountsToCreate = [
    { username: "user01", email: "user01@gmail.com", bio: "Mê truyện tranh hành động và tu tiên 🌿", gender: "male", role: "READER" },
    { username: "user02", email: "user02@gmail.com", bio: "Thích đọc truyện rom-com lãng mạn nhẹ nhàng 💕", gender: "female", role: "READER" },
    { username: "user03", email: "user03@gmail.com", bio: "Độc giả kỳ cựu 10 năm kinh nghiệm 📖", gender: "male", role: "READER" },
    { username: "user04", email: "user04@gmail.com", bio: "Reviewer truyện tranh khó tính 🧐", gender: "male", role: "READER" },
    { username: "user05", email: "user05@gmail.com", bio: "Fan cuồng các thể loại Isekai chuyển sinh ✨", gender: "female", role: "READER" },
    { username: "user06", email: "user06@gmail.com", bio: "Thức đêm cày truyện là đam mê 🌙", gender: "male", role: "READER" },
    { username: "user07", email: "user07@gmail.com", bio: "Hội viên hội những người thích kết HE 🌸", gender: "female", role: "READER" },
    { username: "user08", email: "user08@gmail.com", bio: "Chuyên soi sạn các bộ truyện tranh 🔍", gender: "male", role: "READER" },
    { username: "user09", email: "user09@gmail.com", bio: "Đọc vì art đẹp chứ cốt truyện tính sau 🎨", gender: "female", role: "READER" },
    { username: "user10", email: "user10@gmail.com", bio: "Lữ hành phiêu lưu qua vạn thế giới 🍃", gender: "male", role: "READER" },
    { username: "user11", email: "user11@gmail.com", bio: "Thích thể loại tâm lý giật gân, đấu trí 🧠", gender: "male", role: "READER" },
    { username: "user12", email: "user12@gmail.com", bio: "Ủng hộ nhóm dịch nhiệt tình 🔥", gender: "female", role: "READER" },
    { username: "user13", email: "user13@gmail.com", bio: "Nhặt lá đá ống bơ xem truyện tranh 🍵", gender: "male", role: "READER" },
    { username: "user14", email: "user14@gmail.com", bio: "Mới lọt hố truyện tranh tuần trước 🐣", gender: "female", role: "READER" },
    { username: "user15", email: "user15@gmail.com", bio: "Mọt sách chân chính 📚", gender: "male", role: "READER" },
    // 2 tài khoản đặc biệt để test AI Cảnh báo rủi ro:
    { username: "spammer_bot", email: "bot99@spam.com", bio: "Tài khoản thử nghiệm hành vi spam liên tục", gender: "male", role: "READER" },
    { username: "whale_cheater", email: "whale@hack.com", bio: "Tài khoản test nạp tinh thể bất thường", gender: "male", role: "READER" }
  ];

  const createdUsers = [];
  for (const acc of accountsToCreate) {
    let [u] = await User.findOrCreate({
      where: { username: acc.username },
      defaults: {
        username: acc.username,
        email: acc.email,
        password: hashedPassword,
        plainPassword: defaultPassword,
        bio: acc.bio,
        gender: acc.gender,
        role: acc.role,
        status: "ACTIVE",
        avatarUrl: `/Images/avatars/${acc.gender === "female" ? "avatar-girl.png" : "avatar-boy.png"}`
      }
    });
    // Đảm bảo mật khẩu plain_password đúng là 123456
    await u.update({ plainPassword: defaultPassword, password: hashedPassword });
    createdUsers.push(u);

    // Tạo Gamification
    const crystals = acc.username === "whale_cheater" ? 85000 : Math.floor(Math.random() * 2500) + 100;
    const currentXp = acc.username === "whale_cheater" ? 12000 : Math.floor(Math.random() * 3000) + 50;
    const level = acc.username === "whale_cheater" ? 45 : Math.floor(currentXp / 200) + 1;

    await UserGamification.findOrCreate({
      where: { userId: u.id },
      defaults: {
        userId: u.id,
        level: level,
        currentXp: currentXp,
        nextLevelXp: level * 300,
        worldCrystals: crystals,
        triThuc: Math.floor(Math.random() * 50) + 10,
        danhTieng: Math.floor(Math.random() * 40) + 10,
        uyTin: Math.floor(Math.random() * 60) + 20,
        fameRank: level > 30 ? "Rank S" : level > 15 ? "Rank A" : "Rank B",
      }
    });
  }
  console.log(`✅ Đã tạo/cập nhật xong ${createdUsers.length} tài khoản với mật khẩu mặc định: 123456!`);

  // 2. CẬP NHẬT VIEW CHO TRUYỆN VÀ CHƯƠNG
  console.log("📈 Đang tăng lượt xem thực tế cho các bộ truyện...");
  const comics = await Comic.findAll();
  if (comics.length > 0) {
    for (const c of comics) {
      // Tăng view ngẫu nhiên từ 15,000 đến 125,000 tuỳ độ hot
      const bonusViews = Math.floor(Math.random() * 85000) + 12000;
      const newTotalViews = (c.totalViews || 0) + bonusViews;
      await c.update({ totalViews: newTotalViews });

      // Cập nhật view cho các chapter của truyện này
      const chaps = await Chapter.findAll({ where: { comicId: c.id } });
      let chapView = Math.floor(newTotalViews / Math.max(1, chaps.length));
      for (const ch of chaps) {
        await ch.update({ views: chapView + Math.floor(Math.random() * 1500) });
      }
    }
    console.log(`✅ Đã cập nhật lượt xem cho ${comics.length} bộ truyện thành công!`);
  }

  // 3. THÊM BÌNH LUẬN ĐA DẠNG (HỢP Ý, TRÁI CHIỀU, SPAM, 18+, BỊ BÁO CÁO)
  console.log("💬 Đang thêm các bình luận đa dạng và bình luận test cảnh báo...");

  const targetComics = comics.slice(0, 8); // Lấy 8 truyện đầu
  if (targetComics.length === 0) {
    console.warn("⚠️ Không tìm thấy truyện nào để bình luận.");
    return;
  }

  // A. BÌNH LUẬN HỢP Ý (KHEN, THÍCH THÚ, ĐỒNG TÌNH)
  const positiveComments = [
    "Cốt truyện cuốn dã man, đọc một lèo từ chap 1 đến chap mới nhất không dứt ra được luôn! 🔥",
    "Nét vẽ của tác giả ngày càng lên tay, biểu cảm nhân vật nữ chính vừa đáng yêu vừa tinh tế quá 💖",
    "Pha combat cuối chap này đỉnh cao thực sự, đúng chất siêu phẩm! Hóng chap sau quá nhóm dịch ơi!",
    "Bộ này xây dựng chiều sâu tâm lý nhân vật cực tốt, không bị ảo tưởng sức mạnh như mấy bộ mì ăn liền khác.",
    "Lâu lắm mới tìm được một bộ truyện đúng gu thế này, 10/10 không có chỗ nào để chê!",
    "Main thông minh, quyết đoán, xử lý tình huống rất dứt khoát chứ không hề bị lú hay mềm lòng 👍",
    "Nhạc nền vừa đọc vừa bật nghe đúng bài luôn, cảm xúc trào dâng. Cảm ơn nhóm dịch nhiều lắm!",
    "Art siêu mượt, từng khung hình đều được chăm chút tỉ mỉ, đáng từng đồng ủng hộ tác giả!",
    "Tình tiết phát triển tự nhiên, chemistry giữa hai nhân vật chính ngọt lịm tim 🥰",
    "Đoạn cao trào đọc mà nổi cả da gà, tác giả bẻ lái quá gắt nhưng cực kỳ hợp lý!"
  ];

  // B. BÌNH LUẬN TRÁI CHIỀU (CHÊ, TRANH LUẬN, THẤT VỌNG)
  const criticalComments = [
    "Cá nhân mình thấy mấy chap gần đây nhịp truyện bị kéo dài lê thê quá, mất hết sự kịch tính ban đầu.",
    "Buff bẩn cho nhân vật chính lộ liễu quá mức, đối thủ đang mạnh tự nhiên hóa ngu ngơ để main đánh bại.",
    "Nét vẽ mấy chap đầu rất đẹp mà sao càng về sau nét càng thô và vẽ ẩu thế nhỉ? Thất vọng ghê...",
    "Không thích tính cách nữ chính chút nào, vừa bướng bỉnh vừa gây họa cho người khác rồi bắt main đi dọn.",
    "Cốt truyện bắt đầu đi vào lối mòn lặp đi lặp lại rồi, cứ gặp kẻ thù mới -> bị dìm -> đột phá -> hết.",
    "Đoạn này logic tác giả có vấn đề nặng, rõ ràng chap trước bảo phong ấn không thể phá vỡ mà giờ gãy cái một?",
    "Cảm giác tác giả đang bị cạn kiệt ý tưởng, cố tình tạo drama xàm xí để câu view của độc giả.",
    "Cái kết arc này cụt lủn khó hiểu thực sự, bao nhiêu kỳ vọng thế mà giải quyết trong 2 trang tranh.",
    "Không nuốt nổi quả tính cách vô lý của phản diện, ác một cách ngớ ngẩn không có động cơ rõ ràng.",
    "Mọi người khen chứ tôi thấy truyện này đánh giá hơi quá cao so với chất lượng thực tế."
  ];

  // Chèn các bình luận bình thường
  let userIndex = 0;
  for (let i = 0; i < 20; i++) {
    const c = targetComics[i % targetComics.length];
    const u = createdUsers[userIndex % (createdUsers.length - 2)]; // Bỏ 2 user bot
    userIndex++;

    const isPositive = i % 2 === 0;
    const contentList = isPositive ? positiveComments : criticalComments;
    const content = contentList[i % contentList.length];

    await Comment.create({
      userId: u.id,
      comicId: c.id,
      chapterId: null,
      content: content,
      likesCount: Math.floor(Math.random() * 35) + 2,
      isSpoiler: i % 7 === 0,
      isHidden: false,
      isReported: false,
      reportCount: 0,
      aiToxicityScore: 0.05
    });
  }

  // C. BÌNH LUẬN 18+ VÀ KHÔNG PHÙ HỢP (ĐỂ TEST AI CẢNH BÁO RỦI RO)
  console.log("🚨 Đang thêm bình luận 18+ và độc hại để test AI Cảnh Báo Rủi Ro...");
  const toxicCommentsData = [
    {
      content: "Web này có ai muốn xem phim s.e.x 18+ và gái gọi sinh viên không, vào link t.me/xxx_gai_goi_18 để nhận clip full hd không che nhé!",
      score: 0.96,
      reason: "Phát hiện nội dung khiêu dâm 18+, quảng cáo đồi trụy trái phép"
    },
    {
      content: "Nhìn con nữ chính ngực to mông mẩy thế kia chỉ muốn đè ra lột hết đồ rồi hãm hiếp cho sướng, ai có ảnh nude hentai không share với!",
      score: 0.94,
      reason: "Quấy rối tình dục, ngôn từ khiêu dâm cực kỳ thô tục"
    },
    {
      content: "Lũ súc vật dịch truyện ngu như chó, dịch như đấm vào tai, chúng mày cút mẹ hết đi đừng sống chật đất nữa đ.m chúng mày!",
      score: 0.89,
      reason: "Ngôn từ thù địch, xúc phạm danh dự lăng mạ thô bạo"
    },
    {
      content: "Chơi tài xỉu online hoàn tiền 100%, nạp rút 1:1 tặng 888k trải nghiệm tại kubet88.win, link độc quyền gái xinh live show 18+",
      score: 0.91,
      reason: "Spam cờ bạc phi pháp, liên kết độc hại"
    }
  ];

  for (let i = 0; i < toxicCommentsData.length; i++) {
    const t = toxicCommentsData[i];
    const c = targetComics[i % targetComics.length];
    const u = createdUsers[(i + 3) % (createdUsers.length - 2)];

    const createdComment = await Comment.create({
      userId: u.id,
      comicId: c.id,
      content: t.content,
      likesCount: 0,
      isSpoiler: false,
      isHidden: false,
      isReported: true,
      reportReason: t.reason,
      reportCount: 4,
      aiToxicityScore: t.score
    });

    // Ghi vào bảng ai_comment_moderations
    await sequelize.query(
      `INSERT INTO ai_comment_moderations (comment_id, toxicity_score, spam_score, flagged_reason, action_taken, created_at)
       VALUES (?, ?, 0.85, ?, 'FLAG_FOR_ADMIN', NOW())`,
      { replacements: [createdComment.id, t.score, t.reason] }
    );
  }

  // D. THÊM BÌNH LUẬN BỊ BÁO CÁO (HIỂN THỊ TẠI HÀNG ĐỢI BÁO CÁO ADMIN)
  console.log("🚩 Đang thêm các bình luận bị tố cáo (Reported Comments)...");
  const reportedCommentsData = [
    {
      content: "Haha tao spoil trước cho chúng mày tức: chap 150 nữ chính sẽ chết, thằng bạn thân phản bội cướp hết bí kíp của main nha lũ ngu!",
      reason: "Cố tình Spoil tiết lộ toàn bộ kết cục truyện làm mất hứng độc giả",
      count: 7
    },
    {
      content: "Nhóm dịch dịch chậm như rùa bò, chắc quản trị viên bị tai nạn liệt giường rồi mới không up chap mới đúng không cả nhà?",
      reason: "Xúc phạm và trù ẻo nhóm dịch, công kích cá nhân",
      count: 5
    },
    {
      content: "Nhận kéo cày thuê rank Liên Quân, bán acc giá rẻ, bấm vào trang cá nhân kết bạn Zalo 0988xxxxxx nhận quà tri ân",
      reason: "Spam quảng cáo thương mại trái phép",
      count: 3
    },
    {
      content: "Truyện rác rưởi của tác giả phế thải, ai đọc bộ này chắc não cũng toàn bã đậu mới khen hay được!",
      reason: "Ngôn từ độc hại, gây thù ghét cộng đồng",
      count: 6
    }
  ];

  for (let i = 0; i < reportedCommentsData.length; i++) {
    const r = reportedCommentsData[i];
    const c = targetComics[(i + 2) % targetComics.length];
    const u = createdUsers[(i + 5) % (createdUsers.length - 2)];

    const createdRepComment = await Comment.create({
      userId: u.id,
      comicId: c.id,
      content: r.content,
      likesCount: 1,
      isSpoiler: true,
      isHidden: false,
      isReported: true,
      reportReason: r.reason,
      reportCount: r.count,
      aiToxicityScore: 0.72
    });

    await sequelize.query(
      `INSERT INTO ai_comment_moderations (comment_id, toxicity_score, spam_score, flagged_reason, action_taken, created_at)
       VALUES (?, 0.72, 0.40, ?, 'FLAG_FOR_ADMIN', NOW())`,
      { replacements: [createdRepComment.id, r.reason] }
    );
  }

  // E. TẠO HÀNH VI SPAM BÌNH LUẬN BỞI spammer_bot (Để test AI Anomaly Detection: SPAM_COMMENTS)
  console.log("🤖 Đang tạo hành vi spam bởi tài khoản spammer_bot (16 bình luận liên tiếp trong 24h)...");
  const spamUser = createdUsers.find(u => u.username === "spammer_bot");
  if (spamUser) {
    for (let k = 1; k <= 16; k++) {
      await Comment.create({
        userId: spamUser.id,
        comicId: targetComics[k % targetComics.length].id,
        content: `Spam tự động test bot kiểm duyệt lượt ${k}: auto comment test script 123456`,
        likesCount: 0,
        isSpoiler: false,
        isHidden: false,
        isReported: false,
        reportCount: 0,
        aiToxicityScore: 0.25,
        created_at: new Date(Date.now() - k * 300000) // vài phút trước
      });
    }
  }

  console.log("🎉 HOÀN THÀNH TOÀN BỘ QUÁ TRÌNH SEED DỮ LIỆU!");
  process.exit(0);
}

runSeed().catch(err => {
  console.error("❌ Lỗi khi nạp dữ liệu:", err);
  process.exit(1);
});
