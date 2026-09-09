---
title: 后端部署
---

# 后端部署（pay-unify-backend）

## 构建

```bash
# 方式一：Makefile（自动下载依赖 + fmt + 构建，输出 bin/<module>）
make build

# 方式二：直接构建
CGO_ENABLED=0 GOOS=linux go build -o pay-unify-server .
```

常用 Makefile 目标：`run`（构建并运行）、`test` / `test-coverage`、`docs`（`swag init` 重新生成 API 文档）、`docker`（构建 Docker 镜像）、`lint` / `security` / `fmt` / `deps`。

## Docker 部署

仓库自带多阶段 `Dockerfile`：

```bash
# 构建镜像
docker build -t pay-unify-backend:latest .

# 运行（映射宿主 8089 → 容器 8089）
docker run -d --name pay-unify-backend \
  -p 8089:8089 \
  -e CONFIG_FILE=config.toml \
  -v /path/to/config.toml:/root/config.toml:ro \
  -v /path/to/certs:/root/certs:ro \
  -v /path/to/runtime:/root/runtime \
  -v /path/to/logs:/root/logs \
  --restart unless-stopped \
  pay-unify-backend:latest
```

容器内要点：

- `WORKDIR /root/`，监听 `:8089`（`EXPOSE 8089`），自带 `HEALTHCHECK`（`wget /health`）。
- 镜像默认 `COPY config.toml`、`certs/`、`templates/`——**生产请用 `-v` 覆盖为真实配置与证书**，不要把密钥打进镜像。
- 配置读取支持环境变量 `CONFIG_FILE`（默认 `config.toml`）；本地开发用 `config-local.toml`。
- 支付证书 Web 上传的内容会落盘到 `runtime/certs/`（确保 `runtime/` 目录可写且持久化）。

### Docker Compose

仓库未内置后端 compose（前端 `docker-compose.yml` 只含 frontend）；可与 MySQL 编排在同一网络：

```yaml
services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: change-me
      MYSQL_DATABASE: payment_db
    volumes: [ mysql-data:/var/lib/mysql ]
  backend:
    build: ./pay-unify-backend
    ports: [ "8089:8089" ]
    environment:
      CONFIG_FILE: config.toml
    volumes:
      - ./pay-unify-backend/config.toml:/root/config.toml:ro
      - certs:/root/certs:ro
      - runtime:/root/runtime
    depends_on: [ mysql ]
```

## Supervisor 部署（传统服务器）

仓库提供 `supervisor-deploy.sh`（以 root 运行）：自动安装 Supervisor、生成 `/tmp/<project>.conf` 到 `/etc/supervisor/conf.d/`、编译产物并 `supervisorctl restart`。

```bash
sudo ./supervisor-deploy.sh
# 常用管理
supervisorctl status pay-unify-backend
supervisorctl tail -f pay-unify-backend stderr
```

## 反向代理（Nginx）

```nginx
server {
    listen 80;
    server_name api.your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:8089;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 渠道异步回调必须公网可达；生产务必启用 HTTPS 443
    location /api/v1/payment/notify/ { proxy_pass http://127.0.0.1:8089; }
}
```

> 支付宝 / 微信的异步通知（`/api/v1/payment/notify/*`）要求**公网可访问的 HTTPS** 地址（沙箱除外），
> 请把回调域名配置到 `config.toml` 对应渠道的 `NotifyURL`。

## 环境准备与检查清单

发布前建议运行仓库自带 `check-before-publish.sh`，并人工核对：

1. **密钥安全**
   - `Session.SecretKey`、`JWT.SecretKey`、`Auth.PasswordSalt` 使用 `openssl rand -hex 32` 生成。
   - `config.toml` 不进 git（已在 `.gitignore`）、权限 `chmod 600`。
2. **证书文件**
   - 支付宝（`certs/alipay/`）：应用私钥、应用公钥证书、支付宝公钥证书、根证书。
   - 微信（`certs/wechat/`）：商户 API 私钥（PKCS8）。
   - SkillHub（`certs/skillhub/`）：RSA 2048 私钥。
   - 也可全部改用[证书管理](/backend/certs) Web 上传，自动落盘 `runtime/certs/`。
3. **数据库**：MySQL 8.0+，utf8mb4；首次启动自动建表 + 种子数据。
4. **生产开关**：`Debug = false`、渠道 `SandBox = false`、按需关闭 `Auth.EnableRegister`。
5. **可观测**：日志由 Zap 输出（仓库 `logs/` / Docker stdout），结合 `docker logs` 或 supervisor 查看。

## 扩容与定时任务

- `OrderScheduler`（过期订单自动关单）随进程启动，**单实例部署**即可；多副本部署时建议仅保留一个调度实例或外部化到单节点。
- 管理端配置变更（渠道开关 / 证书）为进程内热加载，多副本时请通过同一条 MySQL 保证一致性（当前为最终一致轮询 / 推送）。

## 相关文档

- 配置字段详解 → [配置说明](/backend/config)
- 渠道、证书、通知细节 → [API 集成指南](/backend/api-integration)、[证书管理](/backend/certs)
