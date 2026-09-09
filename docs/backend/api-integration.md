> **本文档来源**：pay-unify-backend 仓库的 `docs/API_INTEGRATION_GUIDE.md`（保持与源码同步的权威版本）。
> 修改时请先更新仓库内原文件，再同步本页。

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

- **API Base URL**: `https://api.vtranslink.com/api/v2`
- **协议**: HTTPS
- **数据格式**: JSON
- **字符编码**: UTF-8
- **认证方式**: OAuth2 Client Credentials（`POST /oauth/token` 换 Bearer，见 docs/AUTHENTICATION.md）

### 1.2 支持的支付方式

| 支付方式 | PayWay 值 | 说明 |
|---------|----------|------|
| 支付宝 | `alipay` | 支持PC网页支付、手机网页支付 |
| 微信支付 | `wechat` | 支持Native扫码支付、H5支付 |
| PayPal | `paypal` | 支持多币种国际支付 |

### 1.3 订单状态

| 状态码 | 常量名 | 说明 |
|-------|--------|------|
| 1 | OrderNotPaid | 未支付 |
| 2 | OrderPaidSuccess | 支付成功 |
| 201 | OrderClosed | 已关闭 |
| 202 | OrderRefunded | 已退款 |

---

## 2. 认证机制

### 2.1 认证参数

所有需要认证的接口必须在 HTTP Header 中携带以下参数：

| Header 名称 | 必填 | 说明 | 示例 |
|------------|------|------|------|
| X-App-Id | 是 | 应用ID | `test-app-001` |
| X-Timestamp | 是 | Unix时间戳（秒） | `1704009600` |
| X-Nonce | 是 | 随机字符串（6-32位） | `abc123xyz` |
| X-Sign | 视配置 | 请求签名 | `d8f7a6b5c4e3d2a1...` |

### 2.2 签名算法

#### 步骤1: 构造待签名字符串

```
AppId={AppId}&Nonce={Nonce}&Timestamp={Timestamp}
```

如果 `SignIncludeBody=true`，则需要加上请求体：
```
AppId={AppId}&Nonce={Nonce}&Timestamp={Timestamp}&Body={RequestBody}
```

#### 步骤2: 计算签名

使用 HMAC-SHA256 算法，密钥为 `AppSecret`：

```
Signature = HMAC-SHA256(待签名字符串, AppSecret)
```

然后转换为十六进制小写字符串。

### 2.3 签名示例（Go语言）

```go
package main

import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "fmt"
    "time"
)

func generateSignature(appId, appSecret, nonce string, timestamp int64, body string, includeBody bool) string {
    // 构造待签名字符串
    signStr := fmt.Sprintf("AppId=%s&Nonce=%s&Timestamp=%d", appId, nonce, timestamp)
    
    if includeBody && body != "" {
        signStr += fmt.Sprintf("&Body=%s", body)
    }
    
    // 计算 HMAC-SHA256
    h := hmac.New(sha256.New, []byte(appSecret))
    h.Write([]byte(signStr))
    
    // 转换为十六进制小写字符串
    return hex.EncodeToString(h.Sum(nil))
}

func main() {
    appId := "test-app-001"
    appSecret := "test-secret-key-12345678901234567890"
    nonce := "abc123xyz"
    timestamp := time.Now().Unix()
    body := `{"subject":"测试商品","amount":0.01,"payWay":"alipay"}`
    
    signature := generateSignature(appId, appSecret, nonce, timestamp, body, false)
    fmt.Printf("Signature: %s\n", signature)
}
```

### 2.4 签名示例（Python）

