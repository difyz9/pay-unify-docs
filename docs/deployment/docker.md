---
title: Docker 一键部署
---

# Docker 一键部署（推荐）

Pay-Unify 的推荐部署形态是**单个镜像、单个容器、单个端口**：

- 前端（Next.js）在构建期静态导出，由 Go 二进制通过 `//go:embed all:web` 内嵌；
- 运行时**不需要 Nginx**、**不需要 Node**、**不需要前后端两个容器**；
- 一个容器同时提供管理控制台（HTML）与 API，日志、健康检查、数据卷都只有一份。

| 项 | 值 |
| --- | --- |
| 镜像 | `difyz9/pay-unify:2.0.1`（多架构：`linux/amd64` + `linux/arm64`，≈57 MB） |
| Docker Hub | <https://hub.docker.com/r/difyz9/pay-unify> |
| 容器端口 | `8080`（内部固定），对外映射任意端口 |
| 必须持久化 | 命名卷 `pay-unify-data` → `/app/runtime`、`pay-unify-logs` → `/app/logs` |
| 运行用户 | 非 root（uid/gid `1000`） |
| 健康检查 | `GET /health/db` → `{"db":"ok","status":"healthy"}` |
| 初始账号 | `admin` / `admin123`（仅首次建库生效，登录后请立即改密） |

---

## 方式 A：Docker Compose（推荐）

不需要克隆仓库，两条命令即可：

```bash
# ① 下载编排文件
curl -fsSLO https://raw.githubusercontent.com/difyz9/pay-unify/main/docker-compose.yml

# ② 启动（首次会拉取镜像 + 初始化 MySQL）
docker compose up -d
```

打开 **http://localhost:8097**，用 `admin` / `admin123` 登录。

编排已经处理好了三个最容易踩的坑：

| 坑 | 编排里的做法 |
| --- | --- |
| JWT 密钥不能给默认值（否则任何人可伪造管理员 token） | `CONFIG_FILE` 指向数据卷，首次启动由应用用 `crypto/rand` 生成 64 字符密钥并落盘，**重建容器后登录态仍有效** |
| 数据卷属主不对，非 root 容器写不了证书 | 使用**命名卷**而非 bind mount：镜像内 `/app/runtime` 属主已是 uid 1000，Docker 初始化命名卷时继承该属主 |
| 服务先于数据库启动会直接退出 | `depends_on: mysql: condition: service_healthy`，等 MySQL 就绪后再启动 |

### 自定义端口 / 密码 / 版本

```bash
curl -fsSL https://raw.githubusercontent.com/difyz9/pay-unify/main/.env.example -o .env
vim .env            # 改 PAY_UNIFY_PORT / PAY_ADMIN_PASSWORD / PAY_JWT_SECRET / PAY_UNIFY_VERSION
docker compose up -d
```

可覆盖的变量（完整清单见[环境变量参考](/deployment/environment)）：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PAY_UNIFY_PORT` | `8097` | 对外映射端口（容器内固定 `8080`） |
| `PAY_UNIFY_VERSION` | `2.0.1` | 镜像版本，生产建议锁定具体版本 |
| `PAY_ADMIN_USERNAME` / `PAY_ADMIN_PASSWORD` | `admin` / `admin123` | 初始管理员（仅首次建库生效） |
| `PAY_JWT_SECRET` | 留空自动生成 | 留空则首次启动随机生成并持久化 |
| `MYSQL_ROOT_PASSWORD` / `MYSQL_PASSWORD` | `payunify_root` / `payunify_pass` | 内置 MySQL 的密码 |

### 常用运维

```bash
docker compose logs -f pay-unify               # 看日志
docker compose pull && docker compose up -d    # 升级镜像
docker compose down                            # 停止（保留数据）
docker compose down -v                         # 停止并删除数据卷（含数据库与证书！）
```

---

## 方式 B：两条 `docker run` 命令

不想用 Compose 时手工起，自带 MySQL：

```bash
# ① 数据库
docker run -d --name pay-unify-mysql \
  --restart unless-stopped \
  -e MYSQL_ROOT_PASSWORD=payunify_root \
  -e MYSQL_DATABASE=payment_db \
  -e MYSQL_USER=payment_db \
  -e MYSQL_PASSWORD=payunify_pass \
  mysql:8.0 --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci

