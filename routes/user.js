/**
 * 🌳 SYSTEM: IRMINSUL FANTASY RPG - USER & GAMIFICATION ROUTES
 * ==============================================================================
 * Chuẩn hóa 100% theo CSDL MySQL truyentranh.sql:
 * - Thông tin tài khoản: bảng `users`
 * - Chỉ số RPG Cây Thế Giới: bảng `user_gamification`
 * - Kho đồ & Trang bị cá nhân hóa: bảng `user_inventory` & `items`
 * - Sổ cái biến động Tinh Thạch: bảng `crystal_transactions`
 * - Lịch sử đọc & Tủ sách: bảng `reading_histories` & `bookmarks`
 * ==============================================================================
 */

import express from "express";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { Op } from "sequelize";
import { sequelize } from "../config/database.js";
import { 
  User, 
  UserGamification, 
  Comic, 
  Chapter, 
  ReadingHistory, 
  Bookmark, 
  Item, 
  UserInventory, 
  Quest, 
  UserQuest, 
  CrystalTransaction 
} from "../models/index.js";
import { uploadAvatar } from "../middleware/upload.js";
import auth from "../middleware/auth.js";
import isAdmin from "../middleware/isAdmin.js";
import { 
  BREAKPOINTS, 
  BREAKTHROUGH_BASE_RATES,
  POTION_MAP, 
  ITEM_DETAILS, 
  rollLootDrop,
  totalXpForLevel,
  xpForLevel,
  getDanhVong,
  getKhuVuc,
  getLevelTitle,
  addXpToGamification,
  syncIrminsulProgress
} from "../utils/irminsulSystem.js";
import {
  getOrResetUserTasks,
  triggerTaskProgress,
  claimTaskReward
} from "../utils/taskSystem.js";
import {
  getActiveVipInfo,
  getUserAiDailyLimit,
  getVipXpMultiplier,
} from "../utils/accessControl.js";

const router = express.Router();

const DEFAULT_LOCAL_AVATAR = "/Images/avatars/default-avatar.png";

function isLegacyAiOrDefaultAvatar(url) {
  if (!url) return true;
  const s = String(url).toLowerCase();
  return (
    s.includes("dicebear.com") ||
    s.includes("robohash.org") ||
    s.includes("enka.network") ||
    s.includes("default_newbie.png")
  );
}

async function resolveUserWebAvatar(user) {
  if (!user) return DEFAULT_LOCAL_AVATAR;
  if (!isLegacyAiOrDefaultAvatar(user.avatarUrl)) {
    return user.avatarUrl;
  }
  try {
    user.avatarUrl = DEFAULT_LOCAL_AVATAR;
    await user.update({ avatarUrl: DEFAULT_LOCAL_AVATAR });
  } catch (e) {}
  return DEFAULT_LOCAL_AVATAR;
}

// Bảng giá vật phẩm Tiệm Ký Ức (RPG Items)
const ITEM_PRICES = {
  world_tree_leaf: 100,
  material_sun_clover: 10,
  material_moon_mushroom: 10,
  material_star_dust: 10,
  material_dream_drop: 10,
  material_memory_crystal: 15,
  witch_potion_t1: 50,
  witch_potion_t2: 75,
  witch_potion_t3: 100,
  witch_potion_t4: 150,
  witch_potion_t5: 200,
  witch_potion_t6: 300,
  witch_potion_t7: 400,
  witch_potion_t8: 500,
  witch_potion_t9: 600,
  witch_potion_t10: 700,
  witch_potion_t11: 800,
  witch_potion_t12: 1000
};

