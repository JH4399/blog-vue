# 拾光 Field Notes

基于现有 Vue 3 + Vite + Pinia + Vue Router 项目实现的简洁博客前端，接口对应 `C:/blog` 中的 Spring Boot 后端。仅修改前端，未启动或修改后端、数据库、Redis。

## 启动与联调

需要 Node.js 22.18+（或 24.12+）和 npm。

```powershell
cd C:\blog-vue
npm install
npm run dev
```

访问终端输出的地址，默认是 http://localhost:5173。后端由你自行启动，当前后端配置端口为 **2233**。前端默认向 `/api` 发请求，Vite 将请求原样代理到 `http://localhost:2233`，开发时不需要修改后端 CORS。

后端在其他地址时，在前端项目根目录创建 `.env.local`，或复制示例配置：

```powershell
Copy-Item .env.example .env.local
```

```dotenv
VITE_API_BASE_URL=/api
API_PROXY_TARGET=http://localhost:2233
VITE_DEMO_MODE=false
```

修改环境变量后重新启动 Vite。`API_PROXY_TARGET` 填写后端源地址，不要追加 `/api`。`VITE_API_BASE_URL` 也可以填完整 API 地址，此时由后端配置允许前端域名的 CORS。

首页未登录时会显示登录入口；点击“浏览示例”可查看明确标注的本地只读示例。示例不会自动替代失败的接口数据，也不会向真实后端写入。设置 `VITE_DEMO_MODE=true` 可在启动时直接进入示例模式；登录真实账户会自动退出示例模式。

## 已实现

- 首页：精选文章、文章卡片/列表切换、搜索、分类和标签筛选、状态筛选、排序、分页。
- 登录与注册：使用真实接口，保存 Bearer Token，刷新后查询当前用户，401 清理登录态，退出时撤销服务端 Token。
- 阅读页：Markdown 基础排版、目录跳转、文章标签、评论与回复、删除评论、编辑和删除文章。
- 写作页：Markdown 编辑/预览、摘要、分类、封面 URL、标签、置顶、草稿/发布/私密状态；按用户保留浏览器本地草稿。
- 归档、友情链接、关于页面、404 页面、手机布局和深色模式。
- 管理员入口：分类、标签、友链、系统配置的新增、编辑和删除。
- 加载、空数据、错误提示和重试；封面为空或无法加载时使用本地 CSS 插画，无需外部图片服务。

## 与后端一致的行为

| 前端功能 | 使用的接口 |
| --- | --- |
| 登录、注册、当前用户、退出 | `/api/user/login`、`register`、`me`、`logout` |
| 文章增删改查 | `/api/posts`、`/api/posts/{id}` |
| 分类、标签 | `/api/categories`、`/api/tags` 及 `/{id}` |
| 文章标签关联 | `/api/post-tags?postId=…`、`/api/post-tags`、`/api/post-tags/{postId}/{tagId}` |
| 评论和回复 | `/api/comments?postId=…`、`/api/comments`、`/api/comments/{id}` |
| 友情链接 | `/api/links?status=1`（展示）；`/api/links` 及 `/{id}`（管理） |
| 系统配置 | `/api/settings` 及 `/{id}`（管理员） |

响应统一解包 `{ code, message, data }`，请求使用 `Authorization: Bearer <accessToken>`。

**当前后端没有公开文章阅读接口。** `/api/posts` 列表、详情都要求登录，普通用户仅可访问本人文章，管理员 `role=2` 可访问全部。前端遵循这个权限，不会伪造公开阅读接口。若以后需要游客阅读，需要后端另行提供仅包含已发布文章的公开接口。

文章列表接口返回全部可见记录，因此搜索、分类、排序、分页在前端执行。后端没有标签筛选接口，选择标签时分批请求文章标签关联，每批最多 5 个；文章很多时可考虑后端增加分页/筛选接口。

新增评论固定待审核；当前后端没有审核接口，前端展示实际状态，不会显示为已通过。删除带回复的评论、被引用的分类/标签时，显示后端返回的冲突提示。

文章 PUT 会提交完整可编辑字段，保留草稿/私密和空字段语义，不提交作者、统计、发布时间等服务端字段。文章保存与标签关联分两步完成；标签同步失败会说明文章已保存，重试使用已生成 ID，避免重复创建。

编辑器支持基础 Markdown 标题、段落、加粗、斜体、列表、引用、代码块和 HTTP(S) 链接。原始 HTML 作为文本展示，不执行；暂未实现 HTML 富文本、Markdown 表格、文件上传或点赞（后端未提供上传/点赞接口）。系统配置页管理后端配置记录，页面品牌文案目前在前端维护。

## 自行验证联调

1. 启动后端及其数据库和 Redis，启动前端。
2. 注册账户后登录；新账户文章列表为空时，点击“写文章”。
3. 填写标题和正文，保存草稿；再编辑并发布，确认状态和详情同步。
4. 测试分类筛选、搜索、归档、刷新页面后的登录恢复。
5. 在详情页评论或回复，确认显示“待审核”；测试删除评论。
6. 管理员账户登录后可从导航进入“管理”，维护分类、标签、友链和配置，再测试文章分类与标签绑定。
7. 退出后确认文章不再展示；令牌过期后应提示重新登录。

## 检查和构建

```powershell
npm test
npm run build
npm run preview
```

测试覆盖请求路径与请求体、认证和 401、接口错误、Markdown 安全处理、示例/真实账户切换，以及主要公开页面的 Vue 渲染。测试使用模拟响应，不连接真实后端。构建输出为 `dist/`。

`npm run preview` 配置了相同 API 代理，仅用于本地构建预览。生产部署需要 Web 服务器单独转发 `/api` 并将前端路由回退到 `index.html`，Vite 开发代理不会被打包进静态文件。例如 Nginx：

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:2233;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
location / {
    try_files $uri $uri/ /index.html;
}
```

页面结构位于 `src/views/`，统一 API 封装位于 `src/services/api.js`，状态位于 `src/stores/blog.js`，样式和颜色位于 `src/assets/main.css`。
