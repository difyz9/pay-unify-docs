---
title: 前端部署
---

# 前端部署（pay-unify-frontend）

项目默认 `output: "standalone"`（`next.config.ts`），可直接部署到 **Docker**、**Vercel** 等环境。CI 构建阶段忽略 ESLint / TypeScript 报错，避免部署中断。

## 0. 前置：环境变量

| 变量 | 场景 | 说明 |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | HTTP 直连 | 后端网关地址，如 `http://124.222.202.16:8089` |
| `NEXT_PUBLIC_API_URL` + HTTPS | HTTPS 站点 | 前端自动改用 `/api/proxy` 服务端转发到该地址 |
| `NEXT_PUBLIC_X402_CLIENT_ID` / `_SECRET` | X402 演示页 | OAuth2 client 凭证（可选） |

> HTTPS 环境下请求会自动走 `src/app/api/proxy/[...path]`，避免混合内容（mixed-content）报错；
> 该代理把 `/api/proxy/*` 转发到 `NEXT_PUBLIC_API_URL` 对应的后端。

## 1. Docker 部署（生产）

仓库自带 `Dockerfile`（node:20-alpine 多阶段，standalone 输出）与 `docker-compose.yml`：

```bash
cd pay-unify-frontend

# 单容器
docker build -t pay-unify-frontend:latest .
docker run -d --name pay-unify-frontend -p 3010:3010 \
  -e NODE_ENV=production \
  -e NEXT_PUBLIC_API_URL=http://<backend-host>:8089 \
  pay-unify-frontend:latest

# 或 compose
docker compose up -d --build
```

容器默认监听 `3010`，运行用户为 `nextjs`（非 root），自带 healthcheck（`wget :3010`）。

> ⚠️ `NEXT_PUBLIC_*` 是**构建期**内联变量：在 CI / compose 中注入 `NEXT_PUBLIC_API_URL` 后再 `npm run build`，
> 运行时仅改容器 env 不会生效（HTTPS 站点因走 `/api/proxy` 相对路径，实际受影响的是代理目标，见下）。

### HTTPS 站点 + 代理

若站点启用 HTTPS（或访问入口域名是 https），前端会把所有 API 请求发往同域 `/api/proxy`。
此时**后端网关地址需要在构建期写入** `NEXT_PUBLIC_API_URL`（代理目标来源），例如：

```bash
docker build --build-arg NODE_ENV=production \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.com .
```

## 2. Vercel 部署

仓库已提供 `vercel.json`（framework=nextjs，region=hkg1，内联了生产 API 地址）：

```bash
npm i -g vercel
vercel          # 预览
vercel --prod   # 生产（Makefile: make deploy）
```

或在 Vercel 控制台设置环境变量后手动部署：

| Key | Value |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://api.example.com`（HTTPS 站点建议，走代理）或后端直连地址 |

> 提示：部署在 Vercel 时页面协议为 `https:`，所有 API 将统一经 `/api/proxy` 转发，规避混合内容。

## 3. 传统服务器（Node 直跑 + Nginx）

```bash
cd pay-unify-frontend
npm ci
npm run build:prod        # NODE_ENV=production 构建（自动读取 .env.production）
npm run start             # 监听 :3010
```

Nginx 反代（仓库 `nginx/` 提供完整配置示例）：

```nginx
server {
    listen 80;
    server_name pay.example.com;
    location / { proxy_pass http://127.0.0.1:3010; proxy_set_header Host $host; }
}
```

## 4. 页面级路由守卫

- `src/middleware.ts` 拦截 `/dashboard`、`/admin` 等受保护前缀：无 `auth_token` Cookie → 302 到 `/login?redirect=...`。
- 生产反向代理务必把 `/api/proxy` 与 Next 页面请求都指向 Next 进程（Next 内部再转发到后端）。

## 5. 常见问题

- **登录后立刻跳回登录页**：检查浏览器是否存在 `auth_token`、后端地址是否正确、`/api/v1/verify` 是否可达。
- **接口报 mixed content**：说明页面是 HTTPS 而后端是 HTTP 直连，请改用 HTTPS 部署 + `/api/proxy`。
- **接口 401**：token 过期由 `apiClient` 自动 `/api/v1/refresh`；刷新失败会清 Cookie。
- **CSV 导出为空**：导出为前端本地实现，确认数据存在且浏览器未拦截下载。

## 6. 参考

- 前端部署专项文档（仓库内）：`pay-unify-frontend/docs/deployment/VERCEL_DEPLOY_GUIDE.md`、`DOCKER_DEPLOYMENT_GUIDE.md`
- 前端性能指南 → [前端性能指南](/frontend/performance)
