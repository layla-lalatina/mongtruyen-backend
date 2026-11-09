/**
 * 🌳 SYSTEM: IRMINSUL FANTASY RPG - DATABASE CONNECTIVITY
 * ==========================================================
 * @file database.js
 * @path backend/config/database.js
 * @description Configures and exports the Sequelize instance for MySQL connection,
 * supporting database configuration via environment variables (DATABASE_URL / manual config).
 * ==========================================================
 */

import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const hasManualDbConfig = Boolean(
  process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME
);
const useSsl = process.env.DB_SSL === "true";

// Priority order:
// 1) DATABASE_URL (if explicitly set)
// 2) Manual DB_* (for localhost or 123host)
// 3) Railway MYSQL* reference vars
const connectionUrl = process.env.DATABASE_URL;
const dbName = hasManualDbConfig
  ? process.env.DB_NAME
  : process.env.MYSQLDATABASE || process.env.DB_NAME;
const dbUser = hasManualDbConfig
  ? process.env.DB_USER
  : process.env.MYSQLUSER || process.env.DB_USER;
const dbPass = hasManualDbConfig
  ? process.env.DB_PASS
  : process.env.MYSQLPASSWORD || process.env.DB_PASS;
const dbHost = hasManualDbConfig
  ? process.env.DB_HOST
  : process.env.MYSQLHOST || process.env.DB_HOST;
const dbPort = Number(
  hasManualDbConfig
    ? process.env.DB_PORT || 3306
    : process.env.MYSQLPORT || process.env.DB_PORT || 3306
);

const baseOptions = {
  dialect: "mysql",
  logging: false,
  dialectOptions: {
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  },
};

export const sequelize = connectionUrl
  ? new Sequelize(connectionUrl, baseOptions)
  : new Sequelize(dbName, dbUser, dbPass, {
      ...baseOptions,
      host: dbHost,
      port: dbPort,
    });