// Helper: Lấy túi đồ RPG của User
function getUserRpgInventory(user) {
  try {
    if (!user || !user.bio) {
      return { 
        world_tree_leaf: 2, 
        material_sun_clover: 5, 
        material_moon_mushroom: 5, 
        material_star_dust: 5, 
        material_dream_drop: 5, 
        material_memory_crystal: 5 
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
    material_memory_crystal: 5 
  };
}

// Helper: Lưu túi đồ RPG của User
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

// Helper: Đảm bảo UserGamification luôn tồn tại
async function getOrCreateGamification(userId) {
  let [gam] = await UserGamification.findOrCreate({
    where: { userId },
    defaults: {
      level: 1,
      currentXp: 0,
      nextLevelXp: 100,
      irminsulMemories: 0,
      fameRank: "RANK_F",
      worldCrystals: 50,
      dailyStreak: 0,
    }
  });
  return gam;
}

// ═══════════════════════════════════════════════════
// 1. FOLLOW / UNFOLLOW (BOOKMARKS)
// ═══════════════════════════════════════════════════
router.post("/follow", auth, async (req, res) => {
  const { slug } = req.body;
  if (!slug) return res.status(400).json({ error: "Thiếu slug truyện" });

  try {
    const comic = await Comic.findOne({ where: { slug } });
    if (!comic) return res.status(404).json({ error: "Không tìm thấy truyện" });

    const [bm, created] = await Bookmark.findOrCreate({
      where: { userId: req.user.id, comicId: comic.id },
      defaults: { notifyNewChapter: true }
    });

    if (created) {
      await triggerTaskProgress(req.user.id, "BOOKMARK_COMIC", 1);
    }

    const totalFollowers = await Bookmark.count({ where: { comicId: comic.id } });
    res.json({
      success: true,
      isFollowing: true,
      followers: totalFollowers,
      message: "Đã thêm vào tủ sách theo dõi!",
    });
  } catch (err) {
    console.error("Lỗi follow:", err);
    res.status(500).json({ error: "Lỗi server khi theo dõi truyện" });
  }
});

router.post("/unfollow", auth, async (req, res) => {
  const { slug } = req.body;
  if (!slug) return res.status(400).json({ error: "Thiếu slug truyện" });

  try {
    const comic = await Comic.findOne({ where: { slug } });
    let totalFollowers = 0;
    if (comic) {
      await Bookmark.destroy({
        where: { userId: req.user.id, comicId: comic.id }
      });
      totalFollowers = await Bookmark.count({ where: { comicId: comic.id } });
    }
    res.json({
      success: true,
      isFollowing: false,
      followers: totalFollowers,
      message: "Đã hủy theo dõi truyện thành công!",
    });
  } catch (err) {
    console.error("Lỗi unfollow:", err);
    res.status(500).json({ error: "Lỗi server khi hủy theo dõi" });
  }
});

router.get("/followed", auth, async (req, res) => {
  try {
    const bookmarks = await Bookmark.findAll({
      where: { userId: req.user.id },
      include: [
        {
          model: Comic,
          as: "comic",
          include: [
            {
              model: Chapter,
              as: "chapters",
              attributes: ["id", "chapterNumber"]
            }
          ]
        }
      ],
      order: [["created_at", "DESC"]],
    });

    const followedComics = bookmarks.map(b => b.comic?.slug).filter(Boolean);
    const comics = bookmarks.map(b => {
      if (!b.comic) return null;
      const chaps = b.comic.chapters || [];
      const maxChapNum = chaps.length > 0 
        ? Math.max(...chaps.map(ch => parseFloat(ch.chapterNumber) || 0)) 
        : 0;
      const displayChap = maxChapNum > 0 ? `${maxChapNum}` : (chaps.length > 0 ? `${chaps.length}` : "1");

      return {
        id: b.comic.id,
        slug: b.comic.slug,
        name: b.comic.title,
        title: b.comic.title,
        thumb_url: b.comic.thumbUrl,
        thumbUrl: b.comic.thumbUrl,
        status: b.comic.status,
        chap: displayChap,
        latestChapter: displayChap,
        totalChapters: chaps.length,
        soChuong: `${chaps.length} chương`,
      };
    }).filter(Boolean);

    res.json({ followedComics, comics });
  } catch (err) {
    console.error("Lỗi lấy danh sách followed:", err);
    res.status(500).json({ error: "Lỗi server khi lấy danh sách theo dõi" });
  }
});

router.get("/is-following/:slug", auth, async (req, res) => {
  try {
    const comic = await Comic.findOne({ where: { slug: req.params.slug } });
    if (!comic) return res.json({ isFollowing: false, followers: 0 });

    const [exist, followers] = await Promise.all([
      Bookmark.findOne({ where: { userId: req.user.id, comicId: comic.id } }),
      Bookmark.count({ where: { comicId: comic.id } }),
    ]);
    res.json({ isFollowing: !!exist, followers });
  } catch (err) {
    res.json({ isFollowing: false, followers: 0 });
  }
});

// ═══════════════════════════════════════════════════
// 2. LỊCH SỬ ĐỌC (READING HISTORIES)
// ═══════════════════════════════════════════════════
router.post("/history", auth, async (req, res) => {
  const { slug, chapter, page = 1 } = req.body;
  if (!slug) return res.status(400).json({ message: "Thiếu slug truyện" });

  try {
    const comic = await Comic.findOne({ where: { slug } });
    if (!comic) return res.status(404).json({ message: "Không tìm thấy truyện" });

    let chapId = null;
    if (chapter !== undefined && chapter !== null && String(chapter).trim() !== "") {
      const rawStr = decodeURIComponent(String(chapter)).trim();
      const numMatch = rawStr.match(/[\d.]+/);
      const targetNum = numMatch ? parseFloat(numMatch[0]) : null;

      if (targetNum !== null && !isNaN(targetNum)) {
        const chap = await Chapter.findOne({
          where: {
            comicId: comic.id,
            [Op.or]: [
              { chapterNumber: targetNum },
              sequelize.where(sequelize.fn("ROUND", sequelize.col("chapter_number"), 2), targetNum),
            ],
          },
        });
        if (chap) chapId = chap.id;
      }

      if (!chapId) {
        const chapByName = await Chapter.findOne({
          where: {
            comicId: comic.id,
            [Op.or]: [
              { chapterName: rawStr },
              { chapterName: `Chương ${rawStr}` },
            ],
          },
        });
        if (chapByName) chapId = chapByName.id;
      }
    }

    if (!chapId) {
      const firstChap = await Chapter.findOne({
        where: { comicId: comic.id },
        order: [["chapter_number", "ASC"]]
      });
      if (firstChap) chapId = firstChap.id;
    }

    if (chapId) {
      const [history, created] = await ReadingHistory.findOrCreate({
        where: { userId: req.user.id, comicId: comic.id },
        defaults: { lastChapterId: chapId, lastPageNumber: page || 1 }
      });

      if (!created) {
        await sequelize.query(
          "UPDATE reading_histories SET last_chapter_id = :chapId, last_page_number = :page, updated_at = NOW() WHERE id = :id",
          {
            replacements: {
              chapId,
              page: page || 1,
              id: history.id,
            },
          }
        );
      }
    }

    await triggerTaskProgress(req.user.id, "READ_CHAPTER", 1);
    res.json({ success: true });
  } catch (err) {
    console.error("Lỗi lưu lịch sử đọc:", err);
    res.status(500).json({ error: "Lỗi server khi lưu lịch sử đọc" });
  }
});

router.get("/history", auth, async (req, res) => {
  try {
    const histories = await ReadingHistory.findAll({
      where: { userId: req.user.id },
      include: [
        { model: Comic, as: "comic" },
        { model: Chapter, as: "lastChapter" }
      ],
      order: [["updated_at", "DESC"]]
    });

    const readingHistory = histories.map(h => {
      if (!h.comic) return null;
      const rawNum = h.lastChapter ? parseFloat(h.lastChapter.chapterNumber) : null;
      const cleanChap =
        rawNum !== null && !isNaN(rawNum)
          ? String(rawNum)
          : h.lastChapter?.chapterNumber
          ? String(h.lastChapter.chapterNumber)
          : "1";
      return {
        slug: h.comic.slug,
        name: h.comic.title,
        title: h.comic.title,
        thumb_url: h.comic.thumbUrl || "/Images/default-cover.jpg",
        thumbUrl: h.comic.thumbUrl || "/Images/default-cover.jpg",
        chapter: cleanChap,
        page: h.lastPageNumber || 1,
        updatedAt: h.updatedAt || h.dataValues?.updated_at
      };
    }).filter(Boolean);

    res.json({ readingHistory });
  } catch (err) {
    console.error("Lỗi lấy lịch sử đọc:", err);
    res.status(500).json({ error: "Lỗi server khi lấy lịch sử đọc" });
  }
});

// ═══════════════════════════════════════════════════
// 3. PROFILE — HỒ SƠ CÂY THẾ GIỚI IRMINSUL
// ═══════════════════════════════════════════════════
router.get("/profile", auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [{ model: UserGamification, as: "gamification" }]
    });

    if (!user) return res.status(404).json({ message: "Không tìm thấy tài khoản người dùng" });

    let gam = user.gamification;
    if (!gam) {
      gam = await getOrCreateGamification(user.id);
    }

    let dailyReward = null;
    const today = new Date().toISOString().split("T")[0];

    // Xử lý điểm danh hằng ngày
    if (gam.lastCheckinDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
      const newStreak = gam.lastCheckinDate === yesterday ? (gam.dailyStreak || 0) + 1 : 1;

      const rewardXp = 25;
      const rewardCrystal = 10;
      const rewardMemory = 1;

      gam.dailyStreak = newStreak;
      gam.lastCheckinDate = today;
      gam.worldCrystals += rewardCrystal;
      addXpToGamification(gam, rewardXp, rewardMemory);
      await gam.save();

      await CrystalTransaction.create({
        userId: user.id,
        amount: rewardCrystal,
        transactionType: "DAILY_CHECKIN",
        description: `Điểm danh hằng ngày - Chuỗi ngày: ${newStreak}`,
        balanceAfter: gam.worldCrystals
      });

      dailyReward = {
        xp: rewardXp,
        crystals: rewardCrystal,
        memories: rewardMemory,
        streak: newStreak,
        message: `Điểm danh thành công ngày thứ ${newStreak}! +${rewardCrystal} Tinh Thạch, +${rewardXp} XP`
      };
    }

    // Lấy túi đồ RPG
    const inventory = getUserRpgInventory(user);

    // Lấy trang bị Shop2D từ user_inventory
    const inventoryRecords = await UserInventory.findAll({
      where: { userId: user.id },
      include: [{ model: Item, as: "item" }]
    });

    const equippedItems = [];
    let equippedFrame = null;
    let equippedTitle = null;
    const ownedItemIds = [];

    inventoryRecords.forEach(inv => {
      if (inv.itemId) ownedItemIds.push(inv.itemId);
      if (inv.item) {
        const isThisEquipped = Boolean(
          inv.isEquipped || 
          (inv.item.itemType === "AVATAR_FRAME" && gam.equippedAvatarFrameId === inv.itemId) ||
          (inv.item.itemType === "TITLE" && gam.equippedTitleId === inv.itemId)
        );
        if (isThisEquipped) {
          equippedItems.push(inv.item);
          if (inv.item.itemType === "AVATAR_FRAME" && !equippedFrame) {
            equippedFrame = inv.item;
          }
          if (inv.item.itemType === "TITLE" && !equippedTitle) {
            equippedTitle = inv.item;
          }
        }
      }
    });

    // Đồng bộ chuẩn hóa cấp độ, XP và Ký Ức theo tầng lọc đột phá Irminsul
    syncIrminsulProgress(gam, gam.irminsulMemories, gam.level);
    await gam.save();

    const levelTitle = getLevelTitle(gam.level);
    const danhVongInfo = getDanhVong(gam.irminsulMemories);
    const khuVucInfo = getKhuVuc(gam.level);

    const levelProgress = gam.nextLevelXp > 0 
      ? Math.min(100, Math.round((gam.currentXp / gam.nextLevelXp) * 100))
      : 100;

    const vipInfo = getActiveVipInfo(gam);
    const resolvedAvatarUrl = await resolveUserWebAvatar(user);

    res.json({
      success: true,
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      avatarUrl: resolvedAvatarUrl,
      bio: user.bio,
      gender: user.gender || null,
      birthYear: user.birthYear || null,
      createdAt: user.createdAt,
      // 👑 VIP
      isVip: vipInfo.isVip,
      vipTier: vipInfo.vipTier,
      vipExpiresAt: vipInfo.vipExpiresAt,
      vipPlanName: vipInfo.plan?.name || null,
      aiDailyLimit: getUserAiDailyLimit(gam),
      // 🌳 Chỉ số RPG
      level: gam.level,
      levelTitle,
      levelProgress,
      currentXp: gam.currentXp,
      nextLevelXp: gam.nextLevelXp,
      xpCurrent: gam.currentXp,
      xpNeeded: gam.nextLevelXp,
      irminsulMemory: gam.irminsulMemories,
      irminsulMemories: gam.irminsulMemories,
      danhVong: gam.fameRank,
      danhVongTitle: danhVongInfo.title,
      khuVuc: khuVucInfo.area,
      khuVucTier: khuVucInfo.tier,
      worldCrystal: gam.worldCrystals,
      worldCrystals: gam.worldCrystals,
      dailyStreak: gam.dailyStreak,
      // 🛡️ Chỉ Số Lữ Hành (RPG Stats)
      triThuc: gam.triThuc || 0,
      danhTieng: gam.danhTieng || 0,
      uyTin: gam.uyTin || 0,
      inventory,
      equippedItems,
      equippedFrame,
      equippedTitle,
      ownedItemIds,
      userInventory: inventoryRecords.map(r => ({
        id: r.id,
        itemId: r.itemId,
        isEquipped: Boolean(
          r.isEquipped || 
          (r.item?.itemType === "AVATAR_FRAME" && gam.equippedAvatarFrameId === r.itemId) ||
          (r.item?.itemType === "TITLE" && gam.equippedTitleId === r.itemId)
        ),
        item: r.item
      })),
      dailyReward,
    });
  } catch (err) {
    console.error("Lỗi lấy thông tin profile:", err);
    res.status(500).json({ error: "Lỗi máy chủ khi lấy hồ sơ người dùng" });
  }
});

