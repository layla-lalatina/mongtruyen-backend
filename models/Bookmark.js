import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const Bookmark = sequelize.define("Bookmark", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, field: "user_id", allowNull: false },
  comicId: { type: DataTypes.INTEGER, field: "comic_id", allowNull: false },
  notifyNewChapter: { type: DataTypes.BOOLEAN, field: "notify_new_chapter", defaultValue: true },
}, {
  tableName: "bookmarks",
  underscored: true,
  timestamps: true,
  createdAt: "created_at",
  updatedAt: false,
});

