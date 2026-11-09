import express from "express";
import { Comment } from "../models/Comment.js";
import { CommentLike } from "../models/CommentLike.js";
import { User } from "../models/User.js";
import { Comic } from "../models/Comic.js";
import { Chapter } from "../models/Chapter.js";
import { UserGamification } from "../models/UserGamification.js";
import { sequelize } from "../config/database.js";
import { addXpToGamification, getLevelTitle } from "../utils/irminsulSystem.js";
import { triggerTaskProgress } from "../utils/taskSystem.js";
import { getActiveVipInfo } from "../utils/accessControl.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// Middleware kiểm tra quyền admin
function isAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "Chưa đăng nhập" });
  const role = (req.user.role || "").toUpperCase();
  if (role !== "ADMIN") return res.status(403).json({ message: "Không có quyền admin" });
  next();
}

// Middleware optional auth
function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (token) {
    try {
      return auth(req, res, () => next());
    } catch {
      req.user = null;
      return next();
    }
  }
  req.user = null;
  next();
}

const TITLE_MAP = {
  6: { id: 6, name: "Học Giả Tri Thức", key: "title_scholar", icon: "📚", badgeBg: "from-amber-400 via-yellow-500 to-orange-500 text-amber-950 border-yellow-200", titleClass: "shiny-gold-title" },
  7: { id: 7, name: "Chúa Tể Cây Thế Giới", key: "title_irminsul_lord", icon: "🌳", badgeBg: "from-emerald-700 via-teal-600 to-amber-500 text-white border-amber-300", titleClass: "shiny-mythic-title" },
  11: { id: 11, name: "Thủ Hộ Thần Mộc", key: "title_guardian", icon: "🌿", badgeBg: "from-emerald-600 via-teal-500 to-green-600 text-white border-emerald-200", titleClass: "shiny-gold-title" },
  12: { id: 12, name: "Hiền Giả Tinh Hà", key: "title_sage", icon: "🌌", badgeBg: "from-sky-500 via-cyan-400 to-indigo-600 text-white border-cyan-100", titleClass: "shiny-diamond-title" },
  13: { id: 13, name: "Rồng Quấn Thần Thoại", key: "title_dragon", icon: "🐉", badgeBg: "from-amber-500 via-rose-500 to-purple-600 text-white border-amber-200", titleClass: "shiny-mythic-title" }
};

const FRAME_MAP = {
  1: { id: 1, key: "frame_wood", name: "Khung Linh Mộc Sơ Khởi" },
  2: { id: 2, key: "frame_silver", name: "Khung Bạc Tinh Quang" },
  3: { id: 3, key: "frame_gold", name: "Khung Hoàng Kim Linh Mộc" },
  9: { id: 9, key: "frame_diamond", name: "Khung Kim Cương Tinh Hà" },
  10: { id: 10, key: "frame_dragon", name: "Khung Rồng Quấn Thần Thoại" },
  frame_wood: { id: 1, key: "frame_wood", name: "Khung Linh Mộc Sơ Khởi" },
  frame_silver: { id: 2, key: "frame_silver", name: "Khung Bạc Tinh Quang" },
  frame_gold: { id: 3, key: "frame_gold", name: "Khung Hoàng Kim Linh Mộc" },
  frame_diamond: { id: 9, key: "frame_diamond", name: "Khung Kim Cương Tinh Hà" },
  frame_dragon: { id: 10, key: "frame_dragon", name: "Khung Rồng Quấn Thần Thoại" },
};

/**
 * Helper format bình luận trả về cho Frontend
 */
