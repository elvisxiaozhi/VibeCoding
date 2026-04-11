# 资产汇总看板 (Asset Dashboard) — 项目规范 v2

## 1. 项目概述

一款**纯前端**的个人资产记录与汇总工具。用户可录入股票、ETF、加密货币、现金等资产，系统自动计算总资产、盈亏，并以图表展示分类占比。

**核心目标：**

- 提供清晰的全局资产视图（总资产、各分类占比、盈亏情况）
- 支持多类资产的增删改查
- 数据本地持久化，刷新不丢失
- 界面具备现代金融产品的专业感，深色主题为主

---

## 2. 技术栈（严格约束）

| 用途 | 选型 | 说明 |
|------|------|------|
| 构建工具 | **Vite** | 轻量快速，纯前端最佳选择，避免 Next.js 的 SSR 复杂度 |
| 核心框架 | **React 18 + TypeScript** | — |
| 样式方案 | **Tailwind CSS** | 实用优先，适合快速开发 |
| UI 组件库 | **Shadcn UI** | 按需复制组件，不引入额外依赖 |
| 图表库 | **Recharts** | React 生态主流图表库 |
| 图标库 | **Lucide React** | — |
| 数据持久化 | **localStorage** | 纯前端阶段使用，后续可替换为后端 API |
| 包管理器 | **pnpm** | — |

> **为什么不用 Next.js？**
> 本项目是纯客户端单页应用，不需要 SSR、SSG、API Routes 等服务端能力。Vite + React 配置更简单、构建更快、概念更少，对前端新手更友好。

---

## 3. 数据契约 (Data Schema)

所有组件必须基于以下接口构建，不得随意扩展字段。

```typescript
// 资产分类
type AssetCategory = 'stock' | 'etf' | 'crypto' | 'cash';

// 资产分类中文映射
const CATEGORY_LABELS: Record<AssetCategory, string> = {
  stock: '股票',
  etf: 'ETF',
  crypto: '加密货币',
  cash: '现金',
};

// 单条资产记录
interface Asset {
  id: string;            // 唯一 ID（使用 crypto.randomUUID()）
  symbol: string;        // 资产代码/名称，如 "AAPL"、"BTC"
  category: AssetCategory;
  costBasis: number;     // 持仓成本价（单价）
  currentPrice: number;  // 当前市价（单价）
  quantity: number;      // 持有数量
  currency: string;      // 币种，默认 "CNY"
  createdAt: string;     // ISO 8601 创建时间
  updatedAt: string;     // ISO 8601 更新时间
}

// 派生计算（不存储，实时计算）
// 市值 = currentPrice × quantity
// 成本 = costBasis × quantity
// 盈亏额 = 市值 - 成本
// 盈亏率 = 盈亏额 / 成本 × 100%
```

---

## 4. 页面结构

```
┌──────────────────────────────────────────────┐
│  App                                         │
│  ┌────────┬─────────────────────────────────┐│
│  │        │  Header (页面标题 + 日期)         ││
│  │ Sidebar│─────────────────────────────────││
│  │        │                                 ││
│  │ · 总览  │  Main Content Area              ││
│  │ · 资产  │  (根据当前页面切换内容)            ││
│  │ · 设置  │                                 ││
│  │        │                                 ││
│  └────────┴─────────────────────────────────┘│
└──────────────────────────────────────────────┘
```

- **侧边栏**：固定宽度 240px，深色背景，包含导航项（总览、资产列表、设置）
- **Header**：显示当前页面名称、当前日期
- **Main**：根据导航切换内容，使用简单的状态切换（无需 React Router）

---

## 5. 开发计划 (Milestones)

每个 Step 为一次完整可运行的交付，按顺序执行。

### Step 1：项目初始化 + 全局布局骨架

**目标：** 项目能跑起来，看到左右分栏布局。

- 使用 Vite 创建 React + TypeScript 项目
- 配置 Tailwind CSS
- 安装 Shadcn UI（初始化 + 引入 Button、Card 组件验证可用）
- 实现布局骨架：Sidebar + Header + Main 三区域
- Sidebar 包含三个导航项，点击可高亮切换
- 深色主题配色

**验收：** 浏览器打开能看到完整布局，点击侧边栏导航项能切换高亮状态。

---

### Step 2：Mock 数据 + 本地存储层

