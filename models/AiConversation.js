import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const AiConversation = sequelize.define("AiConversation", {
  id: {
    type: DataTypes.STRING(64),
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    field: "user_id",
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
    defaultValue: "Cuộc trò chuyện mới",
  },
  createdAt: {
    type: DataTypes.DATE,
    field: "created_at",
  },
  updatedAt: {
    type: DataTypes.DATE,
    field: "updated_at",
  },
}, {
  tableName: "ai_conversations",
  underscored: true,
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
});