```python
import hmac
import hashlib
import time

def generate_signature(app_id, app_secret, nonce, timestamp, body="", include_body=False):
    # 构造待签名字符串
    sign_str = f"AppId={app_id}&Nonce={nonce}&Timestamp={timestamp}"
    
    if include_body and body:
        sign_str += f"&Body={body}"
    
    # 计算 HMAC-SHA256
    signature = hmac.new(
        app_secret.encode('utf-8'),
        sign_str.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    return signature

# 示例
app_id = "test-app-001"
app_secret = "test-secret-key-12345678901234567890"
nonce = "abc123xyz"
timestamp = int(time.time())
body = '{"subject":"测试商品","amount":0.01,"payWay":"alipay"}'

signature = generate_signature(app_id, app_secret, nonce, timestamp, body, False)
print(f"Signature: {signature}")
```

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
curl -X POST "https://api.vtranslink.com/api/v2/payment/pay" \
  -H "Content-Type: application/json" \
  -H "X-App-Id: test-app-001" \
  -H "X-Timestamp: 1704009600" \
  -H "X-Nonce: abc123xyz" \
  -H "X-Sign: d8f7a6b5c4e3d2a1..." \
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
curl -X POST "https://api.vtranslink.com/api/v2/payment/pay" \
  -H "Content-Type: application/json" \
  -H "X-App-Id: test-app-001" \
  -H "X-Timestamp: 1704009600" \
  -H "X-Nonce: abc123xyz" \
  -H "X-Sign: d8f7a6b5c4e3d2a1..." \
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
curl -X POST "https://api.vtranslink.com/api/v2/payment/pay" \
  -H "Content-Type: application/json" \
  -H "X-App-Id: test-app-001" \
  -H "X-Timestamp: 1704009600" \
  -H "X-Nonce: abc123xyz" \
  -H "X-Sign: d8f7a6b5c4e3d2a1..." \
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
curl -X GET "https://api.vtranslink.com/api/v2/payment/query/202512311234567890"
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
curl -X GET "https://api.vtranslink.com/api/v2/payment/orders?userId=user_123456&page=1&pageSize=20" \
  -H "X-App-Id: test-app-001" \
  -H "X-Timestamp: 1704009600" \
  -H "X-Nonce: abc123xyz" \
  -H "X-Sign: d8f7a6b5c4e3d2a1..."
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
curl -X POST "https://api.vtranslink.com/api/v2/payment/close/202512311234567890" \
  -H "X-App-Id: test-app-001" \
  -H "X-Timestamp: 1704009600" \
  -H "X-Nonce: abc123xyz" \
  -H "X-Sign: d8f7a6b5c4e3d2a1..."
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
curl -X POST "https://api.vtranslink.com/api/v2/payment/cancel/202512311234567890" \
  -H "Content-Type: application/json" \
  -H "X-App-Id: test-app-001" \
  -H "X-Timestamp: 1704009600" \
  -H "X-Nonce: abc123xyz" \
  -H "X-Sign: d8f7a6b5c4e3d2a1..." \
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
curl -X POST "https://api.vtranslink.com/api/v2/payment/refund" \
  -H "Content-Type: application/json" \
  -H "X-App-Id: test-app-001" \
  -H "X-Timestamp: 1704009600" \
  -H "X-Nonce: abc123xyz" \
  -H "X-Sign: d8f7a6b5c4e3d2a1..." \
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

## 11. SDK示例

### 11.1 Go SDK 示例

```go
package main

import (
    "bytes"
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "time"
)

type PaymentClient struct {
    BaseURL   string
    AppId     string
    AppSecret string
}

func NewPaymentClient(baseURL, appId, appSecret string) *PaymentClient {
    return &PaymentClient{
        BaseURL:   baseURL,
        AppId:     appId,
        AppSecret: appSecret,
    }
}

// 生成签名
func (c *PaymentClient) generateSign(nonce string, timestamp int64) string {
    signStr := fmt.Sprintf("AppId=%s&Nonce=%s&Timestamp=%d", c.AppId, nonce, timestamp)
    h := hmac.New(sha256.New, []byte(c.AppSecret))
    h.Write([]byte(signStr))
    return hex.EncodeToString(h.Sum(nil))
}

// 创建支付订单
func (c *PaymentClient) CreatePayment(subject string, amount float64, payWay string) (map[string]interface{}, error) {
    url := fmt.Sprintf("%s/api/v2/payment/pay", c.BaseURL)
    
    // 构造请求体
    reqBody := map[string]interface{}{
        "subject": subject,
        "amount":  amount,
        "payWay":  payWay,
    }
    jsonData, _ := json.Marshal(reqBody)
    
    // 生成认证参数
    nonce := fmt.Sprintf("%d", time.Now().UnixNano())
    timestamp := time.Now().Unix()
    sign := c.generateSign(nonce, timestamp)
    
    // 创建请求
    req, _ := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("X-App-Id", c.AppId)
    req.Header.Set("X-Timestamp", fmt.Sprintf("%d", timestamp))
    req.Header.Set("X-Nonce", nonce)
    req.Header.Set("X-Sign", sign)
    
    // 发送请求
    client := &http.Client{Timeout: 30 * time.Second}
    resp, err := client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    // 解析响应
    body, _ := io.ReadAll(resp.Body)
    var result map[string]interface{}
    json.Unmarshal(body, &result)
    
    return result, nil
}

// 查询订单状态
func (c *PaymentClient) QueryOrder(orderNo string) (map[string]interface{}, error) {
    url := fmt.Sprintf("%s/api/v2/payment/query/%s", c.BaseURL, orderNo)
    
    resp, err := http.Get(url)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    body, _ := io.ReadAll(resp.Body)
    var result map[string]interface{}
    json.Unmarshal(body, &result)
    
    return result, nil
}

// 使用示例
func main() {
    client := NewPaymentClient(
        "https://api.vtranslink.com",
        "test-app-001",
        "test-secret-key-12345678901234567890",
    )
    
    // 创建支付订单
    result, err := client.CreatePayment("VIP会员30天", 99.00, "alipay")
    if err != nil {
        fmt.Printf("创建订单失败: %v\n", err)
        return
    }
    
    fmt.Printf("支付链接: %v\n", result["data"].(map[string]interface{})["payUrl"])
    orderNo := result["data"].(map[string]interface{})["orderNo"].(string)
    
    // 查询订单状态
    time.Sleep(2 * time.Second)
    orderStatus, _ := client.QueryOrder(orderNo)
    fmt.Printf("订单状态: %v\n", orderStatus)
}
```

