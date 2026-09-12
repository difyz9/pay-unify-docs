---
title: 后端部署
---

# 后端部署

> **推荐先看 [Docker 一键部署](/deployment/docker)** —— 单镜像 / 单容器同时提供控制台与 API。
> 本页用于「只部署 API」「源码编译单二进制」「传统服务器（Supervisor / Nginx）」等场景。

## 1. 构建

在单仓的 `backend/` 目录下：

```bash
cd backend

# 方式一：Makefile（下载依赖 + fmt + 构建，输出 bin/github.com/difyz9/pay-unify）
make build

# 方式二：直接构建
CGO_ENABLED=0 GOOS=linux go build -o pay-unify-server .
```

常用 Makefile 目标：`run`（构建并运行）、`test` / `test-coverage`、`docs`（`swag init` 重新生成 API 文档）、
`docker`（构建镜像）、`lint` / `security` / `fmt` / `deps` / `check-secrets`。

### 单二进制（内嵌前端，推荐）

后端通过 `//go:embed all:web` 内嵌前端静态资源，可打包为**单文件可部署**：

```bash
cd backend
make build-all FRONTEND_DIR=../frontend   # ① 前端静态导出到 backend/web/ ② 编译 ./pay_unify_all
./pay_unify_all                           # 一个二进制同时提供 API + 控制台
make clean-web                            # 清理内嵌产物，恢复占位页
```

> `backend/Makefile` 默认 `FRONTEND_DIR=../pay-unify-frontend` 是旧拆仓目录名，
> 在单仓中执行时请显式覆盖为 `../frontend`。
> 导出前会自动临时移开 `frontend/src/app/api` 与 `src/middleware.ts`（静态导出不支持），构建后还原。

## 2. Docker（仅 API 镜像）

`backend/Dockerfile` 只含后端（也可内嵌 `backend/web/` 里已有的前端产物）：

```bash
cd backend
docker build -t pay-unify-api:2.0.1 .
docker run -d --name pay-unify-api \
  -p 8080:8080 \
  -e CONFIG_FILE=/app/config.toml \
  -e PANEL_DB_HOST=host.docker.internal \
  -e PANEL_DB_NAME=payment_db -e PANEL_DB_USER=root -e PANEL_DB_USER_PASSWORD=secret \
  -v "$PWD/runtime:/app/runtime" \
  -v "$PWD/logs:/app/logs" \
  --restart unless-stopped \
  pay-unify-api:2.0.1
```

容器内要点：

- `WORKDIR /app/`，监听 `:8080`（`EXPOSE 8080`），自带 `HEALTHCHECK`（`wget /health/db`）。
- 运行用户为 `app`（uid/gid 1000，非 root）；bind mount 时需保证目录可写。
- 证书 Web 上传内容落盘 `runtime/certs/`，**务必持久化**。
- 配置读取支持环境变量（`CONFIG_FILE`、`PAY_*`、`PANEL_DB_*`），详见[环境变量参考](/deployment/environment)。

### Docker Compose（仅 API + MySQL）

仓库根 `docker-compose.yml` 已编排「单镜像 + MySQL」。若只想跑 API，可参考：

```yaml
services:
  mysql:
    image: mysql:8.0
    command: ["--character-set-server=utf8mb4", "--collation-server=utf8mb4_unicode_ci"]
    environment:
      MYSQL_ROOT_PASSWORD: change-me
      MYSQL_DATABASE: payment_db
    volumes: [ mysql-data:/var/lib/mysql ]

  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    ports: [ "8097:8080" ]
    environment:
      CONFIG_FILE: /app/runtime/config.toml
      PANEL_DB_TYPE: mysql
      PANEL_DB_HOST: mysql
      PANEL_DB_NAME: payment_db
      PANEL_DB_USER: root
      PANEL_DB_USER_PASSWORD: change-me
    volumes:
      - backend-runtime:/app/runtime
    depends_on: [ mysql ]

volumes:
  mysql-data:
  backend-runtime:
```

## 3. Supervisor 部署（传统服务器）

仓库提供 `backend/supervisor-deploy.sh`（以 root 运行）：自动安装 Supervisor、
将配置写入 `/etc/supervisor/conf.d/`、编译产物并 `supervisorctl restart`。

```bash
cd backend
sudo ./supervisor-deploy.sh
# 常用管理
supervisorctl status pay-unify
supervisorctl tail -f pay-unify stderr
```

## 4. 反向代理（Nginx）

若采用前后端分离部署，后端 API 反代示例：

```nginx
server {
    listen 80;
    server_name api.your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:8097;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 渠道异步回调必须公网可达；生产务必启用 HTTPS 443
    location /api/v1/payment/notify/ { proxy_pass http://127.0.0.1:8097; }
}
```

> 支付宝 / 微信的异步通知（`/api/v1/payment/notify/*`）要求**公网可访问的 HTTPS** 地址（沙箱除外），
> 请把回调域名配置到对应渠道的 `NotifyURL`。

## 5. 发布前检查清单

```bash
cd backend
make check-secrets && go test ./...
```

人工核对：

1. **密钥安全**：`JWT.SecretKey` 使用 `openssl rand -hex 32` 生成（≥32 字节）；`config.toml` 不进 git、权限 `chmod 600`。
2. **证书文件**：支付宝（应用私钥 / 应用公钥证书 / 支付宝公钥证书 / 根证书）、微信（商户 API 私钥 PKCS8）、
   SkillHub（RSA 2048 私钥）；或全部改用[证书管理](/backend/certs) Web 上传，自动落盘 `runtime/certs/`。
3. **数据库**：MySQL 8.0+，utf8mb4；首次启动自动建表 + 种子数据。
4. **生产开关**：`Debug = false`、渠道 `SandBox = false`、按需关闭 `Auth.EnableRegister`。
5. **可观测**：Zap 结构化日志（`logs/` / 容器 stdout），结合 `docker logs` 或 supervisor 查看；
   指标 `GET /metrics`，探针 `/health`、`/health/db`。

## 6. 扩容与定时任务

- `OrderScheduler`（每 5 分钟扫描，关闭 15 分钟前未支付订单）随进程启动，**单实例部署**即可；
  多副本时建议仅保留一个调度实例。
- 管理端配置变更（渠道开关 / 证书）为进程内热加载，多副本时依赖同一条 MySQL 保证最终一致。

## 相关文档

- [Docker 一键部署](/deployment/docker)
- [环境变量参考](/deployment/environment)
- [配置说明](/backend/config)
- [证书管理](/backend/certs)、[API 集成指南](/backend/api-integration)
