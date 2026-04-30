# Step 31: 当前持仓收益归因面板

## 交付内容

### 1. 收益归因计算层
- 新增 `calculateReturnAttribution()`：
  - 当前持仓未实现收益拆分为价格涨跌收益和汇率收益
  - 分红记录按派息日历史汇率折算为 CNY
  - 卖出记录按卖出日汇率估算已实现收益
  - 输出总览和分组明细
- 汇率拆分口径：
  - 成本 CNY：`costBasis * quantity * 买入日汇率`
  - 价格收益 CNY：`(currentPrice - costBasis) * quantity * 买入日汇率`
  - 汇率收益 CNY：`currentPrice * quantity * (当前汇率 - 买入日汇率)`
  - 当前市值 CNY：`currentPrice * quantity * 当前汇率`
- 若历史汇率未命中，则回退当前汇率并在 UI 展示“部分使用当前汇率估算”。

### 2. Dashboard 收益归因面板
- 新增 `ReturnAttributionPanel`，展示：
  - 价格涨跌
  - 分红收益
  - 汇率收益
  - 已实现收益
  - 未实现收益
  - 总收益
- 新增贡献 Top 5 横向条形视图
- 新增分组明细表，可按以下维度切换：
  - 资产
  - 板块
  - 币种
  - 市场

### 3. Dashboard 接入
- Dashboard 复用现有 holdings、分红记录、卖出记录、当前汇率和历史汇率查询
- 收益归因面板放在风险暴露面板之后，分类占比和涨跌排行之前
- 不改变现有 XIRR、总资产、浮动盈亏、年化收益率口径

## 关键文件

| 文件 | 变更 |
|------|------|
| `src/lib/attribution.ts` | 新建：收益归因计算和分组聚合 |
| `src/components/dashboard/ReturnAttributionPanel.tsx` | 新建：收益归因总览、贡献 Top 5、分组明细表 |
| `src/components/dashboard/Dashboard.tsx` | 接入收益归因计算和面板渲染 |
| `src/vendor/lucide.ts` | 新增收益归因面板所需图标导出 |

## 红线遵守

- 不改数据库 schema
- 不改 API response schema
- 不改 XIRR 算法
- 不引入交易流水配对引擎
- 不用 FIFO / 加权成本假设自动重算已实现收益
- 不写入或修改真实资产数据

## 验收结果

- `npm run build` 通过
- 构建仍有 Vite chunk size warning，属于既有前端 bundle 体积提示

## 已知限制

- 已实现收益当前按卖出记录上的 `costBasis/currentPrice/quantity` 估算，不做 FIFO 或交易批次配对
- 分红收益按现有 `quantity = 0 && dividends > 0` 记录归集；赎回类现金流仍沿用当前数据口径
- 历史汇率未命中时会回退当前汇率，因此汇率收益会低估或归零
- 当前只做金额归因，不拆解 XIRR 的收益率贡献
