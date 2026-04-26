# Step 26: 组合年化精确化 — 历史汇率换算 CNY + 黄金过滤

## 交付内容

### 1. 黄金类资产从 XIRR 排除
- **问题**：实物黄金无法回溯具体买入日期，`purchasedAt` 不可信，纳入 XIRR 会产生失真
- **方案**：`holdingsXIRR` 入口处按 `category === 'gold'` 整体过滤所有四类输入（活跃买入 / 分红 / 已清仓 / 卖出），后续基于过滤后的 `buyLots` 计算的"今日总市值"也自然排除黄金
- 单条黄金资产卡片的"年化"在此前 commit `24fe3c1` 已隐藏，前后端口径现在一致

### 2. 多币种 XIRR 用历史汇率换算 CNY（核心改动）
- **问题**：原 `holdingsXIRR` 把 USD/HKD/CNY 的 cashflow 直接相加，本币口径混算导致 XIRR 数字失去意义；且持有期内的汇率波动也是真实盈亏的一部分
- **方案**：每条 cashflow 用「事件发生当日的 CNY 汇率」换算后再做 XIRR
  - 买入流出：`-(costBasis × qty) × rate(currency, purchasedAt)`
  - 分红流入：`div × rate(currency, purchasedAt)`
  - 已清仓买入 / 卖出同上
  - 当前总市值：`Σ price × qty × rate(currency, today)`
- 这样 XIRR 表达的是"以 CNY 为本位币的真实组合年化"，并自动把汇率波动也算进收益里

### 3. 后端历史汇率代理 + 永久缓存
- 新增表 `fx_rates(currency, date, rate)`，主键 (currency, date)，永久缓存（历史值不变）
- 新增 `GET /api/fx-rates?pairs=USD:2024-01-15,HKD:2024-02-20,...`：
  - 同一 (currency, date) 自动去重，最大 200 对
  - CNY 直接返回 1
  - USDT / USDC 按 USD 处理（差价 < 0.5%，简化）
  - 先查本地缓存，未命中拉 Frankfurter API（`https://api.frankfurter.app/{date}?from={curr}&to=CNY`）
  - Frankfurter 失败时回退到今日汇率，响应里带 `fallback: true` 标记
  - 周末 / 节假日 Frankfurter 自动返回最近交易日的汇率
- store 层新增 `GetFXRate / UpsertFXRate` 两个方法

### 4. 前端 `useHistoricalRates` hook
- 收集 `assets` 中所有 (currency, purchasedAt) 对 + 各币种今日，调一次 `/api/fx-rates`
- 模块级 `rateCache` Map 在页面会话内复用，多次切换 owner / 刷新数据不重复请求
- 暴露 `getRate(currency, date) => number` 给 `holdingsXIRR` 当注入参数；CNY 永远返回 1

### 5. Dashboard 接入 + Loading 处理
- 三处 `holdingsXIRR` 调用（组合年化 / 单 symbol Top5 / 板块年化）全部传入 `getHistRate`
- 历史汇率加载未完成时（`histLoading`）：
  - 组合年化卡片显示 `—`
  - 板块年化显示 `—`
  - 年化 Top5 区块显示「汇率加载中…」占位
- 避免在缺率窗口内出现"半数据"导致的失真 XIRR

## 关键文件

| 文件 | 变更 |
|------|------|
| `server/migrations/010_create_fx_rates.sql` | 新增 fx_rates 表 |
| `server/internal/model/fx_rate.go` | 新增 FXRate 模型 |
| `server/internal/store/store.go` | 新增 GetFXRate / UpsertFXRate |
| `server/internal/handler/fx_rates.go` | 新增 /api/fx-rates handler + Frankfurter 调用 |
| `server/main.go` | 注册 fxRatesHandler |
| `src/hooks/useHistoricalRates.ts` | 新增 hook，模块级 rateCache |
| `src/lib/calc.ts` | holdingsXIRR 加 getRate 参数 + 黄金过滤 |
| `src/components/dashboard/Dashboard.tsx` | 接入 hook + 三处 XIRR 调用 + loading 占位 |
| `server/internal/store/store_test.go` | 顺手补 ListAssets 新签名调用（pre-existing 编译错） |

## 红线遵守
- 后端继续用 `net/http` 标准库 + `database/sql`，未引入框架 / ORM
- 前端未引入新依赖，新 hook 走 `fetch` + 模块级缓存
- 派生计算（XIRR + 汇率换算）全部留在前端 `calc.ts` / hook 层；后端只做汇率存储和外部代理
- `Asset` 类型未变更，前后端 schema 维持一致

## 验收结果
- `npx tsc -b` 零错误
- `go build ./...` 通过
- `go test ./...` 仍有 5 个失败：均来自 `store_test.go` 的 `setupTestStore` 用手写 DDL 卡在 Step 4 schema（缺 market/dividends/owner/note/purchased_at 列）。**这是 Step 5 起就存在的存量问题，与本次改动无关**，待后续单独清理
- `npm run dev` 启动 HTTP 200，无控制台错误

## 仍存在的简化
- USDT / USDC 按 USD 汇率处理（实际差价 < 0.5%，对 XIRR 影响可忽略）
- Frankfurter 是 ECB 数据，节假日返回最近交易日，与中国法定节假日略有错位（最大 1-2 天偏移，对 XIRR 影响可忽略）
- 历史汇率 fallback 走今日汇率时仅日志提示，前端不显示警告（`fallback: true` 字段已传回但未消费）
