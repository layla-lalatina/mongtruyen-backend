/**
 * 🌳 SYSTEM: IRMINSUL FANTASY RPG - QUEST / TASK SYSTEM
 * ==========================================================
 * Quản lý nhiệm vụ RPG chuẩn hóa theo bảng quests & user_quests trong truyentranh.sql.
 * ==========================================================
 */

import { Quest, UserQuest, User, UserGamification, CrystalTransaction, ReadingHistory, Comic } from "../models/index.js";
import { addXpToGamification } from "./irminsulSystem.js";

// Nhiệm vụ AI (Mục 1): Đọc danh sách 4 model từ .env (ưu tiên Gemma 4 trước, dự phòng Gemini 3.5 & 3.1 Flash Lite)
function getAiQuestModels() {
  const raw = process.env.GEMINI_ANALYSIS_MODELS || process.env.GEMINI_MODELS || "";
  const parsed = raw.split(",").map((m) => m.trim()).filter(Boolean);
  if (parsed.length > 0) return [...new Set(parsed)];
  return [
    "gemma-4-26b-a4b-it",
    "gemma-4-31b-it",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
  ];
}

let questApiKeyCursor = 0;
function getRotatedQuestApiKeys() {
  const rawList = [
    ...(process.env.GEMINI_API_KEYS || "").split(","),
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
  ]
    .map((k) => (k || "").trim())
    .filter(Boolean);
  const uniqueKeys = [...new Set(rawList)];
  if (uniqueKeys.length <= 1) return uniqueKeys;
  const idx = questApiKeyCursor % uniqueKeys.length;
  questApiKeyCursor = (questApiKeyCursor + 1) % uniqueKeys.length;
  return [...uniqueKeys.slice(idx), ...uniqueKeys.slice(0, idx)];
}

const ALLOWED_AI_QUEST_ACTIONS = [
  { action: "READ_CHAPTER", minTarget: 1, maxTarget: 5, baseXp: 60, baseCrystals: 20 },
  { action: "POST_COMMENT", minTarget: 1, maxTarget: 2, baseXp: 50, baseCrystals: 15 },
  { action: "UNLOCK_CHAPTER", minTarget: 1, maxTarget: 2, baseXp: 80, baseCrystals: 25 },
];

export function getActionHintText(actionType, targetCount) {
  const act = (actionType || "").toUpperCase();
  if (act === "READ_CHAPTER" || act === "READ_100" || act === "READ_FIRST") {
    return `Đọc hoàn thành ${targetCount} chương truyện bất kỳ`;
  }
  if (act === "POST_COMMENT" || act === "COMMENT") {
    return `Để lại ${targetCount} bình luận dưới chương truyện`;
  }
  if (act === "UNLOCK_CHAPTER") {
    return `Mở khóa ${targetCount} chương truyện bằng Tinh Thạch hoặc VIP`;
  }
  if (act === "CHECK_IN" || act === "DAILY_LOGIN") {
    return `Điểm danh hằng ngày (${targetCount} lần)`;
  }
  if (act === "BOOKMARK_COMIC" || act === "FOLLOW_COMIC") {
    return `Theo dõi ${targetCount} bộ truyện`;
  }
  return `Thực hiện mục tiêu (${targetCount} lần)`;
}

/**
 * Tự động tạo 1 nhiệm vụ AI_DYNAMIC cá nhân hóa cho người dùng (không giới hạn số lần/ngày).
 * Khi người dùng nhận quà xong nhiệm vụ AI cũ, hàm này tự động được gọi để sinh nhiệm vụ AI mới.
 */
