/**
 * 🌳 IRMINSUL - ACCESS CONTROL & VIP HELPERS
 * ==========================================================
 * Kiểm tra quyền đọc chương (FREE / CRYSTAL / VIP / early-access free_at),
 * kiểm tra trạng thái VIP còn hạn, tính giá mở khóa sau ưu đãi VIP,
 * và kiểm tra độ tuổi cho truyện 18+.
 * ==========================================================
 */
import { Chapter, ChapterUnlock, UserGamification } from "../models/index.js";
import { getVipPlan, DEFAULT_UNLOCK_PRICE, AI_DAILY_LIMIT_FREE } from "../config/monetization.js";

/**
 * Kiểm tra xem gamification của user còn VIP hiệu lực không
 */
export function getActiveVipInfo(gam) {
  if (!gam || !gam.vipTier || Number(gam.vipTier) <= 0) {
    return { isVip: false, vipTier: 0, vipExpiresAt: null, plan: null };
  }
  const expires = gam.vipExpiresAt ? new Date(gam.vipExpiresAt) : null;
  if (!expires || isNaN(expires.getTime()) || expires.getTime() <= Date.now()) {
    return { isVip: false, vipTier: 0, vipExpiresAt: null, plan: null };
  }
  const plan = getVipPlan(gam.vipTier);
  return {
    isVip: true,
    vipTier: Number(gam.vipTier),
    vipExpiresAt: expires.toISOString(),
    plan,
  };
}

/**
 * Hạn mức gọi AI trong ngày theo VIP
 */
export function getUserAiDailyLimit(gam) {
  const { isVip, plan } = getActiveVipInfo(gam);
  if (isVip && plan?.aiDailyLimit) return plan.aiDailyLimit;
  return AI_DAILY_LIMIT_FREE;
}

/**
 * Hệ số nhân XP theo VIP
 */
export function getVipXpMultiplier(gam) {
  const { isVip, plan } = getActiveVipInfo(gam);
  if (isVip && plan?.xpBonus) return 1 + plan.xpBonus;
  return 1;
}

/**
 * Chuẩn hóa thông tin khóa của 1 chương (hỗ trợ cả status='LOCKED' cũ và unlock_type mới)
 */
export function resolveChapterLock(chapter) {
  const rawType = (chapter.unlockType || chapter.unlock_type || "FREE").toUpperCase();
  const rawStatus = (chapter.status || "PUBLISHED").toUpperCase();
  const freeAtRaw = chapter.freeAt || chapter.free_at || null;
  const freeAt = freeAtRaw ? new Date(freeAtRaw) : null;

  // Nếu đã qua thời điểm mở miễn phí (early-access hết hạn) => FREE
  if (freeAt && !isNaN(freeAt.getTime()) && freeAt.getTime() <= Date.now()) {
    return { unlockType: "FREE", basePrice: 0, freeAt: freeAt.toISOString(), isLockedByConfig: false };
  }

  let effectiveType = rawType;
  if (effectiveType === "FREE" && rawStatus === "LOCKED") {
    effectiveType = "CRYSTAL";
  }

  const rawPrice = Number(chapter.unlockPrice ?? chapter.unlock_price ?? 0);
  const basePrice =
    effectiveType === "CRYSTAL"
      ? rawPrice > 0
        ? rawPrice
        : DEFAULT_UNLOCK_PRICE
      : 0;

  return {
    unlockType: effectiveType,
    basePrice,
    freeAt: freeAt && !isNaN(freeAt.getTime()) ? freeAt.toISOString() : null,
    isLockedByConfig: effectiveType !== "FREE",
  };
}

/**
 * Tính giá mở khóa sau khi trừ ưu đãi VIP
 */
export function calcDiscountedUnlockPrice(basePrice, gam) {
  const raw = Math.max(0, Number(basePrice) || 0);
  if (raw === 0) return { finalPrice: 0, discountPercent: 0 };
  const { isVip, plan } = getActiveVipInfo(gam);
  const discount = isVip && plan?.unlockDiscount ? plan.unlockDiscount : 0;
  const finalPrice = Math.max(1, Math.round(raw * (1 - discount)));
  return {
    finalPrice,
    discountPercent: Math.round(discount * 100),
  };
}

/**
 * Kiểm tra quyền đọc 1 chương cụ thể
 * @param {object|null} reqUser decoded JWT (id, role)
 * @param {object} chapter instance Chapter
 * @param {object} comic instance Comic
 * @returns {Promise<{allowed: boolean, reason?: string, unlockType: string, basePrice: number, finalPrice: number, discountPercent: number, freeAt: string|null, isVip: boolean, vipTier: number, userCrystals: number}>}
 */
