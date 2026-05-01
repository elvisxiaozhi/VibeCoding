# Step 33: 价格刷新中心

## 交付内容

### 1. 后端刷新状态与设置
- 新增 `price_refresh_settings`：
  - 是否启用自动刷新
  - 自动刷新间隔
  - 打开 Dashboard 时是否自动刷新
- 新增 `asset_price_status`：
  - 每个资产的价格来源
  - 最后尝试时间
  - 最后成功时间
  - 最后成功价格
  - 刷新状态
  - 错误信息

### 2. 后端刷新接口
- 新增认证接口：
  - `GET /api/price-refresh/status`
  - `POST /api/price-refresh/all`
  - `POST /api/price-refresh/assets/{id}`
  - `GET /api/price-refresh/settings`
  - `PUT /api/price-refresh/settings`
- 刷新成功才更新 `assets.current_price`
- 刷新失败只记录状态和错误，不覆盖旧价格
- 现金和货币类资产按固定价格跳过

### 3. 价格来源
- 美股：新浪美股报价
- 港股：新浪港股报价
- 加密货币：Binance Vision
- 黄金：新浪 Au9999
- 人民币基金：天天基金最新净值
- 现金 / 货币：固定价格，不刷新

### 4. 前端刷新中心
- 新增 `PriceRefreshCenter`：
  - 默认以紧凑状态卡展示刷新汇总
  - 展示成功 / 失败 / 跳过数量和最近成功刷新时间
  - 有失败时在默认视图最多展示 3 条简短错误提示
  - 明细列表默认折叠，点击「明细」后展开
  - 展开明细限制高度并支持滚动，避免占满 Dashboard
  - 明细中展示每个资产的当前价、来源、状态、最后成功时间、错误信息
  - 支持刷新全部
  - 支持刷新单个资产
- Dashboard 使用新刷新中心，不再由 `useAssets` 内部直接自动刷新价格。

### 5. 设置页自动刷新配置
- 新增“价格自动刷新”设置：
  - 启用 / 关闭自动刷新
  - 打开 Dashboard 时刷新
  - 刷新频率：15 分钟、30 分钟、1 小时、每日一次
- 设置页只编辑配置，不触发自动刷新。

## 关键文件

| 文件 | 变更 |
|------|------|
| `server/migrations/012_create_price_refresh_tables.sql` | 新建刷新设置和状态表 |
| `server/internal/model/price_refresh.go` | 新建刷新设置、状态模型 |
| `server/internal/store/price_refresh.go` | 新建设置和状态 Store 方法 |
| `server/internal/handler/price_refresh.go` | 新建刷新接口和刷新引擎 |
| `server/main.go` | 注册价格刷新接口 |
| `src/hooks/usePriceRefresh.ts` | 新建前端价格刷新 hook |
| `src/components/dashboard/PriceRefreshCenter.tsx` | 新建 Dashboard 刷新中心 |
| `src/components/dashboard/Dashboard.tsx` | 接入刷新中心和新刷新 hook |
| `src/components/settings/Settings.tsx` | 新增自动刷新设置 |
| `src/hooks/useAssets.ts` | 移除旧的页面加载自动刷新逻辑，保留资产读取和 CRUD |
| `src/lib/types.ts` | 新增价格刷新类型 |

## 红线遵守

- 刷新失败不覆盖旧价格
- 不改变资产 CRUD API
- 不改变收益、风险、快照计算口径
- 不引入后台 cron 或外部调度依赖
- 自动刷新只在页面打开期间按设置执行
- 设置页不会误触发自动刷新

## 验收结果

- `npm run build` 通过
- `go test ./...` 通过：8 个测试通过，覆盖 5 个 Go package
- 构建仍有 Vite chunk size warning，属于前端 bundle 体积提示

## 已知限制

- 自动刷新依赖页面打开，不是服务器后台定时任务
- 刷新接口逐资产执行，资产很多时后续可优化为按来源批量请求
- 人民币基金代码映射仍是静态表
- 交易时间控制尚未实现，非交易时段失败会记录错误并保留旧价格
