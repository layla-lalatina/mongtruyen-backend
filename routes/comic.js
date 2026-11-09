/**
 * 🌳 SYSTEM: IRMINSUL FANTASY RPG - COMIC ENGINE (SELF-HOSTED / TỰ ĐĂNG TRUYỆN)
 * ==============================================================================
 * Hoàn toàn loại bỏ mọi kết nối tới OTruyen API bên ngoài.
 * Vận hành 100% trên CSDL MySQL nội bộ theo chuẩn truyentranh.sql.
 * Lưu trữ hình ảnh cục bộ tại: /Images/...
 * ==============================================================================
 */

import express from "express";
import { Op } from "sequelize";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import auth from "../middleware/auth.js";
import isAdmin from "../middleware/isAdmin.js";
import isTranslator from "../middleware/isTranslator.js";
import optionalAuth from "../middleware/optionalAuth.js";
import {
  sequelize,
  Comic,
  Genre,
  ComicGenre,
  Chapter,
  ChapterPage,
  ReadingHistory,
  User,
  UserGamification,
  Quest,
  ChapterAiSummary,
  ComicAiProfile,
  ChapterUnlock,
  ComicNotice,
  CrystalTransaction,
  Bookmark,
} from "../models/index.js";
import { addReward, calcLevel, getDanhVong, getKhuVuc, logXpChange, addXpToGamification } from "../utils/irminsulSystem.js";
import {
  canReadChapter,
  resolveChapterLock,
  calcDiscountedUnlockPrice,
  getActiveVipInfo,
  getVipXpMultiplier,
} from "../utils/accessControl.js";
import { triggerTaskProgress } from "../utils/taskSystem.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const IMAGES_DIR = path.join(__dirname, "..", "..", "Images");
const COMICS_IMG_DIR = path.join(IMAGES_DIR, "truyen");
const CHAPTERS_IMG_DIR = path.join(IMAGES_DIR, "truyen");

