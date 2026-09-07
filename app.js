const STORAGE_KEY = "dish-menu-static-state-v1";

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

let state = null;
let selectedImage = "";
let selectedRecognitionImage = "";
let selectedRecognitionFile = null;
let weeklyMenu = {};
let adminSearchTimer;
let activeCommentDish = null;

const days = [
  { id: "monday", label: "星期一" },
  { id: "tuesday", label: "星期二" },
  { id: "wednesday", label: "星期三" },
  { id: "thursday", label: "星期四" },
  { id: "friday", label: "星期五" }
];
const meals = [
  { id: "breakfast", label: "早餐" },
  { id: "lunch", label: "午餐" },
  { id: "dinner", label: "晚餐" }
];

const seedDishes = [
  { id: "seed-soup", name: "甜水果汤", imageUrl: "assets/plate_01_top_soup.jpg", voteCount: 2 },
  { id: "seed-rice", name: "米饭", imageUrl: "assets/plate_02_top_rice.jpg", voteCount: 5 },
  { id: "seed-fruit", name: "苹果", imageUrl: "assets/plate_03_top_fruit.jpg", voteCount: 1 },
  { id: "seed-beef", name: "炒牛肉", imageUrl: "assets/dish_04_r1c1.jpg", voteCount: 8 },
  { id: "seed-egg", name: "肉米炖蛋", imageUrl: "assets/dish_05_r1c2.jpg", voteCount: 4 },
  { id: "seed-pumpkin", name: "蒸南瓜", imageUrl: "assets/dish_06_r1c3.jpg", voteCount: 3 },
  { id: "seed-caifan", name: "菜饭", imageUrl: "assets/dish_07_r1c4.jpg", voteCount: 6 },
  { id: "seed-pork", name: "红烧肉", imageUrl: "assets/dish_08_r2c1.jpg", voteCount: 9 },
  { id: "seed-green", name: "清炒青菜", imageUrl: "assets/dish_09_r2c2.jpg", voteCount: 2 },
  { id: "seed-tomato-egg", name: "番茄炒蛋", imageUrl: "assets/dish_10_r2c3.jpg", voteCount: 7 },
  { id: "seed-potato-beef", name: "土豆烧牛肉", imageUrl: "assets/dish_11_r2c4.jpg", voteCount: 5 },
  { id: "seed-yuxiang", name: "鱼香肉丝", imageUrl: "assets/dish_12_r3c1.jpg", voteCount: 4 },
  { id: "seed-kungpao", name: "宫保鸡丁", imageUrl: "assets/dish_13_r3c2.jpg", voteCount: 10 },
  { id: "seed-custard", name: "鸡蛋羹", imageUrl: "assets/dish_14_r3c3.jpg", voteCount: 3 },
  { id: "seed-duck", name: "红烧鸭块", imageUrl: "assets/dish_15_r3c4.jpg", voteCount: 6 }
].map((dish, index) => ({
  ...dish,
  createdAt: new Date(Date.now() - index * 86400000).toISOString(),
  comments: []
}));

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

function createEmptyWeeklyMenu() {
  return Object.fromEntries(days.map((day) => [day.id, Object.fromEntries(meals.map((meal) => [meal.id, [""]]))]));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}

