> **本文档来源**：pay-unify-frontend 仓库的 `docs/FRONTEND_PERFORMANCE_GUIDE.md`（保持与源码同步的权威版本）。
> 修改时请先更新仓库内原文件，再同步本页。

# ⚡ 前端性能优化指南

**目标**: 将首屏加载时间从 3-5s 降至 < 2s，Lighthouse 评分达到 90+

---

## 📊 当前性能分析

### 主要问题
1. ❌ Bundle体积过大（估计 500KB+）
2. ❌ 未使用代码分割
3. ❌ 图片未优化
4. ❌ 没有数据缓存
5. ❌ 每次路由切换都重新请求数据
6. ❌ 未使用React.memo和useMemo

---

## 🎯 优化方案

### 1. 添加 React Query (数据缓存和状态管理)

#### 1.1 安装依赖
```bash
cd frontend
npm install @tanstack/react-query @tanstack/react-query-devtools
```

#### 1.2 配置 Query Provider

**创建 `src/lib/queryClient.ts`**:
```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5分钟内数据认为是新鲜的
      gcTime: 10 * 60 * 1000, // 10分钟后清理缓存（原cacheTime）
      retry: 1, // 失败后重试1次
      refetchOnWindowFocus: false, // 窗口聚焦时不自动刷新
    },
  },
});
```

**修改 `src/app/layout.tsx`**:
```typescript
'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider } from '@/core/auth';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            {children}
          </AuthProvider>
          {/* 开发环境显示调试工具 */}
          {process.env.NODE_ENV === 'development' && (
            <ReactQueryDevtools initialIsOpen={false} />
          )}
        </QueryClientProvider>
      </body>
    </html>
  );
}
```

#### 1.3 创建自定义Hooks

**创建 `src/hooks/useProducts.ts`**:
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productService } from '@/features/products/services/productService';
import { Product, ProductType } from '@/features/products/types';

// 查询产品列表
export const useProducts = (params?: {
  type?: ProductType;
  page?: number;
  pageSize?: number;
}) => {
  return useQuery({
    queryKey: ['products', params],
    queryFn: () => productService.getProducts(params),
    select: (data) => data.data, // 只返回data部分
  });
};

// 创建产品
export const useCreateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: productService.createProduct,
    onSuccess: () => {
      // 创建成功后刷新产品列表
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};

// 更新产品
export const useUpdateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Product> }) =>
      productService.updateProduct(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};

// 删除产品
export const useDeleteProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: productService.deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};
```

**类似地创建其他hooks**:
- `src/hooks/useOrders.ts`
- `src/hooks/useUsers.ts`
- `src/hooks/useCoins.ts`
- `src/hooks/usePayments.ts`
- `src/hooks/useStats.ts`

#### 1.4 重构页面使用hooks

**重构 `src/app/dashboard/products/page.tsx`**:
```typescript
'use client';

import { useState } from 'react';
import { useProducts, useCreateProduct } from '@/hooks/useProducts';
import { ProductType } from '@/features/products/types';
import CreateProductModal from '@/components/products/CreateProductModal';
import { toast } from 'react-hot-toast';

export default function ProductsPage() {
  const [activeTab, setActiveTab] = useState<ProductType>('vip');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // 使用React Query hooks
  const { data, isLoading, error, refetch } = useProducts({
    type: activeTab,
  });

  const createProductMutation = useCreateProduct();

  const handleCreateProduct = async (productData: any) => {
    try {
      await createProductMutation.mutateAsync(productData);
      toast.success('商品创建成功');
      setShowCreateModal(false);
      // 不需要手动刷新，React Query自动处理
    } catch (error) {
      toast.error('创建失败，请重试');
    }
  };

  if (error) {
    return <div>加载失败: {error.message}</div>;
  }

  return (
    <div>
      {/* 标签切换 */}
      <div className="tabs">
        {['vip', 'coin'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as ProductType)}
            className={activeTab === tab ? 'active' : ''}
          >
            {tab === 'vip' ? 'VIP商品' : '金币商品'}
          </button>
        ))}
      </div>

      {/* 产品列表 */}
      {isLoading ? (
        <div>加载中...</div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {data?.list.map((product) => (
            <ProductCard key={product.productId} product={product} />
          ))}
        </div>
      )}

      {/* 创建弹窗 */}
      {showCreateModal && (
        <CreateProductModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateProduct}
        />
      )}
    </div>
  );
}
```

---

### 2. 代码分割和懒加载

#### 2.1 路由级别代码分割

**修改 `src/app/dashboard/layout.tsx`**:
```typescript
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import Loading from './loading';

