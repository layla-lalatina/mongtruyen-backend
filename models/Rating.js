import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const Rating = sequelize.define("Rating", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, field: "user_id", allowNull: false },
  comicId: { type: DataTypes.INTEGER, field: "comic_id", allowNull: false },
  stars: { type: DataTypes.TINYINT, allowNull: false, validate: { min: 1, max: 5 } },
  reviewText: { type: DataTypes.TEXT, field: "review_text", allowNull: true },
}, {
  tableName: "ratings",
  underscored: true,
  timestamps: true,
  createdAt: "created_at",
  updatedAt: false,
});

