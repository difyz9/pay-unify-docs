> **维护说明**：本文档已并入本站直接维护（单仓重构后原 `backend/docs/*.md`、前端 `docs/*.md` 不再随仓库发布）。
> 实现细节以 [pay-unify 源码](https://github.com/difyz9/pay-unify) 为准，页面与源码的对应关系见[相关资源](/appendix/resources)。

# 支付统一平台 API 集成指南

## 目录
- [1. 概述](#1-概述)
- [2. 认证机制](#2-认证机制)
- [3. 创建支付订单](#3-创建支付订单)
- [4. 查询订单状态](#4-查询订单状态)
- [5. 订单列表查询](#5-订单列表查询)
- [6. 关闭订单](#6-关闭订单)
- [7. 取消订单](#7-取消订单)
- [8. 申请退款](#8-申请退款)
- [9. 支付回调通知](#9-支付回调通知)
- [10. 错误码说明](#10-错误码说明)
- [11. SDK示例](#11-sdk示例)

---

## 1. 概述

### 1.1 接口基础信息

- **API Base URL**: `https://<your-domain>/api/v2`（示例；本地为 `http://localhost:8097/api/v2`）
- **协议**: HTTPS（生产必须）
- **数据格式**: JSON
- **字符编码**: UTF-8
- **认证方式**: OAuth2 Client Credentials（`POST /oauth/token` 换取 Bearer，见 [认证体系](/backend/auth)）

### 1.2 支持的支付方式

| 支付方式 | PayWay 值 | 说明 |
|---------|----------|------|
| 支付宝 | `alipay` | 支持PC网页支付、手机网页支付 |
| 微信支付 | `wechat` | 支持Native扫码支付、H5支付 |
| PayPal | `paypal` | 支持多币种国际支付 |

### 1.3 订单状态

| 状态码 | 说明 |
|-------|------|
| 1 | 待支付 |
| 2 | 已扫码（未支付） |
| 101 | 支付失败 |
| 201 | 已支付 |
| 300 | 已关闭 |
| 400 | 已退款 |

> 前端映射常量见 `frontend/src/constants/options.ts`。

---

## 2. 认证机制

Pay-Unify 开放 API（`/api/v2/*`）使用 **OAuth2 Client Credentials**：

```
① POST /oauth/token    → 用 client_id / client_secret 换 access_token（默认 1 小时）
② 调用 /api/v2/*       → Authorization: Bearer <access_token>
③ POST /oauth/revoke   → 需要时吊销令牌
```

### 2.1 换取令牌

**接口**：`POST /oauth/token`（公开；同时接受 JSON 与 `application/x-www-form-urlencoded`）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| grant_type | string | 是 | 固定 `client_credentials` |
| client_id | string | 是 | 控制台「API 应用管理」创建的应用 ID |
| client_secret | string | 是 | 应用密钥（仅创建 / 轮换时展示一次，bcrypt 存储） |

```bash
TOKEN=$(curl -s -X POST http://localhost:8097/oauth/token \
  -H "Content-Type: application/json" \
  -d '{"grant_type":"client_credentials","client_id":"your-client-id","client_secret":"your-secret"}' \
  | jq -r .access_token)
```

响应：

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "payment:write order:read"
}
```

### 2.2 调用接口

所有 `/api/v2/*` 请求携带：

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

令牌按应用的 scope 授权（`payment:write` 下单、`payment:read` 查单等），`admin` scope 通过所有检查。
scope 全集见 [API 总览](/backend/api-overview)。

### 2.3 错误处理

`POST /oauth/token` 失败返回 `invalid_client`（RFC 6749 不区分“应用不存在”与“密钥错误”）：

- 新部署的库里没有 API 应用 → 先登录控制台「API 应用管理」（走 `/api/v1/api-apps` 管理员会话）创建一个；
- 应用被禁用、密钥被轮换、或 scope 不含所需权限 → 同样会报 `invalid_client` / `403`。

> ⚠️ 旧版 GoAuth HMAC（`X-App-Id / X-Timestamp / X-Nonce / X-Sign`）认证已**全面下线**，
> 若在历史资料中看到这些请求头，请忽略并改用 Bearer。管理员 JWT（`/api/v1/*`，HttpOnly Cookie + CSRF）
> 仅用于控制台，详见 [认证体系](/backend/auth)。

---

## 3. 创建支付订单

### 3.1 接口信息

- **接口地址**: `POST /api/v2/payment/pay`
- **需要认证**: 是
- **Content-Type**: `application/json`

### 3.2 请求参数

| 参数名 | 类型 | 必填 | 说明 | 示例 |
|-------|------|------|------|------|
| subject | string | 是 | 商品标题/订单描述 | `VIP会员30天` |
| amount | float64 | 是 | 支付金额（元） | `99.00` |
| payWay | string | 是 | 支付方式：alipay/wechat/paypal | `alipay` |
| orderType | string | 否 | 订单类型 | `vip`/`product` |
| userId | string | 否 | 用户ID | `user_123456` |
| extra | string | 否 | 额外信息（JSON字符串） | `{"coupon":"NEW2024"}` |
| currency | string | 否 | 货币代码（PayPal专用） | `USD` |
| brandName | string | 否 | 品牌名称（PayPal专用） | `My Store` |
| cancelUrl | string | 否 | 取消支付URL（PayPal专用） | `https://...` |

**订单类型说明**：
- `subscription`/`vip`/`member`/`membership`: 订阅类订单，支付成功后自动为用户增加30天VIP
- `product`: 普通商品订单

### 3.3 响应参数

| 参数名 | 类型 | 说明 |
|-------|------|------|
| code | int | 状态码，200表示成功 |
| message | string | 响应消息 |
| data | object | 响应数据 |
| data.payUrl | string | 支付链接 |
| data.payWay | string | 支付方式 |
| data.amount | float64 | 支付金额 |
| data.orderNo | string | 订单号 |
| data.orderId | string | PayPal订单ID（仅PayPal支付） |
| data.currency | string | 货币代码（仅PayPal支付） |

### 3.4 请求示例

#### 支付宝支付

```bash
curl -X POST "https://api.example.com/api/v2/payment/pay" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "subject": "VIP会员30天",
    "amount": 1.00,
    "payWay": "alipay",
    "orderType": "vip",
    "userId": "user_123456"
  }'
```

#### 微信支付

```bash
curl -X POST "https://api.example.com/api/v2/payment/pay" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "subject": "VIP会员30天",
    "amount": 99.00,
    "payWay": "wechat",
    "orderType": "vip",
    "userId": "user_123456"
  }'
```

#### PayPal支付

```bash
curl -X POST "https://api.example.com/api/v2/payment/pay" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "subject": "VIP Membership 30 Days",
    "amount": 9.99,
    "payWay": "paypal",
    "currency": "USD",
    "brandName": "My Store",
    "orderType": "vip",
    "userId": "user_123456"
  }'
```

### 3.5 响应示例

#### 成功响应

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "payUrl": "https://openapi.alipay.com/gateway.do?...",
    "payWay": "alipay",
    "amount": 99.00,
    "orderNo": "202512311234567890"
  }
}
```

#### PayPal响应示例

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "payUrl": "https://www.paypal.com/checkoutnow?token=...",
    "payWay": "paypal",
    "amount": 9.99,
    "orderNo": "202512311234567890",
    "orderId": "5O190127TN364715T",
    "currency": "USD"
  }
}
```

#### 错误响应

```json
{
  "code": 400,
  "message": "支付金额必须大于0"
}
```

---

## 4. 查询订单状态

### 4.1 接口信息

- **接口地址**: `GET /api/v2/payment/query/{outTradeNo}`
- **需要认证**: 否（公开接口）
- **限流**: 建议每个订单每分钟不超过10次查询

### 4.2 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|-------|------|------|------|------|
| outTradeNo | path | string | 是 | 商户订单号 |

### 4.3 响应参数

| 参数名 | 类型 | 说明 |
|-------|------|------|
| code | int | 状态码 |
| message | string | 响应消息 |
| data | object | 订单详情 |
| data.orderNo | string | 订单号 |
| data.subject | string | 订单标题 |
| data.amount | float64 | 订单金额 |
| data.status | int | 订单状态：1-未支付，2-已支付，201-已关闭，202-已退款 |
| data.payWay | string | 支付方式 |
| data.tradeNo | string | 第三方交易号 |
| data.payTime | int64 | 支付时间（Unix时间戳） |
| data.createdAt | int64 | 创建时间（Unix时间戳） |

### 4.4 请求示例

```bash
curl -X GET "https://api.example.com/api/v2/payment/query/202512311234567890"
```

### 4.5 响应示例

#### 未支付

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "orderNo": "202512311234567890",
    "subject": "VIP会员30天",
    "amount": 99.00,
    "status": 1,
    "payWay": "alipay",
    "tradeNo": "",
    "payTime": 0,
    "createdAt": 1704009600
  }
}
```

#### 已支付

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "orderNo": "202512311234567890",
    "subject": "VIP会员30天",
    "amount": 99.00,
    "status": 2,
    "payWay": "alipay",
    "tradeNo": "2023123122001234567890",
    "payTime": 1704009700,
    "createdAt": 1704009600
  }
}
```

---

## 5. 订单列表查询

### 5.1 接口信息

- **接口地址**: `GET /api/v2/payment/orders`
- **需要认证**: 是

### 5.2 请求参数

| 参数名 | 类型 | 必填 | 说明 | 示例 |
|-------|------|------|------|------|
| userId | string | 否 | 用户ID | `user_123456` |
| status | string | 否 | 订单状态 | `1`/`2`/`201`/`202` |
| payWay | string | 否 | 支付方式 | `alipay`/`wechat`/`paypal` |
| page | int | 否 | 页码，默认1 | `1` |
| pageSize | int | 否 | 每页数量，默认10，最大100 | `20` |

### 5.3 响应参数

| 参数名 | 类型 | 说明 |
|-------|------|------|
| code | int | 状态码 |
| message | string | 响应消息 |
| data | object | 响应数据 |
| data.list | array | 订单列表 |
| data.total | int64 | 总记录数 |
| data.page | int | 当前页码 |
| data.pageSize | int | 每页数量 |

### 5.4 请求示例

```bash
curl -X GET "https://api.example.com/api/v2/payment/orders?userId=user_123456&page=1&pageSize=20" \
  -H "Authorization: Bearer $TOKEN"
```

### 5.5 响应示例

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "list": [
      {
        "orderNo": "202512311234567890",
        "subject": "VIP会员30天",
        "amount": 99.00,
        "status": 2,
        "payWay": "alipay",
        "tradeNo": "2023123122001234567890",
        "payTime": 1704009700,
        "createdAt": 1704009600
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  }
}
```

---

## 6. 关闭订单

### 6.1 接口信息

- **接口地址**: `POST /api/v2/payment/close/{outTradeNo}`
- **需要认证**: 是
- **说明**: 关闭未支付的订单，已支付的订单无法关闭

### 6.2 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|-------|------|------|------|------|
| outTradeNo | path | string | 是 | 商户订单号 |

### 6.3 请求示例

```bash
curl -X POST "https://api.example.com/api/v2/payment/close/202512311234567890" \
  -H "Authorization: Bearer $TOKEN"
```

### 6.4 响应示例

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "message": "订单关闭成功",
    "orderNo": "202512311234567890",
    "payWay": "alipay"
  }
}
```

---

## 7. 取消订单

### 7.1 接口信息

- **接口地址**: `POST /api/v2/payment/cancel/{outTradeNo}`
- **需要认证**: 是
- **说明**: 用户主动取消未支付的订单，可以记录取消原因

### 7.2 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|-------|------|------|------|------|
| outTradeNo | path | string | 是 | 商户订单号 |
| cancelReason | body | string | 否 | 取消原因 |

### 7.3 请求示例

```bash
curl -X POST "https://api.example.com/api/v2/payment/cancel/202512311234567890" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "cancelReason": "用户不想要了"
  }'
```

### 7.4 响应示例

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "message": "订单取消成功",
    "orderNo": "202512311234567890",
    "payWay": "alipay",
    "cancelReason": "用户不想要了"
  }
}
```

---

## 8. 申请退款

### 8.1 接口信息

- **接口地址**: `POST /api/v2/payment/refund`
- **需要认证**: 是
- **说明**: 对已支付的订单发起退款申请，支持部分退款

### 8.2 请求参数

| 参数名 | 类型 | 必填 | 说明 | 示例 |
|-------|------|------|------|------|
| outTradeNo | string | 是 | 商户订单号 | `202512311234567890` |
| refundAmount | float64 | 是 | 退款金额（元），不能超过订单金额 | `99.00` |
| refundReason | string | 否 | 退款原因 | `用户申请退款` |

### 8.3 请求示例

```bash
curl -X POST "https://api.example.com/api/v2/payment/refund" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "outTradeNo": "202512311234567890",
    "refundAmount": 99.00,
    "refundReason": "用户申请退款"
  }'
```

### 8.4 响应示例

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "message": "退款申请成功",
    "orderNo": "202512311234567890",
    "payWay": "alipay",
    "tradeNo": "2023123122001234567890",
    "refundAmount": 99.00,
    "refundRequestNo": "R202512311234567891"
  }
}
```

---

## 9. 支付回调通知

### 9.1 说明

支付成功后，支付平台（支付宝/微信/PayPal）会向您配置的回调地址发送异步通知。您需要在收到通知后：

1. 验证通知的真实性（平台已自动完成）
2. 根据订单号更新您系统的订单状态
3. 返回成功响应

### 9.2 回调地址

| 支付方式 | 回调地址 |
|---------|---------|
| 支付宝 | `POST /api/v2/payment/notify/alipay` |
| 微信支付 | `POST /api/v2/payment/notify/wechat` |
| PayPal | `POST /api/v2/payment/notify/paypal` |

### 9.3 如何监听支付结果

您有两种方式获取支付结果：

#### 方式1: 轮询查询（推荐用于前端）

```javascript
// 创建订单后，定时查询订单状态
const orderNo = "202512311234567890";
let checkCount = 0;
const maxChecks = 60; // 最多查询60次（5分钟）

const timer = setInterval(async () => {
  checkCount++;
  
  try {
    const response = await fetch(`/api/v2/payment/query/${orderNo}`);
    const data = await response.json();
    
    if (data.data.status === 2) {
      // 支付成功
      clearInterval(timer);
      console.log("支付成功！");
      // 跳转到成功页面
    } else if (data.data.status === 201) {
      // 订单已关闭
      clearInterval(timer);
      console.log("订单已关闭");
    }
  } catch (error) {
    console.error("查询订单失败", error);
  }
  
  if (checkCount >= maxChecks) {
    clearInterval(timer);
    console.log("支付超时");
  }
}, 5000); // 每5秒查询一次
```

#### 方式2: 接收平台的异步通知（推荐用于后端）

平台已自动处理支付回调，您只需要通过轮询查询或实现自己的 Webhook 来监听订单状态变化。

如果您的系统需要实时接收支付通知，建议实现以下流程：

1. 在订单创建时，将订单信息存储到您的数据库
2. 定期（每5-10秒）查询订单状态接口
3. 当订单状态变为"已支付"时，触发后续业务逻辑

---

## 10. 错误码说明

### 10.1 HTTP状态码

| 状态码 | 说明 |
|-------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 401 | 认证失败 |
| 403 | 无权限访问 |
| 404 | 资源不存在 |
| 429 | 请求频率超限 |
| 500 | 服务器内部错误 |

### 10.2 业务错误码

响应中的 `code` 字段：

| 错误码 | 说明 |
|-------|------|
| 200 | 成功 |
| 400 | 参数错误 |
| 401 | 认证失败 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 500 | 系统错误 |

### 10.3 常见错误

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| "认证失败" | 签名错误或应用信息不正确 | 检查 AppId、AppSecret 和签名算法 |
| "时间戳已过期" | 请求时间戳超出允许范围 | 检查系统时间，确保在±5分钟内 |
| "支付金额必须大于0" | amount 参数 ≤ 0 | 检查金额参数 |
| "不支持的支付方式" | payWay 参数不在允许范围内 | 使用 alipay/wechat/paypal |
| "订单不存在或无权限操作" | 订单号不存在或不属于当前应用 | 检查订单号和应用权限 |
| "订单已支付，无法关闭" | 尝试关闭已支付的订单 | 只能关闭未支付的订单 |

---

## 11. SDK 示例

官方未提供 SDK 包，以下为最小 OAuth2 接入示例（以 Go / Python / Node.js 演示）。

### 11.1 Go

```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "time"
)

type Client struct {
    BaseURL      string
    ClientID     string
    ClientSecret string
    Token        string
}

// 1) 换取 access_token
func (c *Client) FetchToken() error {
    body, _ := json.Marshal(map[string]string{
        "grant_type":    "client_credentials",
        "client_id":     c.ClientID,
        "client_secret": c.ClientSecret,
    })
    resp, err := http.Post(c.BaseURL+"/oauth/token", "application/json", bytes.NewReader(body))
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    var r struct {
        AccessToken string `json:"access_token"`
    }
    if err := json.NewDecoder(resp.Body).Decode(&r); err != nil {
        return err
    }
    c.Token = r.AccessToken
    return nil
}

// 2) 下单
func (c *Client) CreatePayment(subject string, amount float64, payWay string) (map[string]any, error) {
    payload, _ := json.Marshal(map[string]any{
        "subject": subject, "amount": amount, "payWay": payWay,
    })
    req, _ := http.NewRequest("POST", c.BaseURL+"/api/v2/payment/pay", bytes.NewReader(payload))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Authorization", "Bearer "+c.Token)

    resp, err := (&http.Client{Timeout: 30 * time.Second}).Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    data, _ := io.ReadAll(resp.Body)
    var out map[string]any
    json.Unmarshal(data, &out)
    return out, nil
}

func main() {
    c := &Client{BaseURL: "http://localhost:8097", ClientID: "your-client-id", ClientSecret: "your-secret"}
    if err := c.FetchToken(); err != nil {
        panic(err)
    }
    res, _ := c.CreatePayment("VIP会员30天", 1.00, "alipay")
    fmt.Printf("%v\n", res)
}
```

### 11.2 Python

```python
import requests

class PaymentClient:
    def __init__(self, base_url, client_id, client_secret):
        self.base_url = base_url.rstrip("/")
        self.client_id = client_id
        self.client_secret = client_secret
        self.token = None

    def fetch_token(self):
        r = requests.post(f"{self.base_url}/oauth/token", json={
            "grant_type": "client_credentials",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
        }, timeout=30)
        r.raise_for_status()
        self.token = r.json()["access_token"]

    @property
    def headers(self):
        return {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}

    def create_payment(self, subject, amount, pay_way):
        r = requests.post(f"{self.base_url}/api/v2/payment/pay",
                          headers=self.headers,
                          json={"subject": subject, "amount": amount, "payWay": pay_way},
                          timeout=30)
        return r.json()

    def query_order(self, order_no):
        r = requests.get(f"{self.base_url}/api/v2/payment/query/{order_no}",
                         headers=self.headers, timeout=30)
        return r.json()

if __name__ == "__main__":
    c = PaymentClient("http://localhost:8097", "your-client-id", "your-secret")
    c.fetch_token()
    print(c.create_payment("VIP会员30天", 1.00, "alipay"))
```

### 11.3 JavaScript / Node.js

```javascript
import axios from 'axios';

class PaymentClient {
  constructor(baseURL, clientId, clientSecret) {
    this.baseURL = baseURL.replace(/\/$/, '');
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.token = null;
  }

  async fetchToken() {
    const { data } = await axios.post(`${this.baseURL}/oauth/token`, {
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    }, { timeout: 30000 });
    this.token = data.access_token;
  }

  get headers() {
    return { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' };
  }

  async createPayment(subject, amount, payWay) {
    const { data } = await axios.post(`${this.baseURL}/api/v2/payment/pay`,
      { subject, amount, payWay }, { headers: this.headers, timeout: 30000 });
    return data;
  }

  async queryOrder(orderNo) {
    const { data } = await axios.get(`${this.baseURL}/api/v2/payment/query/${orderNo}`,
      { headers: this.headers, timeout: 30000 });
    return data;
  }
}

const c = new PaymentClient('http://localhost:8097', 'your-client-id', 'your-secret');
await c.fetchToken();
console.log(await c.createPayment('VIP会员30天', 1.00, 'alipay'));
```

> 生产环境务必使用 HTTPS；令牌默认 1 小时过期，请实现自动刷新。

---

## 附录

### A. 测试环境信息

- **测试地址**: `https://test.your-domain.com`
- **测试应用ID**: `test-app-001`
- **测试密钥**: `test-secret-key-12345678901234567890`
- **支付宝沙箱**: 需要使用支付宝开放平台沙箱环境
- **微信支付测试**: 需要使用微信支付测试环境

### B. 联系支持

- **技术支持邮箱**: support@your-domain.com
- **文档更新日期**: 2025-12-31
- **API版本**: v2.0

### C. 更新日志

#### v2.0 (2025-12-31)
- 新增 PayPal 支付支持
- 优化签名认证机制
- 添加订单列表查询接口
- 完善错误处理和日志记录

#### v1.0 (2024-01-01)
- 首次发布
- 支持支付宝、微信支付
- 基础订单管理功能

---

**注意事项**：

1. **生产环境务必使用 HTTPS**
2. **妥善保管 AppSecret，不要在客户端代码中硬编码**
3. **建议实现请求重试机制，网络可能不稳定**
4. **支付金额单位统一为元（人民币/美元等），保留两位小数**
5. **订单号全局唯一，不可重复使用**
6. **建议对敏感操作（如退款）添加人工审核流程**
