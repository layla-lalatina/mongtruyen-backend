import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const ReadingHistory = sequelize.define("ReadingHistory", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, field: "user_id", allowNull: false },
  comicId: { type: DataTypes.INTEGER, field: "comic_id", allowNull: false },
  lastChapterId: { type: DataTypes.INTEGER, field: "last_chapter_id", allowNull: false },
  lastPageNumber: { type: DataTypes.INTEGER, field: "last_page_number", defaultValue: 1 },
}, {
  tableName: "reading_histories",
  underscored: true,
  timestamps: true,
  createdAt: false,
  updatedAt: "updated_at",
});