// ═══════════════════════════════════════════════════
// 4. THÔNG TIN BẢN THÂN NHANH (/me)
// ═══════════════════════════════════════════════════
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ["id", "username", "email", "role", "avatarUrl", "status", "birthYear"],
      include: [{ model: UserGamification, as: "gamification" }]
    });

    if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng" });
    const gam = user.gamification || await getOrCreateGamification(user.id);
    const vipInfo = getActiveVipInfo(gam);
    const resolvedAvatarUrl = await resolveUserWebAvatar(user);

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        avatarUrl: resolvedAvatarUrl,
        birthYear: user.birthYear || null,
        level: gam.level,
        worldCrystal: gam.worldCrystals,
        worldCrystals: gam.worldCrystals,
        fameRank: gam.fameRank,
        isVip: vipInfo.isVip,
        vipTier: vipInfo.vipTier,
        vipExpiresAt: vipInfo.vipExpiresAt,
        vipPlanName: vipInfo.plan?.name || null,
        aiDailyLimit: getUserAiDailyLimit(gam),
      }
    });
  } catch (err) {
    console.error("Lỗi /me:", err);
    res.status(500).json({ message: "Lỗi server khi lấy thông tin" });
  }
});

// ═══════════════════════════════════════════════════
// 5. CẬP NHẬT THÔNG TIN TÀI KHOẢN
// ═══════════════════════════════════════════════════
router.post("/update-email", auth, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Thiếu email" });

  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: "Không tìm thấy tài khoản" });

    await user.update({ email });
    res.json({ success: true, email });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server khi cập nhật email" });
  }
});

router.post("/update-password", auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ message: "Thiếu thông tin mật khẩu" });

  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: "Không tìm thấy tài khoản" });

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(400).json({ message: "Mật khẩu hiện tại không đúng" });

    const hash = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hash, plainPassword: newPassword });

    res.json({ success: true, message: "Đổi mật khẩu thành công!" });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server khi cập nhật mật khẩu" });
  }
});

router.post("/update-bio", auth, async (req, res) => {
  const { bio } = req.body;
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: "Không tìm thấy tài khoản" });

    await user.update({ bio: bio || "" });
    res.json({ success: true, bio });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server khi cập nhật giới thiệu" });
  }
});

router.post("/update-gender", auth, async (req, res) => {
  const { gender } = req.body;
  if (!gender || !["male", "female", "other"].includes(gender.toLowerCase())) {
    return res.status(400).json({ success: false, message: "Giới tính không hợp lệ (hỗ trợ male hoặc female)" });
  }
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản" });

    await user.update({ gender: gender.toLowerCase() });
    res.json({ success: true, message: "Cập nhật giới tính thành công!", gender: gender.toLowerCase() });
  } catch (err) {
    console.error("Lỗi cập nhật giới tính:", err);
    res.status(500).json({ success: false, message: "Lỗi server khi cập nhật giới tính" });
  }
});

// ═══════════════════════════════════════════════════
// 6. TIỆM KÝ ỨC / MUA VẬT PHẨM (SHOP)
// ═══════════════════════════════════════════════════
router.get("/world-crystal", auth, async (req, res) => {
  try {
    const gam = await getOrCreateGamification(req.user.id);
    res.json({ success: true, worldCrystal: gam.worldCrystals, worldCrystals: gam.worldCrystals });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server khi lấy tinh thạch" });
  }
});