function formatComment(c) {
  const plain = c.toJSON ? c.toJSON() : c;
  const user = plain.user || {};
  const gamification = user.gamification || {};
  const comic = plain.comic || {};
  const chapter = plain.chapter || {};

  const titleId = gamification.equippedTitleId || gamification.equipped_title_id;
  const equippedTitle = titleId && TITLE_MAP[titleId] ? TITLE_MAP[titleId] : null;

  const frameId = gamification.equippedAvatarFrameId || gamification.equipped_avatar_frame_id;
  const equippedFrame = frameId && FRAME_MAP[frameId] ? FRAME_MAP[frameId] : null;

  const vipInfo = getActiveVipInfo(gamification);

  return {
    id: plain.id,
    content: plain.content,
    likesCount: plain.likesCount || 0,
    likeCount: plain.likesCount || 0,
    isSpoiler: Boolean(plain.isSpoiler),
    isHidden: Boolean(plain.isHidden),
    status: plain.isHidden ? "hidden" : "active",
    isReported: Boolean(plain.isReported),
    reportReason: plain.reportReason || "",
    reportCount: plain.reportCount || 0,
    aiToxicityScore: plain.aiToxicityScore || 0,
    comicSlug: comic.slug || "",
    comicName: comic.title || comic.name || "",
    chapterName: chapter.chapterName || (chapter.chapterNumber ? `Chương ${chapter.chapterNumber}` : ""),
    createdAt: plain.createdAt || plain.created_at,
    updatedAt: plain.updatedAt || plain.updated_at,
    User: {
      id: user.id,
      username: user.username,
      role: user.role,
      avatarUrl: user.avatarUrl || "/default-avatar.png",
      level: gamification.level || 1,
      levelTitle: getLevelTitle(gamification.level || 1),
      fameRank: gamification.fameRank || "RANK_F",
      worldCrystals: gamification.worldCrystals || 0,
      equippedTitle,
      equippedFrame,
      isVip: Boolean(vipInfo.isVip),
      vipTier: Number(vipInfo.vipTier) || 0,
      vipPlanName: vipInfo.plan?.name || null,
    },
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      avatarUrl: user.avatarUrl || "/default-avatar.png",
      level: gamification.level || 1,
      levelTitle: getLevelTitle(gamification.level || 1),
      fameRank: gamification.fameRank || "RANK_F",
      equippedTitle,
      equippedFrame,
      isVip: Boolean(vipInfo.isVip),
      vipTier: Number(vipInfo.vipTier) || 0,
      vipPlanName: vipInfo.plan?.name || null,
    }
  };
}

/**
 * 1. GET /api/comment — Lấy danh sách bình luận (theo comicSlug hoặc toàn trang)
 */
router.get("/", optionalAuth, async (req, res) => {
  try {
    const { comicSlug, limit = 50 } = req.query;
    const where = {};

    // Nếu người dùng không phải admin thì ẩn các bình luận bị cấm
    const role = (req.user?.role || "").toUpperCase();
    if (role !== "ADMIN") {
      where.isHidden = false;
    }

    // Nếu truyền comicSlug, tìm comic_id
    if (comicSlug) {
      const comic = await Comic.findOne({ where: { slug: comicSlug } });
      if (!comic) {
        return res.json({ success: true, comments: [] });
      }
      where.comicId = comic.id;
    }

    const comments = await Comment.findAll({
      where,
      limit: Math.min(100, parseInt(limit) || 50),
      order: [["created_at", "DESC"]],
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "username", "avatarUrl", "role"],
          include: [
            {
              model: UserGamification,
              as: "gamification",
              attributes: ["level", "fameRank", "currentXp", "worldCrystals", "equippedTitleId", "equippedAvatarFrameId", "vipTier", "vipExpiresAt"],
            },
          ],
        },
        {
          model: Comic,
          as: "comic",
          attributes: ["id", "title", "slug"],
        },
        {
          model: Chapter,
          as: "chapter",
          attributes: ["id", "chapterNumber", "chapterName"],
        },
      ],
    });

    const formatted = comments.map(formatComment);
    res.json({ success: true, comments: formatted });
  } catch (err) {
    console.error("Lỗi lấy danh sách bình luận:", err);
    res.status(500).json({ success: false, message: "Lỗi server khi tải bình luận: " + err.message });
  }
});

/**
 * 2. POST /api/comment — Viết bình luận mới
 */
