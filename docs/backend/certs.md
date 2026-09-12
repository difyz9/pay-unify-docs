> **维护说明**：本文档已并入本站直接维护（单仓重构后原 `backend/docs/*.md`、前端 `docs/*.md` 不再随仓库发布）。
> 实现细节以 [pay-unify 源码](https://github.com/difyz9/pay-unify) 为准，页面与源码的对应关系见[相关资源](/appendix/resources)。
> 修改时请先更新仓库内原文件，再同步本页。

# 支付证书管理使用指南

## 概述

本项目参考 1Panel 的证书管理方式，实现了友好的支付证书管理功能。支持通过Web界面上传、管理和应用支付证书，无需手动配置文件路径。

## 功能特点

1. **多种上传方式**
   - 粘贴证书内容（适合复制粘贴证书文本）
   - 选择本地文件路径（适合证书已在服务器上）
   - 上传证书文件（适合从本地上传）

2. **证书验证**
   - 自动验证证书格式（PEM格式）
   - 解析证书有效期、颁发者等信息
   - 检测证书类型（RSA、EC等）

3. **证书管理**
   - 证书列表查看（分页、筛选）
   - 设置默认证书
   - 证书下载
   - 证书删除（软删除）

4. **自动应用**
   - 支付服务自动从数据库加载证书
   - 支持证书热更新（无需重启服务）
   - 自动保存到临时目录供SDK使用

## 数据模型

### 证书表结构 (`tb_payment_cert`)

```go
type PaymentCert struct {
    ID              uint       // 证书ID
    Name            string     // 证书名称
    Description     string     // 证书描述
    CertType        string     // 证书类型: alipay, wechat, paypal
    FileType        string     // 文件类型: app_private_key, app_public_key, etc.
    Content         string     // 证书内容（PEM格式）
    FilePath        string     // 文件路径（可选）
    Status          string     // 状态: active, expired, disabled
    IsDefault       bool       // 是否为默认证书
    ExpireDate      *time.Time // 过期时间
    Issuer          string     // 颁发者
    SerialNumber    string     // 序列号
    AppID           string     // 关联的应用ID
    MchID           string     // 关联的商户ID
    AppliedAt       *time.Time // 应用时间
    AppliedBy       string     // 应用人
}
```

## API 接口

### 1. 上传证书（JSON方式）

**接口**: `POST /api/v1/certs/upload`

**请求体**:
```json
{
  "name": "支付宝生产环境应用私钥",
  "description": "2024年12月申请的应用私钥",
  "certType": "alipay",
  "fileType": "app_private_key",
  "uploadType": "paste",
  "content": "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----",
  "appId": "2021001234567890",
  "isDefault": true
}
```

**参数说明**:
- `certType`: 证书类型，可选值: `alipay`（支付宝）, `wechat`（微信）, `paypal`
- `fileType`: 文件类型
  - 支付宝: `app_private_key`, `app_public_key`, `alipay_public_key`, `root_cert`
  - 微信: `private_key`, `serial_no`
- `uploadType`: 上传方式，可选值: `paste`（粘贴）, `local`（本地路径）, `upload`（文件上传）

**响应**:
```json
{
  "message": "证书上传成功",
  "data": {
    "id": 1,
    "name": "支付宝生产环境应用私钥",
    "certType": "alipay",
    "fileType": "app_private_key",
    "status": "active",
    "isDefault": true,
    "createdAt": "2024-12-31T12:00:00Z"
  }
}
```

### 2. 上传证书文件

**接口**: `POST /api/v1/certs/upload/file`

**Content-Type**: `multipart/form-data`

**表单字段**:
- `name`: 证书名称
- `description`: 证书描述
- `certType`: 证书类型
- `fileType`: 文件类型
- `appId`: 应用ID（可选）
- `mchId`: 商户ID（可选）
- `isDefault`: 是否默认（true/false）
- `file`: 证书文件

**cURL示例**:
```bash
curl -X POST http://localhost:8080/api/v1/certs/upload/file \
  -F "name=支付宝应用私钥" \
  -F "certType=alipay" \
  -F "fileType=app_private_key" \
  -F "appId=2021001234567890" \
  -F "isDefault=true" \
  -F "file=@/path/to/privateKey.txt"
```

### 3. 获取证书列表

**接口**: `POST /api/v1/certs/list`

**请求体**:
```json
{
  "certType": "alipay",
  "page": 1,
  "pageSize": 10
}
```

**响应**:
```json
{
  "data": {
    "list": [
      {
        "id": 1,
        "name": "支付宝应用私钥",
        "certType": "alipay",
        "fileType": "app_private_key",
        "status": "active",
        "isDefault": true,
        "appId": "2021001234567890",
        "createdAt": "2024-12-31T12:00:00Z"
      }
    ],
    "total": 5,
    "page": 1,
    "pageSize": 10
  }
}
```

### 4. 获取证书详情

**接口**: `GET /api/v1/certs/:id`

**响应**:
```json
{
  "data": {
    "id": 1,
    "name": "支付宝应用私钥",
    "description": "生产环境使用",
    "certType": "alipay",
    "fileType": "app_private_key",
    "status": "active",
    "isDefault": true,
    "appId": "2021001234567890",
    "expireDate": "2025-12-31T23:59:59Z",
    "createdAt": "2024-12-31T12:00:00Z"
  }
}
```

### 5. 设置默认证书

**接口**: `POST /api/v1/certs/:id/default`

**响应**:
```json
{
  "message": "设置默认证书成功"
}
```

### 6. 删除证书

**接口**: `DELETE /api/v1/certs/:id`

**响应**:
```json
{
  "message": "证书删除成功"
}
```

### 7. 下载证书

**接口**: `GET /api/v1/certs/:id/download`

**响应**: 证书文件下载

## 使用场景

### 场景1: 初次配置支付宝证书

1. **上传应用私钥**
```bash
curl -X POST http://localhost:8080/api/v1/certs/upload \
  -H "Content-Type: application/json" \
  -d '{
    "name": "支付宝应用私钥",
    "certType": "alipay",
    "fileType": "app_private_key",
    "uploadType": "paste",
    "content": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----",
    "appId": "2021001234567890",
    "isDefault": true
  }'
```

2. **上传应用公钥证书**
```bash
curl -X POST http://localhost:8080/api/v1/certs/upload \
  -H "Content-Type: application/json" \
  -d '{
    "name": "支付宝应用公钥证书",
    "certType": "alipay",
    "fileType": "app_public_key",
    "uploadType": "paste",
    "content": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
    "appId": "2021001234567890",
    "isDefault": true
  }'
```

3. **上传支付宝公钥证书**
```bash
curl -X POST http://localhost:8080/api/v1/certs/upload \
  -H "Content-Type: application/json" \
  -d '{
    "name": "支付宝公钥证书",
    "certType": "alipay",
    "fileType": "alipay_public_key",
    "uploadType": "paste",
    "content": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
    "appId": "2021001234567890",
    "isDefault": true
  }'
```

4. **上传支付宝根证书**
```bash
curl -X POST http://localhost:8080/api/v1/certs/upload \
  -H "Content-Type: application/json" \
  -d '{
    "name": "支付宝根证书",
    "certType": "alipay",
    "fileType": "root_cert",
    "uploadType": "paste",
    "content": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
    "appId": "2021001234567890",
    "isDefault": true
  }'
```

### 场景2: 配置微信支付证书

1. **上传商户私钥**
```bash
curl -X POST http://localhost:8080/api/v1/certs/upload/file \
  -F "name=微信商户私钥" \
  -F "certType=wechat" \
  -F "fileType=private_key" \
  -F "mchId=1234567890" \
  -F "isDefault=true" \
  -F "file=@apiclient_key.pem"
```

2. **上传证书序列号**
```bash
curl -X POST http://localhost:8080/api/v1/certs/upload \
  -H "Content-Type: application/json" \
  -d '{
    "name": "微信证书序列号",
    "certType": "wechat",
    "fileType": "serial_no",
    "uploadType": "paste",
    "content": "1DDE55AD98ED71D6EDD4A4A16996DE7B47773A8C",
    "mchId": "1234567890",
    "isDefault": true
  }'
```

### 场景3: 证书更新

1. **查看当前证书列表**
```bash
curl -X POST http://localhost:8080/api/v1/certs/list \
  -H "Content-Type: application/json" \
  -d '{"certType": "alipay", "page": 1, "pageSize": 10}'
```

2. **上传新证书（不设为默认）**
```bash
curl -X POST http://localhost:8080/api/v1/certs/upload \
  -H "Content-Type: application/json" \
  -d '{
    "name": "支付宝新应用私钥",
    "certType": "alipay",
    "fileType": "app_private_key",
    "uploadType": "paste",
    "content": "...",
    "appId": "2021001234567890",
    "isDefault": false
  }'
```

3. **测试新证书无误后，设置为默认**
```bash
curl -X POST http://localhost:8080/api/v1/certs/123/default
```

4. **删除旧证书**
```bash
curl -X DELETE http://localhost:8080/api/v1/certs/1
```

## 代码集成

### 使用基于证书管理的支付服务

```go
import (
    "github.com/difyz9/pay-unify/internal/pkg/service/payment"
    "gorm.io/gorm"
)

// 创建支付宝服务
func createAlipayService(db *gorm.DB) (*payment.CertBasedAlipayService, error) {
    return payment.NewCertBasedAlipayService(
        db,
        "2021001234567890", // AppID
        false,              // sandbox=false表示生产环境
    )
}

// 创建微信支付服务
func createWechatService(db *gorm.DB) (*payment.CertBasedWechatService, error) {
    return payment.NewCertBasedWechatService(
        db,
        "1234567890",    // 商户号
        "your-api-v3-key", // API V3密钥
    )
}

// 使用证书辅助工具
func useCertHelper(db *gorm.DB) {
    helper := payment.NewCertHelper(db)
    
    // 验证支付宝证书是否完整
    if err := helper.ValidateAlipayCerts(); err != nil {
        log.Printf("支付宝证书不完整: %v", err)
        return
    }
    
    // 获取证书内容
    privateKey, err := helper.GetAlipayPrivateKey()
    if err != nil {
        log.Printf("获取私钥失败: %v", err)
        return
    }
    
    // 获取证书文件路径
    certPath, err := helper.GetCertPath("alipay", "root_cert")
    if err != nil {
        log.Printf("获取证书路径失败: %v", err)
        return
    }
}
```

## 安全建议

1. **证书权限控制**
   - 建议为证书管理API添加管理员权限验证
   - 数据库中的证书内容字段应加密存储

2. **证书备份**
   - 定期备份证书数据
   - 保留证书更新历史

3. **证书有效期监控**
   - 定期检查证书有效期
   - 证书即将过期时发送告警

4. **默认证书保护**
   - 默认证书不允许直接删除
   - 必须先设置其他证书为默认，才能删除原默认证书

## 数据库表自动创建

项目启动时会自动创建 `tb_payment_cert` 表，无需手动创建。

## Swagger文档

启动服务后，访问 `http://localhost:8080/swagger/index.html` 查看完整的API文档。

## 注意事项

1. **证书格式**: 所有证书必须是PEM格式
2. **私钥安全**: 私钥内容存储在数据库中，请确保数据库安全
3. **文件清理**: 临时目录中的证书文件会在服务重启时重新生成
4. **证书更新**: 更新证书后，支付服务会自动重新加载（热更新）

## 与1Panel的差异

本实现参考了1Panel的证书管理设计，但针对支付场景做了以下调整：

1. **证书类型**: 支持支付宝、微信、PayPal等支付平台证书
2. **文件类型**: 针对每种支付方式定义了特定的证书文件类型
3. **自动应用**: 证书上传后自动应用到支付服务，无需手动配置
4. **默认证书**: 支持设置默认证书，简化配置
5. **AppID关联**: 支持多个应用使用不同的证书

## 问题排查

### 1. 证书上传失败

检查证书格式是否为PEM格式：
```bash
# 正确的PEM格式示例
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
-----END RSA PRIVATE KEY-----
```

### 2. 支付服务初始化失败

确保已上传所有必需的证书：
- 支付宝: app_private_key, root_cert, alipay_public_key
- 微信: private_key, serial_no

### 3. 证书未生效

检查证书是否设置为默认：
```bash
curl -X POST http://localhost:8080/api/v1/certs/:id/default
```

## 后续优化

- [ ] 添加证书有效期监控
- [ ] 实现证书自动轮换
- [ ] 添加证书使用日志
- [ ] 支持证书版本管理
- [ ] 实现证书加密存储
