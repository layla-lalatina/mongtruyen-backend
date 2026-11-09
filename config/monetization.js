/**
 * 🌳 IRMINSUL - CẤU HÌNH KINH TẾ: NẠP TIỀN, VIP, KHÓA CHƯƠNG, HẠN MỨC AI
 * ==========================================================
 * Tập trung mọi con số tại đây để dễ cân bằng game.
 * ==========================================================
 */

// Tỉ giá: 1.000đ = 10 Tinh Thạch
export const VND_PER_CRYSTAL = 100;

// Gói nạp (bonus = Tinh Thạch tặng thêm)
export const DEPOSIT_PACKAGES = [
  { id: "pkg_10k", amountVnd: 10000, crystals: 100, bonus: 0 },
  { id: "pkg_20k", amountVnd: 20000, crystals: 200, bonus: 10 },
  { id: "pkg_50k", amountVnd: 50000, crystals: 500, bonus: 50 },
  { id: "pkg_100k", amountVnd: 100000, crystals: 1000, bonus: 150, popular: true },
  { id: "pkg_200k", amountVnd: 200000, crystals: 2000, bonus: 400 },
  { id: "pkg_500k", amountVnd: 500000, crystals: 5000, bonus: 1250 },
];

export const CUSTOM_DEPOSIT = { minVnd: 10000, maxVnd: 5000000, stepVnd: 1000 };

export const PAYMENT_METHODS = [
  { id: "BANK", label: "Chuyển khoản ngân hàng (VietQR)" },
  { id: "MOMO", label: "Ví MoMo" },
  { id: "ZALOPAY", label: "ZaloPay" },
];

// Đơn nạp hết hạn sau 15 phút
export const ORDER_TTL_MINUTES = 15;

// Gói VIP – mua bằng Tinh Thạch
export const VIP_PLANS = [
  {
    tier: 1,
    id: "vip_star",
    name: "Lữ Khách Ánh Sao",
    priceCrystals: 500,
    durationDays: 7,
    unlockDiscount: 0.2,
    xpBonus: 0.1,
    aiDailyLimit: 60,
    perks: ["Đọc chương VIP", "Giảm 20% khi mở khóa chương", "+10% XP khi đọc", "60 lượt chat AI / ngày"],
  },
  {
    tier: 2,
    id: "vip_guardian",
    name: "Hộ Vệ Irminsul",
    priceCrystals: 1800,
    durationDays: 30,
    unlockDiscount: 0.5,
    xpBonus: 0.2,
    aiDailyLimit: 200,
    perks: ["Đọc chương VIP", "Giảm 50% khi mở khóa chương", "+20% XP khi đọc", "200 lượt chat AI / ngày", "Huy hiệu VIP vàng"],
  },
];

// Hạn mức chat AI mỗi ngày cho người không VIP
export const AI_DAILY_LIMIT_FREE = 20;

// Giá mặc định khi Dịch giả bật khóa chương bằng Tinh Thạch
export const DEFAULT_UNLOCK_PRICE = 30;

export const getVipPlan = (tier) => VIP_PLANS.find((p) => p.tier === Number(tier)) || null;

