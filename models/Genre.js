import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const Genre = sequelize.define("Genre", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  slug: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  description: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: "genres",
  underscored: true,
  timestamps: true,
  createdAt: "created_at",
  updatedAt: false,
});
