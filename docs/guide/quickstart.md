---
title: 快速开始
---

# 快速开始

提供两条路径：

- **只想先把服务跑起来看效果** → 直接看 [0. Docker 一键运行](#0-docker-一键运行推荐)，不需要 Go / Node 环境。
- **要参与源码开发** → 从 [2. 源码启动后端](#2-源码启动后端) 开始。

---

## 0. Docker 一键运行（推荐）

**单镜像、单容器、单端口**：前端已静态导出并由 Go 二进制内嵌，不需要 Nginx / Node / 两个容器。

```bash
# ① 下载编排文件（不需要克隆仓库）
curl -fsSLO https://raw.githubusercontent.com/difyz9/pay-unify/main/docker-compose.yml

# ② 启动
docker compose up -d
```

打开 **http://localhost:8097**，用 `admin` / `admin123` 登录（登录后请立即改密码）。

需要自定义端口 / 密码 / 版本时：

```bash
curl -fsSL https://raw.githubusercontent.com/difyz9/pay-unify/main/.env.example -o .env
vim .env            # PAY_UNIFY_PORT / PAY_ADMIN_PASSWORD / PAY_JWT_SECRET ...
docker compose up -d
```

完整说明（`docker run`、连接已有 MySQL、1Panel、数据卷与权限、FAQ）见
**[Docker 一键部署](/deployment/docker)**，环境变量见 **[环境变量参考](/deployment/environment)**。

---

## 1. 源码开发：环境要求

| 依赖 | 版本 | 用途 |
| --- | --- | --- |
| Go | 1.25（`go.mod` 声明；Docker 构建用 1.25-alpine） | 后端编译运行 |
| Node.js | 18+（Docker 用 20） | 前端与文档站 |
| MySQL | 8.0+ | 主存储（utf8mb4） |
| Git | — | 拉取代码 |

克隆单仓（后端 + 前端在同一仓库）：

```bash
git clone https://github.com/difyz9/pay-unify.git
cd pay-unify
```

准备数据库（后端启动时会自动建表 `AutoMigrate` 并写入种子数据）：

```sql
CREATE DATABASE payment_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

## 2. 源码启动后端

```bash
cd backend
cp config.toml.example config.toml   # 或直接改 config-local.toml 的 MysqlDns

go mod download
CONFIG_FILE=config-local.toml go run main.go
# 普通方式（默认读 ./config.toml）：go run main.go
```

### 启动后自动生成

- **管理员账号**：`admin` / `admin123`（首次启动自动创建，`IsVip = true`，**内置为管理员**）。
  > 安全说明：`/api/v1` 管理接口已做管理员鉴权（JWT 含 `isAdmin` 声明 + RequireAdmin 中间件），
  > 普通注册用户无法访问控制台接口；`admin123` 请上线前立即改密，生产建议关闭注册（`Auth.EnableRegister = false`）。
- **OAuth2 种子应用**（scope = `admin`，**仅 `Debug = true` 环境自动创建**，生产不会生成）：
  - `test-app-001` / `test-secret-key-12345678901234567890`
  - `local-test` / `local-test-secret-32-chars-here-ok`
- **健康检查**：`GET /health` → 200。

### 验证后端

```bash
curl http://localhost:8097/health
curl http://localhost:8097/health/db                 # {"db":"ok","status":"healthy"}
curl http://localhost:8097/api/v1/payment/channels   # 三渠道状态（公开）
# Swagger UI（含全部接口与请求示例）：http://localhost:8097/swagger/index.html
```

> 端口与配置文件 `Listen` 字段一致：`config-local.toml` 与 `config.toml` 为 `:8097`，
> `config.toml.example` 为 `:8080`，`config-dev.toml` 为 `:8089`。以实际使用的配置文件为准。

---

## 3. 源码启动前端

```bash
cd frontend
cp .env.example .env.local          # NEXT_PUBLIC_API_URL=http://localhost:8097
npm install
npm run dev                         # http://localhost:3010（Turbopack）
```

### 前端会话说明

- 登录页使用 `admin` / `admin123` 登录，成功后 token 写入 Cookie `auth_token`；
  前端 `apiClient` 拦截器自动把 Cookie 转成 `Authorization: Bearer` 头，**前端不持有任何接口密钥**。
- X402 演示页（`/dashboard/x402`）需要 OAuth2 凭证：
  `NEXT_PUBLIC_X402_CLIENT_ID=local-test`、`NEXT_PUBLIC_X402_CLIENT_SECRET=local-test-secret-32-chars-here-ok`
  （与后端种子应用一致，scope 需含 `skillpay:call`、`skillpay:refund`）。

---

## 4. 演示一个完整支付闭环（后端接口）

以商户视角走一遍 OAuth2 下单流程：

```bash
# 1) 换 Bearer token（使用 Debug 环境种子应用；生产请先在控制台创建 API 应用）
TOKEN=$(curl -s -X POST http://localhost:8097/oauth/token \
  -H "Content-Type: application/json" \
  -d '{"grant_type":"client_credentials","client_id":"test-app-001","client_secret":"test-secret-key-12345678901234567890"}' \
  | jq -r .access_token)

# 2) 创建支付订单（payWay: alipay / wechat / paypal）
curl -s -X POST http://localhost:8097/api/v2/payment/pay \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"subject":"演示商品","amount":0.01,"payWay":"alipay","userId":"user123"}'

# 3) 查询订单状态（outTradeNo 来自上一步响应）
curl -s http://localhost:8097/api/v2/payment/query/{outTradeNo} \
  -H "Authorization: Bearer $TOKEN"
```

> 首次部署的库里没有 API 应用时，`POST /oauth/token` 会报 `invalid_client`：
> 先登录控制台 →「API 应用管理」（走 `/api/v1/api-apps` 管理员会话）创建一个应用，
> 拿到 `client_id` / `client_secret`（密钥仅创建时展示一次）再调用。

---

## 5. 目录结构速览

```
pay-unify/                          # 单仓：后端 + 前端
├── backend/                        # Go 后端（同时内嵌前端产物）
│   ├── main.go                     # FX 应用入口 / 依赖装配
│   ├── config*.toml                # 各环境配置 + config.toml.example
│   ├── Dockerfile                  # 仅 API 镜像（可选）
│   ├── internal/
│   │   ├── core/                   # AppServer、配置加载、内嵌 WebUI、env_config
│   │   ├── handler/                # HTTP 控制器（按业务域）
│   │   ├── middleware/             # JWT / OAuth2 Bearer 中间件
│   │   └── pkg/                    # model / service / store / utils / channel
│   └── docs/                       # Swagger 产物（docs.go / swagger.json / swagger.yaml）
├── frontend/                       # Next.js 控制台
│   ├── src/app/                    # App Router 页面（单容器导出时由 Go 内嵌）
│   ├── src/features/               # 业务域服务层与类型
│   ├── src/core/                   # apiClient、AuthContext 等
│   └── Dockerfile                  # standalone 镜像（独立部署用）
├── deploy/                         # 1Panel 应用包 / 镜像构建脚本
├── docs/                           # Docker Hub 介绍 / 1Panel 方案
├── Dockerfile                      # 单镜像三阶段构建（推荐）
└── docker-compose.yml              # 一键启动编排
```

---

## 下一步

- 部署上线 → [Docker 一键部署](/deployment/docker) 或 [后端部署](/deployment/backend)
- 环境变量 → [环境变量参考](/deployment/environment)
- 后台各模块说明 → [前端概览](/frontend/overview)
- 双认证细节与 scope 表 → [认证体系](/backend/auth)
- 支付渠道需要真实证书？→ [证书管理](/backend/certs) 与[配置说明](/backend/config)
- 想接入 X402 收费 Skill → [X402 / SkillPay](/backend/x402)
