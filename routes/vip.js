/**
 * 🌳 IRMINSUL - VIP & AUTOMATIC DEPOSIT (MOCK GATEWAY) ROUTES
 * ==========================================================
 * - Mua / gia hạn VIP bằng Tinh Thạch (World Crystal)
 * - Nạp tiền tự động qua cổng thanh toán giả lập (VietQR / MoMo / ZaloPay)
 *   hỗ trợ webhook tự động cộng Tinh Thạch + Bonus ngay lập tức.
 * ==========================================================
 */
import express from "express";
import auth from "../middleware/auth.js";
import optionalAuth from "../middleware/optionalAuth.js";
import isAdmin from "../middleware/isAdmin.js";
import {
  sequelize,
  User,
  UserGamification,
  CrystalTransaction,
  PaymentOrder,
} from "../models/index.js";
import {
  VIP_PLANS,
  DEPOSIT_PACKAGES,
  CUSTOM_DEPOSIT,
  PAYMENT_METHODS,
  VND_PER_CRYSTAL,
  ORDER_TTL_MINUTES,
  getVipPlan,
} from "../config/monetization.js";
import { getActiveVipInfo, getUserAiDailyLimit } from "../utils/accessControl.js";
import { triggerTaskProgress } from "../utils/taskSystem.js";

const router = express.Router();

async function getOrCreateGam(userId, transaction = null) {
  const [gam] = await UserGamification.findOrCreate({
    where: { userId },
    defaults: {
      level: 1,
      currentXp: 0,
      nextLevelXp: 100,
      irminsulMemories: 0,
      fameRank: "RANK_F",
      worldCrystals: 50,
      dailyStreak: 0,
      vipTier: 0,
      vipExpiresAt: null,
    },
    transaction,
  });
  return gam;
}

// ─── 1. GET /api/vip/plans — Danh sách gói VIP, gói nạp & trạng thái của user ───
router.get("/plans", optionalAuth, async (req, res) => {
  try {
    let userStatus = null;
    if (req.user?.id) {
      const gam = await getOrCreateGam(req.user.id);
      const vipInfo = getActiveVipInfo(gam);
      userStatus = {
        worldCrystals: gam.worldCrystals,
        ...vipInfo,
        aiDailyLimit: getUserAiDailyLimit(gam),
      };
    }

    res.json({
      success: true,
      vipPlans: VIP_PLANS,
      depositPackages: DEPOSIT_PACKAGES,
      customDeposit: CUSTOM_DEPOSIT,
      paymentMethods: PAYMENT_METHODS,
      vndPerCrystal: VND_PER_CRYSTAL,
      userStatus,
    });
  } catch (err) {
    console.error("Lỗi GET /api/vip/plans:", err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi tải gói VIP" });
  }
});

// ─── 2. POST /api/vip/subscribe — Mua / gia hạn VIP bằng World Crystal ─────────
router.post("/subscribe", auth, async (req, res) => {
  const { tier } = req.body;
  const plan = getVipPlan(tier);
  if (!plan) {
    return res.status(400).json({ success: false, message: "Gói VIP không hợp lệ" });
  }

  const t = await sequelize.transaction();
  try {
    const gam = await getOrCreateGam(req.user.id, t);
    const activeVip = getActiveVipInfo(gam);

    // Chặn mua gói VIP thấp hơn khi đang sở hữu gói VIP cao hơn còn hạn (VD: đang có VIP Vàng bậc 2 không thể mua VIP Xanh bậc 1)
    if (activeVip.isVip && Number(activeVip.vipTier) > Number(plan.tier)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `Bạn đang sở hữu gói VIP "${activeVip.plan?.name || "VIP Vàng"}" (Bậc ${activeVip.vipTier}) cao hơn nên không thể mua gói "${plan.name}" (Bậc ${plan.tier}) thấp hơn khi gói hiện tại vẫn còn hạn!`,
      });
    }

    if (gam.worldCrystals < plan.priceCrystals) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `Không đủ Tinh Thạch! Cần ${plan.priceCrystals.toLocaleString()} Tinh Thạch, bạn hiện có ${gam.worldCrystals.toLocaleString()}.`,
      });
    }

    // Tính ngày hết hạn: nếu đang còn hạn cùng tier hoặc thấp hơn, cộng dồn ngày
    const now = new Date();
    const currentExp = gam.vipExpiresAt ? new Date(gam.vipExpiresAt) : null;
    const baseTime =
      currentExp && !isNaN(currentExp.getTime()) && currentExp.getTime() > now.getTime()
        ? currentExp
        : now;
    const newExpires = new Date(baseTime.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

    const newTier = Math.max(Number(gam.vipTier) || 0, plan.tier);
    gam.worldCrystals -= plan.priceCrystals;
    gam.vipTier = newTier;
    gam.vipExpiresAt = newExpires;
    await gam.save({ transaction: t });

    await CrystalTransaction.create(
      {
        userId: req.user.id,
        amount: -plan.priceCrystals,
        transactionType: "VIP_PURCHASE",
        description: `Đăng ký VIP ${plan.name} (${plan.durationDays} ngày)`,
        balanceAfter: gam.worldCrystals,
      },
      { transaction: t }
    );

    await t.commit();

    const vipInfo = getActiveVipInfo(gam);
    return res.json({
      success: true,
      message: `Kích hoạt thành công gói VIP "${plan.name}" (${plan.durationDays} ngày)!`,
      worldCrystals: gam.worldCrystals,
      vip: vipInfo,
      aiDailyLimit: getUserAiDailyLimit(gam),
    });
  } catch (err) {
    await t.rollback();
    console.error("Lỗi đăng ký VIP:", err);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ khi đăng ký VIP" });
  }
});