# ② Pay-Unify
docker run -d --name pay-unify \
  --restart unless-stopped \
  --link pay-unify-mysql:mysql \
  -p 8097:8080 \
  -e CONFIG_FILE=/app/runtime/config.toml \
  -e PANEL_DB_TYPE=mysql -e PANEL_DB_HOST=mysql -e PANEL_DB_PORT=3306 \
  -e PANEL_DB_NAME=payment_db -e PANEL_DB_USER=payment_db -e PANEL_DB_USER_PASSWORD=payunify_pass \
  -e PAY_ADMIN_PASSWORD='ChangeMe123!' \
  -e PAY_CERT_DIR=/app/runtime/certs \
  -v pay-unify-data:/app/runtime \
  -v pay-unify-logs:/app/logs \
  difyz9/pay-unify:2.0.1
```

> ⚠️ **两处 `--restart unless-stopped` 不要省。** 服务启动时会立即校验数据库连通性，
> 连不上就 `exit 1` 且**不重试**。连敲上述两条命令时 MySQL 往往还在初始化，
> 没有重启策略会得到一个已退出的容器；有它则 Docker 自动重试到 MySQL 就绪。
>
> `CONFIG_FILE` 指向数据卷是刻意的：镜像自带的 `/app/config.toml` 里是**公开占位密钥**
> `replace-with-openssl-rand-hex-32-jwt-secret`，直接用它等于 JWT 签名密钥公开；
> 指向卷内可让应用首次启动时自生成随机密钥。

---

## 方式 C：连接已有 MySQL

```bash
docker run -d --name pay-unify \
  --restart unless-stopped \
  -p 8097:8080 \
  -e PANEL_DB_TYPE=mysql \
  -e PANEL_DB_HOST=192.168.1.10 \
  -e PANEL_DB_PORT=3306 \
  -e PANEL_DB_NAME=payment_db \
  -e PANEL_DB_USER=payunify \
  -e PANEL_DB_USER_PASSWORD='your-db-password' \
  -e PAY_JWT_SECRET="$(openssl rand -hex 32)" \
  -e PAY_ADMIN_PASSWORD='ChangeMe123!' \
  -e PAY_CERT_DIR=/app/runtime/certs \
  -v pay-unify-data:/app/runtime \
  -v pay-unify-logs:/app/logs \
  difyz9/pay-unify:2.0.1
```

只需提前建好**空库**，表结构由服务启动时自动 `AutoMigrate`：

```sql
CREATE DATABASE payment_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

> **macOS / Windows** 连宿主机 MySQL 用 `-e PANEL_DB_HOST=host.docker.internal`；
> **Linux** 需加 `--add-host=host.docker.internal:host-gateway`。

---

## 方式 D：1Panel 应用商店

镜像已适配 1Panel 应用包格式，支持**表单化一键安装**（面板托管数据库、自动生成密钥）。
应用包位于源码仓库 `deploy/1panel/`，安装选项包括数据库服务、库名、JWT 密钥、管理员密码与端口。

```bash
# 在 1Panel 主机上执行（把本地应用注册进面板）
bash deploy/scripts/install-to-1panel.sh
# 随后到「应用商店 → 本地应用」安装 Pay-Unify
```

详见仓库内 `deploy/1panel/README.md`。

---

## 环境变量与端口

完整参考见[环境变量参考](/deployment/environment)。核心约定：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PAY_LISTEN` | `:8080`（镜像内置） | 容器内监听地址，一般不改，改对外端口用 `-p` |
| `CONFIG_FILE` | `/app/config.toml` | 配置文件路径，不存在则自动生成 |
| `PAY_CERT_DIR` | `/app/runtime/certs` | 支付渠道证书落盘目录，**需持久化** |
| `PAY_JWT_SECRET` | 随机生成 | 会话签名密钥，生产建议显式设置（`openssl rand -hex 32`），< 16 字节拒绝启动 |
| `PAY_DEBUG` | `false` | 调试模式；开启后才创建测试 API 应用 |
| `TZ` | `Asia/Shanghai` | 时区 |

数据库既支持 1Panel 风格的 `PANEL_DB_*`（自动拼 DSN），也支持直接给 `PAY_DB_DRIVER` +
`PAY_MYSQL_DNS` / `PAY_POSTGRES_DSN`。

---

## 数据卷与权限

| 卷 | 用途 |
| --- | --- |
| `/app/runtime` | **必须持久化**。`CONFIG_FILE` 指向此处时，同时存放自动生成的 `config.toml`（含 JWT 密钥）与 `certs/` 支付证书 |
| `/app/runtime/certs` | 只持久化证书时也可以只挂这一层 |
| `/app/logs` | 应用日志（Zap + lumberjack 轮转） |

> 用**命名卷**时无需处理属主；用 bind mount（如 `./data:/app/runtime`）时目录由 Docker 以 root 创建，
> 需自行 `chown -R 1000:1000 <dir>`，否则非 root 容器写入证书会失败。

---

## 健康检查

镜像内置 `HEALTHCHECK`（interval 30s / timeout 5s / start-period 30s / retries 3）：

```
wget -q -O /dev/null http://127.0.0.1:8080/health/db
```

`/health/db` 是**就绪探针**（含数据库连通性），正常返回 `{"db":"ok","status":"healthy"}`。
编排中可作为依赖条件：

```yaml
depends_on:
  pay-unify:
    condition: service_healthy
