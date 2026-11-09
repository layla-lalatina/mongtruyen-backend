// middleware/auth.js
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

export default async function (req, res, next) {
  // Lấy header Authorization
  const authHeader = req.headers["authorization"];

  // Nếu không có hoặc sai định dạng
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Thiếu hoặc sai định dạng token (Bearer required)" });
  }

  // Tách token ra khỏi chuỗi "Bearer ..."
  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Không tìm thấy token" });
  }

  try {
    // Giải mã token bằng JWT_SECRET
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Kiểm tra xem tài khoản có bị khóa (ban) trong DB không
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "Tài khoản không tồn tại trên hệ thống" });
    }
    if (user.isBanned) {
      return res.status(403).json({ message: "Tài khoản của bạn đã bị cấm khỏi hệ thống! 🚫" });
    }

    // Gán thông tin user vào request
    req.user = decoded;

    // Tiếp tục xử lý
    next();
  } catch (err) {
    return res.status(401).json({ message: `Token không hợp lệ: ${err.message}` });
  }
}