### 11.2 Python SDK 示例

```python
import hmac
import hashlib
import time
import json
import requests

class PaymentClient:
    def __init__(self, base_url, app_id, app_secret):
        self.base_url = base_url
        self.app_id = app_id
        self.app_secret = app_secret
    
    def _generate_sign(self, nonce, timestamp):
        """生成签名"""
        sign_str = f"AppId={self.app_id}&Nonce={nonce}&Timestamp={timestamp}"
        signature = hmac.new(
            self.app_secret.encode('utf-8'),
            sign_str.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        return signature
    
    def create_payment(self, subject, amount, pay_way):
        """创建支付订单"""
        url = f"{self.base_url}/api/v2/payment/pay"
        
        # 生成认证参数
        nonce = str(int(time.time() * 1000000))
        timestamp = int(time.time())
        sign = self._generate_sign(nonce, timestamp)
        
        # 构造请求
        headers = {
            "Content-Type": "application/json",
            "X-App-Id": self.app_id,
            "X-Timestamp": str(timestamp),
            "X-Nonce": nonce,
            "X-Sign": sign
        }
        
        data = {
            "subject": subject,
            "amount": amount,
            "payWay": pay_way
        }
        
        response = requests.post(url, headers=headers, json=data, timeout=30)
        return response.json()
    
    def query_order(self, order_no):
        """查询订单状态"""
        url = f"{self.base_url}/api/v2/payment/query/{order_no}"
        response = requests.get(url, timeout=30)
        return response.json()

# 使用示例
if __name__ == "__main__":
    client = PaymentClient(
        base_url="https://api.vtranslink.com",
        app_id="test-app-001",
        app_secret="test-secret-key-12345678901234567890"
    )
    
    # 创建支付订单
    result = client.create_payment("VIP会员30天", 99.00, "alipay")
    print(f"支付链接: {result['data']['payUrl']}")
    order_no = result['data']['orderNo']
    
    # 等待2秒后查询订单状态
    time.sleep(2)
    order_status = client.query_order(order_no)
    print(f"订单状态: {order_status}")
```

### 11.3 JavaScript/Node.js SDK 示例

```javascript
const crypto = require('crypto');
const axios = require('axios');

class PaymentClient {
  constructor(baseURL, appId, appSecret) {
    this.baseURL = baseURL;
    this.appId = appId;
    this.appSecret = appSecret;
  }

  // 生成签名
  generateSign(nonce, timestamp) {
    const signStr = `AppId=${this.appId}&Nonce=${nonce}&Timestamp=${timestamp}`;
    const hmac = crypto.createHmac('sha256', this.appSecret);
    hmac.update(signStr);
    return hmac.digest('hex');
  }

  // 创建支付订单
  async createPayment(subject, amount, payWay) {
    const url = `${this.baseURL}/api/v2/payment/pay`;
    
    // 生成认证参数
    const nonce = Date.now().toString();
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = this.generateSign(nonce, timestamp);
    
    // 发送请求
    const response = await axios.post(url, {
      subject,
      amount,
      payWay
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-App-Id': this.appId,
        'X-Timestamp': timestamp.toString(),
        'X-Nonce': nonce,
        'X-Sign': sign
      },
      timeout: 30000
    });
    
    return response.data;
  }

  // 查询订单状态
  async queryOrder(orderNo) {
    const url = `${this.baseURL}/api/v2/payment/query/${orderNo}`;
    const response = await axios.get(url, { timeout: 30000 });
    return response.data;
  }
}

// 使用示例
(async () => {
  const client = new PaymentClient(
    'https://api.vtranslink.com',
    'test-app-001',
    'test-secret-key-12345678901234567890'
  );
  
  try {
    // 创建支付订单
    const result = await client.createPayment('VIP会员30天', 99.00, 'alipay');
    console.log('支付链接:', result.data.payUrl);
    const orderNo = result.data.orderNo;
    
    // 等待2秒后查询订单状态
    await new Promise(resolve => setTimeout(resolve, 2000));
    const orderStatus = await client.queryOrder(orderNo);
    console.log('订单状态:', orderStatus);
  } catch (error) {
    console.error('错误:', error.message);
  }
})();
```

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