function createId(prefix = "item") {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

function normalizeImportedWeeklyMenu(input) {
  const result = createEmptyWeeklyMenu();
  for (const day of days) {
    for (const meal of meals) {
      const value = input?.[day.id]?.[meal.id];
      const items = Array.isArray(value) ? value : (value ? [value] : [""]);
      result[day.id][meal.id] = items.map((name) => String(name || "").trim()).filter(Boolean).slice(0, 8);
      if (!result[day.id][meal.id].length) result[day.id][meal.id] = [""];
    }
  }
  return result;
}

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (stored && Array.isArray(stored.dishes)) {
      state = {
        dishes: stored.dishes.map((dish) => ({
          id: dish.id || createId("dish"),
          name: String(dish.name || "").trim(),
          imageUrl: dish.imageUrl || "",
          voteCount: Number(dish.voteCount || 0),
          createdAt: dish.createdAt || new Date().toISOString(),
          comments: Array.isArray(dish.comments) ? dish.comments : []
        })).filter((dish) => dish.name),
        weeklyMenu: normalizeImportedWeeklyMenu(stored.weeklyMenu)
      };
      return;
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  state = { dishes: seedDishes, weeklyMenu: createEmptyWeeklyMenu() };
  saveState();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function findDishById(id) {
  return state.dishes.find((dish) => dish.id === id);
}

function getDishes(name = "", sort = "") {
  const query = normalizeForDishMatch(name);
  const dishes = state.dishes.filter((dish) => !query || normalizeForDishMatch(dish.name).includes(query));
  if (sort === "votes") {
    return [...dishes].sort((a, b) => Number(b.voteCount || 0) - Number(a.voteCount || 0) || a.name.localeCompare(b.name, "zh-CN"));
  }
  return [...dishes].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function findDishForName(name) {
  const normalized = normalizeForDishMatch(name);
  if (!normalized) return null;
  const exact = state.dishes.find((dish) => normalizeForDishMatch(dish.name) === normalized);
  if (exact) return exact;
  return state.dishes
    .filter((dish) => normalized.includes(normalizeForDishMatch(dish.name)) || normalizeForDishMatch(dish.name).includes(normalized))
    .sort((a, b) => normalizeForDishMatch(b.name).length - normalizeForDishMatch(a.name).length)[0] || null;
}

function getTopComment(dish) {
  const comments = Array.isArray(dish.comments) ? dish.comments : [];
  if (!comments.length) return null;
  const maxLikes = Math.max(...comments.map((comment) => Number(comment.likeCount || 0)));
  const candidates = comments.filter((comment) => Number(comment.likeCount || 0) === maxLikes);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function showView(view) {
  menuView.classList.toggle("hidden", view !== "menu");
  weekView.classList.toggle("hidden", view !== "week");
  voteView.classList.toggle("hidden", view !== "vote");
  rankView.classList.toggle("hidden", view !== "rank");
  adminView.classList.toggle("hidden", view !== "admin");
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === view));
  if (view === "admin") loadAdminDishes(document.querySelector("#adminSearchInput").value.trim());
  if (view === "week") loadWeeklyMenu();
  if (view === "vote") loadVoteDishes();
  if (view === "rank") loadRankingDishes();
}

function renderCards(target, dishes, emptyText) {
  target.innerHTML = dishes.length
    ? dishes.map((dish) => `
      <article class="dish-card">
        <img src="${escapeHtml(dish.imageUrl)}" alt="${escapeHtml(dish.name)}" />
        <div class="dish-info">
          <h3>${escapeHtml(dish.name)}</h3>
          <span>${new Date(dish.createdAt).toLocaleDateString("zh-CN")}</span>
        </div>
      </article>`).join("")
    : `<div class="empty-state">${escapeHtml(emptyText)}</div>`;
}

function searchDishes(name) {
  const dishes = getDishes(name);
  renderCards(resultGrid, dishes, "没有找到对应图片，请先在后台录入。");
  searchMessage.textContent = dishes.length ? `找到 ${dishes.length} 条结果。` : "没有找到对应菜品。";
}

function getDishCandidates() {
  const candidates = new Map();
  for (const dish of state.dishes) {
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

function createRecognitionItem(name, dish = null, source = "local") {
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

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function compressImageFile(file) {
  const rawDataUrl = await readFileAsDataUrl(file);
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const maxSize = 1280;
      const ratio = Math.min(1, maxSize / image.width, maxSize / image.height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * ratio));
      canvas.height = Math.max(1, Math.round(image.height * ratio));
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    image.onerror = () => resolve(rawDataUrl);
    image.src = rawDataUrl;
  });
}

async function recognizeImageTextInBrowser() {
  if (!selectedRecognitionFile || typeof window.TextDetector !== "function") return "";
  try {
    const detector = new window.TextDetector();
    const bitmap = await createImageBitmap(selectedRecognitionFile);
    const results = await detector.detect(bitmap);
    return results.map((item) => item.rawValue).filter(Boolean).join("\n");
  } catch {
    return "";
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
    const imageText = await recognizeImageTextInBrowser();
    const combinedText = [text, imageText].filter(Boolean).join("\n");
    const items = recognizeDishesFromText(combinedText);
    const matchedCount = items.filter((item) => item.imageUrl).length;
    const ocrNotice = selectedRecognitionFile && !imageText ? " 当前浏览器没有返回图片文字，可粘贴菜单文字后识别。" : "";
    renderRecognizedDishes(items);
    recognitionMessage.textContent = items.length
      ? `识别到 ${items.length} 个菜名，${matchedCount} 个已匹配图片。${ocrNotice}`
      : `没有识别到菜名。${ocrNotice}`;
  } finally {
    submitButton.disabled = false;
  }
}

function loadAdminDishes(name = "") {
  const dishes = getDishes(name);
  document.querySelector("#adminCount").textContent = `${dishes.length} 条记录`;
  renderCards(adminGrid, dishes, "还没有录入菜品。");
}

function renderVoteCards(dishes) {
  document.querySelector("#voteCount").textContent = `${dishes.length} 个菜品`;
  voteGrid.innerHTML = dishes.length
    ? dishes.map((dish) => {
      const topComment = getTopComment(dish);
      return `
        <article class="vote-card">
          <div class="vote-media">
            <img src="${escapeHtml(dish.imageUrl)}" alt="${escapeHtml(dish.name)}" />
            <p class="top-comment">${topComment ? `热门评论：${escapeHtml(topComment.content)} <span>${Number(topComment.likeCount || 0)} 赞</span>` : "暂无评论"}</p>
          </div>
          <div class="vote-body">
            <h3>${escapeHtml(dish.name)}</h3>
            <div class="vote-actions">
              <button class="primary vote-button" type="button" data-id="${escapeHtml(dish.id)}">投票</button>
              <button class="secondary comment-button" type="button" data-id="${escapeHtml(dish.id)}" data-name="${escapeHtml(dish.name)}">评论</button>
            </div>
            <p>累计投票数：<strong data-vote-total="${escapeHtml(dish.id)}">${Number(dish.voteCount || 0)}</strong></p>
          </div>
        </article>`;
    }).join("")
    : `<div class="empty-state">还没有菜品，请先在后台录入。</div>`;
  voteGrid.querySelectorAll(".vote-button").forEach((button) => {
    button.addEventListener("click", () => {
      const dish = findDishById(button.dataset.id);
      if (!dish) return;
      dish.voteCount = Number(dish.voteCount || 0) + 1;
      saveState();
      document.querySelector(`[data-vote-total="${button.dataset.id}"]`).textContent = dish.voteCount;
      voteMessage.textContent = `已为「${dish.name}」投票。`;
    });
  });
  voteGrid.querySelectorAll(".comment-button").forEach((button) => {
    button.addEventListener("click", () => openCommentModal(button.dataset.id, button.dataset.name));
  });
}

function loadVoteDishes() {
  renderVoteCards(getDishes(""));
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
    button.addEventListener("click", () => {
      const dish = findDishById(activeCommentDish?.id);
      const comment = dish?.comments?.find((item) => item.id === button.dataset.id);
      if (!comment) return;
      comment.likeCount = Number(comment.likeCount || 0) + 1;
      saveState();
      renderComments(dish.comments);
      commentMessage.textContent = "已点赞。";
    });
  });
}