// 懒加载侧边栏（包含大量图标）
const Sidebar = dynamic(() => import('@/components/layout/Sidebar'), {
  loading: () => <div className="w-64 bg-gray-900 animate-pulse" />,
  ssr: false, // 侧边栏不需要SSR
});

// 懒加载顶部栏
const TopBar = dynamic(() => import('@/components/layout/TopBar'), {
  loading: () => <div className="h-16 bg-white animate-pulse" />,
});

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar />
        <main className="flex-1 overflow-auto bg-gray-50 p-6">
          <Suspense fallback={<Loading />}>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
```

#### 2.2 组件级别代码分割

**创建 `src/components/charts/ChartWrapper.tsx`**:
```typescript
import dynamic from 'next/dynamic';

// 图表库很大，懒加载
const LineChart = dynamic(
  () => import('recharts').then((mod) => mod.LineChart),
  { ssr: false }
);

const BarChart = dynamic(
  () => import('recharts').then((mod) => mod.BarChart),
  { ssr: false }
);

export { LineChart, BarChart };
```

#### 2.3 弹窗懒加载

**修改 `src/app/dashboard/products/page.tsx`**:
```typescript
import dynamic from 'next/dynamic';

// 弹窗只在需要时加载
const CreateProductModal = dynamic(
  () => import('@/components/products/CreateProductModal'),
  {
    loading: () => <div>加载中...</div>,
  }
);

export default function ProductsPage() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button onClick={() => setShowModal(true)}>创建商品</button>
      {showModal && <CreateProductModal onClose={() => setShowModal(false)} />}
    </>
  );
}
```

---

### 3. 图片优化

#### 3.1 使用 Next.js Image 组件

**修改所有图片引用**:
```typescript
// ❌ 旧方式
<img src="/003.png" alt="Background" />

// ✅ 新方式
import Image from 'next/image';

<Image
  src="/003.png"
  alt="Background"
  fill
  priority // 首屏图片
  quality={75} // 压缩质量
  placeholder="blur" // 模糊占位
  blurDataURL="data:image/..." // 占位图
/>
```

#### 3.2 配置图片优化

**修改 `next.config.ts`**:
```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'], // 使用现代格式
    deviceSizes: [640, 750, 828, 1080, 1200, 1920], // 响应式尺寸
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 缓存7天
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '124.222.202.16',
        port: '8089',
        pathname: '/uploads/**',
      },
    ],
  },
};

export default nextConfig;
```

#### 3.3 压缩现有图片

```bash
# 安装压缩工具
npm install -g imagemin-cli imagemin-webp

# 压缩PNG/JPG
cd frontend/public
imagemin *.{jpg,png} --out-dir=./optimized

# 生成WebP格式
imagemin *.{jpg,png} --plugin=webp --out-dir=./optimized

# 替换原图
mv optimized/* ./
rm -rf optimized
```

---

### 4. 性能优化技巧

#### 4.1 使用 React.memo

**优化列表项组件**:
```typescript
// components/ProductCard.tsx
import { memo } from 'react';

interface ProductCardProps {
  product: Product;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const ProductCard = memo(({ product, onEdit, onDelete }: ProductCardProps) => {
  return (
    <div className="card">
      <h3>{product.name}</h3>
      <p>{product.price}</p>
      {onEdit && <button onClick={() => onEdit(product.productId)}>编辑</button>}
      {onDelete && <button onClick={() => onDelete(product.productId)}>删除</button>}
    </div>
  );
});

ProductCard.displayName = 'ProductCard';

export default ProductCard;
```

#### 4.2 使用 useMemo 缓存计算

```typescript
import { useMemo } from 'react';

function OrdersPage() {
  const { data: orders } = useOrders();

  // 缓存统计计算
  const statistics = useMemo(() => {
    if (!orders) return null;
    
    return {
      totalAmount: orders.reduce((sum, order) => sum + order.amount, 0),
      successCount: orders.filter(o => o.status === 'success').length,
      pendingCount: orders.filter(o => o.status === 'pending').length,
    };
  }, [orders]);

  return <div>{/* 使用 statistics */}</div>;
}
```

#### 4.3 使用 useCallback 缓存函数

```typescript
import { useCallback } from 'react';

