// utils/irminsulSystem.js
// ═══════════════════════════════════════════════════
// 🌳 HỆ THỐNG CÂY THẾ GIỚI IRMINSUL — RPG Logic Core
// ═══════════════════════════════════════════════════

// ── XP cần thiết để lên level (Cấp số cộng) ─────────
// Công thức: XP(lv) = 100 + 20 * (lv - 2)
export function xpForLevel(level) {
  if (level <= 1) return 0;
  return 100 + 20 * (level - 2);
}

// Tổng XP cần để đạt level N
export function totalXpForLevel(level) {
  let total = 0;
  for (let i = 2; i <= level; i++) {
    total += xpForLevel(i);
  }
  return total;
}

// Danh sách các cấp độ giới hạn cần đột phá
export const BREAKPOINTS = [20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 250, 300];

// Tỉ lệ đột phá cơ bản theo cấp độ (Cấp đầu 90%, giảm dần 10% xuống 10%, 1%, 0.1%, 0.01%)
export const BREAKTHROUGH_BASE_RATES = {
  20: 90,
  40: 80,
  60: 70,
  80: 60,
  100: 50,
  120: 40,
  140: 30,
  160: 20,
  180: 10,
  200: 1,
  250: 0.1,
  300: 0.01
};

// Map cấp độ đột phá tương ứng với loại Thuốc phù thủy (BẮT BUỘC để đột phá)
export const POTION_MAP = {
  20: "witch_potion_t1",
  40: "witch_potion_t2",
  60: "witch_potion_t3",
  80: "witch_potion_t4",
  100: "witch_potion_t5",
  120: "witch_potion_t6",
  140: "witch_potion_t7",
  160: "witch_potion_t8",
  180: "witch_potion_t9",
  200: "witch_potion_t10",
  250: "witch_potion_t11",
  300: "witch_potion_t12"
};

// Chi tiết các vật phẩm
export const ITEM_DETAILS = {
  world_tree_leaf: { name: "Lá Cây Thế Giới", icon: "🍃", desc: "Tăng +30% tỉ lệ thành công khi Đột phá Cảnh giới." },
  material_sun_clover: { name: "Cỏ Ba Lá Mặt Trời", icon: "🌟", desc: "Nguyên liệu chế tạo Thuốc Phù Thủy." },
  material_moon_mushroom: { name: "Nấm Trăng Tròn", icon: "🌙", desc: "Nguyên liệu chế tạo Thuốc Phù Thủy." },
  material_star_dust: { name: "Bột Bụi Sao", icon: "✨", desc: "Nguyên liệu chế tạo Thuốc Phù Thủy." },
  material_dream_drop: { name: "Giọt Nước Ước Mơ", icon: "💧", desc: "Nguyên liệu chế tạo Thuốc Phù Thủy." },
  material_memory_crystal: { name: "Pha Lê Ký Ức", icon: "💎", desc: "Nguyên liệu chế tạo Thuốc Phù Thủy." },
  
  witch_potion_t1: { name: "Thuốc Phù Thủy Bậc 1", icon: "🧪", desc: "Dược liệu bắt buộc để Đột phá Cấp 20." },
  witch_potion_t2: { name: "Thuốc Phù Thủy Bậc 2", icon: "🧪", desc: "Dược liệu bắt buộc để Đột phá Cấp 40." },
  witch_potion_t3: { name: "Thuốc Phù Thủy Bậc 3", icon: "🧪", desc: "Dược liệu bắt buộc để Đột phá Cấp 60." },
  witch_potion_t4: { name: "Thuốc Phù Thủy Bậc 4", icon: "🧪", desc: "Dược liệu bắt buộc để Đột phá Cấp 80." },
  witch_potion_t5: { name: "Thuốc Phù Thủy Bậc 5", icon: "🧪", desc: "Dược liệu bắt buộc để Đột phá Cấp 100." },
  witch_potion_t6: { name: "Thuốc Phù Thủy Bậc 6", icon: "🧪", desc: "Dược liệu bắt buộc để Đột phá Cấp 120." },
  witch_potion_t7: { name: "Thuốc Phù Thủy Bậc 7", icon: "🧪", desc: "Dược liệu bắt buộc để Đột phá Cấp 140." },
  witch_potion_t8: { name: "Thuốc Phù Thủy Bậc 8", icon: "🧪", desc: "Dược liệu bắt buộc để Đột phá Cấp 160." },
  witch_potion_t9: { name: "Thuốc Phù Thủy Bậc 9", icon: "🧪", desc: "Dược liệu bắt buộc để Đột phá Cấp 180." },
  witch_potion_t10: { name: "Thuốc Phù Thủy Bậc 10", icon: "🧪", desc: "Dược liệu bắt buộc để Đột phá Cấp 200." },
  witch_potion_t11: { name: "Thuốc Phù Thủy Bậc 11", icon: "🧪", desc: "Dược liệu bắt buộc để Đột phá Cấp 250." },
  witch_potion_t12: { name: "Thuốc Phù Thủy Bậc 12", icon: "🧪", desc: "Dược liệu bắt buộc để Đột phá Cấp 300." },
};

