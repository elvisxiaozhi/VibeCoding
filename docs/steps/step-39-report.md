# Step 39 — 隐私模式（Privacy Mode）

## 交付内容

一键「打码」按钮：点击后把全站所有金额替换为 `****`，再次点击恢复显示。状态通过 localStorage 持久化，刷新不丢失。

## 关键文件

### 新增
- `src/context/PrivacyContext.tsx` — Context + `PrivacyProvider` + `usePrivacy()` hook，`mask(str)` 函数在私密模式下返回 `'****'`

### 修改
- `src/vendor/lucide.ts` — 新增 `EyeOff` 导出
- `src/App.tsx` — 用 `PrivacyProvider` 包裹应用根节点
- `src/components/layout/Header.tsx` — 顶部栏右侧新增 Eye/EyeOff 切换按钮
- `src/components/dashboard/Dashboard.tsx` — StatCard 值、公积金/黄金/期权所有货币值
- `src/components/dashboard/PerformancePanel.tsx` — Metric 子组件 + 排行榜 + 明细表格
- `src/components/dashboard/ReturnAttributionPanel.tsx` — Metric + ContributionBar + 明细表格
- `src/components/dashboard/DividendIncomePanel.tsx` — 三项指标、柱状图 tooltip、排行列表
- `src/components/dashboard/AssetDetailSheet.tsx` — 市值/成本/盈亏/分红/均价/逐笔时间线
- `src/components/dashboard/AssetStructurePanel.tsx` — 图例金额、饼图 tooltip
- `src/components/dashboard/RiskExposurePanel.tsx` — ExposureBar 子组件中的 CNY 金额
- `src/components/dashboard/PriceRefreshCenter.tsx` — currentPrice 列
- `src/components/dashboard/CategoryPieChart.tsx` — 饼图 tooltip
- `src/components/dashboard/PortfolioSnapshotPanel.tsx` — 两个图表的 Y 轴（私密时返回 `''`）和 tooltip
- `src/components/dashboard/FireGoalPanel.tsx` — 当前净资产、目标金额
- `src/components/assets/AssetTable.tsx` — BalanceAssetPanel + AssetTable 主体所有金额列
- `src/components/assets/LiabilityTable.tsx` — 总负债、卡片和表格中的本金
- `src/components/assets/ClearedAssetsTable.tsx` — 成本/收入/分红/盈亏/合计

## 设计选择
- Context 方案（非 prop drilling）：组件直接 `usePrivacy()`，避免跨层穿参
- 图表 Y 轴 tick 在私密模式下返回 `''`（空串），保留图形形状但隐藏刻度值
- 百分比、持有期、年化收益率等派生指标**不遮挡**（只遮绝对金额）
- 按钮常驻 Header 右侧，不依赖登录状态

## 红线遵守
- 无 React Router，无状态管理库，无 Go 后端改动
- `npx tsc -b` 0 错误
- `npm run dev` 正常启动无报错

## 验收
- `npx tsc -b` — 0 errors ✅
- `npm run dev` — 页面正常渲染 ✅
