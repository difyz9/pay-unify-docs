---
pageType: home

hero:
  name: Pay-Unify
  text: 统一支付文档中心
  tagline: 后端 Go (Gin) + 前端 Next.js —— 支付宝 / 微信支付 / PayPal / SkillHub X402 的一栈接入与运维文档
  actions:
    - theme: brand
      text: 🚀 快速开始
      link: /guide/quickstart
    - theme: alt
      text: 系统概览
      link: /guide/overview

features:
  - title: 🔐 双轨认证
    details: 管理后台 JWT 会话 + 商户 OAuth2 Client Credentials（scope 最小授权），密钥 bcrypt 存储、可即时吊销与轮换。
  - title: 💳 多支付渠道
    details: 支付宝、微信支付、PayPal 统一下单/查单/关单/退款接口，按订单支付方式自动路由；数据库配置热加载，无需重启。
  - title: 📜 SkillHub X402
    details: 内置 SkillPay 收款端点，Agent / Skill 接入 402 支付流程即可完成扫码付费履约。
  - title: 📊 完整业务域
    details: 订单、用户 / VIP、商品、项目、金币 五大业务域 + 实时数据可视化管理后台。
  - title: 🔑 证书托管
    details: 支付宝 / 微信证书 Web 上传、设默认、热更新，自动落盘 runtime/certs，回退兼容 config.toml 老部署。
  - title: 🚢 多形态部署
    details: Docker / Docker Compose / Supervisor / Vercel / Nginx 反向代理，前端 standalone 输出开箱即用。
---