**目标：** 数据层就绪，组件可以读写资产数据。

- 创建 `src/data/mock.ts`，包含 8-10 条覆盖全分类的示例数据
- 创建 `src/hooks/useAssets.ts` 自定义 Hook，封装：
  - `assets`: 资产列表
  - `addAsset(asset)`: 新增
  - `updateAsset(id, partial)`: 更新
  - `deleteAsset(id)`: 删除
  - 派生数据：`totalValue`、`totalCost`、`totalPnL`、`categoryBreakdown`
- 首次加载时将 Mock 数据写入 localStorage，后续从 localStorage 读取
- 创建 `src/lib/calc.ts`，封装所有计算逻辑（市值、盈亏等）

**验收：** 在控制台或临时组件中能看到数据正确加载和计算结果。

---

### Step 3：首页看板 (Dashboard)

**目标：** 总览页展示核心指标和分类占比图表。

- 三张统计卡片，横向排列：
  - **总资产**（所有资产市值之和，最大字号突出显示）
  - **浮动盈亏**（总市值 - 总成本，正绿负红，显示金额和百分比）
  - **投入本金**（所有资产成本之和）
- 分类占比饼图（Recharts PieChart）：按 stock/etf/crypto/cash 分类，显示各类市值占比
- 资产涨跌排行（可选）：按盈亏率排序的 Top 5 列表

**验收：** 看板数据与 Mock 数据计算一致，饼图正确渲染。

---

### Step 4：资产列表页

**目标：** 展示所有资产明细，支持排序。

- 使用 Shadcn Table 组件展示资产列表
- 列：名称/代码、分类、数量、成本价、现价、市值、盈亏额、盈亏率
- 盈亏列：正值绿色、负值红色
- 支持按列点击排序
- 每行末尾有「编辑」「删除」操作按钮

**验收：** 列表正确显示所有 Mock 数据，排序功能正常。

---

### Step 5：新增 / 编辑资产

**目标：** 用户可以手动录入和修改资产。

- 点击「新增资产」按钮弹出 Dialog/Sheet 表单
- 表单字段：代码、分类（下拉选择）、成本价、现价、数量
- 表单校验：所有字段必填，数值必须 > 0
- 编辑模式：点击列表行的「编辑」按钮，弹出预填充表单
- 提交后数据写入 localStorage 并刷新列表

**验收：** 能正常新增、编辑资产，刷新页面数据不丢失。

---

### Step 6：删除确认 + 全局优化

**目标：** 补全交互细节，打磨体验。

- 删除前弹出确认对话框
- 空状态处理（无资产时显示引导）
- 数字格式化（千分位、保留 2 位小数）
- 响应式适配（侧边栏在窄屏可折叠）
- 加载状态和过渡动画

**验收：** 所有交互流程顺畅，无控制台报错。

---

## 6. UI 设计规范

| 项目 | 规范 |
|------|------|
| 主题 | 深色（dark），背景 `#0a0a0a` ~ `#1a1a1a` |
| 强调色 | 蓝色系 `#3b82f6`，用于导航高亮、按钮 |
| 盈利色 | `#22c55e`（绿） |
| 亏损色 | `#ef4444`（红） |
| 字体 | 系统字体栈，数字使用等宽字体 `font-mono` |
| 卡片 | 圆角 `rounded-xl`，微妙边框 `border-border/50` |
| 间距 | 主内容区 `p-6`，卡片间距 `gap-6` |

---

## 7. 文件结构参考

```
src/
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── AppLayout.tsx
│   ├── dashboard/
│   │   ├── StatCard.tsx
│   │   └── CategoryPieChart.tsx
│   └── assets/
│       ├── AssetTable.tsx
│       └── AssetForm.tsx
├── hooks/
│   └── useAssets.ts
├── lib/
│   ├── calc.ts
│   └── types.ts
├── data/
│   └── mock.ts
├── App.tsx
└── main.tsx
```

---

## 8. 注意事项

- **不要过早引入路由库**：只有 3 个页面，用 `useState` 切换即可
- **不要过早引入状态管理库**：`useAssets` Hook + localStorage 足够当前需求
- **所有金额计算使用原始数值**，仅在展示层格式化
- **每个 Step 结束后必须能完整运行**，不允许留下半成品
