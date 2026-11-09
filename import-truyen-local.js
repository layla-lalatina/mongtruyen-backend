/**
 * 🌳 SYSTEM: IRMINSUL FANTASY RPG - IMPORT TRUYỆN & HỒ SƠ AI TỪ Images/truyen
 * ==========================================================
 * @file import-truyen-local.js
 * @path backend/import-truyen-local.js
 * @description Tự động quét toàn bộ các bộ truyện từ Images/truyen,
 * phân tích:
 *   1. thong_tin.txt (thông tin cơ bản truyện)
 *   2. main.txt.docx (hồ sơ AI: nhân vật chính, nữ chính, hệ thống/năng lực, tiền đề cốt truyện -> comic_ai_profiles)
 *   3. <chương>.txt.docx (1.txt.docx, 2.txt.docx, 3.txt.docx... -> tóm tắt chương AI -> chapter_ai_summaries)
 *   4. cover.jpg & các thư mục chương ảnh -> chapters & chapter_pages
 * Đồng bộ trực tiếp vào CSDL MySQL và xuất file import_truyen_100.sql.
 * ==========================================================
 */

import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";
import {
  sequelize,
  Comic,
  Genre,
  ComicGenre,
  Chapter,
  ChapterPage,
  ComicAiProfile,
  ChapterAiSummary,
  User,
} from "./models/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TRUYEN_DIR = path.resolve(__dirname, "..", "Images", "truyen");
const SQL_OUTPUT_PATH = path.resolve(__dirname, "..", "import_truyen_100.sql");

// ─── HELPER 1: ĐỌC FILE .DOCX THUẦN NODE.JS (KHÔNG CẦN THƯ VIỆN NGOÀI) ───
export function readDocxSync(filePath) {
  const buf = fs.readFileSync(filePath);
  let eocdPos = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdPos = i;
      break;
    }
  }
  if (eocdPos === -1) throw new Error("Invalid ZIP/DOCX: " + filePath);
  const cdEntries = buf.readUInt16LE(eocdPos + 10);
  let pos = buf.readUInt32LE(eocdPos + 16);

  for (let e = 0; e < cdEntries; e++) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) break;
    const method = buf.readUInt16LE(pos + 10);
    const compSize = buf.readUInt32LE(pos + 20);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localOffset = buf.readUInt32LE(pos + 42);
    const entryName = buf.toString("utf8", pos + 46, pos + 46 + nameLen);

    if (entryName === "word/document.xml") {
      const lNameLen = buf.readUInt16LE(localOffset + 26);
      const lExtraLen = buf.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + lNameLen + lExtraLen;
      const compData = buf.subarray(dataStart, dataStart + compSize);
      const xml = (method === 8 ? zlib.inflateRawSync(compData) : compData).toString("utf8");

      const paragraphs = [];
      const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
      let pMatch;
      while ((pMatch = pRegex.exec(xml)) !== null) {
        const pInner = pMatch[1];
        const tRegex = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
        let tMatch;
        let line = "";
        while ((tMatch = tRegex.exec(pInner)) !== null) {
          line += tMatch[1];
        }
        line = line
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'");
        if (line.trim()) paragraphs.push(line.trim());
      }
      return paragraphs.join("\n");
    }
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return "";
}

// ─── HELPER 2: TẠO SLUG CHUẨN ───
function makeSlug(text) {
  if (!text) return "truyen-" + Date.now();
  let str = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();

  str = str.replace(/[^a-z0-9]+/g, "-");
  str = str.replace(/^-+|-+$/g, "");
  return str || "truyen-" + Date.now();
}

