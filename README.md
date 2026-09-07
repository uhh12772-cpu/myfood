# 今日菜单 Supabase 直连版

这个目录就是可部署到 GitHub Pages 的静态版本，首页文件是 `index.html`。

## 文件

- `index.html`：网页首页
- `styles.css`：页面样式
- `app.js`：直接连接 Supabase 的程序
- `supabase-direct-setup.sql`：Supabase Storage 图片字段和公开权限补充脚本
- `sync-existing-data.mjs`：把当前本地已有菜品和一周菜单同步到 Supabase

## 上线前要做

1. 在 Supabase 的 SQL Editor 里执行 `supabase-direct-setup.sql`。
2. 确认 Storage 里存在 `dish-images` bucket，脚本会尝试创建并设置为公开。
3. 把 `new` 目录里的文件上传到 GitHub 仓库。如果仓库根目录就是这个程序，需要把这几个文件放到仓库根目录；如果放在 `/new` 子目录，需要用 `https://你的域名/new/` 访问。
4. 如果要把本地已有数据补进 Supabase，先运行 `sync-existing-data.mjs`。

## 管理员

页面管理员账号是：

- 账号：`admin`
- 密码：`admin`

当前按你的要求保留公开增删改权限，因此普通访问者只要打开页面，也能通过页面写入一周菜单、投票、评论、录入和删除菜品。管理员登录主要用于页面内确认管理员模式，不会在前端保存 Supabase 私密密钥。

补充说明：

- `data/dishes.json` 里那条番茄炒蛋记录会合并到同名菜品里，不会生成重复菜名。
- `data/weekly-menu.json` 目前是空的，所以同步后的一周菜单还是空表。
- 同步脚本会先处理同名旧记录，再写入本地数据，避免重复菜名堆出来。
