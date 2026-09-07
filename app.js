const CONFIG = {
  supabaseUrl: "https://fmiofxxamaikydeysmly.supabase.co",
  restUrl: "https://fmiofxxamaikydeysmly.supabase.co/rest/v1",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtaW9meHhhbWFpa3lkZXlzbWx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NjU5OTUsImV4cCI6MjEwNDM0MTk5NX0.qPl6aYpQr2-DRph1s1IbClKJQALvwUE3OnkSmJMra10",
  bucket: "dish-images",
  adminUsername: "admin",
  adminPassword: "admin"
};

const ADMIN_STATE_KEY = "dish-menu-supabase-admin-v1";
const DISH_COLUMNS = "id,name,image_url,image_path,mime_type,vote_count,created_at,updated_at";
const COMMENT_COLUMNS = "id,dish_id,content,like_count,created_at,updated_at";
const DISH_CACHE_MS = 12000;

const menuView = document.querySelector("#menuView");
const weekView = document.querySelector("#weekView");
const voteView = document.querySelector("#voteView");
const rankView = document.querySelector("#rankView");
const adminView = document.querySelector("#adminView");
const resultGrid = document.querySelector("#resultGrid");
const recognitionGrid = document.querySelector("#recognitionGrid");
const adminGrid = document.querySelector("#adminGrid");
const voteGrid = document.querySelector("#voteGrid");
const rankList = document.querySelector("#rankList");
const searchMessage = document.querySelector("#searchMessage");
const recognitionMessage = document.querySelector("#recognitionMessage");
const adminMessage = document.querySelector("#adminMessage");
const weeklyMessage = document.querySelector("#weeklyMessage");
const voteMessage = document.querySelector("#voteMessage");
const rankMessage = document.querySelector("#rankMessage");
const imagePreview = document.querySelector("#imagePreview");
const commentModal = document.querySelector("#commentModal");
const commentTitle = document.querySelector("#commentTitle");
const commentList = document.querySelector("#commentList");
const commentInput = document.querySelector("#commentInput");
const commentMessage = document.querySelector("#commentMessage");
const adminModal = document.querySelector("#adminModal");
const adminLoginMessage = document.querySelector("#adminLoginMessage");

let allDishes = [];
let dishCacheTime = 0;
let dishLoadPromise = null;
let selectedDishFile = null;
let selectedDishBlob = null;
let selectedDishMimeType = "image/jpeg";
let selectedRecognitionFile = null;
let weeklyMenu = {};
let adminSearchTimer = null;
let activeCommentDish = null;
let currentView = "menu";

const days = [
  { id: "monday", value: 1, label: "星期一" },
  { id: "tuesday", value: 2, label: "星期二" },
  { id: "wednesday", value: 3, label: "星期三" },
  { id: "thursday", value: 4, label: "星期四" },
  { id: "friday", value: 5, label: "星期五" }
];

const meals = [
  { id: "breakfast", label: "早餐" },
  { id: "lunch", label: "午餐" },
  { id: "dinner", label: "晚餐" }
];

const menuNameLexicon = [
  "蒜泥白肉", "猪肉炖粉条", "宫保鸡丁", "红烧鸭块", "番茄牛腩", "蒸广东腊肠", "雪菜蒸小黄鱼", "酸菜鱼",
  "水煮肉片", "黄焖鸡", "黑椒牛柳", "干锅牛腩", "红烧狮子头", "咖喱鸡块", "土豆烧牛肉", "干煎带鱼",
  "菠萝咕咾肉", "大盘鸡", "水煮牛肉", "虾仁土鸡蛋", "腐竹红烧肉", "盐水鸭", "红烧牛腩", "鱼香肉丝",
  "干锅千页豆腐", "咸肉冬瓜", "土豆丝炒肉丝", "黄瓜炒蛋", "干锅花菜", "包菜肉片", "青椒毛豆肉丝",
  "肉末茄子", "小葱炒蛋", "双菇肉片", "肉末豆腐", "番茄炒蛋", "肉末小土豆", "包菜粉丝炒蛋",
  "白木耳炒肉片", "木须肉", "芹菜香干", "葱油芋艿", "蒜泥青菜", "豆豉油麦菜", "酸辣海带丝",
  "酸辣大白菜", "清炒莴菜", "包菜粉丝", "葱油南瓜", "五香素鸡", "黄豆芽炒油方", "酸辣土豆丝",
  "清炒生菜", "韭菜银芽", "冬瓜扁尖", "芥菜豆腐羹", "榨菜肉丝汤", "丝瓜蛋汤", "海带玉米汤",
  "冬瓜排骨汤", "菌菇汤", "鸭血豆腐羹", "酸辣汤", "鱼头豆腐汤", "番茄蛋汤", "绿豆汤", "红枣南瓜汤",
  "红枣银耳羹", "水果甜汤", "酒酿小圆子", "肉丝炒年糕", "关东煮", "黑胡椒猪扒饭", "麻辣香锅",
  "鸡米花", "海苔牛肉炒饭", "上校鸡块", "冬阴功汤米粉", "山药", "蒸土豆", "白玉米", "南瓜",
  "蒸黄豆", "紫薯", "红薯", "五香花生", "毛芋艿", "五常米饭", "杂粮饭", "藜麦饭", "奶黄包",
  "鸡蛋羹", "刀切馒头", "红糖发糕", "春卷", "红糖馒头", "豆沙包", "黑糖米糕", "桂花糕",
  "海鲜炒粉丝", "酸奶", "梨", "橘子", "冰糖雪梨", "苹果", "水蜜桃汁"
];

