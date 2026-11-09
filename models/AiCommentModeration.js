import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const AiCommentModeration = sequelize.define("AiCommentModeration", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  commentId: { type: DataTypes.INTEGER, field: "comment_id", allowNull: false },
  toxicityScore: { type: DataTypes.DECIMAL(3, 2), field: "toxicity_score", allowNull: false },
  spamScore: { type: DataTypes.DECIMAL(3, 2), field: "spam_score", allowNull: false },
  flaggedReason: { type: DataTypes.STRING(255), field: "flagged_reason", allowNull: false },
  actionTaken: { type: DataTypes.ENUM("AUTO_HIDE", "FLAG_FOR_ADMIN", "PASSED"), field: "action_taken", allowNull: false },
  reviewedByAdminId: { type: DataTypes.INTEGER, field: "reviewed_by_admin_id", allowNull: true },
}, {
  tableName: "ai_comment_moderations",
  underscored: true,
  timestamps: true,
  createdAt: "created_at",
  updatedAt: false,
});
