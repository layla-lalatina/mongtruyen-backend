/**
 * 🌳 SYSTEM: IRMINSUL FANTASY RPG - IS TRANSLATOR MIDDLEWARE
 * ==========================================================
 * @file isTranslator.js
 * @path backend/middleware/isTranslator.js
 * @description Verifies if the authenticated user has translator or admin privileges.
 * ==========================================================
 */

export default function isTranslator(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Vui lòng đăng nhập" });
  }

  const role = (req.user.role || "").toLowerCase();
  if (role !== "translator" && role !== "admin") {
    return res.status(403).json({ message: "Chỉ Dịch Giả hoặc Admin mới có quyền truy cập" });
  }

  next();
}