// Đảm bảo thư mục lưu ảnh tồn tại
[IMAGES_DIR, COMICS_IMG_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Helper lưu ảnh Base64 vào thư mục chỉ định
function saveBase64Image(base64Str, targetDir, fileNameWithoutExt) {
  let matches = base64Str.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
  let buffer;
  let ext = "jpg";

  if (matches && matches.length === 3) {
    ext = matches[1] === "jpeg" ? "jpg" : matches[1];
    buffer = Buffer.from(matches[2], "base64");
  } else {
    const cleanBase64 = base64Str.replace(/^data:image\/\w+;base64,/, "");
    buffer = Buffer.from(cleanBase64, "base64");
  }

  const fullFileName = `${fileNameWithoutExt}.${ext}`;
  const targetFilePath = path.join(targetDir, fullFileName);
  fs.writeFileSync(targetFilePath, buffer);
  return { fullFileName, ext };
}

// ─── 1. POST /upload-image — Tải ảnh thủ công lên /Images/chapters/ ─────────
router.post("/upload-image", auth, async (req, res) => {
  try {
    const { base64, filename } = req.body;
    if (!base64) {
      return res.status(400).json({ error: "Thiếu dữ liệu base64" });
    }

    const ext = filename ? path.extname(filename).replace(".", "") : "jpg";
    const uniqueName = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`;
    const result = saveBase64Image(base64, CHAPTERS_IMG_DIR, uniqueName);

    res.json({
      success: true,
      url: `/Images/truyen/${result.fullFileName}`,
    });
  } catch (err) {
    console.error("Lỗi upload ảnh:", err);
    res.status(500).json({ error: "Lỗi server khi lưu file ảnh" });
  }
});

// ─── 2. GET /categories — Lấy danh sách thể loại từ bảng `genres` ──────────
router.get("/categories", async (req, res) => {
  try {
    const genres = await Genre.findAll({
      order: [["name", "ASC"]],
    });
    const items = genres.map((g) => ({
      id: g.slug,
      slug: g.slug,
      name: g.name,
      description: g.description,
      genre_id: g.id,
    }));
    res.json({ success: true, data: { items } });
  } catch (err) {
    console.error("Lỗi lấy danh mục thể loại:", err);
    res.status(500).json({ error: "Lỗi server khi lấy thể loại" });
  }
});

// ─── 3. GET /comics/batch — Lấy thông tin nhiều truyện theo danh sách slugs ─
router.get("/comics/batch", async (req, res) => {
  try {
    const slugsParam = req.query.slugs || "";
    const slugs = slugsParam.split(",").map((s) => s.trim()).filter(Boolean);
    if (slugs.length === 0) {
      return res.json({ success: true, comics: [] });
    }

    const { Op } = sequelize.Sequelize;
    const comics = await Comic.findAll({
      where: { slug: { [Op.in]: slugs } },
      include: [
        {
          model: Genre,
          as: "genres",
          attributes: ["id", "name", "slug"],
          through: { attributes: [] },
        },
        {
          model: Chapter,
          as: "chapters",
          attributes: ["id", "chapterNumber"],
        },
      ],
    });

    const formatted = comics.map((c) => {
      const chaps = c.chapters || [];
      const maxChapNum = chaps.length > 0 
        ? Math.max(...chaps.map(ch => parseFloat(ch.chapterNumber) || 0)) 
        : 0;
      const displayChap = maxChapNum > 0 ? `${maxChapNum}` : (chaps.length > 0 ? `${chaps.length}` : "1");

      return {
        id: c.id,
        slug: c.slug,
        name: c.title,
        title: c.title,
        thumb_url: c.thumbUrl,
        thumbUrl: c.thumbUrl,
        author: c.author || "",
        status: c.status || "",
        age_rating: c.ageRating || "ALL",
        ageRating: c.ageRating || "ALL",
        chap: displayChap,
        latestChapter: displayChap,
        totalChapters: chaps.length,
        soChuong: `${chaps.length} chương`,
      };
    });

    res.json({ success: true, comics: formatted });
  } catch (err) {
    console.error("Lỗi lấy batch truyện:", err);
    res.status(500).json({ error: "Lỗi server khi lấy batch truyện" });
  }
});

// ─── 4. GET /comics — Danh sách truyện phân trang & lọc ────────────────────
router.get("/comics", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 24));
    const offset = (page - 1) * limit;
    const { category, status, sort, ageRating } = req.query;

    const where = {};
    if (status && status !== "all") {
      where.status = status.toUpperCase();
    }
    if (ageRating && ageRating !== "all") {
      where.ageRating = ageRating;
    }

    let order = [["updated_at", "DESC"]];
    if (sort === "name") order = [["title", "ASC"]];
    if (sort === "views") order = [["total_views", "DESC"]];
    if (sort === "rating") order = [["rating_avg", "DESC"]];

    const include = [
      {
        model: Genre,
        as: "genres",
        attributes: ["id", "name", "slug"],
        through: { attributes: [] },
        ...(category ? { where: { slug: category } } : {}),
      },
      {
        model: Chapter,
        as: "chapters",
        attributes: ["id", "chapter_number", "chapter_name", "published_at"],
      },
      {
        model: ComicNotice,
        as: "notices",
        where: { isActive: true },
        required: false,
      },
    ];

    const { count, rows } = await Comic.findAndCountAll({
      where,
      include,
      order,
      limit,
      offset,
      distinct: true,
    });

    const formattedComics = rows.map((c) => {
      const plain = c.get({ plain: true });
      const catList = (plain.genres || []).map((g) => ({ id: g.slug, name: g.name, slug: g.slug }));
      const chaps = plain.chapters || [];
      const notices = plain.notices || [];
      return {
        ...plain,
        _id: plain.slug,
        name: plain.title,
        thumb_url: plain.thumbUrl,
        age_rating: plain.ageRating || "ALL",
        ageRating: plain.ageRating || "ALL",
        category: catList,
        categories: JSON.stringify(catList),
        totalChapters: chaps.length,
        soChuong: `${chaps.length} chương`,
        chap: `${chaps.length} chương`,
        notices,
        noticeCount: notices.length,
      };
    });

    res.json({
      success: true,
      totalItems: count,
      totalPages: Math.ceil(count / limit) || 1,
      currentPage: page,
      comics: formattedComics,
      data: {
        items: formattedComics,
        params: {
          pagination: {
            totalItems: count,
            totalItemsPerPage: limit,
            currentPage: page,
          },
        },
      },
    });
  } catch (err) {
    console.error("Lỗi lấy danh sách truyện:", err);
    res.status(500).json({ error: "Lỗi server khi lấy danh sách truyện" });
  }
});

// ─── 5. GET /advanced-search — Tìm kiếm nâng cao từ CSDL ───────────────────
router.get("/advanced-search", async (req, res) => {
  try {
    const { keyword, category, status, minChapters, searchType, ageRating, page = 1, limit = 24 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 24));
    const offset = (pageNum - 1) * limitNum;

    const { Op } = sequelize.Sequelize;
    const whereConditions = [];

    // 1. Tìm kiếm theo từ khóa & loại tìm kiếm (tên truyện, tác giả, nội dung)
    if (keyword && keyword.trim()) {
      const trimmed = keyword.trim();
      const type = (searchType || "").toLowerCase();
      if (type === "title") {
        whereConditions.push({
          [Op.or]: [
            { title: { [Op.like]: `%${trimmed}%` } },
            { description: { [Op.like]: `%${trimmed}%` } },
          ],
        });
      } else if (type === "author") {
        whereConditions.push({ author: { [Op.like]: `%${trimmed}%` } });
      } else if (type === "description") {
        whereConditions.push({ description: { [Op.like]: `%${trimmed}%` } });
      } else {
        // Mặc định: tìm trong tên truyện, tác giả hoặc nội dung
        whereConditions.push({
          [Op.or]: [
            { title: { [Op.like]: `%${trimmed}%` } },
            { author: { [Op.like]: `%${trimmed}%` } },
            { description: { [Op.like]: `%${trimmed}%` } },
          ],
        });
      }
    }

    // 2. Lọc theo trạng thái & độ tuổi
    if (status && status !== "all") {
      whereConditions.push({ status: status.toUpperCase() });
    }
    if (ageRating && ageRating !== "all") {
      whereConditions.push({ ageRating });
    }

    // 3. Lọc theo số chương tối thiểu (nếu có)
    if (minChapters && parseInt(minChapters, 10) > 0) {
      const minChapNum = parseInt(minChapters, 10);
      whereConditions.push({
        id: {
          [Op.in]: sequelize.literal(`(
            SELECT comic_id
            FROM chapters
            WHERE status = 'PUBLISHED'
            GROUP BY comic_id
            HAVING COUNT(id) >= ${minChapNum}
          )`),
        },
      });
    }

    // 4. Lọc theo thể loại: BẮT BUỘC PHẢI CÓ TẤT CẢ các thể loại đã chọn (AND logic)
    const categorySlugs = category
      ? category.split(",").map((c) => c.trim()).filter(Boolean)
      : [];

    if (categorySlugs.length > 0) {
      const escapedSlugs = categorySlugs.map((s) => sequelize.escape(s)).join(", ");
      whereConditions.push({
        id: {
          [Op.in]: sequelize.literal(`(
            SELECT cg.comic_id
            FROM comic_genres cg
            JOIN genres g ON cg.genre_id = g.id
            WHERE g.slug IN (${escapedSlugs})
            GROUP BY cg.comic_id
            HAVING COUNT(DISTINCT g.slug) = ${categorySlugs.length}
          )`),
        },
      });
    }

    const include = [
      {
        model: Genre,
        as: "genres",
        attributes: ["id", "name", "slug"],
        through: { attributes: [] },
      },
      {
        model: Chapter,
        as: "chapters",
        attributes: ["id"],
      },
    ];

    const { count, rows } = await Comic.findAndCountAll({
      where: whereConditions.length > 0 ? { [Op.and]: whereConditions } : {},
      include,
      order: [["updated_at", "DESC"]],
      limit: limitNum,
      offset,
      distinct: true,
    });

    const formatted = rows.map((c) => {
      const plain = c.get({ plain: true });
      const catList = (plain.genres || []).map((g) => ({ id: g.slug, name: g.name, slug: g.slug }));
      const chaps = plain.chapters || [];
      return {
        ...plain,
        _id: plain.slug,
        name: plain.title,
        thumb_url: plain.thumbUrl,
        age_rating: plain.ageRating || "ALL",
        ageRating: plain.ageRating || "ALL",
        category: catList,
        categories: JSON.stringify(catList),
        totalChapters: chaps.length,
        soChuong: `${chaps.length} chương`,
        chap: `${chaps.length} chương`,
      };
    });

    res.json({
      success: true,
      totalItems: count,
      totalPages: Math.ceil(count / limitNum) || 1,
      currentPage: pageNum,
      comics: formatted,
    });
  } catch (err) {
    console.error("Lỗi tìm kiếm nâng cao:", err);
    res.status(500).json({ error: "Lỗi server khi tìm kiếm" });
  }
});

// ─── 6. GET /comics/:slug — Chi tiết truyện ───────────────────────────────
router.get("/comics/:slug", optionalAuth, async (req, res) => {
  try {
    const comic = await Comic.findOne({
      where: { slug: req.params.slug },
      include: [
        {
          model: Genre,
          as: "genres",
          attributes: ["id", "name", "slug"],
          through: { attributes: [] },
        },
        {
          model: Chapter,
          as: "chapters",
          where: { status: { [Op.in]: ["PUBLISHED", "LOCKED"] } },
          required: false,
          attributes: [
            "id",
            "chapter_number",
            "chapter_name",
            "views",
            "status",
            "unlock_type",
            "unlock_price",
            "free_at",
            "published_at",
          ],
        },
        {
          model: ComicNotice,
          as: "notices",
          where: { isActive: true },
          required: false,
        },
      ],
    });

    if (!comic) {
      return res.status(404).json({ error: "Không tìm thấy truyện trong CSDL" });
    }

    // Lấy thông tin mở khóa & VIP của user hiện tại (nếu đã đăng nhập)
    let unlockedChapterIds = new Set();
    let userGam = null;
    if (req.user?.id) {
      const [unlocks, gam] = await Promise.all([
        ChapterUnlock.findAll({
          where: { userId: req.user.id },
          attributes: ["chapterId"],
        }),
        UserGamification.findOne({ where: { userId: req.user.id } }),
      ]);
      unlockedChapterIds = new Set(unlocks.map((u) => Number(u.chapterId)));
      userGam = gam;
    }
    const { isVip } = getActiveVipInfo(userGam);
    const isStaff =
      req.user &&
      ((req.user.role || "").toUpperCase() === "ADMIN" ||
        ((req.user.role || "").toUpperCase() === "TRANSLATOR" &&
          Number(comic.uploaderId) === Number(req.user.id)));

    const plain = comic.get({ plain: true });
    const catList = (plain.genres || []).map((g) => ({ id: g.slug, name: g.name, slug: g.slug }));

    const sortedChapters = (plain.chapters || []).sort((a, b) => {
      return (parseFloat(a.chapter_number) || 0) - (parseFloat(b.chapter_number) || 0);
    });

    const isComicVip = Boolean(comic.isVip);

    const serverData = sortedChapters.map((c, idx) => {
      const cleanNum = parseFloat(c.chapter_number) || c.chapter_number;
      const lockInfo = resolveChapterLock(c);
      const { finalPrice, discountPercent } = calcDiscountedUnlockPrice(lockInfo.basePrice, userGam);

      const isFirstChapter = idx === 0 || cleanNum <= 1;
      const effectiveUnlockType = isComicVip ? (!isFirstChapter ? "VIP" : "FREE") : lockInfo.unlockType;
      const isUnlocked =
        isComicVip
          ? (isFirstChapter || isVip || isStaff)
          : (!lockInfo.isLockedByConfig ||
             Boolean(isStaff) ||
             unlockedChapterIds.has(Number(c.id)) ||
             (lockInfo.unlockType === "VIP" && isVip));

      return {
        id: c.id,
        chapter_name: String(cleanNum),
        chapter_title: c.chapter_name || `Chương ${cleanNum}`,
        unlock_type: effectiveUnlockType,
        unlock_price: lockInfo.basePrice,
        final_price: finalPrice,
        discount_percent: discountPercent,
        free_at: lockInfo.freeAt,
        is_locked: !isUnlocked,
        is_unlocked: isUnlocked,
        chapter_api_data: `${req.protocol}://${req.get("host")}/api/comic/comics/${comic.slug}/chapters/${cleanNum}`,
      };
    });

    const notices = (plain.notices || []).sort(
      (a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at)
    );
    const followersCount = await Bookmark.count({ where: { comicId: comic.id } });

    const formattedComic = {
      _id: comic.slug,
      id: comic.id,
      uploaderId: comic.uploaderId,
      name: comic.title,
      title: comic.title,
      slug: comic.slug,
      content: comic.description,
      description: comic.description,
      status: comic.status,
      isVip: Boolean(comic.isVip),
      is_vip: Boolean(comic.isVip),
      age_rating: comic.ageRating || "ALL",
      ageRating: comic.ageRating || "ALL",
      thumb_url: comic.thumbUrl,
      thumbUrl: comic.thumbUrl,
      author: comic.author ? comic.author.split(",").map((a) => a.trim()) : [],
      category: catList,
      total_views: comic.totalViews,
      followers: followersCount,
      rating_avg: comic.ratingAvg,
      updatedAt: comic.updatedAt,
      notices,
      chapters: [
        {
          server_name: "Cây Thế Giới Irminsul 🌳",
          server_data: serverData,
        },
      ],
    };

    res.json({
      success: true,
      data: {
        item: formattedComic,
      },
    });
  } catch (err) {
    console.error("Lỗi chi tiết truyện:", err);
    res.status(500).json({ error: "Lỗi server khi lấy chi tiết truyện" });
  }
});

