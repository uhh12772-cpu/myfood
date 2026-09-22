const CONFIG = {
  supabaseUrl: "https://fmiofxxamaikydeysmly.supabase.co",
  restUrl: "https://fmiofxxamaikydeysmly.supabase.co/rest/v1",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtaW9meHhhbWFpa3lkZXlzbWx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NjU5OTUsImV4cCI6MjEwNDM0MTk5NX0.qPl6aYpQr2-DRph1s1IbClKJQALvwUE3OnkSmJMra10",
  bucket: "dish-images",
  adminUsername: "admin",
  adminPassword: "admin"
};

const ADMIN_STATE_KEY = "dish-menu-supabase-admin-v1";
const VISITOR_KEY = "dish-menu-visitor-key-v1";
const DISH_COLUMNS = "id,name,restaurant_key,image_url,image_path,mime_type,vote_count,created_at,updated_at";
const COMMENT_COLUMNS = "id,dish_id,content,like_count,created_at,updated_at";
const DISCUSSION_COLUMNS = "id,parent_id,content,like_count,visitor_key,created_at,updated_at";
const DISH_CACHE_MS = 12000;
const DAILY_VOTE_LIMIT = 15;
const WEEKLY_COLUMNS = 16;
const WEEKLY_IMPORT_MAX_BYTES = 20 * 1024 * 1024;
const WEEKLY_OCR_TIMEOUT_MS = 90000;

const weekView = document.querySelector("#weekView");
const voteView = document.querySelector("#voteView");
const discussionView = document.querySelector("#discussionView");
const rankView = document.querySelector("#rankView");
const adminView = document.querySelector("#adminView");
const adminGrid = document.querySelector("#adminGrid");
const voteGrid = document.querySelector("#voteGrid");
const hotbaoRankList = document.querySelector("#hotbaoRankList");
const qilifangRankList = document.querySelector("#qilifangRankList");
const discussionList = document.querySelector("#discussionList");
const discussionMessage = document.querySelector("#discussionMessage");
const weeklyTable = document.querySelector("#weeklyTable");
const weeklyImportModal = document.querySelector("#weeklyImportModal");
const weeklyImportFile = document.querySelector("#weeklyImportFile");
const weeklyImportMessage = document.querySelector("#weeklyImportMessage");
const weeklyImportPreview = document.querySelector("#weeklyImportPreview");
const weeklyImportApply = document.querySelector("#weeklyImportApply");
const adminMessage = document.querySelector("#adminMessage");
const weeklyMessage = document.querySelector("#weeklyMessage");
const voteMessage = document.querySelector("#voteMessage");
const voteQuota = document.querySelector("#voteQuota");
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
let bulkDishFiles = [];
let weeklyMenus = {};
let weeklyRestaurant = "hotbao";
let weeklyActiveMeal = "breakfast";
let weeklyImportResult = null;
let weeklyImportBusy = false;
let weeklyImportRunId = 0;
let voteStatus = { usedVotes: 0, remainingVotes: DAILY_VOTE_LIMIT, votedDishIds: new Set() };
let voteRestaurant = "hotbao";
let adminSearchTimer = null;
let activeCommentDish = null;
let currentView = "vote";

const restaurants = [
  { id: "hotbao", label: "荷特宝" },
  { id: "qilifang", label: "七立方" }
];

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

function createEmptyWeeklyMenus() {
  return Object.fromEntries(restaurants.map((restaurant) => [restaurant.id, createEmptyWeeklyMenu()]));
}

function restaurantLabel(restaurantKey) {
  return restaurants.find((restaurant) => restaurant.id === restaurantKey)?.label || "荷特宝";
}

function normalizeForDishMatch(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\u3400-\u9fffa-z0-9]/gi, "");
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
  document.querySelectorAll("[data-admin-only]").forEach((element) => {
    element.classList.toggle("hidden", !isAdmin());
  });
  if (isAdmin()) {
    adminLoginButton.textContent = "管理员已登录";
    adminStatusText.textContent = "管理员模式已开启，可单个删除、批量上传和一键清空菜品。";
    adminLogoutButton.classList.remove("hidden");
  } else {
    adminLoginButton.textContent = "管理员登录";
    adminStatusText.textContent = "普通用户可以录入和搜索菜品；删除、批量上传和一键清空仅限管理员。";
    adminLogoutButton.classList.add("hidden");
  }
}

function createId(prefix = "item") {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getVisitorKey() {
  let key = localStorage.getItem(VISITOR_KEY);
  if (!key) {
    key = createId("visitor");
    localStorage.setItem(VISITOR_KEY, key);
  }
  return key;
}

function openAdminModal() {
  adminLoginMessage.textContent = "";
  document.querySelector("#adminLoginForm").reset();
  adminModal.classList.remove("hidden");
  document.querySelector("#adminUsername").focus();
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
    restaurantKey: row.restaurant_key || "hotbao",
    imageUrl: row.image_url || publicImageUrl(imagePath),
    imagePath,
    mimeType: row.mime_type || "",
    voteCount: Number(row.vote_count || 0),
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
    topComment: row.topComment || null
  };
}

function dishUniquenessKey(dish) {
  return `${dish.restaurantKey}::${String(dish.name || "").trim().toLocaleLowerCase("zh-CN")}`;
}

