import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const ComicAiProfile = sequelize.define("ComicAiProfile", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  comicId: { type: DataTypes.INTEGER, field: "comic_id", allowNull: false, unique: true },
  mainCharacter: { type: DataTypes.STRING(255), field: "main_character", allowNull: false },
  femaleLead: { type: DataTypes.STRING(255), field: "female_lead", allowNull: true },
  powerType: { type: DataTypes.STRING(255), field: "power_type", allowNull: false },
  powerDescription: { type: DataTypes.TEXT, field: "power_description", allowNull: true },
  personalityTraits: { type: DataTypes.TEXT, field: "personality_traits", allowNull: true },
  supportingCast: { type: DataTypes.JSON, field: "supporting_cast", allowNull: true },
  storyPremise: { type: DataTypes.TEXT, field: "story_premise", allowNull: true },
}, {
  tableName: "comic_ai_profiles",
  underscored: true,
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
});
