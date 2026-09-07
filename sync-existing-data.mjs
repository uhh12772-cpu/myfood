import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SUPABASE_URL = "https://fmiofxxamaikydeysmly.supabase.co";
const SUPABASE_REST = `${SUPABASE_URL}/rest/v1`;
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtaW9meHhhbWFpa3lkZXlzbWx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NjU5OTUsImV4cCI6MjEwNDM0MTk5NX0.qPl6aYpQr2-DRph1s1IbClKJQALvwUE3OnkSmJMra10";
const BUCKET = "dish-images";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const baseDishes = [
  { name: "甜水果汤", file: "jingtai/assets/plate_01_top_soup.jpg", voteCount: 2, createdAt: "2026-08-16T23:56:16.000Z" },
  { name: "米饭", file: "jingtai/assets/plate_02_top_rice.jpg", voteCount: 5, createdAt: "2026-08-16T23:56:16.000Z" },
  { name: "苹果", file: "jingtai/assets/plate_03_top_fruit.jpg", voteCount: 1, createdAt: "2026-08-16T23:56:16.000Z" },
  { name: "炒牛肉", file: "jingtai/assets/dish_04_r1c1.jpg", voteCount: 8, createdAt: "2026-08-16T23:56:16.000Z" },
  { name: "肉米炖蛋", file: "jingtai/assets/dish_05_r1c2.jpg", voteCount: 4, createdAt: "2026-08-16T23:56:16.000Z" },
  { name: "蒸南瓜", file: "jingtai/assets/dish_06_r1c3.jpg", voteCount: 3, createdAt: "2026-08-16T23:56:16.000Z" },
  { name: "菜饭", file: "jingtai/assets/dish_07_r1c4.jpg", voteCount: 6, createdAt: "2026-08-16T23:56:16.000Z" },
  { name: "红烧肉", file: "jingtai/assets/dish_08_r2c1.jpg", voteCount: 9, createdAt: "2026-08-16T23:56:16.000Z" },
  { name: "清炒青菜", file: "jingtai/assets/dish_09_r2c2.jpg", voteCount: 2, createdAt: "2026-08-16T23:56:16.000Z" },
  { name: "番茄炒蛋", file: "jingtai/assets/dish_10_r2c3.jpg", voteCount: 7, createdAt: "2026-08-16T23:56:16.000Z" },
  { name: "土豆烧牛肉", file: "jingtai/assets/dish_11_r2c4.jpg", voteCount: 5, createdAt: "2026-08-16T23:56:16.000Z" },
  { name: "鱼香肉丝", file: "jingtai/assets/dish_12_r3c1.jpg", voteCount: 4, createdAt: "2026-08-16T23:56:16.000Z" },
  { name: "宫保鸡丁", file: "jingtai/assets/dish_13_r3c2.jpg", voteCount: 10, createdAt: "2026-08-16T23:56:16.000Z" },
  { name: "鸡蛋羹", file: "jingtai/assets/dish_14_r3c3.jpg", voteCount: 3, createdAt: "2026-08-16T23:56:16.000Z" },
  { name: "红烧鸭块", file: "jingtai/assets/dish_15_r3c4.jpg", voteCount: 6, createdAt: "2026-08-16T23:56:16.000Z" }
];

const dayIds = ["monday", "tuesday", "wednesday", "thursday", "friday"];
const mealIds = ["breakfast", "lunch", "dinner"];

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function extensionToMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

function encodePath(value) {
  return String(value).split("/").map(encodeURIComponent).join("/");
}

