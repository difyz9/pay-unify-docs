> **维护说明**：本文档已并入本站直接维护（单仓重构后原 `backend/docs/*.md`、前端 `docs/*.md` 不再随仓库发布）。
> 实现细节以 [pay-unify 源码](https://github.com/difyz9/pay-unify) 为准，页面与源码的对应关系见[相关资源](/appendix/resources)。

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1] - 2026-09-12

### Added
- 🐳 仓库根 `docker-compose.yml`：一键启动（单镜像 + 内置 MySQL + 命名卷 + `service_healthy` 依赖）。
- 📄 `docs/dockerhub-overview.md`：Docker Hub 仓库 Overview 内容源。
- ☝️ 1Panel 应用包：`deploy/1panel/`（表单化一键安装，面板托管数据库 + 自动生成密钥）。

### Fixed
- 解除 API 应用引导死锁：控制台改用 `/api/v1/api-apps` 管理员 JWT 会话，`requireSign` 可置 `false`；
  非 Debug 部署也能创建第一个 API 应用。
- Docker healthcheck 改用 `GET /health/db`（`wget -O /dev/null`），修复 `--spider` 发 HEAD 导致 404 误报 unhealthy。
- `PAY_JWT_SECRET` 留空时由应用用 `crypto/rand` 生成并持久化到数据卷，避免使用公开占位密钥。
- `.gitignore` 的 `pay-unify` 规则锚定到仓库根；停止跟踪运行时数据与 macOS 元数据。

## [2.0.0] - 2026-09-12

### Added
- 🐳 **单容器交付**：前端静态导出（`NEXT_OUTPUT=export`）后由 Go `//go:embed all:web` 内嵌，
  单镜像 / 单容器 / 单端口（≈57 MB，`linux/amd64` + `linux/arm64`），不再需要 Nginx / Node。
- 🏗️ 单仓重构：`backend/`（Go）+ `frontend/`（Next.js）合并到一个仓库，根 `Dockerfile` 三阶段构建。
- 🔐 **OAuth2 Client Credentials 开放平台**：`POST /oauth/token` 换 Bearer，20+ 细粒度 scope、
  `admin` 超管、`/oauth/revoke` 吊销、`tb_oauth_deny` 吊销列表、IP 白名单与限流。
- 🧾 **API 应用管理**：`client_id` / `client_secret`（bcrypt 存储，仅创建 / 轮换时展示一次），
  支持启停、删除、scope 编辑。
- 💳 **渠道热配置**：支付宝 / 微信渠道开关与参数存 `tb_payment_config`，控制台保存即热加载，无需重启。
- 🔑 **证书全生命周期管理**：控制台按渠道证书位上传 / 设默认 / 下载 / 删除，自动落盘 `runtime/certs/`
  并回写配置路径、热加载；敏感字段（如 APIv3Key）不回显。
- 🧠 **SkillHub X402 / SkillPay**：402 支付码 → 微信扫码 → 服务端幂等履约、查询与退款。
- 🎟️ **会员令牌**：Ed25519 非对称签名（兼容 HMAC 回退），`issue` / `verify` 接口。
- 🧰 **环境变量化配置**（`PAY_*` / `PANEL_DB_*`，优先级：环境变量 > `config.toml` > 默认值）。
- 📊 **可观测性**：`/health`（存活）、`/health/db`（就绪）、`/metrics`（Prometheus 文本）、
  结构化访问日志（请求 ID / 耗时 / IP，不落敏感 body）。
- ⏱️ **过期订单自动关闭**：`OrderScheduler` 每 5 分钟扫描，关闭 15 分钟前未支付订单。
- 🛡️ 前端安全响应头：CSP / HSTS / X-Frame-Options 等（静态导出时由 Go 中间件下发）。
- 🧾 支付配置 / 证书操作**审计日志** `tb_payment_audit`（操作人、IP、before/after）。

### Changed
- 🔁 认证体系迁移：**移除旧版 GoAuth HMAC（`X-App-Id / X-Timestamp / X-Sign`）**，
  控制台统一走管理员 JWT 会话（HttpOnly Cookie + CSRF 双重提交），商户走 OAuth2 Bearer。
- 🧭 前端 API 基地址**同源优先**（`baseUrl.ts`）：单容器部署走相对路径，移除旧 `/api/proxy` 跨源补丁。
- 🎨 前端升级：Next.js 15 / React 19 / Tailwind CSS 4 / Ant Design 6 / Recharts 3。
- 🧱 后端升级：Go 1.25、`go-pay/gopay`、`ArtisanCloud/PowerWeChat/v3`。

### Removed
- 🗑️ 非支付相关模块；旧签名认证中间件与过期示例。

## [1.0.0] - 2025-01-22

### Added

#### 后端功能
- 🔐 基于 AppId/AppSecret 的签名认证机制
- 💳 支付宝（Alipay）支付集成
- 💳 微信支付（WeChat Pay）集成
- 💳 PayPal 国际支付集成
- 📊 完整的订单管理系统（创建、查询、统计、状态跟踪、趋势分析）
- 👥 用户管理系统（信息、VIP 会员、金币余额、状态控制）
- 🛍️ 商品管理系统（SKU、价格、状态、销售统计）
- 💰 金币系统（充值配置、消费记录、统计、趋势图表）
- 🔒 安全机制（HMAC-SHA256、时间戳防重放、IP 白名单、API 频率限制）
- 📝 完善的日志记录
- 📚 Swagger API 文档

#### 前端功能
- 🎨 现代化管理后台界面 + 数据可视化仪表盘
- 📋 订单 / 用户 / 商品 / 金币管理页面
- 📱 响应式设计，支持移动端
- 🎯 友好的用户交互体验

#### 技术特性
- 📦 Go 1.21+ 与 Gin 框架、GORM、Uber FX、Zap
- ⚛️ Next.js 14 + React 18 前端、TypeScript、Tailwind CSS + Ant Design
- 📈 Recharts 数据可视化
- 🐳 Docker 和 Docker Compose 支持

### Security
- Implemented HMAC-SHA256 signature authentication
- Added timestamp validation to prevent replay attacks
- Added IP whitelist support
- Added API rate limiting

## [Unreleased]

### Planned
- [ ] 支持更多支付方式（Stripe、Apple Pay 等）
- [ ] 数据分析报表增强
- [ ] 多语言国际化
- [ ] 更多单元 / 集成测试与性能优化

---

## 版本说明

### 版本号格式

采用语义化版本号：`MAJOR.MINOR.PATCH`

- **MAJOR**: 不兼容的 API 修改
- **MINOR**: 向下兼容的功能性新增
- **PATCH**: 向下兼容的问题修正

### 标签说明

- `Added`: 新增功能
- `Changed`: 功能变更
- `Deprecated`: 即将废弃的功能
- `Removed`: 已移除的功能
- `Fixed`: 问题修复
- `Security`: 安全性改进

---

[2.0.1]: https://github.com/difyz9/pay-unify/releases/tag/v2.0.1
[2.0.0]: https://github.com/difyz9/pay-unify/releases/tag/v2.0.0
[1.0.0]: https://github.com/difyz9/pay-unify/releases/tag/v1.0.0
[Unreleased]: https://github.com/difyz9/pay-unify/compare/v2.0.1...HEAD
