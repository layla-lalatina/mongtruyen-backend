import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const Comic = sequelize.define("Comic", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  uploaderId: { type: DataTypes.INTEGER, field: "uploader_id", allowNull: false, defaultValue: 1 },
  title: { type: DataTypes.STRING(255), allowNull: false },
  slug: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  originName: { type: DataTypes.STRING(255), field: "origin_name", allowNull: true },
  author: { type: DataTypes.STRING(150), defaultValue: "Đang cập nhật" },
  description: { type: DataTypes.TEXT("long"), allowNull: true },
  thumbUrl: { type: DataTypes.STRING(255), field: "thumb_url", allowNull: false, defaultValue: "/Images/default-cover.jpg" },
  status: { type: DataTypes.ENUM("ONGOING", "COMPLETED", "HIATUS"), defaultValue: "ONGOING" },
  totalViews: { type: DataTypes.BIGINT, field: "total_views", defaultValue: 0 },
  ratingAvg: { type: DataTypes.DECIMAL(3, 2), field: "rating_avg", defaultValue: 5.00 },
  totalRatings: { type: DataTypes.INTEGER, field: "total_ratings", defaultValue: 0 },
  isRecommendedByAi: { type: DataTypes.BOOLEAN, field: "is_recommended_by_ai", defaultValue: false },
  // Truyện VIP độc quyền (chỉ VIP đọc được)
  isVip: { type: DataTypes.BOOLEAN, field: "is_vip", defaultValue: false },
  // Nhãn giới hạn độ tuổi (migration 20261101-01)
  ageRating: { type: DataTypes.ENUM("ALL", "13+", "16+", "18+"), field: "age_rating", defaultValue: "ALL" },
  
  // Virtual getters / setters for full backwards compatibility with existing UI code
  name: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.getDataValue("title");
    },
    set(value) {
      this.setDataValue("title", value);
    }
  },
  views: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.getDataValue("totalViews");
    },
    set(value) {
      this.setDataValue("totalViews", value);
    }
  },
  rating: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.getDataValue("ratingAvg");
    },
    set(value) {
      this.setDataValue("ratingAvg", value);
    }
  }
}, {
  tableName: "comics",
  underscored: true,
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
});