// Hàm rớt vật phẩm khi đọc truyện hoặc làm nhiệm vụ
// dailyDropCount: Số lượt rớt trong ngày (1 - 100). Đủ 100/ngày chắc chắn có 2 lá (tại mốc 50 và 100).
export function rollLootDrop(triThuc = 0, dailyDropCount = 0) {
  // 🍃 CƠ CHẾ BẢO HIỂM (PITY): Farm đủ 100 lượt đọc trong ngày thì chắc chắn nhận được 2 lá
  // (Lá thứ nhất tại mốc 50, Lá thứ hai tại mốc 100)
  if (dailyDropCount === 50 || dailyDropCount === 100) {
    return { type: "item", item: "world_tree_leaf", amount: 1, isGuaranteed: true };
  }

  // Tỉ lệ rơi tự nhiên của Lá Thế Giới cực hiếm (0.2% đến tối đa 0.5% nếu có nhiều Trí Tuệ)
  const roll = Math.random();
  const naturalLeafChance = Math.min(0.005, 0.002 + (triThuc || 0) * 0.000003);
  
  if (roll < naturalLeafChance) {
    // 🍃 Rơi Lá Cây Thế Giới hiếm
    return { type: "item", item: "world_tree_leaf", amount: 1 };
  }
  
  // Mỗi điểm Trí Tuệ tăng cơ hội rơi World Crystal (lên tối đa 15%)
  const crystalBonus = Math.min(0.15, (triThuc || 0) * 0.0005);
  const adjustedRoll = Math.random();

  if (adjustedRoll < 0.40) {
    // 40% ra Nguyên liệu chế thuốc ngẫu nhiên
    const materials = [
      "material_sun_clover",
      "material_moon_mushroom",
      "material_star_dust",
      "material_dream_drop",
      "material_memory_crystal"
    ];
    const item = materials[Math.floor(Math.random() * materials.length)];
    return { type: "material", item, amount: 1 };
  } else if (adjustedRoll < 0.40 + (0.42 - crystalBonus)) {
    // XP thăng cấp bổ sung (điều chỉnh giảm tỉ lệ tương ứng với bonus Crystal)
    const amount = Math.floor(Math.random() * 21) + 10; // 10 đến 30 XP
    return { type: "xp", amount };
  } else {
    // World Crystal (Chỉ nhận 1 hoặc tối đa 2 Tinh Thạch mỗi lần rớt quà khi đọc truyện)
    const amount = Math.random() < 0.35 ? 2 : 1; // 1 hoặc 2 Crystals
    return { type: "crystal", amount };
  }
}

// Tính Level tối đa thuần túy từ XP (không tính breakpoint)
export function calcLevel(irminsulMemory) {
  let level = 1;
  let xpUsed = 0;
  while (true) {
    const needed = xpForLevel(level + 1);
    if (xpUsed + needed > irminsulMemory) break;
    xpUsed += needed;
    level++;
    if (level >= 350) break; // cap an toàn
  }
  return level;
}

// Tính % tiến trình trong level dựa trên level thực tế của user
export function calcLevelProgressReal(user) {
  const level = user.level || 1;
  const memory = user.irminsulMemory || 0;
  const xpForCurrent = totalXpForLevel(level);
  const xpForNext = xpForLevel(level + 1);
  if (xpForNext <= 0) return 100;
  const progress = ((memory - xpForCurrent) / xpForNext) * 100;
  return Math.min(100, Math.max(0, Math.round(progress)));
}

// Tương thích ngược với hàm cũ
export function calcLevelProgress(irminsulMemory) {
  const level = calcLevel(irminsulMemory);
  const xpForCurrent = totalXpForLevel(level);
  const xpForNext = xpForLevel(level + 1);
  if (xpForNext <= 0) return 100;
  const progress = ((irminsulMemory - xpForCurrent) / xpForNext) * 100;
  return Math.min(100, Math.max(0, Math.round(progress)));
}

