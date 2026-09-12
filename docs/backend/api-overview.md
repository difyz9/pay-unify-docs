---
title: API 总览
---

# API 总览

> 本文按路由清单给出全量端点一览（来源：后端 handler 注册代码 + Swagger 注解，swag v2.0.0）。
> 字段级说明、请求 / 响应示例、错误码请查阅：
> - 运行时 Swagger UI：`http://<backend>:<port>/swagger/index.html`
> - [API 集成指南](/backend/api-integration)（OAuth2 商户接入全流程）

## 认证方式速查

| 平面 | 中间件 | 携带方式 | 说明 |
| --- | --- | --- | --- |
| `/api/v1/*` 写操作 | `JWTAuth` | `Authorization: Bearer <jwt>` | 管理员会话（登录接口返回的 token 存在 Cookie `auth_token`，前端自动携带） |
| `/api/v2/*` | `BearerMiddleware.Authenticate` + `RequireScope(scope)` | `Authorization: Bearer <oauth_token>` | 商户 / 第三方应用，按 scope 鉴权 |
| 公开接口 | 无 | — | 见各表中「公开」标注 |

> `admin` scope 自动通过所有 scope 检查（等价超管）。OAuth2 token 默认有效期 1 小时。

## 公共 / 基础设施

| 方法 | 路径 | 认证 | 说明 |
| --- | --- | --- | --- |
| GET | `/` | 公开 | 服务欢迎页 |
| GET | `/health` | 公开 | 健康检查（Docker HEALTHCHECK 使用） |
| GET | `/swagger/*any` | 公开 | Swagger UI |
| GET | `/api/v1/info` | 公开 | 服务信息（版本等） |
| GET | `/api/v1/payment/channels` | 公开 | 三渠道启用状态（`enabled/configured/fromDB/sandbox/reason`） |
| POST | `/oauth/token` | 公开 | OAuth2 换取 token（client_credentials） |
| GET | `/oauth/scopes` | 公开 | 有效 scope 列表（前端「API 应用管理」实时拉取） |
| POST | `/oauth/revoke` | Bearer | 吊销 token |

## 登录 / 账号（JWT）