const localDishSignals = /(红烧|清炒|蒜蓉|蒜泥|香煎|炒|烧|炖|煮|蒸|煎|烤|爆|卤|拌|油焖|汤|羹|饭|粥|面|粉|糕|包|馒|蛋|肉|鱼|虾|蟹|鸡|鸭|牛|羊|猪|豆腐|青菜|生菜|西兰花|茄子|黄瓜|冬瓜|芹菜|香干|香肠|鸡腿|南瓜|土豆|红薯|紫薯|玉米|苹果|梨|橘子|酸奶)/u;
const nonDishWords = new Set([
  "今天", "明天", "本周", "菜单", "菜品", "菜名", "早餐", "午餐", "晚餐", "早饭", "午饭", "晚饭",
  "星期一", "星期二", "星期三", "星期四", "星期五", "周一", "周二", "周三", "周四", "周五",
  "安排", "供应", "包括", "如下", "学生", "老师", "水果", "饮料", "主食", "汤品"
]);

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}

function createEmptyWeeklyMenu() {
  return Object.fromEntries(days.map((day) => [
    day.id,
    Object.fromEntries(meals.map((meal) => [meal.id, [""]]))
  ]));
}

function normalizeForDishMatch(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\u3400-\u9fffa-z0-9]/gi, "");
}

function cleanExtractedDishName(value) {
  return String(value || "")
    .replace(/[0-9０-９]+/g, "")
    .replace(/^(水果|饮料|主食|汤品|菜品|早餐|午餐|晚餐)(是|为|有)?/u, "")
    .replace(/^[的有和及与加配是为]+/u, "")
    .replace(/[的有和及与加配是为]+$/u, "")
    .replace(/[^\u3400-\u9fffA-Za-z0-9]/g, "")
    .trim();
}

function isAdmin() {
  return sessionStorage.getItem(ADMIN_STATE_KEY) === "yes";
}

function setAdmin(value) {
  if (value) sessionStorage.setItem(ADMIN_STATE_KEY, "yes");
  else sessionStorage.removeItem(ADMIN_STATE_KEY);
  updateAdminState();
}

function updateAdminState() {
  const adminLoginButton = document.querySelector("#adminLoginButton");
  const adminLogoutButton = document.querySelector("#adminLogoutButton");
  const adminStatusText = document.querySelector("#adminStatusText");
  if (isAdmin()) {
    adminLoginButton.textContent = "管理员已登录";
    adminStatusText.textContent = "管理员模式已开启，当前页面仍按公开维护规则连接 Supabase。";
    adminLogoutButton.classList.remove("hidden");
  } else {
    adminLoginButton.textContent = "管理员登录";
    adminStatusText.textContent = "当前为公开维护模式，管理员账号可登录确认：admin / admin";
    adminLogoutButton.classList.add("hidden");
  }
}

