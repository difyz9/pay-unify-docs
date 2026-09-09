---
title: 系统概览
---

# 系统概览

Pay-Unify 是一个**企业级统一支付服务平台**，由两个独立仓库组成，本仓库（文档站）位于二者之上：

| 仓库 | 说明 | 主要技术 |
| --- | --- | --- |
| [`pay-unify-backend`](https://gitee.com/difyz/pay-unify-backend) | 统一支付后端服务 | Go 1.21+ / Gin / GORM / Uber-FX / Zap / Swagger |
| [`pay-unify-frontend`](https://gitee.com/difyz/pay-unify-frontend) | 支付服务管理后台 | Next.js 15 / React 19 / TypeScript / Tailwind 4 / Ant Design / Recharts |

## 定位

本项目聚焦「支付」本身，所有非支付相关模块均已移除，核心能力：

- **安全认证**：管理员 JWT + 商户 OAuth2 双认证体系（已移除旧版 GoAuth HMAC 签名）。
- **多支付渠道**：支付宝、微信支付、PayPal，以及 SkillHub X402（SkillPay）付费能力。
- **业务域**：订单、用户 / VIP 会员、商品（SKU）、项目、金币 等完整管理能力。
- **运行时配置**：支付渠道开关、参数、证书均由数据库管理并**热加载**，无需重启进程。
- **数据统计**：订单趋势、支付方式占比、渠道状态等实时可视化。

## 架构总览

```
                        ┌───────────────────────────────────────────┐
                        │            pay-unify-frontend             │
                        │   Next.js 15 管理后台 (默认 :3010)          │
                        │   仪表板 / 订单 / 支付 / 用户 / 商品 / 项目    │
                        │   金币 / 会员 / 支付设置 / X402 / API 应用    │
                        └──────────────────┬────────────────────────┘
                                           │  JWT (auth_token Cookie)
                                           │  OAuth2 Bearer (商户/第三方)
                        ┌──────────────────▼────────────────────────┐
                        │            pay-unify-backend              │
                        │   Go / Gin  (默认 :8089 或 :8097)          │
                        │                                            │
                        │  /api/v1/*   管理后台 API  (JWT)           │
                        │  /api/v2/*   商户/第三方 API (OAuth2 scope) │
                        │  /oauth/token 令牌颁发                       │
                        │  /swagger/*  Swagger UI                    │
                        │                                            │
                        │  渠道运行时: Alipay / WeChat Pay / PayPal   │
                        │  SkillHub X402 SkillPay / 会员令牌签发        │
                        │  证书管理(runtime/certs) + 企业微信通知        │
                        └──────────────────┬────────────────────────┘
                                           │ GORM
                        ┌──────────────────▼────────────────────────┐
                        │   MySQL (payment_db, utf8mb4)             │
                        │   tb_payment_order / tb_user / tb_product │
                        │   tb_payment_config / tb_payment_cert ...  │
                        └───────────────────────────────────────────┘
```

## 两套 API 平面（路由约定）

| 前缀 | 认证 | 使用者 | 典型路由 |
| --- | --- | --- | --- |
| `/api/v1/*` | 管理员 **JWT**（`auth_token` Cookie / Bearer） | 前端管理后台 | `/api/v1/orders`、`/api/v1/payment/pay`、`/api/v1/payment/config/*`、`/api/v1/certs/*` |
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
| 审计 | `tb_payment_audit` | `payment_audit` | 配置 / 证书操作审计日志 |

## 环境与端口约定

| 环境 | 后端端口 | 前端端口 | 后端配置 |
| --- | --- | --- | --- |
| 本地开发 | `8097` | `3010` | `config-local.toml`（`Debug = true`） |
| 开发环境 | `8089` | — | `config-dev.toml` |
| 生产环境 | `8089` | `3010`（Docker）/ Vercel | `config-prod.toml` / `config.toml` |

配置文件通过环境变量 `CONFIG_FILE` 指定，默认加载 `config.toml`；生产密钥不提交仓库（见 `.gitignore`）。

## 更多文档

- 想 5 分钟跑起来 → [快速开始](/guide/quickstart)
- 了解认证细节 → [认证体系](/backend/auth)
- 查看全部接口 → [API 总览](/backend/api-overview) 与 [API 集成指南](/backend/api-integration)
- 支付能力细节 → [X402 / SkillPay](/backend/x402)、[证书管理](/backend/certs)
- 前端说明 → [前端概览](/frontend/overview)
- 上线部署 → [部署](/deployment/backend)