// ─── 3. POST /api/vip/admin/grant — Admin cấp/hủy VIP cho người dùng ──────────
router.post("/admin/grant", auth, isAdmin, async (req, res) => {
  try {
    const { userId, tier = 1, days = 30 } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: "Thiếu userId" });

    const gam = await getOrCreateGam(userId);
    if (Number(tier) <= 0 || Number(days) <= 0) {
      gam.vipTier = 0;
      gam.vipExpiresAt = null;
      await gam.save();
      return res.json({ success: true, message: "Đã thu hồi trạng thái VIP của người dùng." });
    }

    const expires = new Date(Date.now() + Number(days) * 24 * 60 * 60 * 1000);
    gam.vipTier = Number(tier);
    gam.vipExpiresAt = expires;
    await gam.save();

    return res.json({
      success: true,
      message: `Đã cấp VIP bậc ${tier} trong ${days} ngày cho user #${userId}`,
      vip: getActiveVipInfo(gam),
    });
  } catch (err) {
    console.error("Lỗi admin cấp VIP:", err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
});

// ─── 4. POST /api/vip/payment/create-order — Tạo đơn nạp tự động (Mock Gateway) ─
router.post("/payment/create-order", auth, async (req, res) => {
  try {
    const { packageId, customAmountVnd, method = "BANK" } = req.body;
    const cleanMethod = String(method || "BANK").toUpperCase();

    let amountVnd = 0;
    let crystals = 0;
    let bonusCrystals = 0;

    if (packageId) {
      const pkg = DEPOSIT_PACKAGES.find((p) => p.id === packageId);
      if (!pkg) {
        return res.status(400).json({ success: false, message: "Gói nạp không tồn tại" });
      }
      amountVnd = pkg.amountVnd;
      crystals = pkg.crystals;
      bonusCrystals = pkg.bonus || 0;
    } else {
      const rawVnd = parseInt(customAmountVnd, 10) || 0;
      if (rawVnd < CUSTOM_DEPOSIT.minVnd || rawVnd > CUSTOM_DEPOSIT.maxVnd) {
        return res.status(400).json({
          success: false,
          message: `Số tiền nạp tùy chỉnh phải từ ${CUSTOM_DEPOSIT.minVnd.toLocaleString()}đ đến ${CUSTOM_DEPOSIT.maxVnd.toLocaleString()}đ`,
        });
      }
      amountVnd = rawVnd;
      crystals = Math.floor(rawVnd / VND_PER_CRYSTAL);
      // Tự tính bonus cho gói tùy chỉnh: >=100k +10%, >=200k +15%
      if (rawVnd >= 200000) bonusCrystals = Math.floor(crystals * 0.15);
      else if (rawVnd >= 100000) bonusCrystals = Math.floor(crystals * 0.1);
      else if (rawVnd >= 50000) bonusCrystals = Math.floor(crystals * 0.05);
    }

    const orderCode =
      "IRM" +
      Date.now().toString(36).toUpperCase() +
      Math.random().toString(36).substring(2, 5).toUpperCase();
    const expiresAt = new Date(Date.now() + ORDER_TTL_MINUTES * 60 * 1000);

    const order = await PaymentOrder.create({
      orderCode,
      userId: req.user.id,
      provider: "MOCK_AUTO",
      method: cleanMethod,
      amountVnd,
      crystals,
      bonusCrystals,
      status: "PENDING",
      expiresAt,
    });

    // Tạo QR minh họa chuẩn VietQR để trình diễn giao diện thật
    const qrData = encodeURIComponent(
      `IRMINSUL|ORDER:${orderCode}|VND:${amountVnd}|CRYSTALS:${crystals + bonusCrystals}`
    );
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${qrData}`;

    return res.json({
      success: true,
      order: {
        id: order.id,
        orderCode: order.orderCode,
        method: order.method,
        amountVnd: order.amountVnd,
        crystals: order.crystals,
        bonusCrystals: order.bonusCrystals,
        totalCrystals: order.crystals + order.bonusCrystals,
        status: order.status,
        expiresAt: order.expiresAt,
        qrUrl,
        transferContent: `NAP ${order.orderCode}`,
        bankInfo: {
          bankName: "MB Bank (Ngân hàng Quân Đội)",
          accountNumber: "999988886666",
          accountHolder: "HE THONG IRMINSUL COMIC",
        },
      },
    });
  } catch (err) {
    console.error("Lỗi tạo đơn nạp:", err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi tạo đơn nạp" });
  }
});

// Helper xử lý hoàn tất thanh toán tự động (dùng chung cho Webhook và nút Demo Auto-Pay)
export async function settlePaymentOrder(orderCode, providerTxnId = null, rawPayload = null) {
  const t = await sequelize.transaction();
  try {
    const order = await PaymentOrder.findOne({
      where: { orderCode },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    if (!order) {
      await t.rollback();
      return { ok: false, status: 404, message: "Không tìm thấy đơn thanh toán" };
    }

    // Idempotent: nếu đã PAID trước đó thì trả kết quả thành công luôn, không cộng trùng
    if (order.status === "PAID") {
      const gam = await getOrCreateGam(order.userId, t);
      await t.commit();
      return {
        ok: true,
        alreadyPaid: true,
        order,
        worldCrystals: gam.worldCrystals,
      };
    }

    if (order.status !== "PENDING") {
      await t.rollback();
      return { ok: false, status: 400, message: `Đơn đang ở trạng thái ${order.status}` };
    }

    if (order.expiresAt && new Date(order.expiresAt).getTime() < Date.now()) {
      order.status = "EXPIRED";
      await order.save({ transaction: t });
      await t.rollback();
      return { ok: false, status: 400, message: "Đơn thanh toán đã hết hạn" };
    }

    const totalAdded = Number(order.crystals) + Number(order.bonusCrystals || 0);
    const gam = await getOrCreateGam(order.userId, t);
    gam.worldCrystals += totalAdded;
    await gam.save({ transaction: t });

    order.status = "PAID";
    order.paidAt = new Date();
    order.providerTxnId = providerTxnId || "MOCK_TXN_" + Date.now();
    if (rawPayload) {
      order.rawCallback = typeof rawPayload === "string" ? rawPayload : JSON.stringify(rawPayload);
    }
    await order.save({ transaction: t });

    await CrystalTransaction.create(
      {
        userId: order.userId,
        amount: totalAdded,
        transactionType: "DEPOSIT",
        description: `Nạp tự động #${order.orderCode} (${order.amountVnd.toLocaleString()}đ → +${order.crystals} + ${order.bonusCrystals} thưởng)`,
        balanceAfter: gam.worldCrystals,
      },
      { transaction: t }
    );

    await t.commit();

    // Kích hoạt tiến trình nhiệm vụ nếu có quest liên quan
    try {
      await triggerTaskProgress(order.userId, "DEPOSIT_CRYSTAL", 1);
    } catch (e) {}

    return {
      ok: true,
      alreadyPaid: false,
      order,
      addedCrystals: totalAdded,
      worldCrystals: gam.worldCrystals,
    };
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

// ─── 5. POST /api/vip/payment/webhook — Webhook tự động xác nhận thanh toán ────
router.post("/payment/webhook", optionalAuth, async (req, res) => {
  try {
    const { orderCode, transferContent, providerTxnId } = req.body;
    let code = orderCode;
    if (!code && transferContent) {
      const m = String(transferContent).match(/IRM[A-Z0-9]+/i);
      if (m) code = m[0].toUpperCase();
    }
    if (!code) {
      return res.status(400).json({ success: false, message: "Thiếu mã đơn orderCode" });
    }

    const result = await settlePaymentOrder(code, providerTxnId, req.body);
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, message: result.message });
    }

    return res.json({
      success: true,
      message: result.alreadyPaid
        ? "Đơn này đã được thanh toán trước đó."
        : `Nạp tự động thành công! +${result.addedCrystals.toLocaleString()} Tinh Thạch`,
      order: result.order,
      worldCrystals: result.worldCrystals,
    });
  } catch (err) {
    console.error("Lỗi webhook thanh toán:", err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi xử lý webhook" });
  }
});