// ── Mapping Cấp Bậc (Level Title) ──────────────────
const LEVEL_TITLES = [
  { min: 1, max: 20, title: "Người Mới Thức Tỉnh" },
  { min: 21, max: 40, title: "Kẻ Tìm Đường" },
  { min: 41, max: 60, title: "Lữ Hành Giả" },
  { min: 61, max: 80, title: "Nhà Thám Hiểm" },
  { min: 81, max: 100, title: "Người Gìn Giữ Tri Thức" },
  { min: 101, max: 120, title: "Người Ghi Chép Ký Ức" },
  { min: 121, max: 140, title: "Học Giả Cổ Đại" },
  { min: 141, max: 160, title: "Hiền Giả" },
  { min: 161, max: 180, title: "Đại Hiền Giả" },
  { min: 181, max: 200, title: "Thủ Hộ Cổ Thụ" },
  { min: 201, max: 250, title: "Người Canh Giữ Irminsul" },
  { min: 251, max: 300, title: "Người Viết Lại Lịch Sử" },
  { min: 301, max: 9999, title: "Hóa Thân Irminsul" },
];

export function getLevelTitle(level) {
  const entry = LEVEL_TITLES.find(e => level >= e.min && level <= e.max);
  return entry ? entry.title : "Người Mới Thức Tỉnh";
}

// ── Mapping Danh Vọng (Rank) ────────────────────────
// Danh Vọng là thước đo Vị Thế & Đóng Góp Cộng Đồng (thay thế VIP)
// Được quyết định bởi bộ 3 chỉ số: 📚 Tri Thức, 💬 Danh Tiếng, ❤️ Uy Tín & 🌳 Ký Ức Irminsul
export const RANK_THRESHOLDS = [
  { rank: "F", title: "Người Mới", minScore: 0, minTriThuc: 0, minDanhTieng: 0, minUyTin: 0, minMemory: 0 },
  { rank: "E", title: "Lữ Hành Giả", minScore: 300, minTriThuc: 50, minDanhTieng: 10, minUyTin: 5, minMemory: 500 },
  { rank: "D", title: "Nhà Thám Hiểm", minScore: 1200, minTriThuc: 150, minDanhTieng: 40, minUyTin: 15, minMemory: 2000 },
  { rank: "C", title: "Học Giả", minScore: 3500, minTriThuc: 400, minDanhTieng: 120, minUyTin: 40, minMemory: 5000 },
  { rank: "B", title: "Hiền Giả", minScore: 8500, minTriThuc: 1000, minDanhTieng: 300, minUyTin: 100, minMemory: 12000 },
  { rank: "A", title: "Đại Hiền Giả", minScore: 22000, minTriThuc: 2500, minDanhTieng: 800, minUyTin: 300, minMemory: 30000 },
  { rank: "S", title: "Người Gìn Giữ Ký Ức", minScore: 55000, minTriThuc: 6000, minDanhTieng: 2000, minUyTin: 800, minMemory: 80000 },
  { rank: "SS", title: "Thủ Hộ Irminsul", minScore: 140000, minTriThuc: 15000, minDanhTieng: 5000, minUyTin: 2000, minMemory: 200000 },
  { rank: "SSS", title: "Người Viết Lại Lịch Sử", minScore: 350000, minTriThuc: 35000, minDanhTieng: 12000, minUyTin: 5000, minMemory: 500000 },
  { rank: "EX", title: "Hóa Thân Irminsul", minScore: 750000, minTriThuc: 80000, minDanhTieng: 25000, minUyTin: 10000, minMemory: 1000000 },
];

/**
 * Tính toán Rank Danh Vọng dựa trên 3 Chỉ Số RPG hoặc Ký Ức Irminsul
 * @param {number|object} input - irminsulMemory hoặc object { triThuc, danhTieng, uyTin, irminsulMemory }
 */
