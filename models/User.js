import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const User = sequelize.define("User", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  email: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  password: { type: DataTypes.STRING(255), allowNull: false },
  plainPassword: { type: DataTypes.STRING(255), field: "plain_password", allowNull: true },
  avatarUrl: { type: DataTypes.STRING(255), field: "avatar_url", defaultValue: "/Images/avatars/default-avatar.png" },
  bio: { type: DataTypes.TEXT, allowNull: true },
  gender: { type: DataTypes.STRING(20), allowNull: true },
  role: { type: DataTypes.ENUM("READER", "TRANSLATOR", "ADMIN"), defaultValue: "READER" },
  status: { type: DataTypes.ENUM("ACTIVE", "BANNED", "PENDING"), defaultValue: "ACTIVE" },
  lastLoginAt: { type: DataTypes.DATE, field: "last_login_at", allowNull: true },
  // Năm sinh – xác nhận độ tuổi cho truyện 18+ (migration 20261101-01)
  birthYear: { type: DataTypes.INTEGER, field: "birth_year", allowNull: true },
}, {
  tableName: "users",
  underscored: true,
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
});
