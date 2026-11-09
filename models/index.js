/**
 * 🌳 SYSTEM: IRMINSUL FANTASY RPG - CENTRALIZED MODELS & ASSOCIATIONS
 * Chuẩn hóa 21 models khớp 100% với file truyentranh.sql
 */

import { sequelize } from "../config/database.js";
import { User } from "./User.js";
import { UserGamification } from "./UserGamification.js";
import { Genre } from "./Genre.js";
import { Comic } from "./Comic.js";
import { ComicGenre } from "./ComicGenre.js";
import { Chapter } from "./Chapter.js";
import { ChapterPage } from "./ChapterPage.js";
import { Item } from "./Item.js";
import { UserInventory } from "./UserInventory.js";
import { Quest } from "./Quest.js";
import { UserQuest } from "./UserQuest.js";
import { CrystalTransaction } from "./CrystalTransaction.js";
import { ReadingHistory } from "./ReadingHistory.js";
import { Bookmark } from "./Bookmark.js";
import { Rating } from "./Rating.js";
import { Comment } from "./Comment.js";
import { CommentLike } from "./CommentLike.js";
import { ChapterAiSummary } from "./ChapterAiSummary.js";
import { AiChatHistory } from "./AiChatHistory.js";
import { AiConversation } from "./AiConversation.js";
import { AiReaderAnalytics } from "./AiReaderAnalytics.js";
import { AiCommentModeration } from "./AiCommentModeration.js";
import { ComicAiProfile } from "./ComicAiProfile.js";
import { ChapterUnlock } from "./ChapterUnlock.js";
import { ComicNotice } from "./ComicNotice.js";
import { PaymentOrder } from "./PaymentOrder.js";

// ─── Thiết lập quan hệ (Associations) ─────────────────────────

// 1. User <-> UserGamification (1:1)
User.hasOne(UserGamification, { foreignKey: "user_id", as: "gamification", onDelete: "CASCADE" });
UserGamification.belongsTo(User, { foreignKey: "user_id", as: "user" });

// 2. Comic <-> User (Uploader)
User.hasMany(Comic, { foreignKey: "uploader_id", as: "uploadedComics" });
Comic.belongsTo(User, { foreignKey: "uploader_id", as: "uploader" });

// 3. Comic <-> Genre (N:N)
Comic.belongsToMany(Genre, { through: ComicGenre, foreignKey: "comic_id", otherKey: "genre_id", as: "genres" });
Genre.belongsToMany(Comic, { through: ComicGenre, foreignKey: "genre_id", otherKey: "comic_id", as: "comics" });

// 4. Comic <-> Chapter (1:N)
Comic.hasMany(Chapter, { foreignKey: "comic_id", as: "chapters", onDelete: "CASCADE" });
Chapter.belongsTo(Comic, { foreignKey: "comic_id", as: "comic" });

// 5. Chapter <-> ChapterPage (1:N)
Chapter.hasMany(ChapterPage, { foreignKey: "chapter_id", as: "pages", onDelete: "CASCADE" });
ChapterPage.belongsTo(Chapter, { foreignKey: "chapter_id", as: "chapter" });

// 6. User <-> Item via UserInventory (N:N)
User.belongsToMany(Item, { through: UserInventory, foreignKey: "user_id", otherKey: "item_id", as: "items" });
Item.belongsToMany(User, { through: UserInventory, foreignKey: "item_id", otherKey: "user_id", as: "owners" });
UserInventory.belongsTo(Item, { foreignKey: "item_id", as: "item" });
UserInventory.belongsTo(User, { foreignKey: "user_id", as: "user" });

// 7. Quest <-> UserQuest (1:N)
Quest.hasMany(UserQuest, { foreignKey: "quest_id", as: "userProgress", onDelete: "CASCADE" });
UserQuest.belongsTo(Quest, { foreignKey: "quest_id", as: "quest" });
User.hasMany(UserQuest, { foreignKey: "user_id", as: "quests", onDelete: "CASCADE" });
UserQuest.belongsTo(User, { foreignKey: "user_id", as: "user" });

// 8. User <-> CrystalTransaction (1:N)
User.hasMany(CrystalTransaction, { foreignKey: "user_id", as: "crystalTransactions", onDelete: "CASCADE" });
CrystalTransaction.belongsTo(User, { foreignKey: "user_id", as: "user" });

// 9. ReadingHistory
User.hasMany(ReadingHistory, { foreignKey: "user_id", as: "readingHistories", onDelete: "CASCADE" });
ReadingHistory.belongsTo(User, { foreignKey: "user_id", as: "user" });
Comic.hasMany(ReadingHistory, { foreignKey: "comic_id", as: "readingHistories", onDelete: "CASCADE" });
ReadingHistory.belongsTo(Comic, { foreignKey: "comic_id", as: "comic" });
Chapter.hasMany(ReadingHistory, { foreignKey: "last_chapter_id", as: "readingHistories", onDelete: "CASCADE" });
ReadingHistory.belongsTo(Chapter, { foreignKey: "last_chapter_id", as: "lastChapter" });

// 10. Bookmark
User.hasMany(Bookmark, { foreignKey: "user_id", as: "bookmarks", onDelete: "CASCADE" });
Bookmark.belongsTo(User, { foreignKey: "user_id", as: "user" });
Comic.hasMany(Bookmark, { foreignKey: "comic_id", as: "bookmarks", onDelete: "CASCADE" });
Bookmark.belongsTo(Comic, { foreignKey: "comic_id", as: "comic" });

