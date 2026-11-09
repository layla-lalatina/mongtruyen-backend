import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const PaymentOrder = sequelize.define("PaymentOrder", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  orderCode: { type: DataTypes.STRING(40), field: "order_code", allowNull: false, unique: true },
  userId: { type: DataTypes.INTEGER, field: "user_id", allowNull: false },
  provider: { type: DataTypes.STRING(20), defaultValue: "MOCK" },
  method: { type: DataTypes.STRING(20), defaultValue: "BANK" },
  amountVnd: { type: DataTypes.INTEGER, field: "amount_vnd", allowNull: false },
  crystals: { type: DataTypes.INTEGER, allowNull: false },
  bonusCrystals: { type: DataTypes.INTEGER, field: "bonus_crystals", defaultValue: 0 },
  status: {
    type: DataTypes.ENUM("PENDING", "PAID", "FAILED", "EXPIRED", "CANCELLED"),
    defaultValue: "PENDING",
  },
  providerTxnId: { type: DataTypes.STRING(100), field: "provider_txn_id", allowNull: true },
  paidAt: { type: DataTypes.DATE, field: "paid_at", allowNull: true },
  expiresAt: { type: DataTypes.DATE, field: "expires_at", allowNull: false },
  rawCallback: { type: DataTypes.TEXT, field: "raw_callback", allowNull: true },
}, {
  tableName: "payment_orders",
  underscored: true,
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
});

