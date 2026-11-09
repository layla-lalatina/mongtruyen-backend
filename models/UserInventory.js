import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const UserInventory = sequelize.define("UserInventory", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, field: "user_id", allowNull: false },
  itemId: { type: DataTypes.INTEGER, field: "item_id", allowNull: false },
  isEquipped: { type: DataTypes.BOOLEAN, field: "is_equipped", defaultValue: false },
  purchasedAt: { type: DataTypes.DATE, field: "purchased_at", defaultValue: DataTypes.NOW },
}, {
  tableName: "user_inventory",
  underscored: true,
  timestamps: false,
});