function ProductList() {
  const { data: products } = useProducts();

  // 缓存事件处理函数
  const handleEdit = useCallback((id: string) => {
    // 编辑逻辑
  }, []);

  const handleDelete = useCallback((id: string) => {
    // 删除逻辑
  }, []);

  return (
    <>
      {products?.list.map((product) => (
        <ProductCard
          key={product.productId}
          product={product}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      ))}
    </>
  );
}
```

#### 4.4 虚拟滚动（长列表）

```bash
npm install @tanstack/react-virtual
```

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

function LargeOrderList({ orders }: { orders: Order[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: orders.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // 每行高度
    overscan: 5, // 预渲染5行
  });

  return (
    <div ref={parentRef} className="h-screen overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const order = orders[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <OrderCard order={order} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

### 5. Bundle 优化

#### 5.1 分析 Bundle 大小

```bash
# 安装分析工具
npm install @next/bundle-analyzer

# 修改 next.config.ts
import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

export default withBundleAnalyzer({
  // ... 其他配置
});

# 运行分析
ANALYZE=true npm run build
```

#### 5.2 优化导入

```typescript
// ❌ 导入整个库
import _ from 'lodash';
import * as Icons from 'lucide-react';

// ✅ 按需导入
import debounce from 'lodash/debounce';
import { Search, User, Settings } from 'lucide-react';
```

#### 5.3 移除未使用的依赖

```bash
# 检查未使用的依赖
npx depcheck

# 移除
npm uninstall <unused-package>
```

#### 5.4 使用生产模式构建

```bash
# 确保生产环境变量
NODE_ENV=production npm run build