// ─── 7. GET /comics/:slug/chapters — Danh sách chương truyện ───────────────
router.get("/comics/:slug/chapters", optionalAuth, async (req, res) => {
  try {
    const comic = await Comic.findOne({ where: { slug: req.params.slug } });
    if (!comic) return res.status(404).json({ error: "Không tìm thấy truyện" });

    const chapters = await Chapter.findAll({
      where: { comicId: comic.id, status: { [Op.in]: ["PUBLISHED", "LOCKED"] } },
      order: [["chapter_number", "ASC"]],
    });

    let unlockedChapterIds = new Set();
    let userGam = null;
    if (req.user?.id) {
      const [unlocks, gam] = await Promise.all([
        ChapterUnlock.findAll({ where: { userId: req.user.id }, attributes: ["chapterId"] }),
        UserGamification.findOne({ where: { userId: req.user.id } }),
      ]);
      unlockedChapterIds = new Set(unlocks.map((u) => Number(u.chapterId)));
      userGam = gam;
    }
    const { isVip } = getActiveVipInfo(userGam);

    const serverData = chapters.map((c) => {
      const lockInfo = resolveChapterLock(c);
      const { finalPrice, discountPercent } = calcDiscountedUnlockPrice(lockInfo.basePrice, userGam);
      const isUnlocked =
        !lockInfo.isLockedByConfig ||
        unlockedChapterIds.has(Number(c.id)) ||
        (lockInfo.unlockType === "VIP" && isVip);
      return {
        id: c.id,
        chapter_name: String(c.chapterNumber),
        chapter_title: c.chapterName || `Chương ${c.chapterNumber}`,
        unlock_type: lockInfo.unlockType,
        unlock_price: lockInfo.basePrice,
        final_price: finalPrice,
        discount_percent: discountPercent,
        free_at: lockInfo.freeAt,
        is_locked: lockInfo.isLockedByConfig && !isUnlocked,
        is_unlocked: isUnlocked,
        chapter_api_data: `${req.protocol}://${req.get("host")}/api/comic/comics/${comic.slug}/chapters/${c.chapterNumber}`,
      };
    });

    res.json({ success: true, chapters: serverData });
  } catch (err) {
    console.error("Lỗi danh sách chương:", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

// ─── 8. GET /comics/:slug/chapters/:chapterName — Chi tiết chương & Trang đọc ảnh
router.get("/comics/:slug/chapters/:chapterName", optionalAuth, async (req, res) => {
  try {
    const comic = await Comic.findOne({ where: { slug: req.params.slug } });
    if (!comic) return res.status(404).json({ error: "Không tìm thấy bộ truyện" });

    const rawParam = decodeURIComponent(req.params.chapterName).trim();
    const numMatch = rawParam.match(/[\d.]+/);
    const targetNum = numMatch ? parseFloat(numMatch[0]) : null;

    let chapter = null;
    if (targetNum !== null && !isNaN(targetNum)) {
      chapter = await Chapter.findOne({
        where: {
          comicId: comic.id,
          [Op.or]: [
            { chapterNumber: targetNum },
            sequelize.where(sequelize.fn("ROUND", sequelize.col("chapter_number"), 2), targetNum),
          ],
        },
        include: [
          {
            model: ChapterPage,
            as: "pages",
            order: [["page_number", "ASC"]],
          },
        ],
      });
    }

    if (!chapter) {
      chapter = await Chapter.findOne({
        where: {
          comicId: comic.id,
          [Op.or]: [
            { chapterName: rawParam },
            { chapterName: `Chương ${rawParam}` },
            { chapterName: { [Op.like]: `%${rawParam}%` } },
          ],
        },
        include: [
          {
            model: ChapterPage,
            as: "pages",
            order: [["page_number", "ASC"]],
          },
        ],
      });
    }

    if (!chapter) {
      return res.status(404).json({ error: "Không tìm thấy chương truyện này" });
    }

    const cleanNum = parseFloat(chapter.chapterNumber) || chapter.chapterNumber;

    // 🔒 Kiểm tra quyền đọc chương ở Backend (không trả ảnh nếu chưa mở khóa!)
    const access = await canReadChapter(req.user, chapter, comic);
    if (!access.allowed) {
      return res.status(403).json({
        success: false,
        locked: true,
        ...access,
        chapter: {
          id: chapter.id,
          chapter_name: String(cleanNum),
          chapter_title: chapter.chapterName || `Chương ${cleanNum}`,
        },
      });
    }

    const pages = (chapter.pages || []).sort((a, b) => a.pageNumber - b.pageNumber);
    const chapterImages = pages.map((p) => ({
      image_file: p.imageUrl,
    }));

    res.json({
      success: true,
      access,
      data: {
        domain_cdn: "",
        item: {
          id: chapter.id,
          chapter_name: String(cleanNum),
          chapter_title: chapter.chapterName || `Chương ${cleanNum}`,
          chapter_path: "",
          chapter_image: chapterImages,
        },
      },
    });
  } catch (err) {
    console.error("Lỗi lấy chương đọc:", err);
    res.status(500).json({ error: "Lỗi server khi lấy chương đọc" });
  }
});

// ─── 8B. POST /chapters/:id/unlock — Mở khóa chương bằng World Crystal ──────
router.post("/chapters/:id/unlock", auth, async (req, res) => {
  const chapterId = parseInt(req.params.id, 10);
  if (!chapterId) {
    return res.status(400).json({ success: false, message: "Thiếu ID chương cần mở khóa" });
  }

  const t = await sequelize.transaction();
  try {
    const chapter = await Chapter.findByPk(chapterId, { transaction: t });
    if (!chapter) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Không tìm thấy chương truyện" });
    }

    const comic = await Comic.findByPk(chapter.comicId, { transaction: t });
    const lockInfo = resolveChapterLock(chapter);

    if (!lockInfo.isLockedByConfig) {
      await t.rollback();
      return res.json({ success: true, message: "Chương này đang miễn phí!" });
    }

    // Kiểm tra đã mở khóa trước đó chưa
    const existing = await ChapterUnlock.findOne({
      where: { userId: req.user.id, chapterId: chapter.id },
      transaction: t,
    });
    if (existing) {
      await t.rollback();
      return res.json({ success: true, alreadyUnlocked: true, message: "Bạn đã mở khóa chương này rồi!" });
    }

    const [gam] = await UserGamification.findOrCreate({
      where: { userId: req.user.id },
      defaults: { level: 1, currentXp: 0, nextLevelXp: 100, worldCrystals: 50 },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    const { isVip } = getActiveVipInfo(gam);

    if (lockInfo.unlockType === "VIP") {
      if (!isVip) {
        await t.rollback();
        return res.status(403).json({
          success: false,
          reason: "VIP_REQUIRED",
          message: "Chương này dành riêng cho thành viên VIP. Hãy kích hoạt VIP để đọc ngay!",
        });
      }
      await ChapterUnlock.create(
        { userId: req.user.id, chapterId: chapter.id, method: "VIP", cost: 0 },
        { transaction: t }
      );
      await t.commit();
      return res.json({
        success: true,
        message: "Đã mở khóa chương bằng đặc quyền VIP!",
        worldCrystals: gam.worldCrystals,
      });
    }

    // unlockType === 'CRYSTAL'
    const { finalPrice, discountPercent } = calcDiscountedUnlockPrice(lockInfo.basePrice, gam);

    if (gam.worldCrystals < finalPrice) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        reason: "INSUFFICIENT_CRYSTALS",
        required: finalPrice,
        current: gam.worldCrystals,
        message: `Không đủ Tinh Thạch! Cần ${finalPrice} Tinh Thạch, bạn hiện có ${gam.worldCrystals}.`,
      });
    }

    gam.worldCrystals -= finalPrice;
    await gam.save({ transaction: t });

    await ChapterUnlock.create(
      {
        userId: req.user.id,
        chapterId: chapter.id,
        method: "CRYSTAL",
        cost: finalPrice,
      },
      { transaction: t }
    );

    const chapNum = parseFloat(chapter.chapterNumber) || chapter.chapterNumber;
    await CrystalTransaction.create(
      {
        userId: req.user.id,
        amount: -finalPrice,
        transactionType: "CHAPTER_UNLOCK",
        description: `Mở khóa Chương ${chapNum} - ${comic?.title || "Truyện"}${
          discountPercent > 0 ? ` (ưu đãi VIP -${discountPercent}%)` : ""
        }`,
        balanceAfter: gam.worldCrystals,
      },
      { transaction: t }
    );

    await t.commit();

    // Kích hoạt nhiệm vụ RPG mở khóa chương (nếu có)
    try {
      await triggerTaskProgress(req.user.id, "UNLOCK_CHAPTER", 1);
    } catch (e) {}

    return res.json({
      success: true,
      message: `Mở khóa Chương ${chapNum} thành công (-${finalPrice} Tinh Thạch)!`,
      cost: finalPrice,
      worldCrystals: gam.worldCrystals,
    });
  } catch (err) {
    await t.rollback();
    console.error("Lỗi mở khóa chương:", err);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ khi mở khóa chương" });
  }
});

// ─── 8C. CẢNH BÁO / GHI CHÚ TRUYỆN TỪ ADMIN (ComicNotice) ───────────────────
router.get("/comics/:slug/notices", async (req, res) => {
  try {
    const comic = await Comic.findOne({ where: { slug: req.params.slug } });
    if (!comic) return res.status(404).json({ success: false, message: "Không tìm thấy truyện" });

    const notices = await ComicNotice.findAll({
      where: { comicId: comic.id, isActive: true },
      order: [["created_at", "DESC"]],
    });
    res.json({ success: true, notices });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi lấy cảnh báo truyện" });
  }
});

router.post("/comics/:slug/notices", auth, isTranslator, async (req, res) => {
  try {
    const comic = await Comic.findOne({ where: { slug: req.params.slug } });
    if (!comic) return res.status(404).json({ success: false, message: "Không tìm thấy truyện" });

    if (req.user.role !== "ADMIN" && Number(comic.uploaderId) !== Number(req.user.id)) {
      return res.status(403).json({ success: false, message: "Không có quyền gắn cảnh báo cho truyện này" });
    }

    const { type = "NOTE", severity = "INFO", content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: "Nội dung cảnh báo không được trống" });
    }

    const notice = await ComicNotice.create({
      comicId: comic.id,
      adminId: req.user.id,
      type: String(type).toUpperCase(),
      severity: String(severity).toUpperCase(),
      content: content.trim(),
      isActive: true,
    });

    res.json({ success: true, notice, message: "Đã thêm cảnh báo/ghi chú truyện!" });
  } catch (err) {
    console.error("Lỗi tạo cảnh báo truyện:", err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi tạo cảnh báo" });
  }
});

router.delete("/notices/:id", auth, isTranslator, async (req, res) => {
  try {
    const notice = await ComicNotice.findByPk(req.params.id);
    if (!notice) return res.status(404).json({ success: false, message: "Không tìm thấy cảnh báo" });
    await notice.destroy();
    res.json({ success: true, message: "Đã xóa cảnh báo truyện!" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi khi xóa cảnh báo" });
  }
});

// ─── 9. POST /view/:slug — Tăng lượt xem & Lưu lịch sử đọc ─────────────────
const viewCooldowns = new Map();

router.post("/view/:slug", optionalAuth, async (req, res) => {
  const { slug } = req.params;
  const { chapter } = req.body;

  try {
    const comic = await Comic.findOne({ where: { slug } });
    if (!comic) return res.status(404).json({ error: "Không tìm thấy truyện" });

    const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "127.0.0.1";
    const guestId = req.headers["x-guest-id"] || "anon";
    const chapterStr = chapter ? String(chapter) : "detail";

    const cooldownKey = req.user
      ? `user:${req.user.id}:${slug}:${chapterStr}`
      : `guest:${clientIp}:${guestId}:${slug}:${chapterStr}`;

    const now = Date.now();
    const lastViewTime = viewCooldowns.get(cooldownKey) || 0;
    const isCooldownExpired = now - lastViewTime > 300000; // 5 phút

    if (isCooldownExpired) {
      // Giữ nguyên 100% updated_at của truyện khi tăng view đọc truyện, không bị đẩy lên đầu trang
      await sequelize.query(
        "UPDATE comics SET total_views = total_views + 1, updated_at = updated_at WHERE id = :id",
        { replacements: { id: comic.id } }
      );
      comic.totalViews = BigInt(comic.totalViews || 0) + 1n;
      viewCooldowns.set(cooldownKey, now);
    }

    // Nếu người dùng đã đăng nhập và ĐANG ĐỌC CHƯƠNG (có truyền chapter), lưu lịch sử đọc và cộng điểm Irminsul
    if (req.user && chapter !== undefined && chapter !== null && String(chapter).trim() !== "") {
      let chapId = 0;
      const rawChapStr = decodeURIComponent(String(chapter)).trim();
      const numMatch = rawChapStr.match(/[\d.]+/);
      const targetNum = numMatch ? parseFloat(numMatch[0]) : null;

      if (targetNum !== null && !isNaN(targetNum)) {
        const chapObj = await Chapter.findOne({
          where: {
            comicId: comic.id,
            [Op.or]: [
              { chapterNumber: targetNum },
              sequelize.where(sequelize.fn("ROUND", sequelize.col("chapter_number"), 2), targetNum),
            ],
          },
        });
        if (chapObj) chapId = chapObj.id;
      }

      if (!chapId) {
        const firstChap = await Chapter.findOne({
          where: { comicId: comic.id },
          order: [["chapter_number", "ASC"]],
        });
        if (firstChap) chapId = firstChap.id;
      }

      if (chapId > 0) {
        const [hist, created] = await ReadingHistory.findOrCreate({
          where: { userId: req.user.id, comicId: comic.id },
          defaults: {
            lastChapterId: chapId,
            lastPageNumber: 1,
          },
        });

        if (!created) {
          await sequelize.query(
            "UPDATE reading_histories SET last_chapter_id = :chapId, updated_at = NOW() WHERE id = :id",
            { replacements: { chapId, id: hist.id } }
          );
        }
      }

      // Thưởng XP Cây Thế Giới khi đọc chương
      const userGamification = await UserGamification.findOne({ where: { userId: req.user.id } });
      if (userGamification) {
        const xpMult = getVipXpMultiplier(userGamification);
        addXpToGamification(userGamification, Math.round(10 * xpMult), 2);
        await userGamification.save();
      }
    }

    const followersCount = await Bookmark.count({ where: { comicId: comic.id } });

    res.json({
      success: true,
      view_count: Number(comic.totalViews),
      followers: followersCount,
      rating: Number(comic.ratingAvg),
    });
  } catch (err) {
    console.error("Lỗi tăng view:", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ✍️ PHÂN HỆ QUẢN LÝ TRUYỆN DÀNH CHO ADMIN & DỊCH GIẢ (CRUD TỰ ĐĂNG TRUYỆN)
// ══════════════════════════════════════════════════════════════════════════════

// ─── 10. POST /comics (hoặc /translator/create-comic) — Tạo truyện mới ───────
async function handleCreateComic(req, res) {
  try {
    const { title, name, slug, author, description, originName, thumbUrl, coverBase64, status, ageRating, age_rating, genres } = req.body;
    const finalTitle = (title || name || "").trim();
    if (!finalTitle) {
      return res.status(400).json({ error: "Tên truyện không được để trống!" });
    }

    const cleanSlug = (slug || finalTitle)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[đĐ]/g, "d")
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    const exist = await Comic.findOne({ where: { slug: cleanSlug } });
    if (exist) {
      return res.status(400).json({ error: `Slug "${cleanSlug}" đã tồn tại trên Cây Thế Giới!` });
    }

    let finalThumb = thumbUrl || "/Images/default-cover.jpg";

    // Lưu ảnh bìa nếu được gửi dạng base64
    if (coverBase64 && coverBase64.startsWith("data:image")) {
      const saved = saveBase64Image(coverBase64, COMICS_IMG_DIR, `cover_${cleanSlug}`);
      finalThumb = `/Images/truyen/${saved.fullFileName}`;
    }

    const newComic = await Comic.create({
      uploaderId: req.user.id,
      title: finalTitle,
      slug: cleanSlug,
      originName: originName || null,
      author: author || "Đang cập nhật",
      description: description || "",
      thumbUrl: finalThumb,
      status: (status || "ONGOING").toUpperCase(),
      ageRating: ["ALL", "13+", "16+", "18+"].includes(ageRating || age_rating)
        ? (ageRating || age_rating)
        : "ALL",
      totalViews: 0,
      ratingAvg: 5.0,
      totalRatings: 0,
      isRecommendedByAi: false,
    });

    // Gán thể loại nếu có
    if (Array.isArray(genres) && genres.length > 0) {
      for (const gId of genres) {
        let genreRecord = null;
        if (typeof gId === "number") {
          genreRecord = await Genre.findByPk(gId);
        } else {
          genreRecord = await Genre.findOne({ where: { slug: String(gId) } });
        }
        if (genreRecord) {
          await ComicGenre.create({
            comicId: newComic.id,
            genreId: genreRecord.id,
          });
        }
      }
    }

    res.json({ success: true, comic: newComic, message: "Đăng truyện thành công!" });
  } catch (err) {
    console.error("Lỗi tạo truyện:", err);
    res.status(500).json({ error: err.message || "Lỗi server khi tạo truyện" });
  }
}

router.post("/comics", auth, isTranslator, handleCreateComic);
router.post("/translator/create-comic", auth, isTranslator, handleCreateComic);

// ─── 11. PUT /comics/:slug — Chỉnh sửa thông tin truyện ─────────────────────
router.put("/comics/:slug", auth, isTranslator, async (req, res) => {
  try {
    const { slug } = req.params;
    const comic = await Comic.findOne({ where: { slug } });
    if (!comic) return res.status(404).json({ error: "Không tìm thấy truyện" });

    if (req.user.role !== "ADMIN" && comic.uploaderId !== req.user.id) {
      return res.status(403).json({ error: "Bạn không có quyền chỉnh sửa truyện này" });
    }

    const { title, name, author, description, originName, thumbUrl, coverBase64, status, ageRating, age_rating, genres } = req.body;

    let finalThumb = thumbUrl !== undefined ? thumbUrl : comic.thumbUrl;
    if (coverBase64 && coverBase64.startsWith("data:image")) {
      const saved = saveBase64Image(coverBase64, COMICS_IMG_DIR, `cover_${comic.slug}_${Date.now()}`);
      finalThumb = `/Images/truyen/${saved.fullFileName}`;
    }

    const nextAgeRating = ageRating ?? age_rating;
    await comic.update({
      title: (title || name || comic.title).trim(),
      originName: originName !== undefined ? originName : comic.originName,
      author: author !== undefined ? author : comic.author,
      description: description !== undefined ? description : comic.description,
      thumbUrl: finalThumb,
      status: status ? status.toUpperCase() : comic.status,
      ageRating: ["ALL", "13+", "16+", "18+"].includes(nextAgeRating)
        ? nextAgeRating
        : comic.ageRating,
    });

    if (Array.isArray(genres)) {
      await ComicGenre.destroy({ where: { comicId: comic.id } });
      for (const gId of genres) {
        let genreRecord = null;
        if (typeof gId === "number") {
          genreRecord = await Genre.findByPk(gId);
        } else {
          genreRecord = await Genre.findOne({ where: { slug: String(gId) } });
        }
        if (genreRecord) {
          await ComicGenre.create({
            comicId: comic.id,
            genreId: genreRecord.id,
          });
        }
      }
    }

    res.json({ success: true, comic, message: "Cập nhật truyện thành công!" });
  } catch (err) {
    console.error("Lỗi cập nhật truyện:", err);
    res.status(500).json({ error: "Lỗi server khi cập nhật truyện" });
  }
});

// ─── 12. DELETE /comics/:slug — Xóa truyện ──────────────────────────────────
router.delete("/comics/:slug", auth, isTranslator, async (req, res) => {
  try {
    const { slug } = req.params;
    const comic = await Comic.findOne({ where: { slug } });
    if (!comic) return res.status(404).json({ error: "Không tìm thấy truyện" });

    if (req.user.role !== "ADMIN" && comic.uploaderId !== req.user.id) {
      return res.status(403).json({ error: "Bạn không có quyền xóa truyện này" });
    }

    await comic.destroy();
    res.json({ success: true, message: "Đã xóa truyện và toàn bộ chương thành công!" });
  } catch (err) {
    console.error("Lỗi xóa truyện:", err);
    res.status(500).json({ error: "Lỗi server khi xóa truyện" });
  }
});

// ─── 13. POST /comics/:slug/chapters — Thêm chương mới kèm các trang ảnh ────
async function handleCreateChapter(req, res) {
  try {
    const { slug } = req.params;
    const comicSlug = slug || req.body.comicSlug;
    const comic = await Comic.findOne({ where: { slug: comicSlug } });
    if (!comic) return res.status(404).json({ error: "Không tìm thấy truyện" });

    if (req.user.role !== "ADMIN" && comic.uploaderId !== req.user.id) {
      return res.status(403).json({ error: "Bạn không có quyền đăng chương cho truyện này" });
    }

    const {
      chapterNumber,
      chapterName,
      name,
      images,
      imagesBase64,
      aiSummary,
      unlockType,
      unlock_type,
      unlockPrice,
      unlock_price,
      freeAt,
      free_at,
    } = req.body;
    const chapNum = parseFloat(chapterNumber);
    if (isNaN(chapNum)) {
      return res.status(400).json({ error: "Số chương không hợp lệ" });
    }

    const exist = await Chapter.findOne({ where: { comicId: comic.id, chapterNumber: chapNum } });
    if (exist) {
      return res.status(400).json({ error: `Chương ${chapNum} đã tồn tại trong bộ truyện này!` });
    }

    const finalTitle = chapterName || name || (aiSummary?.suggestedTitle ? aiSummary.suggestedTitle : `Chương ${chapNum}`);
    const cleanUnlockType = ["FREE", "CRYSTAL", "VIP"].includes(
      String(unlockType || unlock_type || "FREE").toUpperCase()
    )
      ? String(unlockType || unlock_type || "FREE").toUpperCase()
      : "FREE";
    const cleanUnlockPrice =
      cleanUnlockType === "CRYSTAL"
        ? Math.max(1, parseInt(unlockPrice ?? unlock_price ?? 30, 10) || 30)
        : 0;
    const cleanFreeAt = freeAt || free_at ? new Date(freeAt || free_at) : null;

    const newChapter = await Chapter.create({
      comicId: comic.id,
      chapterNumber: chapNum,
      chapterName: finalTitle,
      views: 0,
      status: cleanUnlockType === "FREE" ? "PUBLISHED" : "LOCKED",
      unlockType: cleanUnlockType,
      unlockPrice: cleanUnlockPrice,
      freeAt: cleanFreeAt && !isNaN(cleanFreeAt.getTime()) ? cleanFreeAt : null,
      publishedAt: new Date(),
    });

    // Nếu dịch giả đã duyệt qua bảng tương tác và có aiSummary, lưu vào CSDL (bao gồm cả Diễn biến câu chuyện trong chương)
    if (aiSummary && typeof aiSummary === "object") {
      try {
        const baseSum = (aiSummary.summaryText || "").trim();
        const progSum = (aiSummary.storyProgression || "").trim();
        const fullSummaryText =
          progSum && !baseSum.includes(progSum.slice(0, 30))
            ? `${baseSum}\n\n[Diễn biến câu chuyện trong chương]: ${progSum}`.trim()
            : baseSum || progSum;

        await ChapterAiSummary.create({
          chapterId: newChapter.id,
          summaryText: fullSummaryText,
          keyPlotPoints: Array.isArray(aiSummary.keyPlotPoints) ? aiSummary.keyPlotPoints : [],
          characterActions: Array.isArray(aiSummary.characterActions) ? aiSummary.characterActions : [],
          spoilersDetected: Array.isArray(aiSummary.spoilersDetected) ? aiSummary.spoilersDetected : []
        });
        console.log(`[AI Chapter Summary] Đã lưu tóm tắt & diễn biến câu chuyện AI cho Chapter ID: ${newChapter.id}`);
      } catch (sumErr) {
        console.warn("[AI Chapter Summary] Lỗi lưu ChapterAiSummary:", sumErr.message);
      }

      // Khởi tạo hoặc cập nhật hồ sơ nhân vật & loại sức mạnh cho bộ truyện
      if (aiSummary.mainCharacter || aiSummary.powerType || (Array.isArray(aiSummary.supportingCharacters) && aiSummary.supportingCharacters.length > 0)) {
        try {
          const newSupporting = Array.isArray(aiSummary.supportingCharacters) ? aiSummary.supportingCharacters : [];
          let profile = await ComicAiProfile.findOne({ where: { comicId: comic.id } });

          if (!profile) {
            await ComicAiProfile.create({
              comicId: comic.id,
              mainCharacter: aiSummary.mainCharacter || "Đang cập nhật",
              powerType: aiSummary.powerType || "Chưa xác định",
              powerDescription: aiSummary.powerDescription || "",
              supportingCast: newSupporting.map((name) => ({ name, role: "Nhân vật phụ" })),
              storyPremise: aiSummary.summaryText || comic.description || ""
            });
            console.log(`[ComicAiProfile] Đã khởi tạo hồ sơ nhân vật & sức mạnh cho bộ truyện ID: ${comic.id}`);
          } else {
            let currentCast = [];
            if (Array.isArray(profile.supportingCast)) {
              currentCast = [...profile.supportingCast];
            } else if (typeof profile.supportingCast === "string") {
              try { currentCast = JSON.parse(profile.supportingCast); } catch (e) {}
            }
            const existingNames = new Set(
              currentCast.map((c) => (typeof c === "string" ? c.toLowerCase() : (c.name || "").toLowerCase()))
            );
            newSupporting.forEach((name) => {
              if (name && !existingNames.has(name.toLowerCase())) {
                currentCast.push({ name, role: "Nhân vật phụ" });
                existingNames.add(name.toLowerCase());
              }
            });

            await profile.update({
              mainCharacter: (aiSummary.mainCharacter && aiSummary.mainCharacter !== "Đang cập nhật") ? aiSummary.mainCharacter : profile.mainCharacter,
              powerType: (aiSummary.powerType && aiSummary.powerType !== "Chưa xác định") ? aiSummary.powerType : profile.powerType,
              powerDescription: aiSummary.powerDescription || profile.powerDescription,
              supportingCast: currentCast
            });
            console.log(`[ComicAiProfile] Đã cập nhật hồ sơ nhân vật & sức mạnh cho bộ truyện ID: ${comic.id}`);
          }
        } catch (profErr) {
          console.warn("[ComicAiProfile] Lỗi cập nhật ComicAiProfile:", profErr.message);
        }
      }
    }

    // Lưu các trang ảnh
    const pageRecords = [];

    // Nếu ảnh được gửi dạng base64
    if (Array.isArray(imagesBase64) && imagesBase64.length > 0) {
      imagesBase64.forEach((imgObj, idx) => {
        const base64Str = typeof imgObj === "string" ? imgObj : imgObj.base64;
        if (base64Str && base64Str.startsWith("data:image")) {
          const pageNum = idx + 1;
          const fileName = `${comic.slug}_ch${chapNum}_p${pageNum}`;
          const saved = saveBase64Image(base64Str, CHAPTERS_IMG_DIR, fileName);
          pageRecords.push({
            chapterId: newChapter.id,
            pageNumber: pageNum,
            imageUrl: `/Images/truyen/${saved.fullFileName}`,
          });
        }
      });
    } else if (Array.isArray(images) && images.length > 0) {
      // Nếu là link ảnh trực tiếp
      images.forEach((imgUrl, idx) => {
        const urlStr = typeof imgUrl === "string" ? imgUrl : (imgUrl.url || imgUrl.image_file);
        if (urlStr) {
          pageRecords.push({
            chapterId: newChapter.id,
            pageNumber: idx + 1,
            imageUrl: urlStr,
          });
        }
      });
    }

    if (pageRecords.length > 0) {
      await ChapterPage.bulkCreate(pageRecords);
    }

    // Cập nhật updatedAt của Comic
    await comic.update({ updatedAt: new Date() });

    res.json({
      success: true,
      chapter: newChapter,
      totalPages: pageRecords.length,
      message: `Đăng Chương ${chapNum} thành công với ${pageRecords.length} trang ảnh!`,
    });
  } catch (err) {
    console.error("Lỗi đăng chương:", err);
    res.status(500).json({ error: err.message || "Lỗi server khi tạo chương" });
  }
}

router.post("/comics/:slug/chapters", auth, isTranslator, handleCreateChapter);
router.post("/translator/create-chapter", auth, isTranslator, handleCreateChapter);

// ─── 14. ADMIN: Lấy danh sách toàn bộ chương để quản trị ────────────────────
router.get("/comics/:slug/admin-chapters", auth, isTranslator, async (req, res) => {
  try {
    const comic = await Comic.findOne({ where: { slug: req.params.slug } });
    if (!comic) return res.status(404).json({ error: "Không tìm thấy truyện" });

    const chapters = await Chapter.findAll({
      where: { comicId: comic.id },
      include: [
        {
          model: ChapterPage,
          as: "pages",
          attributes: ["id", "page_number", "image_url"],
        },
      ],
      order: [["chapter_number", "DESC"]],
    });

    res.json({ success: true, chapters });
  } catch (err) {
    console.error("Lỗi lấy danh sách chương admin:", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

// ─── 15. ADMIN: Chi tiết 1 chương kèm danh sách trang ảnh ──────────────────
router.get("/comics/:slug/admin-chapters/:id", auth, isTranslator, async (req, res) => {
  try {
    const chapter = await Chapter.findByPk(req.params.id, {
      include: [
        {
          model: ChapterPage,
          as: "pages",
          order: [["page_number", "ASC"]],
        },
      ],
    });

    if (!chapter) return res.status(404).json({ error: "Không tìm thấy chương" });

    const pages = (chapter.pages || []).map((p) => ({
      id: p.id,
      page_number: p.pageNumber,
      url: p.imageUrl,
      image_file: p.imageUrl,
      visible: true,
    }));

    res.json({ success: true, chapter, images: pages });
  } catch (err) {
    console.error("Lỗi chi tiết chương admin:", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

// ─── 16. ADMIN: Sửa thông tin chương ───────────────────────────────────────
router.put("/comics/:slug/chapters/:id", auth, isTranslator, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      chapterNumber,
      name,
      chapterName,
      status,
      unlockType,
      unlock_type,
      unlockPrice,
      unlock_price,
      freeAt,
      free_at,
    } = req.body;

    const chapter = await Chapter.findByPk(id);
    if (!chapter) return res.status(404).json({ error: "Không tìm thấy chương" });

    const rawType = unlockType ?? unlock_type;
    const nextUnlockType =
      rawType !== undefined && ["FREE", "CRYSTAL", "VIP"].includes(String(rawType).toUpperCase())
        ? String(rawType).toUpperCase()
        : chapter.unlockType || "FREE";
    const rawPrice = unlockPrice ?? unlock_price;
    const nextUnlockPrice =
      nextUnlockType === "CRYSTAL"
        ? Math.max(1, parseInt(rawPrice ?? chapter.unlockPrice ?? 30, 10) || 30)
        : 0;
    const rawFreeAt = freeAt !== undefined ? freeAt : free_at;
    const nextFreeAt =
      rawFreeAt === undefined
        ? chapter.freeAt
        : rawFreeAt
        ? new Date(rawFreeAt)
        : null;

    await chapter.update({
      chapterNumber: chapterNumber !== undefined ? parseFloat(chapterNumber) : chapter.chapterNumber,
      chapterName: chapterName || name || chapter.chapterName,
      status:
        status !== undefined
          ? status
          : nextUnlockType === "FREE"
          ? "PUBLISHED"
          : "LOCKED",
      unlockType: nextUnlockType,
      unlockPrice: nextUnlockPrice,
      freeAt: nextFreeAt && !isNaN(new Date(nextFreeAt).getTime()) ? nextFreeAt : null,
    });

    res.json({ success: true, chapter, message: "Cập nhật chương thành công!" });
  } catch (err) {
    console.error("Lỗi cập nhật chương:", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

// ─── 17. ADMIN: Xóa chương ─────────────────────────────────────────────────
router.delete("/comics/:slug/chapters/:id", auth, isTranslator, async (req, res) => {
  try {
    const { id } = req.params;
    const chapter = await Chapter.findByPk(id);
    if (!chapter) return res.status(404).json({ error: "Không tìm thấy chương" });

    await chapter.destroy();
    res.json({ success: true, message: "Đã xóa chương truyện thành công!" });
  } catch (err) {
    console.error("Lỗi xóa chương:", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

// ─── 18. Dịch giả: Thống kê cá nhân ────────────────────────────────────────
router.get("/translator/stats", auth, isTranslator, async (req, res) => {
  try {
    // Phân biệt rõ truyện của từng tài khoản, chỉ lấy truyện do chính mình tải lên
    const whereCondition = { uploaderId: req.user.id };

    const myComics = await Comic.findAll({ where: whereCondition });
    const comicIds = myComics.map((c) => c.id);

    let totalViews = 0;
    myComics.forEach((c) => {
      totalViews += Number(c.totalViews || 0);
    });

    let totalChapters = 0;
    let totalFollowers = 0;
    if (comicIds.length > 0) {
      const [chapCnt, followCnt] = await Promise.all([
        Chapter.count({
          where: { comicId: { [sequelize.Sequelize.Op.in]: comicIds } },
        }),
        Bookmark.count({
          where: { comicId: { [sequelize.Sequelize.Op.in]: comicIds } },
        }),
      ]);
      totalChapters = chapCnt;
      totalFollowers = followCnt;
    }

    res.json({
      success: true,
      stats: {
        totalComics: myComics.length,
        totalChapters,
        totalViews,
        totalFollowers,
      },
    });
  } catch (err) {
    console.error("Lỗi thống kê dịch giả:", err);
    res.status(500).json({ error: "Lỗi server khi lấy thống kê dịch giả" });
  }
});

// ─── 19. Dịch giả: Danh sách truyện của tôi ────────────────────────────────
router.get("/translator/my-comics", auth, isTranslator, async (req, res) => {
  try {
    // Chỉ hiển thị danh sách truyện do chính tài khoản hiện tại đăng tải
    const whereCondition = { uploaderId: req.user.id };

    const comics = await Comic.findAll({
      where: whereCondition,
      include: [
        {
          model: Chapter,
          as: "chapters",
          attributes: ["id"],
        },
      ],
      order: [["updated_at", "DESC"]],
    });

    const formatted = comics.map((c) => {
      const plain = c.get({ plain: true });
      return {
        ...plain,
        name: plain.title,
        thumb_url: plain.thumbUrl,
        totalChapters: plain.chapters?.length || 0,
        soChuong: `${plain.chapters?.length || 0} chương`,
      };
    });

    res.json({ success: true, comics: formatted });
  } catch (err) {
    console.error("Lỗi danh sách truyện dịch giả:", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

// ─── 20. ADMIN: Thống kê tổng quan hệ thống ────────────────────────────────
router.get("/admin/stats", auth, isAdmin, async (req, res) => {
  try {
    const userCount = await User.count();
    const comicCount = await Comic.count();
    const chapterCount = await Chapter.count();
    const totalViews = (await Comic.sum("total_views")) || 0;
    const questCount = await Quest.count();

    const topComics = await Comic.findAll({
      attributes: ["title", "slug", "totalViews", "ratingAvg"],
      order: [["total_views", "DESC"]],
      limit: 5,
    });

    const formattedTopComics = topComics.map((c) => ({
      name: c.title,
      slug: c.slug,
      views: Number(c.totalViews ?? c.dataValues.total_views ?? 0),
      rating: Number(c.ratingAvg ?? c.dataValues.rating_avg ?? 5),
    }));

    // Top 5 người dùng nhiều Pha Lê (world_crystals) nhất
    const topRich = await UserGamification.findAll({
      include: [{ model: User, as: "user", attributes: ["username"] }],
      order: [["world_crystals", "DESC"]],
      limit: 5,
    });

    const topRichUsers = topRich.map((r) => ({
      username: r.user?.username || `Lữ hành #${r.userId}`,
      level: r.level || 1,
      worldCrystal: r.worldCrystals || 0,
    }));

    // Phân bố cấp độ thành viên
    const [levelDist] = await sequelize.query(`
      SELECT level, COUNT(*) as count 
      FROM user_gamification 
      GROUP BY level 
      ORDER BY level ASC 
      LIMIT 10
    `);

    const formattedLevelDist = levelDist.map((item) => ({
      level: Number(item.level),
      count: Number(item.count),
    }));

    res.json({
      success: true,
      stats: {
        totalUsers: userCount,
        totalComics: comicCount,
        totalChapters: chapterCount,
        totalViews: Number(totalViews),
        totalQuests: questCount,
        topComics: formattedTopComics,
        topRichUsers,
        levelDist: formattedLevelDist,
      },
    });
  } catch (error) {
    console.error("Lỗi lấy dữ liệu thống kê:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi lấy dữ liệu thống kê." });
  }
});

export default router;