export function getDanhVong(input) {
  let memory = 0;
  let triThuc = 0;
  let danhTieng = 0;
  let uyTin = 0;

  if (typeof input === "object" && input !== null) {
    memory = Number(input.irminsulMemory || input.irminsulMemories || 0);
    triThuc = Number(input.triThuc || 0);
    danhTieng = Number(input.danhTieng || 0);
    uyTin = Number(input.uyTin || 0);
  } else {
    memory = Number(input || 0);
  }

  // Điểm Danh Vọng tổng hợp từ 3 chỉ số RPG:
  // - Tri Thức x 1.5 (Độ uyên thâm khi đọc truyện)
  // - Danh Tiếng x 3.0 (Tương tác, thảo luận bình luận)
  // - Uy Tín x 5.0 (Được cộng đồng like, đánh giá cao)
  // - Ký Ức x 0.2 (Tổng điểm thành tựu tích lũy)
  const fameScore = Math.floor(triThuc * 1.5 + danhTieng * 3.0 + uyTin * 5.0 + memory * 0.2);

  let result = RANK_THRESHOLDS[0];
  for (const threshold of RANK_THRESHOLDS) {
    // Thỏa mãn hoặc qua điểm tổng hợp, hoặc qua điểm ký ức tối thiểu
    if (fameScore >= threshold.minScore || memory >= threshold.minMemory) {
      result = threshold;
    }
  }
  return { ...result, fameScore };
}

// ── Mapping Khu Vực Khám Phá ────────────────────────
const AREA_THRESHOLDS = [
  { minLevel: 1, area: "Đồng Cỏ Ánh Sao", tier: "Khởi Đầu" },
  { minLevel: 10, area: "Hồ Nguyệt Quang", tier: "Khởi Đầu" },
  { minLevel: 20, area: "Thung Lũng Sương Mù", tier: "Khởi Đầu" },
  { minLevel: 40, area: "Rừng Cổ Ngữ", tier: "Trung Cấp" },
  { minLevel: 60, area: "Thành Phố Trên Mây", tier: "Trung Cấp" },
  { minLevel: 80, area: "Sa Mạc Vĩnh Cửu", tier: "Trung Cấp" },
  { minLevel: 100, area: "Biển Sao", tier: "Cao Cấp" },
  { minLevel: 140, area: "Thư Viện Vô Tận", tier: "Cao Cấp" },
  { minLevel: 180, area: "Vùng Đất Ký Ức", tier: "Cao Cấp" },
  { minLevel: 220, area: "Irminsul", tier: "Đặc Biệt" },
  { minLevel: 260, area: "Cội Nguồn Thế Giới", tier: "Đặc Biệt" },
  { minLevel: 301, area: "Khu Vực Cấm", tier: "Đặc Biệt" },
];

export function getKhuVuc(level) {
  let result = AREA_THRESHOLDS[0];
  for (const threshold of AREA_THRESHOLDS) {
    if (level >= threshold.minLevel) {
      result = threshold;
    }
  }
  return result;
}

// ── XP Rewards (Điểm thưởng cho hành động) ─────────
export const XP_REWARDS = {
  READ_CHAPTER: 10,      // Đọc 1 chương
  COMMENT: 5,            // Bình luận
  RECEIVE_LIKE: 3,       // Nhận like
  FOLLOW_COMIC: 8,       // Theo dõi truyện
  DAILY_LOGIN: 15,       // Đăng nhập hằng ngày
  EVENT: 50,             // Tham gia sự kiện
};

// ── Stat Rewards (Điểm chỉ số cho hành động) ───────
export const STAT_REWARDS = {
  READ_CHAPTER: { triThuc: 5 },
  COMMENT: { danhTieng: 3 },
  RECEIVE_LIKE: { uyTin: 2 },
  FOLLOW_COMIC: { triThuc: 2 },
};

// ── Tính toán tổng hợp profile Irminsul ─────────────
export function calcIrminsulProfile(user) {
  const memory = Number(user.irminsulMemory || 0);
  const level = Number(user.level || 1);
  const progress = calcLevelProgressReal(user);
  const levelTitle = getLevelTitle(level);

  // Lấy rank và title danh vọng (ưu tiên DB, fallback tính theo điểm 3 chỉ số RPG)
  const calculatedDanhVong = getDanhVong({
    irminsulMemory: memory,
    triThuc: user.triThuc || 0,
    danhTieng: user.danhTieng || 0,
    uyTin: user.uyTin || 0,
  });
  const currentRank = user.danhVong || calculatedDanhVong.rank;
  const matchedRank = RANK_THRESHOLDS.find(r => r.rank === currentRank) || calculatedDanhVong;
  const danhVongTitle = matchedRank.title;

  // Lấy khu vực (ưu tiên DB, fallback tính theo level)
  const calculatedKhuVuc = getKhuVuc(level);
  const currentKhuVucName = user.khuVuc || calculatedKhuVuc.area;
  const matchedKhuVuc = AREA_THRESHOLDS.find(a => a.area === currentKhuVucName) || calculatedKhuVuc;
  const khuVuc = matchedKhuVuc.area;
  const khuVucTier = matchedKhuVuc.tier;

  // Tính toán XP hiển thị tương đối
  const xpForCurrent = totalXpForLevel(level);
  const xpForNext = xpForLevel(level + 1);
  const displayedXpCurrent = Math.min(xpForNext, Math.max(0, memory - xpForCurrent));

  return {
    level,
    levelTitle,
    levelProgress: progress,
    xpCurrent: displayedXpCurrent,
    xpNeeded: xpForNext,
    irminsulMemory: memory,
    danhVong: currentRank,
    danhVongTitle,
    khuVuc,
    khuVucTier,
    triThuc: user.triThuc || 0,
    danhTieng: user.danhTieng || 0,
    uyTin: user.uyTin || 0,
    worldCrystal: user.worldCrystal || 0,
  };
}