// Mua vật phẩm: Hỗ trợ cả RPG Items (Shop.jsx) và Shop2D Items
router.post("/buy-item", auth, async (req, res) => {
  const { itemId, quantity } = req.body;
  const qty = Math.max(1, parseInt(quantity, 10) || 1);

  if (!itemId) return res.status(400).json({ success: false, message: "Thiếu thông tin vật phẩm cần mua" });

  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });

    const gam = await getOrCreateGamification(req.user.id);

    // TRƯỜNG HỢP 1: Mua vật phẩm RPG từ Tiệm Ký Ức (Lá cây, Nguyên liệu, Thuốc phù thủy)
    if (ITEM_PRICES[itemId] !== undefined) {
      const unitPrice = ITEM_PRICES[itemId];
      const totalPrice = unitPrice * qty;

      if (gam.worldCrystals < totalPrice) {
        return res.status(400).json({ 
          success: false, 
          message: `Không đủ Tinh Thạch! Cần ${totalPrice} Tinh Thạch, bạn hiện có ${gam.worldCrystals}.` 
        });
      }

      // Trừ Tinh Thạch
      gam.worldCrystals -= totalPrice;
      await gam.save();

      // Cộng vào Túi Đồ RPG
      const inventory = getUserRpgInventory(user);
      inventory[itemId] = (inventory[itemId] || 0) + qty;
      await saveUserRpgInventory(user, inventory);

      // Ghi nhận sổ cái
      const itemName = ITEM_DETAILS[itemId]?.name || itemId;
      await CrystalTransaction.create({
        userId: req.user.id,
        amount: -totalPrice,
        transactionType: "SHOP_PURCHASE",
        description: `Mua ${qty}x ${itemName} tại Tiệm Ký Ức`,
        balanceAfter: gam.worldCrystals
      });

      return res.json({
        success: true,
        message: `Đã mua thành công ${qty} ${itemName}!`,
        worldCrystal: gam.worldCrystals,
        worldCrystals: gam.worldCrystals,
        inventory
      });
    }

    // TRƯỜNG HỢP 2: Mua vật phẩm trang bị từ bảng items (Khung đại diện, Danh hiệu...)
    let item = null;
    if (typeof itemId === "number" || (!isNaN(Number(itemId)) && !String(itemId).startsWith("witch_") && !String(itemId).startsWith("material_") && !String(itemId).startsWith("world_"))) {
      item = await Item.findByPk(Number(itemId));
    }
    if (!item && typeof itemId === "string") {
      item = await Item.findOne({ where: { assetResource: itemId } });
    }
    if (!item || !item.isActive) {
      return res.status(404).json({ success: false, message: "Vật phẩm này không tồn tại hoặc đã ngừng bán." });
    }

    const totalPrice = item.priceCrystals * qty;
    if (gam.worldCrystals < totalPrice) {
      return res.status(400).json({ 
        success: false, 
        message: `Bạn không đủ Tinh Thạch! Cần ${totalPrice} Tinh Thạch, hiện có ${gam.worldCrystals}.` 
      });
    }

    const existing = await UserInventory.findOne({
      where: { userId: req.user.id, itemId: item.id }
    });

    if (existing) {
      return res.status(400).json({ success: false, message: "Bạn đã sở hữu vật phẩm này rồi!" });
    }

    gam.worldCrystals -= totalPrice;
    await gam.save();

    await UserInventory.create({
      userId: req.user.id,
      itemId: item.id,
      isEquipped: false,
    });

    await CrystalTransaction.create({
      userId: req.user.id,
      amount: -totalPrice,
      transactionType: "SHOP_PURCHASE",
      description: `Mua vật phẩm: ${item.name}`,
      balanceAfter: gam.worldCrystals
    });

    return res.json({
      success: true,
      message: `Đã mua thành công ${item.name}!`,
      worldCrystal: gam.worldCrystals,
      worldCrystals: gam.worldCrystals,
      item
    });
  } catch (err) {
    console.error("Lỗi mua vật phẩm:", err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi mua vật phẩm" });
  }
});

// Chế tạo thuốc phù thủy từ nguyên liệu
router.post("/craft", auth, async (req, res) => {
  const { potionTier } = req.body;
  const tier = parseInt(potionTier, 10);
  if (!tier || tier < 1 || tier > 12) {
    return res.status(400).json({ success: false, message: "Bậc thuốc chế tạo không hợp lệ." });
  }

  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "Không tìm thấy người dùng." });

    const inventory = getUserRpgInventory(user);
    const reqQty = tier * 2;
    const materials = [
      "material_sun_clover",
      "material_moon_mushroom",
      "material_star_dust",
      "material_dream_drop",
      "material_memory_crystal"
    ];

    for (const mat of materials) {
      if ((inventory[mat] || 0) < reqQty) {
        const matName = ITEM_DETAILS[mat]?.name || mat;
        return res.status(400).json({ 
          success: false, 
          message: `Không đủ nguyên liệu! Cần ${reqQty} ${matName}.` 
        });
      }
    }

    // Trừ 5 loại nguyên liệu
    for (const mat of materials) {
      inventory[mat] = (inventory[mat] || 0) - reqQty;
    }

    // Thêm thuốc bậc tương ứng
    const potionId = `witch_potion_t${tier}`;
    inventory[potionId] = (inventory[potionId] || 0) + 1;

    await saveUserRpgInventory(user, inventory);

    const potionName = ITEM_DETAILS[potionId]?.name || potionId;
    res.json({ 
      success: true, 
      message: `Chế tạo thành công ${potionName}!`, 
      inventory 
    });
  } catch (err) {
    console.error("Lỗi chế tạo thuốc:", err);
    res.status(500).json({ success: false, message: "Lỗi server khi chế tạo thuốc." });
  }
});

// Trang bị / Tháo vật phẩm Shop2D
router.post("/equip-item", auth, async (req, res) => {
  const { itemId, isEquipped } = req.body;
  if (!itemId) return res.status(400).json({ message: "Thiếu thông tin vật phẩm" });

  try {
    let inv = null;
    if (typeof itemId === "number" || (!isNaN(Number(itemId)) && !String(itemId).startsWith("witch_") && !String(itemId).startsWith("material_") && !String(itemId).startsWith("world_"))) {
      inv = await UserInventory.findOne({
        where: { userId: req.user.id, itemId: Number(itemId) },
        include: [{ model: Item, as: "item" }]
      });
    }
    if (!inv && typeof itemId === "string") {
      const it = await Item.findOne({ where: { assetResource: itemId } });
      if (it) {
        inv = await UserInventory.findOne({
          where: { userId: req.user.id, itemId: it.id },
          include: [{ model: Item, as: "item" }]
        });
      }
    }

    if (!inv) return res.status(404).json({ message: "Bạn chưa sở hữu vật phẩm này" });

    const gam = await getOrCreateGamification(req.user.id);
    const equip = isEquipped !== undefined ? Boolean(isEquipped) : !inv.isEquipped;

    if (equip) {
      const sameTypeItems = await Item.findAll({ where: { itemType: inv.item.itemType } });
      const sameTypeIds = sameTypeItems.map(i => i.id);

      await UserInventory.update(
        { isEquipped: false },
        { where: { userId: req.user.id, itemId: sameTypeIds } }
      );

      inv.isEquipped = true;
      await inv.save();

      if (inv.item.itemType === "AVATAR_FRAME") {
        gam.equippedAvatarFrameId = inv.item.id;
      } else if (inv.item.itemType === "TITLE") {
        gam.equippedTitleId = inv.item.id;
      }
    } else {
      inv.isEquipped = false;
      await inv.save();

      if (inv.item.itemType === "AVATAR_FRAME" && gam.equippedAvatarFrameId === inv.item.id) {
        gam.equippedAvatarFrameId = null;
      } else if (inv.item.itemType === "TITLE" && gam.equippedTitleId === inv.item.id) {
        gam.equippedTitleId = null;
      }
    }

    await gam.save();

    res.json({
      success: true,
      message: equip ? `Đã trang bị ${inv.item.name}!` : `Đã tháo ${inv.item.name}!`,
      isEquipped: equip
    });
  } catch (err) {
    console.error("Lỗi trang bị vật phẩm:", err);
    res.status(500).json({ message: "Lỗi server khi trang bị vật phẩm" });
  }
});

// Lấy danh sách vật phẩm Shop2D
router.get("/shop/items", async (req, res) => {
  try {
    const items = await Item.findAll({
      where: { isActive: true },
      order: [["price_crystals", "ASC"]]
    });
    res.json({ success: true, items });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server khi lấy vật phẩm" });
  }
});

// ═══════════════════════════════════════════════════
// 7. NHỊP TIM ĐỌC TRUYỆN — RỚT QUÀ REALTIME
// Quy tắc:
// - Mỗi lần nhận quà cách nhau đúng 10 giây đọc truyện
// - 1 chương truyện tối đa 5 lần nhận thưởng
// - Mỗi ngày giới hạn tối đa 100 lần nhận thưởng
// - Nếu rớt World Crystal thì mỗi lần chỉ nhận 1 hoặc tối đa 2 Tinh Thạch
// ═══════════════════════════════════════════════════
const activeReadingSessions = {};
const DROP_INTERVAL_SEC = 10;
const MAX_DROPS_PER_CHAPTER = 5;
const MAX_DROPS_PER_DAY = 100;

