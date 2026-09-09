---
title: 前端概览
---

# 前端概览（pay-unify-frontend）

现代化的支付服务管理后台前端，基于 **Next.js 15（App Router）** 构建，覆盖支付 / 订单 / 金币 / 用户 / 商品 / 项目等多业务域的实时数据分析与控制台操作。

## 技术栈

| 类别 | 选型 |
| --- | --- |
| 框架 | Next.js 15（App Router，Turbopack 构建） |
| 语言 | TypeScript 5 |
| UI / 样式 | React 19、Tailwind CSS 4、Ant Design 6、Radix UI |
| 图标 / 动效 | Lucide React、Framer Motion |
| 图表 | Recharts（趋势 / 占比 / 统计卡片） |
| 数据交互 | Axios、React Context（会话）、js-cookie |
| 质量 | ESLint（`eslint-config-next`）、lint-staged + husky |

## 页面 / 模块一览

| 侧边栏菜单 | 路由 | 主要能力 | 服务层（features） |
| --- | --- | --- | --- |
| 仪表板 | `/dashboard` | 实时数据概览：统计卡片、订单趋势、支付方式占比、快捷入口 | orders / payments |
| 订单管理 | `/dashboard/orders` | 订单列表 / 详情 / 统计 / 趋势 / CSV 导出 / 删除 | `orders` |
| 支付管理 | `/dashboard/payments` | 渠道状态卡片（只读开关 + 沙箱 / 凭证状态）、演示下单 / 查单 / 关单 / 退款 | `payments` |
| 用户管理 | `/dashboard/users` | 用户列表 / 编辑 / VIP / 金币调整 / 状态 | `users` |
| 会员管理 | `/dashboard/memberships` | VIP 会员视图（复用 users 接口，`is_vip=true`） | `memberships` |
| 项目管理 | `/dashboard/projects` | 项目 CRUD + 项目统计 | `projects` |
| 商品管理 | `/dashboard/products` | 商品 CRUD、上下架、按项目筛选 | `products` |
| 金币管理 | `/dashboard/coins` | 充值记录 / 消费记录 / 趋势 / CSV 导出 | `coins` |
| 系统设置 | `/dashboard/settings` | 平台设置 | — |
| 支付设置 | `/dashboard/payment-settings` | **渠道配置 Tab**（参数编辑、开关热加载）+ **证书管理 Tab**（上传 / 设默认 / 下载 / 删除） | `payments`（`paymentService` / `certService` / `channelStatusService`） |
| X402 收款案例 | `/dashboard/x402` | SkillPay 端到端演示：切换后端、L1 支付码逐行解析、轮询、幂等、退款、请求 / 响应原文记录 | `skillpay` |
| API 应用管理 | `/dashboard/api-apps` | OAuth2 应用 CRUD：创建（生成 client_id / secret + scope）、轮换密钥、启停、删除 | `apiapps` |

另有受保护页面：`/admin/*`（安全 / 许可证 / 事件等管理）、`/login`（登录）、`/env-test`（环境变量自检）。

## 认证与会话（管理员 JWT）

```
登录 POST /api/v1/login  →  JWT 写入 Cookie auth_token
        ↓
Next.js middleware（src/middleware.ts）
  - /dashboard、/admin 需要 auth_token（基本结构 + 过期校验），否则 302 → /login?redirect=...
        ↓
apiClient（src/core/api/client.ts）请求拦截器
  - 无显式 Authorization 时，自动把 Cookie auth_token 附加为 Bearer
  - FormData 自动移除 JSON Content-Type（文件上传）
  - 401 时走刷新队列 / 清理会话并跳登录
```

**要点**

- 控制台**所有接口**（含支付下单演示、支付配置、证书管理）均使用管理员 JWT 会话，前端不持有商户密钥。
- 商户 / 第三方调用 `POST /oauth/token` 走 OAuth2，与前端控制台无关（见「API 应用管理」）。
- 401 处理：自动触发 `/api/v1/refresh` 刷新队列；失败则清除 Cookie 回登录页。

## API 地址解析（重要）

`src/core/api/client.ts` 决定请求打到哪：

```ts
const isHttps = window.location.protocol === "https:";
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://124.222.202.16:8089";
this.baseURL = isHttps ? "/api/proxy" : apiUrl;   // HTTPS 走 Next 代理，避免混合内容
```

| 场景 | baseURL | 说明 |
| --- | --- | --- |
| 本地 / HTTP | `NEXT_PUBLIC_API_URL`（如 `http://localhost:8097`） | 直接请求后端网关 |
| HTTPS（Vercel / Nginx TLS） | `/api/proxy` | 经 `src/app/api/proxy` 服务端转发，规避 mixed-content |

