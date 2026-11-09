import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const AiChatHistory = sequelize.define("AiChatHistory", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, field: "user_id", allowNull: false },
  conversationId: { type: DataTypes.STRING(64), field: "conversation_id", allowNull: true },
  role: { type: DataTypes.ENUM("user", "model", "system"), allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  intentDetected: { type: DataTypes.STRING(100), field: "intent_detected", allowNull: true },
  createdAt: { type: DataTypes.DATE, field: "created_at" },
  text: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.getDataValue("message");
    },
    set(value) {
      this.setDataValue("message", value);
    }
  },
  modelUsed: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.getDataValue("intentDetected");
    },
    set(value) {
      this.setDataValue("intentDetected", value);
    }
  }
}, {
  tableName: "ai_chat_histories",
  underscored: true,
  timestamps: true,
  createdAt: "created_at",
  updatedAt: false,
});
