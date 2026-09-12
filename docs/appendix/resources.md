---
title: 相关资源
---

# 相关资源

## 代码仓库与在线站点

| 资源 | 地址 | 说明 |
| --- | --- | --- |
| pay-unify（单仓） | <https://github.com/difyz9/pay-unify> | Go 后端（`backend/`）+ Next.js 控制台（`frontend/`）+ 部署（`deploy/`） |
| 本文档站源码 | <https://github.com/difyz9/pay-unify-docs> | Rspress 聚合文档（发布到 Vercel） |
| 在线文档 | <https://pay-unify-docs-one.vercel.app> | 本站生产地址 |
| Docker 镜像 | <https://hub.docker.com/r/difyz9/pay-unify> | `difyz9/pay-unify:2.0.1`（多架构，≈57 MB） |

## 在线接口文档

后端启动后：

- Swagger UI：`http://<host>:<port>/swagger/index.html`
- OpenAPI JSON：`http://<host>:<port>/swagger/doc.json`
- 仓库内离线定义：`backend/docs/swagger.yaml` / `swagger.json` / `docs.go`

## 仓库内相关文档

单仓内随代码维护的资料：

| 文件 | 说明 |
| --- | --- |
| `README.md` | 项目总说明（功能、Docker 一键运行、API、部署） |
| `docs/dockerhub-overview.md` | Docker Hub 仓库 Overview 内容源（容器部署指南） |
| `docs/1panel-packaging-plan.md` | 1Panel 应用包打包方案 |
| `deploy/1panel/README.md` | 1Panel 本地应用安装说明 |
| `backend/README.md` | 后端说明 |
| `frontend/README.md` | 前端说明（含前后端接口对齐表） |
| `frontend/code-review-report.md` | 前端代码审查报告 |

### 本站页面的权威来源

`docs/backend/`、`docs/frontend/performance.md`、`docs/changelog.md` 等页面的内容
**已并入本站直接维护**（原后端仓库 `backend/docs/*.md`、前端 `docs/*.md` 在重构为单仓时不再随仓库发布）。
涉及实现细节时，以 [pay-unify 仓库](https://github.com/difyz9/pay-unify) 源码为准：

| 本站页面 | 权威源码位置 |
| --- | --- |
| [认证体系](/backend/auth) | `backend/internal/middleware/`、`backend/internal/handler/login_handler.go`、`oauth_handler.go` |
| [配置说明](/backend/config) | `backend/config.toml.example`、`backend/internal/core/env_config.go` |
| [API 总览](/backend/api-overview) | `backend/internal/handler/*.go` 的 `RegisterRoutes`、`backend/docs/swagger.*` |
| [统一支付接口](/backend/unified-payment) | `backend/internal/handler/payment_handler.go` |
| [PayPal 集成](/backend/paypal) | `backend/internal/pkg/service/payment/paypal_service.go` |
| [X402 / SkillPay](/backend/x402) | `backend/internal/pkg/service/payment/skillhub_service.go`、`skillpay_handler.go` |
| [证书管理](/backend/certs) | `backend/internal/handler/payment_cert_handler.go`、`backend/internal/pkg/channel/spec.go` |
| [企业微信通知](/backend/work-wechat) | `backend/internal/pkg/service/wecom_notification_service.go` |
| [前端性能指南](/frontend/performance) | `frontend/` |

## 外部依赖

- [Gin](https://github.com/gin-gonic/gin) · [GORM](https://gorm.io/) · [Uber FX](https://github.com/uber-go/fx) · [Zap](https://github.com/uber-go/zap)
- [Next.js](https://nextjs.org/) · [Ant Design](https://ant.design/) · [Tailwind CSS](https://tailwindcss.com/) · [Recharts](https://recharts.org/)
- 支付平台：[支付宝开放平台](https://open.alipay.com/) · [微信支付商户平台](https://pay.weixin.qq.com/) · [PayPal Developer](https://developer.paypal.com/) · SkillHub
- 交付：[Docker Hub](https://hub.docker.com/r/difyz9/pay-unify) · [1Panel](https://1panel.cn/)

## 许可

本项目使用 MIT License，详见仓库 `backend/LICENSE`（Copyright © 2025 difyz9）。
