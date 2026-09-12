---
title: 前端部署
---

# 前端部署

前端位于单仓的 `frontend/` 目录，`next.config.ts` 支持两种输出：

| `NEXT_OUTPUT` | 输出模式 | 用途 |
| --- | --- | --- |
| 未设置（默认） | `standalone` | 独立部署到 Docker / Vercel / Node |
| `export` | 静态导出 | 供后端 `//go:embed all:web` 打包进**单容器** / 单二进制 |

> **单容器部署（推荐）不需要单独部署前端**：见 [Docker 一键部署](/deployment/docker)。
> 本页用于需要独立/分布式部署前端的场景。

CI 构建阶段忽略 ESLint / TypeScript 报错，避免部署中断。

## 0. 前置：环境变量

| 变量 | 场景 | 说明 |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | 前后端分离 | 独立后端 origin，如 `http://localhost:8097`；同源部署留空 |
| `NEXT_PUBLIC_X402_CLIENT_ID` / `_SECRET` | X402 演示页 | OAuth2 client 凭证（可选） |
| `NEXT_OUTPUT=export` | 静态导出 | 为 Go `//go:embed` 准备产物 |

> 单容器同源部署下控制台走相对路径请求（`baseURL` 为空），**不存在混合内容问题**，也不需要任何代理。
> 只有在前后端分离部署时，才需要把 `NEXT_PUBLIC_API_URL` 指向独立后端 origin（此时跨源需后端 CORS + Cookie 凭证）。
>
> ⚠️ `NEXT_PUBLIC_*` 是**构建期**内联变量：必须在 `npm run build` 前注入，运行时改容器 env 不生效。
> 单容器镜像刻意**不注入** `NEXT_PUBLIC_API_URL`，产物走相对路径，从而适配任意域名/端口。

## 1. Docker 独立部署（standalone）

`frontend/Dockerfile` 为 node:20-alpine 多阶段构建，standalone 输出：

```bash
cd frontend

# 单容器
docker build --build-arg NEXT_PUBLIC_API_URL=http://<backend-host>:8097 \
  -t pay-unify-frontend:latest .
docker run -d --name pay-unify-frontend -p 3010:3010 \
  -e NODE_ENV=production \
  pay-unify-frontend:latest

# 或 compose
docker compose up -d --build
```

容器默认监听 `3010`，运行用户 `nextjs`（非 root），自带 healthcheck。

## 2. Vercel 部署

`frontend/vercel.json` 已配置（region `hkg1`），并可用 `frontend/scripts/deploy.sh`：

```bash
cd frontend
npm i -g vercel
vercel          # 预览
vercel --prod   # 生产
```

或在 Vercel 控制台设置环境变量后手动部署：

| Key | Value |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://api.example.com`（HTTPS 站点建议，走代理）或后端直连地址 |

> 部署在 Vercel 时页面协议为 `https:`，需把 `NEXT_PUBLIC_API_URL` 指向**同样为 HTTPS** 的后端地址。

## 3. 传统服务器（Node 直跑 + Nginx）

```bash
cd frontend
npm ci
npm run build:prod        # NODE_ENV=production 构建
npm run start             # 监听 :3010
```

Nginx 反代（仓库 `frontend/nginx/` 提供完整配置示例）：

```nginx
server {
    listen 80;
    server_name pay.example.com;
    location / { proxy_pass http://127.0.0.1:3010; proxy_set_header Host $host; }
}
```

## 4. 页面级路由守卫

- 受保护页面（`/dashboard`、`/admin`）由客户端组件 `src/components/auth/AuthGuard.tsx` 守护：未登录 → `router.push('/login')`。
- 会话为后端下发的 HttpOnly Cookie（`auth_token`），浏览器自动携带；非安全方法由 `apiClient` 附带 `X-CSRF-Token`。
- 前后端分离部署时，后端需放开前端 origin 的 CORS 并允许带凭证（Cookie）。

## 5. 常见问题

- **登录后立刻跳回登录页**：检查浏览器是否存在 `auth_token`、后端地址是否正确、`/api/v1/verify` 是否可达。
- **接口报 mixed content / 跨源失败**：页面 HTTPS 而 `NEXT_PUBLIC_API_URL` 为 HTTP 直连。请让后端也走 HTTPS，或改用单容器同源部署。
- **接口 401**：token 过期由 `apiClient` 自动 `/api/v1/refresh`；刷新失败会清 Cookie。
- **静态导出后接口/中间件失效**：`output: export` 不支持 `src/app/api` 与 `src/middleware.ts`，
  单容器场景由 Go 侧承担代理与路由守卫，构建脚本会自动临时移开这两个路径。

## 6. 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 本地开发（Turbopack，:3010） |
| `npm run build` / `npm run start` | 生产构建 / 启动 |
| `npm run build:staging` / `build:prod` | 预发布 / 生产构建 |
| `npm run lint` | ESLint |

## 相关文档

- [Docker 一键部署](/deployment/docker)（单容器，推荐）
- [环境变量参考](/deployment/environment)
- [前端概览](/frontend/overview)、[前端性能指南](/frontend/performance)
