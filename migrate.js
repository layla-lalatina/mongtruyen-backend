/**
 * 🌳 IRMINSUL - MIGRATION RUNNER (idempotent)
 * ==========================================================
 * Có thể chạy độc lập:  cd backend && node migrate.js
 * Hoặc tự động chạy khi khởi động server.js
 * Tự kiểm tra cột / bảng đã tồn tại trước khi ALTER/CREATE
 * => chạy lại nhiều lần không lỗi, không mất dữ liệu.
 * ==========================================================
 */
import dotenv from "dotenv";
dotenv.config();
import { fileURLToPath } from "url";
import { sequelize } from "./config/database.js";

const q = (sql, replacements = {}) =>
  sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });

async function columnExists(table, column) {
  const rows = await q(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column`,
    { table, column }
  );
  return Number(rows[0].c) > 0;
}

async function addColumn(table, column, definition) {
  if (await columnExists(table, column)) {
    return false;
  }
  await sequelize.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  console.log(`  ✓ Thêm cột ${table}.${column}`);
  return true;
}

const STEPS = [
  ["Nhãn độ tuổi", async () => {
    await addColumn("comics", "age_rating", "ENUM('ALL','13+','16+','18+') NOT NULL DEFAULT 'ALL'");
  }],
  ["Khóa chương", async () => {
    await addColumn("chapters", "unlock_type", "ENUM('FREE','CRYSTAL','VIP') NOT NULL DEFAULT 'FREE'");
    await addColumn("chapters", "unlock_price", "INT NOT NULL DEFAULT 0");
    await addColumn("chapters", "free_at", "DATETIME NULL");
  }],
  ["VIP", async () => {
    await addColumn("user_gamification", "vip_tier", "TINYINT NOT NULL DEFAULT 0");
    await addColumn("user_gamification", "vip_expires_at", "DATETIME NULL");
  }],
  ["Năm sinh", async () => {
    await addColumn("users", "birth_year", "SMALLINT NULL");
  }],
  ["Loại giao dịch Tinh Thạch", async () => {
    try {
      await sequelize.query(`ALTER TABLE crystal_transactions MODIFY COLUMN transaction_type
        ENUM('QUEST_REWARD','DAILY_CHECKIN','LEVEL_UP','SHOP_PURCHASE','ADMIN_ADJUST',
             'CHAPTER_UNLOCK','VIP_PURCHASE','DEPOSIT') NOT NULL`);
    } catch (e) {
      // Bỏ qua nếu bảng chưa tạo
    }
  }],
  ["Bảng chapter_unlocks", async () => {
    await sequelize.query(`CREATE TABLE IF NOT EXISTS chapter_unlocks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      chapter_id INT NOT NULL,
      method ENUM('CRYSTAL','VIP','ADMIN') NOT NULL DEFAULT 'CRYSTAL',
      cost INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_chapter (user_id, chapter_id),
      CONSTRAINT fk_cu_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_cu_chapter FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }],
  ["Bảng comic_notices", async () => {
    await sequelize.query(`CREATE TABLE IF NOT EXISTS comic_notices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      comic_id INT NOT NULL,
      admin_id INT NULL,
      type ENUM('WARNING','NOTE','SPOILER','HIATUS') NOT NULL DEFAULT 'NOTE',
      severity ENUM('INFO','WARN','DANGER') NOT NULL DEFAULT 'INFO',
      content TEXT NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_cn_comic FOREIGN KEY (comic_id) REFERENCES comics(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }],
  ["Bảng payment_orders", async () => {
    await sequelize.query(`CREATE TABLE IF NOT EXISTS payment_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_code VARCHAR(40) NOT NULL UNIQUE,
      user_id INT NOT NULL,
      provider VARCHAR(20) NOT NULL DEFAULT 'MOCK',
      method VARCHAR(20) NOT NULL DEFAULT 'BANK',
      amount_vnd INT NOT NULL,
      crystals INT NOT NULL,
      bonus_crystals INT NOT NULL DEFAULT 0,
      status ENUM('PENDING','PAID','FAILED','EXPIRED','CANCELLED') NOT NULL DEFAULT 'PENDING',
      provider_txn_id VARCHAR(100) NULL,
      paid_at DATETIME NULL,
      expires_at DATETIME NOT NULL,
      raw_callback TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_po_user (user_id),
      CONSTRAINT fk_po_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }],
];

export async function runMigrations() {
  for (const [, fn] of STEPS) {
    await fn();
  }
  console.log("✅ Đã đồng bộ schema (VIP, Khóa chương, Độ tuổi, Cảnh báo, Nạp tự động)!");
}

// Nếu gọi trực tiếp bằng `node migrate.js`
const isDirect = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirect) {
  (async () => {
    try {
      await sequelize.authenticate();
      await runMigrations();
      process.exit(0);
    } catch (err) {
      console.error("❌ Migration lỗi:", err.message);
      process.exit(1);
    }
  })();
}
