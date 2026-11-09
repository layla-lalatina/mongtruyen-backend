import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const ComicNotice = sequelize.define("ComicNotice", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  comicId: { type: DataTypes.INTEGER, field: "comic_id", allowNull: false },
  adminId: { type: DataTypes.INTEGER, field: "admin_id", allowNull: true },
  type: {
    type: DataTypes.ENUM("WARNING", "NOTE", "SPOILER", "HIATUS"),
    defaultValue: "NOTE",
  },
  severity: {
    type: DataTypes.ENUM("INFO", "WARN", "DANGER"),
    defaultValue: "INFO",
  },
  content: { type: DataTypes.TEXT, allowNull: false },
  isActive: { type: DataTypes.BOOLEAN, field: "is_active", defaultValue: true },
}, {
  tableName: "comic_notices",
  underscored: true,
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
});

