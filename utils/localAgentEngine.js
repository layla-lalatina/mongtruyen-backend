/**
 * 🌳 SYSTEM: IRMINSUL FANTASY RPG — HYBRID LOCAL AGENT ENGINE
 * ==============================================================================
 * @file localAgentEngine.js
 * @path backend/utils/localAgentEngine.js
 * @description
 * Kiến trúc Local Agent kết hợp (Hybrid Local Agent):
 *  1. Nhận thức ngữ cảnh trang thực tế (Real-time Web Page Context Perception)
 *  2. Bộ định tuyến ý định & thực thi công cụ nội bộ (Local Intent Router & Tool Executor)
 *  3. Tự động thao tác trên Web & RPG (Điểm danh, Nhận thưởng nhiệm vụ, Đổi nhiệm vụ AI,
 *     Theo dõi/Bỏ theo dõi truyện, Mở trang truyện/chương truyện, Điều hướng UI)
 *  4. Bộ não suy nghĩ Gemini/Gemma (Xoay tua Đa Key & 4 Model cấu hình trong .env,
 *     chỉ đóng vai trò suy luận & tổng hợp phản hồi)
 *  5. Tự hành nội bộ (Local Autonomous Fallback) khi tất cả model chạm hạn mức.
 * ==============================================================================
 */

import {
  Comic,
  Genre,
  Chapter,
  ChapterAiSummary,
  ComicAiProfile,
  Bookmark,
  ReadingHistory,
  User,
  UserGamification,
  CrystalTransaction,
  Comment,
} from "../models/index.js";
import { sequelize } from "../config/database.js";
import {
  getOrResetUserTasks,
  claimTaskReward,
  generateAiDynamicQuestForUser,
  triggerTaskProgress,
} from "./taskSystem.js";
import {
  addXpToGamification,
  getLevelTitle,
  BREAKPOINTS,
  ITEM_DETAILS,
} from "./irminsulSystem.js";
import { getVipXpMultiplier } from "./accessControl.js";

// ─── LỊCH ĐIỂM DANH 7 NGÀY (ĐỒNG BỘ VỚI routes/user.js) ───
const CHECKIN_7DAY_REWARDS = [
  { day: 1, crystals: 15, xp: 30, memories: 1, label: "Mầm Ký Ức" },
  { day: 2, crystals: 20, xp: 40, memories: 1, label: "Giọt Sương Mai" },
  { day: 3, crystals: 30, xp: 60, memories: 2, label: "Lá Non Cổ Thụ", bonusItem: "material_sun_clover" },
  { day: 4, crystals: 35, xp: 70, memories: 2, label: "Nhánh Tri Thức" },
  { day: 5, crystals: 50, xp: 100, memories: 3, label: "Hoa Ánh Sao", bonusItem: "material_star_dust" },
  { day: 6, crystals: 65, xp: 120, memories: 3, label: "Tinh Hoa Rừng Sâu" },
  { day: 7, crystals: 120, xp: 250, memories: 8, label: "Rương Đại Thụ Irminsul", bonusItem: "world_tree_leaf", isGrandChest: true },
];

function getUserRpgInventory(user) {
  try {
    if (!user || !user.bio) {
      return {
        world_tree_leaf: 2,
        material_sun_clover: 5,
        material_moon_mushroom: 5,
        material_star_dust: 5,
        material_dream_drop: 5,
        material_memory_crystal: 5,
      };
    }
    const parsed = JSON.parse(user.bio);
    if (parsed && typeof parsed === "object" && parsed.__rpg_inv) {
      return parsed.__rpg_inv;
    }
    if (parsed && typeof parsed === "object" && !parsed.__rpg_inv && !parsed.bioText) {
      return parsed;
    }
  } catch (e) {}
  return {
    world_tree_leaf: 2,
    material_sun_clover: 5,
    material_moon_mushroom: 5,
    material_star_dust: 5,
    material_dream_drop: 5,
    material_memory_crystal: 5,
  };
}

async function saveUserRpgInventory(user, inventory) {
  let data = {};
  try {
    if (user.bio) {
      const parsed = JSON.parse(user.bio);
      if (parsed && typeof parsed === "object") data = parsed;
    }
  } catch (e) {
    data = { bioText: user.bio };
  }
  data.__rpg_inv = inventory;
  await user.update({ bio: JSON.stringify(data) });
}

// ─── ĐỌC DANH SÁCH 4 MODEL TỪ .ENV ───
export function getEnvModelsChain(mode = "CHAT") {
  const defaultChat = [
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemma-4-26b-a4b-it",
    "gemma-4-31b-it",
  ];
  const defaultAnalysis = [
    "gemma-4-26b-a4b-it",
    "gemma-4-31b-it",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
  ];

  const envStr =
    mode === "ANALYSIS"
      ? process.env.GEMINI_ANALYSIS_MODELS || process.env.GEMINI_MODELS || ""
      : process.env.GEMINI_CHAT_MODELS || process.env.GEMINI_MODELS || "";

  const parsed = envStr
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  if (parsed.length > 0) {
    return [...new Set(parsed)];
  }
  return mode === "ANALYSIS" ? defaultAnalysis : defaultChat;
}

