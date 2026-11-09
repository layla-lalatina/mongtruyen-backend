-- =====================================================================
-- MIGRATION 2026-11-01 #01 : VIP, KHÓA CHƯƠNG, NHÃN ĐỘ TUỔI, CẢNH BÁO TRUYỆN,
--                            NẠP TỰ ĐỘNG (CỔNG GIẢ LẬP)
-- Chạy bằng:  cd backend && node migrate.js
-- (migrate.js tự kiểm tra cột/bảng đã tồn tại => chạy lại nhiều lần an toàn)
-- File SQL này để tham khảo / import tay qua phpMyAdmin nếu cần.
-- =====================================================================

-- 1. Nhãn độ tuổi cho truyện
ALTER TABLE comics ADD COLUMN age_rating ENUM('ALL','13+','16+','18+') NOT NULL DEFAULT 'ALL';

-- 2. Cơ chế khóa chương
ALTER TABLE chapters
  ADD COLUMN unlock_type ENUM('FREE','CRYSTAL','VIP') NOT NULL DEFAULT 'FREE',
  ADD COLUMN unlock_price INT NOT NULL DEFAULT 0,
  ADD COLUMN free_at DATETIME NULL;

-- 3. VIP
ALTER TABLE user_gamification
  ADD COLUMN vip_tier TINYINT NOT NULL DEFAULT 0,
  ADD COLUMN vip_expires_at DATETIME NULL;

-- 4. Năm sinh (xác nhận độ tuổi)
ALTER TABLE users ADD COLUMN birth_year SMALLINT NULL;

-- 5. Mở rộng loại giao dịch Tinh Thạch
ALTER TABLE crystal_transactions MODIFY COLUMN transaction_type
  ENUM('QUEST_REWARD','DAILY_CHECKIN','LEVEL_UP','SHOP_PURCHASE','ADMIN_ADJUST',
       'CHAPTER_UNLOCK','VIP_PURCHASE','DEPOSIT') NOT NULL;

-- 6. Lịch sử mở khóa chương
CREATE TABLE IF NOT EXISTS chapter_unlocks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  chapter_id INT NOT NULL,
  method ENUM('CRYSTAL','VIP','ADMIN') NOT NULL DEFAULT 'CRYSTAL',
  cost INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_chapter (user_id, chapter_id),
  CONSTRAINT fk_cu_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_cu_chapter FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Cảnh báo / ghi chú của Admin cho từng bộ truyện
CREATE TABLE IF NOT EXISTS comic_notices (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Đơn nạp tiền (cổng thanh toán – hiện là MOCK, sau này thay SePay/VNPay)
CREATE TABLE IF NOT EXISTS payment_orders (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