// ── Hàm cộng điểm và cập nhật user ─────────────────
// Trả về object { updates, newMemory, leveledUp, newLevel }
export function addReward(user, actionType) {
  const xpReward = XP_REWARDS[actionType] || 0;
  const statReward = STAT_REWARDS[actionType] || {};

  const oldMemory = Number(user.irminsulMemory || 0);
  const oldLevel = Number(user.level || 1);

  const newMemory = oldMemory + xpReward;

  // Tính toán level mới dựa trên oldLevel và newMemory nhưng chặn bởi Breakpoints
  let currentLevel = oldLevel;
  while (true) {
    if (BREAKPOINTS.includes(currentLevel)) {
      break; // Bị khóa tại mốc giới hạn, cần đột phá
    }
    const neededForNext = xpForLevel(currentLevel + 1);
    const xpNeededTotal = totalXpForLevel(currentLevel + 1);
    if (newMemory < xpNeededTotal) {
      break;
    }
    currentLevel++;
    if (currentLevel >= 350) break; // cap an toàn
  }

  const updates = {
    irminsulMemory: newMemory,
    level: currentLevel,
  };

  // Cộng chỉ số RPG
  if (statReward.triThuc) {
    updates.triThuc = (user.triThuc || 0) + statReward.triThuc;
  }
  if (statReward.danhTieng) {
    updates.danhTieng = (user.danhTieng || 0) + statReward.danhTieng;
  }
  if (statReward.uyTin) {
    updates.uyTin = (user.uyTin || 0) + statReward.uyTin;
  }

  return {
    updates,
    newMemory,
    leveledUp: currentLevel > oldLevel,
    oldLevel,
    newLevel: currentLevel,
  };
}

export async function logXpChange(userId, amount, reason) {
  if (!amount || amount <= 0) return;
  console.log(`📝 [Irminsul RPG] User ${userId} +${amount} XP: ${reason}`);
}

/**
 * 🌳 TẦNG LỌC ĐỘT PHÁ CẢNH GIỚI & ĐỒNG BỘ TIẾN ĐỘ IRMINSUL (KÝ ỨC = KINH NGHIỆM)
 * Quy tắc:
 * 1. Ký Ức Irminsul (irminsul_memories) chính là Tổng Kinh Nghiệm (Total XP) tích lũy.
 * 2. Cảnh giới có các Mốc Đột Phá (BREAKPOINTS): 20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 250, 300.
 * 3. Nếu chưa đạt giới hạn cấp đột phá (hoặc vượt qua):
 *    - Cấp độ sẽ tăng dần từ Ký Ức tích lũy được cho tới khi chạm mốc giới hạn đó (ví dụ Cấp 20).
 *    - Tại mốc giới hạn đó: nếu Ký Ức đủ hoặc vượt mức lên cấp tiếp theo, thanh XP sẽ được nâng FULL (100%) và DỪNG LẠI,
 *      không tự động nhảy lên cấp tiếp theo (ví dụ không nhảy lên 21) cho đến khi người dùng đột phá thành công!
 * 4. Nếu chưa chạm mốc giới hạn: tự động tính toán tổng Ký Ức và cộng dồn để nâng cấp ngay lập tức.
 * 5. Khi Admin tùy chỉnh (Level hoặc Ký Ức): áp dụng chính xác logic này.
 */
