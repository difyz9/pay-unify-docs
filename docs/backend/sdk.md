---
title: SDK 与示例
---

# SDK 与示例

Pay-Unify 未内置官方 SDK 包，推荐直接使用标准 HTTP 客户端按 **OAuth2 Client Credentials** 接入。

> ⚠️ 历史示例提醒：早期仓库内的 `python_payment_example.py`、`golang_payment_example.go` 等示例使用
> **旧的 GoAuth HMAC 写法**（`X-App-Id / X-Timestamp / X-Sign` 头），后端已全面下线该认证。
> 当前检出中这些 `examples/` 目录**已不存在**，请以 OAuth2（`POST /oauth/token` → Bearer）为准，见[认证体系](/backend/auth)。

## 推荐的最小接入（Python，OAuth2）

```python
import requests

BASE = "http://localhost:8097"          # 后端地址
# —— 第 1 步：用 API 应用凭证换 Bearer token ——
r = requests.post(f"{BASE}/oauth/token",
                  json={
                      "client_id": "test-app-001",                  # 管理后台「API 应用管理」创建
                      "client_secret": "test-secret-key-12345678901234567890",
                      "grant_type": "client_credentials",
                  })
access_token = r.json()["access_token"]
headers = {"Authorization": f"Bearer {access_token}"}

# —— 第 2 步：统一下单 ——
pay = requests.post(f"{BASE}/api/v2/payment/pay",
                    headers=headers,
                    json={
                        "subject": "在线支付 - VIP会员",
                        "amount": 0.01,
                        "payWay": "alipay",        # alipay / wechat / paypal
                        "orderType": "vip",
                        "userId": "user_12345",
                        "extra": '{"productId":"vip_001","period":"30days"}',
                    })
print(pay.json())

# —— 第 3 步：查单 / 关单 / 退款 ——
order_no = pay.json().get("data", {}).get("orderNo")
requests.get(f"{BASE}/api/v2/payment/query/{order_no}", headers=headers).json()
requests.post(f"{BASE}/api/v2/payment/close/{order_no}", headers=headers).json()
requests.post(f"{BASE}/api/v2/payment/refund",
              headers=headers,
              json={"orderNo": order_no, "refundAmount": 0.01}).json()
```

- 先到「API 应用管理」按需勾选 scope（下单需要 `payment:write`）；生产环境用控制台 `/api/v1/api-apps`（管理员 JWT）创建。
- 密钥**仅创建 / 轮换时展示一次**，服务端 bcrypt 存储；不要把密钥提交到公开仓库。
- token 默认有效期 1 小时，过期重新换发；生产必须 HTTPS，可配合 IP 白名单与限流使用。

> 种子应用 `test-app-001` / `local-test` 仅在 `Debug = true` 环境自动创建，生产不会存在。

## 获取 token 的两种请求格式

`POST /oauth/token` 同时接受 JSON 与表单：

```bash
# JSON
curl -X POST http://localhost:8097/oauth/token \
  -H 'Content-Type: application/json' \
  -d '{"grant_type":"client_credentials","client_id":"...","client_secret":"..."}'

# 表单（RFC 6749 标准）
curl -X POST http://localhost:8097/oauth/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=client_credentials&client_id=...&client_secret=...'
```

## X402（SkillPay）接入

X402 是面向 AI Skill 的付费协议，接入步骤：

```
① POST /oauth/token                          → Bearer（scope: skillpay:call）
② POST /api/v2/skillpay/resource             → 首次返回 402 + L1 支付码（WeixinPay-Required）
③ 用户微信扫码支付（本地 DevMode 可跳过）
④ POST …/resource（X-Out-Trade-No 请求头）    → 200 + 付费内容（服务端幂等履约）
⑤ GET  /api/v2/skillpay/query/{outTradeNo}   → 查询订单状态
⑥ POST /api/v2/skillpay/refund               → 退款
```

- 完整协议、签名算法与字段说明见 [X402 / SkillPay](/backend/x402)。
- 控制台页面：登录后访问 `/dashboard/x402`，可切换后端、解析 L1 支付码、轮询订单、验证幂等与退款。

## 交互式接口文档

- **Swagger UI**：浏览器打开 `http://<host>:<port>/swagger/index.html`，可直接试调每个接口。
- **OpenAPI 定义**：
  - 运行时：`GET /swagger/doc.json`
  - 仓库内离线：`backend/docs/swagger.yaml` / `swagger.json` / `docs.go`
- 「API 应用管理」创建应用后，弹窗内可直接复制 cURL / Python 接入示例。

## 调试辅助

```bash
# 服务信息
curl http://localhost:8097/api/v1/info
# 三渠道状态（公开）
curl http://localhost:8097/api/v1/payment/channels
# 健康检查
curl http://localhost:8097/health/db
```