// ─── 6. GET /api/vip/payment/order/:orderCode — Kiểm tra trạng thái đơn nạp ────
router.get("/payment/order/:orderCode", auth, async (req, res) => {
  try {
    const order = await PaymentOrder.findOne({
      where: { orderCode: req.params.orderCode, userId: req.user.id },
    });
    if (!order) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn thanh toán" });
    }

    if (
      order.status === "PENDING" &&
      order.expiresAt &&
      new Date(order.expiresAt).getTime() < Date.now()
    ) {
      order.status = "EXPIRED";
      await order.save();
    }

    const gam = await getOrCreateGam(req.user.id);
    res.json({
      success: true,
      order,
      worldCrystals: gam.worldCrystals,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi kiểm tra đơn thanh toán" });
  }
});

// ─── 7. GET /api/vip/payment/history — Lịch sử nạp của user (hoặc Admin) ──────
router.get("/payment/history", auth, async (req, res) => {
  try {
    const isUserAdmin = (req.user.role || "").toUpperCase() === "ADMIN" && req.query.all === "1";
    const where = isUserAdmin ? {} : { userId: req.user.id };
    const orders = await PaymentOrder.findAll({
      where,
      include: isUserAdmin
        ? [{ model: User, as: "user", attributes: ["id", "username", "email"] }]
        : [],
      order: [["created_at", "DESC"]],
      limit: 50,
    });
    res.json({ success: true, orders });
  } catch (err) {
    console.error("Lỗi lấy lịch sử nạp:", err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi lấy lịch sử nạp" });
  }
});

export default router;

