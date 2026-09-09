> **本文档来源**：pay-unify-backend 仓库的 `docs/AUTHENTICATION.md`（保持与源码同步的权威版本）。
> 修改时请先更新仓库内原文件，再同步本页。

# 认证架构说明

本项目采用**双认证体系**（已全面移除 GoAuth HMAC 签名认证）：

| API 路径 | 认证方式 | 使用场景 | 示例 |
|---------|---------|---------|------|
| `/api/v1/*` | 管理员 JWT | 前端管理后台（登录会话，`apiClient` 自动携带） | 订单/用户/商品管理、支付下单（控制台演示）、`/api/v1/payment/config/*`、`/api/v1/certs/*` |
| `/api/v2/*` | OAuth2 Bearer（API 应用） | 商户 / 第三方 S2S 调用，scope 最小授权 | `/api/v2/payment/pay`、`/api/v2/users`、`/api/v2/skillpay/*` |
| `/api/v1/payment/channels` | 公开 | 渠道状态展示 | — |

> 迁移说明：旧版 `/api/v1/payment/*` 的 GoAuth HMAC（X-App-Id/X-Sign）认证已下线，
> 控制台改走管理员 JWT，商户请使用 OAuth2 `/api/v2/payment/*`（python SDK 已是此方式）。

## 1. 管理员 JWT（`/api/v1/*`）

### 流程
```
1. POST /api/v1/login {username, password}
   → 返回 JWT（存 Cookie auth_token，1 天有效）
2. 后续请求携带：Authorization: Bearer <token>
   （前端由 apiClient 拦截器自动添加，无需手动处理）
```

### 受保护（需要 JWT）
- 用户/订单/商品/项目/金币等管理接口
- 支付下单/查单/关单/退款（控制台演示）
- 支付配置：`GET/POST /api/v1/payment/config/*`、`PUT .../toggle`
- 证书管理：`POST /api/v1/certs/*`（上传/列表/设默认/删除/下载）

## 2. OAuth2 应用认证（`/api/v2/*`）

### 流程
```
1. 管理后台「API 应用管理」创建应用（client_id + client_secret ≥16 位，
   选择 scope；密钥仅创建时展示一次，bcrypt 存储）
2. 换取令牌：POST /oauth/token
   Content-Type: application/x-www-form-urlencoded
   client_id=...&client_secret=...&grant_type=client_credentials
   → { access_token, token_type:"Bearer", expires_in, scope }
3. 调用接口：Authorization: Bearer <access_token>（默认 1 小时）
4. 可随时吊销：POST /oauth/revoke { token }
```

### Scope 最小授权
创建应用时按需选择 scope（`payment:write` 下单、`payment:read` 查单、
`skillpay:call`、`config:read/write`、`cert:manage`、`admin` 全量等）。
令牌按 scope 校验，管理员可在「API 应用管理」中启停应用、轮换密钥。

> 注意：`config:read/write`、`cert:manage` 属管理级权限，仅应授予可信应用。

## 3. 配置说明

### 后端（config.toml）
```toml
[JWT]
  SecretKey = "..."            # 管理员 JWT 与 OAuth2 token 共用签名密钥
  ExpirationHours = 24

[OAuth]
  Issuer = "pay-unify"         # token 签发方
```
OAuth2 应用存储于 `tb_api_app` 表（无需在 config.toml 维护应用列表）。

### 前端（.env.local）
```bash
NEXT_PUBLIC_API_URL=http://localhost:8089
# 控制台使用管理员 JWT 会话，前端不持有任何接口密钥。
# X402 演示页如需 OAuth2：NEXT_PUBLIC_X402_CLIENT_ID / _SECRET
```

## 4. 测试脚本

### 管理员登录（JWT）
```bash
TOKEN=$(curl -s -X POST http://localhost:8089/api/v1/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r .data.token)

curl -s http://localhost:8089/api/v1/payment/config/list \
  -H "Authorization: Bearer $TOKEN"
```

### 商户 OAuth2 调用（/api/v2）
```bash
TOKEN=$(curl -s -X POST http://localhost:8089/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=YOUR_CLIENT_ID&client_secret=YOUR_SECRET&grant_type=client_credentials" \
  | jq -r .access_token)

curl -s -X POST http://localhost:8089/api/v2/payment/pay \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"subject":"测试商品","amount":0.01,"payWay":"alipay"}'
```

## 5. 常见问题

### Q1: 登录接口为什么无需认证？
登录是公开接口，用户/应用通过它换取自己的凭证，之后请求带 token。

### Q2: 什么时候用 JWT，什么时候用 OAuth2？
- JWT：管理后台用户会话（识别“谁”在操作）
- OAuth2：商户/第三方应用（识别“哪个应用”在调用，scope 限制权限）

### Q3: Token 过期/吊销怎么办？
- 管理员 JWT：前端自动清理并跳转登录页
- OAuth2：调用方重新 `POST /oauth/token`；服务端可 `POST /oauth/revoke` 即时吊销

## 6. 安全建议
1. 生产环境必须 HTTPS，防止 token 截获
2. API 应用密钥绝不能进入前端包或公开仓库（后端 bcrypt 存储，仅创建时展示）
3. 生产配置 IP 白名单与合理速率限制
4. 定期轮换 JWT SecretKey 与 API 应用密钥
5. 管理级 scope（config/cert）只授予可信应用
