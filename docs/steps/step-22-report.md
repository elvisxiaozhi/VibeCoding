# Step 22 执行简报：多币种显示 + 实时汇率换算

## 交付内容

各资产使用对应的货币符号（$ / HK$ / ¥ / ₿）显示金额，非人民币资产额外显示人民币换算值。Dashboard 汇总指标全部按实时汇率折算为人民币。

## 新增文件

| 文件 | 说明 |
|------|------|
| `src/lib/currency.ts` | 货币符号映射（CURRENCY_SYMBOLS）、`formatMoney()`、`formatMoneyWithSign()`、`toCNY()` 换算函数 |
| `src/hooks/useExchangeRates.ts` | 接入 `open.er-api.com` 免费汇率 API，以 USD 为基准；30 分钟内存缓存；失败时使用 fallback 汇率 |

## 前端改动

| 文件 | 说明 |
|------|------|
| `src/components/assets/AssetTable.tsx` | SymbolGroup 新增 `currency` 字段；成本/现价/市值/盈亏使用 `formatMoney` 显示对应货币符号；非 CNY 资产在市值和盈亏下方显示 `≈ ¥xxx` 换算值；板块汇总使用 CNY 换算 |
| `src/components/dashboard/Dashboard.tsx` | 总资产/本金/盈亏按汇率换算为人民币汇总；板块卡片使用 CNY 换算市值和占比；Top 5 涨跌排行显示原币盈亏+人民币换算；分类饼图使用 CNY 换算数据 |
| `src/components/dashboard/CategoryPieChart.tsx` | Tooltip 使用 `formatMoney` 替代硬编码 ¥ 前缀 |

## 汇率换算逻辑

- 基准：以 USD 为基准的汇率表（`rates['CNY']`、`rates['HKD']` 等）
- 换算公式：`toCNY(amount, currency, rates) = (amount / rates[currency]) * rates['CNY']`
- CNY 资产不换算，直接返回原值

## 红线遵守
- 未引入任何新第三方依赖（汇率 API 使用原生 fetch）
- 派生计算保留在前端
- 未使用状态管理库，汇率用模块级变量缓存

## 验收结果
- `npx tsc -b` — 0 错误
- Commit: `2d2e3ad`
