import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const ChapterAiSummary = sequelize.define("ChapterAiSummary", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  chapterId: { type: DataTypes.INTEGER, field: "chapter_id", allowNull: false, unique: true },
  summaryText: { type: DataTypes.TEXT, field: "summary_text", allowNull: false },
  keyPlotPoints: { type: DataTypes.JSON, field: "key_plot_points", allowNull: false },
  characterActions: { type: DataTypes.JSON, field: "character_actions", allowNull: false },
  spoilersDetected: { type: DataTypes.JSON, field: "spoilers_detected", allowNull: true },
}, {
  tableName: "chapter_ai_summaries",
  underscored: true,
  timestamps: true,
  createdAt: "generated_at",
  updatedAt: false,
});