export async function generateAiDynamicQuestForUser(userId, { replaceUnclaimed = false, lastAction = null } = {}) {
  try {
    const today = new Date().toISOString().split("T")[0];

    const existingUserAiQuests = await UserQuest.findAll({
      where: { userId, assignedDate: today, isClaimed: false },
      include: [{ model: Quest, as: "quest", where: { questType: "AI_DYNAMIC" } }],
    });

    if (existingUserAiQuests.length > 0 && !replaceUnclaimed) {
      return existingUserAiQuests[0].quest;
    }

    if (existingUserAiQuests.length > 0 && replaceUnclaimed) {
      for (const oldUq of existingUserAiQuests) {
        const oldQId = oldUq.questId;
        await oldUq.destroy();
        await Quest.update({ isActive: false }, { where: { id: oldQId, questType: "AI_DYNAMIC" } });
      }
    }

    const [gam, recentHistories] = await Promise.all([
      UserGamification.findOne({ where: { userId } }),
      ReadingHistory.findAll({
        where: { userId },
        include: [{ model: Comic, as: "comic", attributes: ["title", "slug"] }],
        order: [["updated_at", "DESC"]],
        limit: 5,
      }),
    ]);

    const recentTitles = recentHistories
      .map((h) => h.comic?.title)
      .filter(Boolean)
      .slice(0, 3);

    const pool = lastAction
      ? ALLOWED_AI_QUEST_ACTIONS.filter((a) => a.action !== lastAction)
      : ALLOWED_AI_QUEST_ACTIONS;
    const candidateRule = pool[Math.floor(Math.random() * pool.length)] || ALLOWED_AI_QUEST_ACTIONS[0];
    const targetCount =
      Math.floor(Math.random() * (candidateRule.maxTarget - candidateRule.minTarget + 1)) +
      candidateRule.minTarget;

    const actionHint = getActionHintText(candidateRule.action, targetCount);
    let questTitle = "";
    let questDesc = "";

    // ─── BỘ MÁY SINH NHIỆM VỤ AI LOCAL AGENT (0 LƯỢT QUOTA GEMINI) ───
    // Tự động cá nhân hóa theo bộ truyện người dùng vừa đọc và cấp độ RPG hiện tại
    const favComic = recentTitles[0] || "";
    if (candidateRule.action === "READ_CHAPTER") {
      const readTemplates = [
        {
          title: `Chỉ Thị Thảo Thần: Khai Mở ${targetCount} Chương Mới`,
          desc: favComic
            ? `Tiếp bước hành trình tại "${favComic}" hoặc bộ truyện bất kỳ, hoàn tất đọc ${targetCount} chương để thu thập Ký Ức Irminsul.`
            : `Khám phá kho tàng Cây Thế Giới và đọc hoàn thành ${targetCount} chương truyện bất kỳ hôm nay.`,
        },
        {
          title: `Dòng Chảy Tri Thức: Thưởng Thức ${targetCount} Chương Truyện`,
          desc: favComic
            ? `Lật mở những trang tiếp theo của "${favComic}" (hoặc truyện bạn yêu thích) — Yêu cầu: ${actionHint}.`
            : `Thu thập tinh hoa tri thức qua việc đọc hoàn tất ${targetCount} chương truyện trên Mộng Truyện.`,
        },
        {
          title: `Nhánh Cây Ký Ức: Chinh Phục ${targetCount} Chương`,
          desc: `Nahida cảm nhận nguồn năng lượng mới đang chờ bạn! Hãy hoàn thành mục tiêu: ${actionHint}.`,
        },
      ];
      const picked = readTemplates[Math.floor(Math.random() * readTemplates.length)];
      questTitle = picked.title;
      questDesc = picked.desc;
    } else if (candidateRule.action === "POST_COMMENT") {
      const commentTemplates = [
        {
          title: `Tiếng Vọng Rừng Sâu: Giao Lưu ${targetCount} Bình Luận`,
          desc: favComic
            ? `Chia sẻ cảm nghĩ của bạn dưới chương truyện "${favComic}" hoặc tác phẩm bất kỳ (${actionHint}).`
            : `Để lại ${targetCount} bình luận cảm nhận dưới chương truyện để kết nối Ký Ức cùng cộng đồng lữ khách.`,
        },
        {
          title: `Khế Ước Thảo Thần: Lưu Dấu ${targetCount} Cảm Nhận`,
          desc: `Mỗi lời bình của bạn làm rạng rỡ thêm Cây Thế Giới Irminsul — Yêu cầu: ${actionHint}.`,
        },
      ];
      const picked = commentTemplates[Math.floor(Math.random() * commentTemplates.length)];
      questTitle = picked.title;
      questDesc = picked.desc;
    } else {
      const unlockTemplates = [
        {
          title: `Chìa Khóa Tinh Thạch: Mở Khóa ${targetCount} Chương VIP`,
          desc: `Sử dụng Tinh Thạch hoặc đặc quyền VIP mở khóa ${targetCount} chương truyện đặc sắc trên Cây Thế Giới.`,
        },
        {
          title: `Ấn Ký Bí Ẩn: Khai Mở ${targetCount} Chương Khoá`,
          desc: `Giải phóng tri thức ẩn giấu trong các chương VIP — Yêu cầu: ${actionHint}.`,
        },
      ];
      const picked = unlockTemplates[Math.floor(Math.random() * unlockTemplates.length)];
      questTitle = picked.title;
      questDesc = picked.desc;
    }

    const rewardXp = Math.min(200, candidateRule.baseXp + targetCount * 10);
    const rewardCrystals = Math.min(60, candidateRule.baseCrystals + targetCount * 5);

    const newQuest = await Quest.create({
      title: questTitle,
      description: questDesc,
      questType: "AI_DYNAMIC",
      targetAction: candidateRule.action,
      targetCount,
      minLevel: 1,
      minFameRank: "ALL",
      rewardXp,
      rewardCrystals,
      rewardMemories: 2,
      isActive: true,
    });

    await UserQuest.create({
      userId,
      questId: newQuest.id,
      currentCount: 0,
      isCompleted: false,
      isClaimed: false,
      assignedDate: today,
    });

    return newQuest;
  } catch (err) {
    console.error("❌ [taskSystem] Lỗi generateAiDynamicQuestForUser:", err);
    return null;
  }
}

