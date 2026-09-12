> **维护说明**：本文档已并入本站直接维护（单仓重构后原 `backend/docs/*.md`、前端 `docs/*.md` 不再随仓库发布）。
> 实现细节以 [pay-unify 源码](https://github.com/difyz9/pay-unify) 为准，页面与源码的对应关系见[相关资源](/appendix/resources)。

# 配置文件使用说明

配置位于 `backend/` 目录。**所有配置项均可被环境变量覆盖**（优先级：环境变量 > `config.toml` > 内置默认值），
完整环境变量清单见[环境变量参考](/deployment/environment)。

## 配置文件列表

| 文件 | 用途 | 状态 |
| --- | --- | --- |
| `config.toml.example` | 配置模板，含全部可配置项注释，敏感信息为占位符 | ✅ 纳入版本控制 |
| `config-local.toml` | 本地开发配置（`Listen = ":8097"`，`Debug = true`，使用 `config-local.toml` 启动） | ✅ 纳入版本控制 |
| `config-dev.toml` | 开发环境示例（`Listen = ":8089"`） | ✅ 纳入版本控制 |
| `config.toml` | 实际运行配置（可能含真实密钥） | 🔒 已 `.gitignore` |

## 快速开始

```bash
cd backend
cp config.toml.example config.toml   # 然后填入真实配置
# 或本地开发直接用：CONFIG_FILE=config-local.toml go run main.go
```

必须修改的配置项：

- `MysqlDns`（或 `DBDriver` + `PostgresDsn`）；
- `[JWT] SecretKey`（`openssl rand -hex 32`，< 16 字节拒绝启动）；
- `[Auth] AdminUsername` / `AdminPassword`（仅首次建库生效）；
- 至少一种支付渠道（或后续在控制台热配置）。

## 配置项说明

### 顶层

```toml
Listen = ":8097"                 # 监听地址（容器内镜像默认 :8080）
Version = "1.0.0"
Debug = false                    # true 时才会创建测试用种子 API 应用
MysqlDns = "user:pass@tcp(127.0.0.1:3306)/payment_db?charset=utf8mb4&collation=utf8mb4_unicode_ci&parseTime=True&loc=Local"
# DBDriver = "postgres"
# PostgresDsn = "host=127.0.0.1 port=5432 user=postgres password=... dbname=payment_db sslmode=disable"
```

### `[JWT]` 管理员会话

```toml
[JWT]
SecretKey = "replace-with-openssl-rand-hex-32-jwt-secret"  # < 16 字节拒绝启动，< 32 字节告警
ExpirationHours = 24
```

### `[Auth]` 登录策略与初始管理员

```toml
[Auth]
MaxLoginAttempts = 5
LockoutDuration = 1800     # 秒；锁定记录在进程内存，重启即解锁
EnableRegister = true      # 生产建议 false
AdminUsername = "admin"    # 仅首次建库生效，可用 PAY_ADMIN_USERNAME 覆盖
AdminPassword = "admin123" # 仅首次建库生效，可用 PAY_ADMIN_PASSWORD 覆盖
```

### `[OAuth]` 商户令牌

```toml
[OAuth]
AccessTokenTTL = 3600      # 秒（默认 1 小时）
Issuer = "pay-unify"
```

### 支付渠道

#### `[AlipayConfig]`（证书模式，4 个证书位）

```toml
[AlipayConfig]
Enabled = false
SandBox = true
AppId = "your_alipay_app_id"
PrivateKey = "/etc/certs/alipay/privateKey.txt"
PublicKey = "/etc/certs/alipay/appCertPublicKey.crt"
AlipayPublicKey = "/etc/certs/alipay/alipayCertPublicKey.crt"
RootCert = "/etc/certs/alipay/alipayRootCert.crt"
NotifyURL = "https://api.example.com/api/v1/payment/notify/alipay"
ReturnURL = "https://api.example.com/payment/return"
```

#### `[WechatPayConfig]`（微信支付 v3）

```toml
[WechatPayConfig]
Enabled = false
AppId = "your_wechat_app_id"
MchId = "your_merchant_id"
SerialNo = "your_certificate_serial_number"
PrivateKey = "/etc/certs/wechat/apiclient_key_pkcs8.pem"
ApiV3Key = "0123456789abcdef0123456789abcdef"
NotifyURL = "https://api.example.com/api/v1/payment/notify/wechat"
AutoVerifySign = false
StrictNotifyVerify = false
```

#### `[PaypalConfig]`（始终由 config.toml 决定，不支持热配置）

```toml
[PaypalConfig]
Enabled = false
SandBox = true
ClientId = "your_paypal_client_id"
Secret = "your_paypal_secret"
NotifyURL = "https://api.example.com/api/v1/payment/notify/paypal"
ReturnURL = "https://api.example.com/payment/success"
```

> **配置优先级**：支付宝 / 微信以数据库 `tb_payment_config` 为准（控制台热配置）；
> DB 无对应行时回退 `config.toml`（老部署兼容）；PayPal 始终由 `config.toml` 决定。

### 其他分节

| 分节 | 关键项 | 说明 |
| --- | --- | --- |
| `[SkillHubConfig]` | `Enabled` / `DeveloperId` / `PubKeyId` / `PrivateKey` / `SkillId` / `PriceAmount` / `DevMode` | SkillHub X402 付费能力，见 [X402](/backend/x402) |
| `[MembershipTokenConfig]` | `SignMode` / Ed25519 密钥路径 / `LegacyHMACFallback` | 会员令牌签名（Ed25519，兼容 HMAC 回退） |
| `[WorkWechatConfig]` | `CorpID` / `AgentID` / 通知目标 | 企业微信通知，见[企业微信通知](/backend/work-wechat) |

## 安全建议

1. **密钥生成**：`openssl rand -hex 32`；`config.toml` 权限 `chmod 600`。
2. **证书**：可放入 `certs/` 目录，或全部改用[证书管理](/backend/certs) Web 上传，自动落盘 `runtime/certs/`：
   ```
   certs/
   ├── alipay/   # privateKey / appCertPublicKey / alipayCertPublicKey / alipayRootCert
   └── wechat/   # apiclient_key_pkcs8.pem
   ```
3. **环境区分**：开发用 `SandBox = true`；生产 `SandBox = false`、`Debug = false`、HTTPS。
4. **容器部署**：推荐用环境变量 + `CONFIG_FILE=/app/runtime/config.toml`（首次启动自生成随机 JWT 密钥），见 [Docker 一键部署](/deployment/docker)。

## 常见问题

**Q：`config.toml` 会被提交到 Git 吗？**
不会，已加入 `.gitignore`。可用 `git check-ignore -v config.toml` 验证。

**Q：多环境如何管理配置？**
用不同配置文件 + `CONFIG_FILE` 指定，或直接用环境变量覆盖（`PAY_*` / `PANEL_DB_*`）。

**Q：忘记修改配置项会怎样？**
服务启动时会做配置校验：缺少必要配置会报错退出；`JWT.SecretKey` 过短会拒绝启动；
支付配置不全会导致对应渠道 `configured=false`，下单被拒绝。可在 `GET /api/v1/payment/channels` 查看渠道状态。

---

## 获取帮助

- [环境变量参考](/deployment/environment)
- [Docker 一键部署](/deployment/docker)
- [认证体系](/backend/auth)、[证书管理](/backend/certs)
- 提交 Issue：<https://github.com/difyz9/pay-unify/issues>

**请不要在 Issue 中泄露真实的密钥和密码！**