function getUserReadingDropStats(user, today) {
  try {
    if (user && user.bio) {
      const parsed = JSON.parse(user.bio);
      if (parsed && typeof parsed === "object" && parsed.__reading_drops) {
        const rd = parsed.__reading_drops;
        if (rd.date === today) {
          return {
            date: today,
            totalDrops: Number(rd.totalDrops) || 0,
            chapters: rd.chapters && typeof rd.chapters === "object" ? rd.chapters : {},
          };
        }
      }
    }
  } catch (e) {}
  return { date: today, totalDrops: 0, chapters: {} };
}

async function saveUserReadingDropStats(user, stats) {
  if (!user) return;
  let data = {};
  try {
    if (user.bio) {
      const parsed = JSON.parse(user.bio);
      if (parsed && typeof parsed === "object") data = parsed;
    }
  } catch (e) {
    data = { bioText: user.bio };
  }
  data.__reading_drops = stats;
  await user.update({ bio: JSON.stringify(data) });
}

router.post("/reading-heartbeat", auth, async (req, res) => {
  const { comicSlug, chapterSlug } = req.body;
  if (!comicSlug) {
    return res.status(400).json({ error: "Thiếu thông tin truyện" });
  }

  const userId = req.user.id;
  const normChapter = String(chapterSlug || "1").trim();
  const chapterKey = `${comicSlug}::${normChapter}`;
  const today = new Date().toISOString().split("T")[0];
  const now = Date.now();

  const user = await User.findByPk(userId);
  const dropStats = getUserReadingDropStats(user, today);
  const chapterDropsSoFar = Number(dropStats.chapters[chapterKey]) || 0;

  // Kiểm tra giới hạn 100 lần / ngày
  if (dropStats.totalDrops >= MAX_DROPS_PER_DAY) {
    return res.json({
      success: true,
      dailyLimitReached: true,
      chapterDrops: chapterDropsSoFar,
      dailyDrops: dropStats.totalDrops,
      maxChapterDrops: MAX_DROPS_PER_CHAPTER,
      maxDailyDrops: MAX_DROPS_PER_DAY,
      message: `Bạn đã đạt giới hạn nhận thưởng đọc truyện hôm nay (${MAX_DROPS_PER_DAY}/${MAX_DROPS_PER_DAY} lần).`,
    });
  }

  // Kiểm tra giới hạn 5 lần / chương
  if (chapterDropsSoFar >= MAX_DROPS_PER_CHAPTER) {
    return res.json({
      success: true,
      chapterLimitReached: true,
      chapterDrops: chapterDropsSoFar,
      dailyDrops: dropStats.totalDrops,
      maxChapterDrops: MAX_DROPS_PER_CHAPTER,
      maxDailyDrops: MAX_DROPS_PER_DAY,
      message: `Chương này đã nhận tối đa ${MAX_DROPS_PER_CHAPTER}/${MAX_DROPS_PER_CHAPTER} lần thưởng.`,
    });
  }

  // Khởi tạo hoặc chuyển sang chương khác
  if (
    !activeReadingSessions[userId] ||
    activeReadingSessions[userId].chapterKey !== chapterKey ||
    activeReadingSessions[userId].date !== today
  ) {
    activeReadingSessions[userId] = {
      date: today,
      comicSlug,
      chapterSlug: normChapter,
      chapterKey,
      lastHeartbeatTime: now,
      lastDropTime: now,
      cumulativeTime: 0,
    };
    return res.json({
      success: true,
      message: "Khởi tạo phiên đọc chương truyện.",
      chapterDrops: chapterDropsSoFar,
      dailyDrops: dropStats.totalDrops,
      maxChapterDrops: MAX_DROPS_PER_CHAPTER,
      maxDailyDrops: MAX_DROPS_PER_DAY,
    });
  }

  const session = activeReadingSessions[userId];
  const elapsed = Math.floor((now - session.lastHeartbeatTime) / 1000);

  if (elapsed < 2) {
    return res.json({
      success: true,
      message: "Ping quá nhanh, bỏ qua.",
      chapterDrops: chapterDropsSoFar,
      dailyDrops: dropStats.totalDrops,
    });
  }

  const actualElapsed = Math.min(elapsed, 15);
  session.cumulativeTime += actualElapsed;
  session.lastHeartbeatTime = now;

  const secondsSinceLastDrop = (now - (session.lastDropTime || 0)) / 1000;

  // Đủ 10 giây đọc tích lũy cho lần rớt tiếp theo và cách lần rớt trước ít nhất 9.5 giây
  if (
    session.cumulativeTime >= DROP_INTERVAL_SEC &&
    secondsSinceLastDrop >= 9.5 &&
    chapterDropsSoFar < MAX_DROPS_PER_CHAPTER &&
    dropStats.totalDrops < MAX_DROPS_PER_DAY
  ) {
    session.cumulativeTime = Math.max(0, session.cumulativeTime - DROP_INTERVAL_SEC);
    session.lastDropTime = now;

    // Cập nhật bộ đếm chương (tối đa 5) và ngày (tối đa 100)
    const newChapterDrops = chapterDropsSoFar + 1;
    const newDailyDrops = dropStats.totalDrops + 1;
    dropStats.totalDrops = newDailyDrops;
    dropStats.chapters[chapterKey] = newChapterDrops;
    await saveUserReadingDropStats(user, dropStats);

    const gam = await getOrCreateGamification(userId);
    // Rơi vật phẩm, có cơ chế pity tích lũy 100/ngày chắc chắn rơi 2 Lá Thế Giới
    const drop = rollLootDrop(gam.triThuc || gam.level || 0, newDailyDrops);

    if (drop.type === "crystal") {
      // Đảm bảo chỉ nhận 1 hoặc tối đa 2 World Crystal mỗi lần
      drop.amount = Math.min(2, Math.max(1, Number(drop.amount) || 1));
      gam.worldCrystals += drop.amount;
      await gam.save();

      await CrystalTransaction.create({
        userId,
        amount: drop.amount,
        transactionType: "LEVEL_UP",
        description: `Nhận +${drop.amount} Tinh Thạch khi đọc truyện (${comicSlug} - Chương ${normChapter})`,
        balanceAfter: gam.worldCrystals,
      });
    } else if (drop.type === "xp") {
      addXpToGamification(gam, drop.amount, Math.floor(drop.amount / 5));
      await gam.save();
    } else if (drop.type === "item" || drop.type === "material") {
      if (user) {
        const inventory = getUserRpgInventory(user);
        inventory[drop.item] = (inventory[drop.item] || 0) + (drop.amount || 1);
        await saveUserRpgInventory(user, inventory);
      }
    }

    const detail =
      drop.type === "xp"
        ? { name: `+${drop.amount} Điểm Ký Ức (XP)`, icon: "🌳" }
        : drop.type === "crystal"
        ? { name: `+${drop.amount} Tinh Thạch Thế Giới`, icon: "💎" }
        : {
            name: ITEM_DETAILS[drop.item]?.name || drop.item,
            icon: ITEM_DETAILS[drop.item]?.icon || "🎁",
          };

    return res.json({
      success: true,
      drop: {
        ...drop,
        ...detail,
        chapterDrops: newChapterDrops,
        maxChapterDrops: MAX_DROPS_PER_CHAPTER,
        dailyDrops: newDailyDrops,
        maxDailyDrops: MAX_DROPS_PER_DAY,
      },
      chapterDrops: newChapterDrops,
      dailyDrops: newDailyDrops,
      chapterLimitReached: newChapterDrops >= MAX_DROPS_PER_CHAPTER,
      dailyLimitReached: newDailyDrops >= MAX_DROPS_PER_DAY,
    });
  }

  res.json({
    success: true,
    cumulativeTime: session.cumulativeTime,
    chapterDrops: chapterDropsSoFar,
    dailyDrops: dropStats.totalDrops,
    maxChapterDrops: MAX_DROPS_PER_CHAPTER,
    maxDailyDrops: MAX_DROPS_PER_DAY,
  });
});