export function syncIrminsulProgress(gam, inputMemory, explicitLevel = null) {
  let memory = Math.max(0, Number(inputMemory !== undefined && inputMemory !== null ? inputMemory : (gam.irminsulMemories || 0)));
  let currentLevel = Number(gam.level || 1);

  if (explicitLevel !== null && explicitLevel !== undefined) {
    currentLevel = Math.max(1, parseInt(explicitLevel, 10));
  }

  // Mốc đột phá cao nhất hiện tại mà người dùng đang bị giới hạn
  // Nếu đang ở mốc hoặc thấp hơn mốc 20 => cap là 20. Nếu đã đột phá lên 21 => cap tiếp theo là 40.
  const activeBreakpoint = BREAKPOINTS.find((b) => b >= currentLevel) || 300;

  // Nếu Admin chỉ định cấp độ cụ thể (ví dụ nhập Cấp 20 vào form Admin):
  if (explicitLevel !== null && explicitLevel !== undefined) {
    if (BREAKPOINTS.includes(currentLevel)) {
      // Nếu Admin set đúng mốc đột phá (như Cấp 20), tự động đồng bộ Ký ức đạt chuẩn để thanh XP full 100% sẵn sàng đột phá
      const xpForFullBreakpoint = totalXpForLevel(currentLevel + 1);
      if (memory < xpForFullBreakpoint) {
        memory = xpForFullBreakpoint;
      }
    } else {
      const minXpForLevel = totalXpForLevel(currentLevel);
      if (memory < minXpForLevel) {
        memory = minXpForLevel;
      }
    }
  }

  // Tính toán cấp độ đạt được từ tổng Ký Ức (Memory)
  let calculatedLevel = 1;
  let xpUsed = 0;

  while (calculatedLevel < activeBreakpoint) {
    const nextReq = xpForLevel(calculatedLevel + 1);
    if (xpUsed + nextReq > memory) {
      break;
    }
    xpUsed += nextReq;
    calculatedLevel++;
  }

  // Kiểm tra xem có chạm hoặc vượt mốc giới hạn đột phá không
  if (calculatedLevel >= activeBreakpoint) {
    // Chạm mốc giới hạn đột phá: KHÓA TẠI ĐÂY, không cho tự động lên cấp tiếp theo
    const reqForNext = xpForLevel(activeBreakpoint + 1);
    const xpNeededTotal = totalXpForLevel(activeBreakpoint + 1);

    gam.level = activeBreakpoint;
    gam.nextLevelXp = reqForNext;
    gam.irminsulMemories = memory;

    if (memory >= xpNeededTotal) {
      // Đủ hoặc vượt mốc => Nâng FULL 100% thanh XP và DỪNG LẠI chờ đột phá
      gam.currentXp = reqForNext;
    } else {
      const xpForCurrent = totalXpForLevel(activeBreakpoint);
      gam.currentXp = Math.min(reqForNext, Math.max(0, memory - xpForCurrent));
    }
  } else {
    // Chưa đạt mốc giới hạn: tính toán cấp độ và số XP lẻ bình thường
    const reqForNext = xpForLevel(calculatedLevel + 1);
    const xpForCurrent = totalXpForLevel(calculatedLevel);

    gam.level = calculatedLevel;
    gam.nextLevelXp = reqForNext;
    gam.currentXp = Math.min(reqForNext, Math.max(0, memory - xpForCurrent));
    gam.irminsulMemories = memory;
  }

  return {
    level: gam.level,
    currentXp: gam.currentXp,
    nextLevelXp: gam.nextLevelXp,
    irminsulMemories: gam.irminsulMemories,
    isAtBreakpoint: BREAKPOINTS.includes(gam.level),
    waitingBreakthrough: BREAKPOINTS.includes(gam.level) && gam.currentXp >= gam.nextLevelXp,
  };
}

/**
 * Cộng XP vào UserGamification, có kiểm tra chặn ngưỡng đột phá BREAKPOINTS
 */
export function addXpToGamification(gam, xpAmount = 0, memoriesAmount = 0) {
  const oldLevel = Number(gam.level || 1);
  const addMemory = Math.max(Number(xpAmount || 0), Number(memoriesAmount || 0));
  const newMemory = Number(gam.irminsulMemories || 0) + addMemory;

  const result = syncIrminsulProgress(gam, newMemory);

  const leveledUp = result.level > oldLevel;
  if (leveledUp) {
    gam.worldCrystals = (gam.worldCrystals || 0) + (result.level - oldLevel) * 20;
  }

  return {
    leveledUp,
    waitingBreakthrough: result.waitingBreakthrough,
    oldLevel,
    newLevel: result.level,
  };
}
