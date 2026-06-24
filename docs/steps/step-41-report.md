# Step 41 — 目标配置 + 偏离再平衡提醒

## 目标
在看板新增一个面板，让用户为任意结构维度（分类 / 细分 / 市场 / 币种 / 归属）设定目标占比；与当前实际占比对账，偏离超过阈值时给出「超配 / 低配 + 建议调仓额」提示。目标值与阈值存 localStorage，纯前端，无后端改动。

## 实现内容

### 新增文件（共 3 个）

#### `src/lib/structure.ts`
- 从 `AssetStructurePanel.tsx` 抽出 `buildItems` 及配套常量（`STRUCTURE_VIEWS`、`STRUCTURE_COLORS`、`MARKET_STRUCTURE_LABELS`）和类型（`StructureView`、`StructureItem`），供结构面板与再平衡面板共享
- 行为变更：`buildItems` 不再内部 `.filter(value > 0)`，返回该维度全部定义项（含 value=0），由调用方决定是否过滤 —— 再平衡需要展示「仅设了目标但当前无持仓」的低配项

#### `src/lib/rebalance.ts`
- 纯函数 `computeRebalance(allItems, targets, totalValueCNY, thresholdPp)`
- 每项输出：当前占比、目标%、偏离（百分点）、建议调仓额（CNY，>0 加仓 / <0 减仓）、状态（over / under / ok）
- 跳过「既无持仓又无目标」的定义项；返回 `totalTargetPct`（目标合计校验用）与 `alerts`（|偏离| ≥ 阈值且已设目标）

#### `src/components/dashboard/RebalancePanel.tsx`
- 复用 `STRUCTURE_VIEWS` 维度切换器 + `buildItems`，每个维度独立保存目标
- 顶部：偏离阈值输入（默认 5pp）+ 维度切换
- 偏离告警 banner：列出每条超配 / 低配项 + 建议加仓 / 减仓金额（`usePrivacy().mask` 脱敏）
- 目标合计校验：∑目标 ≠ 100% 时黄色提示
- 每行：色点 + 标签 + 当前% + 目标%行内输入 + 偏离 chip（超配 amber / 低配 sky）+ 进度条（填充=当前占比，白色竖线 marker=目标位置）
- localStorage：`target_allocation`（`Record<view, Record<key, number>>`）、`rebalance_threshold`，均经 `useLocalStorage` hook

### 改动文件（共 3 个）

#### `src/components/dashboard/AssetStructurePanel.tsx`
- 删除本地 `buildItems` / 常量 / 类型，改 import 自 `@/lib/structure`
- 调用点补 `.filter((item) => item.value > 0)` 保持原有「只显示有持仓的项」行为

#### `src/hooks/usePanelOrder.ts`
- `PANEL_IDS` 在 `snapshot_structure` 后插入 `rebalance`
- `PANEL_LABELS` 加 `rebalance: '目标配置 / 再平衡'`

#### `src/components/dashboard/Dashboard.tsx`
- import `RebalancePanel`
- `panelMap` 在 `snapshot_structure` 后新增 `rebalance` 条目，传入 `holdings / totalValueCNY / assetValueCNY`（与结构面板同源）

## 关键命令

```bash
npx tsc -b           # 0 errors
node_modules/.bin/vite build   # 构建通过（仅既有 chunk 体积告警）
```

## 红线遵守
- 纯前端实现，无后端 / schema / 迁移改动
- 派生计算（偏离、建议调仓额）放在 `src/lib/rebalance.ts`，符合「派生指标只在前端算」
- 未引入新依赖；图标复用既有 `Target` / `AlertTriangle`，**未新增 lucide 图标**，无需改 vendor shim
- 抽取 `buildItems` 为共享模块，未改变结构面板对外行为
- 面板通过 `usePanelOrder` 注册，可拖拽排序，与现有面板一致

## 验收结果
- tsc：0 错误
- vite build：通过
- 新面板「目标配置 / 再平衡」出现在净值曲线&资产结构面板之后
- 切换维度、输入目标%、调整阈值实时联动；偏离超阈值显示告警与建议调仓额
- 目标合计 ≠ 100% 触发黄色提示；隐私模式下金额正确脱敏
