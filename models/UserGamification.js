import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const UserGamification = sequelize.define("UserGamification", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, field: "user_id", allowNull: false, unique: true },
  level: { type: DataTypes.INTEGER, defaultValue: 1 },
  currentXp: { type: DataTypes.INTEGER, field: "current_xp", defaultValue: 0 },
  nextLevelXp: { type: DataTypes.INTEGER, field: "next_level_xp", defaultValue: 100 },
  irminsulMemories: { type: DataTypes.INTEGER, field: "irminsul_memories", defaultValue: 0 },
  fameRank: {
    type: DataTypes.ENUM("RANK_F", "RANK_E", "RANK_D", "RANK_C", "RANK_B", "RANK_A", "RANK_S", "RANK_SS", "RANK_SSS", "RANK_EX"),
    field: "fame_rank",
    defaultValue: "RANK_F"
  },
  worldCrystals: { type: DataTypes.INTEGER, field: "world_crystals", defaultValue: 0 },
  dailyStreak: { type: DataTypes.INTEGER, field: "daily_streak", defaultValue: 0 },
  lastCheckinDate: { type: DataTypes.DATEONLY, field: "last_checkin_date", allowNull: true },
  equippedAvatarFrameId: { type: DataTypes.INTEGER, field: "equipped_avatar_frame_id", allowNull: true },
  equippedTitleId: { type: DataTypes.INTEGER, field: "equipped_title_id", allowNull: true },
  triThuc: { type: DataTypes.INTEGER, field: "tri_thuc", defaultValue: 0 },
  danhTieng: { type: DataTypes.INTEGER, field: "danh_tieng", defaultValue: 0 },
  uyTin: { type: DataTypes.INTEGER, field: "uy_tin", defaultValue: 0 },
  aiRecommendations: { type: DataTypes.TEXT("long"), field: "ai_recommendations", allowNull: true },
  aiRecommendedAt: { type: DataTypes.DATE, field: "ai_recommended_at", allowNull: true },
  // VIP (migration 20261101-01)
  vipTier: { type: DataTypes.INTEGER, field: "vip_tier", defaultValue: 0 },
  vipExpiresAt: { type: DataTypes.DATE, field: "vip_expires_at", allowNull: true },
}, {
  tableName: "user_gamification",
  underscored: true,
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
});
