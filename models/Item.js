import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const Item = sequelize.define("Item", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(150), allowNull: false },
  itemType: { type: DataTypes.ENUM("AVATAR_FRAME", "NAME_COLOR", "TITLE", "BADGE"), field: "item_type", allowNull: false },
  priceCrystals: { type: DataTypes.INTEGER, field: "price_crystals", defaultValue: 0 },
  assetResource: { type: DataTypes.STRING(255), field: "asset_resource", allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  requiredRank: {
    type: DataTypes.ENUM("RANK_F", "RANK_E", "RANK_D", "RANK_C", "RANK_B", "RANK_A", "RANK_S", "RANK_SS", "RANK_SSS", "RANK_EX"),
    field: "required_rank",
    defaultValue: "RANK_F"
  },
  isActive: { type: DataTypes.BOOLEAN, field: "is_active", defaultValue: true },
}, {
  tableName: "items",
  underscored: true,
  timestamps: true,
  createdAt: "created_at",
  updatedAt: false,
});