function countDuplicateDishes(dishes) {
  const seen = new Set();
  return dishes.reduce((count, dish) => {
    const key = dishUniquenessKey(dish);
    if (!key.endsWith("::") && seen.has(key)) return count + 1;
    seen.add(key);
    return count;
  }, 0);
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
  if (/OCR_TIMEOUT/i.test(message)) {
    return "图片识别超过 90 秒，请检查网络后重试，或换用更清晰、尺寸更小的图片。";
  }
  if (/OCR_MODEL|traineddata|language data/i.test(message)) {
    return "中文 OCR 模型加载失败，请确认已上传 tessdata/chi_sim.traineddata.gz，然后刷新页面重试。";
  }
  if (/image_blob|violates row-level security|row-level security|permission denied|storage/i.test(message)) {
    return "Supabase 权限或图片字段还没准备好，请先执行 new/supabase-direct-setup.sql。";
  }
  if (/dishes_restaurant_name_uq|duplicate key|unique constraint/i.test(message)) {
    return "该食堂已经存在同名菜品，请更换菜名，或先使用“AI清除重复菜品”。";
  }
  if (/discussion_comments|add_discussion_comment|like_discussion_comment|restaurant_key|admin_delete|admin_clear|admin_deduplicate|function .* does not exist|Could not find the function/i.test(message)) {
    return "Supabase 餐厅分类和意见区还没升级，请先执行 new/supabase-restaurant-forum-update.sql。";
  }
  if (/get_vote_status/i.test(message)) {
    return "Supabase 投票函数还没创建，请先执行 new/supabase-feature-update.sql。";
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

function filterDishes(dishes, name = "", sort = "", restaurantKey = "") {
  const query = normalizeForDishMatch(name);
  const filtered = dishes.filter((dish) =>
    (!query || normalizeForDishMatch(dish.name).includes(query))
    && (!restaurantKey || dish.restaurantKey === restaurantKey)
  );
  if (sort === "votes") {
    return [...filtered].sort((a, b) =>
      Number(b.voteCount || 0) - Number(a.voteCount || 0) ||
      a.name.localeCompare(b.name, "zh-CN")
    );
  }
  return [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function fetchDishes(name = "", sort = "", restaurantKey = "") {
  const dishes = await loadAllDishes();
  return filterDishes(dishes, name, sort, restaurantKey);
}

function findDishForName(name, restaurantKey = "") {
  const normalized = normalizeForDishMatch(name);
  if (!normalized) return null;
  const restaurantDishes = allDishes.filter((dish) => !restaurantKey || dish.restaurantKey === restaurantKey);
  const exact = restaurantDishes.find((dish) => normalizeForDishMatch(dish.name) === normalized);
  if (exact) return exact;
  return restaurantDishes
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
          <div><h3>${escapeHtml(dish.name)}</h3><span class="restaurant-badge">${restaurantLabel(dish.restaurantKey)}</span></div>
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

function getDishCandidates() {
  const candidates = new Map();
  for (const dish of allDishes.filter((item) => item.restaurantKey === weeklyRestaurant)) {
    const normalized = normalizeForDishMatch(dish.name);
    if (!normalized) continue;
    candidates.set(normalized, { name: dish.name, normalized, dish });
  }
  for (const name of menuNameLexicon) {
    const normalized = normalizeForDishMatch(name);
    if (!normalized || candidates.has(normalized)) continue;
    candidates.set(normalized, { name, normalized, dish: findDishForName(name, weeklyRestaurant) });
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

async function recognizeImageFileInBrowser(file) {
  if (!file || typeof window.TextDetector !== "function") {
    return { text: "", data: null, supported: false };
  }
  let bitmap = null;
  try {
    const detector = new window.TextDetector();
    bitmap = await createImageBitmap(file);
    const results = await detector.detect(bitmap);
    const lines = results.map((item) => {
      const box = item.boundingBox || {};
      return {
        text: item.rawValue || "",
        bbox: {
          x0: Number(box.x || box.left || 0),
          y0: Number(box.y || box.top || 0),
          x1: Number(box.x || box.left || 0) + Number(box.width || 0),
          y1: Number(box.y || box.top || 0) + Number(box.height || 0)
        }
      };
    }).filter((item) => item.text);
    const text = lines.map((item) => item.text).join("\n");
    return { text, data: { text, lines, words: lines }, supported: true };
  } catch {
    return { text: "", data: null, supported: true };
  } finally {
    if (bitmap && typeof bitmap.close === "function") bitmap.close();
  }
}

async function loadAdminDishes(name = "") {
  adminMessage.textContent = "正在加载菜品...";
  try {
    const restaurantKey = document.querySelector("#adminRestaurantFilter").value;
    const dishes = await fetchDishes(name, "", restaurantKey);
    document.querySelector("#adminCount").textContent = `${dishes.length} 条记录`;
    renderCards(adminGrid, dishes, "还没有录入菜品。", { deleteButton: isAdmin() });
    adminMessage.textContent = dishes.length ? "数据已从 Supabase 加载。" : "";
  } catch (error) {
    adminGrid.innerHTML = "";
    document.querySelector("#adminCount").textContent = "0 条记录";
    adminMessage.textContent = friendlyError(error);
  }
}

function normalizeVoteStatus(payload) {
  const row = Array.isArray(payload) ? payload[0] : payload;
  const ids = Array.isArray(row?.voted_dish_ids) ? row.voted_dish_ids : [];
  return {
    usedVotes: Number(row?.used_votes || 0),
    remainingVotes: Number(row?.remaining_votes ?? DAILY_VOTE_LIMIT),
    votedDishIds: new Set(ids.filter(Boolean))
  };
}

function updateVoteQuota() {
  voteQuota.textContent = `今日剩余 ${Math.max(0, voteStatus.remainingVotes)} 票`;
}

async function loadVoteStatus() {
  try {
    const payload = await supabaseFetch("rpc/get_vote_status", {
      method: "POST",
      body: JSON.stringify({ p_voter_key: getVisitorKey() })
    });
    voteStatus = normalizeVoteStatus(payload);
  } catch {
    voteStatus = { usedVotes: 0, remainingVotes: DAILY_VOTE_LIMIT, votedDishIds: new Set() };
  }
  updateVoteQuota();
  return voteStatus;
}

async function loadVoteDishes() {
  voteMessage.textContent = "正在加载菜品...";
  try {
    await loadVoteStatus();
    const dishes = await attachTopComments(await fetchDishes("", "", voteRestaurant));
    renderVoteCards(dishes);
    voteMessage.textContent = dishes.length
      ? `今天已用 ${voteStatus.usedVotes} 票，每天最多 ${DAILY_VOTE_LIMIT} 票。`
      : `${restaurantLabel(voteRestaurant)}还没有菜品，请先在后台录入。`;
  } catch (error) {
    voteGrid.innerHTML = "";
    voteMessage.textContent = friendlyError(error);
  }
}

function renderVoteCards(dishes) {
  document.querySelector("#voteCount").textContent = `${dishes.length} 个菜品`;
  voteGrid.innerHTML = dishes.length
    ? dishes.map((dish) => {
      const voted = voteStatus.votedDishIds.has(dish.id);
      const noQuota = voteStatus.remainingVotes <= 0 && !voted;
      return `
      <article class="vote-card">
        <div class="vote-media">
          ${renderDishImage(dish)}
          <p class="top-comment">${dish.topComment ? `热门评论：${escapeHtml(dish.topComment.content)} <span>${Number(dish.topComment.likeCount || 0)} 赞</span>` : "暂无评论"}</p>
        </div>
        <div class="vote-body">
          <h3>${escapeHtml(dish.name)}</h3>
          <div class="vote-actions">
            <button class="primary vote-button" type="button" data-id="${escapeHtml(dish.id)}" ${voted || noQuota ? "disabled" : ""}>${voted ? "今天已投" : "投票"}</button>
            <button class="secondary comment-button" type="button" data-id="${escapeHtml(dish.id)}" data-name="${escapeHtml(dish.name)}">评论</button>
          </div>
          <p>累计投票数：<strong data-vote-total="${escapeHtml(dish.id)}">${Number(dish.voteCount || 0)}</strong></p>
        </div>
      </article>`;
    }).join("")
    : `<div class="empty-state">还没有菜品，请先在后台录入。</div>`;

  voteGrid.querySelectorAll(".vote-button").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        const row = await voteDish(button.dataset.id);
        const total = document.querySelector(`[data-vote-total="${CSS.escape(row.id)}"]`);
        if (total) total.textContent = Number(row.voteCount || 0);
        if (row.alreadyVoted) {
          voteStatus.votedDishIds.add(row.id);
          voteMessage.textContent = `你今天已经给「${row.name}」投过票了。`;
        } else if (row.limitReached) {
          voteMessage.textContent = `今天 15 票已经用完，明天再来投。`;
        } else {
          voteStatus.votedDishIds.add(row.id);
          voteMessage.textContent = `已为「${row.name}」投票。今天还剩 ${row.remainingVotes} 票。`;
        }
        voteStatus.usedVotes = row.usedVotes;
        voteStatus.remainingVotes = row.remainingVotes;
        updateVoteQuota();
        renderVoteCards(await attachTopComments(await fetchDishes("", "", voteRestaurant)));
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

function setVoteRestaurant(restaurantKey) {
  voteRestaurant = restaurantKey;
  document.querySelectorAll("[data-vote-restaurant]").forEach((button) => {
    button.classList.toggle("active", button.dataset.voteRestaurant === restaurantKey);
  });
  loadVoteDishes();
}

async function voteDish(id) {
  const rows = await supabaseFetch("rpc/vote_dish", {
    method: "POST",
    body: JSON.stringify({ p_dish_id: id, p_voter_key: getVisitorKey() })
  });
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) throw new Error("投票失败，请重试。");
  const dish = allDishes.find((item) => item.id === row.id);
  if (dish) dish.voteCount = Number(row.vote_count || row.voteCount || 0);
  return {
    id: row.id,
    name: row.name || dish?.name || "",
    voteCount: Number(row.vote_count || row.voteCount || 0),
    usedVotes: Number(row.used_votes || 0),
    remainingVotes: Number(row.remaining_votes ?? 0),
    alreadyVoted: Boolean(row.already_voted),
    limitReached: Boolean(row.limit_reached)
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

function normalizeDiscussionComment(row) {
  return {
    id: row.id,
    parentId: row.parent_id || null,
    content: row.content || "",
    likeCount: Number(row.like_count || 0),
    visitorKey: row.visitor_key || "",
    createdAt: row.created_at || new Date().toISOString()
  };
}

function discussionCommentHtml(comment, childrenMap, depth = 0) {
  const children = childrenMap.get(comment.id) || [];
  const dateText = new Date(comment.createdAt).toLocaleString("zh-CN", { hour12: false });
  return `
    <article class="discussion-comment${depth ? " discussion-reply" : ""}" data-discussion-id="${escapeHtml(comment.id)}">
      <p>${escapeHtml(comment.content)}</p>
      <div class="discussion-meta">
        <time>${escapeHtml(dateText)}</time>
        <div class="discussion-actions">
          <button class="ghost discussion-like" type="button" data-id="${escapeHtml(comment.id)}">赞同 <strong data-discussion-like-count="${escapeHtml(comment.id)}">${comment.likeCount}</strong></button>
          <button class="ghost discussion-reply-button" type="button" data-id="${escapeHtml(comment.id)}">回复</button>
        </div>
      </div>
      <form class="discussion-reply-form hidden" data-parent-id="${escapeHtml(comment.id)}">
        <textarea rows="2" maxlength="1000" placeholder="回复这条评论"></textarea>
        <div class="compact-actions"><button class="primary" type="submit">提交回复</button><button class="secondary cancel-reply" type="button">取消</button></div>
      </form>
      ${children.length ? `<div class="discussion-children">${children.map((child) => discussionCommentHtml(child, childrenMap, depth + 1)).join("")}</div>` : ""}
    </article>`;
}

function renderDiscussionComments(comments) {
  const childrenMap = new Map();
  for (const comment of comments) {
    const key = comment.parentId || "root";
    const bucket = childrenMap.get(key) || [];
    bucket.push(comment);
    childrenMap.set(key, bucket);
  }
  const roots = (childrenMap.get("root") || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  document.querySelector("#discussionCount").textContent = `${roots.length} 条帖子`;
  discussionList.innerHTML = roots.length
    ? roots.map((comment) => discussionCommentHtml(comment, childrenMap)).join("")
    : `<div class="empty-state">还没有人发表意见。</div>`;

  discussionList.querySelectorAll(".discussion-like").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        const rows = await supabaseFetch("rpc/like_discussion_comment", {
          method: "POST",
          body: JSON.stringify({ p_comment_id: button.dataset.id })
        });
        const row = Array.isArray(rows) ? rows[0] : rows;
        const target = row ? document.querySelector(`[data-discussion-like-count="${CSS.escape(row.id)}"]`) : null;
        if (target) target.textContent = Number(row.like_count || 0);
      } catch (error) {
        discussionMessage.textContent = friendlyError(error);
      } finally {
        button.disabled = false;
      }
    });
  });

  discussionList.querySelectorAll(".discussion-reply-button").forEach((button) => {
    button.addEventListener("click", () => {
      const form = button.closest(".discussion-comment").querySelector(":scope > .discussion-reply-form");
      form.classList.toggle("hidden");
      if (!form.classList.contains("hidden")) form.querySelector("textarea").focus();
    });
  });

  discussionList.querySelectorAll(".cancel-reply").forEach((button) => {
    button.addEventListener("click", () => button.closest("form").classList.add("hidden"));
  });

  discussionList.querySelectorAll(".discussion-reply-form").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const content = form.querySelector("textarea").value.trim();
      if (!content) return;
      const submit = form.querySelector("button[type='submit']");
      submit.disabled = true;
      try {
        await addDiscussionComment(form.dataset.parentId, content);
        discussionMessage.textContent = "回复已发布。";
        await loadDiscussion();
      } catch (error) {
        discussionMessage.textContent = friendlyError(error);
      } finally {
        submit.disabled = false;
      }
    });
  });
}

async function addDiscussionComment(parentId, content) {
  return supabaseFetch("rpc/add_discussion_comment", {
    method: "POST",
    body: JSON.stringify({
      p_parent_id: parentId || null,
      p_content: content.slice(0, 1000),
      p_visitor_key: getVisitorKey()
    })
  });
}

async function loadDiscussion() {
  discussionMessage.textContent = "正在加载意见...";
  try {
    const rows = await supabaseFetch(`discussion_comments?select=${DISCUSSION_COLUMNS}&order=created_at.asc&limit=2000`);
    renderDiscussionComments((Array.isArray(rows) ? rows : []).map(normalizeDiscussionComment));
    discussionMessage.textContent = "";
  } catch (error) {
    discussionList.innerHTML = "";
    discussionMessage.textContent = friendlyError(error);
  }
}

async function loadRankingDishes() {
  rankMessage.textContent = "正在加载排行榜...";
  try {
    const [hotbaoDishes, qilifangDishes] = await Promise.all([
      fetchDishes("", "votes", "hotbao"),
      fetchDishes("", "votes", "qilifang")
    ]);
    renderRanking(hotbaoRankList, hotbaoDishes, "hotbaoRankCount");
    renderRanking(qilifangRankList, qilifangDishes, "qilifangRankCount");
    rankMessage.textContent = "两家餐厅分别按投票数由高到低排序。";
  } catch (error) {
    hotbaoRankList.innerHTML = "";
    qilifangRankList.innerHTML = "";
    rankMessage.textContent = friendlyError(error);
  }
}

function renderRanking(target, dishes, countId) {
  document.querySelector(`#${countId}`).textContent = `${dishes.length} 个菜品`;
  target.innerHTML = dishes.length
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

function ensureWeeklySlots(dayId, mealId) {
  weeklyMenus[weeklyRestaurant] = weeklyMenus[weeklyRestaurant] || createEmptyWeeklyMenu();
  const menu = weeklyMenus[weeklyRestaurant];
  menu[dayId] = menu[dayId] || {};
  const values = Array.isArray(menu[dayId][mealId]) ? menu[dayId][mealId] : [];
  menu[dayId][mealId] = Array.from({ length: WEEKLY_COLUMNS }, (_, index) => values[index] || "");
  return menu[dayId][mealId];
}

function createWeeklyForm() {
  renderWeeklyTable();
}

function setWeeklyMeal(mealId) {
  weeklyActiveMeal = mealId;
  document.querySelectorAll(".meal-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.weeklyMeal === mealId);
  });
  renderWeeklyTable();
}

function setWeeklyRestaurant(restaurantKey) {
  weeklyRestaurant = restaurantKey;
  document.querySelectorAll("[data-weekly-restaurant]").forEach((button) => {
    button.classList.toggle("active", button.dataset.weeklyRestaurant === restaurantKey);
  });
  renderWeeklyTable();
  weeklyMessage.textContent = `当前显示${restaurantLabel(restaurantKey)}的一周菜单。`;
}

function renderWeeklyTable() {
  const meal = meals.find((item) => item.id === weeklyActiveMeal) || meals[0];
  document.querySelector("#weeklyMealLabel").textContent = `当前编辑：${restaurantLabel(weeklyRestaurant)} · ${meal.label}`;
  weeklyTable.innerHTML = `
    <thead>
      <tr>
        <th>星期</th>
        ${Array.from({ length: WEEKLY_COLUMNS }, (_, index) => `<th>菜品${index + 1}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${days.map((day) => {
        const values = ensureWeeklySlots(day.id, meal.id);
        return `
          <tr>
            <th>${day.label}</th>
            ${values.map((value, index) => `
              <td>
                <input class="weekly-cell" data-day="${day.id}" data-meal="${meal.id}" data-index="${index}" value="${escapeHtml(value)}" placeholder="菜名" autocomplete="off" />
              </td>`).join("")}
          </tr>`;
      }).join("")}
    </tbody>`;

  weeklyTable.querySelectorAll(".weekly-cell").forEach((input) => {
    input.addEventListener("input", () => {
      ensureWeeklySlots(input.dataset.day, input.dataset.meal)[Number(input.dataset.index)] = input.value;
    });
    input.addEventListener("paste", (event) => handleWeeklyPaste(event, input));
  });
}

function handleWeeklyPaste(event, input) {
  const pasted = event.clipboardData?.getData("text") || "";
  if (!pasted.includes("\t") && !pasted.includes("\n")) return;
  event.preventDefault();
  const rows = pasted.trim().split(/\r?\n/).map((row) => row.split("\t"));
  const startDayIndex = days.findIndex((day) => day.id === input.dataset.day);
  const startColumn = Number(input.dataset.index);
  rows.forEach((row, rowOffset) => {
    const day = days[startDayIndex + rowOffset];
    if (!day) return;
    row.forEach((value, columnOffset) => {
      const column = startColumn + columnOffset;
      if (column >= WEEKLY_COLUMNS) return;
      ensureWeeklySlots(day.id, weeklyActiveMeal)[column] = value.trim();
    });
  });
  renderWeeklyTable();
}

function normalizeWeeklyMenu(input) {
  const result = createEmptyWeeklyMenu();
  for (const day of days) {
    for (const meal of meals) {
      const value = input?.[day.id]?.[meal.id];
      const items = Array.isArray(value) ? value : (value ? [value] : []);
      result[day.id][meal.id] = Array.from({ length: WEEKLY_COLUMNS }, (_, index) => String(items[index] || "").trim());
    }
  }
  return result;
}

function detectWeeklyDay(value) {
  const text = String(value || "");
  if (/(?:星期|周)\s*一/.test(text) || /\b(?:Mon|Monday)\b/i.test(text)) return "monday";
  if (/(?:星期|周)\s*二/.test(text) || /\b(?:Tue|Tuesday)\b/i.test(text)) return "tuesday";
  if (/(?:星期|周)\s*三/.test(text) || /\b(?:Wed|Wednesday)\b/i.test(text)) return "wednesday";
  if (/(?:星期|周)\s*四/.test(text) || /\b(?:Thu|Thursday)\b/i.test(text)) return "thursday";
  if (/(?:星期|周)\s*五/.test(text) || /\b(?:Fri|Friday)\b/i.test(text)) return "friday";
  return "";
}

function detectWeeklyMeal(value) {
  const text = String(value || "");
  if (/早餐|早饭|早\s*餐|\bbreakfast\b/i.test(text)) return "breakfast";
  if (/午餐|午饭|中餐|\blunch\b/i.test(text)) return "lunch";
  if (/晚餐|晚饭|\bdinner\b/i.test(text)) return "dinner";
  return "";
}

const weeklyImportNonDishWords = new Set([
  ...nonDishWords,
  "备注", "说明", "注意", "每日", "每天", "可能", "调整", "新鲜", "食材", "类别", "分类",
  "主菜", "小菜", "时蔬", "蔬菜", "饮品", "点心", "米饭", "汤品", "水果饮料", "notes"
]);

function cleanWeeklyDishName(value) {
  return String(value || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/[A-Za-z][A-Za-z\s&'/-]*$/g, "")
    .replace(/[0-9０-９]+/g, "")
    .replace(/^(?:早餐|午餐|晚餐|早饭|午饭|晚饭|主食|汤品|菜品|类别|分类)\s*[:：-]?/u, "")
    .replace(/^[\s:：,，、/／|]+|[\s:：,，、/／|]+$/g, "")
    .replace(/[()（）【】[\]{}<>《》]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function isWeeklyDishName(value) {
  const name = cleanWeeklyDishName(value);
  if (name.length < 2 || name.length > 24) return false;
  if (!/[\u3400-\u9fff]/.test(name)) return false;
  if (weeklyImportNonDishWords.has(name)) return false;
  if (/^(?:星期|周)[一二三四五六日天]/u.test(name)) return false;
  if (/^(?:备注|说明|注意|每日|每天|可能|调整|食材新鲜)/u.test(name)) return false;
  return true;
}

function extractWeeklyDishNames(value) {
  const raw = String(value || "").replace(/\r/g, "").trim();
  if (!raw) return [];
  const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean);
  const names = [];

  for (const line of lines) {
    if (/^(?:备注|说明|注意|notes?)\b/i.test(line)) continue;
    const known = extractKnownDishMatches(line).map((item) => item.name).filter(isWeeklyDishName);
    if (known.length) {
      names.push(...known);
      continue;
    }
    const chineseLine = line.replace(/[A-Za-z][\s\S]*$/g, "");
    const pieces = chineseLine.split(/[\/／、，,;；|]+/g);
    for (const piece of pieces) {
      const name = cleanWeeklyDishName(piece);
      if (isWeeklyDishName(name)) names.push(name);
    }
  }

  const seen = new Set();
  return names.filter((name) => {
    const key = normalizeForDishMatch(name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function createWeeklyImportResult(sourceType, fileName) {
  return {
    sourceType,
    fileName,
    menu: createEmptyWeeklyMenu(),
    coveredSlots: [],
    coveredSlotKeys: new Set(),
    warnings: []
  };
}

function addWeeklyImportSlot(result, dayId, mealId, names, markEmpty = false) {
  if (!days.some((day) => day.id === dayId) || !meals.some((meal) => meal.id === mealId)) return;
  const key = `${dayId}:${mealId}`;
  const cleaned = names.filter(isWeeklyDishName).slice(0, WEEKLY_COLUMNS);
  result.menu[dayId][mealId] = [...cleaned, ...Array(WEEKLY_COLUMNS - cleaned.length).fill("")];
  if (markEmpty || cleaned.length) {
    if (!result.coveredSlotKeys.has(key)) {
      result.coveredSlotKeys.add(key);
      result.coveredSlots.push({ dayId, mealId });
    }
  }
}

function countWeeklyImportDishes(result) {
  return result.coveredSlots.reduce(
    (total, slot) => total + result.menu[slot.dayId][slot.mealId].filter(Boolean).length,
    0
  );
}

function detectWeeklyDayColumns(rows) {
  const columns = new Map();
  let headerRow = Number.MAX_SAFE_INTEGER;
  rows.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      const dayId = detectWeeklyDay(value);
      if (!dayId || columns.has(dayId)) return;
      columns.set(dayId, { columnIndex, rowIndex });
      headerRow = Math.min(headerRow, rowIndex);
    });
  });
  return { columns, headerRow: headerRow === Number.MAX_SAFE_INTEGER ? -1 : headerRow };
}

function parseWeeklyWorksheet(sheetName, rows, result) {
  const dayInfo = detectWeeklyDayColumns(rows);
  if (!dayInfo.columns.size) return false;

  const sheetMeal = detectWeeklyMeal(sheetName);
  const rowMeals = new Set();
  rows.forEach((row) => {
    const rowMeal = detectWeeklyMeal(row.slice(0, 3).join(" "));
    if (rowMeal) rowMeals.add(rowMeal);
  });
  const fixedMeal = sheetMeal || (rowMeals.size === 1 ? [...rowMeals][0] : "");
  let activeMeal = fixedMeal || "";
  const buckets = Object.fromEntries(meals.map((meal) => [meal.id, Object.fromEntries(days.map((day) => [day.id, []]))]));
  const startRow = Math.max(0, dayInfo.headerRow + 1);

  for (let rowIndex = startRow; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] || [];
    const rowMeal = detectWeeklyMeal(row.slice(0, 3).join(" "));
    if (!fixedMeal && rowMeal) activeMeal = rowMeal;
    const mealId = fixedMeal || activeMeal;
    if (!mealId) continue;

    for (const day of days) {
      const dayColumn = dayInfo.columns.get(day.id);
      if (!dayColumn) continue;
      const names = extractWeeklyDishNames(row[dayColumn.columnIndex]);
      if (names.length) buckets[mealId][day.id].push(...names);
    }
  }

  const mealsToWrite = fixedMeal ? [fixedMeal] : [...rowMeals];
  if (!mealsToWrite.length) mealsToWrite.push(weeklyActiveMeal);
  for (const mealId of mealsToWrite) {
    for (const day of days) {
      const names = buckets[mealId][day.id] || [];
      addWeeklyImportSlot(result, day.id, mealId, names, true);
    }
  }
  return true;
}

function parseWeeklyWorkbook(workbook, fileName) {
  const result = createWeeklyImportResult("excel", fileName);
  for (const sheetName of workbook.SheetNames || []) {
    const sheet = workbook.Sheets[sheetName];
    const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
    parseWeeklyWorksheet(sheetName, rows, result);
  }
  if (!result.coveredSlots.length) {
    result.warnings.push("没有找到星期列，请确认表格中包含星期一至星期五或 Mon 至 Fri 的表头。");
  }
  return result;
}

function getOcrBoxCenter(box) {
  const bbox = box?.bbox || {};
  return {
    x: (Number(bbox.x0 || 0) + Number(bbox.x1 || 0)) / 2,
    y: (Number(bbox.y0 || 0) + Number(bbox.y1 || 0)) / 2,
    width: Math.max(0, Number(bbox.x1 || 0) - Number(bbox.x0 || 0)),
    height: Math.max(0, Number(bbox.y1 || 0) - Number(bbox.y0 || 0))
  };
}

function parseWeeklyOcrFallback(text, result) {
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  let currentDay = "";
  let currentMeal = "";
  for (const line of lines) {
    const dayId = detectWeeklyDay(line);
    const mealId = detectWeeklyMeal(line);
    if (dayId) {
      currentDay = dayId;
      if (mealId) currentMeal = mealId;
      continue;
    }
    if (mealId) {
      currentMeal = mealId;
      continue;
    }
    if (!currentMeal) currentMeal = weeklyActiveMeal;
    if (!currentDay) continue;
    const names = extractWeeklyDishNames(line);
    if (!names.length) continue;
    const existing = result.menu[currentDay][currentMeal].filter(Boolean);
    addWeeklyImportSlot(result, currentDay, currentMeal, [...existing, ...names], true);
  }
}

function parseWeeklyOcrData(data, fileName) {
  const result = createWeeklyImportResult("image", fileName);
  const lines = Array.isArray(data?.lines) ? data.lines.filter((line) => String(line.text || "").trim()) : [];
  const words = Array.isArray(data?.words) ? data.words.filter((word) => String(word.text || "").trim()) : [];
  const dayAnchors = [];
  const mealAnchors = [];

  for (const box of words.length ? words : lines) {
    const text = String(box.text || "");
    const position = getOcrBoxCenter(box);
    const dayId = detectWeeklyDay(text);
    const mealId = detectWeeklyMeal(text);
    if (dayId && !dayAnchors.some((anchor) => anchor.dayId === dayId)) dayAnchors.push({ dayId, ...position });
    if (mealId && !mealAnchors.some((anchor) => anchor.mealId === mealId)) mealAnchors.push({ mealId, ...position });
  }

  if (!dayAnchors.length) {
    parseWeeklyOcrFallback(data?.text || lines.map((line) => line.text).join("\n"), result);
    if (!result.coveredSlots.length) result.warnings.push("图片中没有识别到星期位置，请换一张清晰的餐表图片。");
    return result;
  }

  dayAnchors.sort((a, b) => a.x - b.x);
  mealAnchors.sort((a, b) => a.y - b.y);
  const gaps = dayAnchors.slice(1).map((anchor, index) => anchor.x - dayAnchors[index].x).filter((gap) => gap > 0);
  const columnGap = gaps.length ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length : 180;
  const firstDayX = dayAnchors[0].x;

  const ocrLines = lines.length ? lines : words;
  for (const line of ocrLines) {
    const text = String(line.text || "").trim();
    if (!text || detectWeeklyDay(text) || detectWeeklyMeal(text)) continue;
    const position = getOcrBoxCenter(line);
    if (position.x < firstDayX - columnGap * 0.45) continue;
    const names = extractWeeklyDishNames(text);
    if (!names.length) continue;

    const mealAnchor = [...mealAnchors].reverse().find((anchor) => anchor.y <= position.y + position.height) || null;
    const mealId = mealAnchor?.mealId || weeklyActiveMeal;
    const matchingDays = dayAnchors.filter((anchor) => anchor.x >= position.x - position.width / 2 && anchor.x <= position.x + position.width / 2);
    if (names.length > 1 && position.width > columnGap * 1.35 && matchingDays.length >= names.length) {
      names.forEach((name, index) => {
        const dayId = matchingDays[index].dayId;
        const existing = result.menu[dayId][mealId].filter(Boolean);
        addWeeklyImportSlot(result, dayId, mealId, [...existing, name], true);
      });
      continue;
    }

    const day = dayAnchors.reduce((nearest, anchor) =>
      Math.abs(anchor.x - position.x) < Math.abs(nearest.x - position.x) ? anchor : nearest
    );
    const existing = result.menu[day.dayId][mealId].filter(Boolean);
    addWeeklyImportSlot(result, day.dayId, mealId, [...existing, ...names], true);
  }

  if (!result.coveredSlots.length) {
    parseWeeklyOcrFallback(data?.text || lines.map((line) => line.text).join("\n"), result);
  }
  if (!result.coveredSlots.length) result.warnings.push("没有识别到菜品内容，请换一张清晰度更高的图片。");
  return result;
}

function updateWeeklyImportProgress(message) {
  weeklyImportMessage.textContent = message;
}

function withTimeout(promise, timeoutMs, errorCode) {
  let timer = null;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(errorCode)), timeoutMs);
    })
  ]).finally(() => clearTimeout(timer));
}

function renderWeeklyImportPreview(result) {
  if (!result) {
    weeklyImportPreview.innerHTML = `<div class="empty-state">请选择一个 Excel 文件或菜单图片。</div>`;
    weeklyImportApply.disabled = true;
    return;
  }
  const dishCount = countWeeklyImportDishes(result);
  const warning = result.warnings.length ? `<div class="import-warning">${result.warnings.map(escapeHtml).join("<br />")}</div>` : "";
  const rows = days.flatMap((day) => meals.map((meal) => {
    const key = `${day.id}:${meal.id}`;
    const names = result.menu[day.id][meal.id].filter(Boolean);
    const content = names.length
      ? names.map((name) => `<span class="import-dish-tag">${escapeHtml(name)}</span>`).join("")
      : `<span class="import-empty">空白</span>`;
    return `<tr><th>${day.label}</th><th>${meal.label}</th><td>${content}</td><td>${result.coveredSlotKeys.has(key) ? "已识别" : "未识别"}</td></tr>`;
  })).join("");
  weeklyImportPreview.innerHTML = `
    <div class="import-summary"><strong>${escapeHtml(result.fileName)}</strong><span>将导入${restaurantLabel(weeklyRestaurant)} · 识别 ${dishCount} 个菜品，覆盖 ${result.coveredSlots.length} 个餐次</span></div>
    ${warning}
    <div class="weekly-import-table-wrap">
      <table class="weekly-import-table">
        <thead><tr><th>星期</th><th>餐次</th><th>识别出的菜品</th><th>状态</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  weeklyImportApply.disabled = !result.coveredSlots.length;
}

async function recognizeWeeklyImportFile(file) {
  if (!file) return;
  const runId = ++weeklyImportRunId;
  weeklyImportResult = null;
  weeklyImportApply.disabled = true;
  renderWeeklyImportPreview(null);
  if (file.size > WEEKLY_IMPORT_MAX_BYTES) {
    updateWeeklyImportProgress("文件不能超过 20MB。");
    return;
  }

  weeklyImportBusy = true;
  weeklyImportFile.disabled = true;
  updateWeeklyImportProgress("正在读取文件...");
  try {
    try { await loadAllDishes(); } catch {}
    const isExcel = /\.(xlsx|xls)$/i.test(file.name) || /spreadsheet|excel/.test(file.type);
    if (isExcel) {
      if (!window.XLSX) throw new Error("Excel 解析组件加载失败，请检查网络后刷新页面。");
      updateWeeklyImportProgress("正在分析 Excel 工作表、日期和餐次...");
      const workbook = window.XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      weeklyImportResult = parseWeeklyWorkbook(workbook, file.name);
    } else {
      updateWeeklyImportProgress("正在检查浏览器文字识别能力...");
      const nativeOcr = await recognizeImageFileInBrowser(file);
      if (runId !== weeklyImportRunId) return;
      if (nativeOcr.text) {
        weeklyImportResult = parseWeeklyOcrData(nativeOcr.data, file.name);
      } else {
        if (!window.Tesseract?.recognize) throw new Error("图片 OCR 组件加载失败，请检查网络后刷新页面。");
        const modelPath = new URL("tessdata", document.baseURI).href.replace(/\/$/, "");
        updateWeeklyImportProgress("正在加载网站内置中文模型并识别图片...");
        const ocr = await withTimeout(
          window.Tesseract.recognize(file, "chi_sim", {
            langPath: modelPath,
            gzip: true,
            logger: (info) => {
              if (runId !== weeklyImportRunId) return;
              if (info?.status && typeof info.progress === "number") {
                updateWeeklyImportProgress(`${info.status} ${Math.round(info.progress * 100)}%`);
              }
            }
          }),
          WEEKLY_OCR_TIMEOUT_MS,
          "OCR_TIMEOUT"
        );
        if (runId !== weeklyImportRunId) return;
        weeklyImportResult = parseWeeklyOcrData(ocr.data, file.name);
      }
    }
    if (runId !== weeklyImportRunId) return;
    renderWeeklyImportPreview(weeklyImportResult);
    updateWeeklyImportProgress(weeklyImportResult.coveredSlots.length ? "识别完成，请检查预览后填入。" : "识别完成，但没有可填入的内容。");
  } catch (error) {
    if (runId !== weeklyImportRunId) return;
    weeklyImportResult = null;
    renderWeeklyImportPreview(null);
    updateWeeklyImportProgress(friendlyError(error));
  } finally {
    if (runId !== weeklyImportRunId) return;
    weeklyImportBusy = false;
    weeklyImportFile.disabled = false;
  }
}

function applyWeeklyImport() {
  if (!weeklyImportResult?.coveredSlots.length) return;
  const nextMenu = normalizeWeeklyMenu(weeklyMenus[weeklyRestaurant]);
  for (const slot of weeklyImportResult.coveredSlots) {
    nextMenu[slot.dayId][slot.mealId] = [...weeklyImportResult.menu[slot.dayId][slot.mealId]];
  }
  weeklyMenus[weeklyRestaurant] = nextMenu;
  renderWeeklyTable();
  weeklyImportModal.classList.add("hidden");
  weeklyMessage.textContent = `识别结果已填入${restaurantLabel(weeklyRestaurant)}菜单，请检查后点击“保存一周菜单”。`;
}

function closeWeeklyImportModal() {
  weeklyImportRunId += 1;
  weeklyImportBusy = false;
  weeklyImportFile.disabled = false;
  weeklyImportModal.classList.add("hidden");
  weeklyImportFile.value = "";
  weeklyImportResult = null;
  weeklyImportMessage.textContent = "";
  renderWeeklyImportPreview(null);
}

async function loadWeeklyMenu() {
  weeklyMessage.textContent = "正在加载一周菜单...";
  try {
    const rows = await supabaseFetch("weekly_menu_items?select=id,restaurant_key,weekday,meal_type,dish_id,dish_name,sort_order&order=restaurant_key.asc,weekday.asc,meal_type.asc,sort_order.asc&limit=2000");
    const loaded = createEmptyWeeklyMenus();
    for (const restaurant of restaurants) {
      for (const day of days) {
        for (const meal of meals) loaded[restaurant.id][day.id][meal.id] = [];
      }
    }
    for (const row of Array.isArray(rows) ? rows : []) {
      const restaurantKey = restaurants.some((item) => item.id === row.restaurant_key) ? row.restaurant_key : "hotbao";
      const day = days.find((item) => item.value === Number(row.weekday));
      const meal = meals.find((item) => item.id === row.meal_type);
      if (day && meal && row.dish_name) loaded[restaurantKey][day.id][meal.id][Number(row.sort_order || 0)] = row.dish_name;
    }
    weeklyMenus = Object.fromEntries(restaurants.map((restaurant) => [
      restaurant.id,
      normalizeWeeklyMenu(loaded[restaurant.id])
    ]));
    createWeeklyForm();
    weeklyMessage.textContent = `已加载${restaurantLabel(weeklyRestaurant)}的一周菜单。`;
  } catch (error) {
    weeklyMenus = createEmptyWeeklyMenus();
    createWeeklyForm();
    weeklyMessage.textContent = friendlyError(error);
  }
}

async function saveWeeklyMenu() {
  const submitButton = document.querySelector("#weeklyMenuForm button[type='submit']");
  submitButton.disabled = true;
  weeklyMessage.textContent = "正在保存...";
  try {
    await loadAllDishes();
    const normalized = normalizeWeeklyMenu(weeklyMenus[weeklyRestaurant]);
    const rows = [];
    for (const day of days) {
      for (const meal of meals) {
        normalized[day.id][meal.id]
          .map((name) => String(name || "").trim())
          .filter(Boolean)
          .forEach((name, index) => {
            const matchedDish = findDishForName(name, weeklyRestaurant);
            rows.push({
              restaurant_key: weeklyRestaurant,
              weekday: day.value,
              meal_type: meal.id,
              dish_id: matchedDish?.id || null,
              dish_name: name.slice(0, 120),
              sort_order: index
            });
          });
      }
    }
    await supabaseFetch(`weekly_menu_items?restaurant_key=eq.${encodeURIComponent(weeklyRestaurant)}`, {
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
    weeklyMenus[weeklyRestaurant] = normalized;
    renderWeeklyTable();
    weeklyMessage.textContent = `${restaurantLabel(weeklyRestaurant)}的一周菜单已保存到 Supabase。`;
  } catch (error) {
    weeklyMessage.textContent = friendlyError(error);
  } finally {
    submitButton.disabled = false;
  }
}

async function removeAllWeeklyMenuItems(restaurantKey = "") {
  const query = restaurantKey
    ? `weekly_menu_items?restaurant_key=eq.${encodeURIComponent(restaurantKey)}`
    : "weekly_menu_items?weekday=gte.1";
  await supabaseFetch(query, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" }
  });
}

async function clearWeeklyMenu() {
  if (!isAdmin()) {
    openAdminModal();
    return;
  }
  const button = document.querySelector("#clearWeeklyMenu");
  if (!window.confirm(`确认清空${restaurantLabel(weeklyRestaurant)}的一周菜单吗？这不会影响另一家食堂，也不会删除菜品库。`)) return;
  button.disabled = true;
  weeklyMessage.textContent = "正在清空一周菜单...";
  try {
    await removeAllWeeklyMenuItems(weeklyRestaurant);
    weeklyMenus[weeklyRestaurant] = createEmptyWeeklyMenu();
    renderWeeklyTable();
    weeklyMessage.textContent = `${restaurantLabel(weeklyRestaurant)}的一周菜单已清空。`;
  } catch (error) {
    weeklyMessage.textContent = friendlyError(error);
  } finally {
    button.disabled = false;
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

async function saveDishRecord(name, blob, mimeType, restaurantKey) {
  const uploaded = await uploadDishImage(blob, mimeType);
  try {
    const rows = await supabaseFetch("dishes", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        name: name.slice(0, 120),
        restaurant_key: restaurantKey,
        image_url: uploaded.imageUrl,
        image_path: uploaded.imagePath,
        mime_type: mimeType,
        vote_count: 0
      })
    });
    return Array.isArray(rows) ? rows.map(normalizeDish) : [];
  } catch (error) {
    try { await removeDishImage(uploaded.imagePath); } catch {}
    throw error;
  }
}

async function createDish(event) {
  event.preventDefault();
  const submitButton = document.querySelector("#dishForm button[type='submit']");
  const name = document.querySelector("#dishName").value.trim().slice(0, 120);
  const restaurantKey = document.querySelector("#dishRestaurant").value;
  if (!name || !selectedDishBlob) {
    adminMessage.textContent = "请填写菜名并选择图片。";
    return;
  }
  submitButton.disabled = true;
  adminMessage.textContent = "正在上传图片...";
  try {
    const created = await saveDishRecord(name, selectedDishBlob, selectedDishMimeType, restaurantKey);
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
    adminMessage.textContent = friendlyError(error);
  } finally {
    submitButton.disabled = false;
  }
}

async function deleteDish(id, button) {
  if (!isAdmin()) {
    openAdminModal();
    return;
  }
  const dish = allDishes.find((item) => item.id === id);
  if (!dish) return;
  if (!window.confirm(`确认删除「${dish.name}」吗？`)) return;
  button.disabled = true;
  adminMessage.textContent = "正在删除菜品...";
  try {
    await supabaseFetch("rpc/admin_delete_dish", {
      method: "POST",
      body: JSON.stringify({ p_dish_id: id, p_admin_password: CONFIG.adminPassword })
    });
    if (dish.imagePath) {
      try { await removeDishImage(dish.imagePath); } catch {}
    }
    await loadAllDishes(true);
    await loadAdminDishes(document.querySelector("#adminSearchInput").value.trim());
    if (currentView === "vote") await loadVoteDishes();
    if (currentView === "rank") await loadRankingDishes();
    if (currentView === "week") await loadWeeklyMenu();
    adminMessage.textContent = "菜品已删除。";
  } catch (error) {
    adminMessage.textContent = friendlyError(error);
  } finally {
    button.disabled = false;
  }
}

async function deleteAllDishes() {
  if (!isAdmin()) {
    openAdminModal();
    return;
  }
  const button = document.querySelector("#deleteAllDishes");
  let dishes = [];
  try {
    dishes = await loadAllDishes(true);
  } catch (error) {
    adminMessage.textContent = friendlyError(error);
    return;
  }
  if (!dishes.length) {
    adminMessage.textContent = "当前没有菜品可删除。";
    return;
  }
  if (!window.confirm(`确认删除全部 ${dishes.length} 个菜品吗？这个操作会同时清空相关投票和评论。`)) return;
  button.disabled = true;
  adminMessage.textContent = "正在一键删除全部菜品...";
  try {
    await supabaseFetch("rpc/admin_clear_all_dishes", {
      method: "POST",
      body: JSON.stringify({ p_admin_password: CONFIG.adminPassword })
    });
    for (const dish of dishes) {
      if (dish.imagePath) {
        try { await removeDishImage(dish.imagePath); } catch {}
      }
    }
    allDishes = [];
    dishCacheTime = Date.now();
    weeklyMenus = createEmptyWeeklyMenus();
    createWeeklyForm();
    voteStatus = { usedVotes: 0, remainingVotes: DAILY_VOTE_LIMIT, votedDishIds: new Set() };
    updateVoteQuota();
    await loadAdminDishes();
    voteGrid.innerHTML = "";
    hotbaoRankList.innerHTML = "";
    qilifangRankList.innerHTML = "";
    document.querySelector("#voteCount").textContent = "0 个菜品";
    document.querySelector("#hotbaoRankCount").textContent = "0 个菜品";
    document.querySelector("#qilifangRankCount").textContent = "0 个菜品";
    adminMessage.textContent = "全部菜品已删除。";
  } catch (error) {
    adminMessage.textContent = friendlyError(error);
  } finally {
    button.disabled = false;
  }
}

async function deduplicateDishes() {
  if (!isAdmin()) {
    openAdminModal();
    return;
  }
  const button = document.querySelector("#deduplicateDishes");
  let dishes = [];
  try {
    dishes = await loadAllDishes(true);
  } catch (error) {
    adminMessage.textContent = friendlyError(error);
    return;
  }
  const duplicateCount = countDuplicateDishes(dishes);
  if (!duplicateCount) {
    adminMessage.textContent = "没有发现重复菜品。不同食堂的同名菜品会分别保留。";
    return;
  }
  if (!window.confirm(`发现 ${duplicateCount} 个重复菜品。每个食堂只保留最早录入的一条，其余记录及其投票、评论将被删除，确认继续吗？`)) return;

  button.disabled = true;
  adminMessage.textContent = "正在检查并清除重复菜品...";
  try {
    const payload = await supabaseFetch("rpc/admin_deduplicate_dishes", {
      method: "POST",
      body: JSON.stringify({ p_admin_password: CONFIG.adminPassword })
    });
    const row = Array.isArray(payload) ? payload[0] : payload;
    const deletedCount = Number(row?.deleted_count || 0);
    const imagePaths = Array.isArray(row?.deleted_image_paths) ? row.deleted_image_paths : [];
    for (const imagePath of imagePaths) {
      try { await removeDishImage(imagePath); } catch {}
    }
    await loadAllDishes(true);
    await loadAdminDishes(document.querySelector("#adminSearchInput").value.trim());
    if (currentView === "vote") await loadVoteDishes();
    if (currentView === "rank") await loadRankingDishes();
    if (currentView === "week") await loadWeeklyMenu();
    adminMessage.textContent = deletedCount
      ? `已清除 ${deletedCount} 个重复菜品，后续同一食堂不能再录入同名菜品。`
      : "没有发现重复菜品。";
  } catch (error) {
    adminMessage.textContent = friendlyError(error);
  } finally {
    button.disabled = false;
  }
}

function parseBulkDishNames(value) {
  return String(value || "")
    .split(/[\s,，、;；]+/)
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => name.slice(0, 120));
}