function openCommentModal(dishId, dishName) {
  activeCommentDish = { id: dishId, name: dishName };
  const dish = findDishById(dishId);
  commentTitle.textContent = `${dishName}的评论`;
  commentInput.value = "";
  commentMessage.textContent = "";
  commentModal.classList.remove("hidden");
  renderComments(dish?.comments || []);
  commentInput.focus();
}

function savePendingComment() {
  if (!activeCommentDish) return;
  const dish = findDishById(activeCommentDish.id);
  const content = commentInput.value.trim();
  if (!dish || !content) return;
  dish.comments = Array.isArray(dish.comments) ? dish.comments : [];
  dish.comments.push({
    id: createId("comment"),
    content: content.slice(0, 500),
    likeCount: 0,
    createdAt: new Date().toISOString()
  });
  commentInput.value = "";
  saveState();
}

function closeCommentModal() {
  savePendingComment();
  commentModal.classList.add("hidden");
  activeCommentDish = null;
  loadVoteDishes();
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
          <img src="${escapeHtml(dish.imageUrl)}" alt="${escapeHtml(dish.name)}" />
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

function loadRankingDishes() {
  renderRanking(getDishes("", "votes"));
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
}

function lookupWeeklyDish(name, dayId, mealId, index) {
  const key = `${dayId}-${mealId}-${index}`;
  const preview = document.querySelector(`[data-preview="${key}"]`);
  const suggestions = document.querySelector(`[data-suggestions="${key}"]`);
  if (!name) {
    preview.innerHTML = "<span>输入后显示图片</span>";
    suggestions.innerHTML = "";
    return;
  }
  const dishes = getDishes(name);
  const match = dishes[0];
  preview.innerHTML = match
    ? `<img src="${escapeHtml(match.imageUrl)}" alt="${escapeHtml(match.name)}" /><strong>${escapeHtml(match.name)}</strong>`
    : "<span>暂无匹配图片</span>";
  suggestions.innerHTML = dishes.slice(0, 4).map((dish) => `
    <button type="button" class="suggestion" data-name="${escapeHtml(dish.name)}">${escapeHtml(dish.name)}</button>`).join("");
  suggestions.querySelectorAll(".suggestion").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.querySelector(`.weekly-input[data-day="${dayId}"][data-meal="${mealId}"][data-index="${index}"]`);
      input.value = button.dataset.name;
      weeklyMenu[dayId][mealId][index] = button.dataset.name;
      lookupWeeklyDish(button.dataset.name, dayId, mealId, index);
    });
  });
}