### 环境变量

| 变量 | 默认（示例） | 说明 |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://124.222.202.16:8089` | 后端网关地址（HTTPS 部署时仅用于兜底 / 代理目标） |
| `NEXT_PUBLIC_X402_CLIENT_ID` | `local-test` | X402 演示页 OAuth2 client_id |
| `NEXT_PUBLIC_X402_CLIENT_SECRET` | — | X402 演示页 OAuth2 client_secret |

Next.js 按 `NODE_ENV` 自动加载对应 `.env.*`：`npm run dev` → `.env.development`，`npm run build:staging` → `.env.staging`，`npm run build:prod` / `build` → `.env.production` / `.env`。项目还提供 `.env.local`（git 忽略）覆盖开发本地后端。

## 目录结构与约定

```
src/
├── app/                 # App Router 页面
│   ├── dashboard/       # 各业务仪表盘
│   ├── admin/           # 安全 / 许可证等管理页
│   ├── api/proxy/       # HTTPS 代理路由
│   └── login/           # 登录页
├── components/          # 可复用 UI（layout / ui / payments/certs 等）
├── core/                # 跨领域能力：api（axios 封装）、auth（AuthContext/authService）、security
├── features/            # 按业务域划分：每个域含 services/ 与 types/
│   ├── orders / payments / users / products / projects / coins
│   ├── memberships / skillpay / apiapps / admin
├── constants/           # 订单状态码等共享常量（与后端数字码对齐）
├── lib/                 # 通用工具（格式化、CSV 导出等）
└── middleware.ts        # 路由级登录守卫
```

- `core/`：HTTP 客户端（自动携带管理员 JWT、401 刷新队列、响应解包 `{code,message,data}`）、认证上下文。
- `features/*`：页面通过 `@/features/<域>` 访问 `services` 与 `types`，服务名与后端 handler 严格对齐（下表）。
- `components/`：可跨业务复用的 UI。
- CSV 导出（订单 / 用户 / 金币记录）为前端本地实现，后端暂无导出接口。

## 前端服务层 ↔ 后端接口对齐

| 前端服务 | 后端接口 | 认证 |
| --- | --- | --- |
| `orderService` | `GET /api/v1/orders*`（列表/统计/趋势/详情/删除） | JWT |
| `orderService` | `POST /api/v1/payment/pay`、`GET query/:no`、`POST cancel/:no`、`POST close/:no`、`POST refund`（控制台演示） | JWT（管理员） |
| `paymentService` | `GET/POST /api/v1/payment/config/*`、`PUT :provider/toggle` | JWT（管理员） |
| `certService` | `POST /api/v1/certs/upload/file`、`POST /certs/list`、`POST :id/default`、`DELETE :id`、`GET :id/download` | JWT（管理员） |
| `channelStatusService` | `GET /api/v1/payment/channels`（三渠道启用状态，公开） | 无需认证 |
| `userService` | `GET/PUT /api/v1/users*`、`POST :id/vip`、`POST :id/coin`、`PUT :id/status` | JWT |
| `productService` | `GET/POST/PUT/DELETE /api/v1/products*` | GET 公开 / 其余 JWT |
| `projectService` | `/api/v1/projects*` | JWT |
| `coinService` | `GET /api/v1/coins/*`、`GET /api/v1/coin/charge-config` | JWT / 公开 |
| `membershipService` | 复用 `users` 接口（VIP 会员即 `is_vip=true`） | JWT |
| `apiAppService` | `/api/v2/api-apps*`（CRUD / 轮换密钥 / 启停 / 删除） | OAuth2（`apiapp:manage`） |
| `skillpayService` | `POST /oauth/token`、`/api/v2/skillpay/*`（X402） | OAuth2 |

## 常见脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 本地开发（Turbopack，默认 `:3010`） |
| `npm run dev:staging` / `npm run dev:prod` | 指定 NODE_ENV 的开发模式 |
| `npm run build` / `build:staging` / `build:prod` | 生产构建（对应环境变量） |
| `npm run start` | 以生产模式启动已构建应用 |
| `npm run lint` / `lint:fix` | ESLint 检查 / 修复 |

## 更多

- 前端部署与运维细节 → [前端部署](/deployment/frontend)
- 前端性能与优化指南 → [前端性能指南](/frontend/performance)（由仓库 `docs/FRONTEND_PERFORMANCE_GUIDE.md` 同步）
- 官方前端文档位于 `pay-unify-frontend/docs/`（deployment / guides / fixes / status / notes）。