function publicImageUrl(imagePath) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodePath(imagePath)}`;
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function restFetch(pathname, options = {}) {
  const url = `${SUPABASE_REST}/${pathname.replace(/^\/+/, "")}`;
  const headers = new Headers(options.headers || {});
  headers.set("apikey", SUPABASE_ANON_KEY);
  headers.set("Authorization", `Bearer ${SUPABASE_ANON_KEY}`);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(url, { ...options, headers });
  const payload = await parseResponse(response);
  if (!response.ok) {
    const message = payload?.message || payload?.error || payload?.hint || response.statusText;
    throw new Error(message);
  }
  return payload;
}

async function storageUpload(localFilePath, remotePath, mimeType) {
  const absolute = path.join(ROOT, localFilePath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`missing file: ${localFilePath}`);
  }
  const body = fs.readFileSync(absolute);
  await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodePath(remotePath)}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": mimeType,
      "x-upsert": "true"
    },
    body
  }).then(async (response) => {
    const payload = await parseResponse(response);
    if (!response.ok) {
      const message = payload?.message || payload?.error || payload?.hint || response.statusText;
      throw new Error(message);
    }
  });
}

function mergeImportedDishes() {
  const legacy = readJson(path.join(ROOT, "data", "dishes.json"), []);
  const byName = new Map(baseDishes.map((dish) => [dish.name, { ...dish }]));

  for (const item of legacy) {
    const name = String(item?.name || "").trim();
    if (!name) continue;
    const existing = byName.get(name);
    if (existing) {
      existing.createdAt = item.createdAt || existing.createdAt;
      existing.legacyImageUrl = item.imageUrl || existing.legacyImageUrl || "";
      byName.set(name, existing);
      continue;
    }
    const imageUrl = String(item.imageUrl || "");
    const localImage = imageUrl.replace(/^\/+/, "");
    byName.set(name, {
      name,
      file: localImage,
      voteCount: Number(item.voteCount || 0),
      createdAt: item.createdAt || new Date().toISOString()
    });
  }

  return [...byName.values()];
}

async function importDishRows() {
  const dishes = mergeImportedDishes();
  let created = 0;
  let updated = 0;

  for (const dish of dishes) {
    const remoteFileName = path.basename(dish.file || `${dish.name}.jpg`);
    const remotePath = `seed/${remoteFileName}`;
    const localFile = dish.file || `jingtai/assets/${remoteFileName}`;
    const mimeType = extensionToMime(localFile);

    if (fs.existsSync(path.join(ROOT, localFile))) {
      await storageUpload(localFile, remotePath, mimeType);
    } else if (dish.legacyImageUrl) {
      const legacyPath = dish.legacyImageUrl.replace(/^\/+/, "");
      if (fs.existsSync(path.join(ROOT, legacyPath))) {
        await storageUpload(legacyPath, remotePath, extensionToMime(legacyPath));
      } else {
        console.log(`Skip image for ${dish.name}: ${localFile} not found`);
        continue;
      }
    } else {
      console.log(`Skip dish ${dish.name}: no image file`);
      continue;
    }

    const imagePath = remotePath;
    const imageUrl = publicImageUrl(imagePath);
    const existing = await restFetch(`dishes?select=id,name,image_path,image_url,vote_count,created_at&name=eq.${encodeURIComponent(dish.name)}&limit=1`);
    const voteCount = Array.isArray(existing) && existing.length
      ? Math.max(Number(existing[0].vote_count || 0), Number(dish.voteCount || 0))
      : Number(dish.voteCount || 0);

    const payload = {
      name: dish.name,
      image_url: imageUrl,
      image_path: imagePath,
      mime_type: mimeType,
      vote_count: voteCount,
      created_at: dish.createdAt
    };

    if (Array.isArray(existing) && existing.length) {
      await restFetch(`dishes?id=eq.${encodeURIComponent(existing[0].id)}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" }
      });
      await restFetch("dishes", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload)
      });
      updated += 1;
    } else {
      await restFetch("dishes", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload)
      });
      created += 1;
    }
    console.log(`${Array.isArray(existing) && existing.length ? "Updated" : "Inserted"} dish: ${dish.name}`);
  }

  return { created, updated, total: dishes.length };
}

async function importWeeklyMenu() {
  const menu = readJson(path.join(ROOT, "data", "weekly-menu.json"), {});
  const rows = [];

  for (const [dayIndex, dayId] of dayIds.entries()) {
    for (const mealId of mealIds) {
      const value = menu?.[dayId]?.[mealId];
      const items = Array.isArray(value) ? value : (value ? [value] : []);
      items.map((item) => String(item || "").trim()).filter(Boolean).forEach((dishName, sortOrder) => {
        rows.push({
          weekday: dayIndex + 1,
          meal_type: mealId,
          dish_name: dishName,
          sort_order: sortOrder
        });
      });
    }
  }

  if (!rows.length) return { total: 0 };

  const payload = rows.map((row) => ({ ...row, dish_id: null }));
  await restFetch("weekly_menu_items", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(payload)
  });

  return { total: payload.length };
}

async function main() {
  console.log("Syncing dishes to Supabase...");
  const dishResult = await importDishRows();
  console.log(`Dish sync done. created=${dishResult.created}, updated=${dishResult.updated}, total=${dishResult.total}`);

  const weeklyResult = await importWeeklyMenu();
  console.log(`Weekly menu sync done. total=${weeklyResult.total}`);

  console.log("Finished.");
}

main().catch((error) => {
  console.error("Sync failed:", error.message);
  process.exitCode = 1;
});
