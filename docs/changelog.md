> **本文档来源**：pay-unify-backend 仓库的 `docs/CHANGELOG.md`（保持与源码同步的权威版本）。
> 修改时请先更新仓库内原文件，再同步本页。

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-22

### Added

#### 后端功能
- 🔐 基于 AppId/AppSecret 的签名认证机制
- 💳 支付宝（Alipay）支付集成
- 💳 微信支付（WeChat Pay）集成
- 💳 PayPal 国际支付集成
- 📊 完整的订单管理系统
  - 订单创建、查询、统计
  - 订单状态跟踪
  - 订单趋势分析
- 👥 用户管理系统
  - 用户信息管理
  - VIP 会员系统
  - 金币余额管理
  - 用户状态控制
- 🛍️ 商品管理系统
  - 商品 SKU 管理
  - 价格配置
  - 商品状态控制
  - 销售统计
- 💰 金币系统
  - 充值配置
  - 消费记录
  - 统计分析
  - 趋势图表
- 🔒 安全机制
  - HMAC-SHA256 签名算法
  - 时间戳防重放攻击
  - IP 白名单控制
  - API 访问频率限制
- 📝 完善的日志记录
- 📚 Swagger API 文档

#### 前端功能
- 🎨 现代化的管理后台界面
- 📊 数据可视化仪表盘
- 📋 订单管理页面
  - 订单列表和搜索
  - 订单详情查看
  - 订单统计图表
- 👥 用户管理页面
  - 用户列表和搜索
  - 用户详情编辑
  - VIP 管理
  - 金币调整
- 🛍️ 商品管理页面
  - 商品列表和搜索
  - 商品创建和编辑
  - 商品状态管理
- 💰 金币管理页面
  - 金币记录列表
  - 充值统计
  - 消费趋势图表
- 📱 响应式设计，支持移动端
- 🎯 友好的用户交互体验

#### 技术特性
- 📦 基于 Go 1.21+ 和 Gin 框架
- 🗄️ GORM ORM 框架
- 💉 Uber FX 依赖注入
- 📊 Zap 日志框架
- ⚛️ Next.js 14 + React 18 前端
- 📘 TypeScript 类型安全
- 🎨 Tailwind CSS + Ant Design
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
- [ ] 添加退款功能
- [ ] 添加订单导出功能
- [ ] 添加数据分析报表
- [ ] 支持多语言国际化
- [ ] 添加单元测试
- [ ] 添加集成测试
- [ ] 性能优化
- [ ] 缓存机制

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

[1.0.0]: https://github.com/difyz9/pay-unify/releases/tag/v1.0.0
[Unreleased]: https://github.com/difyz9/pay-unify/compare/v1.0.0...HEAD
