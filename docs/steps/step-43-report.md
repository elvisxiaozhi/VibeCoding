# Step 43 — 基准对比（vs 沪深300 / 标普500）

## 目标
组合年化（人民币本位 XIRR）一直缺一个参照系——"8%"到底好不好，要跟基准比才有意义。本步引入沪深300、标普500 两个基准，给出**口径可比**的对照年化。

## 核心方法：现金流对齐基准（dollar-matched benchmark）
不能拿组合 XIRR（money-weighted）直接跟指数涨幅（buy-and-hold）比——口径不同。正确做法：

> 把组合真实的每一笔现金流（买入流出、分红/卖出流入）原封不动地"假装"按相同时点、相同金额投进基准指数，算出基准组合的期末值，再跑同一个 XIRR。

- 组合年化与基准年化用**完全相同的资金时点**，因此可比。
- 标普500 用 USD 计价：投入时按当日历史汇率折 USD 买份额，期末按今日汇率折回 CNY → 对照**自动包含汇率收益/损失**，与组合 XIRR 口径一致。
- 复用 `calc.ts` 里现有的现金流提取与 `xirrRate` 求解器，避免规则漂移：`holdingsXIRR` 抽出 `buildHoldingsCashflows()`，组合与基准共用同一套现金流。

## 文件清单
**后端（只存不算，照 fx_rates 懒填充模式）**
- `server/migrations/019_create_benchmark_prices.sql` — 新建 `benchmark_prices(symbol, date, close)` 空表
- `server/internal/model/benchmark.go` — `BenchmarkPrice` / `BenchmarkSeries`
- `server/internal/store/benchmark.go` — `ListBenchmarkPrices` / `LatestBenchmarkDate` / `UpsertBenchmarkPrices`
- `server/internal/handler/benchmark.go` — `GET /api/benchmark-prices?symbols=000300,SPX`，读时懒填充：空表全量回填、最新日期落后则增量补齐（沪深300=东方财富日线 K，标普500=Stooq CSV）
- `server/main.go` — 注册 `Benchmarks` 路由

**前端（派生全在前端）**
- `src/lib/types.ts` — `BenchmarkPrice` / `BenchmarkSeries` / `BenchmarkDef` + `BENCHMARKS` 常量
- `src/hooks/useBenchmarkPrices.ts` — 拉日线，模块级缓存（同其他 hook）
- `src/lib/calc.ts` — 抽出 `buildHoldingsCashflows()` + 导出 `Cashflow`、`HoldingsCashflows`；`holdingsXIRR` 改为薄封装
- `src/lib/benchmark.ts` — `benchmarkXIRR()`（按现金流模拟份额）+ `computeBenchmarkReturns()`，`xirrRate` 返回 NaN 时降级 null
- `src/components/dashboard/PerformancePanel.tsx` — "vs 基准"区块：本组合 / 沪深300 / 标普500 对照年化 + 超额
- `src/components/dashboard/Dashboard.tsx` — 用与人民币本位年化相同的核心现金流计算对照，传入面板

## 红线遵守
- ✅ 后端只存 + CRUD，对照 XIRR 全在前端 `lib/benchmark.ts`
- ✅ 未引入任何新依赖（Stooq/东方财富都是裸 http；外部源失败静默降级，不阻断展示）
- ✅ 未加新 lucide 图标（复用 `BarChart3` 等），无需动 `vendor/lucide.ts`
- ✅ 迁移 019 只 `CREATE TABLE` 新空表，不碰任何现有表 / 现有数据

## 数据安全
- 迁移与端点已在**临时库** `ASSET_DASHBOARD_DB=/tmp/...` 上验证：019 正常 apply、端点返回 200。
- **未对真实 `server/data.db` 运行过迁移**。正式 apply 前应先跑 `scripts/backup-real-data.sh` 再启动服务。

## 验收
- `npx tsc -b` → 0 错误
- `cd server && go build ./...` → Success
- 临时库端点冒烟：`GET /api/benchmark-prices?symbols=000300,SPX` 返回 200，缺参返回 400

## 注意（git 状态）
本会话期间有并发提交把 `Dashboard.tsx`、`calc.ts` 的基准改动并入了 HEAD（commit 20d6e10 一带），但它们 import 的 `useBenchmarkPrices.ts`、`benchmark.ts` 等仍是未跟踪/未提交状态——**当前 HEAD 单独 checkout 会因缺这些文件而 tsc 失败**。本步剩余未提交文件正好补全 HEAD。提交时需把以下一并纳入：
`server/internal/{handler,model,store}/benchmark.go`、`server/migrations/019_*.sql`、`server/main.go`、`src/hooks/useBenchmarkPrices.ts`、`src/lib/benchmark.ts`、`src/lib/types.ts`、`src/components/dashboard/PerformancePanel.tsx`。
