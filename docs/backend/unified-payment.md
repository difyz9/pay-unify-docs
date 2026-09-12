> **维护说明**：本文档已并入本站直接维护（单仓重构后原 `backend/docs/*.md`、前端 `docs/*.md` 不再随仓库发布）。
> 实现细节以 [pay-unify 源码](https://github.com/difyz9/pay-unify) 为准，页面与源码的对应关系见[相关资源](/appendix/resources)。

# 统一支付接口说明

> ⚠️ 认证已迁移为 OAuth2：`/api/v2/*` 用 Bearer token（`POST /oauth/token` 换取），
> `/api/v1/*` 用管理员 JWT。本文中的 GoAuth/X-Sign 示例均为旧写法，已替换。

## 功能概述

已将支付宝和微信的关闭订单、申请退款接口合并为统一接口，通过订单的支付方式自动路由到对应的处理逻辑。

## 优势

✅ **统一API设计** - 一个接口支持所有支付方式  
✅ **自动识别** - 根据订单支付方式自动调用对应服务  
✅ **向后兼容** - 保留原有专用接口  
✅ **易于扩展** - 新增支付方式只需添加case分支  
✅ **减少维护** - 统一的业务逻辑和错误处理  

## 新增统一接口

### 1. 关闭订单（统一接口）

**接口路径：**
```
POST /api/v1/payment/close/{outTradeNo}
POST /api/v2/payment/close/{outTradeNo}
```

**功能说明：**
- 自动识别订单的支付方式（支付宝/微信）
- 调用对应的关闭订单接口
- 更新订单状态为已关闭

**请求参数：**
- Path参数：`outTradeNo` - 商户订单号

**请求头：**
```
Authorization: Bearer <access_token>
```

**响应示例：**
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "message": "订单关闭成功",
    "orderNo": "202501091234567890",
    "payWay": "alipay"
  }
}
```

---

### 2. 申请退款（统一接口）

**接口路径：**
```
POST /api/v1/payment/refund
POST /api/v2/payment/refund
```

**功能说明：**
- 自动识别订单的支付方式（支付宝/微信）
- 调用对应的退款接口
- 支持自定义退款金额
- 自动处理金额单位转换（微信分/支付宝元）

**请求参数：**
```json
{
  "outTradeNo": "202501091234567890",  // 商户订单号（必填）
  "refundAmount": 0.01,                 // 退款金额-元（必填）
  "refundReason": "用户申请退款"         // 退款原因（可选）
}
```

**请求头：**
```
Authorization: Bearer <access_token>
```

**响应示例：**
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "message": "退款申请成功",
    "orderNo": "202501091234567890",
    "payWay": "alipay",
    "tradeNo": "2025123122001234567890",
    "refundAmount": 0.01,
    "refundRequestNo": "R1234567890123456789",
    "result": null
  }
}
```

---

## 旧专用接口（已下线）

早期版本提供的支付宝 / 微信专用接口（`payment/alipay/*`、`payment/wechat/*`）
**已在当前实现中注释下线**，路由不再注册。请统一使用上面的 `payment/close`、`payment/refund` 接口。

> 源码位置：`backend/internal/handler/payment_handler.go`（专用路由已被注释）。

---

## 实现原理

### 关闭订单流程

```
1. 验证应用身份
   ↓
2. 查询订单信息
   ↓
3. 检查订单状态
   ↓
4. 根据 payWay 字段判断
   ├─ alipay → 调用 AlipayService.TradeClose()
   └─ wechat → 调用 WechatPayService.CloseOrder()
   ↓
5. 更新订单状态为已关闭
```

### 退款流程

```
1. 验证应用身份
   ↓
2. 查询订单信息
   ↓
3. 检查订单状态和退款金额
   ↓
4. 生成唯一退款请求号
   ↓
5. 根据 payWay 字段判断
   ├─ alipay → 调用 AlipayService.TradeRefund()
   │            参数：金额单位为元
   └─ wechat → 调用 WechatPayService.Refund()
                参数：金额单位为分（自动转换）
   ↓
6. 更新订单状态为已退款
```

---

## 核心代码

### 关闭订单

```go
// 根据支付方式调用不同的关闭接口
switch order.PayWay {
case "alipay":
    err = h.alipayService.TradeClose(outTradeNo)
case "wechat":
    result := h.WechatPayService.CloseOrder(outTradeNo)
default:
    return error("不支持的支付方式")
}
```

