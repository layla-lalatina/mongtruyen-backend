import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const ChapterPage = sequelize.define("ChapterPage", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  chapterId: { type: DataTypes.INTEGER, field: "chapter_id", allowNull: false },
  pageNumber: { type: DataTypes.INTEGER, field: "page_number", allowNull: false },
  imageUrl: { type: DataTypes.STRING(500), field: "image_url", allowNull: false },
}, {
  tableName: "chapter_pages",
  underscored: true,
  timestamps: true,
  createdAt: "created_at",
  updatedAt: false,
});
