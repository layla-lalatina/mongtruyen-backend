import express from "express";
import auth from "../middleware/auth.js";
import isAdmin from "../middleware/isAdmin.js";
import { Quest } from "../models/index.js";

const router = express.Router();

const formatQuest = (q) => ({
  id: q.id,
  code: q.targetAction ? `Q_${q.targetAction}` : `QUEST_${q.id}`,
  title: q.title,
  description: q.description || "",
  questType: q.questType,
  type: q.questType ? q.questType.toLowerCase() : "daily",
  targetAction: q.targetAction,
  actionType: q.targetAction,
  targetCount: q.targetCount,
  targetValue: q.targetCount,
  minLevel: q.minLevel || 1,
  minFameRank: q.minFameRank || "ALL",
  rewardXp: q.rewardXp,
  rewardCrystals: q.rewardCrystals,
  rewardCrystal: q.rewardCrystals,
  rewardMemories: q.rewardMemories,
  isActive: q.isActive,
  createdAt: q.createdAt,
});

// GET all quests
router.get("/", async (req, res) => {
  try {
    const quests = await Quest.findAll({ order: [["id", "ASC"]] });
    const formatted = quests.map(formatQuest);
    res.json({ success: true, tasks: formatted, quests: formatted });
  } catch (err) {
    console.error("Lỗi lấy danh sách nhiệm vụ:", err);
    res.status(500).json({ success: false, message: "Lỗi server khi lấy nhiệm vụ." });
  }
});

// POST create quest (Admin only)
router.post("/", auth, isAdmin, async (req, res) => {
  try {
    const {
      title,
      description,
      questType,
      type,
      targetAction,
      actionType,
      targetCount,
      targetValue,
      minLevel,
      minFameRank,
      rewardXp,
      rewardCrystals,
      rewardCrystal,
      rewardMemories,
    } = req.body;

    const action = targetAction || actionType;
    if (!title || !action) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ tiêu đề và hành động nhiệm vụ." });
    }

    const rawType = (questType || type || "DAILY").toUpperCase();
    const validTypes = ["DAILY", "WEEKLY", "ACHIEVEMENT", "AI_DYNAMIC"];
    const finalQuestType = validTypes.includes(rawType) ? rawType : "DAILY";

    const quest = await Quest.create({
      title,
      description: description || "",
      questType: finalQuestType,
      targetAction: action,
      targetCount: Number(targetCount ?? targetValue ?? 1),
      minLevel: Number(minLevel || 1),
      minFameRank: minFameRank || "ALL",
      rewardXp: Number(rewardXp ?? 50),
      rewardCrystals: Number(rewardCrystals ?? rewardCrystal ?? 10),
      rewardMemories: Number(rewardMemories ?? 1),
      isActive: true,
    });

    res.json({ success: true, message: "Tạo nhiệm vụ thành công!", task: formatQuest(quest), quest: formatQuest(quest) });
  } catch (err) {
    console.error("Lỗi tạo nhiệm vụ:", err);
    res.status(500).json({ message: "Lỗi server khi tạo nhiệm vụ." });
  }
});

// PUT update quest (Admin only)
router.put("/:id", auth, isAdmin, async (req, res) => {
  try {
    const {
      title,
      description,
      questType,
      type,
      targetAction,
      actionType,
      targetCount,
      targetValue,
      minLevel,
      minFameRank,
      rewardXp,
      rewardCrystals,
      rewardCrystal,
      rewardMemories,
      isActive,
    } = req.body;

    const quest = await Quest.findByPk(req.params.id);
    if (!quest) {
      return res.status(404).json({ message: "Không tìm thấy nhiệm vụ." });
    }

    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;

    const rawType = questType || type;
    if (rawType) {
      const upper = rawType.toUpperCase();
      if (["DAILY", "WEEKLY", "ACHIEVEMENT", "AI_DYNAMIC"].includes(upper)) {
        updates.questType = upper;
      }
    }

    const action = targetAction || actionType;
    if (action) updates.targetAction = action;

    const count = targetCount ?? targetValue;
    if (count !== undefined) updates.targetCount = Number(count);

    if (minLevel !== undefined) updates.minLevel = Number(minLevel);
    if (minFameRank !== undefined) updates.minFameRank = minFameRank;

    if (rewardXp !== undefined) updates.rewardXp = Number(rewardXp);

    const crystals = rewardCrystals ?? rewardCrystal;
    if (crystals !== undefined) updates.rewardCrystals = Number(crystals);

    if (rewardMemories !== undefined) updates.rewardMemories = Number(rewardMemories);
    if (isActive !== undefined) updates.isActive = Boolean(isActive);

    await quest.update(updates);

    res.json({ success: true, message: "Cập nhật nhiệm vụ thành công!", task: formatQuest(quest), quest: formatQuest(quest) });
  } catch (err) {
    console.error("Lỗi cập nhật nhiệm vụ:", err);
    res.status(500).json({ message: "Lỗi server khi cập nhật nhiệm vụ." });
  }
});

// DELETE quest (Admin only)
router.delete("/:id", auth, isAdmin, async (req, res) => {
  try {
    const quest = await Quest.findByPk(req.params.id);
    if (!quest) {
      return res.status(404).json({ message: "Không tìm thấy nhiệm vụ." });
    }
    await quest.destroy();
    res.json({ success: true, message: "Xóa nhiệm vụ thành công!" });
  } catch (err) {
    console.error("Lỗi xóa nhiệm vụ:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
});

export default router;
