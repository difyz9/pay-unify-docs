---
title: 环境变量参考
---

# 环境变量参考

Pay-Unify 支持**纯环境变量**启动：优先级为 **环境变量 > `config.toml` > 内置默认值**，
不写任何环境变量也能用（走镜像内置的 `config.toml.example` 兜底）。

实现见 `backend/internal/core/env_config.go`。

---

## 服务

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PAY_LISTEN` | `:8097`（镜像内置 `:8080`） | 监听地址。容器内固定 `8080`，对外端口用 `-p` 映射 |
| `CONFIG_FILE` | `/app/config.toml` | 配置文件路径；不存在则按环境变量/默认值自动生成 |
| `PAY_CERT_DIR` | `/app/runtime/certs` | 支付渠道证书落盘目录，**需持久化** |
| `PAY_DEBUG` | `false` | 调试模式；开启后才会创建测试 API 应用（种子应用） |
| `TZ` | `Asia/Shanghai` | 时区 |

## 安全 / 初始账号

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PAY_JWT_SECRET` | 随机生成 | 控制台会话签名密钥，**生产必须显式设置**（`openssl rand -hex 32`）；< 16 字节拒绝启动，< 32 字节告警 |
| `PAY_ADMIN_USERNAME` | `admin` | 初始管理员用户名（**仅首次建库生效**） |
| `PAY_ADMIN_PASSWORD` | `admin123` | 初始管理员密码（**仅首次建库生效**）；留空会打警告日志，请务必设置 |

> 账号只在首次建库（该用户名不存在）时创建。库已存在时改这两个变量**不会**改密码。

## 数据库

### 方式一：1Panel 风格变量（推荐，自动拼 DSN）

| 变量 | 说明 |
| --- | --- |
| `PANEL_DB_TYPE` | `mysql`（默认）/ `postgresql` / `mariadb` |
| `PANEL_DB_HOST` | 数据库主机；**设置此项即启用该模式** |
| `PANEL_DB_PORT` | 端口，缺省按驱动取 3306 / 5432 |
| `PANEL_DB_NAME` | 库名，如 `payment_db` |
| `PANEL_DB_USER` | 用户名 |
| `PANEL_DB_USER_PASSWORD` | 密码 |

### 方式二：直接给连接串

| 变量 | 说明 |
| --- | --- |
| `PAY_DB_DRIVER` | `mysql` / `postgres` |
| `PAY_MYSQL_DNS` | 完整 MySQL DSN |
| `PAY_POSTGRES_DSN` | 完整 PostgreSQL DSN |

> 表结构由服务启动时自动 `AutoMigrate`，只需提前建好**空库**（utf8mb4）。

---

## Compose / 1Panel 专有变量

以下变量用于仓库根 `docker-compose.yml` 与 1Panel 应用包，不是应用本身读取的：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PAY_UNIFY_PORT` | `8097` | Compose 对外映射端口 |
| `PAY_UNIFY_VERSION` | `2.0.1` | 拉取的镜像版本 tag |
| `MYSQL_ROOT_PASSWORD` | `payunify_root` | Compose 内置 MySQL root 密码 |
| `MYSQL_PASSWORD` | `payunify_pass` | Compose 内置 MySQL 业务账号密码 |

---

## 前端（源码 / 独立部署时）

前端（`frontend/`）通过构建期变量注入，**不是**后端运行时变量：

| 变量 | 场景 | 说明 |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | 前后端分离部署 | 独立后端 origin，如 `http://localhost:8097`；单容器同源部署留空 |
| `NEXT_PUBLIC_X402_CLIENT_ID` / `_SECRET` | X402 演示页 | OAuth2 client 凭证（可选） |
| `NEXT_OUTPUT` | 构建模式 | `export` 时静态导出（供 Go `//go:embed` 单二进制使用），否则 `standalone` |

> ⚠️ `NEXT_PUBLIC_*` 是**构建期**内联变量：改运行时容器 env 不生效，必须在 `npm run build` 前注入。
> 单容器镜像刻意**不注入** `NEXT_PUBLIC_API_URL`，产物使用相对路径，因此同一镜像可适配任意域名/端口。

---

## 冒烟验证

```bash
# 存活 + 数据库就绪
curl -s http://localhost:8097/health/db
# → {"db":"ok","status":"healthy"}

# 三渠道状态（公开）
curl -s http://localhost:8097/api/v1/payment/channels

# 服务信息
curl -s http://localhost:8097/api/v1/info
```

---

## 相关文档

- [Docker 一键部署](/deployment/docker)
- [配置说明](/backend/config)（`config.toml` 分节详解）
- [后端部署](/deployment/backend)
