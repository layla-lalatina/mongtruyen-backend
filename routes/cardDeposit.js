import express from "express";
import auth from "../middleware/auth.js";

const router = express.Router();

router.post("/request", auth, async (req, res) => {
  return res.json({
    success: false,
    message: "Hệ thống Cây Thế Giới Irminsul vận hành theo cơ chế cày cuốc RPG thuần túy. Bạn có thể kiếm Tinh Thạch (World Crystal) qua việc đọc truyện, điểm danh hằng ngày và làm nhiệm vụ!"
  });
});

export default router;
