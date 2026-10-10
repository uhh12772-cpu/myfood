(function () {
  "use strict";

  const REPORT_AUTHOR = "eva";
  const REPORT_MONTHLY_TABLE = "report_monthly_metrics";
  const PDF_LIBRARIES = {
    html2canvas: "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js",
    jspdf: "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js"
  };

  const TABLE_CANDIDATES = {
    votes: ["dish_votes", "votes", "dish_vote", "vote_records", "dish_vote_records", "food_votes"],
    dishComments: ["dish_comments", "comments", "dish_reviews", "food_comments"],
    opinionPosts: [
      "discussion_comments",
      "forum_posts",
      "opinion_posts",
      "feedback_posts",
      "discussion_threads",
      "canteen_posts",
      "discussion_posts"
    ],
    opinionReplies: [
      "forum_replies",
      "forum_comments",
      "opinion_replies",
      "opinion_comments",
      "feedback_replies",
      "feedback_comments",
      "discussion_replies",
      "discussion_comments",
      "survey_comments"
    ],
    analytics: ["site_analytics_counters"],
    rankings: ["dish_rankings", "dish_vote_rankings", "v_dish_rankings", "dish_ranking"]
  };

  const reportStyles = `
    .report-action-button {
      border-color: #187f7a !important;
      background: #f2fffd !important;
      color: #115e59 !important;
    }
    .report-action-button:hover:not(:disabled) {
      border-color: #0f766e !important;
      background: #dffaf6 !important;
      transform: translateY(-1px);
    }
    .report-action-button.is-monthly {
      border-color: #3478a5 !important;
      background: #f2f8fc !important;
      color: #225f85 !important;
    }
    .report-action-button:disabled {
      cursor: wait;
      opacity: .68;
    }
    .report-progress-mask {
      position: fixed;
      inset: 0;
      z-index: 10020;
      display: grid;
      place-items: center;
      background: rgba(16, 24, 31, .42);
      backdrop-filter: blur(3px);
    }
    .report-progress-panel {
      width: min(360px, calc(100vw - 40px));
      padding: 24px;
      border: 1px solid rgba(38, 198, 180, .45);
      border-radius: 8px;
      background: #fff;
      box-shadow: 0 18px 50px rgba(13, 38, 49, .22);
      color: #172a32;
      text-align: center;
    }
    .report-progress-spinner {
      width: 36px;
      height: 36px;
      margin: 0 auto 14px;
      border: 3px solid #dce9ed;
      border-top-color: #0f8f86;
      border-radius: 50%;
      animation: report-spin .8s linear infinite;
    }
    .report-progress-title { font-size: 16px; font-weight: 700; }
    .report-progress-detail { margin-top: 7px; color: #64747c; font-size: 13px; }
    @keyframes report-spin { to { transform: rotate(360deg); } }
    @media (max-width: 720px) {
      .report-action-button { flex: 1 1 calc(50% - 6px); justify-content: center; }
    }
  `;

  function injectReportStyles() {
    if (document.getElementById("report-action-styles")) return;
    const style = document.createElement("style");
    style.id = "report-action-styles";
    style.textContent = reportStyles;
    document.head.appendChild(style);
  }

  function normalizeText(value) {
    return String(value ?? "").trim();
  }

  function numberValue(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function firstValue(row, keys, fallback = "") {
    for (const key of keys) {
      if (row && row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
    }
    return fallback;
  }

  function rowId(row) {
    return String(firstValue(row, ["id", "dish_id", "uuid"], ""));
  }

  function dishIdFromRow(row) {
    return String(firstValue(row, [
      "dish_id", "food_id", "menu_dish_id", "menu_item_id", "dishId", "foodId", "item_id", "target_id"
    ], ""));
  }

  function normalizeRestaurant(value) {
    const text = normalizeText(value).toLowerCase();
    if (/七立方|7立方|qilifang|qi.?li.?fang|seven|qlf/.test(text)) return "七立方";
    if (/荷特宝|hetebao|hotebao|hotbao|he.?te.?bao|htb/.test(text)) return "荷特宝";
    return normalizeText(value);
  }

  function isTopLevelPost(row) {
    const parent = firstValue(row, ["parent_id", "parent_post_id", "parent_comment_id", "reply_to_id"], null);
    return parent === null || parent === undefined || parent === "";
  }

  function rowDate(row) {
    const raw = firstValue(row, ["created_at", "published_at", "inserted_at", "created_on", "date"], "");
    const date = raw ? new Date(raw) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
  }

  function uniqueCommentRows(rows) {
    const seen = new Set();
    return rows.filter((row, index) => {
      const id = firstValue(row, ["id", "comment_id", "post_id", "reply_id", "uuid"], "");
      const createdAt = firstValue(row, ["created_at", "published_at", "inserted_at", "created_on"], "");
      const content = firstValue(row, ["content", "comment", "text", "body", "message", "review"], "");
      const identity = id || createdAt || content
        ? `${id}|${createdAt}|${content}`
        : `anonymous-${index}`;
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
  }

  function monthRange(now = new Date()) {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      key: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
      label: `${now.getFullYear()}年${now.getMonth() + 1}月`
    };
  }

  function inDateRange(row, range) {
    const date = rowDate(row);
    return Boolean(date && date >= range.start && date < range.end);
  }

  async function apiGet(path) {
    if (typeof supabaseFetch !== "function") {
      throw new Error("Supabase 连接尚未初始化");
    }
    const result = await supabaseFetch(path);
    return Array.isArray(result) ? result : [];
  }

  async function fetchAllTables(names) {
    const results = [];
    for (const name of names) {
      try {
        const rows = await apiGet(`${name}?select=*&limit=5000`);
        results.push({ name, rows });
      } catch {
        // Different project versions used different table names. Try the next known name.
      }
    }
    return {
      name: results.map((result) => result.name).join(","),
      rows: results.flatMap((result) => result.rows)
    };
  }

  async function fetchFirstNonEmptyTable(names) {
    let firstExisting = { name: "", rows: [] };
    for (const name of names) {
      try {
        const rows = await apiGet(`${name}?select=*&limit=5000`);
        if (!firstExisting.name) firstExisting = { name, rows };
        if (rows.length) return { name, rows };
      } catch {
        // Try the next table name used by earlier project versions.
      }
    }
    return firstExisting;
  }

  function mergeRows(rows) {
    const merged = new Map();
    rows.forEach((row, index) => {
      const key = String(firstValue(row, [
        "id", "dish_id", "food_id", "menu_dish_id", "menu_item_id", "uuid"
      ], `row-${index}`));
      const existing = merged.get(key);
      merged.set(key, existing ? { ...existing, ...row } : row);
    });
    return Array.from(merged.values());
  }

  function dishesFromCurrentState() {
    let appState = null;
    try {
      if (typeof state !== "undefined" && state) appState = state;
    } catch {
      // State is optional; the REST fallback below is authoritative.
    }
    appState ||= window.appState || window.__APP_STATE__ || null;
    if (!appState || typeof appState !== "object") return [];

    const dishes = [];
    const visited = new WeakSet();
    const walk = (value, restaurantHint = "", depth = 0) => {
      if (!value || typeof value !== "object" || depth > 7 || visited.has(value)) return;
      visited.add(value);
      if (Array.isArray(value)) {
        value.forEach((entry) => walk(entry, restaurantHint, depth + 1));
        return;
      }

      const ownRestaurant = normalizeRestaurant(firstValue(value, [
        "restaurant", "restaurant_name", "restaurant_type", "restaurant_tag", "restaurant_code",
        "canteen", "canteen_name", "canteen_type", "canteen_tag", "cafeteria", "dining_hall", "tag"
      ], "")) || restaurantHint;
      const name = normalizeText(firstValue(value, ["name", "dish_name", "title", "food_name"], ""));
      const hasDishIdentity = Boolean(firstValue(value, ["id", "dish_id", "food_id", "image_url", "image", "photo_url"], ""));
      const hasRankingValue = firstValue(value, [
        "vote_count", "voteCount", "votes", "votes_count", "total_votes", "vote_total", "vote_num"
      ], null) !== null;

      if (name && hasDishIdentity && (hasRankingValue || ownRestaurant)) {
        dishes.push(ownRestaurant ? { ...value, restaurant: ownRestaurant } : value);
      }

      Object.entries(value).forEach(([key, child]) => {
        const keyRestaurant = normalizeRestaurant(key);
        walk(child, keyRestaurant || ownRestaurant, depth + 1);
      });
    };
    walk(appState);
    return mergeRows(dishes);
  }

  async function fetchDishes() {
    const current = dishesFromCurrentState();
    if (current.length) return current;
    const base = await fetchAllTables(["dishes", "foods", "menu_dishes"]);
    if (base.rows.length) return mergeRows(base.rows);
    const rankings = await fetchAllTables(TABLE_CANDIDATES.rankings);
    return mergeRows(rankings.rows);
  }

  function groupCount(rows, idGetter) {
    const counts = new Map();
    rows.forEach((row) => {
      const id = idGetter(row);
      if (!id) return;
      const increment = numberValue(firstValue(row, [
        "vote_count", "voteCount", "count", "count_value", "votes", "total_votes"
      ], 1)) || 1;
      counts.set(id, (counts.get(id) || 0) + increment);
    });
    return counts;
  }

  function commentLikeCount(row) {
    return numberValue(firstValue(row, [
      "like_count", "likeCount", "likes", "likes_count", "total_likes", "like_total", "thumbs_up"
    ], 0));
  }

  function commentText(row) {
    return normalizeText(firstValue(row, [
      "content", "comment", "comment_text", "comment_content", "text", "body", "message", "review", "review_text"
    ], ""));
  }

  function conciseComplaint(value) {
    const original = normalizeText(value).replace(/\s+/g, "");
    if (!original) return "";
    if (/好吃|很好|正常|夯|爽|超模|回购|颜值|实力|幸福感|支持|羡慕|广受好评|唯一能吃/.test(original)) return "";
    const rules = [
      [/鼻涕|拉丝|粘稠/, "过于粘稠"],
      [/图片.*蒙牛|图.*不符|货不对板/, "图物不符"],
      [/死虾|不新鲜/, "食材不新鲜"],
      [/冷冻/, "冷冻感较重"],
      [/泔水|没食欲|卖相/, "卖相欠佳"],
      [/鸡块.*少|少量鸡块/, "鸡块分量偏少"],
      [/豆芽|笋.*挑肉|挑肉/, "肉量偏少"],
      [/一碗水|汤.*水|豆浆.*水|稀得?像水/, "内容过于单薄"],
      [/皮厚馅薄/, "皮厚馅少"],
      [/稀稀拉拉|过稀/, "口感过稀"],
      [/太熟|火候过|烧过/, "火候过头"],
      [/糊在一起|粘在一起|粘连/, "口感粘连"],
      [/太软|一样软|偏软/, "口感偏软"],
      [/太硬|偏硬/, "口感偏硬"],
      [/口感.*奇怪|很奇怪/, "口感较奇怪"],
      [/皇陵|殉葬|地下有/, "口感欠佳"],
      [/慈禧|剩的|不腐/, "食材不够新鲜"],
      [/太甜|好甜|糖/, "过于甜腻"],
      [/油太多|浸泡在油|太油|油腻/, "过于油腻"],
      [/太咸|偏咸/, "口味偏咸"],
      [/太淡|没味|偏淡/, "口味偏淡"],
      [/太少|分量少|不够吃/, "分量偏少"],
      [/难吃|不好吃|垃圾|差点吐|脑残|鸡吧|一坨|如史/, "整体口感欠佳"]
    ];
    const matched = rules.find(([pattern]) => pattern.test(original));
    if (matched) return matched[1];
    const cleaned = original
      .replace(/脑残|垃圾|鸡吧|傻逼|卧槽|妈的|一坨|如史/g, "")
      .replace(/[～~!！?？…。，、；;：:“”"'（）()]/g, "")
      .replace(/啊{2,}|哦{2,}/g, "")
      .trim();
    if (cleaned.length < 3) return "";
    return cleaned.slice(0, 10);
  }

  function normalizedDiscussionText(value) {
    const text = normalizeText(value).replace(/\s+/g, " ");
    if (!text) return "";
    const compact = text.replace(/\s+/g, "");
    const rules = [
      [/牛奶只有.*豆浆.*水|豆浆.*水/, "牛奶供应次数较少，豆浆口感偏稀。"],
      [/所有菜.*糖|致死量.*糖|太甜/, "部分菜品甜度过高，建议减少糖量。"],
      [/油太多|血脂|浸泡在油/, "部分菜品用油偏多，建议适当减油。"],
      [/意面.*肉酱.*没有面/, "意面中面量不足，建议调整配比。"],
      [/^一坨$/, "整体口感和卖相有待改善。"]
    ];
    const matched = rules.find(([pattern]) => pattern.test(compact));
    if (matched) return matched[1];
    return text
      .replace(/脑残|垃圾|鸡吧|傻逼|卧槽|妈的/g, "表达较激烈")
      .replace(/啊{3,}|哦{3,}/g, "")
      .slice(0, 80);
  }

  function metricDescriptor(row) {
    return `${firstValue(row, ["metric_type", "type"], "")} ${firstValue(row, ["metric_key", "key", "name"], "")}`.toLowerCase();
  }

  function metricCount(row) {
    return numberValue(firstValue(row, ["count_value", "value", "count", "total"], 0));
  }

  function findCounter(rows, matcher) {
    const matching = rows.filter((row) => matcher(metricDescriptor(row)));
    const totalRow = matching.find((row) => /(^|\s|:|_)total($|\s|:|_)/.test(metricDescriptor(row)));
    if (totalRow) return metricCount(totalRow);
    return matching.reduce((sum, row) => sum + metricCount(row), 0);
  }

  function metricFromAdminPage(label) {
    const nodes = Array.from(document.querySelectorAll("body *"));
    const labelNode = nodes.find((node) => node.children.length === 0 && normalizeText(node.textContent) === label);
    if (!labelNode) return 0;
    let parent = labelNode.parentElement;
    for (let depth = 0; parent && depth < 4; depth += 1, parent = parent.parentElement) {
      const numbers = normalizeText(parent.textContent).match(/\d[\d,]*/g);
      if (numbers?.length) return numberValue(numbers[numbers.length - 1].replaceAll(",", ""));
    }
    return 0;
  }

  async function fetchMonthlyMetrics(range) {
    try {
      const rows = await apiGet(`${REPORT_MONTHLY_TABLE}?select=*&month_start=eq.${range.key}`);
      const clicks = rows
        .filter((row) => /click|点击/.test(normalizeText(firstValue(row, ["metric_key", "key"], "")).toLowerCase()))
        .reduce((sum, row) => sum + metricCount(row), 0);
      const likes = rows
        .filter((row) => /like|点赞/.test(normalizeText(firstValue(row, ["metric_key", "key"], "")).toLowerCase()))
        .reduce((sum, row) => sum + metricCount(row), 0);
      return { clicks, likes, available: true };
    } catch {
      return { clicks: 0, likes: 0, available: false };
    }
  }

  function buildDishRecords(dishes, votes, comments) {
    const voteRowsByDish = groupCount(votes, dishIdFromRow);
    const commentsByDish = new Map();
    const commentsByDishName = new Map();

    comments.forEach((comment) => {
      const id = dishIdFromRow(comment);
      if (id) {
        if (!commentsByDish.has(id)) commentsByDish.set(id, []);
        commentsByDish.get(id).push(comment);
      }
      const dishName = normalizeText(firstValue(comment, [
        "dish_name", "food_name", "menu_dish_name", "menu_item_name", "target_name"
      ], "")).replace(/\s+/g, "").toLocaleLowerCase("zh-CN");
      if (dishName) {
        if (!commentsByDishName.has(dishName)) commentsByDishName.set(dishName, []);
        commentsByDishName.get(dishName).push(comment);
      }
    });

    return dishes.map((dish) => {
      const id = rowId(dish) || dishIdFromRow(dish);
      const normalizedDishName = normalizeText(firstValue(dish, ["name", "dish_name", "title", "food_name"], ""))
        .replace(/\s+/g, "").toLocaleLowerCase("zh-CN");
      const relatedComments = commentsByDish.get(id) || commentsByDishName.get(normalizedDishName) || [];
      const sortedComments = [...relatedComments].sort((a, b) => commentLikeCount(b) - commentLikeCount(a));
      const nestedComments = Array.isArray(dish.comments) ? dish.comments : [];
      const allComments = relatedComments.length ? sortedComments : nestedComments;
      const embeddedVotes = numberValue(firstValue(dish, [
        "vote_count", "voteCount", "votes", "votes_count", "total_votes", "vote_total", "vote_num", "votes_total"
      ], 0));
      const embeddedLikes = numberValue(firstValue(dish, [
        "like_count", "likeCount", "likes", "likes_count", "total_likes", "likes_total"
      ], 0));
      const commentLikes = allComments.reduce((sum, comment) => sum + commentLikeCount(comment), 0);
      const bestComment = [...allComments].sort((a, b) => commentLikeCount(b) - commentLikeCount(a))[0];

      return {
        id,
        name: normalizeText(firstValue(dish, ["name", "dish_name", "title", "food_name"], "未命名菜品")),
        restaurant: normalizeRestaurant(firstValue(dish, [
          "restaurant", "restaurant_key", "restaurantKey", "restaurant_name", "restaurant_type", "restaurant_tag", "restaurant_code",
          "canteen", "canteen_name", "canteen_type", "canteen_tag", "cafeteria", "cafeteria_name",
          "dining_hall", "dining_hall_name", "dining_hall_code", "food_court", "location", "shop", "tag"
        ], "")),
        imageUrl: normalizeText(firstValue(dish, ["image_url", "imageUrl", "image", "photo_url", "picture_url", "cover_url"], "")),
        votes: Math.max(embeddedVotes, voteRowsByDish.get(id) || 0),
        likes: Math.max(embeddedLikes, commentLikes),
        reviewLikes: bestComment ? commentLikeCount(bestComment) : 0,
        review: bestComment ? commentText(bestComment) : normalizeText(firstValue(dish, ["top_comment", "review"], ""))
      };
    });
  }

  function enrichRankingsWithReviews(rankings, dishRecords) {
    const recordsByName = new Map();
    dishRecords.forEach((record) => {
      const key = record.name.replace(/\s+/g, "").toLocaleLowerCase("zh-CN");
      if (!key) return;
      const current = recordsByName.get(key);
      const currentScore = current ? (current.review ? 1000000 : 0) + current.likes : -1;
      const nextScore = (record.review ? 1000000 : 0) + record.likes;
      if (!current || nextScore > currentScore) recordsByName.set(key, record);
    });
    return rankings.map((dish) => {
      const key = dish.name.replace(/\s+/g, "").toLocaleLowerCase("zh-CN");
      const source = recordsByName.get(key);
      if (!source) return dish;
      return {
        ...dish,
        likes: Math.max(dish.likes, source.likes),
        review: dish.review || source.review
      };
    });
  }

  function parseCountFromText(text, labels) {
    for (const label of labels) {
      const afterLabel = text.match(new RegExp(`${label}\\s*[：:]?\\s*(\\d[\\d,]*)`, "i"));
      if (afterLabel) return numberValue(afterLabel[1].replaceAll(",", ""));
      const beforeLabel = text.match(new RegExp(`(\\d[\\d,]*)\\s*${label}`, "i"));
      if (beforeLabel) return numberValue(beforeLabel[1].replaceAll(",", ""));
    }
    return 0;
  }

  function restaurantFromNearbyHeading(card) {
    const markers = Array.from(document.querySelectorAll(
      "h1, h2, h3, h4, h5, [class*='restaurant'], [class*='canteen'], [data-restaurant]"
    )).filter((node) => {
      const text = normalizeText(node.textContent);
      return text.length <= 80 && (text.includes("荷特宝") || text.includes("七立方"));
    });
    let restaurant = "";
    markers.forEach((marker) => {
      if (marker.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING) {
        restaurant = marker.textContent.includes("七立方") ? "七立方" : "荷特宝";
      }
    });
    return restaurant;
  }

  function rankingCardForImage(image) {
    let node = image.parentElement;
    for (let depth = 0; node && depth < 7; depth += 1, node = node.parentElement) {
      const text = normalizeText(node.textContent);
      const hasVote = /(?:投票数|票数|票|votes?)\s*[：:]?\s*\d|\d[\d,]*\s*(?:票|votes?)/i.test(text) || structuredCount(node, "vote") > 0;
      if (hasVote && text.length < 1200) return node;
    }
    return null;
  }

  function structuredCount(card, type) {
    const isVote = type === "vote";
    const attributes = isVote
      ? ["data-votes", "data-vote-count", "data-vote-total"]
      : ["data-likes", "data-like-count", "data-like-total"];
    for (const attribute of attributes) {
      const owner = card.matches(`[${attribute}]`) ? card : card.querySelector(`[${attribute}]`);
      if (owner) {
        const value = numberValue(owner.getAttribute(attribute));
        if (value > 0) return value;
      }
    }
    const keyword = isVote ? "vote" : "like";
    const nodes = Array.from(card.querySelectorAll(`[class*='${keyword}'], [id*='${keyword}']`));
    for (const node of nodes) {
      const match = normalizeText(node.textContent).match(/\d[\d,]*/);
      if (match) return numberValue(match[0].replaceAll(",", ""));
    }
    return 0;
  }

  function dishNameFromCard(card, image) {
    const alt = normalizeText(image.alt);
    if (alt && !/^(菜品|菜品图片|图片|image|food)$/i.test(alt)) return alt;
    const nameNode = card.querySelector(
      "[data-dish-name], [data-food-name], [class*='dish-name'], [class*='food-name'], [class*='ranking-name'], h3, h4"
    );
    if (nameNode) return normalizeText(nameNode.textContent).replace(/^\d+[.、\s]*/, "");
    const lines = String(card.innerText || card.textContent || "").split(/\r?\n/).map(normalizeText).filter(Boolean);
    return lines.find((line) =>
      !/^(?:#?\d+|TOP\s*\d+|HOT|热菜)$/i.test(line) &&
      !/(?:投票|票数|点赞|评论|评价|\d+\s*票)/.test(line)
    ) || "";
  }

  function restaurantRankingContainer(heading, restaurant) {
    if (!heading) return null;
    const otherRestaurant = restaurant === "荷特宝" ? "七立方" : "荷特宝";
    let node = heading.parentElement;
    for (let depth = 0; node && depth < 7; depth += 1, node = node.parentElement) {
      const text = normalizeText(node.textContent);
      const hasDishImages = node.querySelectorAll("img").length > 0;
      if (hasDishImages && text.includes(restaurant) && !text.includes(otherRestaurant)) return node;
    }
    return null;
  }

  function visibleRestaurantHeading(restaurant) {
    const candidates = Array.from(document.querySelectorAll("body *")).filter((node) => {
      const text = normalizeText(node.textContent).replace(/\s+/g, "");
      const rect = node.getBoundingClientRect();
      const ownText = Array.from(node.childNodes)
        .filter((child) => child.nodeType === Node.TEXT_NODE)
        .map((child) => normalizeText(child.textContent))
        .join("")
        .replace(/\s+/g, "");
      return (ownText.includes(restaurant) || text === restaurant || text.startsWith(`${restaurant}餐厅`)) &&
        text.length <= 80 && rect.width > 0 && rect.height > 0;
    });
    return candidates.sort((a, b) => {
      const aText = normalizeText(a.textContent).replace(/\s+/g, "");
      const bText = normalizeText(b.textContent).replace(/\s+/g, "");
      const aHeadingScore = a.matches("h1, h2, h3, h4, h5") ? 120 : /title|heading/i.test(a.className || "") ? 70 : 0;
      const bHeadingScore = b.matches("h1, h2, h3, h4, h5") ? 120 : /title|heading/i.test(b.className || "") ? 70 : 0;
      const aControlPenalty = a.matches("button, a, [role='button'], [role='tab']") ? 100 : 0;
      const bControlPenalty = b.matches("button, a, [role='button'], [role='tab']") ? 100 : 0;
      const aScore = (aText === restaurant ? 160 : 0) + (a.children.length === 0 ? 80 : 0) + (/排行|红榜|餐厅/.test(aText) ? 40 : 0) + aHeadingScore - aControlPenalty - aText.length;
      const bScore = (bText === restaurant ? 160 : 0) + (b.children.length === 0 ? 80 : 0) + (/排行|红榜|餐厅/.test(bText) ? 40 : 0) + bHeadingScore - bControlPenalty - bText.length;
      return bScore - aScore;
    })[0] || null;
  }

  function restaurantForCardPosition(card, headings) {
    const cardRect = card.getBoundingClientRect();
    const cardCenter = {
      x: cardRect.left + cardRect.width / 2,
      y: cardRect.top + cardRect.height / 2
    };
    const markers = Object.entries(headings).filter(([, heading]) => heading).map(([restaurant, heading]) => {
      const rect = heading.getBoundingClientRect();
      return {
        restaurant,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
    });
    if (markers.length < 2) return markers[0]?.restaurant || "";

    const horizontal = Math.abs(markers[0].x - markers[1].x) > 100 && Math.abs(markers[0].y - markers[1].y) < 120;
    if (horizontal) {
      return markers.sort((a, b) => Math.abs(cardCenter.x - a.x) - Math.abs(cardCenter.x - b.x))[0].restaurant;
    }

    const preceding = markers.filter((marker) => marker.y <= cardCenter.y).sort((a, b) => b.y - a.y);
    if (preceding.length) return preceding[0].restaurant;
    return markers.sort((a, b) => Math.abs(cardCenter.y - a.y) - Math.abs(cardCenter.y - b.y))[0].restaurant;
  }

  function recordsFromVisualRanking(restaurant) {
    const headings = {
      "荷特宝": visibleRestaurantHeading("荷特宝"),
      "七立方": visibleRestaurantHeading("七立方")
    };
    if (!headings[restaurant]) return [];

    const scope = document;
    const seen = new Set();
    const records = [];

    Array.from(scope.querySelectorAll("img")).forEach((image, index) => {
      const imageRect = image.getBoundingClientRect();
      if (imageRect.width <= 0 || imageRect.height <= 0) return;
      const card = image.closest("article, li, tr, [class*='ranking-item'], [class*='rank-card'], [class*='dish-card'], [class*='food-card']") || rankingCardForImage(image);
      if (!card || seen.has(card)) return;
      seen.add(card);
      if (restaurantForCardPosition(card, headings) !== restaurant) return;

      const text = normalizeText(card.textContent);
      const name = dishNameFromCard(card, image);
      const votes = structuredCount(card, "vote") || parseCountFromText(text, ["投票数", "票数", "票"]);
      if (!name || votes <= 0) return;
      const reviewNode = card.querySelector("[class*='comment'], [class*='review']");
      records.push({
        id: `visual-${restaurant}-${index}`,
        name,
        restaurant,
        imageUrl: image.currentSrc || image.src || "",
        votes,
        likes: structuredCount(card, "like") || parseCountFromText(text, ["点赞数", "点赞", "赞"]),
        review: normalizeText(reviewNode?.textContent).replace(/^评价[：:]?\s*/, "")
      });
    });

    const uniqueRecords = new Map();
    records.forEach((record) => {
      const normalizedName = record.name.replace(/\s+/g, "").toLocaleLowerCase("zh-CN");
      const existing = uniqueRecords.get(normalizedName);
      if (!existing || record.votes > existing.votes) uniqueRecords.set(normalizedName, record);
    });
    return Array.from(uniqueRecords.values()).sort((a, b) => b.votes - a.votes).slice(0, 10);
  }

  function collectVisibleRankingCards() {
    const seen = new Set();
    const records = [];
    Array.from(document.querySelectorAll("img")).forEach((image, index) => {
      const imageRect = image.getBoundingClientRect();
      if (imageRect.width <= 0 || imageRect.height <= 0) return;
      const card = image.closest(
        "article, li, tr, [class*='ranking-item'], [class*='ranking-card'], [class*='rank-item'], " +
        "[class*='rank-card'], [class*='leaderboard-item'], [class*='leaderboard-card'], " +
        "[class*='dish-card'], [class*='food-card']"
      ) || rankingCardForImage(image);
      if (!card || seen.has(card)) return;
      seen.add(card);

      const cardRect = card.getBoundingClientRect();
      if (cardRect.width <= 0 || cardRect.height <= 0) return;
      const text = normalizeText(card.textContent);
      const name = dishNameFromCard(card, image);
      const votes = structuredCount(card, "vote") || parseCountFromText(text, ["投票数", "票数", "票"]);
      if (!name || votes <= 0) return;
      const reviewNode = card.querySelector("[class*='comment'], [class*='review']");
      records.push({
        id: `ranking-card-${index}`,
        name,
        imageUrl: image.currentSrc || image.src || "",
        votes,
        likes: structuredCount(card, "like") || parseCountFromText(text, ["点赞数", "点赞", "赞"]),
        review: normalizeText(reviewNode?.textContent).replace(/^评价[：:]?\s*/, ""),
        x: cardRect.left + cardRect.width / 2,
        y: cardRect.top + cardRect.height / 2,
        domIndex: index
      });
    });
    return records;
  }

  function uniqueSortedRanking(records, restaurant) {
    const unique = new Map();
    records.forEach((record) => {
      const normalizedName = record.name.replace(/\s+/g, "").toLocaleLowerCase("zh-CN");
      const existing = unique.get(normalizedName);
      if (!existing || record.votes > existing.votes || (record.votes === existing.votes && record.likes > existing.likes)) {
        unique.set(normalizedName, { ...record, restaurant });
      }
    });
    return Array.from(unique.values())
      .sort((a, b) => b.votes - a.votes || b.likes - a.likes || a.name.localeCompare(b.name, "zh-CN"))
      .slice(0, 10);
  }

  function splitVisibleRankingCards() {
    const records = collectVisibleRankingCards();
    if (!records.length) return { hetebao: [], qilifang: [] };

    const sortedX = [...new Set(records.map((record) => Math.round(record.x)))].sort((a, b) => a - b);
    let largestGap = 0;
    let splitX = 0;
    for (let index = 1; index < sortedX.length; index += 1) {
      const gap = sortedX[index] - sortedX[index - 1];
      if (gap > largestGap) {
        largestGap = gap;
        splitX = (sortedX[index] + sortedX[index - 1]) / 2;
      }
    }

    if (largestGap >= 80) {
      const left = records.filter((record) => record.x < splitX);
      const right = records.filter((record) => record.x >= splitX);
      const hetebaoHeading = visibleRestaurantHeading("荷特宝");
      const headingX = hetebaoHeading
        ? hetebaoHeading.getBoundingClientRect().left + hetebaoHeading.getBoundingClientRect().width / 2
        : null;
      const hetebaoIsLeft = headingX === null || Math.abs(headingX - average(left.map((item) => item.x))) <= Math.abs(headingX - average(right.map((item) => item.x)));
      return {
        hetebao: uniqueSortedRanking(hetebaoIsLeft ? left : right, "荷特宝"),
        qilifang: uniqueSortedRanking(hetebaoIsLeft ? right : left, "七立方")
      };
    }

    const qilifangHeading = visibleRestaurantHeading("七立方");
    if (qilifangHeading) {
      const headingY = qilifangHeading.getBoundingClientRect().top;
      return {
        hetebao: uniqueSortedRanking(records.filter((record) => record.y < headingY), "荷特宝"),
        qilifang: uniqueSortedRanking(records.filter((record) => record.y >= headingY), "七立方")
      };
    }

    const ordered = [...records].sort((a, b) => a.domIndex - b.domIndex);
    const midpoint = Math.ceil(ordered.length / 2);
    return {
      hetebao: uniqueSortedRanking(ordered.slice(0, midpoint), "荷特宝"),
      qilifang: uniqueSortedRanking(ordered.slice(midpoint), "七立方")
    };
  }

  function average(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }

  function recordsFromRankingDom(restaurant) {
    const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, [class*='title'], [class*='heading']"));
    const heading = headings.find((node) => {
      const text = normalizeText(node.textContent).replace(/\s+/g, "");
      return text.includes(restaurant);
    });
    const rankingTitle = headings.find((node) => /菜品排行榜/.test(normalizeText(node.textContent)));
    let container = restaurantRankingContainer(heading, restaurant) || rankingTitle?.closest("[class*='page'], [class*='view'], main") || document;
    let imageNodes = Array.from(container.querySelectorAll("img"));
    if (!imageNodes.length && heading) {
      container = heading.closest("section, [class*='ranking'], [id*='ranking'], [class*='panel'], [class*='view']") || document;
      imageNodes = Array.from(container.querySelectorAll("img"));
    }
    const seen = new Set();
    const records = [];
    imageNodes.forEach((image, index) => {
      const card = image.closest("article, li, tr, [class*='ranking-item'], [class*='rank-card'], [class*='dish-card'], [class*='food-card']") || rankingCardForImage(image);
      if (!card || seen.has(card)) return;
      seen.add(card);
      const text = normalizeText(card.textContent);
      const cardRestaurant = normalizeRestaurant(firstValue(card.dataset, ["restaurant", "canteen"], "")) || restaurantFromNearbyHeading(card);
      if (cardRestaurant && cardRestaurant !== restaurant) return;
      const name = dishNameFromCard(card, image);
      const votes = structuredCount(card, "vote") || parseCountFromText(text, ["投票数", "票数", "票"]);
      if (!name || votes <= 0) return;
      const reviewNode = card.querySelector("[class*='comment'], [class*='review']");
      records.push({
        id: `dom-${restaurant}-${index}`,
        name,
        restaurant,
        imageUrl: image.currentSrc || image.src || "",
        votes,
        likes: structuredCount(card, "like") || parseCountFromText(text, ["点赞数", "点赞", "赞"]),
        review: normalizeText(reviewNode?.textContent).replace(/^评价[：:]?\s*/, "")
      });
    });
    const uniqueRecords = new Map();
    records.forEach((record) => {
      const normalizedName = record.name.replace(/\s+/g, "").toLocaleLowerCase("zh-CN");
      const existing = uniqueRecords.get(normalizedName);
      if (!existing || record.votes > existing.votes || (record.votes === existing.votes && record.likes > existing.likes)) {
        uniqueRecords.set(normalizedName, record);
      }
    });
    return Array.from(uniqueRecords.values()).sort((a, b) => b.votes - a.votes).slice(0, 10);
  }

  function clickableByText(text) {
    const matches = Array.from(document.querySelectorAll("button, a, [role='button'], [role='tab']")).filter((node) =>
      normalizeText(node.textContent).replace(/\s+/g, "").includes(text)
    );
    return matches.find((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }) || matches[0] || null;
  }

  function wait(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  async function recordsFromRankingPage() {
    const rankingControl = clickableByText("菜品排行榜");
    const adminControl = clickableByText("后台管理");
    if (!rankingControl) {
      return splitVisibleRankingCards();
    }

    rankingControl.click();
    let result = { hetebao: [], qilifang: [] };
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await wait(250);
      result = splitVisibleRankingCards();
      if (result.hetebao.length && result.qilifang.length) break;
    }
    adminControl?.click();
    await wait(100);
    return result;
  }

  async function collectReportData(monthly) {
    const range = monthRange();
    const [dishes, voteResult, commentResult, postResult, replyResult, analyticsResult, monthlyMetrics] = await Promise.all([
      fetchDishes(),
      fetchAllTables(TABLE_CANDIDATES.votes),
      fetchAllTables(TABLE_CANDIDATES.dishComments),
      fetchFirstNonEmptyTable(TABLE_CANDIDATES.opinionPosts),
      fetchFirstNonEmptyTable(TABLE_CANDIDATES.opinionReplies),
      fetchAllTables(TABLE_CANDIDATES.analytics),
      fetchMonthlyMetrics(range)
    ]);

    const records = buildDishRecords(mergeRows(dishes), voteResult.rows, commentResult.rows);
    const ranked = (restaurant) => {
      const uniqueByName = new Map();
      records
        .filter((dish) => dish.restaurant === restaurant && dish.votes > 0)
        .forEach((dish) => {
          const normalizedName = dish.name.replace(/\s+/g, "").toLocaleLowerCase("zh-CN");
          const existing = uniqueByName.get(normalizedName);
          if (!existing || dish.votes > existing.votes || (dish.votes === existing.votes && dish.likes > existing.likes)) {
            uniqueByName.set(normalizedName, dish);
          }
        });
      return Array.from(uniqueByName.values())
        .sort((a, b) => b.votes - a.votes || b.likes - a.likes || a.name.localeCompare(b.name, "zh-CN"))
        .slice(0, 10);
    };

    const allCommentRows = uniqueCommentRows([
      ...commentResult.rows,
      ...postResult.rows,
      ...replyResult.rows
    ]);
    const totalClicks = findCounter(analyticsResult.rows, (descriptor) => /click|点击/.test(descriptor)) || metricFromAdminPage("总点击数");
    const totalLikes = findCounter(analyticsResult.rows, (descriptor) => /like|点赞/.test(descriptor)) || metricFromAdminPage("总点赞数");
    const totalComments = allCommentRows.length;

    const hetebao = enrichRankingsWithReviews(
      ranked("荷特宝").map((dish) => ({ ...dish, restaurant: "荷特宝" })),
      records
    );
    const qilifang = enrichRankingsWithReviews(
      ranked("七立方").map((dish) => ({ ...dish, restaurant: "七立方" })),
      records
    );

    const commentHighlights = (restaurant) => records
      .map((dish) => ({ ...dish, review: conciseComplaint(dish.review) }))
      .filter((dish) => dish.restaurant === restaurant && dish.review)
      .sort((a, b) => b.reviewLikes - a.reviewLikes || b.likes - a.likes || b.votes - a.votes)
      .filter((dish, index, list) => {
        const key = dish.name.replace(/\s+/g, "").toLocaleLowerCase("zh-CN");
        return list.findIndex((item) => item.name.replace(/\s+/g, "").toLocaleLowerCase("zh-CN") === key) === index;
      })
      .slice(0, 8);

    const discussionPosts = uniqueCommentRows([...postResult.rows, ...replyResult.rows])
      .filter(isTopLevelPost)
      .sort((a, b) => commentLikeCount(b) - commentLikeCount(a) || (rowDate(b)?.getTime() || 0) - (rowDate(a)?.getTime() || 0))
      .slice(0, 10);

    return {
      monthly,
      periodLabel: monthly ? range.label : "全部数据",
      publishedAt: new Date(),
      metrics: monthly
        ? {
            clicks: monthlyMetrics.clicks,
            likes: monthlyMetrics.likes,
            posts: allCommentRows.filter((comment) => inDateRange(comment, range)).length
          }
        : { clicks: totalClicks, likes: totalLikes, posts: totalComments },
      monthlyAvailable: monthlyMetrics.available,
      hetebao,
      qilifang,
      hotbaoComments: commentHighlights("荷特宝"),
      qilifangComments: commentHighlights("七立方"),
      discussionPosts
    };
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("zh-CN").format(numberValue(value));
  }

  function formatPublishedAt(date) {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(date).replaceAll("/", "-");
  }

  function reportDocumentStyles() {
    return `
      .food-report-root {
        position: fixed;
        left: -12000px;
        top: 0;
        z-index: -1;
        width: 794px;
        color: #172a32;
        font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
      }
      .food-report-page {
        position: relative;
        box-sizing: border-box;
        width: 794px;
        height: 1123px;
        overflow: hidden;
        padding: 48px 52px 44px;
        background-color: #f8fbfc;
        background-image:
          linear-gradient(rgba(29, 119, 126, .055) 1px, transparent 1px),
          linear-gradient(90deg, rgba(29, 119, 126, .055) 1px, transparent 1px);
        background-size: 28px 28px;
      }
      .food-report-page::before {
        content: "";
        position: absolute;
        left: 0;
        top: 0;
        width: 10px;
        height: 100%;
        background: #0f8f86;
      }
      .report-top-line { display: flex; align-items: center; justify-content: space-between; gap: 18px; }
      .report-brand { color: #0f766e; font-size: 13px; font-weight: 800; }
      .report-period {
        padding: 6px 10px;
        border: 1px solid #a7d9d4;
        border-radius: 4px;
        background: #effaf8;
        color: #176c68;
        font-size: 12px;
        font-weight: 700;
      }
      .report-title { margin: 82px 0 10px; color: #102e38; font-size: 42px; line-height: 1.16; }
      .report-subtitle { max-width: 560px; color: #597078; font-size: 16px; line-height: 1.75; }
      .report-accent-line { width: 94px; height: 5px; margin: 24px 0 40px; background: #e14b4b; }
      .report-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
      .report-metric {
        min-height: 122px;
        padding: 20px;
        border: 1px solid #c9dce0;
        border-top: 4px solid #0f8f86;
        border-radius: 6px;
        background: rgba(255, 255, 255, .92);
        box-shadow: 0 8px 24px rgba(28, 62, 71, .08);
      }
      .report-metric:nth-child(2) { border-top-color: #e14b4b; }
      .report-metric:nth-child(3) { border-top-color: #2877a6; }
      .report-metric-label { color: #60757d; font-size: 13px; }
      .report-metric-value { margin-top: 12px; color: #172a32; font-size: 31px; font-weight: 800; }
      .report-meta {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px 24px;
        margin-top: 38px;
        padding: 18px 20px;
        border-left: 4px solid #2877a6;
        background: rgba(255,255,255,.74);
        color: #4e656d;
        font-size: 13px;
      }
      .report-note { margin-top: 16px; color: #7a6464; font-size: 11px; line-height: 1.65; }
      .report-section-heading { margin: 18px 0 24px; display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; }
      .report-section-heading h2 { margin: 0; color: #102e38; font-size: 28px; }
      .report-section-heading p { margin: 7px 0 0; color: #60757d; font-size: 12px; }
      .report-section-mark { color: #e14b4b; font-size: 12px; font-weight: 800; }
      .report-dishes { display: grid; gap: 12px; }
      .report-dish {
        display: grid;
        grid-template-columns: 42px 142px minmax(0, 1fr) 112px;
        gap: 14px;
        align-items: center;
        min-height: 154px;
        padding: 12px 14px;
        border: 1px solid #cedde1;
        border-radius: 6px;
        background: rgba(255,255,255,.96);
        box-shadow: 0 5px 16px rgba(24, 64, 73, .065);
      }
      .report-rank { color: #0f766e; font-size: 25px; font-weight: 900; text-align: center; }
      .report-rank.is-top { color: #e14b4b; }
      .report-dish-image {
        width: 142px;
        height: 118px;
        border: 1px solid #d7e3e6;
        border-radius: 4px;
        background: #e8f0f2;
        object-fit: cover;
      }
      .report-image-placeholder {
        display: grid;
        place-items: center;
        width: 142px;
        height: 118px;
        border: 1px dashed #afc5ca;
        border-radius: 4px;
        background: #edf4f5;
        color: #789097;
        font-size: 12px;
      }
      .report-dish-name { color: #172a32; font-size: 19px; font-weight: 800; }
      .report-review {
        display: -webkit-box;
        margin-top: 10px;
        overflow: hidden;
        color: #5c7077;
        font-size: 12px;
        line-height: 1.65;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 3;
      }
      .report-review.is-empty { color: #9aa8ac; }
      .report-counts { display: grid; gap: 8px; }
      .report-count {
        padding: 9px 10px;
        border-left: 3px solid #0f8f86;
        background: #edf8f7;
      }
      .report-count.is-like { border-left-color: #e14b4b; background: #fff2f2; }
      .report-count span { display: block; color: #687a80; font-size: 10px; }
      .report-count strong { display: block; margin-top: 3px; color: #172a32; font-size: 16px; }
      .report-empty {
        display: grid;
        place-items: center;
        min-height: 730px;
        border: 1px dashed #b6cbd0;
        color: #72868c;
        font-size: 15px;
      }
      .report-footer {
        position: absolute;
        right: 52px;
        bottom: 22px;
        left: 52px;
        display: flex;
        justify-content: space-between;
        border-top: 1px solid #d5e2e5;
        padding-top: 9px;
        color: #84949a;
        font-size: 10px;
      }
      .food-report-single-page {
        width: 794px;
        height: 1123px;
        box-sizing: border-box;
        overflow: hidden;
        padding: 34px 42px 32px 48px;
        background-color: #f8fbfc;
        background-image:
          linear-gradient(rgba(29, 119, 126, .045) 1px, transparent 1px),
          linear-gradient(90deg, rgba(29, 119, 126, .045) 1px, transparent 1px);
        background-size: 24px 24px;
        position: relative;
      }
      .food-report-single-page::before {
        content: "";
        position: absolute;
        left: 0;
        top: 0;
        width: 8px;
        height: 100%;
        background: #0f8f86;
      }
      .report-single-title { margin: 28px 0 4px; color: #102e38; font-size: 27px; line-height: 1.1; }
      .report-single-subtitle { color: #60757d; font-size: 11px; line-height: 1.5; }
      .report-single-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; margin-top: 17px; }
      .report-single-metric { padding: 10px 12px; border: 1px solid #c9dce0; border-top: 3px solid #0f8f86; border-radius: 4px; background: rgba(255,255,255,.92); }
      .report-single-metric:nth-child(2) { border-top-color: #e14b4b; }
      .report-single-metric:nth-child(3) { border-top-color: #2877a6; }
      .report-single-metric-label { color: #60757d; font-size: 10px; }
      .report-single-metric-value { margin-top: 5px; color: #172a32; font-size: 19px; font-weight: 800; }
      .report-single-meta { display: flex; gap: 22px; margin: 9px 0 12px; color: #667a81; font-size: 9px; }
      .report-single-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: start; }
      .report-single-column { min-width: 0; padding: 10px 10px 12px; border: 1px solid #ccdde1; border-radius: 5px; background: rgba(255,255,255,.9); }
      .report-single-column-title { display: flex; align-items: baseline; justify-content: space-between; padding-bottom: 7px; border-bottom: 2px solid #0f8f86; }
      .report-single-column:nth-child(2) .report-single-column-title { border-bottom-color: #e14b4b; }
      .report-single-column-title strong { color: #102e38; font-size: 15px; }
      .report-single-column-title span { color: #71858b; font-size: 9px; }
      .report-compact-row { display: grid; grid-template-columns: 23px 42px minmax(0, 1fr); gap: 7px; align-items: center; min-height: 58px; padding: 5px 0; border-bottom: 1px solid #e0eaec; }
      .report-compact-row:last-child { border-bottom: 0; }
      .report-compact-rank { color: #0f766e; font-size: 13px; font-weight: 900; text-align: center; }
      .report-compact-rank.is-top { color: #e14b4b; }
      .report-compact-image { width: 42px; height: 42px; border: 1px solid #d4e2e5; border-radius: 3px; background: #e9f1f2; object-fit: cover; }
      .report-compact-placeholder { display: grid; place-items: center; width: 42px; height: 42px; border: 1px dashed #b7cbd0; border-radius: 3px; background: #edf4f5; color: #819297; font-size: 8px; }
      .report-compact-name { overflow: hidden; color: #172a32; font-size: 11px; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
      .report-compact-counts { display: flex; align-items: baseline; gap: 18px; margin-top: 3px; color: #687a80; }
      .report-compact-votes, .report-compact-likes { display: inline-flex; align-items: baseline; gap: 4px; white-space: nowrap; }
      .report-compact-votes { font-size: 9px; }
      .report-compact-votes b { color: #126f6a; font-size: 13px; line-height: 1; }
      .report-compact-likes { color: #7a898e; font-size: 8px; }
      .report-compact-likes b { color: #5f7076; font-size: 9px; line-height: 1; }
      .report-compact-review { display: -webkit-box; overflow: hidden; margin-top: 2px; color: #829196; font-size: 8px; line-height: 1.25; text-overflow: ellipsis; -webkit-box-orient: vertical; -webkit-line-clamp: 1; }
      .report-single-empty { padding: 40px 0; color: #819297; font-size: 10px; text-align: center; }
      .report-single-note { margin-top: 10px; color: #7b6d6d; font-size: 8px; line-height: 1.4; }
      .report-single-footer { position: absolute; right: 42px; bottom: 19px; left: 48px; display: flex; justify-content: space-between; border-top: 1px solid #d5e2e5; padding-top: 7px; color: #84949a; font-size: 8px; }
    `;
  }

  function metricCard(label, value) {
    return `<div class="report-metric"><div class="report-metric-label">${escapeHtml(label)}</div><div class="report-metric-value">${formatNumber(value)}</div></div>`;
  }

  function coverPage(data, pageNumber, totalPages) {
    const availabilityNote = data.monthly && !data.monthlyAvailable
      ? "本月明细统计表尚未启用，本页点击数和点赞数暂显示为 0；执行配套 SQL 后将从启用日期开始累计。"
      : data.monthly
        ? "当月点击与点赞按月度统计记录汇总，评论数量按意见交流帖子的发布时间统计。"
        : "总报表采用网站当前累计统计；菜品点赞数为该菜品评价获得的点赞合计。";
    return `
      <section class="food-report-page">
        <div class="report-top-line"><div class="report-brand">CANTEEN DATA INSIGHT</div><div class="report-period">${escapeHtml(data.periodLabel)}</div></div>
        <h1 class="report-title">食堂评价榜</h1>
        <div class="report-subtitle">荷特宝与七立方菜品表现数据报告<br>以投票排名为主线，汇总用户访问、点赞与意见交流情况。</div>
        <div class="report-accent-line"></div>
        <div class="report-metrics">
          ${metricCard("访问数", data.metrics.clicks)}
          ${metricCard("点赞数", data.metrics.likes)}
          ${metricCard("评论数量", data.metrics.posts)}
        </div>
        <div class="report-meta">
          <div>发布时间：${escapeHtml(formatPublishedAt(data.publishedAt))}</div>
          <div>发布人：${REPORT_AUTHOR}</div>
          <div>报告范围：${escapeHtml(data.periodLabel)}</div>
          <div>榜单规则：各餐厅投票数前十</div>
        </div>
        <div class="report-note">统计说明：${escapeHtml(availabilityNote)}</div>
        <div class="report-footer"><span>食堂评价榜 / 自动生成</span><span>${pageNumber} / ${totalPages}</span></div>
      </section>`;
  }

  function dishImage(dish) {
    if (!dish.imageUrl) return `<div class="report-image-placeholder">暂无图片</div>`;
    return `<img class="report-dish-image" src="${escapeHtml(dish.imageUrl)}" alt="${escapeHtml(dish.name)}" crossorigin="anonymous">`;
  }

  function dishRow(dish, index) {
    const review = dish.review || "暂无评价";
    return `
      <article class="report-dish">
        <div class="report-rank ${index < 3 ? "is-top" : ""}">${String(index + 1).padStart(2, "0")}</div>
        ${dishImage(dish)}
        <div>
          <div class="report-dish-name">${escapeHtml(dish.name)}</div>
          <div class="report-review ${dish.review ? "" : "is-empty"}">${dish.review ? "评价：" : ""}${escapeHtml(review)}</div>
        </div>
        <div class="report-counts">
          <div class="report-count"><span>票数</span><strong>${formatNumber(dish.votes)}</strong></div>
          <div class="report-count is-like"><span>点赞数</span><strong>${formatNumber(dish.likes)}</strong></div>
        </div>
      </article>`;
  }

  function rankingPage(restaurant, dishes, chunkStart, pageNumber, totalPages, periodLabel) {
    const pageDishes = dishes.slice(chunkStart, chunkStart + 5);
    const rows = pageDishes.length
      ? pageDishes.map((dish, offset) => dishRow(dish, chunkStart + offset)).join("")
      : `<div class="report-empty">${escapeHtml(restaurant)}暂时没有可用于排行的菜品数据</div>`;
    return `
      <section class="food-report-page">
        <div class="report-top-line"><div class="report-brand">CANTEEN RED LIST</div><div class="report-period">${escapeHtml(periodLabel)}</div></div>
        <div class="report-section-heading">
          <div><h2>${escapeHtml(restaurant)}红榜</h2><p>菜品排行榜投票数 TOP 10</p></div>
          <div class="report-section-mark">RANK ${chunkStart + 1}-${Math.min(chunkStart + 5, dishes.length || 5)}</div>
        </div>
        <div class="report-dishes">${rows}</div>
        <div class="report-footer"><span>${escapeHtml(restaurant)}红榜 / ${escapeHtml(periodLabel)}</span><span>${pageNumber} / ${totalPages}</span></div>
      </section>`;
  }

  function rankingPageCount(dishes) {
    return Math.max(1, Math.ceil(dishes.length / 5));
  }

  function compactDishRow(dish, index) {
    const image = dish.imageUrl
      ? `<img class="report-compact-image" src="${escapeHtml(dish.imageUrl)}" alt="${escapeHtml(dish.name)}" crossorigin="anonymous">`
      : `<div class="report-compact-placeholder">暂无图</div>`;
    const review = dish.review ? `评价：${escapeHtml(dish.review)}` : "暂无评价";
    return `
      <article class="report-compact-row">
        <div class="report-compact-rank ${index < 3 ? "is-top" : ""}">${index + 1}</div>
        ${image}
        <div>
          <div class="report-compact-name" title="${escapeHtml(dish.name)}">${escapeHtml(dish.name)}</div>
          <div class="report-compact-counts">
            <span class="report-compact-votes">票数 <b>${formatNumber(dish.votes)}</b></span>
            <span class="report-compact-likes">赞 <b>${formatNumber(dish.likes)}</b></span>
          </div>
          <div class="report-compact-review ${dish.review ? "" : "is-empty"}">${review}</div>
        </div>
      </article>`;
  }

  function compactRankingColumn(title, dishes) {
    const rows = dishes.length
      ? dishes.slice(0, 10).map((dish, index) => compactDishRow(dish, index)).join("")
      : `<div class="report-single-empty">暂无带投票数的菜品数据</div>`;
    return `
      <section class="report-single-column">
        <div class="report-single-column-title"><strong>${escapeHtml(title)}红榜</strong><span>投票数 TOP 10</span></div>
        ${rows}
      </section>`;
  }

  function singleReportPage(data) {
    const availabilityNote = data.monthly && !data.monthlyAvailable
      ? "月度明细表尚未启用，点击数和点赞数将从执行配套 SQL 后开始累计。"
      : "榜单取自菜品排行榜中对应食堂的投票数排序；评价取菜品评价中点赞数最高的一条。";
    return `
      <section class="food-report-single-page">
        <div class="report-top-line"><div class="report-brand">CANTEEN DATA INSIGHT</div><div class="report-period">${escapeHtml(data.periodLabel)}</div></div>
        <h1 class="report-single-title">食堂评价榜</h1>
        <div class="report-single-subtitle">荷特宝与七立方菜品表现数据报告 · 发布人：${REPORT_AUTHOR}</div>
        <div class="report-single-metrics">
          <div class="report-single-metric"><div class="report-single-metric-label">访问数</div><div class="report-single-metric-value">${formatNumber(data.metrics.clicks)}</div></div>
          <div class="report-single-metric"><div class="report-single-metric-label">点赞数</div><div class="report-single-metric-value">${formatNumber(data.metrics.likes)}</div></div>
          <div class="report-single-metric"><div class="report-single-metric-label">评论数量</div><div class="report-single-metric-value">${formatNumber(data.metrics.posts)}</div></div>
        </div>
        <div class="report-single-meta"><span>发布时间：${escapeHtml(formatPublishedAt(data.publishedAt))}</span><span>统计范围：${escapeHtml(data.periodLabel)}</span></div>
        <div class="report-single-columns">
          ${compactRankingColumn("荷特宝", data.hetebao)}
          ${compactRankingColumn("七立方", data.qilifang)}
        </div>
        <div class="report-single-note">统计说明：${escapeHtml(availabilityNote)}</div>
        <div class="report-single-footer"><span>食堂评价榜 / 自动生成</span><span>1 / 1</span></div>
      </section>`;
  }

  function buildReportDom(data) {
    return buildTemplateReportDom(data);
  }

  const TEMPLATE_CLIP_URL = "report-template/paperclip.png";
  const TEMPLATE_RED_SLOTS = [
    { x: 74, y: 146, w: 175, labelX: 8 },
    { x: 292, y: 154, w: 178, labelX: 8 },
    { x: 104, y: 350, w: 178, labelX: 8 },
    { x: 324, y: 377, w: 190, labelX: 8 },
    { x: 155, y: 558, w: 250, labelX: 178, labelTop: 72 },
    { x: 684, y: 146, w: 185, labelX: 8 },
    { x: 909, y: 157, w: 198, labelX: 8 },
    { x: 715, y: 350, w: 190, labelX: 8 },
    { x: 940, y: 377, w: 220, labelX: 8 },
    { x: 774, y: 558, w: 260, labelX: 176, labelTop: 72 }
  ];
  const TEMPLATE_COMMENT_SLOTS = [
    { x: 50, y: 164 },
    { x: 256, y: 164 },
    { x: 456, y: 164 },
    { x: 92, y: 433 },
    { x: 296, y: 433 },
    { x: 496, y: 433 }
  ];

  function templatePeriod(data) {
    const date = data.publishedAt instanceof Date ? data.publishedAt : new Date(data.publishedAt);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function templateReportDocumentStyles() {
    return `
      .template-report-root {
        position: fixed;
        left: -14000px;
        top: 0;
        z-index: -1;
        width: 1280px;
        color: #111;
        font-family: "熬夜做PPT护眼楷体", "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
      }
      .template-report-page {
        position: relative;
        box-sizing: border-box;
        width: 1280px;
        height: 720px;
        overflow: hidden;
        background: #fff;
      }
      .template-header {
        position: absolute;
        top: 9px;
        left: 15px;
        right: 16px;
        color: #3b6fd4;
        font-size: 22px;
        font-weight: 400;
        line-height: 1.35;
        white-space: pre-line;
      }
      .template-footer {
        position: absolute;
        right: 25px;
        bottom: 7px;
        color: #3b6fd4;
        font-size: 16px;
        line-height: 1;
      }
      .template-title {
        position: absolute;
        top: 72px;
        left: 0;
        color: #2ab7b0;
        font-size: 43px;
        font-weight: 900;
        line-height: 1;
        text-shadow: 2px 2px 0 #d4e9e7, 4px 4px 0 rgba(244, 143, 72, .55);
      }
      .template-title.hotbao { left: 181px; color: #f58c44; text-shadow: 2px 2px 0 #ffe1c9, 4px 4px 0 rgba(245, 140, 68, .28); }
      .template-title.qilifang { left: 182px; }
      .template-title.comment { left: 168px; }
      .template-title.comment.qilifang { left: 794px; }
      .template-title span:last-child { color: #f58c44; }
      .template-red-item {
        position: absolute;
        height: 174px;
        text-align: left;
      }
      .template-red-image-wrap {
        position: relative;
        width: 145px;
        height: 125px;
        margin-left: 8px;
        padding: 8px;
        box-sizing: border-box;
        background: rgba(255,255,255,.9);
        box-shadow: 0 6px 18px rgba(48, 48, 48, .16);
      }
      .template-red-image {
        display: block;
        width: 129px;
        height: 109px;
        object-fit: cover;
        background: #f4f4f4;
      }
      .template-paperclip {
        position: absolute;
        z-index: 2;
        top: -38px;
        left: 50%;
        width: 20px;
        height: 50px;
        object-fit: contain;
        transform: translateX(-50%);
        opacity: .88;
      }
      .template-dish-name {
        position: absolute;
        top: 137px;
        left: 8px;
        color: #090909;
        font-size: 19px;
        font-weight: 700;
        line-height: 1.25;
        white-space: nowrap;
      }
      .template-placeholder {
        display: grid;
        place-items: center;
        width: 129px;
        height: 109px;
        color: #80909a;
        background: #f0f3f4;
        font-size: 14px;
      }
      .template-comment-item {
        position: absolute;
        width: 184px;
        height: 204px;
        text-align: center;
      }
      .template-comment-image-shell {
        position: relative;
        width: 128px;
        height: 113px;
        margin: 0 auto;
        padding: 4px;
        box-sizing: border-box;
        background: #eef1f0;
        clip-path: polygon(10% 0, 90% 0, 100% 50%, 90% 100%, 10% 100%, 0 50%);
        filter: drop-shadow(0 7px 10px rgba(35, 55, 61, .18));
      }
      .template-comment-image {
        display: block;
        width: 120px;
        height: 105px;
        object-fit: cover;
        background: #f4f4f4;
      }
      .template-comment-label {
        margin-top: 24px;
        color: #0b0b0b;
        font-size: 18px;
        font-weight: 700;
        line-height: 1.35;
        white-space: nowrap;
      }
      .template-comment-label.long {
        white-space: normal;
      }
      .template-dual-comment-board {
        position: absolute;
        top: 66px;
        right: 28px;
        bottom: 30px;
        left: 28px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 34px;
      }
      .template-dual-comment-column {
        min-width: 0;
        padding: 0 12px 10px;
      }
      .template-dual-comment-heading {
        height: 55px;
        color: #f58c44;
        font-size: 34px;
        font-weight: 900;
        line-height: 55px;
        text-align: center;
        text-shadow: 2px 2px 0 #ffe1c9;
      }
      .template-dual-comment-column.qilifang .template-dual-comment-heading {
        color: #2ab7b0;
        text-shadow: 2px 2px 0 #d4e9e7;
      }
      .template-dual-comment-list {
        display: grid;
        grid-template-rows: repeat(8, 1fr);
        height: 557px;
        border-top: 2px solid #f2b17f;
      }
      .template-dual-comment-column.qilifang .template-dual-comment-list { border-top-color: #75d3cd; }
      .template-dual-comment-row {
        display: grid;
        grid-template-columns: 72px minmax(0, 1fr) 48px;
        gap: 10px;
        align-items: center;
        min-height: 0;
        padding: 6px 4px;
        border-bottom: 1px solid #e6e8e8;
      }
      .template-dual-comment-image,
      .template-dual-comment-placeholder {
        width: 68px;
        height: 54px;
        object-fit: cover;
        background: #f0f3f4;
        box-shadow: 0 3px 9px rgba(45, 61, 65, .14);
      }
      .template-dual-comment-placeholder {
        display: grid;
        place-items: center;
        color: #839196;
        font-size: 10px;
      }
      .template-dual-comment-name {
        overflow: hidden;
        color: #111;
        font-size: 16px;
        font-weight: 800;
        line-height: 1.25;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .template-dual-comment-review {
        margin-top: 4px;
        color: #4c5e63;
        font-size: 15px;
        line-height: 1.2;
      }
      .template-dual-comment-likes {
        color: #72858a;
        font-size: 11px;
        text-align: right;
      }
      .template-dual-comment-likes strong { display: block; color: #3e6d70; font-size: 15px; }
      .template-dual-comment-empty {
        grid-row: 1 / -1;
        display: grid;
        place-items: center;
        color: #7f8d91;
        font-size: 16px;
      }
      .template-forum-board {
        position: absolute;
        top: 55px;
        right: 16px;
        bottom: 0;
        left: 17px;
        padding: 24px 8px 12px;
        box-sizing: border-box;
        background: #edf4f2;
      }
      .template-forum-post {
        min-height: 50px;
        margin-bottom: 8px;
        padding: 9px 14px 7px;
        box-sizing: border-box;
        border: 1px solid #dfe7e5;
        background: #fff;
        color: #142b43;
      }
      .template-forum-post:last-child { margin-bottom: 0; }
      .template-forum-content {
        overflow: hidden;
        color: #142b43;
        font-size: 15px;
        line-height: 1.35;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .template-forum-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 5px;
        color: #728799;
        font-size: 9px;
      }
      .template-forum-actions { color: #587081; }
      .template-empty { color: #788a92; font-size: 18px; text-align: center; padding-top: 160px; }
    `;
  }

  function templateImageMarkup(dish, className, placeholderClass) {
    return dish?.imageUrl
      ? `<img class="${className}" src="${escapeHtml(dish.imageUrl)}" alt="${escapeHtml(dish.name || "菜品")}" crossorigin="anonymous">`
      : `<div class="${placeholderClass}">暂无图片</div>`;
  }

  function templateRedItem(dish, index, slot) {
    const item = dish || { name: "", imageUrl: "" };
    return `
      <div class="template-red-item" style="left:${slot.x}px;top:${slot.y}px;width:${slot.w}px">
        <div class="template-red-image-wrap">
          <img class="template-paperclip" src="${TEMPLATE_CLIP_URL}" alt="">
          ${templateImageMarkup(item, "template-red-image", "template-placeholder")}
        </div>
        <div class="template-dish-name" style="left:${slot.labelX}px;top:${slot.labelTop ?? 137}px">NO.${index + 1}${escapeHtml(item.name || "待补充")}</div>
      </div>`;
  }

  function templateCommentItem(dish, slot) {
    const item = dish || { name: "", review: "" };
    const review = item.review || "暂无评价";
    const label = `${item.name || "菜品"}：${review}`;
    return `
      <div class="template-comment-item" style="left:${slot.x}px;top:${slot.y}px">
        <div class="template-comment-image-shell">
          ${templateImageMarkup(item, "template-comment-image", "template-placeholder")}
        </div>
        <div class="template-comment-label ${label.length > 10 ? "long" : ""}">${escapeHtml(label)}</div>
      </div>`;
  }

  function templateHeader(title, data) {
    return `<div class="template-header">WLSA食堂菜品票选结果（第三期）：${escapeHtml(title)}</div>`;
  }

  function templateFooter(data) {
    return `<div class="template-footer">WLSA食堂调查小组${escapeHtml(templatePeriod(data))}</div>`;
  }

  function templateRedPage(data, restaurant, dishes, pageNumber) {
    const isHotbao = restaurant === "荷特宝";
    const titleClass = isHotbao ? "hotbao" : "qilifang";
    const title = `<span>${escapeHtml(restaurant)}</span><span>红榜</span>`;
    return `
      <section class="template-report-page">
        ${templateHeader(`${restaurant}  红榜（希望增加红榜出现频率）`, data)}
        <div class="template-title ${titleClass}">${title}</div>
        ${Array.from({ length: 10 }, (_, index) => templateRedItem(dishes[index], index, TEMPLATE_RED_SLOTS[index])).join("")}
        ${templateFooter(data)}
      </section>`;
  }

  function templateCommentPage(data, restaurant, dishes) {
    const isHotbao = restaurant === "荷特宝";
    const titleClass = isHotbao ? "" : "qilifang";
    const items = dishes.length ? dishes.slice(0, 6) : [];
    return `
      <section class="template-report-page">
        ${templateHeader(`${restaurant}  精选吐槽榜（同学评论对于菜品意见）`, data)}
        <div class="template-title comment ${titleClass}"><span>${escapeHtml(restaurant)}</span><span>吐槽榜</span></div>
        ${items.length ? items.map((dish, index) => templateCommentItem(dish, TEMPLATE_COMMENT_SLOTS[index])).join("") : `<div class="template-empty">暂无可展示的菜品评价</div>`}
        ${templateFooter(data)}
      </section>`;
  }

  function templateDualCommentRow(dish) {
    const image = dish?.imageUrl
      ? `<img class="template-dual-comment-image" src="${escapeHtml(dish.imageUrl)}" alt="${escapeHtml(dish.name || "菜品")}" crossorigin="anonymous">`
      : `<div class="template-dual-comment-placeholder">暂无图片</div>`;
    return `
      <article class="template-dual-comment-row">
        ${image}
        <div>
          <div class="template-dual-comment-name">${escapeHtml(dish.name || "未命名菜品")}</div>
          <div class="template-dual-comment-review">${escapeHtml((dish.review || "暂无评价").slice(0, 10))}</div>
        </div>
        <div class="template-dual-comment-likes"><strong>${formatNumber(dish.reviewLikes)}</strong>赞</div>
      </article>`;
  }

  function templateDualCommentColumn(restaurant, dishes, className) {
    const items = dishes.slice(0, 8);
    return `
      <section class="template-dual-comment-column ${className}">
        <div class="template-dual-comment-heading">${escapeHtml(restaurant)}吐槽榜</div>
        <div class="template-dual-comment-list">
          ${items.length ? items.map(templateDualCommentRow).join("") : `<div class="template-dual-comment-empty">暂无可展示的菜品评价</div>`}
        </div>
      </section>`;
  }

  function templateCombinedCommentPage(data) {
    return `
      <section class="template-report-page">
        ${templateHeader("荷特宝与七立方  精选吐槽榜（高赞菜品意见）", data)}
        <div class="template-dual-comment-board">
          ${templateDualCommentColumn("荷特宝", data.hotbaoComments || [], "hotbao")}
          ${templateDualCommentColumn("七立方", data.qilifangComments || [], "qilifang")}
        </div>
        ${templateFooter(data)}
      </section>`;
  }

  function templateDiscussionPost(row) {
    const content = normalizedDiscussionText(commentText(row)) || "暂无内容";
    const date = rowDate(row);
    const published = date ? formatPublishedAt(date) : "";
    const likes = commentLikeCount(row);
    return `
      <article class="template-forum-post">
        <div class="template-forum-content">${escapeHtml(content)}</div>
        <div class="template-forum-meta"><span>${escapeHtml(published)}</span><span class="template-forum-actions">赞同 ${formatNumber(likes)}　回复</span></div>
      </article>`;
  }

  function templateDiscussionPage(data) {
    const posts = data.discussionPosts?.slice(0, 10) || [];
    return `
      <section class="template-report-page">
        ${templateHeader("食堂意见交流", data)}
        <div class="template-forum-board">
          ${posts.length ? posts.map(templateDiscussionPost).join("") : `<div class="template-empty">暂无意见交流内容</div>`}
        </div>
        ${templateFooter(data)}
      </section>`;
  }

  function buildTemplateReportDom(data) {
    const root = document.createElement("div");
    root.className = "template-report-root";
    const style = document.createElement("style");
    style.textContent = templateReportDocumentStyles();
    root.appendChild(style);

    const pages = document.createElement("div");
    pages.innerHTML = [
      templateRedPage(data, "荷特宝", data.hetebao || [], 1),
      templateRedPage(data, "七立方", data.qilifang || [], 2),
      templateCombinedCommentPage(data),
      templateDiscussionPage(data)
    ].join("");
    root.appendChild(pages);
    document.body.appendChild(root);
    return root;
  }

  function loadScriptOnce(src, ready) {
    if (ready()) return Promise.resolve();
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      return new Promise((resolve, reject) => {
        const startedAt = Date.now();
        const timer = window.setInterval(() => {
          if (ready()) {
            window.clearInterval(timer);
            resolve();
          } else if (Date.now() - startedAt > 15000) {
            window.clearInterval(timer);
            reject(new Error("PDF 组件加载超时"));
          }
        }, 100);
      });
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => ready() ? resolve() : reject(new Error("PDF 组件初始化失败"));
      script.onerror = () => reject(new Error("PDF 组件加载失败，请检查网络后重试"));
      document.head.appendChild(script);
    });
  }

  async function loadPdfLibraries() {
    await Promise.all([
      loadScriptOnce(PDF_LIBRARIES.html2canvas, () => typeof window.html2canvas === "function"),
      loadScriptOnce(PDF_LIBRARIES.jspdf, () => Boolean(window.jspdf?.jsPDF))
    ]);
  }

  function waitForImages(root) {
    const images = Array.from(root.querySelectorAll("img"));
    return Promise.all(images.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        const finish = () => resolve();
        img.addEventListener("load", finish, { once: true });
        img.addEventListener("error", finish, { once: true });
        window.setTimeout(finish, 7000);
      });
    }));
  }

  function transparentImageData(label = "暂无图片") {
    const safeLabel = String(label).replace(/[<&>"']/g, "");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180" viewBox="0 0 240 180"><rect width="240" height="180" fill="#f0f3f4"/><rect x="1" y="1" width="238" height="178" fill="none" stroke="#c8d3d6"/><text x="120" y="96" text-anchor="middle" font-family="Arial, Microsoft YaHei, sans-serif" font-size="18" fill="#819097">${safeLabel}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("图片转换失败"));
      reader.readAsDataURL(blob);
    });
  }

  async function inlineReportImages(root, progress) {
    const images = Array.from(root.querySelectorAll("img"));
    const cache = new Map();
    for (let index = 0; index < images.length; index += 1) {
      const image = images[index];
      const source = image.getAttribute("src") || "";
      if (!source || source.startsWith("data:")) continue;
      progress.update(`正在处理图片 ${index + 1} / ${images.length}...`);
      if (!cache.has(source)) {
        cache.set(source, fetch(source, {
          method: "GET",
          mode: "cors",
          credentials: "omit",
          cache: "no-store"
        }).then(async (response) => {
          if (!response.ok) throw new Error(`图片请求失败 ${response.status}`);
          return blobToDataUrl(await response.blob());
        }).catch(() => ""));
      }
      const dataUrl = await cache.get(source);
      image.crossOrigin = "anonymous";
      image.removeAttribute("crossorigin");
      image.src = dataUrl || transparentImageData("暂无图片");
    }
    await waitForImages(root);
  }

  async function renderPageImage(page) {
    const render = () => window.html2canvas(page, {
      backgroundColor: "#ffffff",
      scale: 1.5,
      useCORS: true,
      allowTaint: false,
      logging: false,
      imageTimeout: 8000
    });
    let canvas = await render();
    try {
      return canvas.toDataURL("image/jpeg", .92);
    } catch (error) {
      // A browser extension or a stale cached image can still taint one canvas.
      // Replace only the affected visual assets and retry the page export.
      Array.from(page.querySelectorAll("img")).forEach((image) => {
        image.src = transparentImageData("暂无图片");
      });
      await waitForImages(page);
      canvas = await render();
      return canvas.toDataURL("image/jpeg", .92);
    }
  }

  function showProgress(monthly) {
    const mask = document.createElement("div");
    mask.className = "report-progress-mask";
    mask.innerHTML = `
      <div class="report-progress-panel" role="status" aria-live="polite">
        <div class="report-progress-spinner"></div>
        <div class="report-progress-title">正在生成${monthly ? "当月" : "总数据"}报告</div>
        <div class="report-progress-detail">正在整理榜单、图片和统计数据...</div>
      </div>`;
    document.body.appendChild(mask);
    return {
      update(text) {
        const detail = mask.querySelector(".report-progress-detail");
        if (detail) detail.textContent = text;
      },
      close() { mask.remove(); }
    };
  }

  function notify(message, type = "info") {
    try {
      if (typeof showToast === "function") {
        showToast(message, type);
        return;
      }
    } catch {
      // Use the fallback alert below.
    }
    window.alert(message);
  }

  function fileDate(date) {
    return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  }

  async function exportPdf(data, progress) {
    progress.update("正在加载 PDF 生成组件...");
    await loadPdfLibraries();
    const root = buildReportDom(data);
    try {
      await waitForImages(root);
      await inlineReportImages(root, progress);
      const pages = Array.from(root.querySelectorAll(".template-report-page"));
      if (!pages.length) throw new Error("没有找到可导出的报告页面");
      const { jsPDF } = window.jspdf;
      const pageWidth = 338.667;
      const pageHeight = 190.5;
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: [pageWidth, pageHeight], compress: true });

      for (let index = 0; index < pages.length; index += 1) {
        progress.update(`正在绘制第 ${index + 1} / ${pages.length} 页...`);
        const imageData = await renderPageImage(pages[index]);
        if (index > 0) pdf.addPage([pageWidth, pageHeight], "landscape");
        pdf.addImage(imageData, "JPEG", 0, 0, pageWidth, pageHeight, undefined, "FAST");
      }

      progress.update("正在准备下载文件...");
      const scope = data.monthly ? "当月" : "总数据";
      pdf.save(`食堂评价榜-${scope}-${fileDate(data.publishedAt)}.pdf`);
    } finally {
      root.remove();
    }
  }

  async function generateReport(monthly, button) {
    if (button.disabled) return;
    const original = button.innerHTML;
    button.disabled = true;
    button.textContent = "生成中...";
    const progress = showProgress(monthly);
    try {
      const data = await collectReportData(monthly);
      if (!data.hetebao.length || !data.qilifang.length) {
        const missing = [
          !data.hetebao.length ? "荷特宝" : "",
          !data.qilifang.length ? "七立方" : ""
        ].filter(Boolean).join("、");
        throw new Error(`未读取到${missing}排行榜，请先打开一次“菜品排行榜”页面，确认榜单显示后重试`);
      }
      await exportPdf(data, progress);
      notify(`${monthly ? "当月" : "总数据"}报告已生成并开始下载`, "success");
    } catch (error) {
      console.error("生成食堂评价榜失败", error);
      notify(`报告生成失败：${error?.message || "请稍后重试"}`, "error");
    } finally {
      progress.close();
      button.disabled = false;
      button.innerHTML = original;
      try {
        window.lucide?.createIcons?.();
      } catch {
        // Icons are decorative; report generation remains available.
      }
    }
  }

  function createButton(target, monthly) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `${target.className || ""} report-action-button${monthly ? " is-monthly" : ""}`.trim();
    button.dataset.reportAction = monthly ? "monthly" : "total";
    button.title = monthly ? "生成并下载本月食堂评价榜 PDF" : "生成并下载全部数据食堂评价榜 PDF";
    button.innerHTML = `<i data-lucide="${monthly ? "calendar-range" : "file-chart-column"}" aria-hidden="true"></i><span>${monthly ? "当月报表" : "报表生成"}</span>`;
    button.addEventListener("click", () => generateReport(monthly, button));
    return button;
  }

  function findDuplicateCleanupButton() {
    return Array.from(document.querySelectorAll("button")).find((button) =>
      normalizeText(button.textContent).replace(/\s+/g, "").includes("AI清除重复菜品")
    );
  }

  function installReportButtons() {
    if (document.querySelector("[data-report-action]")) return true;
    const target = findDuplicateCleanupButton();
    if (!target?.parentElement) return false;
    const totalButton = createButton(target, false);
    const monthlyButton = createButton(target, true);
    target.parentElement.insertBefore(totalButton, target);
    target.parentElement.insertBefore(monthlyButton, target);
    try {
      window.lucide?.createIcons?.();
    } catch {
      // Existing text labels keep the controls usable.
    }
    return true;
  }

  function start() {
    injectReportStyles();
    installReportButtons();
    const observer = new MutationObserver(() => installReportButtons());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