| 方法 | 路径 | 认证 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/v1/login` | 公开 | 管理员登录 `{username,password}` → JWT |
| POST | `/api/v1/register` | 公开 | 注册（取决于 `Auth.EnableRegister`） |
| POST | `/api/v1/logout` | JWT | 退出登录 |
| GET | `/api/v1/profile` | JWT | 当前用户资料 |
| GET | `/api/v1/verify` | JWT | 校验 token |
| POST | `/api/v1/refresh` | JWT | 刷新 token |

## 支付（Payment）

统一收银接口按订单支付方式自动路由到支付宝 / 微信 / PayPal，支持**统一下单 / 查单 / 关单 / 取消 / 退款**。

| 方法 | 路径 | v1 (JWT) | v2 (OAuth2 scope) |
| --- | --- | --- | --- |
| POST | `/payment/pay` | ✅ | `payment:write` |
| GET | `/payment/query/:outTradeNo` | ✅ | `payment:read` |
| GET | `/payment/orders` | ✅ | `order:read` |
| POST | `/payment/cancel/:outTradeNo` | ✅ | `payment:write` |
| POST | `/payment/close/:outTradeNo` | ✅ | `payment:write` |
| POST | `/payment/refund` | ✅ | `payment:write` |
| POST | `/payment/notify/alipay` | ✅（v1 公开） | v2 公开（渠道回调） |
| POST | `/payment/notify/wechat` | ✅（v1 公开） | v2 公开（渠道回调） |
| POST | `/payment/notify/paypal` | ✅（v1 公开） | v2 公开（渠道回调） |
| GET | `/payment/return/paypal` | 公开 | 公开（PayPal 同步返回） |

> 完整前缀：v1 为 `/api/v1/payment`，v2 为 `/api/v2/payment`。

## 支付渠道配置（数据库热加载）

| 方法 | 路径 | v1 (JWT) | v2 (OAuth2 scope) |
| --- | --- | --- | --- |
| GET | `/payment/config/list` | ✅ | `config:read` |
| GET | `/payment/config/:provider` | ✅ | `config:read` |
| POST | `/payment/config/:provider` | ✅ | `config:write` |
| PUT | `/payment/config/:provider/toggle` | ✅ | `config:write` |
| GET | `/payment/config/audit-logs` | ✅ | — |

> 完整前缀：`/api/v1/payment/config` 与 `/api/v2/payment/config`。保存即热加载，无需重启；
> 配置 / 证书变更会写入审计日志（`tb_payment_audit`）。`provider` ∈ `alipay | wechat | paypal`。

## 证书管理（支付证书）

| 方法 | 路径 | v1 (JWT) | v2 (OAuth2 scope) |
| --- | --- | --- | --- |
| POST | `/certs/upload` | ✅ | `cert:manage` |
| POST | `/certs/upload/file` | ✅ | `cert:manage` |
| POST | `/certs/list` | ✅ | `cert:manage` |
| GET | `/certs/:id` | ✅ | `cert:manage` |
| DELETE | `/certs/:id` | ✅ | `cert:manage` |
| POST | `/certs/:id/default` | ✅ | `cert:manage` |
| GET | `/certs/:id/download` | ✅ | `cert:manage` |

> 完整前缀：`/api/v1` 与 `/api/v2`。证书内容落盘 `runtime/certs/` 并自动回写渠道配置、热加载。

## 订单（Orders）

| 方法 | 路径 | v1 (JWT) | v2 (OAuth2 scope) |
| --- | --- | --- | --- |
| GET | `/orders` | ✅ | `order:read` |
| GET | `/orders/stats` | ✅ | `order:read` |
| GET | `/orders/trend` | ✅ | `order:read` |
| GET | `/orders/payment-stats` | ✅ | `order:read` |
| GET | `/orders/status-stats` | ✅ | `order:read` |
| GET | `/orders/:orderId` | ✅ | `order:read` |
| GET | `/orders/no/:orderNo` | ✅ | `order:read` |
| DELETE | `/orders/:orderId` | ✅ | `order:write` |

> 完整前缀：`/api/v1` 与 `/api/v2`。

## 用户 / 会员（Users）

| 方法 | 路径 | v1 (JWT) | v2 (OAuth2 scope) |
| --- | --- | --- | --- |
| GET | `/users` | ✅ | `user:read` |
| GET | `/users/stats` | ✅ | `user:read` |
| GET | `/users/:userId` | ✅ | `user:read` |
| PUT | `/users/:userId` | ✅ | `user:write` |
| POST | `/users/:userId/vip` | ✅ | `user:write` |
| POST | `/users/:userId/coin` | ✅ | `user:write` |
| PUT | `/users/:userId/status` | ✅ | `user:write` |

> 完整前缀：`/api/v1` 与 `/api/v2`。VIP 会员即 `is_vip = true` 的用户。

## 商品（Products）

| 方法 | 路径 | 公开 | v1 (JWT) | v2 (OAuth2 scope) |
| --- | --- | --- | --- | --- |
| GET | `/products` | ✅ | — | `product:read` |
| GET | `/products/:productId` | ✅ | — | `product:read` |
| POST | `/products` | — | ✅ | `product:write` |
| PUT | `/products/:productId` | — | ✅ | `product:write` |
| DELETE | `/products/:productId` | — | ✅ | `product:write` |
| PUT | `/products/:productId/status` | — | ✅ | `product:write` |

> 完整前缀：`/api/v1` 与 `/api/v2`。读接口公开（商品目录无需鉴权），写接口需 JWT / scope。

## 项目（Projects）

| 方法 | 路径 | v1 (JWT) | v2 (OAuth2 scope) |
| --- | --- | --- | --- |
| GET | `/projects` | ✅ | `project:read` |
| GET | `/projects/stats` | ✅ | `project:read` |
| GET | `/projects/:projectId` | ✅ | `project:read` |
| POST | `/projects` | ✅ | `project:write` |
| PUT | `/projects/:projectId` | ✅ | `project:write` |
| DELETE | `/projects/:projectId` | ✅ | `project:write` |

## 金币（Coins）

| 方法 | 路径 | 公开 | v1 (JWT) | v2 (OAuth2 scope) |
| --- | --- | --- | --- | --- |
| GET | `/coins/records` | — | ✅ | `coin:read` |
| GET | `/coins/stats` | — | ✅ | `coin:read` |
| GET | `/coins/trend` | — | ✅ | `coin:read` |
| GET | `/coin/charge-config` | ✅ | ✅ | 公开（充值配置） |

## API 应用管理（OAuth2 Client CRUD）

提供两条并行入口（解决“创建第一个应用”的引导死锁）：

| 方法 | v1 路径（管理员 JWT，控制台） | v2 路径（Bearer + `apiapp:manage`） | 说明 |
| --- | --- | --- | --- |
| GET | `/api/v1/api-apps` | `/api/v2/api-apps` | 应用列表 |
| GET | `/api/v1/api-apps/:appId` | `/api/v2/api-apps/:appId` | 应用详情 |
| POST | `/api/v1/api-apps` | `/api/v2/api-apps` | 创建应用（生成 client_id / secret） |
| PUT | `/api/v1/api-apps/:appId` | `/api/v2/api-apps/:appId` | 编辑配置 |
| PUT | `/api/v1/api-apps/:appId/status` | `/api/v2/api-apps/:appId/status` | 启用 / 禁用 |
| DELETE | `/api/v1/api-apps/:appId` | `/api/v2/api-apps/:appId` | 删除应用 |

> 控制台「API 应用管理」页面（`/dashboard/api-apps`）走 **v1 管理员 JWT**（无需先持有 API 应用凭证，否则会死锁）；
> v2 供已授权的外部应用调用。密钥**仅创建 / 轮换时一次性展示**（bcrypt 存储）。

## SkillPay（SkillHub X402）

| 方法 | 路径 | v2 (OAuth2 scope) | 说明 |
| --- | --- | --- | --- |
| POST | `/api/v2/skillpay/resource` | `skillpay:call` | 首次调用返回 `402 + L1 支付码`；支付后再调用返回付费内容（X-Out-Trade-No 幂等） |
| GET | `/api/v2/skillpay/query/:outTradeNo` | `skillpay:call` | 查询 SkillPay 订单状态 |
| POST | `/api/v2/skillpay/refund` | `skillpay:refund` | 退款 |

## 会员令牌（Membership Token）

| 方法 | 路径 | v2 (OAuth2 scope) | 说明 |
| --- | --- | --- | --- |
| POST | `/api/v2/membership/issue` | `membership:issue` | 签发会员令牌（付费后） |
| POST | `/api/v2/membership/verify` | `membership:verify` | 验证会员令牌 |

## Scope 全集

创建 API 应用时可勾选的 scope（`GET /oauth/scopes` 实时返回）：

| Scope | 含义 |
| --- | --- |
| `payment:read` / `payment:write` | 查询支付订单 / 创建 · 退款 · 取消 · 关闭 |
| `order:read` / `order:write` | 查询订单列表 / 删除订单 |
| `user:read` / `user:write` | 查询用户 / 修改用户 · VIP · 金币 |
| `product:read` / `product:write` | 查询商品（本身公开）/ 管理商品 |
| `project:read` / `project:write` | 查询项目 / 管理项目 |
| `coin:read` | 查询金币记录 |
| `config:read` / `config:write` | 查看 / 更新支付渠道配置（**管理级，仅授可信应用**） |
| `cert:manage` | 证书上传 / 下载 / 删除（**管理级**） |
| `skillpay:call` / `skillpay:refund` | 调用 SkillPay / 退款 |
| `membership:issue` / `membership:verify` | 签发 / 验证会员令牌 |
| `apiapp:manage` | API 应用 CRUD |
| `admin` | 超级权限，自动通过所有 scope 检查 |

## 订单状态码

| 状态码 | 含义 |
| --- | --- |
| `1` | 待支付 |
| `2` | 已扫码（未支付） |
| `101` | 支付失败 |
| `201` | 已支付 |
| `300` | 已关闭（超时自动关单 / 手动关闭） |
| `400` | 已退款 |

> 前端映射常量见 `frontend/src/constants/options.ts`。过期订单由 `OrderScheduler` 定时任务（每 5 分钟）自动关闭 15 分钟前未支付订单。

## 常见返回结构

后端统一返回结构（多数接口）：`{ "code": 200, "message": "success", "data": {...} }`，分页接口另含 `total / pageNum / pageSize / totalPages`。`code = 200` 表示成功。