function createId(prefix = "item") {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function encodeStoragePath(path) {
  return String(path).split("/").map(encodeURIComponent).join("/");
}

function publicImageUrl(path) {
  if (!path) return "";
  return `${CONFIG.supabaseUrl}/storage/v1/object/public/${CONFIG.bucket}/${encodeStoragePath(path)}`;
}

function normalizeDish(row) {
  const imagePath = row.image_path || "";
  return {
    id: row.id,
    name: row.name || "",
    imageUrl: row.image_url || publicImageUrl(imagePath),
    imagePath,
    mimeType: row.mime_type || "",
    voteCount: Number(row.vote_count || 0),
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
    topComment: row.topComment || null
  };
}

function normalizeComment(row) {
  return {
    id: row.id,
    dishId: row.dish_id,
    content: row.content || "",
    likeCount: Number(row.like_count || 0),
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || row.created_at || new Date().toISOString()
  };
}

function friendlyError(error) {
  const message = String(error?.message || error || "");
  if (/image_blob|violates row-level security|row-level security|permission denied|storage/i.test(message)) {
    return "Supabase 权限或图片字段还没准备好，请先执行 new/supabase-direct-setup.sql。";
  }
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
    return "连接 Supabase 失败，请检查网络、Project URL、anon key 和 Supabase 项目状态。";
  }
  return message || "操作失败，请稍后重试。";
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

async function supabaseFetch(path, options = {}) {
  const url = path.startsWith("http") ? path : `${CONFIG.restUrl}/${path.replace(/^\/+/, "")}`;
  const headers = new Headers(options.headers || {});
  headers.set("apikey", CONFIG.anonKey);
  headers.set("Authorization", `Bearer ${CONFIG.anonKey}`);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(url, { ...options, headers });
  const payload = await parseResponse(response);
  if (!response.ok) {
    const message = payload?.message || payload?.error || payload?.hint || response.statusText;
    throw new Error(message);
  }
  return payload;
}

async function storageFetch(path, options = {}) {
  const url = `${CONFIG.supabaseUrl}/storage/v1/${path.replace(/^\/+/, "")}`;
  const headers = new Headers(options.headers || {});
  headers.set("apikey", CONFIG.anonKey);
  headers.set("Authorization", `Bearer ${CONFIG.anonKey}`);
  const response = await fetch(url, { ...options, headers });
  const payload = await parseResponse(response);
  if (!response.ok) {
    const message = payload?.message || payload?.error || response.statusText;
    throw new Error(message);
  }
  return payload;
}

async function loadAllDishes(force = false) {
  const now = Date.now();
  if (!force && allDishes.length && now - dishCacheTime < DISH_CACHE_MS) return allDishes;
  if (dishLoadPromise) return dishLoadPromise;
  dishLoadPromise = (async () => {
    const rows = await supabaseFetch(`dishes?select=${DISH_COLUMNS}&order=created_at.desc&limit=5000`);
    allDishes = Array.isArray(rows) ? rows.map(normalizeDish).filter((dish) => dish.id && dish.name) : [];
    dishCacheTime = Date.now();
    return allDishes;
  })().finally(() => {
    dishLoadPromise = null;
  });
  return dishLoadPromise;
}

function filterDishes(dishes, name = "", sort = "") {
  const query = normalizeForDishMatch(name);
  const filtered = dishes.filter((dish) => !query || normalizeForDishMatch(dish.name).includes(query));
  if (sort === "votes") {
    return [...filtered].sort((a, b) =>
      Number(b.voteCount || 0) - Number(a.voteCount || 0) ||
      a.name.localeCompare(b.name, "zh-CN")
    );
  }
  return [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function fetchDishes(name = "", sort = "") {
  const dishes = await loadAllDishes();
  return filterDishes(dishes, name, sort);
}

function findDishForName(name) {
  const normalized = normalizeForDishMatch(name);
  if (!normalized) return null;
  const exact = allDishes.find((dish) => normalizeForDishMatch(dish.name) === normalized);
  if (exact) return exact;
  return allDishes
    .filter((dish) => {
      const dishName = normalizeForDishMatch(dish.name);
      return normalized.includes(dishName) || dishName.includes(normalized);
    })
    .sort((a, b) => normalizeForDishMatch(b.name).length - normalizeForDishMatch(a.name).length)[0] || null;
}

function pickTopComment(comments) {
  if (!comments.length) return null;
  const maxLikes = Math.max(...comments.map((comment) => Number(comment.likeCount || 0)));
  const candidates = comments.filter((comment) => Number(comment.likeCount || 0) === maxLikes);
  return candidates[Math.floor(Math.random() * candidates.length)] || null;
}

async function attachTopComments(dishes) {
  if (!dishes.length) return dishes;
  try {
    const rows = await supabaseFetch(`dish_comments?select=${COMMENT_COLUMNS}&order=like_count.desc,created_at.desc&limit=5000`);
    const grouped = new Map();
    for (const row of Array.isArray(rows) ? rows : []) {
      const comment = normalizeComment(row);
      const bucket = grouped.get(comment.dishId) || [];
      bucket.push(comment);
      grouped.set(comment.dishId, bucket);
    }
    return dishes.map((dish) => ({ ...dish, topComment: pickTopComment(grouped.get(dish.id) || []) }));
  } catch {
    return dishes;
  }
}

function renderDishImage(dish) {
  return dish.imageUrl
    ? `<img src="${escapeHtml(dish.imageUrl)}" alt="${escapeHtml(dish.name)}" />`
    : `<div class="image-fallback">暂无图片</div>`;
}

function renderCards(target, dishes, emptyText, options = {}) {
  target.innerHTML = dishes.length
    ? dishes.map((dish) => `
      <article class="dish-card">
        ${renderDishImage(dish)}
        <div class="dish-info">
          <h3>${escapeHtml(dish.name)}</h3>
          <span>${new Date(dish.createdAt).toLocaleDateString("zh-CN")}</span>
        </div>
        ${options.deleteButton ? `
          <div class="card-actions">
            <span>${Number(dish.voteCount || 0)} 票</span>
            <button class="danger delete-dish" type="button" data-id="${escapeHtml(dish.id)}">删除</button>
          </div>` : ""}
      </article>`).join("")
    : `<div class="empty-state">${escapeHtml(emptyText)}</div>`;

  if (options.deleteButton) {
    target.querySelectorAll(".delete-dish").forEach((button) => {
      button.addEventListener("click", () => deleteDish(button.dataset.id, button));
    });
  }
}

async function searchDishes(name) {
  searchMessage.textContent = "正在搜索...";
  try {
    const dishes = await fetchDishes(name);
    renderCards(resultGrid, dishes, "没有找到对应图片，请先在后台录入。");
    searchMessage.textContent = dishes.length ? `找到 ${dishes.length} 条结果。` : "没有找到对应菜品。";
  } catch (error) {
    resultGrid.innerHTML = "";
    searchMessage.textContent = friendlyError(error);
  }
}

function getDishCandidates() {
  const candidates = new Map();
  for (const dish of allDishes) {
    const normalized = normalizeForDishMatch(dish.name);
    if (!normalized) continue;
    candidates.set(normalized, { name: dish.name, normalized, dish });
  }
  for (const name of menuNameLexicon) {
    const normalized = normalizeForDishMatch(name);
    if (!normalized || candidates.has(normalized)) continue;
    candidates.set(normalized, { name, normalized, dish: findDishForName(name) });
  }
  return [...candidates.values()].sort((a, b) => b.normalized.length - a.normalized.length);
}

function extractKnownDishMatches(sourceText) {
  const normalizedSource = normalizeForDishMatch(sourceText);
  if (!normalizedSource) return [];
  const occurrences = [];
  for (const candidate of getDishCandidates()) {
    let start = normalizedSource.indexOf(candidate.normalized);
    while (start !== -1) {
      occurrences.push({ ...candidate, start, end: start + candidate.normalized.length });
      start = normalizedSource.indexOf(candidate.normalized, start + 1);
    }
  }
  occurrences.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const accepted = [];
  const seen = new Set();
  for (const item of occurrences) {
    if (seen.has(item.normalized)) continue;
    if (accepted.some((acceptedItem) => item.start < acceptedItem.end && item.end > acceptedItem.start)) continue;
    accepted.push(item);
    seen.add(item.normalized);
  }
  return accepted.sort((a, b) => a.start - b.start);
}

function extractLikelyDishNames(sourceText) {
  const segments = String(sourceText || "")
    .replace(/[\r\n\t]+/g, "\n")
    .replace(/[()（）【】[\]{}<>《》]/g, "\n")
    .replace(/[、，,。；;:：|/\\]+/g, "\n")
    .split(/\s+|\n+/)
    .map(cleanExtractedDishName)
    .filter(Boolean);
  const names = [];
  const seen = new Set();
  for (const segment of segments) {
    if (segment.length < 2 || segment.length > 18) continue;
    if (!/[\u3400-\u9fff]/.test(segment)) continue;
    if (nonDishWords.has(segment)) continue;
    if (/^(今天|明天|本周|菜单|星期|周[一二三四五六日天])/.test(segment)) continue;
    if (!localDishSignals.test(segment)) continue;
    const normalized = normalizeForDishMatch(segment);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    names.push(segment);
  }
  return names;
}

function createRecognitionItem(name, dish = null, source = "smart") {
  return {
    name,
    dishId: dish?.id || null,
    imageUrl: dish?.imageUrl || "",
    matchedName: dish?.name || null,
    source
  };
}

function mergeRecognitionItems(groups) {
  const ordered = [];
  const seen = new Set();
  for (const group of groups) {
    for (const item of group) {
      if (!item.name) continue;
      const key = item.dishId ? `dish:${item.dishId}` : `name:${normalizeForDishMatch(item.name)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      ordered.push(item);
    }
  }
  return ordered;
}

function recognizeDishesFromText(text) {
  const knownItems = extractKnownDishMatches(text).map((item) => createRecognitionItem(item.name, item.dish, "known"));
  const smartItems = extractLikelyDishNames(text).map((name) => createRecognitionItem(name, findDishForName(name), "smart"));
  return mergeRecognitionItems([knownItems, smartItems]);
}

function renderRecognizedDishes(items) {
  recognitionGrid.innerHTML = items.length
    ? items.map((item) => `
      <article class="recognized-card">
        <div class="recognized-media${item.imageUrl ? "" : " empty"}">
          ${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" />` : ""}
        </div>
        <div class="recognized-info">
          <h3>${escapeHtml(item.name)}</h3>
          <span>${item.imageUrl ? "已匹配图片" : "暂无图片"}</span>
        </div>
      </article>`).join("")
    : `<div class="empty-state">没有识别到菜名。</div>`;
}

async function recognizeImageTextInBrowser() {
  if (!selectedRecognitionFile || typeof window.TextDetector !== "function") {
    return { text: "", supported: false };
  }
  try {
    const detector = new window.TextDetector();
    const bitmap = await createImageBitmap(selectedRecognitionFile);
    const results = await detector.detect(bitmap);
    if (typeof bitmap.close === "function") bitmap.close();
    return { text: results.map((item) => item.rawValue).filter(Boolean).join("\n"), supported: true };
  } catch {
    return { text: "", supported: true };
  }
}

async function recognizeMenuInput() {
  const text = document.querySelector("#recognitionText").value.trim();
  const submitButton = document.querySelector("#recognitionForm button[type='submit']");
  if (!text && !selectedRecognitionFile) {
    recognitionMessage.textContent = "请先输入菜单文字或选择图片。";
    return;
  }
  submitButton.disabled = true;
  recognitionMessage.textContent = "正在识别...";
  try {
    await loadAllDishes();
    const imageResult = await recognizeImageTextInBrowser();
    const combinedText = [text, imageResult.text].filter(Boolean).join("\n");
    const items = recognizeDishesFromText(combinedText);
    const matchedCount = items.filter((item) => item.imageUrl).length;
    const ocrNotice = selectedRecognitionFile && !imageResult.text
      ? (imageResult.supported ? " 图片文字没有识别出结果，可把菜单文字粘贴到输入框。" : " 当前浏览器不支持图片文字 OCR，可把菜单文字粘贴到输入框。")
      : "";
    renderRecognizedDishes(items);
    recognitionMessage.textContent = items.length
      ? `识别到 ${items.length} 个菜名，${matchedCount} 个已匹配图片。${ocrNotice}`
      : `没有识别到菜名。${ocrNotice}`;
  } catch (error) {
    recognitionMessage.textContent = friendlyError(error);
  } finally {
    submitButton.disabled = false;
  }
}

async function loadAdminDishes(name = "") {
  adminMessage.textContent = "正在加载菜品...";
  try {
    const dishes = await fetchDishes(name);
    document.querySelector("#adminCount").textContent = `${dishes.length} 条记录`;
    renderCards(adminGrid, dishes, "还没有录入菜品。", { deleteButton: true });
    adminMessage.textContent = dishes.length ? "数据已从 Supabase 加载。" : "";
  } catch (error) {
    adminGrid.innerHTML = "";
    document.querySelector("#adminCount").textContent = "0 条记录";
    adminMessage.textContent = friendlyError(error);
  }
}

async function loadVoteDishes() {
  voteMessage.textContent = "正在加载菜品...";
  try {
    const dishes = await attachTopComments(await fetchDishes(""));
    renderVoteCards(dishes);
    voteMessage.textContent = dishes.length ? "" : "还没有菜品，请先在后台录入。";
  } catch (error) {
    voteGrid.innerHTML = "";
    voteMessage.textContent = friendlyError(error);
  }
}

function renderVoteCards(dishes) {
  document.querySelector("#voteCount").textContent = `${dishes.length} 个菜品`;
  voteGrid.innerHTML = dishes.length
    ? dishes.map((dish) => `
      <article class="vote-card">
        <div class="vote-media">
          ${renderDishImage(dish)}
          <p class="top-comment">${dish.topComment ? `热门评论：${escapeHtml(dish.topComment.content)} <span>${Number(dish.topComment.likeCount || 0)} 赞</span>` : "暂无评论"}</p>
        </div>
        <div class="vote-body">
          <h3>${escapeHtml(dish.name)}</h3>
          <div class="vote-actions">
            <button class="primary vote-button" type="button" data-id="${escapeHtml(dish.id)}">投票</button>
            <button class="secondary comment-button" type="button" data-id="${escapeHtml(dish.id)}" data-name="${escapeHtml(dish.name)}">评论</button>
          </div>
          <p>累计投票数：<strong data-vote-total="${escapeHtml(dish.id)}">${Number(dish.voteCount || 0)}</strong></p>
        </div>
      </article>`).join("")
    : `<div class="empty-state">还没有菜品，请先在后台录入。</div>`;

  voteGrid.querySelectorAll(".vote-button").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        const row = await voteDish(button.dataset.id);
        const total = document.querySelector(`[data-vote-total="${CSS.escape(row.id)}"]`);
        if (total) total.textContent = Number(row.voteCount || 0);
        voteMessage.textContent = `已为「${row.name}」投票。`;
      } catch (error) {
        voteMessage.textContent = friendlyError(error);
      } finally {
        button.disabled = false;
      }
    });
  });

  voteGrid.querySelectorAll(".comment-button").forEach((button) => {
    button.addEventListener("click", () => openCommentModal(button.dataset.id, button.dataset.name));
  });
}

async function voteDish(id) {
  const rows = await supabaseFetch("rpc/vote_dish", {
    method: "POST",
    body: JSON.stringify({ p_dish_id: id })
  });
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) throw new Error("投票失败，请重试。");
  const dish = allDishes.find((item) => item.id === row.id);
  if (dish) dish.voteCount = Number(row.vote_count || row.voteCount || 0);
  return {
    id: row.id,
    name: row.name || dish?.name || "",
    voteCount: Number(row.vote_count || row.voteCount || 0)
  };
}

async function loadDishComments(dishId) {
  try {
    const rows = await supabaseFetch(`dish_comments?select=${COMMENT_COLUMNS}&dish_id=eq.${encodeURIComponent(dishId)}&order=like_count.desc,created_at.desc&limit=500`);
    renderComments((Array.isArray(rows) ? rows : []).map(normalizeComment));
    commentMessage.textContent = "";
  } catch (error) {
    renderComments([]);
    commentMessage.textContent = friendlyError(error);
  }
}

function renderComments(comments) {
  commentList.innerHTML = comments.length
    ? comments.map((comment) => `
      <article class="comment-row">
        <p>${escapeHtml(comment.content)}</p>
        <div class="comment-actions">
          <span><strong data-comment-like="${escapeHtml(comment.id)}">${Number(comment.likeCount || 0)}</strong> 赞</span>
          <button class="secondary comment-like" type="button" data-id="${escapeHtml(comment.id)}">点赞</button>
        </div>
      </article>`).join("")
    : `<div class="empty-state">还没有评论。</div>`;

  commentList.querySelectorAll(".comment-like").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        const rows = await supabaseFetch("rpc/like_dish_comment", {
          method: "POST",
          body: JSON.stringify({ p_comment_id: button.dataset.id })
        });
        const row = Array.isArray(rows) ? rows[0] : rows;
        const total = row ? document.querySelector(`[data-comment-like="${CSS.escape(row.id)}"]`) : null;
        if (total) total.textContent = Number(row.like_count || 0);
        commentMessage.textContent = "已点赞。";
      } catch (error) {
        commentMessage.textContent = friendlyError(error);
      } finally {
        button.disabled = false;
      }
    });
  });
}

function openCommentModal(dishId, dishName) {
  activeCommentDish = { id: dishId, name: dishName };
  commentTitle.textContent = `${dishName}的评论`;
  commentInput.value = "";
  commentMessage.textContent = "正在加载评论...";
  commentModal.classList.remove("hidden");
  loadDishComments(dishId);
  commentInput.focus();
}

async function savePendingComment() {
  if (!activeCommentDish) return;
  const content = commentInput.value.trim();
  if (!content) return;
  await supabaseFetch("rpc/add_dish_comment", {
    method: "POST",
    body: JSON.stringify({ p_dish_id: activeCommentDish.id, p_content: content.slice(0, 500) })
  });
  commentInput.value = "";
}

async function closeCommentModal() {
  try {
    await savePendingComment();
  } catch (error) {
    commentMessage.textContent = friendlyError(error);
    return;
  }
  commentModal.classList.add("hidden");
  activeCommentDish = null;
  if (currentView === "vote") loadVoteDishes();
}

async function loadRankingDishes() {
  rankMessage.textContent = "正在加载排行榜...";
  try {
    const dishes = await fetchDishes("", "votes");
    renderRanking(dishes);
  } catch (error) {
    rankList.innerHTML = "";
    rankMessage.textContent = friendlyError(error);
  }
}

function renderRanking(dishes) {
  document.querySelector("#rankCount").textContent = `${dishes.length} 个菜品`;
  rankMessage.textContent = dishes.length ? "按投票数由高到低排序。" : "";
  rankList.innerHTML = dishes.length
    ? dishes.map((dish, index) => {
      const rank = index + 1;
      const isHot = rank <= 5;
      return `
        <article class="rank-row ${isHot ? "rank-hot" : ""}">
          <div class="rank-number">#${rank}</div>
          ${dish.imageUrl ? `<img src="${escapeHtml(dish.imageUrl)}" alt="${escapeHtml(dish.name)}" />` : `<div class="image-fallback rank-fallback">暂无图片</div>`}
          <div class="rank-main">
            <div class="rank-title">
              <h3>${escapeHtml(dish.name)}</h3>
              ${isHot ? `<span class="hot-badge">HOT</span><span class="hot-badge hot-cn">热菜</span>` : ""}
            </div>
            <p>投票数</p>
          </div>
          <div class="rank-votes">${Number(dish.voteCount || 0)}</div>
        </article>`;
    }).join("")
    : `<div class="empty-state">还没有菜品，请先在后台录入。</div>`;
}

function createWeeklyForm() {
  const grid = document.querySelector("#weekGrid");
  grid.innerHTML = days.map((day) => `
    <article class="day-card">
      <div class="day-heading"><h3>${day.label}</h3><span>${day.id === "monday" ? "开始一周" : ""}</span></div>
      ${meals.map((meal) => `
        <div class="meal-slot">
          <div class="meal-header">
            <strong>${meal.label}</strong>
            <button type="button" class="add-dish" data-day="${day.id}" data-meal="${meal.id}" aria-label="添加菜品">+</button>
          </div>
          <div class="dish-list" data-list="${day.id}-${meal.id}"></div>
        </div>`).join("")}
    </article>`).join("");

  for (const day of days) {
    for (const meal of meals) renderMealEntries(day.id, meal.id);
  }
  document.querySelectorAll(".add-dish").forEach((button) => {
    button.addEventListener("click", () => {
      weeklyMenu[button.dataset.day][button.dataset.meal].push("");
      renderMealEntries(button.dataset.day, button.dataset.meal);
    });
  });
}

function renderMealEntries(dayId, mealId) {
  const list = document.querySelector(`[data-list="${dayId}-${mealId}"]`);
  const values = weeklyMenu?.[dayId]?.[mealId] || [""];
  if (!values.length) values.push("");
  list.innerHTML = values.map((value, index) => `
    <div class="dish-entry">
      <div class="entry-input-row">
        <input class="weekly-input" data-day="${dayId}" data-meal="${mealId}" data-index="${index}" value="${escapeHtml(value)}" placeholder="输入菜名" autocomplete="off" />
        <button type="button" class="remove-dish" data-day="${dayId}" data-meal="${mealId}" data-index="${index}" aria-label="删除菜品">&times;</button>
      </div>
      <div class="dish-preview" data-preview="${dayId}-${mealId}-${index}"><span>输入后显示图片</span></div>
      <div class="suggestions" data-suggestions="${dayId}-${mealId}-${index}"></div>
    </div>`).join("");

  list.querySelectorAll(".weekly-input").forEach((input) => {
    input.addEventListener("input", () => {
      weeklyMenu[dayId][mealId][Number(input.dataset.index)] = input.value;
      lookupWeeklyDish(input.value.trim(), dayId, mealId, Number(input.dataset.index));
    });
  });
  list.querySelectorAll(".remove-dish").forEach((button) => {
    button.addEventListener("click", () => {
      weeklyMenu[dayId][mealId].splice(Number(button.dataset.index), 1);
      renderMealEntries(dayId, mealId);
    });
  });
  values.forEach((value, index) => {
    if (value) lookupWeeklyDish(value, dayId, mealId, index);
  });
}

async function lookupWeeklyDish(name, dayId, mealId, index) {
  const key = `${dayId}-${mealId}-${index}`;
  const preview = document.querySelector(`[data-preview="${key}"]`);
  const suggestions = document.querySelector(`[data-suggestions="${key}"]`);
  if (!preview || !suggestions) return;
  if (!name) {
    preview.innerHTML = "<span>输入后显示图片</span>";
    suggestions.innerHTML = "";
    return;
  }
  try {
    const dishes = filterDishes(await loadAllDishes(), name);
    const match = dishes[0];
    preview.innerHTML = match
      ? `${renderDishImage(match)}<strong>${escapeHtml(match.name)}</strong>`
      : "<span>暂无匹配图片</span>";
    suggestions.innerHTML = dishes.slice(0, 4).map((dish) => `
      <button type="button" class="suggestion" data-name="${escapeHtml(dish.name)}">${escapeHtml(dish.name)}</button>`).join("");
    suggestions.querySelectorAll(".suggestion").forEach((button) => {
      button.addEventListener("click", () => {
        const input = document.querySelector(`.weekly-input[data-day="${dayId}"][data-meal="${mealId}"][data-index="${index}"]`);
        if (!input) return;
        input.value = button.dataset.name;
        weeklyMenu[dayId][mealId][index] = button.dataset.name;
        lookupWeeklyDish(button.dataset.name, dayId, mealId, index);
      });
    });
  } catch {
    preview.innerHTML = "<span>图片加载失败</span>";
  }
}

function normalizeWeeklyMenu(input) {
  const result = createEmptyWeeklyMenu();
  for (const day of days) {
    for (const meal of meals) {
      const value = input?.[day.id]?.[meal.id];
      const items = Array.isArray(value) ? value : (value ? [value] : [""]);
      result[day.id][meal.id] = items.map((name) => String(name || "").trim()).filter(Boolean).slice(0, 10);
      if (!result[day.id][meal.id].length) result[day.id][meal.id] = [""];
    }
  }
  return result;
}

async function loadWeeklyMenu() {
  weeklyMessage.textContent = "正在加载一周菜单...";
  try {
    await loadAllDishes();
    const rows = await supabaseFetch("weekly_menu_items?select=id,weekday,meal_type,dish_id,dish_name,sort_order&order=weekday.asc,meal_type.asc,sort_order.asc&limit=1000");
    const loaded = createEmptyWeeklyMenu();
    for (const day of days) {
      for (const meal of meals) loaded[day.id][meal.id] = [];
    }
    for (const row of Array.isArray(rows) ? rows : []) {
      const day = days.find((item) => item.value === Number(row.weekday));
      const meal = meals.find((item) => item.id === row.meal_type);
      if (day && meal && row.dish_name) loaded[day.id][meal.id].push(row.dish_name);
    }
    weeklyMenu = normalizeWeeklyMenu(loaded);
    createWeeklyForm();
    weeklyMessage.textContent = "一周菜单已加载。";
  } catch (error) {
    weeklyMenu = createEmptyWeeklyMenu();
    createWeeklyForm();
    weeklyMessage.textContent = friendlyError(error);
  }
}

async function saveWeeklyMenu() {
  const submitButton = document.querySelector("#weeklyMenuForm button[type='submit']");
  submitButton.disabled = true;
  weeklyMessage.textContent = "正在保存...";
  try {
    const normalized = normalizeWeeklyMenu(weeklyMenu);
    const rows = [];
    for (const day of days) {
      for (const meal of meals) {
        normalized[day.id][meal.id].forEach((name, index) => {
          const cleanName = String(name || "").trim();
          if (!cleanName) return;
          const matchedDish = findDishForName(cleanName);
          rows.push({
            weekday: day.value,
            meal_type: meal.id,
            dish_id: matchedDish?.id || null,
            dish_name: cleanName.slice(0, 120),
            sort_order: index
          });
        });
      }
    }
    await supabaseFetch("weekly_menu_items?weekday=gte.1", {
      method: "DELETE",
      headers: { Prefer: "return=minimal" }
    });
    if (rows.length) {
      await supabaseFetch("weekly_menu_items", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(rows)
      });
    }
    weeklyMenu = normalized;
    weeklyMessage.textContent = "一周菜单已保存到 Supabase。";
  } catch (error) {
    weeklyMessage.textContent = friendlyError(error);
  } finally {
    submitButton.disabled = false;
  }
}

function extensionForType(mimeType) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
}

async function compressImageFile(file) {
  const rawDataUrl = await readFileAsDataUrl(file);
  const image = await loadImageFromDataUrl(rawDataUrl);
  const maxSize = 1600;
  const ratio = Math.min(1, maxSize / image.width, maxSize / image.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * ratio));
  canvas.height = Math.max(1, Math.round(image.height * ratio));
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.84));
  return {
    blob: blob || file,
    previewUrl: canvas.toDataURL("image/jpeg", 0.84),
    mimeType: "image/jpeg"
  };
}

async function uploadDishImage(blob, mimeType) {
  const today = new Date().toISOString().slice(0, 10);
  const imagePath = `dishes/${today}/${createId("dish")}.${extensionForType(mimeType)}`;
  await storageFetch(`object/${CONFIG.bucket}/${encodeStoragePath(imagePath)}`, {
    method: "POST",
    headers: {
      "Content-Type": mimeType,
      "x-upsert": "false"
    },
    body: blob
  });
  return {
    imagePath,
    imageUrl: publicImageUrl(imagePath)
  };
}

async function removeDishImage(imagePath) {
  if (!imagePath) return;
  await storageFetch(`object/${CONFIG.bucket}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: [imagePath] })
  });
}

async function createDish(event) {
  event.preventDefault();
  const submitButton = document.querySelector("#dishForm button[type='submit']");
  const name = document.querySelector("#dishName").value.trim().slice(0, 120);
  if (!name || !selectedDishBlob) {
    adminMessage.textContent = "请填写菜名并选择图片。";
    return;
  }
  submitButton.disabled = true;
  adminMessage.textContent = "正在上传图片...";
  let uploaded = null;
  try {
    uploaded = await uploadDishImage(selectedDishBlob, selectedDishMimeType);
    adminMessage.textContent = "图片已上传，正在保存菜品...";
    const rows = await supabaseFetch("dishes", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        name,
        image_url: uploaded.imageUrl,
        image_path: uploaded.imagePath,
        mime_type: selectedDishMimeType,
        vote_count: 0
      })
    });
    const created = Array.isArray(rows) ? rows.map(normalizeDish) : [];
    allDishes = [...created, ...allDishes];
    dishCacheTime = Date.now();
    adminMessage.textContent = "保存成功。";
    event.target.reset();
    selectedDishFile = null;
    selectedDishBlob = null;
    selectedDishMimeType = "image/jpeg";
    imagePreview.className = "preview empty";
    imagePreview.textContent = "选择图片后预览";
    await loadAllDishes(true);
    await loadAdminDishes(document.querySelector("#adminSearchInput").value.trim());
    adminMessage.textContent = "保存成功。";
  } catch (error) {
    if (uploaded?.imagePath) {
      try { await removeDishImage(uploaded.imagePath); } catch {}
    }
    adminMessage.textContent = friendlyError(error);
  } finally {
    submitButton.disabled = false;
  }
}

