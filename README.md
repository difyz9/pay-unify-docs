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
