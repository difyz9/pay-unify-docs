# PayHub Docs · Pay-Unify 统一支付文档中心

基于 [Rspress](https://rspress.dev) 构建的 **Pay-Unify 统一支付平台**聚合文档站，
覆盖 `pay-unify-backend`（Go 后端）与 `pay-unify-frontend`（Next.js 前端）两个仓库。

```
my_pay/
├── docs/                      # 本目录：Rspress 文档站
│   ├── rspress.config.ts      # 站点配置（标题 / 导航 / 侧边栏）
│   ├── package.json
│   ├── docs/                  # Markdown 内容（编写文档放这里）
│   │   ├── index.md           # 首页（hero / features）
│   │   ├── guide/             # 指南：概览、快速开始
│   │   ├── backend/           # 后端：认证 / 配置 / API / 支付 / X402 / 证书 / SDK
│   │   ├── frontend/          # 前端：概览、性能指南
│   │   ├── deployment/        # 部署：后端、前端
│   │   └── appendix/          # 附录：资源链接
│   └── ...
├── pay-unify-backend/         # 后端仓库
└── pay-unify-frontend/        # 前端仓库
```

## 常用命令

```bash
# 安装依赖
npm install

# 本地开发（默认 http://localhost:3000，热更新）
npm run dev

# 生产构建（输出到 doc_build/）
npm run build

# 预览生产构建
npm run preview
```

## 内容同步约定

`docs/backend/`、`docs/frontend/performance.md`、`docs/changelog.md` 等页面由仓库原生文档同步而来，
页面顶部标注了源文件路径（如 `pay-unify-backend/docs/AUTHENTICATION.md`）。
**修改这类内容请先更新仓库内的源文档，再同步到本网站对应页面**，避免双份内容漂移。

- 后端仓库文档：`../pay-unify-backend/docs/`
- 前端仓库文档：`../pay-unify-frontend/docs/`

其余页面（`guide/`、`backend/api-overview.md`、`backend/sdk.md`、`frontend/overview.md`、`deployment/`、`appendix/`）为本网站原创内容，
可直接在本目录编辑。

## 环境要求

- Node.js 18+
- 可选：Go 1.21+ / MySQL 8.0+（仅本地调试真实接口时需要）

---

## 版本发布（标签 → Vercel 自动部署）

仓库已配置 GitHub Actions（`.github/workflows/release-to-vercel.yml`）：
**推送 `v*` 标签即触发构建并发布到 Vercel 生产环境**，每次发布对应一个版本。

```bash
# 示例：发布 v1.0.0
git tag v1.0.0
git push origin v1.0.0
# 查看执行：仓库 → Actions → “Release to Vercel”
```

构建 / 输出参数由仓库根目录 `vercel.json` 固定：
`npm ci` → `npm run build` → 输出 `doc_build/`。

### 首次接入 Vercel（一次性）

1. 在 [vercel.com](https://vercel.com) 用 GitHub 登录，**Import** 本仓库（`difyz9/pay-unify-docs`）。
   - Framework Preset 选 **Other**（或留空，`vercel.json` 会覆盖构建参数）。
2. 生成本地关联信息：
   ```bash
   npx vercel login
   npx vercel link   # 选择刚导入的 project
   cat .vercel/project.json   # 记下 orgId / projectId
   ```
3. 在 Vercel 控制台 **Account → Settings → Tokens** 创建 Access Token。
4. 到仓库 **Settings → Secrets and variables → Actions** 添加三个 secret：

   | Secret | 值 |
   | --- | --- |
   | `VERCEL_TOKEN` | 第 3 步生成的 Token |
   | `VERCEL_ORG_ID` | `.vercel/project.json` 里的 `orgId` |
   | `VERCEL_PROJECT_ID` | `.vercel/project.json` 里的 `projectId` |

5. 之后每次打标签即可自动发布。

> 注意：`.vercel/` 已被 `.gitignore` 忽略，只用于本地获取 id，不要提交。
> 若 Vercel 项目关联了自定义域名，发布后域名自动指向最新标签版本。