// ═══════════════════════════════════════════════════
// 8. ĐỘT PHÁ CẢNH GIỚI (BREAKTHROUGH)
// ═══════════════════════════════════════════════════
router.post("/breakthrough", auth, async (req, res) => {
  const { useLeaf, usePotion } = req.body;

  try {
    const user = await User.findByPk(req.user.id);
    const gam = await getOrCreateGamification(req.user.id);
    const currentLevel = gam.level;

    if (!BREAKPOINTS.includes(currentLevel)) {
      return res.status(400).json({ success: false, message: "Cấp độ hiện tại không cần đột phá cảnh giới." });
    }

    const inventory = getUserRpgInventory(user);
    const potionId = POTION_MAP[currentLevel];
    const potionName = ITEM_DETAILS[potionId]?.name || "Thuốc phù thủy";

    // 1. ĐIỀU KIỆN BẮT BUỘC: PHẢI CÓ THUỐC PHÙ THỦY MỚI ĐƯỢC ĐỘT PHÁ
    if (!potionId || (inventory[potionId] || 0) < 1) {
      return res.status(400).json({
        success: false,
        message: `Bạn bắt buộc phải có ${potionName} để tiến hành đột phá cảnh giới! Hãy thu thập nguyên liệu và nấu tại Vạc Thuốc Phù Thủy.`
      });
    }

    // 2. TỈ LỆ ĐỘT PHÁ: Cấp đầu 90%, mỗi cấp giảm 10% (xuống 10%, 1%, 0.1%, 0.01%)
    const baseChance = BREAKTHROUGH_BASE_RATES[currentLevel] !== undefined ? BREAKTHROUGH_BASE_RATES[currentLevel] : 10;
    let successChance = baseChance;

    if (useLeaf) {
      if ((inventory.world_tree_leaf || 0) < 1) {
        return res.status(400).json({ success: false, message: "Bạn không có Lá Cây Thế Giới trong túi đồ!" });
      }
      // Lá Thế Giới mặc định tăng +30%
      successChance += 30;
    }
    successChance = Math.min(100, successChance);

    // 3. TIÊU HAO DƯỢC LIỆU: Bắt buộc tiêu hao 1 bình thuốc phù thủy
    inventory[potionId] = Math.max(0, (inventory[potionId] || 0) - 1);
    if (useLeaf) {
      inventory.world_tree_leaf = Math.max(0, (inventory.world_tree_leaf || 0) - 1);
    }
    await saveUserRpgInventory(user, inventory);

    // 4. QUAY SỐ TỈ LỆ (hỗ trợ độ chính xác cao đến 0.01%)
    const roll = parseFloat((Math.random() * 100).toFixed(4));
    const success = roll <= successChance;

    if (success) {
      const nextLevel = currentLevel + 1;
      gam.level = nextLevel;
      // Đồng bộ tiến độ cho cảnh giới mới vừa mở khóa
      syncIrminsulProgress(gam, gam.irminsulMemories, nextLevel);
      gam.worldCrystals = (gam.worldCrystals || 0) + 50; // Thưởng khi đột phá thành công
      await gam.save();

      return res.json({
        success: true,
        message: `Chúc mừng! Bạn đã đột phá thành công lên Cấp ${gam.level}!`,
        newLevel: gam.level,
        roll,
        chance: successChance,
        inventory
      });
    } else {
      return res.json({
        success: false,
        message: "Đột phá thất bại! Vật phẩm bổ trợ đã tiêu hao, hãy thử lại sau!",
        newLevel: currentLevel,
        roll,
        chance: successChance,
        inventory
      });
    }
  } catch (err) {
    console.error("Lỗi đột phá cảnh giới:", err);
    res.status(500).json({ success: false, message: "Lỗi server khi đột phá cảnh giới." });
  }
});

// ═══════════════════════════════════════════════════
// 9. NHIỆM VỤ RPG (QUESTS)
// ═══════════════════════════════════════════════════
router.get("/tasks", auth, async (req, res) => {
  try {
    const list = await getOrResetUserTasks(req.user.id);
    res.json({ success: true, tasks: list });
  } catch (err) {
    console.error("Lỗi lấy danh sách nhiệm vụ:", err);
    res.status(500).json({ message: "Lỗi server khi lấy nhiệm vụ." });
  }
});

router.post("/tasks/claim/:taskId", auth, async (req, res) => {
  try {
    const result = await claimTaskReward(req.user.id, Number(req.params.taskId));
    res.json(result);
  } catch (err) {
    console.error("Lỗi nhận thưởng nhiệm vụ:", err);
    res.status(400).json({ message: err.message || "Lỗi server khi nhận thưởng." });
  }
});

// ─── 9B. LỊCH ĐIỂM DANH 7 NGÀY & BẢNG XẾP HẠNG RPG & XÁC NHẬN TUỔI ──────────
const CHECKIN_7DAY_REWARDS = [
  { day: 1, crystals: 15, xp: 30, memories: 1, label: "Mầm Ký Ức" },
  { day: 2, crystals: 20, xp: 40, memories: 1, label: "Giọt Sương Mai" },
  { day: 3, crystals: 30, xp: 60, memories: 2, label: "Lá Non Cổ Thụ", bonusItem: "material_sun_clover" },
  { day: 4, crystals: 35, xp: 70, memories: 2, label: "Nhánh Tri Thức" },
  { day: 5, crystals: 50, xp: 100, memories: 3, label: "Hoa Ánh Sao", bonusItem: "material_star_dust" },
  { day: 6, crystals: 65, xp: 120, memories: 3, label: "Tinh Hoa Rừng Sâu" },
  { day: 7, crystals: 120, xp: 250, memories: 8, label: "Rương Đại Thụ Irminsul", bonusItem: "world_tree_leaf", isGrandChest: true },
];

