import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const Comment = sequelize.define("Comment", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, field: "user_id", allowNull: false },
  comicId: { type: DataTypes.INTEGER, field: "comic_id", allowNull: false },
  chapterId: { type: DataTypes.INTEGER, field: "chapter_id", allowNull: true },
  parentCommentId: { type: DataTypes.INTEGER, field: "parent_comment_id", allowNull: true },
  content: { type: DataTypes.TEXT, allowNull: false },
  likesCount: { type: DataTypes.INTEGER, field: "likes_count", defaultValue: 0 },
  isSpoiler: { type: DataTypes.BOOLEAN, field: "is_spoiler", defaultValue: false },
  isHidden: { type: DataTypes.BOOLEAN, field: "is_hidden", defaultValue: false },
  isReported: { type: DataTypes.BOOLEAN, field: "is_reported", defaultValue: false },
  reportReason: { type: DataTypes.STRING(255), field: "report_reason", allowNull: true },
  reportCount: { type: DataTypes.INTEGER, field: "report_count", defaultValue: 0 },
  aiToxicityScore: { type: DataTypes.DECIMAL(3, 2), field: "ai_toxicity_score", defaultValue: 0.00 },
}, {
  tableName: "comments",
  underscored: true,
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
});