router.post("/", auth, async (req, res) => {
  try {
    const { comicSlug, content, chapterId, parentCommentId, isSpoiler } = req.body;

    if (!comicSlug || !content || !content.trim()) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ nội dung bình luận!" });
    }

    const comic = await Comic.findOne({ where: { slug: comicSlug } });
    if (!comic) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bộ truyện này" });
    }

    const newComment = await Comment.create({
      userId: req.user.id,
      comicId: comic.id,
      chapterId: chapterId || null,
      parentCommentId: parentCommentId || null,
      content: content.trim(),
      likesCount: 0,
      isSpoiler: Boolean(isSpoiler),
      isHidden: false,
      aiToxicityScore: 0.00,
    });

    // Thưởng kinh nghiệm RPG Cây Thế Giới khi bình luận
    try {
      const [gamification] = await UserGamification.findOrCreate({
        where: { userId: req.user.id },
        defaults: {
          level: 1,
          currentXp: 0,
          nextLevelXp: 100,
          irminsulMemories: 0,
          worldCrystals: 0,
        },
      });

      addXpToGamification(gamification, 15, 5);
      gamification.danhTieng = (gamification.danhTieng || 0) + 3;
      await gamification.save();

      // Kích hoạt tiến độ nhiệm vụ viết bình luận
      await triggerTaskProgress(req.user.id, "POST_COMMENT", 1);
    } catch (rpgErr) {
      console.warn("Lỗi cập nhật gamification khi bình luận:", rpgErr.message);
    }

    // Lấy lại đầy đủ thông tin kèm User và Gamification
    const fullComment = await Comment.findByPk(newComment.id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "username", "avatarUrl", "role"],
          include: [
            {
              model: UserGamification,
              as: "gamification",
              attributes: ["level", "fameRank", "currentXp", "worldCrystals", "equippedTitleId", "equippedAvatarFrameId", "vipTier", "vipExpiresAt"],
            },
          ],
        },
        {
          model: Comic,
          as: "comic",
          attributes: ["id", "title", "slug"],
        },
      ],
    });

    res.json({
      success: true,
      comment: formatComment(fullComment),
      message: "Bình luận thành công! +15 Điểm Ký Ức Irminsul 🌱",
    });
  } catch (err) {
    console.error("Lỗi viết bình luận:", err);
    res.status(500).json({ success: false, message: "Lỗi server khi đăng bình luận: " + err.message });
  }
});

/**
 * 3. POST /api/comment/like/:id — Thích / Bỏ thích bình luận
 */
router.post("/like/:id", auth, async (req, res) => {
  try {
    const commentId = parseInt(req.params.id);
    const comment = await Comment.findByPk(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bình luận" });
    }

    const existing = await CommentLike.findOne({
      where: { userId: req.user.id, commentId },
    });

    let liked = false;
    let currentLikes = comment.likesCount || 0;

    if (existing) {
      await existing.destroy();
      currentLikes = Math.max(0, currentLikes - 1);
      liked = false;
    } else {
      await CommentLike.create({
        userId: req.user.id,
        commentId,
      });
      currentLikes += 1;
      liked = true;

      // Cộng Uy Tín (+2) cho tác giả của bình luận nếu không phải tự like chính mình
      if (comment.userId && comment.userId !== req.user.id) {
        try {
          const authorGam = await UserGamification.findOne({ where: { userId: comment.userId } });
          if (authorGam) {
            authorGam.uyTin = (authorGam.uyTin || 0) + 2;
            await authorGam.save();
          }
          await triggerTaskProgress(comment.userId, "RECEIVE_LIKE", 1);
        } catch (authorErr) {
          console.warn("Lỗi cập nhật Uy Tín khi nhận like:", authorErr.message);
        }
      }
    }

    await comment.update({ likesCount: currentLikes });

    res.json({
      success: true,
      liked,
      likeCount: currentLikes,
      likesCount: currentLikes,
    });
  } catch (err) {
    console.error("Lỗi like bình luận:", err);
    res.status(500).json({ success: false, message: "Lỗi server: " + err.message });
  }
});

/**
 * 4. GET /api/comment/user — Lấy tất cả bình luận của người dùng hiện tại
 */
router.get("/user", auth, async (req, res) => {
  try {
    const comments = await Comment.findAll({
      where: { userId: req.user.id },
      order: [["created_at", "DESC"]],
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "username", "avatarUrl", "role"],
          include: [
            {
              model: UserGamification,
              as: "gamification",
              attributes: ["level", "fameRank", "currentXp"],
            },
          ],
        },
        {
          model: Comic,
          as: "comic",
          attributes: ["id", "title", "slug"],
        },
      ],
    });

    res.json({ success: true, comments: comments.map(formatComment) });
  } catch (err) {
    console.error("Lỗi lấy bình luận user:", err);
    res.status(500).json({ success: false, message: "Lỗi server: " + err.message });
  }
});

/**
 * 5. DELETE /api/comment/:id — Xóa bình luận (Admin hoặc chính chủ)
 */