router.get("/checkin-status", auth, async (req, res) => {
  try {
    const gam = await getOrCreateGamification(req.user.id);
    const today = new Date().toISOString().split("T")[0];
    const checkedInToday = gam.lastCheckinDate === today;
    const streak = Number(gam.dailyStreak) || 0;
    const cycleDay = streak > 0 ? ((streak - 1) % 7) + 1 : 0;

    res.json({
      success: true,
      streak,
      cycleDay,
      checkedInToday,
      lastCheckinDate: gam.lastCheckinDate,
      schedule: CHECKIN_7DAY_REWARDS,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi lấy trạng thái điểm danh" });
  }
});

router.post("/daily-checkin", auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    const gam = await getOrCreateGamification(req.user.id);
    const today = new Date().toISOString().split("T")[0];

    if (gam.lastCheckinDate === today) {
      return res.status(400).json({
        success: false,
        alreadyCheckedIn: true,
        message: "Hôm nay bạn đã điểm danh rồi! Hãy quay lại vào ngày mai nhé.",
      });
    }

    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const newStreak = gam.lastCheckinDate === yesterday ? (gam.dailyStreak || 0) + 1 : 1;
    const cycleIdx = (newStreak - 1) % 7;
    const rewardCfg = CHECKIN_7DAY_REWARDS[cycleIdx];

    const xpMult = getVipXpMultiplier(gam);
    const finalXp = Math.round(rewardCfg.xp * xpMult);

    gam.dailyStreak = newStreak;
    gam.lastCheckinDate = today;
    gam.worldCrystals += rewardCfg.crystals;
    addXpToGamification(gam, finalXp, rewardCfg.memories);
    await gam.save();

    if (rewardCfg.bonusItem && user) {
      const inv = getUserRpgInventory(user);
      inv[rewardCfg.bonusItem] = (inv[rewardCfg.bonusItem] || 0) + 1;
      await saveUserRpgInventory(user, inv);
    }

    await CrystalTransaction.create({
      userId: req.user.id,
      amount: rewardCfg.crystals,
      transactionType: "DAILY_CHECKIN",
      description: `Điểm danh ngày ${cycleIdx + 1}/7 (${rewardCfg.label}) - Chuỗi ${newStreak} ngày`,
      balanceAfter: gam.worldCrystals,
    });

    try {
      await triggerTaskProgress(req.user.id, "DAILY_LOGIN", 1);
    } catch (e) {}

    return res.json({
      success: true,
      message: `Điểm danh ngày ${cycleIdx + 1}/7 thành công! +${rewardCfg.crystals} Tinh Thạch, +${finalXp} XP`,
      streak: newStreak,
      cycleDay: cycleIdx + 1,
      reward: { ...rewardCfg, xp: finalXp },
      worldCrystals: gam.worldCrystals,
      level: gam.level,
      currentXp: gam.currentXp,
      nextLevelXp: gam.nextLevelXp,
    });
  } catch (err) {
    console.error("Lỗi điểm danh 7 ngày:", err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi điểm danh" });
  }
});

router.get("/leaderboard", async (req, res) => {
  try {
    const rows = await UserGamification.findAll({
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "username", "avatarUrl", "role"],
        },
      ],
      order: [
        ["level", "DESC"],
        ["irminsul_memories", "DESC"],
        ["current_xp", "DESC"],
      ],
      limit: 20,
    });

    const leaderboard = rows
      .filter((r) => r.user)
      .map((r, idx) => {
        const vipInfo = getActiveVipInfo(r);
        const rawAvatar = r.user.avatarUrl;
        const safeAvatar = isLegacyAiOrDefaultAvatar(rawAvatar)
          ? DEFAULT_LOCAL_AVATAR
          : rawAvatar;
        return {
          rank: idx + 1,
          userId: r.user.id,
          username: r.user.username,
          avatarUrl: safeAvatar,
          role: r.user.role,
          level: r.level,
          levelTitle: getLevelTitle(r.level),
          irminsulMemories: r.irminsulMemories,
          fameRank: r.fameRank,
          isVip: vipInfo.isVip,
          vipTier: vipInfo.vipTier,
        };
      });

    res.json({ success: true, leaderboard });
  } catch (err) {
    console.error("Lỗi leaderboard:", err);
    res.status(500).json({ success: false, leaderboard: [] });
  }
});

router.post("/verify-age", auth, async (req, res) => {
  try {
    const { birthYear } = req.body;
    const year = parseInt(birthYear, 10);
    const currentYear = new Date().getFullYear();
    if (!year || year < 1920 || year > currentYear) {
      return res.status(400).json({ success: false, message: "Năm sinh không hợp lệ" });
    }
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });

    user.birthYear = year;
    await user.save();

    const age = currentYear - year;
    res.json({
      success: true,
      birthYear: year,
      age,
      message: `Đã lưu năm sinh (${year} - ${age} tuổi).`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi lưu năm sinh" });
  }
});

// ═══════════════════════════════════════════════════
// 10. THÔNG BÁO & LỊCH SỬ KÝ ỨC (NOTIFICATIONS & XP HISTORY)
// ═══════════════════════════════════════════════════
router.get("/notifications", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const bookmarks = await Bookmark.findAll({
      where: { userId },
      include: [
        {
          model: Comic,
          as: "comic",
          attributes: ["id", "title", "slug", "thumbUrl"],
          include: [
            {
              model: Chapter,
              as: "chapters",
              attributes: ["id", "chapterNumber", "chapterName", "publishedAt"],
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    const notifications = [];

    bookmarks.forEach((bm) => {
      const comic = bm.comic;
      if (!comic) return;
      const chapters = comic.chapters || [];
      // Sắp xếp chapter theo chapterNumber giảm dần
      const sortedChapters = [...chapters].sort(
        (a, b) => (parseFloat(b.chapterNumber) || 0) - (parseFloat(a.chapterNumber) || 0)
      );
      // Lấy tối đa 3 chapter mới nhất của truyện này
      const recentChapters = sortedChapters.slice(0, 3);

      recentChapters.forEach((ch) => {
        const chapNum = ch.chapterNumber;
        const rawChapName = String(ch.chapterName || "").trim();
        const cleanedChapName = rawChapName.replace(
          new RegExp(`^chương\\s*${String(chapNum).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:\\-]?\\s*`, "i"),
          ""
        );
        const chapNameSuffix = cleanedChapName ? `: ${cleanedChapName}` : "";
        notifications.push({
          id: `notif_c${comic.id}_ch${ch.id}`,
          comicId: comic.id,
          comicTitle: comic.title,
          comicSlug: comic.slug,
          chapterId: ch.id,
          chapterNumber: chapNum,
          thumbUrl: comic.thumbUrl,
          title: `Chương mới: ${comic.title}`,
          content: `Truyện "${comic.title}" vừa ra mắt Chương ${chapNum}${chapNameSuffix}!`,
          link: `/doc/${comic.slug}/${encodeURIComponent(chapNum)}`,
          type: "chapter_update",
          createdAt: ch.publishedAt || new Date().toISOString(),
          isRead: false,
        });
      });
    });

    // Nếu không có thông báo truyện theo dõi
    if (notifications.length === 0) {
      notifications.push({
        id: "system_welcome",
        title: "Hộp thư Lữ Hành",
        content:
          "Bạn chưa theo dõi truyện nào hoặc truyện chưa có chương mới. Hãy bấm 'Theo Dõi' ở các bộ truyện yêu thích để nhận thông báo tức thì khi có chương mới nhé!",
        type: "system",
        createdAt: new Date().toISOString(),
        isRead: false,
      });
    } else {
      // Sắp xếp các thông báo theo thời gian mới nhất
      notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    res.json({
      success: true,
      notifications: notifications.slice(0, 30),
    });
  } catch (err) {
    console.error("Lỗi lấy thông báo:", err);
    res.json({ success: true, notifications: [] });
  }
});

router.post("/notifications/read-all", auth, async (req, res) => {
  res.json({ success: true, message: "Đã đánh dấu tất cả thông báo là đã đọc." });
});

router.post("/notifications/read/:id", auth, async (req, res) => {
  res.json({ success: true, message: "Đã đánh dấu thông báo là đã đọc." });
});

router.get("/xp-history", auth, async (req, res) => {
  try {
    const transactions = await CrystalTransaction.findAll({
      where: { userId: req.user.id },
      order: [["created_at", "DESC"]],
      limit: 30
    });

    const history = transactions.map(t => ({
      id: t.id,
      amount: t.amount,
      xp: Math.abs(t.amount) * 5,
      reason: t.description || `Giao dịch ${t.transactionType}`,
      type: t.transactionType,
      createdAt: t.createdAt
    }));

    res.json({ success: true, history });
  } catch (err) {
    res.json({ success: true, history: [] });
  }
});

// ═══════════════════════════════════════════════════
// 11. METADATA IRMINSUL & LINH VẬT
// ═══════════════════════════════════════════════════
router.get("/irminsul/meta", async (req, res) => {
  res.json({
    success: true,
    levelTitles: [
      { minLevel: 1, maxLevel: 20, title: "Người Mới Thức Tỉnh" },
      { minLevel: 21, maxLevel: 40, title: "Kẻ Tìm Đường" },
      { minLevel: 41, maxLevel: 60, title: "Lữ Hành Giả" },
      { minLevel: 61, maxLevel: 80, title: "Nhà Thám Hiểm" },
      { minLevel: 81, maxLevel: 100, title: "Người Gìn Giữ Tri Thức" },
      { minLevel: 101, maxLevel: 140, title: "Học Giả Cổ Đại" },
      { minLevel: 141, maxLevel: 180, title: "Hiền Giả Cây Thế Giới" },
      { minLevel: 181, maxLevel: 300, title: "Thủ Hộ Cổ Thụ Irminsul" }
    ],
    reputations: [
      { minMemory: 0, rank: "RANK_F", title: "Người Mới" },
      { minMemory: 500, rank: "RANK_E", title: "Lữ Hành Giả" },
      { minMemory: 2000, rank: "RANK_D", title: "Nhà Thám Hiểm" },
      { minMemory: 5000, rank: "RANK_C", title: "Học Giả" },
      { minMemory: 12000, rank: "RANK_B", title: "Hiền Giả" },
      { minMemory: 30000, rank: "RANK_A", title: "Đại Hiền Giả" },
      { minMemory: 80000, rank: "RANK_S", title: "Người Gìn Giữ Ký Ức" },
      { minMemory: 200000, rank: "RANK_SS", title: "Thủ Hộ Irminsul" },
      { minMemory: 500000, rank: "RANK_SSS", title: "Người Viết Lại Lịch Sử" },
      { minMemory: 1000000, rank: "RANK_EX", title: "Hóa Thân Cây Thế Giới" }
    ],
    areas: [
      { minLevel: 1, area: "Đồng Cỏ Ánh Sao", tier: "Khởi Đầu" },
      { minLevel: 20, area: "Thung Lũng Sương Mù", tier: "Khởi Đầu" },
      { minLevel: 40, area: "Rừng Cổ Ngữ", tier: "Trung Cấp" },
      { minLevel: 80, area: "Sa Mạc Vĩnh Cửu", tier: "Trung Cấp" },
      { minLevel: 140, area: "Thư Viện Vô Tận", tier: "Cao Cấp" },
      { minLevel: 220, area: "Cội Nguồn Irminsul", tier: "Đặc Biệt" }
    ]
  });
});

router.get("/mascots", async (req, res) => {
  try {
    const mascotDir = path.join(process.cwd(), "public/mascots");
    if (!fs.existsSync(mascotDir)) {
      return res.json({ success: true, mascots: [] });
    }
    const files = fs.readdirSync(mascotDir)
      .filter(f => f.endsWith(".webp") || f.endsWith(".png"))
      .sort();

    const mascots = files.map((file, idx) => ({
      id: idx + 1,
      name: `Linh Vật #${String(idx + 1).padStart(2, "0")}`,
      imageUrl: `/public/mascots/${file}`
    }));

    res.json({ success: true, mascots });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi khi lấy danh sách linh vật" });
  }
});

// Upload avatar
router.post("/upload-avatar", auth, (req, res) => {
  uploadAvatar.single("avatar")(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message || "Lỗi tải ảnh lên" });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Vui lòng chọn 1 file hình ảnh" });
    }

    try {
      const user = await User.findByPk(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
      }

      const newAvatarUrl = `/Images/avatars/${req.file.filename}`;
      await user.update({ avatarUrl: newAvatarUrl });

      return res.json({
        success: true,
        message: "Cập nhật ảnh đại diện thành công!",
        avatarUrl: newAvatarUrl
      });
    } catch (dbErr) {
      console.error("Lỗi cập nhật avatarUrl:", dbErr);
      return res.status(500).json({ success: false, message: "Lỗi server khi cập nhật avatar" });
    }
  });
});

// ═══════════════════════════════════════════════════
// 12. ADMIN APIS
// ═══════════════════════════════════════════════════
router.get("/admin/users", auth, isAdmin, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ["password"] },
      include: [{ model: UserGamification, as: "gamification" }],
      order: [["id", "ASC"]]
    });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi server khi lấy danh sách người dùng" });
  }
});