// 13 Tầng Cảnh Giới của Cây Thế Giới Irminsul
const REALMS = [
  { tier: 0, id: "ALL", name: "Mọi Cảnh Giới", minLevel: 1, maxLevel: 999 },
  { tier: 1, id: "REALM_1", name: "Người Mới Thức Tỉnh", minLevel: 1, maxLevel: 20 },
  { tier: 2, id: "REALM_2", name: "Kẻ Tìm Đường", minLevel: 21, maxLevel: 40 },
  { tier: 3, id: "REALM_3", name: "Lữ Hành Giả", minLevel: 41, maxLevel: 60 },
  { tier: 4, id: "REALM_4", name: "Nhà Thám Hiểm", minLevel: 61, maxLevel: 80 },
  { tier: 5, id: "REALM_5", name: "Người Gìn Giữ Tri Thức", minLevel: 81, maxLevel: 100 },
  { tier: 6, id: "REALM_6", name: "Người Ghi Chép Ký Ức", minLevel: 101, maxLevel: 120 },
  { tier: 7, id: "REALM_7", name: "Học Giả Cổ Đại", minLevel: 121, maxLevel: 140 },
  { tier: 8, id: "REALM_8", name: "Hiền Giả", minLevel: 141, maxLevel: 160 },
  { tier: 9, id: "REALM_9", name: "Đại Hiền Giả", minLevel: 161, maxLevel: 180 },
  { tier: 10, id: "REALM_10", name: "Thủ Hộ Cổ Thụ", minLevel: 181, maxLevel: 200 },
  { tier: 11, id: "REALM_11", name: "Người Canh Giữ Irminsul", minLevel: 201, maxLevel: 250 },
  { tier: 12, id: "REALM_12", name: "Người Viết Lại Lịch Sử", minLevel: 251, maxLevel: 300 },
  { tier: 13, id: "REALM_13", name: "Hóa Thân Irminsul", minLevel: 301, maxLevel: 9999 },
];

const getRealmByLevel = (level = 1) => {
  const num = Number(level) || 1;
  const match = REALMS.slice(1).find((r) => num >= r.minLevel && num <= r.maxLevel);
  return match || REALMS[1];
};

const FAME_RANK_TIERS = {
  "ALL": 0,
  "RANK_F": 1,
  "RANK_E": 2,
  "RANK_D": 3,
  "RANK_C": 4,
  "RANK_B": 5,
  "RANK_A": 6,
  "RANK_S": 7,
  "RANK_SS": 8,
  "RANK_SSS": 9,
  "RANK_EX": 10
};

