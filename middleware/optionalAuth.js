// middleware/optionalAuth.js
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

/**
 * Middleware optionalAuth:
 * - Nếu có Header Authorization Bearer token hợp lệ -> gán req.user
 * - Nếu không có token hoặc token không hợp lệ -> gán req.user = null và vẫn tiếp tục next()
 */
export default async function (req, res, next) {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id);

    if (user && !user.isBanned) {
      req.user = decoded;
    } else {
      req.user = null;
    }
  } catch (err) {
    req.user = null;
  }

  next();
}