// ─── CHUẨN HÓA CHUỖI TIẾNG VIỆT KHÔNG DẤU ĐỂ NHẬN DIỆN Ý ĐỊNH NỘI BỘ ───
export function normalizeVi(str = "") {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s/._-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── ĐÓNG GÓI & GIẢI NÉN METADATA (SUY NGHĨ -> HÀNH ĐỘNG) TRONG LỊCH SỬ CHAT ───
export function packMessageWithAgentMeta(text, agentMeta) {
  const cleanText = String(text || "").trim();
  if (!agentMeta || (!agentMeta.thought && !agentMeta.action)) {
    return cleanText;
  }
  const safeMeta = {
    thought: String(agentMeta.thought || "").slice(0, 220),
    action: String(agentMeta.action || "").slice(0, 220),
  };
  return `<!--AGENT_META:${JSON.stringify(safeMeta)}-->\n${cleanText}`;
}

export function unpackMessageWithAgentMeta(rawText = "") {
  const str = String(rawText || "");
  const match = str.match(/^<!--AGENT_META:(\{.*?\})-->\r?\n?/);
  if (!match) {
    return { text: str, agentMeta: null };
  }
  let agentMeta = null;
  try {
    agentMeta = JSON.parse(match[1]);
  } catch (e) {
    agentMeta = null;
  }
  const cleanText = str.slice(match[0].length).trim();
  return { text: cleanText, agentMeta };
}

export function extractBrainThoughtAndReply(rawText = "", candidate = null, fallbackThought = "") {
  let text = String(rawText || "").trim();
  let thought = "";

  // 1. Kiểm tra phần thought native từ candidate (nếu model có trả về part.thought)
  const parts = candidate?.content?.parts || [];
  const nativeThought = parts
    .filter((p) => p.thought && typeof p.text === "string")
    .map((p) => p.text.trim())
    .filter(Boolean)
    .join(" ");

  // 2. Kiểm tra tag [SUY_NGHI]: ... ở đầu câu trả lời
  const tagMatch = text.match(/^\s*\[?SUY[_\s]?NGH[IĨ]\]?\s*:\s*([^\r\n]+)[\r\n]*/i);
  if (tagMatch) {
    thought = tagMatch[1].trim();
    text = text.slice(tagMatch[0].length).trim();
  } else if (nativeThought) {
    thought = nativeThought.split(/[.!\n]/)[0].trim().slice(0, 180);
  }

  if (!thought) {
    thought = fallbackThought || "Phân tích yêu cầu của lữ khách và tổng hợp câu trả lời từ Cây Thế Giới";
  }

  return {
    thought: thought.replace(/^["'`]+|["'`]+$/g, "").trim(),
    reply: text,
  };
}

// ─── TẦNG 1: NHẬN DIỆN NGỮ CẢNH TRANG HIỆN TẠI (REAL-TIME WEB PAGE PERCEPTION) ───
export async function resolvePageContext(rawContext = {}, userId = null) {
  const pathname = String(rawContext?.pathname || "").trim();
  const search = String(rawContext?.search || "").trim();
  const result = {
    pathname: pathname || "/",
    search,
    pageType: "HOME",
    pageLabel: "Trang chủ Mộng Truyện",
    comic: null,
    currentChapter: null,
  };

  try {
    let comicSlug = rawContext?.comicSlug || null;
    let chapterParam = rawContext?.chapter || null;

    // 1. Phân tích đường dẫn URL hiện tại
    const detailMatch = pathname.match(/^\/truyen\/([^/?#]+)/i);
    const readMatch = pathname.match(/^\/doc\/([^/?#]+)\/([^/?#]+)/i);
    const categoryMatch = pathname.match(/^\/the-loai\/?([^/?#]*)/i);

    if (readMatch) {
      result.pageType = "READING_CHAPTER";
      comicSlug = decodeURIComponent(readMatch[1]);
      chapterParam = decodeURIComponent(readMatch[2]);
      result.pageLabel = `Đang đọc truyện (${comicSlug} - Chương ${chapterParam})`;
    } else if (detailMatch) {
      result.pageType = "COMIC_DETAIL";
      comicSlug = decodeURIComponent(detailMatch[1]);
      result.pageLabel = `Trang chi tiết truyện (${comicSlug})`;
    } else if (categoryMatch) {
      result.pageType = "CATEGORY";
      const catSlug = categoryMatch[1] ? decodeURIComponent(categoryMatch[1]) : "Tất cả";
      result.pageLabel = `Trang thể loại (${catSlug})`;
    } else if (pathname.startsWith("/profile")) {
      result.pageType = "PROFILE";
      result.pageLabel = "Trang Hồ Sơ & Cây Thế Giới Irminsul";
    } else if (pathname.startsWith("/deposit")) {
      result.pageType = "DEPOSIT";
      result.pageLabel = "Trang Nạp Tinh Thạch & Gói VIP";
    } else if (pathname.startsWith("/translator")) {
      result.pageType = "TRANSLATOR";
      result.pageLabel = "Không gian Dịch Giả";
    } else if (pathname.startsWith("/admin")) {
      result.pageType = "ADMIN";
      result.pageLabel = "Bảng Quản Trị Hệ Thống";
    } else if (pathname.startsWith("/hot")) {
      result.pageType = "HOT_COMICS";
      result.pageLabel = "Bảng Xếp Hạng Truyện Hot";
    } else if (pathname.startsWith("/full")) {
      result.pageType = "COMPLETED_COMICS";
      result.pageLabel = "Danh Sách Truyện Đã Hoàn Thành";
    } else if (pathname.startsWith("/search")) {
      result.pageType = "SEARCH";
      result.pageLabel = "Trang Tìm Kiếm Truyện";
    }

    // 2. Nếu người dùng đang đứng ở trang Chi tiết truyện hoặc Đọc chương -> Nạp dữ liệu thật từ DB
    if (comicSlug) {
      const comic = await Comic.findOne({
        where: { slug: comicSlug },
        include: [
          { model: Genre, as: "genres", attributes: ["name"], through: { attributes: [] } },
          { model: ComicAiProfile, as: "aiProfile" },
        ],
      });

      if (comic) {
        const [chapters, followersCount, isBookmarked, userHistory] = await Promise.all([
          Chapter.findAll({
            where: { comicId: comic.id },
            order: [["chapter_number", "ASC"]],
            attributes: ["id", "chapterNumber", "chapterName", "unlockType", "unlockPrice"],
            include: [{ model: ChapterAiSummary, as: "aiSummary", attributes: ["summaryText", "keyPlotPoints", "characterActions"] }],
          }),
          Bookmark.count({ where: { comicId: comic.id } }),
          userId ? Bookmark.findOne({ where: { userId, comicId: comic.id } }) : null,
          userId
            ? ReadingHistory.findOne({
                where: { userId, comicId: comic.id },
                include: [{ model: Chapter, as: "lastChapter", attributes: ["chapterNumber", "chapterName"] }],
              })
            : null,
        ]);

        const latestChap = chapters.length > 0 ? chapters[chapters.length - 1] : null;
        const firstChap = chapters.length > 0 ? chapters[0] : null;
        const lastReadChapNum = userHistory?.lastChapter?.chapterNumber || null;

        result.comic = {
          id: comic.id,
          title: comic.title,
          slug: comic.slug,
          markdownLink: `[${comic.title}](/truyen/${comic.slug})`,
          author: comic.author || "Đang cập nhật",
          status: comic.status || "ONGOING",
          ageRating: comic.ageRating || "ALL",
          isVip: !!comic.isVip,
          views: Number(comic.totalViews || 0),
          rating: Number(comic.ratingAvg || 0),
          followers: followersCount,
          isFollowing: !!isBookmarked,
          genres: (comic.genres || []).map((g) => g.name),
          description: String(comic.description || "").slice(0, 600),
          totalChapters: chapters.length,
          firstChapterNumber: firstChap ? firstChap.chapterNumber : 1,
          latestChapterNumber: latestChap ? latestChap.chapterNumber : null,
          lastReadChapterNumber: lastReadChapNum,
          aiProfile: comic.aiProfile
            ? {
                mainCharacter: comic.aiProfile.mainCharacter,
                femaleLead: comic.aiProfile.femaleLead,
                powerType: comic.aiProfile.powerType,
                powerDescription: comic.aiProfile.powerDescription,
                personalityTraits: comic.aiProfile.personalityTraits,
                storyPremise: comic.aiProfile.storyPremise,
              }
            : null,
          chapterSummaries: chapters
            .filter((ch) => ch.aiSummary?.summaryText)
            .slice(0, 6)
            .map((ch) => ({
              chapterNumber: ch.chapterNumber,
              chapterName: ch.chapterName,
              summaryText: ch.aiSummary.summaryText,
            })),
        };

        result.pageLabel =
          result.pageType === "READING_CHAPTER"
            ? `Đang đọc "${comic.title}" - Chương ${chapterParam}`
            : `Đang xem truyện "${comic.title}"`;

        // 3. Nếu đang đọc chương cụ thể -> lấy thêm tóm tắt chương đó và chương kế tiếp
        if (chapterParam !== null) {
          const numMatch = String(chapterParam).match(/[\d.]+/);
          const chapNum = numMatch ? parseFloat(numMatch[0]) : null;
          const matchedChap = chapters.find(
            (c) => parseFloat(c.chapterNumber) === chapNum || String(c.chapterNumber) === String(chapterParam)
          );

          if (matchedChap) {
            const chapIdx = chapters.findIndex((c) => c.id === matchedChap.id);
            const nextChap = chapIdx >= 0 && chapIdx + 1 < chapters.length ? chapters[chapIdx + 1] : null;
            const prevChap = chapIdx > 0 ? chapters[chapIdx - 1] : null;
            const aiSum = await ChapterAiSummary.findOne({ where: { chapterId: matchedChap.id } });

            result.currentChapter = {
              id: matchedChap.id,
              number: matchedChap.chapterNumber,
              name: matchedChap.chapterName || `Chương ${matchedChap.chapterNumber}`,
              nextChapterNumber: nextChap ? nextChap.chapterNumber : null,
              prevChapterNumber: prevChap ? prevChap.chapterNumber : null,
              summaryText: aiSum?.summaryText || null,
              keyPlotPoints: aiSum?.keyPlotPoints || [],
              characterActions: aiSum?.characterActions || [],
            };
          }
        }
      }
    }
  } catch (err) {
    console.warn("[LocalAgent] Lỗi resolvePageContext:", err.message);
  }

  return result;
}

// ─── TẦNG 2: BỘ CÔNG CỤ & HÀNH ĐỘNG LOCAL (LOCAL TOOLS & AUTONOMOUS ACTIONS) ───
export function createLocalAgentToolbox({
  userObj,
  gam,
  isAdmin,
  isTranslator,
  pageContext,
  searchComicsSmart,
  Op,
}) {
  const userId = userObj?.id;
  const executedActions = []; // Danh sách nhãn hành động hiển thị cho người dùng
  const clientActions = [];   // Danh sách lệnh điều khiển UI trình duyệt

  const addActionLabel = (label) => {
    if (label && !executedActions.includes(label)) {
      executedActions.push(label);
    }
  };

  const addClientAction = (actionObj) => {
    if (!actionObj || !actionObj.type) return;
    const exists = clientActions.some(
      (a) => a.type === actionObj.type && a.path === actionObj.path && a.slug === actionObj.slug
    );
    if (!exists) clientActions.push(actionObj);
  };

  const tools = {
    // 1. Tìm kiếm truyện thông minh (Semantic Search)
    async searchComics({ keyword = "", genres = [], clues = [] }) {
      const q = keyword || clues.join(" ") || genres.join(" ");
      addActionLabel(`Quét kho truyện: "${q.slice(0, 28)}"`);
      const results = await searchComicsSmart({ keyword: q, genres, clues });
      return {
        comics: results,
        count: results.length,
        keywordSearched: q,
      };
    },

    // 2. Xem chi tiết 1 bộ truyện
    async getComicDetail({ slug = "", title = "" }) {
      const targetSlug = String(slug || "").trim() || (title ? "" : pageContext?.comic?.slug || "");
      const targetTitle = String(title || "").trim();
      const include = [
        { model: Genre, as: "genres", attributes: ["name"], through: { attributes: [] } },
        { model: ComicAiProfile, as: "aiProfile" },
      ];

      let comic = null;
      if (targetSlug) {
        comic = await Comic.findOne({ where: { slug: targetSlug }, include });
      }
      if (!comic && (targetTitle || targetSlug)) {
        comic = await Comic.findOne({
          where: { title: { [Op.like]: `%${targetTitle || targetSlug}%` } },
          include,
        });
      }
      if (!comic && pageContext?.comic?.slug) {
        comic = await Comic.findOne({ where: { slug: pageContext.comic.slug }, include });
      }
      if (!comic) {
        return { found: false, message: "Không tìm thấy truyện khớp với tên/slug yêu cầu." };
      }

      addActionLabel(`Tra cứu chi tiết truyện "${comic.title}"`);

      const [latestChapters, firstChap, totalChapters, followersCount, isBookmarked] = await Promise.all([
        Chapter.findAll({
          where: { comicId: comic.id },
          order: [["chapterNumber", "DESC"]],
          limit: 6,
          attributes: ["id", "chapterNumber", "chapterName", "unlockType", "unlockPrice", "freeAt", "publishedAt"],
          include: [{ model: ChapterAiSummary, as: "aiSummary", attributes: ["summaryText"] }],
        }),
        Chapter.findOne({
          where: { comicId: comic.id },
          order: [["chapterNumber", "ASC"]],
          attributes: ["chapterNumber"],
        }),
        Chapter.count({ where: { comicId: comic.id } }),
        Bookmark.count({ where: { comicId: comic.id } }),
        userId ? Bookmark.findOne({ where: { userId, comicId: comic.id } }) : null,
      ]);

      return {
        found: true,
        id: comic.id,
        name: comic.title,
        slug: comic.slug,
        markdownLink: `[${comic.title}](/truyen/${comic.slug})`,
        author: comic.author,
        status: comic.status,
        ageRating: comic.ageRating,
        isVipOnly: !!comic.isVip,
        isFollowing: !!isBookmarked,
        genres: (comic.genres || []).map((g) => g.name),
        views: Number(comic.totalViews || 0),
        rating: Number(comic.ratingAvg || 0),
        followers: followersCount,
        totalChapters,
        firstChapterNumber: firstChap?.chapterNumber || 1,
        latestChapterNumber: latestChapters[0]?.chapterNumber || 1,
        latestChapters: latestChapters.map((c) => ({
          number: c.chapterNumber,
          name: c.chapterName,
          unlockType: c.unlockType,
          unlockPrice: c.unlockPrice,
          freeAt: c.freeAt,
          summaryText: c.aiSummary?.summaryText || null,
        })),
        aiProfile: comic.aiProfile
          ? {
               mainCharacter: comic.aiProfile.mainCharacter,
              femaleLead: comic.aiProfile.femaleLead,
              powerType: comic.aiProfile.powerType,
              powerDescription: comic.aiProfile.powerDescription,
              storyPremise: comic.aiProfile.storyPremise,
            }
          : null,
        description: String(comic.description || "").slice(0, 600),
      };
    },

    // 3. Kiểm tra tủ sách theo dõi & chương mới chưa đọc
    async getMyFollowedComics() {
      addActionLabel("Kiểm tra tủ sách đang theo dõi");
      const [rows] = await sequelize.query(
        `SELECT t.*,
                (SELECT COUNT(*) FROM chapters ch3
                  WHERE ch3.comic_id = t.comic_id
                    AND ch3.chapter_number > COALESCE(t.last_read_chapter, 0)) AS unread_chapters
         FROM (
           SELECT c.id AS comic_id, c.title, c.slug, c.status,
                  (SELECT MAX(ch.chapter_number) FROM chapters ch WHERE ch.comic_id = c.id) AS latest_chapter,
                  (SELECT MAX(ch2.chapter_number) FROM reading_histories rh
                     JOIN chapters ch2 ON ch2.id = rh.last_chapter_id
                    WHERE rh.user_id = :uid AND rh.comic_id = c.id) AS last_read_chapter
           FROM bookmarks b
           JOIN comics c ON c.id = b.comic_id
           WHERE b.user_id = :uid
           ORDER BY b.created_at DESC
           LIMIT 25
         ) t`,
        { replacements: { uid: userId } }
      );
      return {
        totalFollowed: rows.length,
        comics: rows.map((r) => ({
          name: r.title,
          slug: r.slug,
          markdownLink: `[${r.title}](/truyen/${r.slug})`,
          status: r.status,
          latestChapter: r.latest_chapter,
          lastReadChapter: r.last_read_chapter,
          unreadChapters: Number(r.unread_chapters || 0),
        })),
      };
    },

    // 4. Xem lịch sử đọc gần đây của người dùng
    async getMyReadingHistory() {
      addActionLabel("Tra cứu lịch sử đọc gần đây");
      const histories = await ReadingHistory.findAll({
        where: { userId },
        include: [
          { model: Comic, as: "comic", attributes: ["id", "title", "slug", "status"] },
          { model: Chapter, as: "lastChapter", attributes: ["chapterNumber", "chapterName"] },
        ],
        order: [["updated_at", "DESC"]],
        limit: 10,
      });

      return {
        totalHistory: histories.length,
        items: histories
          .filter((h) => h.comic)
          .map((h) => ({
            name: h.comic.title,
            slug: h.comic.slug,
            markdownLink: `[${h.comic.title}](/truyen/${h.comic.slug})`,
            lastReadChapter: h.lastChapter?.chapterNumber || 1,
            readContinueUrl: `/doc/${h.comic.slug}/${h.lastChapter?.chapterNumber || 1}`,
          })),
      };
    },

    // 5. Xem trạng thái RPG, Điểm danh & Nhiệm vụ hiện tại
    async getMyRpgStatusAndQuests() {
      addActionLabel("Kiểm tra hồ sơ RPG & Nhiệm vụ Irminsul");
      const freshGam = await UserGamification.findOne({ where: { userId } });
      const tasks = await getOrResetUserTasks(userId);
      const today = new Date().toISOString().split("T")[0];
      const checkedInToday = freshGam?.lastCheckinDate === today;
      const completedUnclaimed = tasks.filter((t) => t.progress?.isCompleted && !t.progress?.isClaimed);

      return {
        level: freshGam?.level || 1,
        levelTitle: getLevelTitle(freshGam?.level || 1),
        currentXp: freshGam?.currentXp || 0,
        nextLevelXp: freshGam?.nextLevelXp || 100,
        irminsulMemories: freshGam?.irminsulMemories || 0,
        worldCrystals: freshGam?.worldCrystals || 0,
        fameRank: freshGam?.fameRank || "RANK_F",
        dailyStreak: freshGam?.dailyStreak || 0,
        checkedInToday,
        isAtBreakpoint: BREAKPOINTS.includes(freshGam?.level || 1),
        completedUnclaimedCount: completedUnclaimed.length,
        activeQuests: tasks.slice(0, 8).map((t) => ({
          id: t.id,
          title: t.title,
          actionHint: t.actionHint,
          isAiGenerated: t.isAiGenerated,
          progress: `${t.progress?.currentValue || 0}/${t.targetValue || 1}`,
          isCompleted: !!t.progress?.isCompleted,
          isClaimed: !!t.progress?.isClaimed,
          rewardXp: t.rewardXp,
          rewardCrystal: t.rewardCrystal,
        })),
      };
    },

    // 6. HÀNH ĐỘNG TỰ ĐỘNG: Điểm danh hằng ngày (Daily Check-in)
    async dailyCheckIn() {
      const user = await User.findByPk(userId);
      const freshGam = await UserGamification.findOne({ where: { userId } });
      if (!freshGam) {
        return { success: false, message: "Chưa khởi tạo hồ sơ Gamification." };
      }

      const today = new Date().toISOString().split("T")[0];
      if (freshGam.lastCheckinDate === today) {
        addActionLabel("Kiểm tra điểm danh (Đã điểm danh hôm nay)");
        return {
          success: true,
          alreadyCheckedIn: true,
          streak: freshGam.dailyStreak || 1,
          worldCrystals: freshGam.worldCrystals,
          level: freshGam.level,
          message: `Hôm nay anh đã điểm danh rồi (Chuỗi ${freshGam.dailyStreak || 1} ngày). Hãy quay lại vào ngày mai nhé!`,
        };
      }

      const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
      const newStreak = freshGam.lastCheckinDate === yesterday ? (freshGam.dailyStreak || 0) + 1 : 1;
      const cycleIdx = (newStreak - 1) % 7;
      const rewardCfg = CHECKIN_7DAY_REWARDS[cycleIdx];
      const xpMult = getVipXpMultiplier(freshGam);
      const finalXp = Math.round(rewardCfg.xp * xpMult);

      freshGam.dailyStreak = newStreak;
      freshGam.lastCheckinDate = today;
      freshGam.worldCrystals += rewardCfg.crystals;
      addXpToGamification(freshGam, finalXp, rewardCfg.memories);
      await freshGam.save();

      let bonusItemName = null;
      if (rewardCfg.bonusItem && user) {
        const inv = getUserRpgInventory(user);
        inv[rewardCfg.bonusItem] = (inv[rewardCfg.bonusItem] || 0) + 1;
        await saveUserRpgInventory(user, inv);
        bonusItemName = ITEM_DETAILS[rewardCfg.bonusItem]?.name || rewardCfg.bonusItem;
      }

      await CrystalTransaction.create({
        userId,
        amount: rewardCfg.crystals,
        transactionType: "DAILY_CHECKIN",
        description: `[Local Agent] Điểm danh ngày ${cycleIdx + 1}/7 (${rewardCfg.label}) - Chuỗi ${newStreak} ngày`,
        balanceAfter: freshGam.worldCrystals,
      });

      try {
        await triggerTaskProgress(userId, "DAILY_LOGIN", 1);
      } catch (e) {}

      addActionLabel(`Đã điểm danh ngày ${cycleIdx + 1}/7 (+${rewardCfg.crystals} Tinh Thạch, +${finalXp} XP)`);
      addClientAction({
        type: "REFRESH_USER_STATE",
        toast: {
          icon: "🎁",
          name: `Điểm danh ngày ${cycleIdx + 1}/7: +${rewardCfg.crystals} Tinh Thạch, +${finalXp} XP`,
        },
      });

      return {
        success: true,
        alreadyCheckedIn: false,
        streak: newStreak,
        cycleDay: cycleIdx + 1,
        rewardLabel: rewardCfg.label,
        rewardXp: finalXp,
        rewardCrystals: rewardCfg.crystals,
        bonusItemName,
        newLevel: freshGam.level,
        newWorldCrystals: freshGam.worldCrystals,
      };
    },

    // 7. HÀNH ĐỘNG TỰ ĐỘNG: Nhận thưởng tất cả nhiệm vụ đã hoàn thành
    async claimCompletedQuests() {
      const tasks = await getOrResetUserTasks(userId);
      const claimable = tasks.filter((t) => t.progress?.isCompleted && !t.progress?.isClaimed);

      if (claimable.length === 0) {
        const incomplete = tasks.filter((t) => !t.progress?.isCompleted && !t.isLocked).slice(0, 4);
        addActionLabel("Kiểm tra nhiệm vụ (Chưa có nhiệm vụ hoàn thành để nhận)");
        return {
          success: true,
          claimedCount: 0,
          message: "Hiện chưa có nhiệm vụ nào hoàn thành chờ nhận thưởng.",
          pendingQuests: incomplete.map((q) => ({
            title: q.title,
            actionHint: q.actionHint,
            progress: `${q.progress?.currentValue || 0}/${q.targetValue || 1}`,
            rewardXp: q.rewardXp,
            rewardCrystal: q.rewardCrystal,
          })),
        };
      }

      const claimedList = [];
      let totalXpGained = 0;
      let totalCrystalGained = 0;
      let latestNewAiQuest = null;

      for (const q of claimable) {
        try {
          const res = await claimTaskReward(userId, q.id);
          if (res?.success) {
            totalXpGained += Number(res.rewardXp || 0);
            totalCrystalGained += Number(res.rewardCrystal || 0);
            claimedList.push({
              title: q.title,
              xp: res.rewardXp,
              crystals: res.rewardCrystal,
            });
            if (res.newAiQuest) {
              latestNewAiQuest = res.newAiQuest;
            }
          }
        } catch (e) {}
      }

      addActionLabel(`Nhận thưởng ${claimedList.length} nhiệm vụ (+${totalXpGained} XP, +${totalCrystalGained} Tinh Thạch)`);
      addClientAction({
        type: "REFRESH_USER_STATE",
        toast: {
          icon: "🏆",
          name: `Nhận thưởng ${claimedList.length} nhiệm vụ: +${totalCrystalGained} Tinh Thạch, +${totalXpGained} XP!`,
        },
      });

      return {
        success: true,
        claimedCount: claimedList.length,
        totalXpGained,
        totalCrystalGained,
        claimedQuests: claimedList,
        newAiQuestSpawned: latestNewAiQuest,
      };
    },

    // 8. HÀNH ĐỘNG TỰ ĐỘNG: Sinh / Đổi nhiệm vụ AI cá nhân mới
    async generateNewAiQuest() {
      const newQuest = await generateAiDynamicQuestForUser(userId, { replaceUnclaimed: true });
      if (!newQuest) {
        return { success: false, message: "Không thể khởi tạo nhiệm vụ AI mới lúc này." };
      }
      addActionLabel(`Giao nhiệm vụ AI mới: "${newQuest.title}"`);
      addClientAction({
        type: "REFRESH_USER_STATE",
        toast: {
          icon: "🌿",
          name: `Nhiệm vụ AI mới: ${newQuest.title}`,
        },
      });
      return {
        success: true,
        quest: {
          id: newQuest.id,
          title: newQuest.title,
          description: newQuest.description,
          targetAction: newQuest.targetAction,
          targetCount: newQuest.targetCount,
          rewardXp: newQuest.rewardXp,
          rewardCrystals: newQuest.rewardCrystals,
        },
      };
    },

    // 9. HÀNH ĐỘNG TỰ ĐỘNG: Theo dõi hoặc Bỏ theo dõi truyện
    async toggleFollowComic({ slug = "", title = "", mode = "FOLLOW" }) {
      const targetSlug = String(slug || "").trim() || (title ? "" : pageContext?.comic?.slug || "");
      const targetTitle = String(title || "").trim();

      let comic = null;
      if (targetSlug) comic = await Comic.findOne({ where: { slug: targetSlug } });
      if (!comic && targetTitle) {
        comic = await Comic.findOne({ where: { title: { [Op.like]: `%${targetTitle}%` } } });
      }
      if (!comic && pageContext?.comic?.slug) {
        comic = await Comic.findOne({ where: { slug: pageContext.comic.slug } });
      }

      if (!comic) {
        return { success: false, message: "Không xác định được bộ truyện cần theo dõi/hủy theo dõi." };
      }

      const upperMode = String(mode || "FOLLOW").toUpperCase();
      if (upperMode === "UNFOLLOW") {
        await Bookmark.destroy({ where: { userId, comicId: comic.id } });
        const totalFollowers = await Bookmark.count({ where: { comicId: comic.id } });
        addActionLabel(`Đã bỏ theo dõi "${comic.title}"`);
        addClientAction({
          type: "BOOKMARK_CHANGED",
          slug: comic.slug,
          isFollowing: false,
          followers: totalFollowers,
          toast: { icon: "🔖", name: `Đã bỏ theo dõi "${comic.title}"` },
        });
        return {
          success: true,
          action: "UNFOLLOWED",
          comicTitle: comic.title,
          markdownLink: `[${comic.title}](/truyen/${comic.slug})`,
          followers: totalFollowers,
        };
      } else {
        const [, created] = await Bookmark.findOrCreate({
          where: { userId, comicId: comic.id },
          defaults: { notifyNewChapter: true },
        });
        if (created) {
          await triggerTaskProgress(userId, "BOOKMARK_COMIC", 1);
        }
        const totalFollowers = await Bookmark.count({ where: { comicId: comic.id } });
        addActionLabel(`Đã theo dõi truyện "${comic.title}"`);
        addClientAction({
          type: "BOOKMARK_CHANGED",
          slug: comic.slug,
          isFollowing: true,
          followers: totalFollowers,
          toast: { icon: "❤️", name: `Đã thêm "${comic.title}" vào tủ sách theo dõi!` },
        });
        return {
          success: true,
          action: "FOLLOWED",
          alreadyFollowed: !created,
          comicTitle: comic.title,
          markdownLink: `[${comic.title}](/truyen/${comic.slug})`,
          followers: totalFollowers,
        };
      }
    },

    // 10. HÀNH ĐỘNG TỰ ĐỘNG: Điều hướng / Mở trang hoặc chương truyện trên Web
    async navigateWeb({ target = "", slug = "", title = "", chapter = null }) {
      const normTarget = normalizeVi(target);

      // Điều hướng tới các trang hệ thống
      if (normTarget === "profile" || normTarget.includes("ca nhan") || normTarget.includes("nhiem vu") || normTarget.includes("tui do")) {
        const path = normTarget.includes("nhiem vu") ? "/profile?tab=quests" : "/profile";
        const label = normTarget.includes("nhiem vu") ? "Mở Bảng Nhiệm Vụ RPG" : "Mở Trang Cá Nhân";
        addActionLabel(`Điều hướng web ➔ ${label}`);
        addClientAction({ type: "NAVIGATE", path, label, autoNavigate: true });
        return { success: true, navigatedTo: path, label };
      }
      if (normTarget === "deposit" || normTarget.includes("nap") || normTarget.includes("vip")) {
        const path = "/deposit";
        const label = "Mở Trang Nạp Tinh Thạch & VIP";
        addActionLabel(`Điều hướng web ➔ ${label}`);
        addClientAction({ type: "NAVIGATE", path, label, autoNavigate: true });
        return { success: true, navigatedTo: path, label };
      }
      if (normTarget === "hot" || normTarget.includes("truyen hot")) {
        const path = "/hot";
        const label = "Mở Bảng Xếp Hạng Truyện Hot";
        addActionLabel(`Điều hướng web ➔ ${label}`);
        addClientAction({ type: "NAVIGATE", path, label, autoNavigate: true });
        return { success: true, navigatedTo: path, label };
      }
      if (normTarget === "full" || normTarget.includes("hoan thanh")) {
        const path = "/full";
        const label = "Mở Truyện Đã Hoàn Thành";
        addActionLabel(`Điều hướng web ➔ ${label}`);
        addClientAction({ type: "NAVIGATE", path, label, autoNavigate: true });
        return { success: true, navigatedTo: path, label };
      }
      if (normTarget === "translator" && isTranslator) {
        const path = "/translator";
        const label = "Mở Không Gian Dịch Giả";
        addActionLabel(`Điều hướng web ➔ ${label}`);
        addClientAction({ type: "NAVIGATE", path, label, autoNavigate: true });
        return { success: true, navigatedTo: path, label };
      }
      if (normTarget === "admin" && isAdmin) {
        const path = "/admin";
        const label = "Mở Bảng Quản Trị Admin";
        addActionLabel(`Điều hướng web ➔ ${label}`);
        addClientAction({ type: "NAVIGATE", path, label, autoNavigate: true });
        return { success: true, navigatedTo: path, label };
      }

      // Điều hướng tới bộ truyện hoặc đọc chương truyện
      const targetSlug = String(slug || "").trim() || (title ? "" : pageContext?.comic?.slug || "");
      const targetTitle = String(title || "").trim();

      let comic = null;
      if (targetSlug) comic = await Comic.findOne({ where: { slug: targetSlug } });
      if (!comic && targetTitle) {
        comic = await Comic.findOne({ where: { title: { [Op.like]: `%${targetTitle}%` } } });
      }
      if (!comic && pageContext?.comic?.slug) {
        comic = await Comic.findOne({ where: { slug: pageContext.comic.slug } });
      }

      if (!comic) {
        return { success: false, message: "Không tìm thấy bộ truyện cần mở trên web." };
      }

      const chapters = await Chapter.findAll({
        where: { comicId: comic.id },
        order: [["chapter_number", "ASC"]],
        attributes: ["id", "chapterNumber", "chapterName"],
      });

      let resolvedChap = null;
      if (chapter === "latest" || normTarget.includes("moi nhat") || normTarget.includes("cuoi")) {
        resolvedChap = chapters.length > 0 ? chapters[chapters.length - 1].chapterNumber : null;
      } else if (chapter === "next" || normTarget.includes("tiep theo") || normTarget.includes("ke tiep")) {
        if (pageContext?.currentChapter?.nextChapterNumber) {
          resolvedChap = pageContext.currentChapter.nextChapterNumber;
        } else if (pageContext?.comic?.lastReadChapterNumber) {
          const nextFound = chapters.find(
            (c) => parseFloat(c.chapterNumber) > parseFloat(pageContext.comic.lastReadChapterNumber)
          );
          resolvedChap = nextFound ? nextFound.chapterNumber : chapters[chapters.length - 1]?.chapterNumber;
        } else {
          resolvedChap = chapters[0]?.chapterNumber || 1;
        }
      } else if (chapter === "continue" || normTarget.includes("doc tiep")) {
        const hist = await ReadingHistory.findOne({
          where: { userId, comicId: comic.id },
          include: [{ model: Chapter, as: "lastChapter", attributes: ["chapterNumber"] }],
        });
        resolvedChap = hist?.lastChapter?.chapterNumber || chapters[0]?.chapterNumber || 1;
      } else if (chapter === "first" || normTarget.includes("dau tien") || normTarget.includes("chuong 1")) {
        resolvedChap = chapters[0]?.chapterNumber || 1;
      } else if (chapter !== null && chapter !== undefined && String(chapter).trim() !== "") {
        const numMatch = String(chapter).match(/[\d.]+/);
        resolvedChap = numMatch ? numMatch[0] : String(chapter).trim();
      }

      const path = resolvedChap
        ? `/doc/${comic.slug}/${resolvedChap}`
        : `/truyen/${comic.slug}`;
      const label = resolvedChap
        ? `Đọc ${comic.title} - Chương ${resolvedChap}`
        : `Mở truyện ${comic.title}`;

      addActionLabel(`Mở trang web ➔ ${label}`);
      addClientAction({
        type: "NAVIGATE",
        path,
        label,
        comicTitle: comic.title,
        slug: comic.slug,
        chapter: resolvedChap,
        autoNavigate: true,
      });

      return {
        success: true,
        navigatedTo: path,
        label,
        comicTitle: comic.title,
        markdownLink: `[${comic.title}](/truyen/${comic.slug})`,
        chapter: resolvedChap,
      };
    },

    // 11. Phân tích xu hướng độc giả (Translator & Admin)
    async getReaderTrends() {
      if (!isTranslator && !isAdmin) {
        return { error: "Chỉ Dịch giả và Quản trị viên mới có quyền xem phân tích xu hướng." };
      }
      addActionLabel("Phân tích xu hướng độc giả toàn sàn");
      const [genreTrends] = await sequelize.query(`
        SELECT g.name, COUNT(DISTINCT cg.comic_id) AS total_comics, COALESCE(SUM(c.total_views), 0) AS total_views
        FROM genres g
        LEFT JOIN comic_genres cg ON g.id = cg.genre_id
        LEFT JOIN comics c ON cg.comic_id = c.id
        GROUP BY g.id, g.name
        ORDER BY total_views DESC
        LIMIT 8`);
      const [topComics] = await sequelize.query(`
        SELECT c.title, c.slug, c.total_views,
               (SELECT COUNT(*) FROM bookmarks b WHERE b.comic_id = c.id) AS followers,
               (SELECT COUNT(*) FROM chapters ch WHERE ch.comic_id = c.id) AS chapters_count
        FROM comics c ORDER BY c.total_views DESC LIMIT 6`);
      return {
        topGenres: genreTrends.map((g) => ({
          name: g.name,
          totalComics: Number(g.total_comics),
          totalViews: Number(g.total_views),
        })),
        mostPopularComics: topComics.map((c) => ({
          name: c.title,
          markdownLink: `[${c.title}](/truyen/${c.slug})`,
          views: Number(c.total_views),
          followers: Number(c.followers),
          chapters: Number(c.chapters_count),
        })),
      };
    },

    // 12. Thống kê truyện của Dịch giả (Translator & Admin)
    async getTranslatorStats({ targetUserId = null } = {}) {
      if (!isTranslator && !isAdmin) {
        return { error: "Chỉ Dịch giả và Quản trị viên mới có quyền xem thống kê truyện đăng." };
      }
      const targetId = isAdmin && targetUserId ? targetUserId : userId;
      addActionLabel("Tổng hợp thống kê truyện của Dịch giả");
      const [myComics] = await sequelize.query(
        `SELECT c.title, c.slug, c.total_views, c.rating_avg, c.status,
                (SELECT COUNT(*) FROM chapters ch WHERE ch.comic_id = c.id) AS chapters_count,
                (SELECT COUNT(*) FROM bookmarks b WHERE b.comic_id = c.id) AS followers
         FROM comics c WHERE c.uploader_id = :targetId ORDER BY c.total_views DESC`,
        { replacements: { targetId } }
      );
      return {
        uploaderId: targetId,
        totalUploadedComics: myComics.length,
        totalViews: myComics.reduce((a, c) => a + Number(c.total_views || 0), 0),
        totalFollowers: myComics.reduce((a, c) => a + Number(c.followers || 0), 0),
        comicsList: myComics.map((c) => ({
          name: c.title,
          markdownLink: `[${c.title}](/truyen/${c.slug})`,
          views: Number(c.total_views),
          chapters: Number(c.chapters_count),
          followers: Number(c.followers),
          status: c.status,
        })),
      };
    },

    // 13. Tổng quan hệ thống (Translator & Admin)
    async getPlatformOverview() {
      if (!isTranslator && !isAdmin) {
        return { error: "Không có quyền truy cập số liệu tổng quan hệ thống." };
      }
      addActionLabel("Truy xuất số liệu tổng quan hệ thống");
      const [[o]] = await sequelize.query(`
        SELECT
          (SELECT COUNT(*) FROM users) AS users_total,
          (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL 7 DAY) AS users_new_7d,
          (SELECT COUNT(*) FROM comics) AS comics_total,
          (SELECT COUNT(*) FROM comics WHERE is_vip = 1) AS comics_vip,
          (SELECT COUNT(*) FROM chapters) AS chapters_total,
          (SELECT COUNT(*) FROM chapters WHERE published_at >= NOW() - INTERVAL 7 DAY) AS chapters_new_7d,
          (SELECT COUNT(*) FROM comments) AS comments_total,
          (SELECT COUNT(*) FROM bookmarks) AS bookmarks_total,
          (SELECT COUNT(*) FROM user_gamification WHERE vip_expires_at > NOW()) AS vip_active_users`);
      return { overview: o };
    },
  };

  return {
    tools,
    executedActions,
    clientActions,
    addActionLabel,
    addClientAction,
  };
}

// ─── TẦNG 3: BỘ ĐỊNH TUYẾN Ý ĐỊNH NỘI BỘ (LOCAL INTENT ROUTER & ZERO-QUOTA EXECUTOR) ───
export async function runLocalIntentPreExecution({
  message,
  pageContext,
  toolbox,
  isAdmin,
  isTranslator,
}) {
  const norm = normalizeVi(message);
  const preResults = {};
  let localThoughtHint = "";

  // Kiểm tra xem có phải yêu cầu Admin thao tác/chỉnh sửa dữ liệu bằng SQL phức tạp không
  const isAdminSqlMutationIntent =
    isAdmin &&
    /\b(sql|insert|update|delete|alter|drop|cong tinh thach|tru tinh thach|set password|doi mat khau|khoa tai khoan|ban user|xoa user|xoa binh luan|cap quyen|doi role|update user)\b/.test(
      norm
    );

  // 0. Phát hiện lời chào hỏi / tán gẫu / hỏi chức năng cơ bản (0 Quota)
  if (
    /^(xin chao|chao|chao em|chao nahida|hi|hello|hey|alo|em oi|nahida oi|ban la ai|em la ai|em lam duoc gi|giup gi|huong dan|cam on|thanks|thank you|ok|oke|okay|tam biet|bye)\b/.test(
      norm
    ) &&
    norm.split(" ").length <= 10
  ) {
    preResults.greetingOrHelp = {
      isThanks: /\b(cam on|thanks|thank)\b/.test(norm),
      isBye: /\b(tam biet|bye)\b/.test(norm),
      isHelp: /\b(lam duoc gi|giup gi|huong dan|la ai)\b/.test(norm),
    };
    toolbox.addActionLabel("Phản hồi giao tiếp tức thì từ Bộ nhớ Irminsul");
    localThoughtHint =
      "Nhận diện lời chào/hỏi thăm cơ bản của lữ khách, phản hồi trực tiếp từ bộ máy Local Agent không tiêu tốn quota.";
  }

  // 1. Ghi nhận ngữ cảnh trang hiện tại nếu người dùng đang xem/đọc một bộ truyện trên trang web
  if (pageContext?.comic) {
    preResults.activePageComic = pageContext.comic;
    if (pageContext.currentChapter) {
      preResults.activePageChapter = pageContext.currentChapter;
    }
  }

  // 2. Phát hiện lệnh Điểm danh hằng ngày (0 Quota - Thực thi tức thì trên Backend)
  if (/\b(diem danh|check in|checkin|nhan qua hang ngay)\b/.test(norm)) {
    preResults.dailyCheckInResult = await toolbox.tools.dailyCheckIn();
    localThoughtHint = "Kiểm tra chu kỳ điểm danh 7 ngày của lữ khách và thực hiện điểm danh tự động trên CSDL.";
  }

  // 3. Phát hiện lệnh Nhận thưởng nhiệm vụ (Kể cả khi gọi gộp "Điểm danh và nhận thưởng nhiệm vụ")
  if (
    /\b(nhan thuong nhiem vu|nhan qua nhiem vu|hoan thanh nhiem vu|claim quest|nhan nhiem vu|thuong nhiem vu|nhan het thuong|nhan qua|kiem tra nhiem vu)\b/.test(
      norm
    )
  ) {
    preResults.claimQuestsResult = await toolbox.tools.claimCompletedQuests();
    localThoughtHint = "Rà soát các nhiệm vụ RPG đã hoàn thành trong ngày và tự động cộng thưởng vào tài khoản.";
  }

  // 4. Phát hiện lệnh Giao / Đổi nhiệm vụ AI mới
  if (/\b(giao nhiem vu|doi nhiem vu|tao nhiem vu|nhiem vu ai moi|xin nhiem vu|lam moi nhiem vu)\b/.test(norm)) {
    preResults.newAiQuestResult = await toolbox.tools.generateNewAiQuest();
    localThoughtHint = "Khởi tạo nhiệm vụ AI_DYNAMIC cá nhân hóa mới trên Cây Thế Giới.";
  }

  // 5. Phát hiện câu hỏi về Cấp độ RPG / Nhiệm vụ / Tinh Thạch / Hồ sơ cá nhân
  if (
    /\b(cap do|level|kinh nghiem|xp|tinh thach|crystal|danh vong|rank|nhiem vu|quest|ky uc|irminsul|canh gioi|tui do|vat pham|dot pha)\b/.test(
      norm
    ) &&
    !preResults.newAiQuestResult
  ) {
    preResults.myRpgStatus = await toolbox.tools.getMyRpgStatusAndQuests();
    if (!localThoughtHint) {
      localThoughtHint = "Tra cứu chỉ số cấp độ RPG, Tinh Thạch và tiến độ nhiệm vụ hiện tại của lữ khách.";
    }
  }

  // 6. Phát hiện lệnh Theo dõi / Bỏ theo dõi truyện (0 Quota - Thực thi tức thì trên Backend)
  if (/\b(bo theo doi|huy theo doi|unfollow)\b/.test(norm)) {
    const cleanedTitle = message
      .replace(/^(hãy|giúp mình|em ơi|nahida ơi)?\s*(bỏ theo dõi|hủy theo dõi|unfollow)\s*(truyện|bộ truyện|bộ)?\s*/i, "")
      .replace(/\b(này|đang xem|hộ mình|giúp mình|vào tủ sách|nhé|nha|đi)\b/gi, "")
      .trim();
    preResults.followResult = await toolbox.tools.toggleFollowComic({
      title: cleanedTitle,
      mode: "UNFOLLOW",
    });
    localThoughtHint = "Thực hiện hủy theo dõi bộ truyện khỏi tủ sách cá nhân.";
  } else if (
    /\b(theo doi|luu truyen|them vao tu sach|bookmark)\b/.test(norm) &&
    !/\b(truyen dang theo doi|danh sach theo doi|co chuong moi khong|tu sach cua toi|tu sach cua minh|kiem tra truyen)\b/.test(
      norm
    )
  ) {
    const cleanedTitle = message
      .replace(/^(hãy|giúp mình|em ơi|nahida ơi)?\s*(theo dõi|lưu truyện|thêm vào tủ sách|bookmark)\s*(truyện|bộ truyện|bộ)?\s*/i, "")
      .replace(/\b(này|đang xem|hộ mình|giúp mình|vào tủ sách|nhé|nha|đi)\b/gi, "")
      .trim();
    if (cleanedTitle || pageContext?.comic) {
      preResults.followResult = await toolbox.tools.toggleFollowComic({
        title: cleanedTitle,
        mode: "FOLLOW",
      });
      localThoughtHint = "Thực hiện thêm bộ truyện vào tủ sách theo dõi của lữ khách.";
    }
  }

  // 7. Phát hiện kiểm tra Tủ sách theo dõi / Lịch sử đọc
  if (
    /\b(truyen dang theo doi|truyen theo doi|tu sach|chuong chua doc|co chuong moi|nen doc tiep bo nao|kiem tra truyen minh dang theo doi)\b/.test(
      norm
    ) &&
    !preResults.followResult
  ) {
    preResults.followedComics = await toolbox.tools.getMyFollowedComics();
    localThoughtHint = "Kiểm tra danh sách truyện đang theo dõi và đối chiếu các chương mới chưa đọc.";
  }

  if (/\b(lich su doc|vua doc|doc gan day|dang doc do)\b/.test(norm)) {
    preResults.readingHistory = await toolbox.tools.getMyReadingHistory();
    localThoughtHint = "Tra cứu lịch sử đọc truyện gần đây của lữ khách.";
  }

  // 8. Phát hiện lệnh Điều hướng / Mở trang hoặc Đọc chương trên Web (0 Quota - Thực thi tức thì)
  const navMatch = norm.match(
    /\b(mo trang|chuyen trang|di toi|vao trang|mo truyen|doc truyen|doc tiep|doc ngay|doc luon|doc chuong|mo chuong|chuong tiep theo|chap tiep theo|chuong ke tiep|chuong moi nhat|chap moi nhat)\b/
  );
  if (navMatch) {
    if (/\b(chuong tiep theo|chap tiep theo|chuong ke tiep)\b/.test(norm) && pageContext?.comic) {
      preResults.navigationResult = await toolbox.tools.navigateWeb({
        slug: pageContext.comic.slug,
        chapter: "next",
      });
      localThoughtHint = `Chuyển sang chương tiếp theo của bộ truyện "${pageContext.comic.title}".`;
    } else if (/\b(chuong moi nhat|chap moi nhat|chuong cuoi)\b/.test(norm) && pageContext?.comic) {
      preResults.navigationResult = await toolbox.tools.navigateWeb({
        slug: pageContext.comic.slug,
        chapter: "latest",
      });
      localThoughtHint = `Mở chương mới nhất của bộ truyện "${pageContext.comic.title}".`;
    } else if (/\b(doc tiep|doc ngay|doc luon|mo chuong 1|doc tu dau)\b/.test(norm) && pageContext?.comic) {
      const chapTarget = /\b(chuong 1|tu dau)\b/.test(norm) ? "first" : "continue";
      preResults.navigationResult = await toolbox.tools.navigateWeb({
        slug: pageContext.comic.slug,
        chapter: chapTarget,
      });
      localThoughtHint = `Mở trình đọc chương truyện "${pageContext.comic.title}" cho lữ khách.`;
    } else if (/\b(mo trang ca nhan|vao trang ca nhan|mo bang nhiem vu|mo ho so)\b/.test(norm)) {
      preResults.navigationResult = await toolbox.tools.navigateWeb({ target: norm });
      localThoughtHint = "Điều hướng giao diện web tới trang Hồ sơ / Nhiệm vụ cá nhân.";
    } else if (/\b(mo trang nap|vao trang nap|mua vip|nap tinh thach)\b/.test(norm)) {
      preResults.navigationResult = await toolbox.tools.navigateWeb({ target: "deposit" });
      localThoughtHint = "Điều hướng giao diện web tới trang Nạp Tinh Thạch & VIP.";
    } else {
      const chapNumMatch = norm.match(/\b(?:chuong|chap)\s*([\d.]+)\b/);
      const cleanName = message
        .replace(/^(hãy|giúp mình|em ơi|nahida ơi)?\s*(mở truyện|đọc truyện|mở bộ|đọc bộ|vào truyện)\s*/i, "")
        .replace(/\b(chương|chap)\s*[\d.]+\b/gi, "")
        .replace(/\b(này|nhé|nha|đi|giúp mình|hộ mình)\b/gi, "")
        .trim();
      if (cleanName.length >= 2) {
        preResults.navigationResult = await toolbox.tools.navigateWeb({
          title: cleanName,
          chapter: chapNumMatch ? chapNumMatch[1] : null,
        });
        localThoughtHint = `Tìm và mở bộ truyện "${cleanName}" trực tiếp trên giao diện web.`;
      }
    }
  }

  // 8b. Chỉ đánh dấu askCurrentComicInfo (cần AI suy nghĩ sâu & diễn giải cảm xúc) khi người dùng thực sự hỏi về nội dung/tóm tắt/nhân vật/đánh giá của truyện đang xem (và KHÔNG phải lệnh cơ học Theo dõi / Chuyển chương / Điểm danh)
  if (pageContext?.comic) {
    const isExplicitContentQuestion =
      /\b(main|nhan vat|nu chinh|suc manh|tom tat|noi dung|cot truyen|tac gia|bao nhieu chuong|danh gia|review|hay khong|dien bien|ke ve|giai thich)\b/.test(
        norm
      );
    const isGenericCurrentComicQuestion =
      /\b(truyen nay|bo nay|chuong nay|chap nay)\b/.test(norm) &&
      !preResults.followResult &&
      !preResults.navigationResult &&
      !preResults.dailyCheckInResult &&
      !preResults.claimQuestsResult;

    if (isExplicitContentQuestion || isGenericCurrentComicQuestion) {
      preResults.askCurrentComicInfo = true;
      toolbox.addActionLabel(
        pageContext.currentChapter
          ? `Đọc ngữ cảnh "${pageContext.comic.title}" - Chương ${pageContext.currentChapter.number}`
          : `Phân tích hồ sơ truyện "${pageContext.comic.title}"`
      );
      localThoughtHint = `Nhận diện người dùng đang mở "${pageContext.comic.title}" trên màn hình, trích xuất hồ sơ nhân vật & tóm tắt từ CSDL MySQL.`;
    }
  }

  // 9. Phát hiện nhu cầu Tìm kiếm / Gợi ý truyện / Hỏi thông tin truyện cụ thể
  const isSearchIntent =
    /\b(tim truyen|goi y|de xuat|truyen nao|co truyen|the loai|chuyen sinh|isekai|nau an|am thuc|tu tien|hanh dong|ngon tinh|hai huoc|kinh di|hoc duong|ac nu|he thong|harem|truyen hot|nhieu view|ngau nhien|top truyen|truyen moi|truyen full|hoan thanh)\b/.test(
      norm
    ) && !preResults.askCurrentComicInfo;

  if (
    isSearchIntent ||
    /\b(tim truyen|goi y truyen|goi y cho minh|tim bo|truyen gi|truyen hot|truyen chuyen sinh|goi y ngau nhien)\b/.test(
      norm
    )
  ) {
    const searchRes = await toolbox.tools.searchComics({
      keyword: message,
      genres: [],
      clues: [message],
    });
    preResults.searchComicsResult = searchRes;
    if (!localThoughtHint) {
      localThoughtHint = "Phân tích ngữ nghĩa yêu cầu tìm truyện và đối chiếu với kho truyện Cây Thế Giới.";
    }
  }

  // 10. Phát hiện câu hỏi thống kê của Dịch giả / Admin
  if ((isTranslator || isAdmin) && /\b(xu huong|thi hieu|doc gia thich|the loai hot|the loai tiem nang)\b/.test(norm)) {
    preResults.readerTrends = await toolbox.tools.getReaderTrends();
    localThoughtHint = "Phân tích dữ liệu lượt xem, theo dõi và xu hướng thể loại của độc giả.";
  }

  if ((isTranslator || isAdmin) && /\b(truyen cua toi|truyen anh da dang|thong ke truyen cua toi|hieu suat truyen)\b/.test(norm)) {
    preResults.translatorStats = await toolbox.tools.getTranslatorStats();
    localThoughtHint = "Tổng hợp số liệu lượt xem và người theo dõi các bộ truyện đã đăng.";
  }

  if ((isTranslator || isAdmin) && /\b(tong quan he thong|thong ke toan he thong|kho truyen mysql|bao cao he thong)\b/.test(norm)) {
    preResults.platformOverview = await toolbox.tools.getPlatformOverview();
    localThoughtHint = "Truy xuất bảng số liệu tổng quan toàn hệ thống Mộng Truyện.";
  }

  // Phân loại giữa:
  // 1) Tác vụ cơ học / thao tác nhanh (Điểm danh, Nhận thưởng, Đổi nhiệm vụ, Theo dõi, Mở trang, Xem chỉ số/tủ sách, Chào hỏi) -> Chạy 100% Local (0 Quota)
  // 2) Tác vụ CẦN SUY NGHĨ SÂU & CẢM XÚC (Tìm truyện theo ngữ nghĩa/mô tả ẩn, Tóm tắt & phân tích cảm xúc chương/truyện đang đọc, Phân tích chuyên sâu cho Dịch giả) -> Local Agent gom dữ liệu thực tế rồi gửi cho Bộ não AI Gemini suy luận 100%!
  const actionableKeys = Object.keys(preResults).filter(
    (k) => k !== "activePageComic" && k !== "activePageChapter"
  );

  // Nếu chưa khớp intent nào ở trên nhưng câu hỏi nhắc trực tiếp đến tên một bộ truyện trong CSDL -> tự tra cứu trước cho AI
  if (actionableKeys.length === 0 && !isAdminSqlMutationIntent && norm.length >= 4) {
    const quickSearch = await toolbox.tools.searchComics({
      keyword: message,
      genres: [],
      clues: [message],
    });
    if (quickSearch?.comics?.length > 0 && quickSearch.comics[0].relevanceScore >= 180) {
      const topComic = quickSearch.comics[0];
      const detail = await toolbox.tools.getComicDetail({ slug: topComic.slug, title: topComic.name });
      if (detail && !detail.error) {
        preResults.specificComicDetail = detail;
        actionableKeys.push("specificComicDetail");
        localThoughtHint = `Nhận diện lữ khách đang hỏi về bộ truyện "${detail.title}", trích xuất hồ sơ chi tiết từ CSDL để Bộ não AI phân tích sâu.`;
      }
    }
  }

  // Các khóa yêu cầu Bộ não Gemini suy luận sâu & diễn đạt giàu cảm xúc
  const DEEP_REASONING_KEYS = new Set([
    "askCurrentComicInfo",
    "searchComicsResult",
    "specificComicDetail",
    "readerTrends",
    "translatorStats",
    "platformOverview",
  ]);

  const requiresDeepBrain = actionableKeys.some((k) => DEEP_REASONING_KEYS.has(k));

  // Chỉ tự trả lời Local (0 Quota) khi là thao tác cơ học thuần túy và không cần suy luận sâu
  const canResolveLocally =
    actionableKeys.length > 0 && !requiresDeepBrain && !isAdminSqlMutationIntent;

  return {
    preResults,
    localThoughtHint,
    hasPreExecutedData: Object.keys(preResults).length > 0,
    canResolveLocally,
    requiresDeepBrain,
    isAdminSqlMutationIntent,
  };
}

// ─── TẦNG 4: BỘ TỔNG HỢP PHẢN HỒI LOCAL AGENT (0 QUOTA GEMINI) ───
export function buildLocalFallbackResponse({
  message,
  preResults = {},
  pageContext = {},
  executedActions = [],
  localThoughtHint = "",
  gender = "male",
}) {
  const userPronoun = gender === "female" ? "chị" : "anh";
  const CapPronoun = gender === "female" ? "Chị" : "Anh";

  const thought =
    localThoughtHint ||
    (pageContext?.comic
      ? `Nhận diện ${userPronoun} đang xem "${pageContext.comic.title}" và phân tích dữ liệu trực tiếp trên Local Agent Engine.`
      : `Phân tích ý định của ${userPronoun} và truy xuất dữ liệu trực tiếp từ CSDL Cây Thế Giới Irminsul.`);

  const actionSummary =
    executedActions.length > 0
      ? executedActions.join(" • ")
      : pageContext?.comic
      ? `Đọc ngữ cảnh "${pageContext.comic.title}" & phản hồi tức thì`
      : "Xử lý trực tiếp trên Bộ máy Local Agent";

  const parts = [];

  // 0. Lời chào / Hướng dẫn
  if (preResults.greetingOrHelp) {
    const g = preResults.greetingOrHelp;
    if (g.isThanks) {
      parts.push(
        `🌿 Không có gì đâu ạ! Được đồng hành cùng ${userPronoun} trên Cây Thế Giới Irminsul là niềm vui của em mà. Khi nào cần tìm truyện, điểm danh hay nhận thưởng nhiệm vụ, ${userPronoun} cứ gọi em nhé! ✨`
      );
    } else if (g.isBye) {
      parts.push(
        `🍃 Tạm biệt ${userPronoun} nhé! Chúc ${userPronoun} có những giây phút đọc truyện thật thư giãn trên Mộng Truyện nha! ✨`
      );
    } else if (g.isHelp) {
      parts.push(
        `🌱 Em là **Nahida — Local Agent của Cây Thế Giới Irminsul**! Em có thể tự động thực hiện giúp ${userPronoun} ngay trên web:\n` +
          `- 📅 **Điểm danh & Nhiệm vụ RPG:** *"Điểm danh hằng ngày"*, *"Nhận thưởng nhiệm vụ"*, *"Giao nhiệm vụ AI mới"*\n` +
          `- 📖 **Tương tác truyện đang xem:** *"Tóm tắt bộ truyện này"*, *"Theo dõi truyện này"*, *"Mở chương tiếp theo"*\n` +
          `- 🔍 **Tìm kiếm & Tủ sách:** *"Tìm truyện chuyển sinh nấu ăn"*, *"Truyện mình đang theo dõi có chương mới không?"*`
      );
    } else {
      const ctxNote = pageContext?.comic
        ? ` Em thấy ${userPronoun} đang xem bộ truyện ${pageContext.comic.markdownLink}${
            pageContext.currentChapter ? ` (**Chương ${pageContext.currentChapter.number}**)` : ""
          }. ${CapPronoun} có muốn em tóm tắt cốt truyện, theo dõi bộ này hay mở chương tiếp theo không nè?`
        : ` Hôm nay ${userPronoun} muốn em điểm danh hằng ngày, kiểm tra nhiệm vụ RPG hay tìm một bộ truyện hợp gu để đọc nè?`;
      parts.push(`🌿 Chào ${userPronoun} nha! ✨${ctxNote}`);
    }
  }

  // 1. Kết quả Điểm danh hằng ngày
  if (preResults.dailyCheckInResult) {
    const r = preResults.dailyCheckInResult;
    if (r.alreadyCheckedIn) {
      parts.push(`🌿 ${r.message} (Chuỗi điểm danh hiện tại: **${r.streak} ngày**).`);
    } else if (r.success) {
      const totalCrystalsNow = r.newWorldCrystals ?? r.worldCrystals ?? r.totalCrystals ?? 0;
      parts.push(
        `✨ Em đã tự động điểm danh **Ngày ${r.cycleDay}/7 (${r.rewardLabel})** giúp ${userPronoun} rồi nhé!\n` +
          `- 💎 Phần thưởng: **+${r.rewardCrystals} Tinh Thạch**, **+${r.rewardXp} XP**${
            r.bonusItemName ? ` và **1x ${r.bonusItemName}**` : ""
          }\n` +
          `- 🔥 Chuỗi điểm danh liên tiếp: **${r.streak} ngày** (Tổng sở hữu: **${totalCrystalsNow} Tinh Thạch**).`
      );
    }
  }

  // 2. Kết quả Nhận thưởng nhiệm vụ
  if (preResults.claimQuestsResult) {
    const c = preResults.claimQuestsResult;
    if (c.claimedCount > 0) {
      const qNames = (c.claimedQuests || []).map((q) => `**${q.title}**`).join(", ");
      parts.push(
        `🏆 Em đã thu hoạch phần thưởng từ **${c.claimedCount} nhiệm vụ** (${qNames}) giúp ${userPronoun} rồi nha!\n` +
          `- ⚡ Tổng nhận: **+${c.totalXpGained} XP** và **+${c.totalCrystalGained} Tinh Thạch** 💎` +
          (c.newAiQuestSpawned
            ? `\n- 🌱 Nhiệm vụ AI kế tiếp vừa được khai mở: **${c.newAiQuestSpawned.title}** (*${c.newAiQuestSpawned.description}*).`
            : "")
      );
    } else {
      parts.push(
        `🌱 Hiện tại ${userPronoun} chưa có nhiệm vụ nào hoàn thành chờ nhận thưởng. ${CapPronoun} có thể đọc thêm chương mới, để lại bình luận hoặc điểm danh để hoàn thành chỉ tiêu nhé!`
      );
    }
  }

  // 3. Kết quả Giao / Đổi nhiệm vụ AI mới
  if (preResults.newAiQuestResult?.success) {
    const q = preResults.newAiQuestResult.quest;
    parts.push(
      `🎯 Em vừa khởi tạo một **Chỉ Thị Thảo Thần (AI Quest)** mới cho ${userPronoun}:\n` +
        `- 📜 **${q.title}**: *${q.description}*\n` +
        `- 🎁 Phần thưởng: **+${q.rewardXp} XP** & **+${q.rewardCrystals} Tinh Thạch**`
    );
  }

  // 4. Kết quả Theo dõi / Bỏ theo dõi truyện
  if (preResults.followResult?.success) {
    const f = preResults.followResult;
    parts.push(
      f.action === "FOLLOWED"
        ? `❤️ Em đã lưu bộ truyện ${f.markdownLink} vào **Tủ sách theo dõi** của ${userPronoun} rồi nhé! Hiện bộ này đang có **${f.followers} người theo dõi**. Khi có chương mới hệ thống sẽ báo ngay cho ${userPronoun}! ✨`
        : `🔖 Em đã bỏ theo dõi bộ truyện ${f.markdownLink} khỏi tủ sách theo yêu cầu của ${userPronoun} rồi nha.`
    );
  }

  // 5. Kết quả Điều hướng / Mở trang hoặc chương truyện
  if (preResults.navigationResult?.success) {
    const nav = preResults.navigationResult;
    parts.push(
      `🚀 Em đã kích hoạt điều hướng mở **${nav.label}** trên màn hình cho ${userPronoun} ngay đây! ${
        nav.markdownLink ? `(${nav.markdownLink})` : ""
      } ✨`
    );
  }

  // 6. Kết quả Hồ sơ RPG & Nhiệm vụ hiện tại
  if (preResults.myRpgStatus) {
    const s = preResults.myRpgStatus;
    const activeQuests = (s.activeQuests || s.todayQuests || []).slice(0, 6);
    const questLines = activeQuests.map(
      (q) =>
        `  • ${q.isClaimed ? "✅ [Đã nhận]" : q.isCompleted ? "🎁 **[Chờ nhận thưởng]**" : "⏳"} **${q.title}** (${
          q.progress
        }) — *+${q.rewardXp} XP, +${q.rewardCrystals ?? q.rewardCrystal ?? 0} 💎*`
    );
    parts.push(
      `🌳 **Hồ sơ Cây Thế Giới Irminsul của ${userPronoun}:**\n` +
        `- 🏅 Cảnh giới: **Cấp ${s.level} — ${s.levelTitle}** (*XP: ${s.currentXp}/${s.nextLevelXp}*)\n` +
        `- 💎 Tinh Thạch: **${s.worldCrystals}** • 🧠 Ký Ức: **${s.irminsulMemories}** • 👑 Danh vọng: **${
          s.fameTitle || s.fameRank || "RANK_F"
        }**\n` +
        `- 🔥 Chuỗi điểm danh: **${s.dailyStreak} ngày** (${
          s.checkedInToday ? "Hôm nay đã điểm danh ✅" : "Hôm nay chưa điểm danh ⚠️"
        })\n` +
        (questLines.length > 0 ? `- 📋 **Nhiệm vụ hôm nay:**\n${questLines.join("\n")}` : "")
    );
  }

  // 7. Kết quả Tủ sách đang theo dõi
  if (preResults.followedComics) {
    const fc = preResults.followedComics;
    const followedArr = fc.comics || fc.followedComics || [];
    if (followedArr.length === 0) {
      parts.push(
        `📚 Tủ sách theo dõi của ${userPronoun} hiện đang trống. Khi xem truyện, ${userPronoun} chỉ cần bảo em *"Theo dõi truyện này"* là em lưu vào tủ giúp ${userPronoun} ngay nhé!`
      );
    } else {
      const list = followedArr.slice(0, 6).map((c) => {
        const hasNew = c.hasNewUnreadChapter || Number(c.unreadChapters || 0) > 0;
        const badge = hasNew
          ? `🔥 **Có chương mới (Ch.${c.latestChapter || 1})** — Đọc dở: Ch.${c.lastReadChapter || 0}`
          : `✅ Đã đọc tới Ch.${c.lastReadChapter || c.latestChapter || 1}`;
        return `- ${c.markdownLink}: ${badge}`;
      });
      parts.push(
        `📚 **Tủ sách theo dõi của ${userPronoun} (${fc.totalFollowed} bộ):**\n${list.join("\n")}`
      );
    }
  }

  // 8. Kết quả Lịch sử đọc truyện
  if (preResults.readingHistory) {
    const rh = preResults.readingHistory;
    const histArr = rh.items || rh.recentHistory || [];
    if (histArr.length === 0) {
      parts.push(`📖 ${CapPronoun} chưa có lịch sử đọc truyện nào gần đây.`);
    } else {
      const list = histArr.slice(0, 6).map(
        (h) => `- ${h.markdownLink} — Đọc gần nhất: **Chương ${h.lastReadChapter}**`
      );
      parts.push(`📖 **Các bộ truyện ${userPronoun} vừa đọc gần đây:**\n${list.join("\n")}`);
    }
  }

  // 9. Kết quả Hỏi về bộ truyện / chương đang mở trên màn hình
  if (preResults.askCurrentComicInfo && pageContext?.comic) {
    const c = pageContext.comic;
    const chap = pageContext.currentChapter;
    const prof = c.aiProfile;
    let infoBlock =
      `📖 **Hồ sơ tác phẩm đang mở:** ${c.markdownLink}\n` +
      `- 🏷️ **Thể loại:** ${c.genres?.join(", ") || "Truyện tranh"} • **Tác giả:** ${c.author || "Đang cập nhật"}\n` +
      `- 📊 **Tiến độ:** ${c.totalChapters} chương (Mới nhất: Chương ${c.latestChapterNumber || c.totalChapters}) • 👁️ ${Number(
        c.views || 0
      ).toLocaleString()} lượt xem • ⭐ ${c.rating || 5}/5\n` +
      `- 📌 **Trạng thái của ${userPronoun}:** ${
        c.isFollowing ? "Đang theo dõi ❤️" : "Chưa theo dõi"
      }${c.lastReadChapterNumber ? ` • Đã đọc tới Chương ${c.lastReadChapterNumber}` : ""}`;

    if (prof) {
      infoBlock +=
        `\n- 🦸 **Nhân vật chính:** **${prof.mainCharacter || "Đang cập nhật"}**${
          prof.femaleLead ? ` • **Nữ chính:** ${prof.femaleLead}` : ""
        }\n` +
        `- ⚡ **Hệ thống sức mạnh:** *${prof.powerType || "Đặc trưng"}* — ${
          prof.powerDescription || prof.storyPremise || ""
        }`;
    }

    if (chap) {
      infoBlock += `\n- 📑 **Chương đang đọc (Chương ${chap.number}${
        chap.title ? ` - ${chap.title}` : ""
      }):** ${
        chap.summary ||
        `Diễn biến tiếp nối hành trình của nhân vật chính trong ${c.title}.`
      }`;
    } else if (c.description) {
      infoBlock += `\n- 📝 **Tóm tắt cốt truyện:** ${c.description}`;
    }

    parts.push(infoBlock);
  }

  // 10. Kết quả Hỏi chi tiết 1 bộ truyện cụ thể trong CSDL
  if (preResults.specificComicDetail) {
    const d = preResults.specificComicDetail;
    const prof = d.aiProfile;
    let block =
      `📖 **Thông tin bộ truyện:** ${d.markdownLink}\n` +
      `- 🏷️ **Thể loại:** ${(d.genres || []).join(", ") || "Truyện tranh"} • **Tác giả:** ${d.author}\n` +
      `- 📊 **Số chương:** ${d.totalChapters} chương • 👁️ ${Number(d.views || 0).toLocaleString()} lượt xem • ❤️ ${
        d.followers || 0
      } theo dõi\n` +
      (prof?.mainCharacter
        ? `- 🦸 **Nhân vật chính:** **${prof.mainCharacter}** (${prof.powerType || "Sức mạnh đặc biệt"})\n`
        : "") +
      `- 📝 **Nội dung:** ${d.description || "Một tác phẩm hấp dẫn trên Cây Thế Giới."}`;
    parts.push(block);
  }

  // 11. Kết quả Tìm kiếm / Gợi ý truyện
  if (preResults.searchComicsResult?.comics?.length > 0) {
    const list = preResults.searchComicsResult.comics.slice(0, 5);
    const lines = list.map(
      (c) =>
        `- ${c.markdownLink} (*${c.categories || "Truyện tranh"}*) — 👁️ **${Number(
          c.views || 0
        ).toLocaleString()}** lượt xem: ${c.description}`
    );
    parts.push(
      `📚 Em đã tìm thấy các bộ truyện phù hợp nhất trong kho **Cây Thế Giới Irminsul** cho ${userPronoun}:\n${lines.join(
        "\n"
      )}\n\n💡 *${CapPronoun} muốn đọc ngay bộ nào chỉ cần nhắn "Mở truyện + tên truyện" là em chuyển trang mở liền cho ${userPronoun} nhé!* ✨`
    );
  } else if (preResults.searchComicsResult && (!preResults.searchComicsResult.comics || preResults.searchComicsResult.comics.length === 0)) {
    parts.push(
      `🌿 Em đã rà soát kho truyện nhưng chưa thấy bộ nào khớp chính xác từ khóa này. ${CapPronoun} thử nói rõ hơn về thể loại (như *Tu tiên, Chuyển sinh, Ẩm thực, Hành động, Ngôn tình...*) để em lọc lại giúp ${userPronoun} nha!`
    );
  }

  // 12. Kết quả Thống kê Dịch giả & Admin
  if (preResults.readerTrends && !preResults.readerTrends.error) {
    const rt = preResults.readerTrends;
    const gLines = (rt.topGenres || [])
      .slice(0, 5)
      .map((g, i) => `  ${i + 1}. **${g.name}**: ${g.totalComics} truyện — 👁️ ${g.totalViews.toLocaleString()} lượt xem`);
    const cLines = (rt.mostPopularComics || [])
      .slice(0, 4)
      .map((c) => `  • ${c.markdownLink}: 👁️ ${c.views.toLocaleString()} view • ❤️ ${c.followers} theo dõi`);
    parts.push(
      `📈 **Báo Cáo Xu Hướng Độc Giả Toàn Sàn:**\n- 🔥 **Top Thể Loại Thịnh Hành:**\n${gLines.join(
        "\n"
      )}\n- 🏆 **Truyện Dẫn Đầu Lượt Xem:**\n${cLines.join("\n")}`
    );
  }

  if (preResults.translatorStats && !preResults.translatorStats.error) {
    const ts = preResults.translatorStats;
    const cLines = (ts.comicsList || [])
      .slice(0, 6)
      .map(
        (c) =>
          `  • ${c.markdownLink} (${c.chapters} chương) — 👁️ **${c.views.toLocaleString()}** view • ❤️ **${c.followers}** theo dõi`
      );
    parts.push(
      `✍️ **Thống Kê Truyện Đăng Của Dịch Giả:**\n` +
        `- 📚 Tổng số truyện đã đăng: **${ts.totalUploadedComics} bộ**\n` +
        `- 👁️ Tổng lượt xem tích lũy: **${Number(ts.totalViews || 0).toLocaleString()} lượt xem**\n` +
        `- ❤️ Tổng lượt theo dõi: **${Number(ts.totalFollowers || 0).toLocaleString()} độc giả**\n` +
        (cLines.length > 0 ? `- 📋 **Chi tiết từng bộ:**\n${cLines.join("\n")}` : "")
    );
  }

  if (preResults.platformOverview?.overview) {
    const o = preResults.platformOverview.overview;
    parts.push(
      `👑 **Báo Cáo Tổng Quan Hệ Thống Mộng Truyện (MySQL Real-time):**\n` +
        `- 👥 Tổng thành viên: **${o.users_total}** (*+${o.users_new_7d} thành viên mới 7 ngày qua*)\n` +
        `- 📚 Tổng số bộ truyện: **${o.comics_total} bộ** (*${o.comics_vip} truyện VIP*)\n` +
        `- 📑 Tổng số chương: **${o.chapters_total} chương** (*+${o.chapters_new_7d} chương mới 7 ngày qua*)\n` +
        `- 💬 Tổng bình luận: **${o.comments_total}** • ❤️ Tổng lượt theo dõi: **${o.bookmarks_total}**\n` +
        `- 💎 Tài khoản VIP đang hoạt động: **${o.vip_active_users}**`
    );
  }

  if (parts.length === 0 && pageContext?.comic) {
    const c = pageContext.comic;
    parts.push(
      `📖 ${CapPronoun} đang xem bộ truyện ${c.markdownLink} (${c.genres.join(", ")}) — hiện có **${
        c.totalChapters
      } chương**. ${
        c.aiProfile?.mainCharacter ? `Nhân vật chính là **${c.aiProfile.mainCharacter}**. ` : ""
      }${c.description}`
    );
  }

  if (parts.length === 0) {
    parts.push(
      `🌿 Em đã ghi nhận yêu cầu của ${userPronoun} trên Cây Thế Giới Irminsul! ${CapPronoun} có thể nhờ em tìm truyện, tóm tắt truyện đang xem, điểm danh hằng ngày, nhận thưởng nhiệm vụ hoặc mở nhanh bất kỳ bộ truyện nào nhé! ✨`
    );
  }

  return {
    thought,
    action: actionSummary,
    reply: parts.join("\n\n"),
  };
}
