# Step 24 执行简报：分红记录追踪 + 逐笔时间线展示

## 交付内容

从 IBKR CSV 解析每笔分红记录，作为独立时间线条目（与买入/卖出同级）存储和展示。分红纳入盈亏和年化收益率计算。

## 后端改动

| 文件 | 说明 |
|------|------|
| `server/migrations/006_add_dividends_to_assets.sql` | 新增 `dividends REAL NOT NULL DEFAULT 0` 字段 |
| `server/internal/model/asset.go` | Asset struct 新增 `Dividends float64` |
| `server/internal/store/store.go` | 全部 CRUD SQL 加入 `dividends` 字段 |
| `server/internal/handler/assets.go` | createRequest/updateRequest 加入 `Dividends`；移除 `quantity == 0` 校验（允许分红记录） |

## 数据生成

| 文件 | 说明 |
|------|------|
| `deploy/parse-ibkr.py` | 新增 `DividendRecord` dataclass；`parse_dividends()` 返回逐笔分红列表（去重）；`to_json()` 输出分红为 `quantity=0, dividends=金额` 的独立记录；修复 Total 行误判 bug |

## 前端改动

| 文件 | 说明 |
|------|------|
| `src/lib/types.ts` | Asset 接口新增 `dividends: number` |
| `src/lib/calc.ts` | `pnlValue` = 市值 - 成本 + 分红；`totalAnnualizedReturn` 支持 `extraDividends` 参数 |
| `src/components/assets/AssetTable.tsx` | SymbolGroup 新增 `dividendRecords`；展开明细三类记录按日期混排：买入（红色边框）、卖出（绿色边框）、分红（琥珀色边框）；标签显示 `N买 M卖 K息` |
| `src/components/assets/AssetForm.tsx` | 表单新增 `dividends` 字段 |
| `src/components/dashboard/Dashboard.tsx` | 分红从 qty=0 记录汇总，纳入总盈亏和组合年化 |
| `src/data/mock.ts` | 13 条 mock 数据补充 `dividends: 0` |

## 数据统计

- 59 笔分红记录，总计 $239.13
- 覆盖 AAPL、META、MSFT、NVDA、OXY、QQQM、SGOV、SPYM、TLT、UNH、VTWO
- 总记录数从 103 条增至 162 条

## 红线遵守
- 未引入新依赖
- 派生计算保留前端
- 前后端 Asset 类型手动同步

## 验收结果
- `npx tsc -b` — 0 错误
- `go build ./...` — 0 错误