// ─── HELPER 3: PHÂN TÍCH thong_tin.txt ───
function parseInfoFile(filePath, defaultTitle) {
  const content = fs.readFileSync(filePath, "utf-8").replace(/^\uFEFF/, "");
  const lines = content.split(/\r?\n/);

  let title = "";
  let author = "Đang cập nhật";
  let artist = "";
  let genres = [];
  let status = "ONGOING";
  let year = "";
  let descriptionLines = [];
  let isDesc = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!isDesc) {
      if (/^Tên truyện:/i.test(trimmed)) {
        title = trimmed.replace(/^Tên truyện:\s*/i, "").trim();
      } else if (/^Tác giả:/i.test(trimmed)) {
        author = trimmed.replace(/^Tác giả:\s*/i, "").trim() || "Đang cập nhật";
      } else if (/^Họa sĩ:/i.test(trimmed)) {
        artist = trimmed.replace(/^Họa sĩ:\s*/i, "").trim();
      } else if (/^Thể loại:/i.test(trimmed)) {
        const raw = trimmed.replace(/^Thể loại:\s*/i, "").trim();
        genres = raw
          ? raw
              .split(",")
              .map((g) => g.trim())
              .filter(Boolean)
          : [];
      } else if (/^Trạng thái:/i.test(trimmed)) {
        const rawStatus = trimmed.replace(/^Trạng thái:\s*/i, "").trim().toLowerCase();
        if (rawStatus.includes("complete") || rawStatus.includes("hoàn thành")) {
          status = "COMPLETED";
        } else if (rawStatus.includes("hiatus") || rawStatus.includes("tạm ngưng")) {
          status = "HIATUS";
        } else {
          status = "ONGOING";
        }
      } else if (/^Năm phát hành:/i.test(trimmed)) {
        year = trimmed.replace(/^Năm phát hành:\s*/i, "").trim();
      } else if (/^Mô tả:/i.test(trimmed)) {
        isDesc = true;
        const afterDesc = trimmed.replace(/^Mô tả:\s*/i, "").trim();
        if (afterDesc) descriptionLines.push(afterDesc);
      }
    } else {
      descriptionLines.push(line);
    }
  }

  const description =
    descriptionLines.join("\n").trim() || "Đang cập nhật nội dung truyện...";
  if (!title) title = defaultTitle;

  return { title, author, artist, genres, status, year, description };
}

// ─── HELPER 4: PHÂN TÍCH main.txt.docx -> ComicAiProfile ───
function parseMainDocx(text, defaultTitle, defaultDesc = "") {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let fullTitle = defaultTitle;
  let genres = [];
  let mainCharacter = "";
  let femaleLead = "";
  let supportingCast = [];
  let powerLines = [];
  let personalityLines = [];
  let premiseLines = [];

  let section = ""; // "main_char" | "characters" | "power" | "premise" | ""

  for (const rawLine of lines) {
    const line = rawLine.replace(/^[-+•*]\s*/, "").trim();
    if (/^\[.*\]$/.test(line)) continue;

    if (/^Tên truyện\s*:/i.test(line)) {
      fullTitle = line.replace(/^Tên truyện\s*:\s*/i, "").trim() || defaultTitle;
      section = "";
    } else if (/^Thể loại\s*:/i.test(line)) {
      const gRaw = line.replace(/^Thể loại\s*:\s*/i, "").trim();
      genres = gRaw
        .split(/[,،]/)
        .map((g) => g.replace(/\s*\(.*?\)\s*/g, "").trim())
        .filter(Boolean);
      section = "";
    } else if (
      /^(Tên nhân vật chính|Nhân vật chính(\s*\(Main\))?|Nhân vật dẫn dắt chính|Hai nhân vật chính)\s*:/i.test(
        line
      )
    ) {
      const val = line.replace(/^[^:]+:\s*/, "").trim();
      if (val) {
        mainCharacter = val;
        section = "characters";
      } else {
        section = "main_char";
      }
    } else if (/^(Nữ chính[^:]*|Nam chính[^:]*|Người bạn định mệnh|Linh thú khế ước)\s*:/i.test(line)) {
      const val = line.replace(/^[^:]+:\s*/, "").trim();
      const fullVal = val || line;
      if (!mainCharacter) {
        mainCharacter = fullVal;
      } else if (!femaleLead) {
        femaleLead = fullVal;
      } else {
        supportingCast.push(fullVal);
      }
      section = "characters";
    } else if (
      /^(Các nhân vật|Nhân vật phụ|Nhân vật trong|Nhân vật đại diện|Đồng đội|Các thành viên)[^:]*:/i.test(
        line
      )
    ) {
      const val = line.replace(/^[^:]+:\s*/, "").trim();
      if (val) supportingCast.push(val);
      section = "characters";
    } else if (
      /^(Cheat\/Năng lực\/Hệ thống|Đặc điểm\s*\/\s*Sức mạnh\s*\/\s*Hệ thống[^:]*|Năng lực\s*\/\s*Sức mạnh[^:]*|Sức mạnh\s*\/\s*Kỹ năng[^:]*|Hệ thống\s*\/\s*Năng lực[^:]*|Đặc điểm nhân vật[^:]*|Đặc điểm\s*\/\s*Kỹ năng[^:]*)\s*:/i.test(
        line
      )
    ) {
      const val = line.replace(/^[^:]+:\s*/, "").trim();
      if (val) powerLines.push(val);
      section = "power";
    } else if (
      /^(Tiền đề cốt truyện|Tóm tắt tiền đề[^:]*|Tóm tắt cốt truyện[^:]*|Nội dung chính[^:]*|Bối cảnh cốt truyện[^:]*)\s*:/i.test(
        line
      )
    ) {
      const val = line.replace(/^[^:]+:\s*/, "").trim();
      if (val) premiseLines.push(val);
      section = "premise";
    } else {
      if (section === "main_char") {
        if (!mainCharacter) {
          mainCharacter = line;
        } else if (!femaleLead) {
          femaleLead = line;
        } else {
          supportingCast.push(line);
        }
      } else if (section === "characters") {
        if (!femaleLead) {
          femaleLead = line;
        } else {
          supportingCast.push(line);
        }
      } else if (section === "power") {
        if (/^Tính cách\s*:/i.test(line)) {
          personalityLines.push(line.replace(/^Tính cách\s*:\s*/i, "").trim());
        } else {
          powerLines.push(line);
        }
      } else if (section === "premise") {
        premiseLines.push(line);
      }
    }
  }

  if (!mainCharacter) mainCharacter = "Nhân vật chính trong " + defaultTitle;
  const powerDescription = powerLines.join("\n").trim() || defaultDesc || text;
  const powerType = (powerLines[0] || "Năng lực đặc biệt / Kỹ năng nhân vật").slice(0, 250);
  const storyPremise = premiseLines.join("\n").trim() || defaultDesc || text;
  const personalityTraits = personalityLines.join("; ").trim() || null;

  return {
    fullTitle: fullTitle.slice(0, 250),
    genres,
    mainCharacter: mainCharacter.slice(0, 250),
    femaleLead: femaleLead ? femaleLead.slice(0, 250) : null,
    supportingCast,
    powerType,
    powerDescription,
    personalityTraits,
    storyPremise,
  };
}

