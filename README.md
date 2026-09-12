# PayHub Docs · Pay-Unify 统一支付文档中心

基于 [Rspress](https://rspress.dev) 构建的 **Pay-Unify 统一支付平台**聚合文档站。

- 在线站点：<https://pay-unify-docs-one.vercel.app>
- 源码仓库：<https://github.com/difyz9/pay-unify>（单仓：Go 后端 `backend/` + Next.js 控制台 `frontend/`）
- 镜像：`difyz9/pay-unify`（[Docker Hub](https://hub.docker.com/r/difyz9/pay-unify)，单容器 / 单端口）

## 目录结构

```
pay-unify-docs/
├── rspress.config.ts      # 站点配置（标题 / 导航 / 侧边栏）
├── package.json
├── vercel.json            # Vercel 构建 / 输出参数
├── docs/                  # Markdown 内容（编写文档放这里）
│   ├── index.md           # 首页（hero / features）
│   ├── guide/             # 指南：系统概览、快速开始
│   ├── backend/           # 后端：认证 / 配置 / API / 支付 / X402 / 证书 / SDK
│   ├── frontend/          # 前端：概览、性能指南
│   ├── deployment/        # 部署：Docker 一键部署、环境变量、后端、前端
│   ├── appendix/          # 附录：相关资源
│   └── changelog.md       # 更新日志
└── README.md
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

## 内容维护约定

本仓库已是相关文档的**唯一维护源**（原后端 `backend/docs/*.md`、前端 `docs/*.md`
在单仓重构后不再随 `pay-unify` 仓库发布）。因此：

- `docs/backend/*`、`docs/frontend/performance.md`、`docs/changelog.md` 等页面**直接在本仓库编辑**，
  页面顶部的「维护说明」会指向对应的源码位置，实现细节以 `pay-unify` 源码为准。
- 涉及接口路由的改动，请同步核对 `pay-unify` 仓库 `backend/internal/handler/*.go` 的 `RegisterRoutes`
  与 `backend/docs/swagger.*`。
- 涉及部署 / 环境变量的改动，请同步核对仓库根 `Dockerfile`、`docker-compose.yml`、
  `.env.example`、`backend/internal/core/env_config.go`。

新增页面后在 `rspress.config.ts` 的 `themeConfig.nav` / `sidebar` 中登记，否则不会出现在导航中。

## 内容来源速查

| 主题 | 权威位置（pay-unify 仓库） |
| --- | --- |
| 项目总览 / Docker 部署 | `README.md`、`docs/dockerhub-overview.md` |
| 1Panel 打包 | `docs/1panel-packaging-plan.md`、`deploy/1panel/` |
| 认证 / OAuth2 | `backend/internal/middleware/`、`backend/internal/handler/{login,oauth}_handler.go` |
| 配置 / 环境变量 | `backend/config.toml.example`、`backend/internal/core/env_config.go` |
| 统一支付 / PayPal / X402 | `backend/internal/handler/payment_handler.go`、`backend/internal/pkg/service/payment/` |
| 证书管理 | `backend/internal/handler/payment_cert_handler.go`、`backend/internal/pkg/channel/spec.go` |
| 前端 | `frontend/src/`（`core/api/baseUrl.ts`、`core/auth/`、`features/`） |

## 环境要求

- Node.js 18+（Vercel 使用 24.x）
- 可选：Go 1.25+ / MySQL 8.0+（仅本地调试真实接口时需要）

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

> 当前生产域名为 <https://pay-unify-docs-one.vercel.app>。
> 若 Vercel 项目关联了自定义域名，发布后域名自动指向最新标签版本。
>
> 注意：`.vercel/` 已被 `.gitignore` 忽略，只用于本地获取 id，不要提交。
