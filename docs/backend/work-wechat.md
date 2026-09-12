> **维护说明**：本文档已并入本站直接维护（单仓重构后原 `backend/docs/*.md`、前端 `docs/*.md` 不再随仓库发布）。
> 实现细节以 [pay-unify 源码](https://github.com/difyz9/pay-unify) 为准，页面与源码的对应关系见[相关资源](/appendix/resources)。
> 修改时请先更新仓库内原文件，再同步本页。

# PowerWeChat 接入企业微信通知指南

## 1. 目标

本文档说明如何在本项目中使用 `github.com/ArtisanCloud/PowerWeChat/v3` 接入企业微信通知，并在支付成功后自动发送一条企业微信应用消息。

文档覆盖三部分：

1. PowerWeChat 的基础用法
2. 本项目当前的实现方式
3. 如何自行扩展和排查问题

---

## 2. 本项目当前实现概览

本项目已经完成以下接入：

1. 引入 `PowerWeChat v3`
2. 新增 `WeComNotificationService` 作为企业微信通知服务
3. 在支付成功统一收口 `PaymentHandler.notify(...)` 中触发通知
4. 扩展 `WorkWechatConfig`，用于控制企业微信通知开关和接收人
5. 增加配置校验，避免开启通知后仍缺少关键配置

当前代码位置：

1. 企业微信通知服务：`internal/pkg/service/wecom_notification_service.go`
2. 支付成功通知接入点：`internal/handler/payment_handler.go`
3. 企业微信配置结构：`internal/core/types/config.go`
4. 企业微信配置校验：`internal/pkg/validation/config_validator.go`
5. 配置示例：`config.toml.example`

---

## 3. 为什么使用 PowerWeChat

PowerWeChat 是一个对微信生态接口做过封装的 Go SDK，适合直接调用企业微信的应用消息接口。

在这个场景下，它的价值是：

1. 已经封装好 access token 获取与刷新
2. 已经封装好企业微信应用消息发送接口
3. 不需要手写 HTTP 请求和签名逻辑
4. 适合放在服务层单独封装，和支付逻辑解耦

---

## 4. 版本选择

本项目当前使用：

```go
github.com/ArtisanCloud/PowerWeChat/v3 v3.4.30
```

原因：

1. 项目当前 Go 版本是 `go1.24.4`
2. 直接执行 `go get -u github.com/ArtisanCloud/PowerWeChat/v3` 会把依赖升级到需要 Go 1.25 的版本链
3. `v3.4.30` 可以在当前仓库和当前 Go 版本下正常编译

因此，本项目建议使用：

```bash
go get github.com/ArtisanCloud/PowerWeChat/v3@v3.4.30
```

而不是直接无约束执行：

```bash
go get -u github.com/ArtisanCloud/PowerWeChat/v3
```

---

## 5. 企业微信通知的前提条件

要发送企业微信通知，你需要先在企业微信后台准备好一个“企业应用”，并拿到以下信息：

1. `CorpID`
2. `AgentID`
3. `Secret`
4. 接收消息的成员、部门或标签

在企业微信后台中，应用消息发送本质上依赖这几个参数：

1. 企业 ID
2. 应用 AgentID
3. 应用 Secret
4. `touser` / `toparty` / `totag`

如果这几个参数不完整，就算 SDK 初始化成功，也无法把消息发到正确对象。

---

## 6. PowerWeChat 的最小发送示例

下面是一个最小可运行的企业微信文本消息发送示例，逻辑和本项目采用的方法一致。

```go
package main

import (
	"context"
	"fmt"
	"time"

	powercache "github.com/ArtisanCloud/PowerLibs/v3/cache"
	"github.com/ArtisanCloud/PowerWeChat/v3/src/work"
	wecomrequest "github.com/ArtisanCloud/PowerWeChat/v3/src/work/message/request"
)

func main() {
	app, err := work.NewWork(&work.UserConfig{
		CorpID:       "wwxxxxxxxxxxxxxxxx",
		AgentID:      1000002,
		Secret:       "your_agent_secret",
		ResponseType: "json",
		Cache:        powercache.NewMemCache("demo-wecom", 2*time.Hour, ""),
		Http: work.Http{
			Timeout: 5,
		},
	})
	if err != nil {
		panic(err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	resp, err := app.Message.SendText(ctx, &wecomrequest.RequestMessageSendText{
		RequestMessageSend: wecomrequest.RequestMessageSend{
			ToUser:  "@all",
			MsgType: "text",
			AgentID: 1000002,
		},
		Text: &wecomrequest.RequestText{
			Content: "测试通知：支付成功",
		},
	})
	if err != nil {
		panic(err)
	}

	fmt.Printf("errcode=%d errmsg=%s\n", resp.ErrCode, resp.ErrMsg)
}
```

这个示例里最关键的调用链是：

1. `work.NewWork(...)` 初始化企业微信应用客户端
2. `app.Message.SendText(...)` 发送文本消息

---

## 7. 本项目里是怎么封装的

### 7.1 服务初始化

本项目把企业微信通知封装成了一个独立服务：

```go
type WeComNotificationService struct {
	appConfig *types.AppConfig
	logger    *zap.SugaredLogger
	client    *work.Work
}
```

初始化逻辑在 `NewWeComNotificationService(...)` 中完成。

核心代码逻辑：

```go
client, err := work.NewWork(&work.UserConfig{
	CorpID:       strings.TrimSpace(appConfig.WorkWechatConfig.CorpID),
	AgentID:      appConfig.WorkWechatConfig.AgentID,
	Secret:       strings.TrimSpace(appConfig.WorkWechatConfig.DefaultAgentSecret),
	Token:        strings.TrimSpace(appConfig.WorkWechatConfig.Token),
	AESKey:       strings.TrimSpace(appConfig.WorkWechatConfig.EncodingAESKey),
	ResponseType: "json",
	Cache:        powercache.NewMemCache("pay-unify-wecom", 2*time.Hour, ""),
	Http: work.Http{
		Timeout: 5,
	},
	Debug: appConfig.Debug,
})
```

这里各字段作用如下：

1. `CorpID`：企业微信企业 ID
2. `AgentID`：发送消息使用的企业应用 ID
3. `Secret`：企业应用 Secret
4. `ResponseType`：要求 SDK 使用 JSON 结构处理响应
5. `Cache`：本地内存缓存，用于 access token 缓存
6. `Http.Timeout`：接口调用超时控制

### 7.2 消息发送

发送逻辑在 `SendPaymentSuccessNotification(...)` 中：

```go
request := &wecomrequest.RequestMessageSendText{
	RequestMessageSend: wecomrequest.RequestMessageSend{
		ToUser:                 strings.TrimSpace(s.appConfig.WorkWechatConfig.NotifyToUser),
		ToParty:                strings.TrimSpace(s.appConfig.WorkWechatConfig.NotifyToParty),
		ToTag:                  strings.TrimSpace(s.appConfig.WorkWechatConfig.NotifyToTag),
		MsgType:                "text",
		AgentID:                s.appConfig.WorkWechatConfig.AgentID,
		EnableDuplicateCheck:   1,
		DuplicateCheckInterval: 1800,
	},
	Text: &wecomrequest.RequestText{
		Content: s.buildPaymentSuccessMessage(order),
	},
}

result, err := s.client.Message.SendText(ctx, request)
```

这段代码说明：

1. 使用的是企业微信“应用消息”的文本类型
2. 接收对象支持用户、部门、标签三种范围
3. 开启了重复消息检查，降低重复通知概率
4. 消息内容来自支付订单对象，按文本拼接输出

---

## 8. 为什么要单独封装成服务

不建议把 PowerWeChat 的发送逻辑直接写进支付 handler。

单独封装成 `WeComNotificationService` 的好处：

1. 支付逻辑和通知逻辑解耦
2. 以后可以扩展为短信、邮件、钉钉等多通知渠道
3. 便于单独测试和替换实现
4. 便于在 `fx` 中做统一依赖注入

本项目通过下面这行把服务注入容器：

```go
fx.Provide(service.NewWeComNotificationService)
```

---

## 9. 为什么把通知挂在支付成功统一收口

本项目把支付成功统一收口放在：

```go
func (h *PaymentHandler) notify(orderNo string, tradeNo string) error
```

这个函数负责：

1. 查订单
2. 做并发锁保护
3. 判断是否已支付，避免重复处理
4. 更新订单状态为支付成功
5. 为订阅类订单增加 VIP 天数
6. 发送企业微信通知

通知放在这个位置的原因是：

1. 支付宝、微信支付、PayPal 都会经过这个函数
2. 只需要接一次，就覆盖所有支付渠道
3. 只在真正完成订单成功落库后才发通知
4. 不会在支付预下单阶段误发通知

当前接入逻辑：

```go
if h.WeComNotifier != nil {
	if err := h.WeComNotifier.SendPaymentSuccessNotification(&order); err != nil {
		h.App.SugarLogger.Errorf("发送企业微信支付通知失败: orderNo=%s, err=%v", orderNo, err)
	} else {
		h.App.SugarLogger.Infof("企业微信支付通知发送成功: orderNo=%s", orderNo)
	}
}
```

这里特意做成“通知失败不影响支付主流程”，因为支付成功是核心事务，企业微信通知只是附加能力。

---

## 10. 配置说明

### 10.1 配置结构

当前项目中的企业微信配置结构如下：

```go
type WorkWechatConfig struct {
	Enabled               bool
	CorpID                string
	Token                 string
	EncodingAESKey        string
	DefaultAgentSecret    string
	AgentID               int
	PaymentNotifyEnabled  bool
	NotifyToUser          string
	NotifyToParty         string
	NotifyToTag           string
	CustomerServiceSecret string
}
```

### 10.2 示例配置

你可以在 `config.toml` 中这样配置：

```toml
[WorkWechatConfig]
  Enabled = true
  PaymentNotifyEnabled = true
  CorpID = "wwxxxxxxxxxxxxxxxx"
  AgentID = 1000002
  DefaultAgentSecret = "your_work_wechat_agent_secret"
  Token = ""
  EncodingAESKey = ""
  NotifyToUser = "@all"
  NotifyToParty = ""
  NotifyToTag = ""
  CustomerServiceSecret = ""
```

字段说明：

1. `Enabled`：企业微信能力总开关
2. `PaymentNotifyEnabled`：支付成功通知开关
3. `CorpID`：企业微信企业 ID
4. `AgentID`：企业应用 AgentID
5. `DefaultAgentSecret`：企业应用 Secret
6. `NotifyToUser`：通知成员，多个成员用 `|` 分隔，例如 `zhangsan|lisi`
7. `NotifyToParty`：通知部门，多个部门用 `|` 分隔
8. `NotifyToTag`：通知标签，多个标签用 `|` 分隔

### 10.3 接收对象规则

企业微信应用消息允许三种投递方式：

1. `touser`
2. `toparty`
3. `totag`

本项目要求至少配置其中一项。

校验逻辑已经加在配置验证器中，如果你开启了 `PaymentNotifyEnabled=true`，但没有配置接收人，服务启动时会报错。

---

## 11. 当前通知消息内容

当前发送的是文本消息，内容格式如下：

```text
支付成功通知
应用ID：xxx
订单号：xxx
交易号：xxx
支付方式：wechat
订单主题：VIP会员30天
支付金额：99.00
订单类型：vip
用户ID：user_123
支付时间：2026-03-19 12:00:00
```

消息生成逻辑在：

```go
func (s *WeComNotificationService) buildPaymentSuccessMessage(order *model.TbPaymentOrder) string
```

如果你后续想改成更适合运营看的格式，可以直接修改这个函数。

---

## 12. 如何自己扩展

### 12.1 扩展为模板卡片或富文本

当前是最稳妥的文本消息。如果后续需要更强展示能力，可以考虑：

1. 文本卡片
2. 模板卡片
3. 图文消息

这时只需要替换 `app.Message.SendText(...)` 的请求结构，不需要动支付成功收口逻辑。

### 12.2 扩展为异步发送

如果你担心支付回调里调用企业微信接口增加时延，可以进一步改成异步发送：

1. 回调里只投递一个 goroutine
2. 或者把通知写入队列
3. 由后台 worker 再发送企业微信通知

当前版本没有这么做，是因为：

1. 逻辑更简单
2. 当前只是一条文本消息
3. 已经设置了 10 秒超时
4. 失败不会影响支付主流程

### 12.3 扩展为多业务通知

目前方法名是：

```go
SendPaymentSuccessNotification(order *model.TbPaymentOrder)
```

如果后续要支持退款通知、订单关闭通知、告警通知，可以继续加：

1. `SendRefundNotification(...)`
2. `SendOrderClosedNotification(...)`
3. `SendSystemAlert(...)`

---

## 13. 启用步骤

如果你要在当前仓库里真正启用企业微信通知，按下面顺序即可：

### 步骤 1：配置企业微信应用

在企业微信后台获取：

1. `CorpID`
2. `AgentID`
3. `Secret`

并确认该应用可见范围包含你要接收消息的成员或部门。

### 步骤 2：填写配置文件

在 `config.toml` 中填写：

```toml
[WorkWechatConfig]
  Enabled = true
  PaymentNotifyEnabled = true
  CorpID = "你的 CorpID"
  AgentID = 你的 AgentID
  DefaultAgentSecret = "你的 Secret"
  NotifyToUser = "@all"
```

### 步骤 3：启动服务

```bash
go build . ./internal/...
./pay-unify
```

或者使用你当前仓库的启动方式。

### 步骤 4：触发一次真实支付成功

让订单真正走到：

```go
PaymentHandler.notify(orderNo, tradeNo)
```

成功后会自动发送企业微信通知。

### 步骤 5：检查日志

成功时日志类似：

```text
企业微信支付通知发送成功: orderNo=...
```

失败时日志类似：

```text
发送企业微信支付通知失败: orderNo=..., err=...
```

---

## 14. 常见问题

### Q1：为什么通知没有发出去，但支付成功了？

这是当前设计使然。

企业微信通知是附加能力，支付成功是主流程。为了避免因为企业微信接口波动导致支付回调失败，当前实现是：

1. 先更新订单成功状态
2. 再尝试发送企业微信通知
3. 企业微信发送失败只记日志，不回滚支付成功

### Q2：为什么一定要配置 AgentID？

因为企业微信应用消息是按应用发送的，`AgentID` 用来指定“哪一个企业应用”发出消息。

只有 `CorpID + Secret` 不够，还必须知道发送消息的应用 ID。

### Q3：Token 和 EncodingAESKey 是不是必须？

对于“单向发送应用消息”这个场景，不是必须。

当前保留它们是为了和现有 `WorkWechatConfig` 结构保持一致，也为以后接企业微信回调预留字段。

### Q4：为什么要加本地缓存？

PowerWeChat 在获取 access token 时依赖缓存接口。

当前实现使用：

```go
powercache.NewMemCache("pay-unify-wecom", 2*time.Hour, "")
```

这样可以：

1. 避免每次发消息都重新拉 token
2. 减少接口请求次数
3. 降低 SDK 初始化后的额外复杂度

### Q5：为什么不直接自己发 HTTP 请求？

可以自己写，但没必要。

PowerWeChat 已经把下面这些内容封装好了：

1. token 获取和刷新
2. 企业微信 API 地址
3. 请求结构与响应结构
4. 错误字段映射

在这个项目里，直接复用 SDK 的成本更低，也更稳。

---

## 15. 最小接入结论

如果只看最核心的接入步骤，可以压缩成下面四步：

1. 引入依赖：

```bash
go get github.com/ArtisanCloud/PowerWeChat/v3@v3.4.30
```

2. 初始化企业微信应用：

```go
app, err := work.NewWork(&work.UserConfig{ ... })
```

3. 发送文本消息：

```go
resp, err := app.Message.SendText(ctx, request)
```

4. 把发送调用挂到你的业务成功节点，比如支付成功、退款成功、告警触发等。

---

## 16. 建议

如果你后续还要继续完善这块，建议按这个顺序推进：

1. 先用 `NotifyToUser = "@all"` 跑通链路
2. 再收敛到具体成员或部门
3. 再决定是否改成模板卡片
4. 最后再考虑异步化和失败重试

这条路线最稳，排障成本也最低。
