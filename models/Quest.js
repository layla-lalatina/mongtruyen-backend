import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const Quest = sequelize.define("Quest", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING(200), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
  questType: { type: DataTypes.ENUM("DAILY", "WEEKLY", "ACHIEVEMENT", "AI_DYNAMIC"), field: "quest_type", allowNull: false },
  targetAction: { type: DataTypes.STRING(100), field: "target_action", allowNull: false },
  targetCount: { type: DataTypes.INTEGER, field: "target_count", defaultValue: 1 },
  minLevel: { type: DataTypes.INTEGER, field: "min_level", defaultValue: 1 },
  minFameRank: { type: DataTypes.STRING(20), field: "min_fame_rank", defaultValue: "ALL" },
  rewardXp: { type: DataTypes.INTEGER, field: "reward_xp", defaultValue: 50 },
  rewardCrystals: { type: DataTypes.INTEGER, field: "reward_crystals", defaultValue: 10 },
  rewardMemories: { type: DataTypes.INTEGER, field: "reward_memories", defaultValue: 1 },
  isActive: { type: DataTypes.BOOLEAN, field: "is_active", defaultValue: true },
}, {
  tableName: "quests",
  underscored: true,
  timestamps: true,
  createdAt: "created_at",
  updatedAt: false,
});