// ─── HELPER 5: PHÂN TÍCH <chương>.txt.docx -> ChapterAiSummary ───
function parseChapterDocx(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let chapterTitle = "";
  const bodyLines = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/^[-+•*]\s*/, "").trim();
    if (/^\[.*\]$/.test(line)) continue;
    if (/^Tóm tắt Chương\s*\d+(\.\d+)?\s*:?$/i.test(line)) continue;
    if (/^Nội dung tóm tắt\s*:?$/i.test(line)) continue;

    if (/^Tiêu đề chương\s*:/i.test(line)) {
      chapterTitle = line.replace(/^Tiêu đề chương\s*:\s*/i, "").trim();
    } else if (/^Tóm tắt Chương\s*\d+(\.\d+)?\s*:/i.test(line)) {
      const rest = line.replace(/^Tóm tắt Chương\s*\d+(\.\d+)?\s*:\s*/i, "").trim();
      if (rest) bodyLines.push(rest);
    } else if (/^Nội dung tóm tắt\s*:/i.test(line)) {
      const rest = line.replace(/^Nội dung tóm tắt\s*:\s*/i, "").trim();
      if (rest) bodyLines.push(rest);
    } else {
      bodyLines.push(line);
    }
  }

  const summaryText = bodyLines.join("\n").trim() || text.trim();
  const sentences = summaryText
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  const keyPlotPoints = sentences.slice(0, 4);
  const characterActions =
    sentences.length > 1 ? sentences.slice(1, 5) : sentences.slice(0, 2);

  return {
    chapterTitle,
    summaryText,
    keyPlotPoints: keyPlotPoints.length ? keyPlotPoints : [summaryText.slice(0, 200)],
    characterActions: characterActions.length
      ? characterActions
      : [summaryText.slice(0, 200)],
  };
}

// Helper phân tích số chương từ tên thư mục hoặc tên file docx
function parseChapterNumber(name) {
  const cleaned = name
    .replace(/\(\d+\)/g, "")
    .replace(/\.txt\.docx$/i, "")
    .replace(/\.docx$/i, "");
  const match = cleaned.match(/(\d+(\.\d+)?)/);
  if (match) {
    return parseFloat(match[1]);
  }
  return 1;
}

// Sắp xếp các file ảnh theo số tự nhiên (1, 2, ..., 9, 10, 11)
function sortPageFiles(files) {
  return files.sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)?.[0] || "0", 10);
    const numB = parseInt(b.match(/\d+/)?.[0] || "0", 10);
    if (numA !== numB) return numA - numB;
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  });
}

