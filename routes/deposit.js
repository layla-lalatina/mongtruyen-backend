import express from "express";
import auth from "../middleware/auth.js";
import isAdmin from "../middleware/isAdmin.js";
import { User, PaymentOrder } from "../models/index.js";
import { settlePaymentOrder } from "./vip.js";
import { VND_PER_CRYSTAL } from "../config/monetization.js";

const router = express.Router();

function formatOrderForLegacyUI(o) {
  const statusMap = {
    PAID: "approved",
    PENDING: "pending",
    FAILED: "rejected",
    CANCELLED: "rejected",
    EXPIRED: "rejected",
  };
  return {
    id: o.id,
    orderCode: o.orderCode,
    User: o.user ? { id: o.user.id, username: o.user.username } : { username: `User #${o.userId}` },
    amount: Number(o.crystals) + Number(o.bonusCrystals || 0),
    crystals: o.crystals,
    bonusCrystals: o.bonusCrystals,
    price: o.amountVnd,
    method: o.method,
    status: statusMap[o.status] || "pending",
    rawStatus: o.status,
    createdAt: o.createdAt,
    paidAt: o.paidAt,
  };
}

// Tạo & tự động xử lý đơn nạp nếu gọi qua endpoint cũ
router.post("/request", auth, async (req, res) => {
  try {
    const { amount = 500, method = "BANK" } = req.body;
    const crystals = Math.max(10, parseInt(amount, 10) || 100);
    const amountVnd = crystals * VND_PER_CRYSTAL;
    const orderCode =
      "IRM" +
      Date.now().toString(36).toUpperCase() +
      Math.random().toString(36).substring(2, 5).toUpperCase();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await PaymentOrder.create({
      orderCode,
      userId: req.user.id,
      provider: "MOCK_AUTO",
      method: String(method).toUpperCase(),
      amountVnd,
      crystals,
      bonusCrystals: 0,
      status: "PENDING",
      expiresAt,
    });

    const settled = await settlePaymentOrder(orderCode, "AUTO_INSTANT");
    return res.json({
      success: true,
      message: `Nạp tự động thành công +${crystals.toLocaleString()} Tinh Thạch!`,
      worldCrystals: settled.worldCrystals,
      orderCode,
    });
  } catch (err) {
    console.error("Lỗi /deposit/request:", err);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ khi xử lý nạp" });
  }
});

router.post("/approve/:id", auth, isAdmin, async (req, res) => {
  try {
    const order = await PaymentOrder.findByPk(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Không tìm thấy đơn" });
    const result = await settlePaymentOrder(order.orderCode, `ADMIN_${req.user.id}`);
    if (!result.ok) {
      return res.status(400).json({ success: false, message: result.message });
    }
    return res.json({ success: true, message: "Đã duyệt và cộng Tinh Thạch!" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi duyệt đơn" });
  }
});

router.post("/reject/:id", auth, isAdmin, async (req, res) => {
  try {
    const order = await PaymentOrder.findByPk(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Không tìm thấy đơn" });
    if (order.status === "PAID") {
      return res.status(400).json({ success: false, message: "Đơn đã thanh toán, không thể từ chối" });
    }
    order.status = "CANCELLED";
    await order.save();
    return res.json({ success: true, message: "Đã từ chối yêu cầu." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi từ chối đơn" });
  }
});

router.get("/", auth, isAdmin, async (req, res) => {
  try {
    const orders = await PaymentOrder.findAll({
      include: [{ model: User, as: "user", attributes: ["id", "username", "email"] }],
      order: [["created_at", "DESC"]],
      limit: 100,
    });
    res.json({ success: true, deposits: orders.map(formatOrderForLegacyUI) });
  } catch (err) {
    console.error("Lỗi GET /api/deposit:", err);
    res.json({ success: true, deposits: [] });
  }
});

router.get("/user/:userId", auth, async (req, res) => {
  try {
    const orders = await PaymentOrder.findAll({
      where: { userId: req.params.userId },
      order: [["created_at", "DESC"]],
      limit: 50,
    });
    res.json({ success: true, deposits: orders.map(formatOrderForLegacyUI) });
  } catch (err) {
    res.json({ success: true, deposits: [] });
  }
});

export default router;