export async function canReadChapter(reqUser, chapter, comic) {
  const { unlockType, basePrice, freeAt, isLockedByConfig } = resolveChapterLock(chapter);

  let gam = null;
  if (reqUser?.id) {
    gam = await UserGamification.findOne({ where: { userId: reqUser.id } });
  }
  const { isVip, vipTier } = getActiveVipInfo(gam);
  const { finalPrice, discountPercent } = calcDiscountedUnlockPrice(basePrice, gam);
  const userCrystals = gam?.worldCrystals || 0;
  const role = (reqUser?.role || "").toUpperCase();

  // 🌟 ĐẶC QUYỀN VIP THEO BỘ TRUYỆN (Comic-level VIP)
  // Nếu cả bộ truyện được đánh dấu là Truyện VIP (comic.isVip)
  const isComicVip = Boolean(comic?.isVip || comic?.is_vip);
  if (isComicVip) {
    // 1. Thành viên VIP => Được đọc toàn bộ mọi chương của truyện VIP này
    if (isVip) {
      return {
        allowed: true,
        reason: "VIP_ACTIVE",
        unlockType: "VIP",
        basePrice: 0,
        finalPrice: 0,
        discountPercent: 100,
        freeAt: null,
        isVip,
        vipTier,
        userCrystals,
        isComicVip: true,
      };
    }

    // 2. Staff / Admin bypass
    if (role === "ADMIN" || (role === "TRANSLATOR" && comic && Number(comic.uploaderId) === Number(reqUser?.id))) {
      return {
        allowed: true,
        reason: isVip ? "VIP_ACTIVE" : "STAFF_BYPASS",
        unlockType: "VIP",
        basePrice: 0,
        finalPrice: 0,
        discountPercent: 100,
        freeAt: null,
        isVip,
        vipTier,
        userCrystals,
        isComicVip: true,
      };
    }

    // 3. Người dùng chưa có VIP: Cho phép đọc thử chương đầu tiên, từ chương tiếp theo chặn yêu cầu VIP
    const chapNum = parseFloat(chapter.chapterNumber || chapter.chapter_number) || 0;
    let isFirstChapter = chapNum <= 1;
    if (!isFirstChapter && comic?.id) {
      try {
        const firstChap = await Chapter.findOne({
          where: { comicId: comic.id },
          order: [["chapter_number", "ASC"], ["id", "ASC"]],
        });
        if (firstChap && Number(firstChap.id) === Number(chapter.id)) {
          isFirstChapter = true;
        }
      } catch (e) {
        // Fallback
      }
    }

    if (!isFirstChapter) {
      return {
        allowed: false,
        reason: "VIP_REQUIRED",
        unlockType: "VIP",
        basePrice: 0,
        finalPrice: 0,
        discountPercent: 0,
        freeAt: null,
        isVip: false,
        vipTier: 0,
        userCrystals,
        isComicVip: true,
      };
    }
  }

  // 1. Chương miễn phí
  if (!isLockedByConfig) {
    return {
      allowed: true,
      unlockType: "FREE",
      basePrice: 0,
      finalPrice: 0,
      discountPercent: 0,
      freeAt,
      isVip,
      vipTier,
      userCrystals,
      isComicVip: false,
    };
  }

  // 2. Admin hoặc Dịch giả sở hữu truyện luôn được đọc
  if (role === "ADMIN" || (role === "TRANSLATOR" && comic && Number(comic.uploaderId) === Number(reqUser?.id))) {
    return {
      allowed: true,
      reason: isVip ? "VIP_ACTIVE" : "STAFF_BYPASS",
      unlockType,
      basePrice,
      finalPrice: 0,
      discountPercent: 100,
      freeAt,
      isVip,
      vipTier,
      userCrystals,
      isComicVip: false,
    };
  }

  // 3. Chưa đăng nhập => chặn
  if (!reqUser?.id) {
    return {
      allowed: false,
      reason: "LOGIN_REQUIRED",
      unlockType,
      basePrice,
      finalPrice,
      discountPercent,
      freeAt,
      isVip: false,
      vipTier: 0,
      userCrystals: 0,
    };
  }

  // 4. Kiểm tra đã từng mở khóa chương này trong bảng chapter_unlocks chưa
  const unlockedRecord = await ChapterUnlock.findOne({
    where: { userId: reqUser.id, chapterId: chapter.id },
  });
  if (unlockedRecord) {
    return {
      allowed: true,
      reason: "ALREADY_UNLOCKED",
      unlockType,
      basePrice,
      finalPrice,
      discountPercent,
      freeAt,
      isVip,
      vipTier,
      userCrystals,
    };
  }

  // 5. Nếu chương yêu cầu VIP
  if (unlockType === "VIP") {
    if (isVip) {
      return {
        allowed: true,
        reason: "VIP_ACTIVE",
        unlockType,
        basePrice: 0,
        finalPrice: 0,
        discountPercent: 100,
        freeAt,
        isVip,
        vipTier,
        userCrystals,
      };
    }
    return {
      allowed: false,
      reason: "VIP_REQUIRED",
      unlockType,
      basePrice: 0,
      finalPrice: 0,
      discountPercent: 0,
      freeAt,
      isVip,
      vipTier,
      userCrystals,
    };
  }

  // 6. Chương mở bằng Tinh Thạch (CRYSTAL)
  return {
    allowed: false,
    reason: "CRYSTAL_REQUIRED",
    unlockType: "CRYSTAL",
    basePrice,
    finalPrice,
    discountPercent,
    freeAt,
    isVip,
    vipTier,
    userCrystals,
  };
}

