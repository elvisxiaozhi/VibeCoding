# Step 34: 总览页信息架构优化

## 交付内容

### 1. 总览页模块重排
- Dashboard 从“功能堆叠”调整为更清晰的信息层级：
  - 价格刷新状态
  - 核心资产指标
  - 净值曲线与资产结构
  - 收益分析
  - 风险暴露
- 移除独立的市场汇总卡片、分类占比卡片、涨跌排行卡片和年化排行卡片。
- 保留原有收益、风险、快照和价格刷新数据口径，只调整展示结构。

### 2. 资产结构合并
- 新增 `AssetStructurePanel`：
  - 分类
  - 市场
  - 币种
  - 归属人
- 使用 tab 在同一个面板内切换维度。
- 使用环形图、进度条、占比和人民币市值展示结构数据。
- 替代原来的分类饼图和市场资产汇总，减少重复拆分信息。

### 3. 收益分析合并
- 新增 `PerformancePanel`：
  - 合并收益归因指标
  - 合并涨跌排行 Top 5
  - 合并年化收益率 Top 5
- 收益归因支持按：
  - 标的
  - 分类
  - 币种
  - 市场
- Top 5 支持切换：
  - 总收益
  - 收益率
  - 年化
- 原 `ReturnAttributionPanel` 保留未删除，但 Dashboard 不再直接使用。

### 4. 快照面板精简
- `PortfolioSnapshotPanel` 新增 `compact` 模式。
- Dashboard 中只展示：
  - 快照日期
  - 总资产
  - 投入本金
  - 累计盈亏
  - 净值曲线
- 原完整拆分明细和当日资产状态表保留在非 compact 模式，避免总览页过重。

### 5. 价格刷新中心降噪
- `PriceRefreshCenter` 在无失败且未展开时使用更紧凑的视觉样式。
- 成功状态文案从详细统计改为更短的同步状态。
- 失败时仍保留醒目的失败数量、错误摘要和明细展开能力。

## 关键文件

| 文件 | 变更 |
|------|------|
| `src/components/dashboard/Dashboard.tsx` | 重排总览页结构，移除重复卡片，接入新聚合面板 |
| `src/components/dashboard/AssetStructurePanel.tsx` | 新增资产结构聚合面板 |
| `src/components/dashboard/PerformancePanel.tsx` | 新增收益分析聚合面板 |
| `src/components/dashboard/PortfolioSnapshotPanel.tsx` | 新增 `compact` 展示模式 |
| `src/components/dashboard/PriceRefreshCenter.tsx` | 正常状态紧凑化，失败状态继续突出 |

## 红线遵守

- 不改变资产 CRUD API
- 不改变后端接口
- 不改变价格刷新逻辑
- 不改变快照生成逻辑
- 不改变收益归因、XIRR、风险暴露计算口径
- 不删除现有完整分析组件，只在 Dashboard 中降低重复展示
- 不改写真实资产数据

## 验收结果

- `npm run build` 通过
- 构建仍有 Vite chunk size warning，属于前端 bundle 体积提示
- 本地开发服务已验证可访问：`http://127.0.0.1:5173`

## 已知限制

- `npm run lint` 和针对改动文件的 `npx eslint ...` 长时间无输出，本次未取得 lint 完整结果
- `PerformancePanel` 的 Top 5 仍基于现有持仓汇总口径，不新增历史成交维度
- `PortfolioSnapshotPanel` 的完整明细仍只在非 compact 模式可见，后续如需要可新增独立快照详情页
- 原 `CategoryPieChart` 和 `ReturnAttributionPanel` 仍保留在代码库中，后续确认无其他入口依赖后可清理
