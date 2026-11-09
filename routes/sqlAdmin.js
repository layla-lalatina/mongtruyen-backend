/**
 * 🌳 SYSTEM: IRMINSUL FANTASY RPG - SQL ADMINISTRATIVE ROUTES
 * ==========================================================
 * @file sqlAdmin.js
 * @path backend/routes/sqlAdmin.js
 * @description Admin endpoints for direct database query execution and table inspection.
 * @endpoints GET /api/sql/tables, GET /api/sql/tables/:tableName, POST /api/sql/query
 * ==========================================================
 */

import express from "express";
import bcrypt from "bcryptjs";
import auth from "../middleware/auth.js";
import isAdmin from "../middleware/isAdmin.js";
import { sequelize } from "../config/database.js";

const router = express.Router();

// 1. GET /api/sql/tables — Liệt kê tất cả các bảng trong CSDL
router.get("/tables", auth, isAdmin, async (req, res) => {
  try {
    const [results] = await sequelize.query("SHOW TABLES");
    const tables = results.map((row) => Object.values(row)[0]);
    res.json({ success: true, tables });
  } catch (error) {
    console.error("Lỗi lấy danh sách bảng:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi lấy danh sách bảng" });
  }
});

// 2. GET /api/sql/tables/:tableName — Lấy cấu trúc schema và dữ liệu hàng của bảng
router.get("/tables/:tableName", auth, isAdmin, async (req, res) => {
  const { tableName } = req.params;
  try {
    // 1. Lấy cấu trúc cột (Describe)
    const [schema] = await sequelize.query(`DESCRIBE \`${tableName}\``);
    
    // 2. Lấy dữ liệu (giới hạn 300 hàng để tránh lag)
    const [rows] = await sequelize.query(`SELECT * FROM \`${tableName}\` LIMIT 300`);
    
    res.json({ success: true, schema, rows });
  } catch (error) {
    console.error(`Lỗi lấy dữ liệu bảng ${tableName}:`, error);
    res.status(500).json({ success: false, message: `Lỗi khi lấy dữ liệu bảng ${tableName}` });
  }
});

// 3. POST /api/sql/tables/:tableName/edit — Chỉnh sửa một hàng dữ liệu
router.post("/tables/:tableName/edit", auth, isAdmin, async (req, res) => {
  const { tableName } = req.params;
  const { primaryKeyField, primaryKeyValue, updatedFields } = req.body;

  if (!primaryKeyField || primaryKeyValue === undefined || !updatedFields) {
    return res.status(400).json({ success: false, message: "Thiếu thông tin cập nhật" });
  }

  try {
    // Nếu bảng là users: đảm bảo cột password luôn là bcrypt hash và plain_password lưu mật khẩu chưa hash
    if (tableName.toLowerCase() === "users") {
      if (updatedFields.plain_password && String(updatedFields.plain_password).trim()) {
        const rawPass = String(updatedFields.plain_password).trim();
        updatedFields.plain_password = rawPass;
        updatedFields.password = await bcrypt.hash(rawPass, 10);
      } else if (updatedFields.password) {
        const rawPass = String(updatedFields.password).trim();
        // Nếu nhập mật khẩu thô vào cột password
        if (!rawPass.startsWith("$2b$") && !rawPass.startsWith("$2a$")) {
          updatedFields.plain_password = rawPass;
          updatedFields.password = await bcrypt.hash(rawPass, 10);
        }
      }
    }

    const keys = Object.keys(updatedFields);
    if (keys.length === 0) {
      return res.json({ success: true, message: "Không có trường nào để cập nhật" });
    }

    const setClause = keys.map((k) => `\`${k}\` = :${k}`).join(", ");
    
    await sequelize.query(
      `UPDATE \`${tableName}\` SET ${setClause} WHERE \`${primaryKeyField}\` = :primaryKeyValue`,
      {
        replacements: { ...updatedFields, primaryKeyValue }
      }
    );

    res.json({ success: true, message: "Cập nhật hàng thành công!" });
  } catch (error) {
    console.error(`Lỗi cập nhật bảng ${tableName}:`, error);
    res.status(500).json({ success: false, message: `Lỗi khi cập nhật bảng: ${error.message}` });
  }
});

// 3.1 POST /api/sql/reset-password — Đặt lại mật khẩu nhanh cho tài khoản
router.post("/reset-password", auth, isAdmin, async (req, res) => {
  const { userId, newPassword = "123456" } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, message: "Thiếu ID người dùng" });
  }
  try {
    const rawPass = String(newPassword).trim();
    const hash = await bcrypt.hash(rawPass, 10);
    await sequelize.query(
      "UPDATE `users` SET `password` = :hash, `plain_password` = :rawPass WHERE `id` = :userId",
      { replacements: { hash, rawPass, userId } }
    );
    res.json({
      success: true,
      message: `Đã đặt lại mật khẩu cho tài khoản (ID: ${userId}) thành: ${rawPass}`,
      plainPassword: rawPass,
      hash
    });
  } catch (error) {
    console.error("Lỗi đặt lại mật khẩu:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. POST /api/sql/tables/:tableName/delete-row — Xóa một hàng dữ liệu cụ thể
router.post("/tables/:tableName/delete-row", auth, isAdmin, async (req, res) => {
  const { tableName } = req.params;
  const { primaryKeyField, primaryKeyValue } = req.body;

  if (!primaryKeyField || primaryKeyValue === undefined) {
    return res.status(400).json({ success: false, message: "Thiếu thông tin khóa chính hàng" });
  }

  try {
    await sequelize.query(
      `DELETE FROM \`${tableName}\` WHERE \`${primaryKeyField}\` = :primaryKeyValue`,
      {
        replacements: { primaryKeyValue }
      }
    );
    res.json({ success: true, message: "Đã xóa hàng dữ liệu thành công!" });
  } catch (error) {
    console.error(`Lỗi xóa hàng bảng ${tableName}:`, error);
    res.status(500).json({ success: false, message: `Lỗi khi xóa hàng: ${error.message}` });
  }
});

// 5. POST /api/sql/tables/:tableName/truncate — Xóa sạch toàn bộ dữ liệu bảng
router.post("/tables/:tableName/truncate", auth, isAdmin, async (req, res) => {
  const { tableName } = req.params;
  try {
    await sequelize.query("SET FOREIGN_KEY_CHECKS = 0;");
    await sequelize.query(`TRUNCATE TABLE \`${tableName}\`;`);
    await sequelize.query("SET FOREIGN_KEY_CHECKS = 1;");
    
    res.json({ success: true, message: `Đã làm sạch (truncate) toàn bộ dữ liệu bảng ${tableName}!` });
  } catch (error) {
    console.error(`Lỗi làm sạch bảng ${tableName}:`, error);
    res.status(500).json({ success: false, message: `Lỗi khi làm sạch dữ liệu bảng: ${error.message}` });
  }
});

export default router;