# 启动生产服务器
npm start
```

---

### 6. 网络优化

#### 6.1 启用 HTTP/2 和压缩

**Nginx 配置**:
```nginx
server {
    listen 443 ssl http2;
    
    # Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript 
               application/x-javascript application/xml+rss 
               application/json application/javascript;
    
    # Brotli压缩（更好）
    brotli on;
    brotli_comp_level 6;
    brotli_types text/plain text/css application/json 
                 application/javascript text/xml application/xml;
    
    # 缓存静态资源
    location /_next/static {
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
    
    location /images {
        add_header Cache-Control "public, max-age=604800";
    }
}
```

#### 6.2 预加载关键资源

**修改 `src/app/layout.tsx`**:
```typescript
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        {/* 预连接API服务器 */}
        <link rel="preconnect" href="http://124.222.202.16:8089" />
        <link rel="dns-prefetch" href="http://124.222.202.16:8089" />
        
        {/* 预加载关键字体 */}
        <link
          rel="preload"
          href="/fonts/custom-font.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

#### 6.3 实现请求去重

**修改 `src/services/apiClient.ts`**:
```typescript
class ApiClient {
  private pendingRequests = new Map<string, Promise<any>>();

  private generateKey(url: string, params?: any): string {
    return `${url}:${JSON.stringify(params)}`;
  }

  async get<T>(url: string, params?: any): Promise<T> {
    const key = this.generateKey(url, params);
    
    // 如果相同请求正在进行，返回已有Promise
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)!;
    }

    const promise = this.instance.get<T>(url, { params }).then((res) => {
      this.pendingRequests.delete(key);
      return res.data;
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }
}
```

---

### 7. 监控和追踪

#### 7.1 添加 Web Vitals 追踪

**创建 `src/lib/analytics.ts`**:
```typescript
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

function sendToAnalytics(metric: any) {
  // 发送到分析服务
  console.log(metric);
  
  // 可以集成 Google Analytics
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', metric.name, {
      value: Math.round(metric.value),
      event_category: 'Web Vitals',
      event_label: metric.id,
      non_interaction: true,
    });
  }
}

export function reportWebVitals() {
  getCLS(sendToAnalytics);
  getFID(sendToAnalytics);
  getFCP(sendToAnalytics);
  getLCP(sendToAnalytics);
  getTTFB(sendToAnalytics);
}
```

**在 `src/app/layout.tsx` 中使用**:
```typescript
'use client';

import { useEffect } from 'react';
import { reportWebVitals } from '@/lib/analytics';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    reportWebVitals();
  }, []);

  return <html>{children}</html>;
}
```

#### 7.2 添加性能标记

```typescript
// 标记关键事件
export function markPerformance(name: string) {
  if (typeof window !== 'undefined' && window.performance) {
    window.performance.mark(name);
  }
}

export function measurePerformance(name: string, startMark: string, endMark: string) {
  if (typeof window !== 'undefined' && window.performance) {
    window.performance.measure(name, startMark, endMark);
    const measure = window.performance.getEntriesByName(name)[0];
    console.log(`${name}: ${measure.duration}ms`);
  }
}

// 使用示例
markPerformance('data-fetch-start');
await fetchData();
markPerformance('data-fetch-end');
measurePerformance('data-fetch', 'data-fetch-start', 'data-fetch-end');
```

---

## 📈 性能检查清单

### 构建优化
- [ ] 启用生产模式构建
- [ ] 分析Bundle大小（< 200KB gzipped）
- [ ] 移除未使用的依赖
- [ ] 按需导入第三方库
- [ ] 启用Tree Shaking

### 代码优化
- [ ] 使用React.memo优化组件
- [ ] 使用useMemo缓存计算
- [ ] 使用useCallback缓存函数
- [ ] 实现虚拟滚动（长列表）
- [ ] 懒加载路由和组件

### 数据优化
- [ ] 集成React Query
- [ ] 实现数据缓存策略
- [ ] 防抖搜索输入
- [ ] 实现分页加载
- [ ] 请求去重

### 资源优化
- [ ] 使用Next.js Image组件
- [ ] 压缩图片（WebP/AVIF）
- [ ] 预加载关键资源
- [ ] 配置静态资源缓存
- [ ] 启用Gzip/Brotli压缩

### 监控
- [ ] 配置Web Vitals追踪
- [ ] 添加性能标记
- [ ] 集成错误追踪（Sentry）
- [ ] 配置Lighthouse CI

---

## 🎯 性能目标

| 指标 | 当前 | 目标 | 优化后 |
|------|------|------|--------|
| **FCP** (首次内容绘制) | ~2.5s | < 1.5s | ~1.2s |
| **LCP** (最大内容绘制) | ~4s | < 2.5s | ~2s |
| **TTI** (可交互时间) | ~5s | < 3s | ~2.5s |
| **Bundle Size** | ~500KB | < 200KB | ~180KB |
| **Lighthouse Score** | ~60 | > 90 | ~95 |

---

## 📱 移动端优化

### 1. 响应式图片
```typescript
<Image
  src="/hero.jpg"
  alt="Hero"
  sizes="(max-width: 768px) 100vw, 50vw"
  width={800}
  height={600}
/>
```

### 2. 触摸优化
```css
/* 增大点击区域 */
.button {
  min-height: 44px;
  min-width: 44px;
}

/* 防止文本选择 */
.no-select {
  -webkit-user-select: none;
  user-select: none;
}

/* 优化滚动 */
.scroll-container {
  -webkit-overflow-scrolling: touch;
}
```

### 3. 减少重排
```typescript
// ❌ 多次修改DOM
element.style.width = '100px';
element.style.height = '100px';
element.style.margin = '10px';

// ✅ 批量修改
element.style.cssText = 'width: 100px; height: 100px; margin: 10px;';
```

---

## 🚀 快速实施计划

### Week 1: 数据层优化
- Day 1-2: 集成React Query
- Day 3-4: 创建所有自定义hooks
- Day 5: 重构所有页面使用hooks

### Week 2: 代码分割
- Day 1-2: 实现路由懒加载
- Day 3: 实现组件懒加载
- Day 4-5: 添加React.memo/useMemo

### Week 3: 资源优化
- Day 1-2: 图片优化和Next.js Image
- Day 3: Bundle分析和优化
- Day 4-5: 网络优化和缓存

### Week 4: 监控和测试
- Day 1-2: 添加性能监控
- Day 3-4: 性能测试和调优
- Day 5: 文档和培训

---

**预期提升**: 
- ⚡ 加载速度提升 50-60%
- 📦 Bundle体积减少 40-50%
- 🎯 Lighthouse评分提升至 90+
- 💾 数据请求减少 70%（缓存）

开始优化吧！🚀
