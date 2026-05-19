# Step 37 — 分红 / 被动收入面板

## 交付内容

新增 `DividendIncomePanel`，汇聚已有分红记录的聚合视图，放置于看板「风险暴露」面板之后。

## 新文件

- `src/components/dashboard/DividendIncomePanel.tsx`

## 修改文件

- `src/components/dashboard/Dashboard.tsx` — 新增 import 和面板挂载

## 功能说明

### 指标行（3 项）
| 指标 | 算法 |
|---|---|
| 累计分红 | 全部 divRecords toCNY 求和 |
| 近 12 月分红 | purchasedAt >= today-365 后求和；附月均值 |
| 近 12 月股息率 | 近12月分红 ÷ 当前持仓市值 |

### 月度柱状图
- 时间轴：近 24 个月（YYYY-MM 粒度）
- Y 轴：当月分红合计（CNY），`shortMoney` 格式化
- 使用 `#fbbf24` 金黄色 Recharts BarChart
- 无数据月份显示为 0（柱不渲染）

### 分红来源排行
- 按 symbol 聚合全部历史分红（toCNY）
- 降序排，最多展示 Top 10
- 每行：symbol / 比例进度条 / CNY 金额 / 最近分红月份

## 红线遵守

- 无新后端接口，无新数据库字段
- 纯前端聚合，使用已有 divRecords + rates
- 未引入新 lucide 图标，无需改 vendor shim
- `npx tsc -b` 0 错误
- `vite build` 通过

## 验收结果

- `npx tsc -b` — ✅ 0 错误
- `vite build` — ✅ 728 modules transformed，无错误