router.delete("/:id", auth, async (req, res) => {
  try {
    const commentId = parseInt(req.params.id);
    const comment = await Comment.findByPk(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bình luận" });
    }

    const role = (req.user.role || "").toUpperCase();
    if (role !== "ADMIN" && comment.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: "Bạn không có quyền xóa bình luận này" });
    }

    await comment.destroy();
    res.json({ success: true, message: "Đã xóa bình luận thành công!" });
  } catch (err) {
    console.error("Lỗi xóa bình luận:", err);
    res.status(500).json({ success: false, message: "Lỗi server: " + err.message });
  }
});

/**
 * 6. POST /api/comment/moderate/:id — Ẩn / Hiện bình luận & Xử lý báo cáo (Admin)
 */
router.post("/moderate/:id", auth, isAdmin, async (req, res) => {
  try {
    const commentId = parseInt(req.params.id);
    const comment = await Comment.findByPk(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bình luận" });
    }

    const { isHidden, status } = req.body;
    let nextHidden = false;
    let nextReported = comment.isReported;

    if (status) {
      if (status === "hidden") {
        nextHidden = true;
      } else if (status === "active") {
        nextHidden = false;
        nextReported = false; // Khi admin duyệt "Không vấn đề" hoặc active, gỡ cờ báo cáo!
      }
    } else if (isHidden !== undefined) {
      nextHidden = Boolean(isHidden);
    }

    await comment.update({
      isHidden: nextHidden,
      isReported: nextReported,
      reportReason: nextReported ? comment.reportReason : null,
    });

    res.json({
      success: true,
      message: nextHidden ? "Đã ẩn bình luận." : "Đã cập nhật trạng thái bình luận thành công.",
      comment: formatComment(comment),
    });
  } catch (err) {
    console.error("Lỗi kiểm duyệt bình luận:", err);
    res.status(500).json({ success: false, message: "Lỗi server: " + err.message });
  }
});

/**
 * 7. POST /api/comment/report/:id — Báo cáo bình luận vi phạm
 */
router.post("/report/:id", auth, async (req, res) => {
  try {
    const commentId = parseInt(req.params.id);
    const comment = await Comment.findByPk(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bình luận cần báo cáo" });
    }

    const { reasons, otherReason } = req.body;
    const reasonList = Array.isArray(reasons) ? [...reasons] : [];
    if (otherReason && typeof otherReason === "string" && otherReason.trim()) {
      reasonList.push(otherReason.trim());
    }

    const reportReasonText = reasonList.join(", ") || "Vi phạm quy chuẩn cộng đồng";
    const currentCount = (comment.reportCount || 0) + 1;

    await comment.update({
      isReported: true,
      reportReason: reportReasonText,
      reportCount: currentCount,
    });

    // Ghi vào bảng ai_comment_moderations để lưu log kiểm duyệt
    try {
      await sequelize.query(
        `INSERT INTO ai_comment_moderations (comment_id, toxicity_score, spam_score, flagged_reason, action_taken, created_at)
         VALUES (?, 0.00, 0.00, ?, 'FLAG_FOR_ADMIN', NOW())`,
        { replacements: [commentId, reportReasonText] }
      );
    } catch (modErr) {
      console.warn("Lỗi ghi log ai_comment_moderations:", modErr.message);
    }

    res.json({
      success: true,
      message: "Báo cáo bình luận thành công! BQT sẽ sớm xem xét xử lý. 🌱",
      comment: formatComment(comment),
    });
  } catch (err) {
    console.error("Lỗi khi gửi báo cáo bình luận:", err);
    res.status(500).json({ success: false, message: "Lỗi server khi gửi báo cáo: " + err.message });
  }
});

/**
 * 8. GET /api/comment/user-history/:userId — Lấy lịch sử bình luận của người dùng (Admin)
 */
router.get("/user-history/:userId", auth, isAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const comments = await Comment.findAll({
      where: { userId },
      order: [["created_at", "DESC"]],
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "username", "avatarUrl", "role"],
        },
        {
          model: Comic,
          as: "comic",
          attributes: ["id", "title", "slug"],
        },
      ],
    });
    res.json({ success: true, comments: comments.map(formatComment) });
  } catch (err) {
    console.error("Lỗi lấy user history:", err);
    res.status(500).json({ success: false, message: "Lỗi server: " + err.message });
  }
});

export default router;