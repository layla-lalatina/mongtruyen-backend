/**
 * 🌳 SYSTEM: IRMINSUL FANTASY RPG - COMIC RATINGS ROUTES
 */

import express from "express";
import { Rating, Comic, User, sequelize } from "../models/index.js";
import auth from "../middleware/auth.js";

const router = express.Router();

router.post("/", auth, async (req, res) => {
  const { comicSlug, rating, comment } = req.body;

  if (!comicSlug || !rating) {
    return res.status(400).json({ message: "Thiếu thông tin đánh giá." });
  }

  const starCount = Math.min(5, Math.max(1, parseInt(rating) || 5));

  try {
    const comic = await Comic.findOne({ where: { slug: comicSlug } });
    if (!comic) {
      return res.status(404).json({ message: "Không tìm thấy bộ truyện." });
    }

    const [record, created] = await Rating.findOrCreate({
      where: { userId: req.user.id, comicId: comic.id },
      defaults: { stars: starCount, reviewText: comment || null },
    });

    if (!created) {
      record.stars = starCount;
      record.reviewText = comment || null;
      await record.save();
    }

    // Tính lại rating trung bình cho Comic (bảo toàn updated_at không bị đẩy lên đầu trang)
    const allRatings = await Rating.findAll({ where: { comicId: comic.id } });
    const total = allRatings.reduce((sum, r) => sum + r.stars, 0);
    const avg = allRatings.length > 0 ? (total / allRatings.length).toFixed(2) : 5.0;
    await sequelize.query(
      "UPDATE comics SET rating_avg = :avg, total_ratings = :total, updated_at = updated_at WHERE id = :id",
      { replacements: { avg, total: allRatings.length, id: comic.id } }
    );

    return res.json({
      success: true,
      message: "Đánh giá truyện thành công!",
      rating: record,
      ratingAvg: avg,
    });
  } catch (err) {
    console.error("Lỗi khi tạo/cập nhật rating:", err);
    return res.status(500).json({ message: "Lỗi server." });
  }
});

router.get("/:comicSlug", async (req, res) => {
  const { comicSlug } = req.params;

  try {
    const comic = await Comic.findOne({ where: { slug: comicSlug } });
    if (!comic) return res.json({ ratings: [] });

    const ratings = await Rating.findAll({
      where: { comicId: comic.id },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "username", "avatarUrl", "role"],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    const formatted = ratings.map((r) => ({
      id: r.id,
      rating: r.stars,
      comment: r.reviewText,
      createdAt: r.createdAt,
      user: r.user,
      User: r.user,
    }));

    return res.json({ ratings: formatted });
  } catch (err) {
    console.error("Lỗi khi lấy danh sách rating:", err);
    return res.status(500).json({ message: "Lỗi server." });
  }
});

router.get("/top/list", async (req, res) => {
  try {
    const topComics = await Comic.findAll({
      attributes: [
        "slug",
        ["title", "name"],
        ["thumb_url", "thumb_url"],
        ["thumb_url", "thumbUrl"],
        ["rating_avg", "avgRating"],
        ["total_ratings", "ratingCount"],
        ["total_views", "views"],
      ],
      order: [
        ["rating_avg", "DESC"],
        ["total_ratings", "DESC"],
        ["total_views", "DESC"],
      ],
      limit: 5,
    });

    return res.json({ topComics });
  } catch (err) {
    console.error("Lỗi khi lấy top ranking:", err);
    return res.status(500).json({
      message: "Lỗi server.",
      error: err.message,
    });
  }
});

export default router;