async function deleteDish(id, button) {
  const dish = allDishes.find((item) => item.id === id);
  if (!dish) return;
  if (!window.confirm(`确认删除「${dish.name}」吗？`)) return;
  button.disabled = true;
  adminMessage.textContent = "正在删除菜品...";
  try {
    await supabaseFetch(`dishes?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" }
    });
    if (dish.imagePath) {
      try { await removeDishImage(dish.imagePath); } catch {}
    }
    await loadAllDishes(true);
    loadAdminDishes(document.querySelector("#adminSearchInput").value.trim());
    if (currentView === "vote") loadVoteDishes();
    if (currentView === "rank") loadRankingDishes();
    adminMessage.textContent = "菜品已删除。";
  } catch (error) {
    adminMessage.textContent = friendlyError(error);
  } finally {
    button.disabled = false;
  }
}

function showView(view) {
  currentView = view;
  menuView.classList.toggle("hidden", view !== "menu");
  weekView.classList.toggle("hidden", view !== "week");
  voteView.classList.toggle("hidden", view !== "vote");
  rankView.classList.toggle("hidden", view !== "rank");
  adminView.classList.toggle("hidden", view !== "admin");
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === view));
  if (view === "menu") searchDishes(document.querySelector("#searchInput").value.trim());
  if (view === "admin") loadAdminDishes(document.querySelector("#adminSearchInput").value.trim());
  if (view === "week") loadWeeklyMenu();
  if (view === "vote") loadVoteDishes();
  if (view === "rank") loadRankingDishes();
}

function bindEvents() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => showView(tab.dataset.view));
  });

  document.querySelector("#searchForm").addEventListener("submit", (event) => {
    event.preventDefault();
    searchDishes(document.querySelector("#searchInput").value.trim());
  });

  document.querySelector("#recognitionImage").addEventListener("change", (event) => {
    selectedRecognitionFile = event.target.files[0] || null;
    document.querySelector("#recognitionFileName").textContent = selectedRecognitionFile ? selectedRecognitionFile.name : "";
  });

  document.querySelector("#recognitionForm").addEventListener("submit", (event) => {
    event.preventDefault();
    recognizeMenuInput();
  });

  document.querySelector("#clearRecognition").addEventListener("click", () => {
    selectedRecognitionFile = null;
    document.querySelector("#recognitionForm").reset();
    document.querySelector("#recognitionFileName").textContent = "";
    recognitionMessage.textContent = "";
    recognitionGrid.innerHTML = "";
  });

  document.querySelector("#adminSearchForm").addEventListener("submit", (event) => {
    event.preventDefault();
    loadAdminDishes(document.querySelector("#adminSearchInput").value.trim());
  });

  document.querySelector("#adminSearchInput").addEventListener("input", (event) => {
    clearTimeout(adminSearchTimer);
    adminSearchTimer = setTimeout(() => loadAdminDishes(event.target.value.trim()), 220);
  });

  document.querySelector("#clearAdminSearch").addEventListener("click", () => {
    document.querySelector("#adminSearchInput").value = "";
    loadAdminDishes();
  });

  document.querySelector("#dishImage").addEventListener("change", async (event) => {
    selectedDishFile = event.target.files[0] || null;
    selectedDishBlob = null;
    selectedDishMimeType = "image/jpeg";
    imagePreview.className = "preview empty";
    imagePreview.textContent = "正在处理图片...";
    if (!selectedDishFile) {
      imagePreview.textContent = "选择图片后预览";
      return;
    }
    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(selectedDishFile.type)) {
      adminMessage.textContent = "请选择 jpg、png 或 webp 图片。";
      event.target.value = "";
      imagePreview.textContent = "选择图片后预览";
      return;
    }
    if (selectedDishFile.size > 12 * 1024 * 1024) {
      adminMessage.textContent = "图片不能超过 12MB。";
      event.target.value = "";
      imagePreview.textContent = "选择图片后预览";
      return;
    }
    try {
      const compressed = await compressImageFile(selectedDishFile);
      selectedDishBlob = compressed.blob;
      selectedDishMimeType = compressed.mimeType;
      imagePreview.classList.remove("empty");
      imagePreview.innerHTML = `<img src="${compressed.previewUrl}" alt="图片预览" />`;
      adminMessage.textContent = "";
    } catch {
      selectedDishBlob = selectedDishFile;
      selectedDishMimeType = selectedDishFile.type || "image/jpeg";
      const previewUrl = await readFileAsDataUrl(selectedDishFile);
      imagePreview.classList.remove("empty");
      imagePreview.innerHTML = `<img src="${previewUrl}" alt="图片预览" />`;
    }
  });

  document.querySelector("#dishForm").addEventListener("submit", createDish);

  document.querySelector("#weeklyMenuForm").addEventListener("submit", (event) => {
    event.preventDefault();
    saveWeeklyMenu();
  });

  document.querySelector("#commentClose").addEventListener("click", closeCommentModal);
  commentModal.addEventListener("click", (event) => {
    if (event.target === commentModal) closeCommentModal();
  });

  document.querySelector("#adminLoginButton").addEventListener("click", () => {
    if (isAdmin()) {
      showView("admin");
      return;
    }
    adminLoginMessage.textContent = "";
    document.querySelector("#adminLoginForm").reset();
    adminModal.classList.remove("hidden");
    document.querySelector("#adminUsername").focus();
  });

  document.querySelector("#adminModalClose").addEventListener("click", () => adminModal.classList.add("hidden"));
  adminModal.addEventListener("click", (event) => {
    if (event.target === adminModal) adminModal.classList.add("hidden");
  });

  document.querySelector("#adminLoginForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const username = document.querySelector("#adminUsername").value.trim();
    const password = document.querySelector("#adminPassword").value;
    if (username === CONFIG.adminUsername && password === CONFIG.adminPassword) {
      setAdmin(true);
      adminModal.classList.add("hidden");
      showView("admin");
    } else {
      adminLoginMessage.textContent = "账号或密码不正确。";
    }
  });

  document.querySelector("#adminLogoutButton").addEventListener("click", () => {
    setAdmin(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!commentModal.classList.contains("hidden")) closeCommentModal();
      if (!adminModal.classList.contains("hidden")) adminModal.classList.add("hidden");
    }
  });
}

async function init() {
  weeklyMenu = createEmptyWeeklyMenu();
  bindEvents();
  updateAdminState();
  createWeeklyForm();
  try {
    await loadAllDishes(true);
    searchMessage.textContent = allDishes.length
      ? `已连接 Supabase，共 ${allDishes.length} 个菜品。请输入菜名开始搜索。`
      : "已连接 Supabase，目前还没有菜品。";
    await Promise.all([loadAdminDishes(), loadWeeklyMenu(), loadVoteDishes(), loadRankingDishes()]);
  } catch (error) {
    searchMessage.textContent = friendlyError(error);
    adminMessage.textContent = friendlyError(error);
    weeklyMessage.textContent = friendlyError(error);
    voteMessage.textContent = friendlyError(error);
    rankMessage.textContent = friendlyError(error);
  }
}

init();