const FAME_RANK_INFO = {
  "ALL": { rank: "Mọi Rank", title: "Mọi Hạng" },
  "RANK_F": { rank: "F", title: "Người Mới" },
  "RANK_E": { rank: "E", title: "Lữ Hành Giả" },
  "RANK_D": { rank: "D", title: "Nhà Thám Hiểm" },
  "RANK_C": { rank: "C", title: "Học Giả" },
  "RANK_B": { rank: "B", title: "Hiền Giả" },
  "RANK_A": { rank: "A", title: "Đại Hiền Giả" },
  "RANK_S": { rank: "S", title: "Người Gìn Giữ Ký Ức" },
  "RANK_SS": { rank: "SS", title: "Thủ Hộ Irminsul" },
  "RANK_SSS": { rank: "SSS", title: "Người Viết Lại Lịch Sử" },
  "RANK_EX": { rank: "EX", title: "Hóa Thân Irminsul" }
};

/**
 * Lấy danh sách nhiệm vụ của user và tạo tiến trình nếu chưa có.
 * Nếu user chưa có nhiệm vụ AI_DYNAMIC nào đang hoạt động (chưa nhận quà), tự động sinh 1 nhiệm vụ AI mới.
 */
export async function getOrResetUserTasks(userId) {
  try {
    const today = new Date().toISOString().split("T")[0];
    let quests = await Quest.findAll({ where: { isActive: true }, order: [["id", "ASC"]] });
    let userQuests = await UserQuest.findAll({
      where: { userId, assignedDate: today },
    });

    // Kiểm tra xem user đã có nhiệm vụ AI_DYNAMIC chưa nhận quà hôm nay chưa
    const questById = {};
    quests.forEach((q) => {
      questById[q.id] = q;
    });
    const activeAiUserQuests = userQuests
      .filter((uq) => {
        const q = questById[uq.questId];
        return q && q.questType === "AI_DYNAMIC" && !uq.isClaimed;
      })
      .sort((a, b) => b.questId - a.questId);

    // Nếu trước đó có nhiều hơn 1 nhiệm vụ AI chưa nhận quà, chỉ giữ lại 1 nhiệm vụ AI mới nhất
    if (activeAiUserQuests.length > 1) {
      for (let i = 1; i < activeAiUserQuests.length; i++) {
        const dupUq = activeAiUserQuests[i];
        const dupQuest = questById[dupUq.questId];
        if (dupQuest) {
          dupQuest.isActive = false;
          await dupQuest.save();
        }
        await dupUq.destroy();
      }
      quests = await Quest.findAll({ where: { isActive: true }, order: [["id", "ASC"]] });
      userQuests = await UserQuest.findAll({
        where: { userId, assignedDate: today },
      });
    } else if (activeAiUserQuests.length === 0) {
      await generateAiDynamicQuestForUser(userId, { replaceUnclaimed: false });
      quests = await Quest.findAll({ where: { isActive: true }, order: [["id", "ASC"]] });
      userQuests = await UserQuest.findAll({
        where: { userId, assignedDate: today },
      });
    }

    const userGam = await UserGamification.findOne({ where: { userId } });
    const userLevel = userGam?.level || 1;
    const userRealm = getRealmByLevel(userLevel);
    const userRank = userGam?.fameRank || "RANK_F";
    const userRankTier = FAME_RANK_TIERS[userRank] || 1;

    const userQuestMap = {};
    userQuests.forEach((uq) => {
      userQuestMap[uq.questId] = uq;
    });

    const result = [];
    for (const q of quests) {
      const isAiQuest = q.questType === "AI_DYNAMIC";

      // Nhiệm vụ AI_DYNAMIC là nhiệm vụ cá nhân của từng user:
      // chỉ hiển thị nhiệm vụ AI thuộc về userId này và chưa nhận thưởng (khi nhận thưởng sẽ tự sinh cái mới)
      if (isAiQuest) {
        const ownUq = userQuestMap[q.id];
        if (!ownUq || ownUq.isClaimed) continue;
      }

      const minLvl = q.minLevel || 1;
      const minRank = q.minFameRank || "ALL";
      const requiredRankTier = FAME_RANK_TIERS[minRank] || 0;
      const reqRealm = getRealmByLevel(minLvl);
      const reqRankInfo = FAME_RANK_INFO[minRank] || { rank: minRank, title: minRank };
      
      const hasRealmCondition = minLvl > 1;
      const hasRankCondition = minRank !== "ALL";

      const isRealmMet = !hasRealmCondition || userLevel >= minLvl;
      const isRankMet = !hasRankCondition || userRankTier >= requiredRankTier;
      const isUnlocked = isRealmMet && isRankMet;

      let lockReason = null;
      if (!isUnlocked) {
        if (!isRealmMet && !isRankMet) {
          lockReason = `Yêu cầu Tầng ${reqRealm.tier}: ${reqRealm.name} & Rank ${reqRankInfo.rank} (${reqRankInfo.title})`;
        } else if (!isRealmMet) {
          lockReason = `Yêu cầu Cảnh Giới Tầng ${reqRealm.tier}: ${reqRealm.name}`;
        } else {
          lockReason = `Yêu cầu Rank ${reqRankInfo.rank} (Hạng: ${reqRankInfo.title})`;
        }
      }

      let uq = userQuestMap[q.id];
      if (!uq) {
        uq = await UserQuest.create({
          userId,
          questId: q.id,
          currentCount: 0,
          isCompleted: false,
          isClaimed: false,
          assignedDate: today,
        });
      }

      result.push({
        id: q.id,
        title: q.title,
        description: q.description,
        type: q.questType.toLowerCase(),
        rawQuestType: q.questType,
        isAiGenerated: isAiQuest,
        actionType: q.targetAction,
        actionHint: getActionHintText(q.targetAction, q.targetCount),
        targetValue: q.targetCount,
        minLevel: minLvl,
        minFameRank: minRank,
        minRealmTier: reqRealm.tier,
        minRealmName: reqRealm.name,
        minRankCode: reqRankInfo.rank,
        minRankTitle: reqRankInfo.title,
        isLocked: !isUnlocked,
        lockReason,
        rewardXp: q.rewardXp,
        rewardCrystal: q.rewardCrystals,
        progress: {
          currentValue: uq.currentCount,
          isCompleted: uq.isCompleted,
          isClaimed: uq.isClaimed,
        },
      });
    }

    // Đưa nhiệm vụ do AI tạo lên đầu danh sách để người dùng thấy ngay
    result.sort((a, b) => {
      if (a.isAiGenerated && !b.isAiGenerated) return -1;
      if (!a.isAiGenerated && b.isAiGenerated) return 1;
      return a.id - b.id;
    });

    return result;
  } catch (error) {
    console.error("❌ [taskSystem] Lỗi getOrResetUserTasks:", error);
    return [];
  }
}