function renderBulkUploadPreview() {
  const names = parseBulkDishNames(document.querySelector("#bulkDishNames").value);
  const restaurantKey = document.querySelector("#bulkDishRestaurant").value;
  const target = document.querySelector("#bulkUploadPreview");
  const countText = `${restaurantLabel(restaurantKey)}：已识别 ${names.length} 个菜名，已选择 ${bulkDishFiles.length} 张图片。`;
  const pairs = names.slice(0, 12).map((name, index) => {
    const file = bulkDishFiles[index];
    return `<span>${index + 1}. ${escapeHtml(name)}${file ? ` → ${escapeHtml(file.name)}` : " → 等待图片"}</span>`;
  }).join("");
  target.innerHTML = `<strong>${countText}</strong>${pairs ? `<div>${pairs}</div>` : ""}`;
}

async function uploadBulkDishes(event) {
  event.preventDefault();
  if (!isAdmin()) {
    openAdminModal();
    return;
  }
  const button = document.querySelector("#bulkDishForm button[type='submit']");
  const message = document.querySelector("#bulkUploadMessage");
  const names = parseBulkDishNames(document.querySelector("#bulkDishNames").value);
  const restaurantKey = document.querySelector("#bulkDishRestaurant").value;
  if (!names.length || !bulkDishFiles.length) {
    message.textContent = "请先输入菜名并选择图片。";
    return;
  }
  if (names.length !== bulkDishFiles.length) {
    message.textContent = `菜名数量和图片数量不一致：${names.length} 个菜名，${bulkDishFiles.length} 张图片。`;
    return;
  }
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
  if (duplicates.length) {
    message.textContent = `菜名重复：${[...new Set(duplicates)].join("、")}`;
    return;
  }

  button.disabled = true;
  message.textContent = "正在批量上传...";
  const created = [];
  try {
    for (let index = 0; index < names.length; index += 1) {
      const file = bulkDishFiles[index];
      if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
        throw new Error(`第 ${index + 1} 张图片格式不支持。`);
      }
      message.textContent = `正在上传 ${index + 1}/${names.length}：${names[index]}`;
      const compressed = await compressImageFile(file);
      const rows = await saveDishRecord(names[index], compressed.blob, compressed.mimeType, restaurantKey);
      created.push(...rows);
    }
    allDishes = [...created, ...allDishes];
    await loadAllDishes(true);
    await loadAdminDishes(document.querySelector("#adminSearchInput").value.trim());
    document.querySelector("#bulkDishForm").reset();
    bulkDishFiles = [];
    renderBulkUploadPreview();
    message.textContent = `批量上传完成，共新增 ${created.length} 个菜品。`;
  } catch (error) {
    message.textContent = friendlyError(error);
  } finally {
    button.disabled = false;
  }
}