// 11. Rating
User.hasMany(Rating, { foreignKey: "user_id", as: "ratings", onDelete: "CASCADE" });
Rating.belongsTo(User, { foreignKey: "user_id", as: "user" });
Comic.hasMany(Rating, { foreignKey: "comic_id", as: "ratings", onDelete: "CASCADE" });
Rating.belongsTo(Comic, { foreignKey: "comic_id", as: "comic" });

// 12. Comment & CommentLike
User.hasMany(Comment, { foreignKey: "user_id", as: "comments", onDelete: "CASCADE" });
Comment.belongsTo(User, { foreignKey: "user_id", as: "user" });
Comic.hasMany(Comment, { foreignKey: "comic_id", as: "comments", onDelete: "CASCADE" });
Comment.belongsTo(Comic, { foreignKey: "comic_id", as: "comic" });
Chapter.hasMany(Comment, { foreignKey: "chapter_id", as: "comments", onDelete: "SET NULL" });
Comment.belongsTo(Chapter, { foreignKey: "chapter_id", as: "chapter" });
Comment.hasMany(Comment, { foreignKey: "parent_comment_id", as: "replies", onDelete: "CASCADE" });
Comment.belongsTo(Comment, { foreignKey: "parent_comment_id", as: "parent" });

User.hasMany(CommentLike, { foreignKey: "user_id", as: "likedComments", onDelete: "CASCADE" });
CommentLike.belongsTo(User, { foreignKey: "user_id", as: "user" });
Comment.hasMany(CommentLike, { foreignKey: "comment_id", as: "likes", onDelete: "CASCADE" });
CommentLike.belongsTo(Comment, { foreignKey: "comment_id", as: "comment" });

// 13. AI Summaries & Analytics
Chapter.hasOne(ChapterAiSummary, { foreignKey: "chapter_id", as: "aiSummary", onDelete: "CASCADE" });
ChapterAiSummary.belongsTo(Chapter, { foreignKey: "chapter_id", as: "chapter" });

User.hasMany(AiConversation, { foreignKey: "user_id", as: "aiConversations", onDelete: "CASCADE" });
AiConversation.belongsTo(User, { foreignKey: "user_id", as: "user" });

AiConversation.hasMany(AiChatHistory, { foreignKey: "conversation_id", as: "messages", onDelete: "CASCADE" });
AiChatHistory.belongsTo(AiConversation, { foreignKey: "conversation_id", as: "conversation" });

User.hasMany(AiChatHistory, { foreignKey: "user_id", as: "aiChats", onDelete: "CASCADE" });
AiChatHistory.belongsTo(User, { foreignKey: "user_id", as: "user" });

Comic.hasMany(AiReaderAnalytics, { foreignKey: "comic_id", as: "aiAnalytics", onDelete: "CASCADE" });
AiReaderAnalytics.belongsTo(Comic, { foreignKey: "comic_id", as: "comic" });
Chapter.hasMany(AiReaderAnalytics, { foreignKey: "chapter_id", as: "aiAnalytics", onDelete: "CASCADE" });
AiReaderAnalytics.belongsTo(Chapter, { foreignKey: "chapter_id", as: "chapter" });

Comment.hasOne(AiCommentModeration, { foreignKey: "comment_id", as: "aiModeration", onDelete: "CASCADE" });
AiCommentModeration.belongsTo(Comment, { foreignKey: "comment_id", as: "comment" });

// 14. Comic AI Lore & Character Profile
Comic.hasOne(ComicAiProfile, { foreignKey: "comic_id", as: "aiProfile", onDelete: "CASCADE" });
ComicAiProfile.belongsTo(Comic, { foreignKey: "comic_id", as: "comic" });

// 15. ChapterUnlock (Mở khóa chương bằng Crystal / VIP)
User.hasMany(ChapterUnlock, { foreignKey: "user_id", as: "chapterUnlocks", onDelete: "CASCADE" });
ChapterUnlock.belongsTo(User, { foreignKey: "user_id", as: "user" });
Chapter.hasMany(ChapterUnlock, { foreignKey: "chapter_id", as: "unlocks", onDelete: "CASCADE" });
ChapterUnlock.belongsTo(Chapter, { foreignKey: "chapter_id", as: "chapter" });

// 16. ComicNotice (Cảnh báo / ghi chú Admin trên bộ truyện)
Comic.hasMany(ComicNotice, { foreignKey: "comic_id", as: "notices", onDelete: "CASCADE" });
ComicNotice.belongsTo(Comic, { foreignKey: "comic_id", as: "comic" });
User.hasMany(ComicNotice, { foreignKey: "admin_id", as: "createdNotices", onDelete: "SET NULL" });
ComicNotice.belongsTo(User, { foreignKey: "admin_id", as: "admin" });

// 17. PaymentOrder (Đơn nạp tiền tự động)
User.hasMany(PaymentOrder, { foreignKey: "user_id", as: "paymentOrders", onDelete: "CASCADE" });
PaymentOrder.belongsTo(User, { foreignKey: "user_id", as: "user" });

export {
  sequelize,
  User,
  UserGamification,
  Genre,
  Comic,
  ComicGenre,
  Chapter,
  ChapterPage,
  Item,
  UserInventory,
  Quest,
  UserQuest,
  CrystalTransaction,
  ReadingHistory,
  Bookmark,
  Rating,
  Comment,
  CommentLike,
  ChapterAiSummary,
  AiChatHistory,
  AiConversation,
  AiReaderAnalytics,
  AiCommentModeration,
  ComicAiProfile,
  ChapterUnlock,
  ComicNotice,
  PaymentOrder,
};
