---
title: 系统概览
---

# 系统概览

Pay-Unify 是一个**企业级统一支付服务平台**，采用**单仓双端**结构：
一个 GitHub 仓库（[`difyz9/pay-unify`](https://github.com/difyz9/pay-unify)）内同时包含 Go 后端与 Next.js 控制台，
并提供**单容器**交付形态。

| 目录 | 说明 | 主要技术 |
| --- | --- | --- |
| [`backend/`](https://github.com/difyz9/pay-unify/tree/main/backend) | 统一支付后端服务（同时内嵌前端静态资源） | Go 1.25 / Gin / GORM / Uber-FX / Zap / Swagger |
| [`frontend/`](https://github.com/difyz9/pay-unify/tree/main/frontend) | 支付服务管理控制台 | Next.js 15 / React 19 / TypeScript 5 / Tailwind 4 / Ant Design 6 / Recharts |
| [`deploy/`](https://github.com/difyz9/pay-unify/tree/main/deploy) | 1Panel 应用包、镜像构建脚本 | 1Panel / Docker |
| 本文档站 | [pay-unify-docs](https://github.com/difyz9/pay-unify-docs) · <https://pay-unify-docs-one.vercel.app> | Rspress 聚合文档 |

## 定位

本项目聚焦「支付」本身，所有非支付相关模块均已移除，核心能力：

- **安全认证**：管理员 JWT + 商户 OAuth2 双认证体系（已移除旧版 GoAuth HMAC 签名）。
- **多支付渠道**：支付宝、微信支付、PayPal，以及 SkillHub X402（SkillPay）付费能力。
- **业务域**：订单、用户 / VIP 会员、商品（SKU）、项目、金币 等完整管理能力。
- **运行时配置**：支付渠道开关、参数、证书均由数据库管理并**热加载**，无需重启进程。
- **单容器交付**：前端静态导出后由 Go 二进制 `//go:embed` 内嵌，单镜像 / 单端口。
- **数据统计**：订单趋势、支付方式占比、渠道状态等实时可视化。

## 架构总览（单容器形态）

```
┌──────────────────────────────────────────────────────────────────────┐
│                         浏览器 / 商户服务端                            │
│   管理控制台（同源 /）              第三方 / 商户（OAuth2 Bearer）      │
└───────────┬───────────────────────────────────┬──────────────────────┘
            │  Cookie: auth_token (JWT)          │  Authorization: Bearer
            ▼                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│              Pay-Unify 单容器 (difyz9/pay-unify, :8080)                │
│                                                                        │
│   内嵌控制台 (//go:embed all:web)        Go 后端 (Gin)                  │
│   中间件: accessLog / CORS / error / RequestID / JWT / Bearer / 安全头  │
│                                                                        │
│  /api/v1/*  ── 管理员 JWT + RequireAdmin（控制台）                      │
│  /api/v2/*  ── OAuth2 Bearer + RequireScope（开放 API）                 │
│  /oauth/*   ── 令牌颁发 / scope 列表 / 撤销                            │
│  /api/v1/payment/notify/* ── 支付平台回调（免认证）                     │
│  /swagger/*  /health  /health/db  /metrics                             │
│                                                                        │
│  Handler → Service → Store(GORM) → MySQL                               │
│  ChannelProvider（DB 配置热加载）→ 支付宝 / 微信运行时                  │
│  PaypalService / SkillHubService(X402) / OrderScheduler（自动关单）     │
└──────────────────────────────────────────────────────────────────────┘
            │
            ▼
   ┌──────────────┬──────────────┬─────────────┬──────────────────┐
   │  MySQL       │ runtime/certs│ 日志 logs/  │ 微信/支付宝/PayPal│
   └──────────────┴──────────────┴─────────────┴──────────────────┘
```

> 也可以拆开部署：后端单独跑（`backend/Dockerfile`）、前端 standalone 部署到 Vercel/Docker。
> 详见[部署](/deployment/docker)。

## 两套 API 平面（路由约定）

| 前缀 | 认证 | 使用者 | 典型路由 |
| --- | --- | --- | --- |
| `/api/v1/*` | 管理员 **JWT**（`auth_token` Cookie / Bearer，需 `isAdmin` 声明） | 前端管理后台 | `/api/v1/orders`、`/api/v1/payment/pay`、`/api/v1/payment/config/*`、`/api/v1/certs/*`、`/api/v1/api-apps` |
| `/api/v2/*` | 商户 **OAuth2 Bearer**（scope 校验） | 商户 / 第三方 S2S | `/api/v2/payment/pay`、`/api/v2/users`、`/api/v2/skillpay/*` |
| `/oauth/*` | 公开（凭证换令牌） | 所有调用方 | `/oauth/token`、`/oauth/scopes`、`/oauth/revoke` |
| 部分 `/api/v1`、`/api/v2` | 公开只读 | 任意 | `/api/v1/products`(GET)、`/api/v1/coin/charge-config`、`/api/v1/payment/channels` |

> ⚠️ 旧版基于 `X-App-Id / X-Timestamp / X-Sign` 的 GoAuth HMAC 签名认证已**全面下线**，
> 相关示例一律视为过期写法，详见[认证体系](/backend/auth)。

## 核心业务域与数据表

| 业务域 | 数据表 | v1 控制器 | 说明 |
| --- | --- | --- | --- |
| 订单 | `tb_payment_order` | `order_handler` / `payment_handler` | 创建、查询、统计、取消 / 关闭 / 退款、过期自动关单 |
| 用户 / 会员 | `tb_user` | `user_handler` | 用户信息、VIP、金币调整、状态控制 |
| 商品 | `tb_product` | `product_handler` | SKU、价格、库存、上下架（GET 公开） |
| 项目 | `tb_project` | `project_handler` | 商品所属项目 |
| 金币 | `tb_coin_record` | `coin_handler` | 充值记录 / 消费记录 / 趋势统计 |
| 支付渠道配置 | `tb_payment_config` | `payment_config_handler` | 开关 / 参数 / 审计日志，数据库热加载 |
| 支付证书 | `tb_payment_cert` | `payment_cert_handler` | 证书上传 / 默认 / 下载 / 删除 |
| API 应用 | `tb_api_app` | `api_app_handler` / `oauth_handler` | OAuth2 client 管理、令牌签发 |
| SkillPay 订单 | 复用 `tb_payment_order` | `skillpay_handler` | X402 收款、查询、退款 |
| 审计 | `tb_payment_audit` | `payment_config_handler` | 配置 / 证书操作审计日志 |

## 环境与端口约定

| 环境 | 后端监听 | 控制台访问 | 配置 |
| --- | --- | --- | --- |
| 本地源码开发 | `8097`（`config-local.toml`） | `3010`（`npm run dev`） | `config-local.toml`（`Debug = true`） |
| 开发环境 | `8089`（`config-dev.toml`） | — | `config-dev.toml` |
| Docker 单容器 | 容器内 `8080` | 映射端口，默认 `8097` | 环境变量 + `/app/runtime/config.toml` |
| 源码生产 | `8097`（`config.toml`） | 内嵌同源 | `config.toml` + 环境变量 |

配置文件通过环境变量 `CONFIG_FILE` 指定，默认加载 `config.toml`；生产密钥不提交仓库（见 `.gitignore`）。

## 更多文档

- 想 5 分钟跑起来 → [快速开始](/guide/quickstart) 或 [Docker 一键部署](/deployment/docker)
- 了解认证细节 → [认证体系](/backend/auth)
- 查看全部接口 → [API 总览](/backend/api-overview) 与 [API 集成指南](/backend/api-integration)
- 支付能力细节 → [X402 / SkillPay](/backend/x402)、[证书管理](/backend/certs)
- 环境变量 → [环境变量参考](/deployment/environment)
- 前端说明 → [前端概览](/frontend/overview)
