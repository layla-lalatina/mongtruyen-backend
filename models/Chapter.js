import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const Chapter = sequelize.define("Chapter", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  comicId: { type: DataTypes.INTEGER, field: "comic_id", allowNull: false },
  chapterNumber: {
    type: DataTypes.DECIMAL(10, 2),
    field: "chapter_number",
    allowNull: false,
    get() {
      const raw = this.getDataValue("chapterNumber");
      return raw !== null && raw !== undefined ? parseFloat(raw) : 0;
    },
  },
  chapterName: { type: DataTypes.STRING(255), field: "chapter_name", allowNull: true },
  views: { type: DataTypes.BIGINT, defaultValue: 0 },
  status: { type: DataTypes.ENUM("DRAFT", "PUBLISHED", "LOCKED"), defaultValue: "PUBLISHED" },
  publishedAt: { type: DataTypes.DATE, field: "published_at", defaultValue: DataTypes.NOW },
  createdAt: { type: DataTypes.DATE, field: "created_at" },
  updatedAt: { type: DataTypes.DATE, field: "updated_at" },
  // Cơ chế khóa chương (migration 20261101-01)
  unlockType: { type: DataTypes.ENUM("FREE", "CRYSTAL", "VIP"), field: "unlock_type", defaultValue: "FREE" },
  unlockPrice: { type: DataTypes.INTEGER, field: "unlock_price", defaultValue: 0 },
  freeAt: { type: DataTypes.DATE, field: "free_at", allowNull: true },

  // Virtual getter/setter for compatibility
  name: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.getDataValue("chapterName");
    },
    set(value) {
      this.setDataValue("chapterName", value);
    }
  }
}, {
  tableName: "chapters",
  underscored: true,
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
});