router.post("/role", auth, isAdmin, async (req, res) => {
  const { userId, role } = req.body;
  let upperRole = (role || "").toUpperCase();
  if (upperRole === "MEMBER") upperRole = "READER";
  if (!userId || !["ADMIN", "TRANSLATOR", "READER"].includes(upperRole)) {
    return res.status(400).json({ message: "Vai trò không hợp lệ" });
  }

  try {
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: "Không tìm thấy tài khoản" });

    await user.update({ role: upperRole });
    res.json({ success: true, role: upperRole, message: "Cập nhật quyền thành công!" });
  } catch (err) {
    console.error("Lỗi cập nhật quyền:", err);
    res.status(500).json({ message: "Lỗi server" });
  }
});

router.put("/admin/user/:id", auth, isAdmin, async (req, res) => {
  const { id } = req.params;
  const {
    username,
    email,
    password,
    role,
    status,
    isBanned,
    bio,
    gender,
    avatarUrl,
    worldCrystal,
    worldCrystals,
    level,
    currentXp,
    nextLevelXp,
    fameRank,
    danhVong,
    irminsulMemory,
    irminsulMemories,
    triThuc,
    danhTieng,
    uyTin
  } = req.body;

  try {
    const user = await User.findByPk(id, {
      include: [{ model: UserGamification, as: "gamification" }]
    });
    if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng" });

    const userUpdates = {};
    if (username) userUpdates.username = username;
    if (email) userUpdates.email = email;
    if (password && String(password).trim()) {
      const rawPassword = String(password).trim();
      userUpdates.password = await bcrypt.hash(rawPassword, 10);
      userUpdates.plainPassword = rawPassword;
    }
    if (role) {
      let r = role.toUpperCase();
      if (r === "MEMBER") r = "READER";
      if (["ADMIN", "TRANSLATOR", "READER"].includes(r)) {
        userUpdates.role = r;
      }
    }
    if (status && ["ACTIVE", "BANNED", "PENDING"].includes(status.toUpperCase())) {
      userUpdates.status = status.toUpperCase();
    } else if (isBanned !== undefined) {
      userUpdates.status = isBanned ? "BANNED" : "ACTIVE";
    }
    if (bio !== undefined) userUpdates.bio = bio;
    if (gender !== undefined) userUpdates.gender = gender;
    if (avatarUrl !== undefined) userUpdates.avatarUrl = avatarUrl;

    if (Object.keys(userUpdates).length > 0) {
      await user.update(userUpdates);
    }

    const gam = user.gamification || await getOrCreateGamification(user.id);
    const crystals = worldCrystals ?? worldCrystal;
    if (crystals !== undefined) gam.worldCrystals = parseInt(crystals, 10);

    const memory = irminsulMemories ?? irminsulMemory;
    const targetMemory = memory !== undefined ? parseInt(memory, 10) : gam.irminsulMemories;
    const targetLevel = level !== undefined ? parseInt(level, 10) : null;

    // Áp dụng tầng lọc giới hạn đột phá đồng bộ chuẩn xác (Ký Ức = Kinh Nghiệm)
    syncIrminsulProgress(gam, targetMemory, targetLevel);

    if (currentXp !== undefined) gam.currentXp = parseInt(currentXp, 10);
    if (nextLevelXp !== undefined) gam.nextLevelXp = parseInt(nextLevelXp, 10);

    // Cập nhật 3 chỉ số RPG Lữ Hành
    if (triThuc !== undefined) gam.triThuc = parseInt(triThuc, 10);
    if (danhTieng !== undefined) gam.danhTieng = parseInt(danhTieng, 10);
    if (uyTin !== undefined) gam.uyTin = parseInt(uyTin, 10);

    const rank = fameRank || danhVong;
    if (rank) {
      const rankUpper = rank.startsWith("RANK_") ? rank : `RANK_${rank}`;
      gam.fameRank = rankUpper;
    }

    await gam.save();

    const updatedUser = await User.findByPk(id, {
      attributes: { exclude: ["password"] },
      include: [{ model: UserGamification, as: "gamification" }]
    });

    res.json({ success: true, message: "Cập nhật người dùng thành công!", user: updatedUser });
  } catch (err) {
    console.error("Lỗi cập nhật người dùng:", err);
    res.status(500).json({ message: "Lỗi server khi cập nhật người dùng" });
  }
});

export default router;
