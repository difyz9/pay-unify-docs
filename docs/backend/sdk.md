---
title: SDK 与示例
---

# SDK 与示例

后端仓库 `pay-unify-backend/examples/` 提供多语言接入素材，前端仓库 `pay-unify-frontend/examples/` 提供 X402 参考实现。

> ⚠️ 认证现状提醒：仓库内 `python_payment_example.py`、`GOLANG_EXAMPLE_README.md` 等**历史示例仍为旧的 GoAuth HMAC 写法**
> （`X-App-Id / X-Timestamp / X-Sign` 头），后端已全面下线该认证，相关文件仅供参考、**不可直接运行**。
> 以 OAuth2（`POST /oauth/token` → Bearer）为准，见[认证体系](/backend/auth)。

## 推荐的最小接入（Python，OAuth2）

```python
import requests

BASE = "http://localhost:8097"          # 后端地址
# —— 第 1 步：用 API 应用凭证换 Bearer token ——
r = requests.post(f"{BASE}/oauth/token",
                  data={
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

- 先到「API 应用管理」按需勾选 scope（下单需要 `payment:write`）。
- 密钥**仅创建 / 轮换时展示一次**，服务端 bcrypt 存储；不要把密钥提交到公开仓库。
- 生产必须 HTTPS；可配合 IP 白名单与限流使用。

## 仓库内示例素材

### pay-unify-backend/examples/

| 文件 | 说明 | 状态 |
| --- | --- | --- |
| `QUICK_START_SDK.md` | SDK 快速开始（描述 payment-sdk 目录，当前仓库未内置） | ⚠️ 内容过期 |
| `golang_payment_example.go` | Go 调用示例（注释状态，依赖已移除的 payment-sdk） | ⚠️ 内容过期 |
| `python_payment_example.py` | Python 全流程示例（HMAC 写法） | ⚠️ 认证过期 |
| `PYTHON_SDK_SIGNATURE_FIX.md` | 早期签名问题排查记录 | 历史 |
| `requirements.txt` | Python 依赖 | — |
| `workwx/main.go` | 企业微信通知的 Go 接入参考 | 有效 |

### pay-unify-frontend/examples/

| 文件 | 说明 | 状态 |
| --- | --- | --- |
| `x402-demo.mjs` | **X402 收款最小参考实现**（Node 18+ 零依赖） | ✅ 与当前后端一致 |

```bash
# X402 Demo 用法
cd pay-unify-frontend/examples
BASE_URL=http://localhost:8097 \
CLIENT_ID=local-test \
CLIENT_SECRET=local-test-secret-32-chars-here-ok \
QUERY="epub转txt /path/in.epub" \
node x402-demo.mjs
```

流程：`POST /oauth/token` 换 token → `POST /api/v2/skillpay/resource` 收到 `402 + L1 支付码`
→ 用户扫码支付（DevMode 可跳过）→ 带 `X-Out-Trade-No` 重放拿到付费内容（幂等）→ 可选查询 / 退款。
完整说明见 [X402 / SkillPay](/backend/x402)。

## 交互式演示

- **X402 收款案例**：登录后台访问 `/dashboard/x402`，可切换本地 / 生产后端、查看 L1 支付码解析、订单轮询与幂等验证。
- **API 应用管理**：`/dashboard/api-apps` 创建应用后，弹窗内直接复制 cURL / Python 接入示例。

## 调试辅助

```bash
# 在线 Swagger（含每个接口的请求/响应模型，可试调）
curl http://localhost:8097/swagger/doc.json     # OpenAPI 定义
# 浏览器打开 http://localhost:8097/swagger/index.html
```