/**
 * Cập nhật tiến độ nhiệm vụ dựa trên hành động của user
 */
export async function triggerTaskProgress(userId, actionType, amount = 1) {
  try {
    const today = new Date().toISOString().split("T")[0];
    
    // Bản đồ tương thích hành động (linh hoạt mọi tên gọi)
    const ACTION_ALIASES = {
      RECEIVE_LIKE: ["RECEIVE_LIKE", "RECEIVE_100_LIKES"],
      RECEIVE_100_LIKES: ["RECEIVE_LIKE", "RECEIVE_100_LIKES"],
      READ_CHAPTER: ["READ_CHAPTER", "READ_100", "READ_FIRST"],
      READ_100: ["READ_CHAPTER", "READ_100"],
      READ_FIRST: ["READ_CHAPTER", "READ_FIRST"],
      POST_COMMENT: ["POST_COMMENT", "COMMENT"],
      COMMENT: ["POST_COMMENT", "COMMENT"],
      BOOKMARK_COMIC: ["BOOKMARK_COMIC", "FOLLOW_COMIC"],
      FOLLOW_COMIC: ["BOOKMARK_COMIC", "FOLLOW_COMIC"],
      CHECK_IN: ["CHECK_IN", "DAILY_LOGIN"],
      DAILY_LOGIN: ["CHECK_IN", "DAILY_LOGIN"]
    };
    const targetActions = ACTION_ALIASES[actionType] || [actionType];

    const quests = await Quest.findAll({
      where: { targetAction: targetActions, isActive: true },
    });
    if (quests.length === 0) return;

    const userGam = await UserGamification.findOne({ where: { userId } });
    const userLevel = userGam?.level || 1;
    const userRank = userGam?.fameRank || "RANK_F";
    const userRankTier = FAME_RANK_TIERS[userRank] || 1;

    for (const q of quests) {
      const minLvl = q.minLevel || 1;
      const minRank = q.minFameRank || "ALL";
      const requiredRankTier = FAME_RANK_TIERS[minRank] || 0;
      
      // Nếu user chưa đủ cấp độ hoặc danh vọng thì không tính tiến độ
      if (userLevel < minLvl || userRankTier < requiredRankTier) continue;

      let uq = null;
      if (q.questType === "AI_DYNAMIC") {
        // Chỉ cộng tiến độ cho nhiệm vụ AI đã được giao riêng cho user này
        uq = await UserQuest.findOne({
          where: { userId, questId: q.id, assignedDate: today },
        });
        if (!uq || uq.isClaimed) continue;
      } else {
        const [foundOrCreated] = await UserQuest.findOrCreate({
          where: { userId, questId: q.id, assignedDate: today },
          defaults: {
            currentCount: 0,
            isCompleted: false,
            isClaimed: false,
          },
        });
        uq = foundOrCreated;
      }

      if (uq.isCompleted) continue;

      uq.currentCount += amount;
      if (uq.currentCount >= q.targetCount) {
        uq.currentCount = q.targetCount;
        uq.isCompleted = true;
      }
      await uq.save();
    }
  } catch (error) {
    console.error(`❌ [taskSystem] Lỗi triggerTaskProgress (${actionType}):`, error);
  }
}