```

> 刻意用 GET（`-O /dev/null`）而非 `--spider`：`/health/db` 只注册了 GET 路由，
> `--spider` 发 HEAD 会 404，导致容器被误判为 unhealthy。

---

## 端点速查

| 端点 | 说明 |
| --- | --- |
| `GET /` | 管理控制台（浏览器返回 HTML；其它客户端返回服务信息 JSON） |
| `GET /health` | 存活探针 |
| `GET /health/db` | 就绪探针（含 DB 连通性） |
| `GET /metrics` | Prometheus 文本格式指标 |
| `GET /api/v1/info` | 服务信息 |
| `GET /swagger/index.html` | Swagger UI |
| `GET /api/v1/payment/channels` | 三渠道状态（公开） |

---

## 本地构建镜像

仓库根目录的 `Dockerfile` 是三阶段单镜像（前端静态导出 → Go 内嵌 → 单二进制）：

```bash
# 在仓库根目录执行
docker build -t pay-unify:local .
docker run -p 8097:8080 \
  -e CONFIG_FILE=/app/runtime/config.toml \
  -e PANEL_DB_HOST=host.docker.internal -e PANEL_DB_NAME=payment_db \
  -e PANEL_DB_USER=root -e PANEL_DB_USER_PASSWORD=root \
  pay-unify:local
```

国内网络可使用镜像站加速（基础镜像 + npm 国内源）：

```bash
bash deploy/scripts/build-image-cn.sh
```

> 发布流程：推 `v*` tag 触发 `.github/workflows/docker-publish.yml`，
> 自动多架构构建并推送到 `docker.io/difyz9/pay-unify`（tag → 版本号 + `latest`）。
> 也可在 Actions 页面 `workflow_dispatch` 手动指定版本号。

---

## 常见问题

**Q：容器起来了但控制台打不开？**
先看 `docker logs pay-unify`。若报 `连接数据库(mysql)失败: connect: connection refused`，
说明启动时数据库还没就绪——服务不重试，容器会直接退出。加 `--restart unless-stopped` 自愈，
或用 Compose 的 `service_healthy` 依赖。数据库可达仍失败时，检查 `PANEL_DB_*` 是否拼错、库是否已建、是否允许该来源 IP 连接。

**Q：登录提示“尝试次数过多，账号已临时锁定”？**
登录失败 5 次会锁定 30 分钟（`[Auth] MaxLoginAttempts` / `LockoutDuration`）。
锁定记录在进程内存中，`docker restart pay-unify` 即可立即解锁。

**Q：上传的支付证书重启后丢了？**
`/app/runtime/certs` 没做持久化。务必挂载数据卷；挂载宿主机目录时还要保证 uid 1000 可写。

**Q：改了渠道参数要重启吗？**
支付宝 / 微信的配置与证书在控制台保存后**热加载即时生效，不用重启**。
PayPal 由配置文件决定，需改配置并重启。

**Q：`docker pull` 拉取慢？**
使用镜像加速：`docker pull docker.m.daocloud.io/difyz9/pay-unify:2.0.1`（或本地配置的加速地址）。

**Q：如何升级版本？**
把 `PAY_UNIFY_VERSION`（或 `image:` 里的 tag）改为新版本，
执行 `docker compose pull && docker compose up -d`。数据在命名卷中，不受影响。

---

## 相关文档

- [环境变量参考](/deployment/environment)
- [快速开始](/guide/quickstart)（源码开发方式）
- [后端部署](/deployment/backend)（仅部署 API 或传统 Supervisor / Nginx）
- [前端部署](/deployment/frontend)（独立部署前端 / Vercel）
- [配置说明](/backend/config)（`config.toml` 全字段）