function escapeSql(str) {
  if (str === null || str === undefined) return "NULL";
  return (
    "'" +
    String(str)
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\0/g, "\\0")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r") +
    "'"
  );
}

async function run() {
  console.log("==================================================================");
  console.log("🌳 CÔNG CỤ ĐỒNG BỘ TRUYỆN & HỒ SƠ TÓM TẮT AI TỪ Images/truyen 🌳");
  console.log("==================================================================");

  if (!fs.existsSync(TRUYEN_DIR)) {
    console.error(`❌ Thư mục không tồn tại: ${TRUYEN_DIR}`);
    process.exit(1);
  }

  const entries = fs.readdirSync(TRUYEN_DIR, { withFileTypes: true });
  const comicFolders = entries.filter((e) => e.isDirectory());
  console.log(`📁 Tìm thấy ${comicFolders.length} thư mục truyện.\n`);

  const parsedComics = [];
  const usedSlugs = new Set();
  const allGenresMap = new Map(); // slug -> name
  let totalAiProfiles = 0;
  let totalChapterSummaries = 0;

  for (const cDir of comicFolders) {
    const folderName = cDir.name;
    const folderPath = path.join(TRUYEN_DIR, folderName);
    const infoPath = path.join(folderPath, "thong_tin.txt");
    const mainDocxPath = path.join(folderPath, "main.txt.docx");
    const coverPath = path.join(folderPath, "cover.jpg");

    let info = {
      title: folderName,
      author: "Đang cập nhật",
      artist: "",
      genres: ["Truyện Tranh"],
      status: "ONGOING",
      year: "",
      description: "Đang cập nhật...",
    };

    if (fs.existsSync(infoPath)) {
      info = parseInfoFile(infoPath, folderName);
    }

    // Đọc main.txt.docx để lấy hồ sơ AI (ComicAiProfile)
    let aiProfile = null;
    if (fs.existsSync(mainDocxPath)) {
      try {
        const mainText = readDocxSync(mainDocxPath);
        aiProfile = parseMainDocx(mainText, info.title, info.description);
        totalAiProfiles++;
      } catch (err) {
        console.warn(`⚠️ Lỗi đọc main.txt.docx tại ${folderName}:`, err.message);
      }
    } else {
      // Fallback cho truyện chỉ có thong_tin.txt (như Kaguya-sama)
      aiProfile = {
        fullTitle: info.title,
        genres: info.genres,
        mainCharacter: "Shirogane Miyuki & Shinomiya Kaguya",
        femaleLead: "Shinomiya Kaguya",
        supportingCast: ["Fujiwara Chika", "Ishigami Yu", "Iino Miko", "Hayasaka Ai"],
        powerType: "Đấu trí tâm lý đỉnh cao (Mind Games / Genius Intellect)",
        powerDescription:
          "Hai thiên tài đứng đầu học viện Shuchiin dùng mọi chiến thuật tâm lý để buộc đối phương phải tỏ tình trước.",
        personalityTraits: "Kiêu hãnh, thông minh tuyệt đỉnh nhưng vụng về trong tình yêu",
        storyPremise: info.description,
      };
      totalAiProfiles++;
    }

    let slug = makeSlug(info.title);
    if (!slug || slug === "truyen") slug = makeSlug(folderName);
    let originalSlug = slug;
    let counter = 1;
    while (usedSlugs.has(slug)) {
      slug = `${originalSlug}-${counter++}`;
    }
    usedSlugs.add(slug);

    // Gộp thể loại từ thong_tin.txt và main.txt.docx
    const mergedGenreNames = [...info.genres];
    if (aiProfile?.genres?.length) {
      for (const g of aiProfile.genres) {
        if (!mergedGenreNames.some((existing) => makeSlug(existing) === makeSlug(g))) {
          mergedGenreNames.push(g);
        }
      }
    }

    const comicGenreObjs = [];
    for (const gName of mergedGenreNames) {
      const gSlug = makeSlug(gName);
      if (gSlug) {
        if (!allGenresMap.has(gSlug)) {
          allGenresMap.set(gSlug, gName);
        }
        if (!comicGenreObjs.some((cg) => cg.slug === gSlug)) {
          comicGenreObjs.push({ name: gName, slug: gSlug });
        }
      }
    }

    // Quét các file tóm tắt chương (<chương>.txt.docx) trong thư mục truyện
    const subEntries = fs.readdirSync(folderPath, { withFileTypes: true });
    const chapterSummaryMap = new Map(); // chapterNumber -> parsed summary
    const chapterDocxFiles = subEntries.filter(
      (e) =>
        e.isFile() &&
        /\.docx$/i.test(e.name) &&
        !/^main/i.test(e.name) &&
        !/\(\d+\)\.docx$/i.test(e.name)
    );

    for (const cFile of chapterDocxFiles) {
      try {
        const cNum = parseChapterNumber(cFile.name);
        const cText = readDocxSync(path.join(folderPath, cFile.name));
        if (cText) {
          const parsedChapSum = parseChapterDocx(cText);
          chapterSummaryMap.set(cNum, parsedChapSum);
          totalChapterSummaries++;
        }
      } catch (err) {
        console.warn(`⚠️ Lỗi đọc ${cFile.name} tại ${folderName}:`, err.message);
      }
    }

    // Quét các thư mục chương ảnh
    const chapterDirs = subEntries
      .filter((e) => e.isDirectory())
      .map((e) => ({
        name: e.name,
        num: parseChapterNumber(e.name),
        fullPath: path.join(folderPath, e.name),
      }))
      .sort((a, b) => a.num - b.num);

    const chapters = [];
    for (const ch of chapterDirs) {
      const imgFiles = fs
        .readdirSync(ch.fullPath)
        .filter((f) => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
      const sortedImgs = sortPageFiles(imgFiles);

      const pages = sortedImgs.map((imgName, idx) => ({
        pageNumber: idx + 1,
        imageUrl: `/Images/truyen/${folderName}/${ch.name}/${imgName}`,
      }));

      const aiSummary = chapterSummaryMap.get(ch.num) || null;
      const chapterDisplayName =
        aiSummary && aiSummary.chapterTitle
          ? `Chương ${ch.num}: ${aiSummary.chapterTitle}`
          : ch.name;

      chapters.push({
        chapterNumber: ch.num,
        chapterName: chapterDisplayName,
        pages,
        aiSummary,
      });
    }

    const thumbUrl = fs.existsSync(coverPath)
      ? `/Images/truyen/${folderName}/cover.jpg`
      : "/Images/default-cover.jpg";

    // Kết hợp mô tả từ thong_tin.txt và tiền đề cốt truyện nếu cần
    const originName = aiProfile?.fullTitle || info.title;
    let richDescription = info.description;
    if (
      aiProfile?.storyPremise &&
      !richDescription.includes(aiProfile.storyPremise.slice(0, 40))
    ) {
      richDescription = `${info.description}\n\n[Bối cảnh & Tiền đề cốt truyện]:\n${aiProfile.storyPremise}`;
    }

    parsedComics.push({
      folderName,
      title: info.title,
      originName,
      slug,
      author: info.author,
      description: richDescription,
      status: info.status,
      thumbUrl,
      genres: comicGenreObjs,
      aiProfile,
      chapters,
    });
  }

  console.log(`✅ Đã phân tích xong ${parsedComics.length} bộ truyện:`);
  console.log(`   - Hồ sơ AI truyện (main.txt.docx -> comic_ai_profiles): ${totalAiProfiles}`);
  console.log(`   - Tóm tắt AI chương (<chương>.txt.docx -> chapter_ai_summaries): ${totalChapterSummaries}`);
  console.log(`   - Tổng số thể loại duy nhất: ${allGenresMap.size}`);

  // 1. Tạo file SQL import_truyen_100.sql
  console.log("\n[1/2] Đang tạo file SQL import_truyen_100.sql...");
  let sql = "-- ==========================================================\n";
  sql += "-- IRMINSUL FANTASY RPG: IMPORT TRUYỆN + HỒ SƠ AI + TÓM TẮT CHƯƠNG\n";
  sql += "-- ==========================================================\n\n";
  sql += "SET FOREIGN_KEY_CHECKS = 0;\n";
  sql += "START TRANSACTION;\n\n";
  sql += "-- 0. Đảm bảo các bảng AI và cột updated_at đã sẵn sàng\n";
  sql += "ALTER TABLE `comics` MODIFY COLUMN `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;\n\n";
  sql += `CREATE TABLE IF NOT EXISTS \`comic_ai_profiles\` (
  \`id\` INT(11) NOT NULL AUTO_INCREMENT,
  \`comic_id\` INT(11) NOT NULL,
  \`main_character\` VARCHAR(255) NOT NULL,
  \`female_lead\` VARCHAR(255) DEFAULT NULL,
  \`power_type\` VARCHAR(255) NOT NULL,
  \`power_description\` TEXT DEFAULT NULL,
  \`personality_traits\` TEXT DEFAULT NULL,
  \`supporting_cast\` JSON DEFAULT NULL,
  \`story_premise\` TEXT DEFAULT NULL,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uk_comic_ai_profile\` (\`comic_id\`),
  CONSTRAINT \`fk_cap_comic\` FOREIGN KEY (\`comic_id\`) REFERENCES \`comics\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

  sql += `CREATE TABLE IF NOT EXISTS \`chapter_ai_summaries\` (
  \`id\` INT(11) NOT NULL AUTO_INCREMENT,
  \`chapter_id\` INT(11) NOT NULL,
  \`summary_text\` TEXT NOT NULL,
  \`key_plot_points\` JSON NOT NULL,
  \`character_actions\` JSON NOT NULL,
  \`spoilers_detected\` JSON DEFAULT NULL,
  \`generated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uk_chapter_summary\` (\`chapter_id\`),
  CONSTRAINT \`fk_cas_chapter\` FOREIGN KEY (\`chapter_id\`) REFERENCES \`chapters\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

  // Thêm genres
  sql += "-- 1. Thêm danh mục thể loại\n";
  for (const [gSlug, gName] of allGenresMap.entries()) {
    sql += `INSERT INTO genres (name, slug) VALUES (${escapeSql(gName)}, ${escapeSql(gSlug)}) ON DUPLICATE KEY UPDATE name = VALUES(name);\n`;
  }
  sql += "\n";

  // Thêm comics & comic_ai_profiles & chapters & chapter_pages & chapter_ai_summaries
  sql += "-- 2. Thêm truyện, hồ sơ AI, chương, trang ảnh và tóm tắt chương AI\n";
  for (let i = 0; i < parsedComics.length; i++) {
    const c = parsedComics[i];
    const uploaderId = 1;
    const views = Math.floor(Math.random() * 4000) + 1200;
    const rating = (4.8 + Math.random() * 0.2).toFixed(2);
    const ratingsCount = Math.floor(Math.random() * 80) + 20;
    const intervalMinutes = (parsedComics.length - i) * 15;

    sql += `\n-- Truyện: ${c.title.replace(/\n/g, " ")}\n`;
    sql += `INSERT INTO comics (uploader_id, title, slug, origin_name, author, description, thumb_url, status, total_views, rating_avg, total_ratings, created_at, updated_at)\n`;
    sql += `VALUES (${uploaderId}, ${escapeSql(c.title)}, ${escapeSql(c.slug)}, ${escapeSql(c.originName)}, ${escapeSql(c.author)}, ${escapeSql(c.description)}, ${escapeSql(c.thumbUrl)}, ${escapeSql(c.status)}, ${views}, ${rating}, ${ratingsCount}, DATE_SUB(NOW(), INTERVAL ${intervalMinutes} MINUTE), DATE_SUB(NOW(), INTERVAL ${intervalMinutes} MINUTE))\n`;
    sql += `ON DUPLICATE KEY UPDATE title = VALUES(title), origin_name = VALUES(origin_name), author = VALUES(author), description = VALUES(description), thumb_url = VALUES(thumb_url), status = VALUES(status);\n`;

    sql += `SET @comic_id = (SELECT id FROM comics WHERE slug = ${escapeSql(c.slug)} LIMIT 1);\n`;

    // Hồ sơ AI của bộ truyện (từ main.txt.docx)
    if (c.aiProfile) {
      const p = c.aiProfile;
      sql += `INSERT INTO comic_ai_profiles (comic_id, main_character, female_lead, power_type, power_description, personality_traits, supporting_cast, story_premise, created_at, updated_at)\n`;
      sql += `VALUES (@comic_id, ${escapeSql(p.mainCharacter)}, ${escapeSql(p.femaleLead)}, ${escapeSql(p.powerType)}, ${escapeSql(p.powerDescription)}, ${escapeSql(p.personalityTraits)}, ${escapeSql(JSON.stringify(p.supportingCast || []))}, ${escapeSql(p.storyPremise)}, NOW(), NOW())\n`;
      sql += `ON DUPLICATE KEY UPDATE main_character = VALUES(main_character), female_lead = VALUES(female_lead), power_type = VALUES(power_type), power_description = VALUES(power_description), personality_traits = VALUES(personality_traits), supporting_cast = VALUES(supporting_cast), story_premise = VALUES(story_premise), updated_at = NOW();\n`;
    }

    // Gán thể loại
    for (const g of c.genres) {
      sql += `INSERT IGNORE INTO comic_genres (comic_id, genre_id) SELECT @comic_id, id FROM genres WHERE slug = ${escapeSql(g.slug)};\n`;
    }

    // Gán chapters & pages & chapter_ai_summaries
    for (const ch of c.chapters) {
      sql += `INSERT INTO chapters (comic_id, chapter_number, chapter_name, views, status, published_at, created_at, updated_at)\n`;
      sql += `VALUES (@comic_id, ${ch.chapterNumber}, ${escapeSql(ch.chapterName)}, ${Math.floor(views / 3)}, 'PUBLISHED', NOW(), NOW(), NOW())\n`;
      sql += `ON DUPLICATE KEY UPDATE chapter_name = VALUES(chapter_name);\n`;

      sql += `SET @chapter_id = (SELECT id FROM chapters WHERE comic_id = @comic_id AND chapter_number = ${ch.chapterNumber} LIMIT 1);\n`;

      if (ch.aiSummary) {
        const s = ch.aiSummary;
        sql += `INSERT INTO chapter_ai_summaries (chapter_id, summary_text, key_plot_points, character_actions, spoilers_detected, generated_at)\n`;
        sql += `VALUES (@chapter_id, ${escapeSql(s.summaryText)}, ${escapeSql(JSON.stringify(s.keyPlotPoints))}, ${escapeSql(JSON.stringify(s.characterActions))}, ${escapeSql(JSON.stringify([]))}, NOW())\n`;
        sql += `ON DUPLICATE KEY UPDATE summary_text = VALUES(summary_text), key_plot_points = VALUES(key_plot_points), character_actions = VALUES(character_actions), generated_at = NOW();\n`;
      }

      sql += `DELETE FROM chapter_pages WHERE chapter_id = @chapter_id;\n`;

      if (ch.pages.length > 0) {
        const pageValues = ch.pages.map(
          (p) => `(@chapter_id, ${p.pageNumber}, ${escapeSql(p.imageUrl)}, NOW())`
        );
        sql += `INSERT INTO chapter_pages (chapter_id, page_number, image_url, created_at) VALUES\n${pageValues.join(",\n")};\n`;
      }
    }
  }

  sql += "\nCOMMIT;\n";
  sql += "SET FOREIGN_KEY_CHECKS = 1;\n";

  fs.writeFileSync(SQL_OUTPUT_PATH, sql, "utf-8");
  console.log(`💾 Đã xuất file SQL hoàn chỉnh tại: ${SQL_OUTPUT_PATH}`);

  // 2. Kết nối CSDL MySQL và import trực tiếp
  console.log("\n[2/2] Đang kiểm tra kết nối trực tiếp đến CSDL MySQL...");
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    console.log("✅ Kết nối MySQL thành công! Bắt đầu đồng bộ vào database...");

    await sequelize
      .query(
        "ALTER TABLE `comics` MODIFY COLUMN `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;"
      )
      .catch(() => {});

    const [adminUser] = await User.findOrCreate({
      where: { id: 1 },
      defaults: {
        username: "admin_duc",
        password: "admin_hashed_default",
        email: "admin@truyentranh.vn",
        role: "ADMIN",
      },
    });

    let successCount = 0;
    let syncedProfilesCount = 0;
    let syncedChapSummariesCount = 0;

    for (let i = 0; i < parsedComics.length; i++) {
      const c = parsedComics[i];
      process.stdout.write(
        `\r[${i + 1}/${parsedComics.length}] Đang đồng bộ: "${c.title.slice(0, 35)}..."           `
      );

      // 1. Tạo hoặc cập nhật Comic
      const [comicRecord] = await Comic.findOrCreate({
        where: { slug: c.slug },
        defaults: {
          uploaderId: adminUser.id,
          title: c.title,
          slug: c.slug,
          originName: c.originName,
          author: c.author,
          description: c.description,
          thumbUrl: c.thumbUrl,
          status: c.status,
          totalViews: Math.floor(Math.random() * 4000) + 1200,
          ratingAvg: (4.8 + Math.random() * 0.2).toFixed(2),
          totalRatings: Math.floor(Math.random() * 80) + 20,
        },
      });

      await comicRecord.update(
        {
          title: c.title,
          originName: c.originName,
          author: c.author,
          description: c.description,
          thumbUrl: c.thumbUrl,
          status: c.status,
        },
        { silent: true }
      );

      // 2. Đồng bộ Hồ sơ AI của bộ truyện (ComicAiProfile từ main.txt.docx)
      if (c.aiProfile) {
        const p = c.aiProfile;
        const [profRecord, created] = await ComicAiProfile.findOrCreate({
          where: { comicId: comicRecord.id },
          defaults: {
            comicId: comicRecord.id,
            mainCharacter: p.mainCharacter,
            femaleLead: p.femaleLead,
            powerType: p.powerType,
            powerDescription: p.powerDescription,
            personalityTraits: p.personalityTraits,
            supportingCast: p.supportingCast,
            storyPremise: p.storyPremise,
          },
        });
        if (!created) {
          await profRecord.update({
            mainCharacter: p.mainCharacter,
            femaleLead: p.femaleLead,
            powerType: p.powerType,
            powerDescription: p.powerDescription,
            personalityTraits: p.personalityTraits,
            supportingCast: p.supportingCast,
            storyPremise: p.storyPremise,
          });
        }
        syncedProfilesCount++;
      }

      // 3. Thể loại
      for (const g of c.genres) {
        const [genreRecord] = await Genre.findOrCreate({
          where: { slug: g.slug },
          defaults: { name: g.name, slug: g.slug },
        });

        await ComicGenre.findOrCreate({
          where: {
            comicId: comicRecord.id,
            genreId: genreRecord.id,
          },
        });
      }

      // 4. Chương, Trang & Tóm tắt AI chương (ChapterAiSummary từ <chương>.txt.docx)
      for (const ch of c.chapters) {
        const [chapRecord, chapCreated] = await Chapter.findOrCreate({
          where: {
            comicId: comicRecord.id,
            chapterNumber: ch.chapterNumber,
          },
          defaults: {
            comicId: comicRecord.id,
            chapterNumber: ch.chapterNumber,
            chapterName: ch.chapterName,
            status: "PUBLISHED",
            views: Math.floor(comicRecord.totalViews / 3),
          },
        });

        if (!chapCreated && chapRecord.chapterName !== ch.chapterName) {
          await chapRecord.update({ chapterName: ch.chapterName }, { silent: true });
        }

        if (ch.aiSummary) {
          const s = ch.aiSummary;
          const [sumRecord, sumCreated] = await ChapterAiSummary.findOrCreate({
            where: { chapterId: chapRecord.id },
            defaults: {
              chapterId: chapRecord.id,
              summaryText: s.summaryText,
              keyPlotPoints: s.keyPlotPoints,
              characterActions: s.characterActions,
              spoilersDetected: [],
            },
          });
          if (!sumCreated) {
            await sumRecord.update({
              summaryText: s.summaryText,
              keyPlotPoints: s.keyPlotPoints,
              characterActions: s.characterActions,
            });
          }
          syncedChapSummariesCount++;
        }

        await ChapterPage.destroy({ where: { chapterId: chapRecord.id } });

        if (ch.pages.length > 0) {
          const pageRecords = ch.pages.map((p) => ({
            chapterId: chapRecord.id,
            pageNumber: p.pageNumber,
            imageUrl: p.imageUrl,
          }));
          await ChapterPage.bulkCreate(pageRecords);
        }
      }

      successCount++;
    }

    console.log(
      `\n\n🎉 ĐỒNG BỘ THÀNH CÔNG VÀO CSDL MYSQL:`
    );
    console.log(`   - Số bộ truyện: ${successCount}/${parsedComics.length}`);
    console.log(`   - Hồ sơ AI truyện (comic_ai_profiles): ${syncedProfilesCount}`);
    console.log(`   - Tóm tắt AI chương (chapter_ai_summaries): ${syncedChapSummariesCount}`);
    process.exit(0);
  } catch (dbErr) {
    console.warn(
      "\n⚠️ Không thể kết nối MySQL tại thời điểm này (có thể MySQL/XAMPP chưa được bật)."
    );
    console.warn(`Chi tiết lỗi: ${dbErr.message}`);
    console.log("\n💡 ĐỪNG LO! File SQL hoàn chỉnh đã được tạo sẵn tại:");
    console.log(`👉 ${SQL_OUTPUT_PATH}`);
    process.exit(0);
  }
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isDirectRun) {
  run();
}
