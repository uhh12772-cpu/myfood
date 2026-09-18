# 今日菜单 Supabase 直连版

这个目录就是可部署到 GitHub Pages 的静态版本，首页文件是 `index.html`。

## 文件

- `index.html`：网页首页
- `styles.css`：页面样式
- `app.js`：直接连接 Supabase 的程序
- `supabase-direct-setup.sql`：Supabase Storage 图片字段和公开权限补充脚本
- `supabase-feature-update.sql`：投票限制、意见调查和多菜品周菜单的数据库升级脚本
- `supabase-survey-fix.sql`：修复食堂评价提交函数字段名冲突
- `tessdata/chi_sim.traineddata.gz`：随网站部署的简体中文 OCR 模型，避免运行时下载语言包卡住
- `sync-existing-data.mjs`：把当前本地已有菜品和一周菜单同步到 Supabase

## 上线前要做

1. 在 Supabase 的 SQL Editor 里执行 `supabase-direct-setup.sql`。
2. 再执行 `supabase-feature-update.sql`。如果这两个脚本以前执行过，只需要重新执行第二个升级脚本。
3. 确认 Storage 里存在 `dish-images` bucket，脚本会尝试创建并设置为公开。
4. 把 `new` 目录里的文件上传到 GitHub 仓库。如果仓库根目录就是这个程序，需要把这几个文件放到仓库根目录；如果放在 `/new` 子目录，需要用 `https://你的域名/new/` 访问。
5. 如果要把本地已有数据补进 Supabase，先运行 `sync-existing-data.mjs`。

## 管理员

当前按你的要求保留公开维护权限：普通访问者可以录入菜品、模糊搜索、单个删除菜品，也可以直接修改一周菜单。登录管理员账号后，额外显示批量上传和一键清空全部菜品。

管理员账号：

- 账号：`admin`
- 密码：`admin`

这里的管理员登录是静态 GitHub Pages 中的页面操作门槛，不是服务器级别的身份认证。因为当前 Supabase 策略仍允许公开新增、单个删除和周菜单修改，任何真正需要限制权限的生产环境，都应改用 Supabase Auth、微信登录或服务端接口。

补充说明：

- 每个浏览器会生成一个访客标识，用于限制同一浏览器每天最多 15 票、同一道菜每天 1 票；清除浏览器数据或更换设备会生成新的标识。
- 删除菜品时会同步清理对应的周菜单记录、投票记录和评论；一键清空会清空全部菜品及相关周菜单。
- 一周菜单顶部的“AI识别导入”支持 `.xlsx`、`.xls` 和菜单图片。Excel 会按工作表、星期列和早餐/午餐/晚餐识别；图片会先进行中文 OCR，再按文字坐标推断日期和餐次。识别结果会先预览，确认后仍需点击“保存一周菜单”。
- 上传到 GitHub 时必须同时上传 `tessdata` 目录。图片识别只加载一套本地 `chi_sim` 模型，并设置了 90 秒超时，不再同时下载 `chi_sim+eng` 两套模型。
- 一周菜单最多显示 16 个菜品列，适合导入学校餐表中每餐多行菜品的格式。
- “清空一周菜单”仅管理员登录后显示，清空前会二次确认；它只删除周菜单安排，不会删除菜品库、图片、投票或评论。
- `data/dishes.json` 里那条番茄炒蛋记录会合并到同名菜品里，不会生成重复菜名。
- `data/weekly-menu.json` 目前是空的，所以同步后的一周菜单还是空表。
- 同步脚本会先处理同名旧记录，再写入本地数据，避免重复菜名堆出来。