function showView(view) {
  currentView = view;
  weekView.classList.toggle("hidden", view !== "week");
  voteView.classList.toggle("hidden", view !== "vote");
  discussionView.classList.toggle("hidden", view !== "discussion");
  rankView.classList.toggle("hidden", view !== "rank");
  adminView.classList.toggle("hidden", view !== "admin");
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === view));
  if (view === "admin") loadAdminDishes(document.querySelector("#adminSearchInput").value.trim());
  if (view === "week") loadWeeklyMenu();
  if (view === "vote") loadVoteDishes();
  if (view === "discussion") loadDiscussion();
  if (view === "rank") loadRankingDishes();
}

function bindEvents() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => showView(tab.dataset.view));
  });

  document.querySelector("#adminSearchForm").addEventListener("submit", (event) => {
    event.preventDefault();
    loadAdminDishes(document.querySelector("#adminSearchInput").value.trim());
  });

  document.querySelector("#adminSearchInput").addEventListener("input", (event) => {
    clearTimeout(adminSearchTimer);
    adminSearchTimer = setTimeout(() => loadAdminDishes(event.target.value.trim()), 220);
  });
  document.querySelector("#adminRestaurantFilter").addEventListener("change", () => {
    loadAdminDishes(document.querySelector("#adminSearchInput").value.trim());
  });

  document.querySelector("#clearAdminSearch").addEventListener("click", () => {
    document.querySelector("#adminSearchInput").value = "";
    loadAdminDishes();
  });

  document.querySelector("#deleteAllDishes").addEventListener("click", deleteAllDishes);
  document.querySelector("#deduplicateDishes").addEventListener("click", deduplicateDishes);

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

  document.querySelector("#bulkDishNames").addEventListener("input", renderBulkUploadPreview);
  document.querySelector("#bulkDishRestaurant").addEventListener("change", renderBulkUploadPreview);
  document.querySelector("#bulkDishImages").addEventListener("change", (event) => {
    bulkDishFiles = [...event.target.files];
    renderBulkUploadPreview();
  });
  document.querySelector("#bulkDishForm").addEventListener("submit", uploadBulkDishes);

  document.querySelector("#weeklyMenuForm").addEventListener("submit", (event) => {
    event.preventDefault();
    saveWeeklyMenu();
  });
  document.querySelector("#clearWeeklyMenu").addEventListener("click", clearWeeklyMenu);

  document.querySelector("#weeklyImportButton").addEventListener("click", () => {
    weeklyImportModal.classList.remove("hidden");
    weeklyImportMessage.textContent = "请选择一个 Excel 文件或菜单图片。";
    weeklyImportFile.value = "";
    weeklyImportResult = null;
    renderWeeklyImportPreview(null);
  });
  weeklyImportFile.addEventListener("change", (event) => {
    recognizeWeeklyImportFile(event.target.files[0] || null);
  });
  weeklyImportApply.addEventListener("click", applyWeeklyImport);
  document.querySelector("#weeklyImportClose").addEventListener("click", closeWeeklyImportModal);
  document.querySelector("#weeklyImportCancel").addEventListener("click", closeWeeklyImportModal);
  weeklyImportModal.addEventListener("click", (event) => {
    if (event.target === weeklyImportModal) closeWeeklyImportModal();
  });

  document.querySelectorAll(".meal-tab").forEach((button) => {
    button.addEventListener("click", () => setWeeklyMeal(button.dataset.weeklyMeal));
  });
  document.querySelectorAll("[data-weekly-restaurant]").forEach((button) => {
    button.addEventListener("click", () => setWeeklyRestaurant(button.dataset.weeklyRestaurant));
  });
  document.querySelectorAll("[data-vote-restaurant]").forEach((button) => {
    button.addEventListener("click", () => setVoteRestaurant(button.dataset.voteRestaurant));
  });

  document.querySelector("#openDiscussionComposer").addEventListener("click", () => {
    document.querySelector("#discussionForm").classList.remove("hidden");
    document.querySelector("#discussionInput").focus();
  });
  document.querySelector("#cancelDiscussionComposer").addEventListener("click", () => {
    document.querySelector("#discussionForm").classList.add("hidden");
    document.querySelector("#discussionInput").value = "";
  });
  document.querySelector("#discussionForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const input = document.querySelector("#discussionInput");
    const content = input.value.trim();
    if (!content) {
      discussionMessage.textContent = "请输入意见内容。";
      return;
    }
    const button = form.querySelector("button[type='submit']");
    button.disabled = true;
    try {
      await addDiscussionComment(null, content);
      input.value = "";
      form.classList.add("hidden");
      await loadDiscussion();
      discussionMessage.textContent = "意见已发布。";
    } catch (error) {
      discussionMessage.textContent = friendlyError(error);
    } finally {
      button.disabled = false;
    }
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
    openAdminModal();
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
    if (currentView === "admin") showView("vote");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!commentModal.classList.contains("hidden")) closeCommentModal();
      if (!adminModal.classList.contains("hidden")) adminModal.classList.add("hidden");
      if (!weeklyImportModal.classList.contains("hidden")) closeWeeklyImportModal();
    }
  });
}

async function init() {
  weeklyMenus = createEmptyWeeklyMenus();
  bindEvents();
  updateAdminState();
  renderBulkUploadPreview();
  createWeeklyForm();
  try {
    await loadAllDishes(true);
    await Promise.all([loadWeeklyMenu(), loadVoteDishes(), loadRankingDishes(), loadDiscussion()]);
  } catch (error) {
    adminMessage.textContent = friendlyError(error);
    weeklyMessage.textContent = friendlyError(error);
    voteMessage.textContent = friendlyError(error);
    discussionMessage.textContent = friendlyError(error);
    rankMessage.textContent = friendlyError(error);
  }
}

init();
