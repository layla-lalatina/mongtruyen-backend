import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const CommentLike = sequelize.define("CommentLike", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, field: "user_id", allowNull: false },
  commentId: { type: DataTypes.INTEGER, field: "comment_id", allowNull: false },
}, {
  tableName: "comment_likes",
  underscored: true,
  timestamps: true,
  createdAt: "created_at",
  updatedAt: false,
});
