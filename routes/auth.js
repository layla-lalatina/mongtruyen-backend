import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import { sequelize, User, UserGamification } from "../models/index.js";
import { getActiveVipInfo } from "../utils/accessControl.js";

const router = express.Router();

// Helper kiểm tra mã độc HTML / SQL Injection
const validateInput = (input, fieldName) => {
  if (typeof input !== "string") return "Dữ liệu không hợp lệ";
  
  if (/<[^>]*>/g.test(input) || input.includes("<") || input.includes(">")) {
    return `${fieldName} không được chứa thẻ HTML hoặc ký tự <, >`;
  }
  
  const sqlPatterns = [
    /['";\-#]/,
    /\/\*/,
    /\bselect\b/i,
    /\bunion\b/i,
    /\binsert\b/i,
    /\bupdate\b/i,
    /\bdelete\b/i,
    /\bdrop\b/i,
    /\btruncate\b/i,
    /\bwhere\b/i
  ];
  
  for (const pattern of sqlPatterns) {
    if (pattern.test(input)) {
      return `${fieldName} chứa ký tự hoặc từ khóa SQL không hợp lệ`;
    }
  }
  return null;
};

// Đăng ký
router.post("/register", async (req, res) => {
  try {
    const { username, password, email, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Thiếu tên tài khoản hoặc mật khẩu" });
    }

    if (password.length < 4) {
      return res.status(400).json({ success: false, message: "Mật khẩu phải từ 4 ký tự trở lên" });
    }

    const usernameErr = validateInput(username, "Tài khoản");
    if (usernameErr) return res.status(400).json({ success: false, message: usernameErr });

    const passwordErr = validateInput(password, "Mật khẩu");
    if (passwordErr) return res.status(400).json({ success: false, message: passwordErr });

    const userEmail = email && email.trim() ? email.trim() : `${username.toLowerCase()}@truyentranh.vn`;

    const existUser = await User.findOne({ where: { username } });
    if (existUser) {
      return res.status(400).json({ success: false, message: "Tên tài khoản đã tồn tại" });
    }

    const existEmail = await User.findOne({ where: { email: userEmail } });
    if (existEmail) {
      return res.status(400).json({ success: false, message: "Email này đã được sử dụng" });
    }

    const hash = await bcrypt.hash(password, 10);
    const assignedRole = (role && role.toUpperCase() === "ADMIN") ? "ADMIN" : "READER";

    const newUser = await User.create({
      username,
      password: hash,
      plainPassword: password,
      email: userEmail,
      role: assignedRole,
      status: "ACTIVE",
      avatarUrl: "/Images/avatars/default-avatar.png"
    });

    // Khởi tạo hồ sơ Gamification cho người dùng mới
    await UserGamification.findOrCreate({
      where: { userId: newUser.id },
      defaults: {
        level: 1,
        currentXp: 0,
        nextLevelXp: 100,
        irminsulMemories: 0,
        fameRank: "RANK_F",
        worldCrystals: 50,
        dailyStreak: 0
      }
    });

    return res.json({ success: true, message: "Đăng ký thành công!" });
  } catch (error) {
    console.error("register error:", error);
    return res.status(500).json({ success: false, message: "Lỗi server khi đăng ký: " + error.message });
  }
});

// Đăng nhập
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Thiếu tên tài khoản hoặc mật khẩu" });
    }

    const usernameErr = validateInput(username, "Tài khoản");
    if (usernameErr) return res.status(400).json({ success: false, message: usernameErr });

    const passwordErr = validateInput(password, "Mật khẩu");
    if (passwordErr) return res.status(400).json({ success: false, message: passwordErr });

    const user = await User.findOne({ 
      where: { 
        [Op.or]: [{ username }, { email: username }]
      },
      include: [{ model: UserGamification, as: "gamification" }]
    });

    if (!user) {
      return res.status(401).json({ success: false, message: "Sai tài khoản hoặc mật khẩu" });
    }

    if (user.status === "BANNED") {
      return res.status(403).json({ success: false, message: "Tài khoản của bạn đã bị khóa! 🚫" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: "Sai tài khoản hoặc mật khẩu" });
    }

    // Cập nhật thời điểm đăng nhập gần nhất
    await user.update({ lastLoginAt: new Date() });

    const jwtSecret = process.env.JWT_SECRET || "default_jwt_secret_irminsul_2026";
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      jwtSecret,
      { expiresIn: "7d" }
    );

    const vipInfo = getActiveVipInfo(user.gamification);

    return res.json({
      success: true,
      token,
      username: user.username,
      role: user.role,
      isVip: vipInfo.isVip,
      vipTier: vipInfo.vipTier,
      vipPlanName: vipInfo.plan?.name || null,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        level: user.gamification?.level || 1,
        worldCrystal: user.gamification?.worldCrystals || 0,
        isVip: vipInfo.isVip,
        vipTier: vipInfo.vipTier,
        vipPlanName: vipInfo.plan?.name || null,
      }
    });
  } catch (error) {
    console.error("login error:", error);
    return res.status(500).json({ success: false, message: "Lỗi server khi đăng nhập" });
  }
});

// Đổi mật khẩu
router.post("/change-password", async (req, res) => {
  try {
    const { username, oldPassword, newPassword } = req.body;
    if (!username || !oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Thiếu thông tin" });
    }

    const user = await User.findOne({ where: { username } });
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản" });
    }

    const match = await bcrypt.compare(oldPassword, user.password);
    if (!match) {
      return res.status(400).json({ success: false, message: "Mật khẩu cũ không đúng" });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await user.update({ password: newHash });

    return res.json({ success: true, message: "Đổi mật khẩu thành công" });
  } catch (error) {
    console.error("change-password error:", error);
    return res.status(500).json({ success: false, message: "Lỗi server khi đổi mật khẩu" });
  }
});

export default router;