### 申请退款

```go
// 根据支付方式调用不同的退款接口
switch order.PayWay {
case "alipay":
    // 支付宝：金额单位为元
    tradeNo, err = h.alipayService.TradeRefund(AlipayRefundParams{
        RefundAmount: req.RefundAmount,  // 元
    })
case "wechat":
    // 微信：金额单位为分，需要转换
    refundFee := int(req.RefundAmount * 100)  // 元转分
    result, err = h.WechatPayService.Refund(WechatRefundParams{
        RefundFee: refundFee,  // 分
    })
}
```

---

## 使用示例

### 统一关闭订单

```bash
# 先换 Bearer token
TOKEN=$(curl -s -X POST http://localhost:8097/oauth/token \
  -H 'Content-Type: application/json' \
  -d '{"grant_type":"client_credentials","client_id":"your-client-id","client_secret":"your-secret"}' \
  | jq -r .access_token)

# 关闭支付宝订单
curl -X POST 'http://localhost:8097/api/v2/payment/close/202501091234567890' \
  -H "Authorization: Bearer $TOKEN"

# 关闭微信订单（相同接口）
curl -X POST 'http://localhost:8097/api/v2/payment/close/202501099876543210' \
  -H "Authorization: Bearer $TOKEN"
```

### 统一申请退款

```bash
# 支付宝退款
curl -X POST 'http://localhost:8097/api/v2/payment/refund' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "outTradeNo": "202501091234567890",
    "refundAmount": 0.01,
    "refundReason": "用户申请退款"
  }'

# 微信退款（相同接口，相同参数格式）
curl -X POST 'http://localhost:8097/api/v2/payment/refund' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "outTradeNo": "202501099876543210",
    "refundAmount": 1.00,
    "refundReason": "商品质量问题"
  }'
```

---

## 接口对比

| 功能 | 旧专用接口（已下线） | 统一接口 | 说明 |
|------|--------|--------|------|
| 关闭支付宝订单 | `payment/alipay/close/:id` | `payment/close/:id` | 统一接口 |
| 关闭微信订单 | `payment/wechat/close/:id` | `payment/close/:id` | 统一接口 |
| 支付宝退款 | `payment/alipay/refund` | `payment/refund` | 统一接口 |
| 微信退款 | `payment/wechat/refund` | `payment/refund` | 统一接口 |

---

## 扩展支持新支付方式

如需添加新的支付方式（如PayPal），只需：

**1. 在关闭订单接口添加case：**
```go
case "paypal":
    err = h.PaypalService.CloseOrder(outTradeNo)
```

**2. 在退款接口添加case：**
```go
case "paypal":
    result, err = h.PaypalService.Refund(PaypalRefundParams{
        OutTradeNo:   req.OutTradeNo,
        RefundAmount: req.RefundAmount,  // 根据PayPal要求的单位
        RefundReason: req.RefundReason,
    })
```

---

## 注意事项

### 1. 金额单位处理
- **统一接口输入**：金额单位为元（float64）
- **支付宝**：金额单位为元，直接使用
- **微信**：金额单位为分，需要转换（元 × 100）

### 2. 向后兼容
- 旧的专用接口仍然可用
- 建议新项目使用统一接口
- 逐步迁移旧项目到统一接口

### 3. 错误处理
- 统一的错误响应格式
- 详细的错误日志记录
- 返回支付方式信息便于调试

### 4. 权限验证
- 所有接口均需 OAuth2 Bearer 认证（`POST /oauth/token` 换取，见[认证体系](/backend/auth)）
- 自动验证订单归属权
- 只能操作本应用的订单

---

## API文档

访问 Swagger 文档查看完整 API 定义：
- 开发环境：`http://localhost:8097/swagger/index.html`
- 搜索关键词：`payment/close` 或 `payment/refund`

---

## 相关文件

均在 `backend/` 下：

- `internal/handler/payment_handler.go` - 统一接口实现
- `internal/pkg/service/payment/alipay_service.go` - 支付宝服务
- `internal/pkg/service/payment/wepay_service.go` - 微信服务

---

**更新日期：** 2025-12-31  
**版本：** v1.0  
**状态：** 已完成并部署
