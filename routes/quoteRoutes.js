/**
 * 🌳 SYSTEM: IRMINSUL FANTASY RPG - MOTIVATIONAL QUOTES ROUTES
 * ==========================================================
 * @file quoteRoutes.js
 * @path backend/routes/quoteRoutes.js
 * @description Express router for serving random motivational quotes.
 * @endpoint GET /api/quotes
 * ==========================================================
 */

import express from "express";
import { quotesVN } from "../config/quotes.js";

const router = express.Router();

router.get("/", (req, res) => {
  const randomQuote = quotesVN[Math.floor(Math.random() * quotesVN.length)];
  res.json({ quote: randomQuote });
});

export default router;

