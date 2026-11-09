import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const CrystalTransaction = sequelize.define("CrystalTransaction", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, field: "user_id", allowNull: false },
  amount: { type: DataTypes.INTEGER, allowNull: false },
  transactionType: {
    type: DataTypes.ENUM("QUEST_REWARD", "DAILY_CHECKIN", "LEVEL_UP", "SHOP_PURCHASE", "ADMIN_ADJUST", "CHAPTER_UNLOCK", "VIP_PURCHASE", "DEPOSIT"),
    field: "transaction_type",
    allowNull: false
  },
  description: { type: DataTypes.STRING(255), allowNull: false },
  balanceAfter: { type: DataTypes.INTEGER, field: "balance_after", allowNull: false },
}, {
  tableName: "crystal_transactions",
  underscored: true,
  timestamps: true,
  createdAt: "created_at",
  updatedAt: false,
});
