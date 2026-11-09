import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const ChapterUnlock = sequelize.define("ChapterUnlock", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, field: "user_id", allowNull: false },
  chapterId: { type: DataTypes.INTEGER, field: "chapter_id", allowNull: false },
  method: {
    type: DataTypes.ENUM("CRYSTAL", "VIP", "ADMIN"),
    defaultValue: "CRYSTAL",
  },
  cost: { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  tableName: "chapter_unlocks",
  underscored: true,
  timestamps: true,
  createdAt: "created_at",
  updatedAt: false,
  indexes: [
    { unique: true, fields: ["user_id", "chapter_id"] }
  ]
});

