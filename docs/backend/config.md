> **本文档来源**：pay-unify-backend 仓库的 `docs/CONFIG_GUIDE.md`（保持与源码同步的权威版本）。
> 修改时请先更新仓库内原文件，再同步本页。

# 配置文件使用说明

本项目包含以下配置文件：

## 配置文件列表

### 1. `config.toml.example` ✅ 示例配置文件
- **用途**: 配置模板，包含所有可配置项的说明
- **状态**: 已纳入版本控制
- **说明**: 所有敏感信息已替换为占位符，安全可分享

### 2. `config-dev.toml` ⚠️ 开发配置文件
- **用途**: 开发环境的配置示例
- **状态**: 已纳入版本控制
- **说明**: 仅供参考，不包含真实生产密钥

### 3. `config.toml` 🔒 实际配置文件
- **用途**: 实际使用的配置文件
- **状态**: **已添加到 .gitignore，不会被提交**
- **说明**: 包含真实密钥和密码，必须保密

## 快速开始

### 方式一：使用示例配置（推荐）

```bash
# 1. 复制示例配置文件
cp config.toml.example config.toml

# 2. 编辑配置文件，填入真实的配置信息
vim config.toml  # 或使用您喜欢的编辑器

# 3. 必须修改的配置项：
#    - MysqlDns: 数据库连接
#    - Session.SecretKey: Session 密钥
#    - JWT.SecretKey: JWT 密钥
#    - Auth.PasswordSalt: 密码盐值
#    - 支付配置（至少一种）
```

### 方式二：使用开发配置

```bash
# 1. 复制开发配置文件
cp config-dev.toml config.toml

# 2. 根据需要修改配置
vim config.toml
```

## 配置项说明

### 必须配置项 ⚠️

这些配置项必须正确设置才能运行服务：

1. **数据库连接** (`MysqlDns`)
   ```toml
   MysqlDns = "username:password@tcp(host:port)/database?charset=utf8mb4&parseTime=True&loc=Local"
   ```

2. **Session 密钥** (`Session.SecretKey`)
   ```toml
   [Session]
   SecretKey = "至少32位的随机字符串"
   ```

3. **JWT 密钥** (`JWT.SecretKey`)
   ```toml
   [JWT]
   SecretKey = "至少32位的随机字符串"
   ```

4. **密码加密盐值** (`Auth.PasswordSalt`)
   ```toml
   [Auth]
   PasswordSalt = "您的唯一盐值字符串"
   ```

### 支付配置

至少启用一种支付方式：

#### 支付宝配置
```toml
[AlipayConfig]
Enabled = true
SandBox = false  # 生产环境设为 false
AppId = "您的支付宝应用ID"
PrivateKey = "/path/to/certs/alipay/privateKey.txt"
# ... 其他配置
```

#### 微信支付配置
```toml
[WechatPayConfig]
Enabled = true
AppId = "您的微信AppId"
MchId = "您的商户号"
# ... 其他配置
```

#### PayPal 配置
```toml
[PaypalConfig]
Enabled = true
SandBox = false  # 生产环境设为 false
ClientId = "您的PayPal ClientId"
Secret = "您的PayPal Secret"
```

### 可选配置

所有支付方式都是可选的，您可以根据业务需求选择启用：

- **支付宝**: 适合国内用户
- **微信支付**: 适合国内用户，特别是移动端
- **PayPal**: 适合国际用户

建议至少启用一种支付方式。

## 安全建议

### 1. 密钥生成

使用随机字符串作为密钥：

```bash
# 生成随机密钥（Linux/Mac）
openssl rand -hex 32

# 或使用 Python
python3 -c "import secrets; print(secrets.token_hex(32))"

# 或使用在线工具
# https://www.random.org/strings/
```

### 2. 证书文件

将支付平台的证书文件放在正确位置：

```
certs/
├── alipay/
│   ├── privateKey.txt
│   ├── appCertPublicKey.crt
│   ├── alipayCertPublicKey.crt
│   └── alipayRootCert.crt
└── wechat/
    └── apiclient_key_pkcs8.pem
```

### 3. 权限设置

```bash
# 设置配置文件权限（仅所有者可读写）
chmod 600 config.toml

# 设置证书文件权限
chmod 600 certs/alipay/*
chmod 600 certs/wechat/*
```

### 4. 环境区分

- **开发环境**: 使用沙箱模式 (`SandBox = true`)
- **测试环境**: 使用独立的数据库和支付账号
- **生产环境**: 
  - `SandBox = false`
  - `Debug = false`
  - 使用 HTTPS
  - 启用防火墙

## 常见问题

### Q1: config.toml 会被提交到 Git 吗？

**不会**。`config.toml` 已添加到 `.gitignore`，不会被 Git 跟踪。

验证方法：
```bash
git check-ignore -v config.toml
# 应该显示: .gitignore:11:config.toml    config.toml
```

### Q2: 如何在服务器上部署配置？

在服务器上手动创建 `config.toml`：

```bash
# 方式1: 从本地上传（注意安全）
scp config.toml user@server:/path/to/project/

# 方式2: 在服务器上创建
ssh user@server
cd /path/to/project
vim config.toml  # 手动填写配置
```

### Q3: 多环境如何管理配置？

建议使用环境变量或配置管理工具：

```bash
# 开发环境
cp config-dev.toml config.toml

# 测试环境
cp config-test.toml config.toml

# 生产环境
cp config-prod.toml config.toml
```

或使用符号链接：
```bash
ln -s config-prod.toml config.toml
```

### Q4: 忘记修改配置项会怎样？

服务启动时会进行配置验证：
- 缺少必要配置会报错并退出
- 支付配置错误会导致支付失败
- 建议启动后测试所有功能

## 配置验证

启动服务前验证配置：

```bash
# 启动服务
go run main.go

# 查看日志
tail -f logs/app.log

# 检查配置是否加载成功
# 应该看到类似输出：
# [INFO] 配置文件加载成功
# [INFO] 数据库连接成功
# [INFO] 支付宝配置已启用
```

## 配置文件模板

如需自定义配置模板，可参考 `config.toml.example` 文件中的注释说明。

---

## 获取帮助

如有配置问题：
1. 查看 [README.md](README.md) 快速开始部分
2. 查看 [docs/API_DOC.md](docs/API_DOC.md) API 文档
3. 提交 Issue: https://github.com/difyz9/pay-unify/issues

**请不要在 Issue 中泄露真实的密钥和密码！**
