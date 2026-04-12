# Step 7 执行简报 — 首页看板 Dashboard

> 交付日期：2026-04-12
> 目标：总览页展示核心指标和分类占比图表

---

## 1. 关键终端命令

| 顺序 | 命令 | 作用 |
|------|------|------|
| 1 | `npm install recharts` | 安装图表库（+39 packages） |
| 2 | `npx tsc -b` | TypeScript 编译校验（0 错误） |
| 3 | `cd server && go run .` | 启动 Go 后端（:8080） |
| 4 | `npm run dev` | 启动 Vite 前端（:5173，proxy → :8080） |

---

## 2. 新增文件

| 路径 | 作用 |
|------|------|
| `src/components/dashboard/StatCard.tsx` | 统计卡片组件：标题 / 数值 / 副标题 / 图标 / variant（default/profit/loss） |
| `src/components/dashboard/CategoryPieChart.tsx` | 分类占比饼图：Recharts PieChart（环形）+ 右侧图例，按 stock/etf/crypto/cash 着色 |
| `src/components/dashboard/Dashboard.tsx` | 看板页面组件：三张 StatCard + 饼图 + Top 5 涨跌排行 |

## 3. 修改文件

| 路径 | 变更 |
|------|------|
| `src/App.tsx` | **删除 `DataSelfCheck` 组件及相关 import**（useAssets / CATEGORY_LABELS）；总览页改为渲染 `<Dashboard />`；其他页面保留骨架占位 |
| `package.json` / `package-lock.json` | 新增 `recharts` 依赖 |

---

## 4. 看板布局

```
┌──────────────┬──────────────┬──────────────┐
│  总资产 ¥xxx  │ 浮动盈亏 ±¥xx │ 投入本金 ¥xxx │  ← 3 张 StatCard
└──────────────┴──────────────┴──────────────┘
┌─────────────────────┬──────────────────────┐
│  分类占比饼图         │  涨跌排行 Top 5       │  ← 2 列
│  (PieChart + 图例)   │  (按盈亏率排序)        │
└─────────────────────┴──────────────────────┘
```

### 配色方案
- 股票 `#3b82f6`（蓝）、ETF `#8b5cf6`（紫）、加密 `#f59e0b`（橙）、现金 `#22c55e`（绿）
- 盈利 `#22c55e`、亏损 `#ef4444`

### 数字格式
- 金额：`¥` 前缀 + `toLocaleString('zh-CN')` 千分位 + 2 位小数
- 百分比：`+` / `-` 前缀 + 2 位小数 + `%`
- 等宽字体：`font-mono`

---

## 5. 红线遵守情况

| 约束 | 是否遵守 |
|------|----------|
| 删除 Step 2 的 DataSelfCheck | ✅ 已删除组件 + 相关 import |
| 使用 Recharts PieChart | ✅ |
| 不提前实现 Step 8 的资产列表 | ✅ 资产/设置页仍为骨架占位 |
| 派生计算在前端 calc.ts | ✅ |
| 深色主题配色 | ✅ |

---

## 6. 验收结果

- `npx tsc -b` — 0 错误
- Go server + Vite dev 同时启动成功
- `curl localhost:5173/api/assets` — 通过 proxy 返回 10 条
- 浏览器预期效果：
  - 总览页：三张统计卡片横向排列，总资产 / 浮动盈亏（正绿负红 + 百分比）/ 投入本金
  - 饼图：4 色环形图 + 右侧图例百分比
  - Top 5 涨跌排行：按盈亏率降序，盈利绿亏损红
  - 其他页面（资产/设置）仍为骨架占位
