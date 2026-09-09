---
title: 相关资源
---

# 相关资源

## 代码仓库

| 仓库 | 地址 | 说明 |
| --- | --- | --- |
| pay-unify-backend | <https://gitee.com/difyz/pay-unify-backend> | 统一支付后端（Go / Gin） |
| pay-unify-frontend | <https://gitee.com/difyz/pay-unify-frontend> | 支付管理后台（Next.js） |
| 本文档站 | 位于父目录 `my_pay/docs/` | Rspress 构建的聚合文档 |

## 在线接口文档

后端启动后：

- Swagger UI：`http://<host>:<port>/swagger/index.html`
- OpenAPI JSON：`http://<host>:<port>/swagger/doc.json`
- 仓库内的离线定义：`pay-unify-backend/docs/swagger.yaml` / `swagger.json` / `docs.go`

## 仓库原生文档（本网站页面的同步来源）

### pay-unify-backend/docs/

| 文件 | 对应本站页面 |
| --- | --- |
| `AUTHENTICATION.md` | [认证体系](/backend/auth) |
| `CONFIG_GUIDE.md` | [配置说明](/backend/config) |
| `API_INTEGRATION_GUIDE.md` | [API 集成指南](/backend/api-integration) |
| `UNIFIED_PAYMENT_API.md` | [统一支付接口](/backend/unified-payment) |
| `PAYPAL_INTEGRATION.md` | [PayPal 集成](/backend/paypal) |
| `X402_INTEGRATION_GUIDE.md` | [X402 / SkillPay](/backend/x402) |
| `CERT_MANAGEMENT_GUIDE.md` | [证书管理](/backend/certs) |
| `WORK_WECHAT_NOTIFICATION_GUIDE.md` | [企业微信通知](/backend/work-wechat) |
| `CHANGELOG.md` | [更新日志](/changelog) |

### pay-unify-frontend/docs/

| 文件 | 对应本站页面 |
| --- | --- |
| `deployment/VERCEL_DEPLOY_GUIDE.md`、`DOCKER_DEPLOYMENT_GUIDE.md` | [前端部署](/deployment/frontend) |
| `FRONTEND_PERFORMANCE_GUIDE.md` | [前端性能指南](/frontend/performance) |

## 外部依赖

- [Gin](https://github.com/gin-gonic/gin) · [GORM](https://gorm.io/) · [Uber FX](https://github.com/uber-go/fx) · [Zap](https://github.com/uber-go/zap)
- [Next.js](https://nextjs.org/) · [Ant Design](https://ant.design/) · [Tailwind CSS](https://tailwindcss.com/) · [Recharts](https://recharts.org/)
- 支付平台：支付宝开放平台 · 微信支付商户平台 · PayPal Developer · SkillHub

## 许可

- 后端仓库：Apache-2.0（swag 注解声明）/ MIT（README 徽标）——以仓库内 LICENSE 为准。
- 前端仓库：见 `pay-unify-frontend` 内 LICENSE 说明。
