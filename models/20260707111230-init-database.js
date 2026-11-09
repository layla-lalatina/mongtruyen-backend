'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const rawQueries = [
      // 1. users
      `CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`username\` varchar(255) NOT NULL,
        \`password\` varchar(255) NOT NULL,
        \`email\` varchar(255) DEFAULT NULL,
        \`role\` enum('admin','member') DEFAULT 'member',
        \`nameColor\` varchar(255) DEFAULT NULL,
        \`nameEffect\` varchar(255) DEFAULT NULL,
        \`avatarFrame\` varchar(255) DEFAULT NULL,
        \`avatarUrl\` varchar(255) DEFAULT NULL,
        \`badge\` varchar(255) DEFAULT NULL,
        \`isBanned\` tinyint(1) DEFAULT 0,
        \`createdAt\` datetime NOT NULL,
        \`updatedAt\` datetime NOT NULL,
        \`worldCrystal\` int(11) DEFAULT 0,
        \`level\` int(11) DEFAULT 1,
        \`irminsulMemory\` int(11) DEFAULT 0,
        \`triThuc\` int(11) DEFAULT 0,
        \`danhTieng\` int(11) DEFAULT 0,
        \`uyTin\` int(11) DEFAULT 0,
        \`danhVong\` varchar(255) DEFAULT 'F',
        \`khuVuc\` varchar(255) DEFAULT 'Đồng Cỏ Ánh Sao',
        \`titles\` text DEFAULT NULL,
        \`inventory\` text DEFAULT NULL,
        \`lastLoginDate\` varchar(255) DEFAULT NULL,
        \`gender\` varchar(255) DEFAULT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`username\` (\`username\`)
      ) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      // 2. comics
      `CREATE TABLE IF NOT EXISTS \`comics\` (
        \`slug\` varchar(255) NOT NULL,
        \`name\` varchar(255) DEFAULT NULL,
        \`followers\` int(11) DEFAULT 0,
        \`views\` int(11) DEFAULT 0,
        \`rating\` int(11) DEFAULT 0,
        \`createdAt\` datetime NOT NULL,
        \`updatedAt\` datetime NOT NULL,
        \`author\` varchar(255) DEFAULT 'Đang cập nhật',
        \`description\` text DEFAULT NULL,
        \`thumbUrl\` varchar(255) DEFAULT NULL,
        \`status\` varchar(255) DEFAULT 'ongoing',
        \`categories\` text DEFAULT NULL,
        \`originName\` text DEFAULT NULL,
        \`subDocTruyen\` varchar(255) DEFAULT NULL,
        \`apiUpdatedAt\` varchar(255) DEFAULT NULL,
        \`totalChapters\` int(11) DEFAULT 0,
        \`soChuong\` varchar(255) DEFAULT '0 chương',
        PRIMARY KEY (\`slug\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      // 3. achievements
      `CREATE TABLE IF NOT EXISTS \`achievements\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`code\` varchar(255) NOT NULL,
        \`category\` varchar(255) NOT NULL,
        \`title\` varchar(255) NOT NULL,
        \`description\` varchar(255) DEFAULT NULL,
        \`conditionValue\` int(11) NOT NULL,
        \`rewardXp\` int(11) DEFAULT 0,
        \`rewardCrystal\` int(11) DEFAULT 0,
        \`createdAt\` datetime NOT NULL,
        \`updatedAt\` datetime NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`code\` (\`code\`)
      ) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      // 4. areas
      `CREATE TABLE IF NOT EXISTS \`areas\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`name\` varchar(255) NOT NULL,
        \`minLevel\` int(11) NOT NULL,
        \`tier\` varchar(255) NOT NULL,
        \`createdAt\` datetime NOT NULL,
        \`updatedAt\` datetime NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`name\` (\`name\`)
      ) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      // 5. level_titles
      `CREATE TABLE IF NOT EXISTS \`level_titles\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`minLevel\` int(11) NOT NULL,
        \`maxLevel\` int(11) NOT NULL,
        \`title\` varchar(255) NOT NULL,
        \`createdAt\` datetime NOT NULL,
        \`updatedAt\` datetime NOT NULL,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      // 6. reputations
      `CREATE TABLE IF NOT EXISTS \`reputations\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`rank\` varchar(255) NOT NULL,
        \`minMemory\` int(11) NOT NULL,
        \`title\` varchar(255) NOT NULL,
        \`createdAt\` datetime NOT NULL,
        \`updatedAt\` datetime NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`rank\` (\`rank\`)
      ) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      // 7. ai_chat_histories
      `CREATE TABLE IF NOT EXISTS \`ai_chat_histories\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`userId\` int(11) NOT NULL,
        \`role\` enum('user','model') NOT NULL,
        \`text\` text NOT NULL,
        \`createdAt\` datetime NOT NULL,
        \`updatedAt\` datetime NOT NULL,
        \`modelUsed\` varchar(255) DEFAULT 'gemini-2.5-flash',
        PRIMARY KEY (\`id\`),
        KEY \`userId\` (\`userId\`),
        CONSTRAINT \`ai_chat_histories_ibfk_1\` FOREIGN KEY (\`userId\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      // 8. comments
      `CREATE TABLE IF NOT EXISTS \`comments\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`userId\` int(11) NOT NULL,
        \`comicSlug\` varchar(255) NOT NULL,
        \`content\` text NOT NULL,
        \`displayName\` varchar(255) DEFAULT NULL,
        \`avatarFrame\` varchar(255) DEFAULT NULL,
        \`realm\` varchar(255) DEFAULT NULL,
        \`nameColor\` varchar(255) DEFAULT NULL,
        \`nameEffect\` varchar(255) DEFAULT NULL,
        \`isPinned\` tinyint(1) DEFAULT 0,
        \`replyTo\` int(11) DEFAULT NULL,
        \`createdAt\` datetime NOT NULL,
        \`updatedAt\` datetime NOT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`comments_user_idx\` (\`userId\`),
        KEY \`comments_comic_idx\` (\`comicSlug\`),
        KEY \`comments_reply_fk\` (\`replyTo\`),
        CONSTRAINT \`comments_comic_fk\` FOREIGN KEY (\`comicSlug\`) REFERENCES \`comics\` (\`slug\`) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT \`comments_ibfk_1\` FOREIGN KEY (\`userId\`) REFERENCES \`users\` (\`id\`) ON DELETE NO ACTION ON UPDATE CASCADE,
        CONSTRAINT \`comments_reply_fk\` FOREIGN KEY (\`replyTo\`) REFERENCES \`comments\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      // 9. commentlikes
      `CREATE TABLE IF NOT EXISTS \`commentlikes\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`userId\` int(11) NOT NULL,
        \`commentId\` int(11) NOT NULL,
        \`createdAt\` datetime NOT NULL,
        \`updatedAt\` datetime NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`comment_likes_user_id_comment_id\` (\`userId\`,\`commentId\`),
        KEY \`commentId\` (\`commentId\`),
        CONSTRAINT \`commentlikes_ibfk_69\` FOREIGN KEY (\`userId\`) REFERENCES \`users\` (\`id\`) ON DELETE NO ACTION ON UPDATE CASCADE,
        CONSTRAINT \`commentlikes_ibfk_70\` FOREIGN KEY (\`commentId\`) REFERENCES \`comments\` (\`id\`) ON DELETE NO ACTION ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;`,

      // 10. comicratings
      `CREATE TABLE IF NOT EXISTS \`comicratings\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`comicSlug\` varchar(255) NOT NULL,
        \`userId\` int(11) NOT NULL,
        \`rating\` int(11) NOT NULL,
        \`comment\` text DEFAULT NULL,
        \`createdAt\` datetime NOT NULL,
        \`updatedAt\` datetime NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`comicratings_user_comic_unique\` (\`userId\`,\`comicSlug\`),
        KEY \`comicratings_comic_idx\` (\`comicSlug\`),
        CONSTRAINT \`comicratings_ibfk_209\` FOREIGN KEY (\`comicSlug\`) REFERENCES \`comics\` (\`slug\`) ON DELETE NO ACTION ON UPDATE CASCADE,
        CONSTRAINT \`comicratings_ibfk_210\` FOREIGN KEY (\`userId\`) REFERENCES \`users\` (\`id\`) ON DELETE NO ACTION ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      // 11. deposits
      `CREATE TABLE IF NOT EXISTS \`deposits\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`userId\` int(11) NOT NULL,
        \`amount\` int(11) NOT NULL,
        \`price\` int(11) NOT NULL,
        \`method\` enum('bank','momo','zalopay','card') NOT NULL DEFAULT 'bank',
        \`status\` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
        \`cardType\` varchar(255) DEFAULT NULL,
        \`cardSerial\` varchar(255) DEFAULT NULL,
        \`cardCode\` varchar(255) DEFAULT NULL,
        \`createdAt\` datetime NOT NULL,
        \`updatedAt\` datetime NOT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`deposits_user_idx\` (\`userId\`),
        CONSTRAINT \`deposits_ibfk_1\` FOREIGN KEY (\`userId\`) REFERENCES \`users\` (\`id\`) ON DELETE NO ACTION ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      // 12. followedcomics
      `CREATE TABLE IF NOT EXISTS \`followedcomics\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`userId\` int(11) NOT NULL,
        \`comicSlug\` varchar(255) NOT NULL,
        \`createdAt\` datetime NOT NULL,
        \`updatedAt\` datetime NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`followed_user_comic_unique\` (\`userId\`,\`comicSlug\`),
        KEY \`followed_comic_idx\` (\`comicSlug\`),
        CONSTRAINT \`followed_user_fk\` FOREIGN KEY (\`userId\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT \`followedcomics_ibfk_1\` FOREIGN KEY (\`comicSlug\`) REFERENCES \`comics\` (\`slug\`) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      // 13. readinghistories
      `CREATE TABLE IF NOT EXISTS \`readinghistories\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`userId\` int(11) NOT NULL,
        \`comicSlug\` varchar(255) NOT NULL,
        \`chapter\` varchar(255) NOT NULL,
        \`updatedAt\` datetime NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`history_user_comic_unique\` (\`userId\`,\`comicSlug\`),
        KEY \`history_comic_idx\` (\`comicSlug\`),
        CONSTRAINT \`history_user_fk\` FOREIGN KEY (\`userId\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT \`readinghistories_ibfk_1\` FOREIGN KEY (\`comicSlug\`) REFERENCES \`comics\` (\`slug\`) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
    ];

    for (const sql of rawQueries) {
      await queryInterface.sequelize.query(sql);
    }
  },

  async down (queryInterface, Sequelize) {
    const tables = [
      "readinghistories",
      "followedcomics",
      "deposits",
      "comicratings",
      "commentlikes",
      "comments",
      "ai_chat_histories",
      "reputations",
      "level_titles",
      "areas",
      "achievements",
      "comics",
      "users"
    ];
    for (const table of tables) {
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS \`${table}\`;`);
    }
  }
};
