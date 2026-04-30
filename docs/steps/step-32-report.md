# Step 32: 资产快照与净值曲线

## 交付内容

### 1. 快照数据库结构
- 新增 `portfolio_snapshots`：
  - 每用户每天一条快照
  - 记录总资产、投入本金、累计盈亏、累计分红、持仓数量
  - 保存生成快照时使用的汇率 JSON
  - 保存当日资产状态 JSON，支持回看某一天资产状态
- 新增 `portfolio_snapshot_breakdowns`：
  - 按市场拆分
  - 按币种拆分
  - 按归属人拆分
  - 每个拆分项记录市值、成本、盈亏和占比

### 2. 后端快照接口
- 新增认证接口：
  - `GET /api/portfolio-snapshots`
  - `GET /api/portfolio-snapshots/{date}`
  - `POST /api/portfolio-snapshots`
- `POST` 根据当前资产表和前端传入的当前汇率生成快照
- 同一天重复生成会 upsert，不会产生重复记录
- 快照生成口径与 Dashboard 当前总览保持一致：
  - 当前持仓：`quantity > 0`
  - 分红记录：`quantity = 0 && dividends > 0`
  - CNY 统一折算使用当前汇率表

### 3. 前端自动每日快照
- 新增 `usePortfolioSnapshots()`：
  - 登录后拉取快照历史
  - 当前汇率加载完成后自动 upsert 今日快照
  - 支持手动刷新今日快照
  - 支持选择某一天查看明细

### 4. Dashboard 快照面板
- 新增 `PortfolioSnapshotPanel`：
  - 总资产历史曲线
  - 本金曲线
  - 盈亏曲线
  - 指定日期总览卡片
  - 市场 / 币种 / 归属人拆分条
  - 当日资产状态表
- 面板放在收益归因之后、分类占比之前。

## 关键文件

| 文件 | 变更 |
|------|------|
| `server/migrations/011_create_portfolio_snapshots.sql` | 新建快照与拆分表 |
| `server/internal/model/portfolio_snapshot.go` | 新建快照模型 |
| `server/internal/store/portfolio_snapshot.go` | 新建快照 upsert / list / get 数据访问 |
| `server/internal/handler/portfolio_snapshots.go` | 新建快照 HTTP 接口和生成逻辑 |
| `server/main.go` | 注册快照接口 |
| `src/hooks/usePortfolioSnapshots.ts` | 新建前端快照 hook |
| `src/components/dashboard/PortfolioSnapshotPanel.tsx` | 新建快照曲线和明细面板 |
| `src/components/dashboard/Dashboard.tsx` | 接入快照 hook 和面板 |
| `src/lib/types.ts` | 新增快照前端类型 |
| `src/vendor/lucide.ts` | 新增快照面板图标导出 |

## 红线遵守

- 不改变资产 CRUD API
- 不改变现有资产表结构
- 不改变 XIRR、收益归因、风险暴露口径
- 不引入后台 cron 或外部调度依赖
- 快照生成是幂等 upsert，不重复堆积同日数据
- 不删除或改写真实资产数据

## 验收结果

- `npm run build` 通过
- `go test ./...` 通过：8 个测试通过，覆盖 5 个 Go package
- 构建仍有 Vite chunk size warning，属于前端 bundle 体积提示

## 已知限制

- “每天生成一次”当前依赖登录后打开 Dashboard；没有系统级定时任务
- 快照按生成时的当前资产状态保存，不回放历史交易流水
- 按某一天查看的是该日快照保存的资产 JSON，不是基于交易记录重算的历史状态
- 市场 / 币种 / 归属人拆分基于持仓市值，分红只计入对应拆分项盈亏，不增加拆分市值
- 当前曲线是金额曲线，尚未单独计算单位净值指数
