---
title: 快速开始
---

# 快速开始

以下步骤可在本地（或一台开发机）把**后端 + 前端**完整跑起来。

## 0. 环境要求

| 依赖 | 版本 | 用途 |
| --- | --- | --- |
| Go | 1.21+ | 后端编译运行 |
| Node.js | 18+ | 前端与文档站 |
| MySQL | 8.0+ | 主存储（utf8mb4） |
| Git | — | 拉取代码 |

## 1. 准备数据库

```sql
CREATE DATABASE payment_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

后端启动时会自动建表（GORM AutoMigrate）并写入默认种子数据，无需手工执行 DDL。

## 2. 启动后端（pay-unify-backend）

```bash
git clone https://gitee.com/difyz/pay-unify-backend.git
cd pay-unify-backend

# 1) 准备配置：本地开发可直接使用自带的 config-local.toml
cp config.toml.example config.toml   # 或修改 config-local.toml 的 MysqlDns

# 2) 安装依赖并运行
go mod download
CONFIG_FILE=config-local.toml go run main.go
# 生产 / 普通方式： go run main.go   （默认读 config.toml）
```

### 启动后自动生成

- **管理员账号**：`admin` / `admin123`（首次启动自动创建，`IsVip = true`，**内置为管理员**）。
  > 安全说明：/api/v1 管理接口已做管理员鉴权（JWT 含 `isAdmin` 声明 + RequireAdmin 中间件），普通注册用户无法访问控制台接口；`admin123` 请上线前立即改密，生产建议关闭注册（`Auth.EnableRegister = false`）。
- **OAuth2 种子应用**（scope = `admin`，**仅 `Debug = true` 环境自动创建**，生产不会生成）：
  - `test-app-001` / `test-secret-key-12345678901234567890`
  - `local-test` / `local-test-secret-32-chars-here-ok`
- **健康检查**：`GET /health` → 200。

### 验证后端

```bash
curl http://localhost:8097/health
curl http://localhost:8097/api/v1/payment/channels   # 三渠道状态（公开）
# Swagger UI（含全部接口与请求示例）
# http://localhost:8097/swagger/index.html
```

> 端口与 `Listen` 字段一致：`config-local.toml` 为 `:8097`，`config.toml` 示例为 `:8080`，
> dev/prod 常用 `:8089`。以你实际使用的配置文件为准。

## 3. 启动前端（pay-unify-frontend）

```bash
git clone https://gitee.com/difyz/pay-unify-frontend.git
cd pay-unify-frontend

# 1) 配置后端网关地址
cp .env.example .env.local
# .env.local 中 NEXT_PUBLIC_API_URL=http://localhost:8097 （指向步骤 2 的后端）

# 2) 安装依赖并启动
npm install
npm run dev
# 访问 http://localhost:3010
```

### 前端会话说明

- 登录页使用 `admin` / `admin123` 登录，成功后 token 写入 Cookie `auth_token`；
  前端 `apiClient` 拦截器自动把 Cookie 转成 `Authorization: Bearer` 头，**前端不持有任何接口密钥**。
- X402 演示页（`/dashboard/x402`）需要 OAuth2 凭证：
  `NEXT_PUBLIC_X402_CLIENT_ID=local-test`、`NEXT_PUBLIC_X402_CLIENT_SECRET=local-test-secret-32-chars-here-ok`
  （与后端种子应用一致，scope 需含 `skillpay:call`、`skillpay:refund`）。

## 4. 演示一个完整支付闭环（后端接口）

以商户视角走一遍 OAuth2 下单流程：

```bash
# 1) 换 Bearer token（使用种子应用）
TOKEN=$(curl -s -X POST http://localhost:8097/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=test-app-001&client_secret=test-secret-key-12345678901234567890&grant_type=client_credentials" \
  | jq -r .access_token)

# 2) 创建支付订单（payWay: alipay / wechat / paypal）
curl -s -X POST http://localhost:8097/api/v2/payment/pay \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"subject":"演示商品","amount":0.01,"payWay":"alipay","userId":"user123"}'

# 3) 查询订单状态（orderNo 来自上一步响应）
curl -s http://localhost:8097/api/v2/payment/query/{orderNo} \
  -H "Authorization: Bearer $TOKEN"
```

## 5. 目录结构速览

```
my_pay/
├── docs/                     # 本文档站（Rspress）👈
├── pay-unify-backend/        # 后端仓库
│   ├── main.go               # fx 应用入口 / 依赖装配
│   ├── config*.toml          # 各环境配置
│   ├── internal/
│   │   ├── core/             # AppServer、配置加载、类型
│   │   ├── handler/          # HTTP 控制器（按业务域）
│   │   ├── middleware/       # JWT / OAuth2 Bearer 中间件
│   │   └── pkg/              # model / service / store / utils / channel
│   ├── docs/                 # 后端仓库原生文档（本网站多数页面由它们同步而来）
│   └── examples/             # Python / Go / Node SDK 示例
└── pay-unify-frontend/       # 前端仓库
    ├── src/app/              # App Router 页面
    ├── src/features/         # 业务域服务层与类型
    ├── src/core/             # apiClient、AuthContext 等
    └── docs/                 # 前端部署 / 性能文档
```

## 下一步

- 后台各模块说明 → [前端概览](/frontend/overview)
- 双认证细节与 scope 表 → [认证体系](/backend/auth)
- 支付渠道需要真实证书？→ [证书管理](/backend/certs) 与[配置说明](/backend/config)
- 想接入 X402 收费 Skill → [X402 / SkillPay](/backend/x402)
