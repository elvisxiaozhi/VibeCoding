# Step 23 执行简报：年化收益率修正 + 红涨绿跌 + 美股实时行情

## 交付内容

三项体验改进：修正年化收益率 CAGR 算法、全站颜色改为红涨绿跌、美股资产页面加载时自动刷新实时行情。

## 改动文件

| 文件 | 说明 |
|------|------|
| `src/lib/calc.ts` | 组合年化从加权平均个股年化改为真实 CAGR：`((1 + totalRate) ^ (365 / weightedDays)) - 1`；新增 `dividendValue()`、`totalDividendValue()` 函数；盈亏额/率包含分红 |
| `src/components/dashboard/Dashboard.tsx` | 颜色改为红涨绿跌（profit → `#ef4444`、loss → `#22c55e`） |
| `src/components/dashboard/StatCard.tsx` | 同步红涨绿跌配色 |
| `src/components/assets/AssetTable.tsx` | 同步红涨绿跌配色 |
| `server/internal/handler/quotes.go` | 新增新浪财经行情代理 `GET /api/quotes?symbols=AAPL,NVDA,...`，解析 `hq.sinajs.cn` 响应 |
| `server/main.go` | 注册 `/api/quotes` 路由 |
| `src/hooks/useAssets.ts` | 页面加载时自动刷新美股实时价格：筛选 US 持仓 → 调用 `/api/quotes` → 批量更新 `currentPrice` → 重新拉取资产列表 |

## 红涨绿跌色系

- 盈利/涨：`#ef4444`（红色）
- 亏损/跌：`#22c55e`（绿色）
- 适用于 Dashboard 统计卡片、板块汇总、涨跌排行、年化排行、资产列表盈亏列

## 验收结果
- `npx tsc -b` — 0 错误
- `go build ./...` — 0 错误
- 新浪行情 API 从腾讯云 VPS 正常返回（Yahoo/Eastmoney 均被封禁）
