export default function isAdmin(req, res, next) {
  const role = (req.user?.role || "").toLowerCase();
  if (role === "admin") {
    return next();
  }
  return res.status(403).json({ message: "Bạn không có quyền admin." });
}
