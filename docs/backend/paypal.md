> **本文档来源**：pay-unify-backend 仓库的 `docs/PAYPAL_INTEGRATION.md`（保持与源码同步的权威版本）。
> 修改时请先更新仓库内原文件，再同步本页。

# PayPal 集成文档

本文档描述了如何在支付服务中集成和使用 PayPal 支付功能。

## 功能特性

- ✅ 支持创建 PayPal 订单
- ✅ 支持多种货币（USD、EUR、GBP、JPY、CNY等20种货币）
- ✅ 支持订单支付捕获
- ✅ 支持 Webhook 异步通知
- ✅ 支持同步返回处理
- ✅ 支持订单状态查询
- ✅ 沙箱和生产环境切换

## 配置说明

### 1. 配置文件设置

在 `config_payment.toml` 中配置 PayPal 相关参数：

```toml
# PayPal配置
[PaypalConfig]
Enabled = true                                              # 是否启用PayPal支付
SandBox = true                                              # 是否使用沙箱环境
ClientId = "your-paypal-client-id"                         # PayPal应用ClientID
Secret = "your-paypal-secret"                               # PayPal应用Secret
NotifyURL = "https://api.vtranslink.com/api/v1/notify/paypal"  # Webhook通知地址
ReturnURL = "https://api.vtranslink.com/payment/success"       # 支付成功返回地址
```

### 2. PayPal 开发者账号设置

1. 访问 [PayPal Developer](https://developer.paypal.com/)
2. 创建应用程序获取 ClientID 和 Secret
3. 配置 Webhook 端点：`https://api.vtranslink.com/api/v1/notify/paypal`
4. 启用以下 Webhook 事件：
   - `PAYMENT.CAPTURE.COMPLETED`
   - `CHECKOUT.ORDER.APPROVED`

## API 接口

### 1. 创建支付订单

**接口地址**: `POST /api/v1/payment/pay`

**请求参数**:
```json
{
    "subject": "Test Product",                              // 商品标题
    "amount": 10.00,                                        // 支付金额
    "payWay": "paypal",                                     // 支付方式
    "currency": "USD",                                      // 货币代码（可选，默认USD）
    "brandName": "My Store",                                // 品牌名称（可选）
    "cancelUrl": "https://mystore.com/cancel",             // 取消支付返回地址（可选）
    "userId": "user123",                                    // 用户ID（可选）
    "orderType": "product",                                 // 订单类型（可选）
    "extra": "{\"productId\":\"123\"}"                     // 额外信息（可选）
}
```

**响应结果**:
```json
{
    "code": 200,
    "data": {
        "payUrl": "https://www.sandbox.paypal.com/checkoutnow?token=...",
        "orderNo": "202501121234567890",
        "orderId": "paypal-order-id-xxx",
        "currency": "USD"
    },
    "message": "Success"
}
```

### 2. 捕获支付

**接口地址**: `POST /api/v1/payment/paypal/capture/{orderId}`

**路径参数**:
- `orderId`: PayPal订单ID

**响应结果**:
```json
{
    "code": 200,
    "data": {
        "status": 0,
        "outTradeNo": "202501121234567890",
        "tradeId": "capture-id-xxx",
        "amount": "10.00",
        "subject": "Test Product",
        "message": "OK"
    },
    "message": "Success"
}
```

### 3. 查询订单状态

**接口地址**: `GET /api/v1/payment/query/{outTradeNo}`

**路径参数**:
- `outTradeNo`: 商户订单号

## 支付流程

### 标准支付流程

1. **创建订单**: 调用创建支付订单接口，获取 PayPal 支付链接
2. **用户支付**: 用户通过支付链接完成 PayPal 支付
3. **支付确认**: 用户支付完成后返回到指定页面
4. **捕获支付**: 调用捕获接口确认收款
5. **异步通知**: PayPal 发送 Webhook 通知确认支付状态

### Webhook 通知

PayPal 支持以下事件通知：

- `CHECKOUT.ORDER.APPROVED`: 订单已批准（用户完成支付授权）
- `PAYMENT.CAPTURE.COMPLETED`: 支付捕获完成（资金到账）

## 支持的货币

PayPal 支持以下20种货币：

- USD（美元）
- EUR（欧元）
- GBP（英镑）
- JPY（日元）
- CAD（加拿大元）
- AUD（澳大利亚元）
- CHF（瑞士法郎）
- CNY（人民币）
- SEK（瑞典克朗）
- NZD（新西兰元）
- MXN（墨西哥比索）
- SGD（新加坡元）
- HKD（港币）
- NOK（挪威克朗）
- DKK（丹麦克朗）
- PLN（波兰兹罗提）
- CZK（捷克克朗）
- HUF（匈牙利福林）
- ILS（以色列新谢克尔）
- BRL（巴西雷亚尔）

## 测试说明

### 沙箱测试

1. 在 PayPal Developer 创建沙箱应用
2. 设置 `SandBox = true`
3. 使用沙箱账号进行测试
4. 沙箱测试卡号：
   - Visa: 4111111111111111
   - MasterCard: 5555555555554444

### 生产环境

1. 在 PayPal Developer 创建生产应用
2. 设置 `SandBox = false`
3. 配置生产环境的 ClientID 和 Secret
4. 配置生产环境的 Webhook 地址

## 错误处理

常见错误及处理方法：

### 1. 货币不支持
```json
{
    "code": 400,
    "message": "不支持的货币类型: XXX"
}
```

### 2. PayPal 服务未启用
```json
{
    "code": 400,
    "message": "PayPal支付未启用"
}
```

### 3. 订单创建失败
```json
{
    "code": 400,
    "message": "error with create PayPal order: ..."
}
```

### 4. 捕获支付失败
```json
{
    "code": 400,
    "message": "捕获支付失败: ..."
}
```

## 安全建议

1. **验证 Webhook**: 生产环境中应验证 PayPal Webhook 签名
2. **HTTPS**: 所有回调地址必须使用 HTTPS
3. **幂等性**: 处理重复的 Webhook 通知
4. **日志记录**: 记录所有支付相关的操作日志
5. **金额验证**: 验证回调中的金额与订单金额一致

## 技术实现

本 PayPal 集成基于 [gopay](https://github.com/go-pay/gopay) 库实现，具体技术细节：

- 使用 PayPal Orders API v2
- 支持 Intent: CAPTURE 模式
- 实现了完整的订单生命周期管理
- 提供了灵活的配置选项
- 集成了完善的错误处理机制

## 相关文件

- `internal/pkg/service/payment/paypal_service.go`: PayPal 服务实现
- `internal/core/types/config.go`: 配置结构定义
- `internal/handler/payment_handler.go`: 支付处理器
- `config_payment.toml`: 配置文件模板

## 更新日志

- 2025-01-12: 初始版本，实现基本的 PayPal 支付功能
- 支持创建订单、捕获支付、Webhook 通知等核心功能
- 支持20种主要货币
- 提供完整的 API 接口和文档
