import { defineConfig } from 'rspress/config';

export default defineConfig({
  // 内容目录默认取 <root>/docs（本文件位于 my_pay/docs/rspress.config.ts，
  // 因此 markdown 内容位于 my_pay/docs/docs/）
  title: 'Pay-Unify · 统一支付文档中心',
  description:
    'pay-unify 统一支付服务：后端 Go (Gin) + 前端 Next.js，覆盖支付宝 / 微信支付 / PayPal / SkillHub X402 的完整支付解决方案文档',
  lang: 'zh-CN',
  logoText: 'PayHub Docs',
  themeConfig: {
    outlineTitle: '本页目录',
    lastUpdated: true,
    lastUpdatedText: '最后更新于',
    prevPageText: '上一页',
    nextPageText: '下一页',
    search: true,
    searchPlaceholderText: '搜索文档…',
    searchNoResultsText: '未找到相关结果',
    searchSuggestedQueryText: '可尝试以下关键字',
    docFooter: { prev: '上一页', next: '下一页' },
    footer: {
      message:
        'PayHub Docs · Pay-Unify 统一支付平台文档 · 由仓库 docs/ 同步维护',
    },
    nav: [
      { text: '首页', link: '/' },
      { text: '指南', link: '/guide/overview' },
      { text: '后端', link: '/backend/auth' },
      { text: '前端', link: '/frontend/overview' },
      { text: '部署', link: '/deployment/backend' },
      { text: '附录', link: '/changelog' },
    ],
    sidebar: {
      '/': [
        {
          text: '指南',
          items: [
            { text: '系统概览', link: '/guide/overview' },
            { text: '快速开始', link: '/guide/quickstart' },
          ],
        },
        {
          text: '后端',
          items: [
            { text: '认证体系', link: '/backend/auth' },
            { text: '配置说明', link: '/backend/config' },
            { text: 'API 总览', link: '/backend/api-overview' },
            { text: 'API 集成指南', link: '/backend/api-integration' },
            { text: '统一支付接口', link: '/backend/unified-payment' },
            { text: 'PayPal 集成', link: '/backend/paypal' },
            { text: 'X402 / SkillPay', link: '/backend/x402' },
            { text: '证书管理', link: '/backend/certs' },
            { text: '企业微信通知', link: '/backend/work-wechat' },
            { text: 'SDK 与示例', link: '/backend/sdk' },
          ],
        },
        {
          text: '前端',
          items: [
            { text: '前端概览', link: '/frontend/overview' },
            { text: '前端性能指南', link: '/frontend/performance' },
          ],
        },
        {
          text: '部署',
          items: [
            { text: '后端部署', link: '/deployment/backend' },
            { text: '前端部署', link: '/deployment/frontend' },
          ],
        },
        {
          text: '附录',
          items: [
            { text: '更新日志', link: '/changelog' },
            { text: '相关资源', link: '/appendix/resources' },
          ],
        },
      ],
    },
  },
  markdown: {
    // 代码块显示行号
    showLineNumbers: true,
  },
});