function loadWeeklyMenu() {
  weeklyMenu = normalizeImportedWeeklyMenu(state.weeklyMenu);
  createWeeklyForm();
  for (const day of days) {
    for (const meal of meals) {
      weeklyMenu[day.id][meal.id].forEach((value, index) => {
        if (value) lookupWeeklyDish(value, day.id, meal.id, index);
      });
    }
  }
}

function exportData() {
  const blob = new Blob([JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `菜单静态版数据-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      if (!Array.isArray(payload.dishes)) throw new Error("invalid data");
      state = {
        dishes: payload.dishes.map((dish) => ({
          id: dish.id || createId("dish"),
          name: String(dish.name || "").trim(),
          imageUrl: dish.imageUrl || "",
          voteCount: Number(dish.voteCount || 0),
          createdAt: dish.createdAt || new Date().toISOString(),
          comments: Array.isArray(dish.comments) ? dish.comments : []
        })).filter((dish) => dish.name),
        weeklyMenu: normalizeImportedWeeklyMenu(payload.weeklyMenu)
      };
      saveState();
      loadAdminDishes(document.querySelector("#adminSearchInput").value.trim());
      loadWeeklyMenu();
      loadVoteDishes();
      loadRankingDishes();
      adminMessage.textContent = "数据已导入。";
    } catch {
      adminMessage.textContent = "导入失败，请选择正确的数据文件。";
    }
  };
  reader.readAsText(file, "utf-8");
}

document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => showView(tab.dataset.view)));

document.querySelector("#searchForm").addEventListener("submit", (event) => {
  event.preventDefault();
  searchDishes(document.querySelector("#searchInput").value.trim());
});

document.querySelector("#recognitionImage").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  selectedRecognitionImage = "";
  selectedRecognitionFile = null;
  document.querySelector("#recognitionFileName").textContent = "";
  if (!file) return;
  selectedRecognitionFile = file;
  selectedRecognitionImage = await readFileAsDataUrl(file);
  document.querySelector("#recognitionFileName").textContent = file.name;
});

document.querySelector("#recognitionForm").addEventListener("submit", (event) => {
  event.preventDefault();
  recognizeMenuInput();
});

document.querySelector("#clearRecognition").addEventListener("click", () => {
  selectedRecognitionImage = "";
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
  const file = event.target.files[0];
  selectedImage = "";
  if (!file) return;
  selectedImage = await compressImageFile(file);
  imagePreview.classList.remove("empty");
  imagePreview.innerHTML = `<img src="${selectedImage}" alt="图片预览" />`;
});

document.querySelector("#dishForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!selectedImage) return;
  const name = document.querySelector("#dishName").value.trim().slice(0, 120);
  if (!name) return;
  state.dishes.unshift({
    id: createId("dish"),
    name,
    imageUrl: selectedImage,
    voteCount: 0,
    createdAt: new Date().toISOString(),
    comments: []
  });
  saveState();
  adminMessage.textContent = "保存成功。";
  event.target.reset();
  selectedImage = "";
  imagePreview.className = "preview empty";
  imagePreview.textContent = "选择图片后预览";
  loadAdminDishes(document.querySelector("#adminSearchInput").value.trim());
});

document.querySelector("#weeklyMenuForm").addEventListener("submit", (event) => {
  event.preventDefault();
  state.weeklyMenu = normalizeImportedWeeklyMenu(weeklyMenu);
  saveState();
  weeklyMessage.textContent = "一周菜单已保存。";
});

document.querySelector("#commentClose").addEventListener("click", closeCommentModal);
commentModal.addEventListener("click", (event) => {
  if (event.target === commentModal) closeCommentModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !commentModal.classList.contains("hidden")) closeCommentModal();
});

document.querySelector("#exportData").addEventListener("click", exportData);
document.querySelector("#importData").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (file) importData(file);
  event.target.value = "";
});

loadState();
loadWeeklyMenu();
loadAdminDishes();
loadVoteDishes();
loadRankingDishes();
