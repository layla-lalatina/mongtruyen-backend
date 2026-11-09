import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const AiReaderAnalytics = sequelize.define("AiReaderAnalytics", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  comicId: { type: DataTypes.INTEGER, field: "comic_id", allowNull: false },
  chapterId: { type: DataTypes.INTEGER, field: "chapter_id", allowNull: false },
  avgReadTimeSeconds: { type: DataTypes.INTEGER, field: "avg_read_time_seconds", defaultValue: 0 },
  dropoffPageNumber: { type: DataTypes.INTEGER, field: "dropoff_page_number", defaultValue: 1 },
  sentimentPositivePercent: { type: DataTypes.DECIMAL(5, 2), field: "sentiment_positive_percent", defaultValue: 0.00 },
  sentimentNegativePercent: { type: DataTypes.DECIMAL(5, 2), field: "sentiment_negative_percent", defaultValue: 0.00 },
  aiSuggestions: { type: DataTypes.TEXT, field: "ai_suggestions", allowNull: true },
  calculatedDate: { type: DataTypes.DATEONLY, field: "calculated_date", allowNull: false },
}, {
  tableName: "ai_reader_analytics",
  underscored: true,
  timestamps: false,
});
