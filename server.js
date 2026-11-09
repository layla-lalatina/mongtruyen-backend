/**
 * 🌳 SYSTEM: IRMINSUL FANTASY RPG - BACKEND ENTRY POINT
 * ==========================================================
 * Chuẩn hóa 100% theo truyentranh.sql.
 * Lưu và phục vụ ảnh tĩnh trực tiếp từ: /Images
 * ==========================================================
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import compression from "compression";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

import { sequelize } from "./config/database.js";
import "./models/index.js";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js";
import commentRoutes from "./routes/commentRoutes.js";
import comicRoutes from "./routes/comic.js";
import aiRoutes from "./routes/ai.js";
import ratingRouter from "./routes/ratings.js";
import sqlAdminRoutes from "./routes/sqlAdmin.js";
import taskRoutes from "./routes/taskRoutes.js";
import quoteRoutes from "./routes/quoteRoutes.js";
import vipRoutes from "./routes/vip.js";
import depositRoutes from "./routes/deposit.js";
import cardDepositRoutes from "./routes/cardDeposit.js";
import { runMigrations } from "./migrate.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const IMAGES_DIR = path.join(__dirname, "..", "Images");

const app = express();
const PORT = process.env.PORT || 3001;

const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// Gzip nén dữ liệu
app.use(compression());

// CORS
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// JSON & URL-encoded với limit 100MB cho upload ảnh
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

// 🖼️ Phục vụ ảnh trực tiếp từ /Images (kèm fallback về default-cover.jpg nếu ảnh không tồn tại)
app.use("/Images", express.static(IMAGES_DIR));
app.use("/Images", (req, res) => {
  res.sendFile(path.join(IMAGES_DIR, "default-cover.jpg"));
});
app.use("/public", express.static(path.join(__dirname, "public")));

// Force UTF-8 response
app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function (body) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return originalJson.call(this, body);
  };
  next();
});

// Routers
app.use("/api", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/comment", commentRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/comic", comicRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/sql", sqlAdminRoutes);
app.use("/api/ratings", ratingRouter);
app.use("/api/tasks", taskRoutes);
app.use("/api/admin/tasks", taskRoutes);
app.use("/api/quotes", quoteRoutes);
app.use("/api/vip", vipRoutes);
app.use("/api/deposit", depositRoutes);
app.use("/api/card-deposit", cardDepositRoutes);

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ message: "API endpoint không tồn tại." });
});

// General error handler
app.use((err, req, res, next) => {
  console.error("❌ Lỗi không mong đợi:", err);
  res.status(500).json({ message: "Đã xảy ra lỗi server." });
});

// Kết nối MySQL với cơ chế tự động thử lại nếu XAMPP MySQL đang khởi động
async function waitForMysqlConnection(maxRetries = 10) {
  for (let i = 1; i <= maxRetries; i++) {
    try {
      await sequelize.authenticate();
      return true;
    } catch (err) {
      if (i === maxRetries) throw err;
      console.log(`⏳ Đang chờ MySQL (3306) sẵn sàng... (Lần thử ${i}/${maxRetries})`);
      await new Promise((r) => setTimeout(r, 2500));
    }
  }
}

// Khởi chạy server
(async () => {
  app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
    console.log(`📁 Thư mục lưu trữ hình ảnh: ${IMAGES_DIR}`);
  });

  try {
    await waitForMysqlConnection();
    console.log("✅ Kết nối MySQL thành công!");

    // Đồng bộ models nếu bảng chưa có, không ép alter để giữ chuẩn truyentranh.sql
    await sequelize.sync();
    await runMigrations();
    console.log("✅ Hệ thống CSDL Cây Thế Giới Irminsul sẵn sàng!");
  } catch (err) {
    console.error("❌ Lỗi kết nối MySQL:", err.message);
  }
})();
