import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const UserQuest = sequelize.define("UserQuest", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, field: "user_id", allowNull: false },
  questId: { type: DataTypes.INTEGER, field: "quest_id", allowNull: false },
  currentCount: { type: DataTypes.INTEGER, field: "current_count", defaultValue: 0 },
  isCompleted: { type: DataTypes.BOOLEAN, field: "is_completed", defaultValue: false },
  isClaimed: { type: DataTypes.BOOLEAN, field: "is_claimed", defaultValue: false },
  assignedDate: { type: DataTypes.DATEONLY, field: "assigned_date", allowNull: false },
  claimedAt: { type: DataTypes.DATE, field: "claimed_at", allowNull: true },
}, {
  tableName: "user_quests",
  underscored: true,
  timestamps: false,
});
