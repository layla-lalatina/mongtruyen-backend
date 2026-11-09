import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const ComicGenre = sequelize.define("ComicGenre", {
  comicId: { type: DataTypes.INTEGER, field: "comic_id", primaryKey: true },
  genreId: { type: DataTypes.INTEGER, field: "genre_id", primaryKey: true },
}, {
  tableName: "comic_genres",
  underscored: true,
  timestamps: false,
});
