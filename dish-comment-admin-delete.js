(function () {
  "use strict";

  const COMMENT_TABLES = ["dish_comments", "comments", "food_comments", "dish_reviews"];
  const DELETE_MARK = "data-admin-dish-comment-delete";

  const styles = `
    .admin-dish-comment-delete {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-height: 28px;
      margin-left: 8px;
      padding: 4px 8px;
      border: 1px solid #d9a8a8;
      border-radius: 4px;
      background: #fff8f8;
      color: #8b3f43;
      cursor: pointer;
      font: inherit;
      font-size: 12px;
      line-height: 1;
    }
    .admin-dish-comment-delete:hover {
      border-color: #bd6b6b;
      background: #fff0f0;
    }
    .admin-dish-comment-delete:disabled {
      cursor: wait;
      opacity: .6;
    }
    .admin-dish-comment-delete svg {
      width: 14px;
      height: 14px;
    }
  `;

  function text(value) {
    return String(value ?? "").trim();
  }

  function injectStyles() {
    if (document.getElementById("admin-dish-comment-delete-styles")) return;
    const style = document.createElement("style");
    style.id = "admin-dish-comment-delete-styles";
    style.textContent = styles;
    document.head.appendChild(style);
  }

  function isAdminMode() {
    try {
      if (typeof isAdmin !== "undefined") return Boolean(isAdmin);
      if (typeof state !== "undefined" && state) {
        if (state.isAdmin === true || state.adminLoggedIn === true || state.adminMode === true) return true;
        if (/admin|管理员/i.test(String(state.role || state.userRole || ""))) return true;
      }
      if (typeof adminLoggedIn !== "undefined" && adminLoggedIn === true) return true;
      if (typeof adminMode !== "undefined" && adminMode === true) return true;
      if (typeof currentUser !== "undefined" && currentUser) {
        if (currentUser.isAdmin === true || /admin|管理员/i.test(String(currentUser.role || ""))) return true;
      }
      if (typeof authState !== "undefined" && authState) {
        if (authState.isAdmin === true || /admin|管理员/i.test(String(authState.role || ""))) return true;
      }
    } catch {
      // Global lexical state is optional.
    }
    if (window.__isAdmin === true || window.isAdmin === true || window.currentUser?.isAdmin === true) return true;
    const storageEntries = [
      ...Object.keys(window.localStorage).map((key) => [key, window.localStorage.getItem(key)]),
      ...Object.keys(window.sessionStorage).map((key) => [key, window.sessionStorage.getItem(key)])
    ];
    const adminFlag = storageEntries.find(([key, value]) =>
      /admin|管理员|role/i.test(key) && /true|1|yes|admin|管理员/i.test(String(value))
    );
    if (adminFlag) return true;
    return Boolean(document.querySelector(
      "[data-admin-mode='true'], [data-admin='true'], .admin-mode, .admin-panel, [data-role='admin'], #admin-panel"
    )) || Array.from(document.querySelectorAll("button, a")).some((node) => {
      const label = text(node.textContent).replace(/\s+/g, "");
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && /管理员模式|退出管理员|AI清除重复菜品|清空全部菜品|清空一周菜单|报表生成|当月报表/.test(label);
    });
  }

  function visibleDialogs() {
    return Array.from(document.querySelectorAll(
      "[role='dialog'], dialog, .modal, .modal-overlay, .overlay, [class*='comment-modal'], [class*='comments-modal'], [class*='comment-dialog'], [class*='comments-panel']"
    )).filter((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
  }

  function isDishCommentDialog(dialog) {
    const content = text(dialog.innerText || dialog.textContent).replace(/\s+/g, "");
    if (/意见交流|交流区|帖子回复|食堂评价/.test(content)) return false;
    const explicitDishDialog = Boolean(
      dialog.matches("[data-dish-id], [data-food-id], [data-comment-type='dish']") ||
      dialog.querySelector("[data-dish-id], [data-food-id], [data-comment-type='dish']") ||
      /菜品评论|菜品评价|全部评论/.test(content)
    );
    if (explicitDishDialog) return true;
    const hasLikeControl = Array.from(dialog.querySelectorAll("button, [role='button']"))
      .some((node) => /点赞|赞\s*\d*/.test(text(node.textContent)));
    const hasCommentInput = Boolean(dialog.querySelector("textarea, input[placeholder*='评论'], [contenteditable='true']"));
    return /评论/.test(content) && (hasLikeControl || hasCommentInput);
  }

  function getCommentId(node) {
    const holder = node.closest("[data-comment-id], [data-id], [data-comment]") || node;
    return text(
      holder.getAttribute("data-comment-id") ||
      holder.getAttribute("data-id") ||
      holder.getAttribute("data-comment") ||
      holder.dataset?.commentId ||
      holder.dataset?.id ||
      ""
    );
  }

  function commentNodes(dialog) {
    const selectors = [
      "[data-comment-id]",
      "[data-comment]",
      "[data-comment-type='dish']",
      "[data-id][class*='comment']",
      "[id*='comment-']",
      "[data-comment-key]"
    ];
    const nodes = [];
    selectors.forEach((selector) => {
      dialog.querySelectorAll(selector).forEach((node) => {
        if (!nodes.includes(node) && getCommentId(node)) nodes.push(node);
      });
    });
    if (!nodes.length) {
      dialog.querySelectorAll("article, li, [class*='comment-item'], [class*='comment-card'], [class*='review-item']").forEach((node) => {
        if (text(node.textContent) && !nodes.includes(node)) nodes.push(node);
      });
    }
    dialog.querySelectorAll("button, [role='button']").forEach((control) => {
      if (!/点赞|赞\s*\d*/.test(text(control.textContent))) return;
      const node = control.closest(
        "article, li, [class*='comment-item'], [class*='comment-card'], [class*='review-item'], [class*='comment-row']"
      );
      if (node && text(node.textContent) && !nodes.includes(node)) nodes.push(node);
    });
    return nodes;
  }

  function findActionHost(commentNode) {
    const candidate = Array.from(commentNode.querySelectorAll("[class*='action'], [class*='footer'], [class*='toolbar'], [class*='button']"))
      .find((node) => !/^(BUTTON|A|INPUT)$/.test(node.tagName));
    if (candidate) return candidate;
    if (/^(BUTTON|A|INPUT)$/.test(commentNode.tagName)) return commentNode.parentElement || commentNode;
    return commentNode;
  }

  function apiResultRows(result) {
    if (Array.isArray(result)) return result;
    if (Array.isArray(result?.data)) return result.data;
    return [];
  }

  function recordContent(row) {
    return text(
      row?.content ?? row?.comment ?? row?.comment_text ?? row?.comment_content ??
      row?.text ?? row?.body ?? row?.message ?? row?.review ?? row?.review_text ?? ""
    );
  }

  function commentContentFromNode(commentNode) {
    const preferred = commentNode.querySelector(
      "[data-comment-content], [class*='comment-content'], [class*='comment-text'], [class*='review-content'], [class*='review-text'], p"
    );
    if (preferred && text(preferred.textContent)) return text(preferred.textContent);
    const clone = commentNode.cloneNode(true);
    clone.querySelectorAll("button, [role='button'], time, [class*='action'], [class*='like']").forEach((node) => node.remove());
    return text(clone.textContent);
  }

  async function findCommentRecord(commentId, content) {
    if (typeof supabaseFetch !== "function") throw new Error("Supabase 连接尚未初始化");
    for (const table of COMMENT_TABLES) {
      try {
        if (commentId) {
          const rows = apiResultRows(await supabaseFetch(
            `${table}?id=eq.${encodeURIComponent(commentId)}&select=*&limit=1`
          ));
          if (rows.length) return { table, row: rows[0] };
        }
        if (content) {
          const rows = apiResultRows(await supabaseFetch(`${table}?select=*&limit=2000`));
          const normalizedContent = content.replace(/\s+/g, "");
          const matched = rows.find((row) => {
            const value = recordContent(row).replace(/\s+/g, "");
            return value && (value === normalizedContent || normalizedContent.includes(value));
          });
          if (matched) return { table, row: matched };
        }
      } catch {
        // Try the next table used by older versions.
      }
    }
    return null;
  }

  async function deleteComment(commentId, content) {
    const record = await findCommentRecord(commentId, content);
    if (!record?.row?.id) throw new Error("没有找到对应的菜品评论记录");
    await supabaseFetch(`${record.table}?id=eq.${encodeURIComponent(record.row.id)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" }
    });
    return record;
  }

  function notify(message) {
    try {
      if (typeof showToast === "function") {
        showToast(message, "error");
        return;
      }
    } catch {
      // Use the browser fallback below.
    }
    window.alert(message);
  }

  async function handleDelete(button, commentNode) {
    const commentId = getCommentId(commentNode);
    const content = commentContentFromNode(commentNode);
    if ((!commentId && !content) || button.disabled) return;
    if (!window.confirm("确定删除这条菜品评论吗？删除后无法恢复。")) return;
    button.disabled = true;
    button.textContent = "删除中...";
    try {
      const deleted = await deleteComment(commentId, content);
      commentNode.remove();
      document.dispatchEvent(new CustomEvent("dish-comment-deleted", {
        detail: { commentId: deleted.row.id }
      }));
    } catch (error) {
      button.disabled = false;
      button.innerHTML = "删除";
      notify(`删除评论失败：${error?.message || "请稍后重试"}`);
    }
  }

  function addDeleteButton(commentNode) {
    if (commentNode.querySelector(`[${DELETE_MARK}]`)) return;
    const commentId = getCommentId(commentNode);
    if (!commentId && !commentContentFromNode(commentNode)) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "admin-dish-comment-delete";
    button.setAttribute(DELETE_MARK, "true");
    button.title = "删除这条菜品评论";
    button.textContent = "删除";
    button.addEventListener("click", () => handleDelete(button, commentNode));
    findActionHost(commentNode).appendChild(button);
  }

  function mountButtons() {
    if (!isAdminMode()) return;
    visibleDialogs().filter(isDishCommentDialog).forEach((dialog) => {
      commentNodes(dialog).forEach(addDeleteButton);
    });
  }

  function start() {
    injectStyles();
    // The current application renders exactly one administrator delete button
    // per comment in app.js. Remove buttons injected by older cached versions.
    document.querySelectorAll(`[${DELETE_MARK}]`).forEach((button) => button.remove());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