/**
 * Nhận thưởng nhiệm vụ (Nếu là nhiệm vụ do AI tạo thì sau khi nhận quà sẽ tự động tạo ngay 1 nhiệm vụ AI mới)
 */
export async function claimTaskReward(userId, taskId) {
  try {
    const today = new Date().toISOString().split("T")[0];
    const quest = await Quest.findByPk(taskId);
    if (!quest) throw new Error("Nhiệm vụ không tồn tại");

    const uq = await UserQuest.findOne({
      where: { userId, questId: taskId, assignedDate: today },
    });
    if (!uq) throw new Error("Tiến trình nhiệm vụ không tồn tại");
    if (!uq.isCompleted) throw new Error("Nhiệm vụ chưa hoàn thành");
    if (uq.isClaimed) throw new Error("Nhiệm vụ đã nhận thưởng rồi");

    uq.isClaimed = true;
    uq.claimedAt = new Date();
    await uq.save();

    // Cộng XP và Crystals vào user_gamification
    let [gam] = await UserGamification.findOrCreate({
      where: { userId },
      defaults: {
        level: 1,
        currentXp: 0,
        nextLevelXp: 100,
        worldCrystals: 0,
      },
    });

    gam.worldCrystals += quest.rewardCrystals;
    addXpToGamification(gam, quest.rewardXp, quest.rewardMemories);
    await gam.save();

    // Ghi nhận sổ cái crystal_transactions
    await CrystalTransaction.create({
      userId,
      amount: quest.rewardCrystals,
      transactionType: "QUEST_REWARD",
      description: `Thưởng hoàn thành nhiệm vụ: ${quest.title}`,
      balanceAfter: gam.worldCrystals,
    });

    // Nếu nhiệm vụ vừa nhận quà là nhiệm vụ AI_DYNAMIC -> Đóng nhiệm vụ cũ và tự động nhờ AI tạo ngay nhiệm vụ mới
    let newAiQuest = null;
    if (quest.questType === "AI_DYNAMIC") {
      quest.isActive = false;
      await quest.save();
      newAiQuest = await generateAiDynamicQuestForUser(userId, {
        replaceUnclaimed: true,
        lastAction: quest.targetAction,
      });
    }

    return {
      success: true,
      rewardXp: quest.rewardXp,
      rewardCrystal: quest.rewardCrystals,
      level: gam.level,
      currentXp: gam.currentXp,
      worldCrystal: gam.worldCrystals,
      newAiQuest: newAiQuest
        ? {
            id: newAiQuest.id,
            title: newAiQuest.title,
            description: newAiQuest.description,
            actionHint: getActionHintText(newAiQuest.targetAction, newAiQuest.targetCount),
          }
        : null,
    };
  } catch (error) {
    console.error("❌ [taskSystem] Lỗi claimTaskReward:", error);
    throw error;
  }
}
