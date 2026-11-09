import { sequelize } from "./config/database.js";

async function addGenderColumn() {
  try {
    await sequelize.authenticate();
    console.log("🔌 Kết nối MySQL thành công!");

    // Thêm cột gender vào bảng users nếu chưa tồn tại
    await sequelize.query("ALTER TABLE `users` ADD COLUMN `gender` VARCHAR(255) DEFAULT NULL;");
    console.log("✅ Đã thêm cột 'gender' vào bảng 'users' thành công!");
  } catch (err) {
    if (err.message.includes("duplicate column") || err.message.includes("already exists") || err.message.includes("Duplicate column name")) {
      console.log("ℹ️  Cột 'gender' đã tồn tại trong database.");
    } else {
      console.error("❌ Lỗi khi thêm cột 'gender':", err.message);
    }
  } finally {
    await sequelize.close();
    console.log("🔌 Đã ngắt kết nối database.");
  }
}

addGenderColumn();
