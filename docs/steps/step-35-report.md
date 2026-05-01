# Step 35: 切页面性能优化 — Hook 模块级缓存 + nginx gzip

## 背景
线上反馈：每次切换页面（Dashboard ↔ 资产 ↔ 设置）都会转圈半天才出来。
排查发现根因是数据 hook 的状态全部放在组件内部 `useState`，组件 unmount/remount 时
状态被清空 → 重新 fetch → 显示 spinner。叠加 `usePriceRefresh` / `usePortfolioSnapshots`
里用 `useRef` 守的 "首次进入只跑一次" 也跟着 remount 重置，导致每次切回 Dashboard
都会触发 `/api/price-refresh/all` 全量拉价 + `POST /api/portfolio-snapshots` 建快照
这两个慢操作。

## 交付内容

### 1. `useAssets` 加模块级缓存（SWR 风格）
- 新增 `assetsCache: Map<owner, Asset[]>`，按 `ownerFilter` 维度缓存登录态资产
- `useState` 初始化时直接从缓存读取，命中即立即上屏、loading=false（**不再显示 spinner**）
- `fetchAssets` 内部检查缓存：命中先上屏，再后台静默 revalidate；未命中走旧 spinner 流程
- 写操作（add / update / delete）后 `assetsCache.clear()` 全量失效，再 `fetchAssets` 写回当前 key
  - 跨 owner 写操作影响所有视图，简单一刀切是对的
- 未登录态走 MOCK_ASSETS，不动缓存，避免登入登出污染

### 2. `usePortfolioSnapshots` 加模块级缓存 + 修建快照重复触发 bug
- 新增 `snapshotsCache` / `selectedSnapshotCache` 模块级变量
- `useState` 初始化读缓存，loading 仅在缓存为空时为 true
- **核心 bug 修复**：`createdTodayRef = useRef(false)` → `createdTodayThisSession`（模块级）
  - 原写法每次 Dashboard remount（即每次切回首页）都重置成 false，
    会再次触发 `POST /api/portfolio-snapshots` 重建今日快照
  - 模块级后整个会话只跑一次，行为符合 "打开 Dashboard 时刷新一次" 的语义
- 创建快照后 `snapshotsCache = null` 强制下次 fetch 重新拉列表

### 3. `usePriceRefresh` 加模块级缓存 + 修切页全量刷价 bug
- 新增 `statusesCache` / `settingsCache` 模块级变量
- **核心 bug 修复**：`openedRefreshRef = useRef(false)` → `openedRefreshThisSession`（模块级）
  - 这是线上体感最慢的元凶：每次切回 Dashboard 都触发 `POST /api/price-refresh/all`，
    后端会同步去 Yahoo / 新浪 / Binance 拉所有持仓价格（200+ 条），常常 10s+
  - 改成模块级后整个会话只跑一次
- `fetchStatus` / `fetchSettings` / `refreshAll` / `refreshOne` / `saveSettings` 里更新 state 时
  同步写缓存
- 移除不再需要的 `useRef` import

### 4. `useClearedAssets` 加模块级缓存
- 静态 JSON 文件 `/cleared-assets.json` 会话内不变，加 `clearedAssetsCache` 单值缓存
- 命中缓存直接 setLoading(false)，不再每次切到资产页都重拉

### 5. `useHistoricalRates` — 不动
- 早已有模块级 `rateCache`，effect 内部命中缓存直接 return，loading 默认 false
- 切页面本就没有 spinner，无需改动

### 6. nginx gzip
- `deploy/nginx.conf` 加 gzip 块（comp_level=6, min_length=1024）
- 覆盖 JS / CSS / JSON / SVG，预期 JS bundle 传输体积约 -70%
- 服务器侧需 `nginx -t && systemctl reload nginx` 生效

## 关键文件

| 文件 | 变更 |
|------|------|
| `src/hooks/useAssets.ts` | 加 `assetsCache: Map`，命中跳过 spinner，写操作清缓存 |
| `src/hooks/usePortfolioSnapshots.ts` | 加 snapshots/selected 缓存；createdTodayRef → 模块级 |
| `src/hooks/usePriceRefresh.ts` | 加 statuses/settings 缓存；openedRefreshRef → 模块级（修线上慢的元凶） |
| `src/hooks/useClearedAssets.ts` | 加单值缓存 |
| `deploy/nginx.conf` | 加 gzip 配置 |

## 红线遵守
- 未引入新依赖（仍是 hook + module-level let，无 SWR / TanStack Query）
- 未改任何 API 行为 / 后端代码 / 数据计算口径
- 未改 prop 签名（数据层就地优化，组件零改动）
- 未引入 React Router / 状态管理库
- 缓存逻辑分散在各 hook 内部，与现有 `useExchangeRates` / `useHistoricalRates` 写法保持一致

## 验收结果
- `npx tsc -b` 零错误
- `npm run dev` 启动 HTTP 200
- 服务器部署：`bash deploy/deploy.sh` + 同步 nginx.conf 到 `/etc/nginx/sites-available/asset-dashboard` + `nginx -t && systemctl reload nginx`

## 预期效果
- 切页面（Dashboard ↔ 资产 ↔ 设置）**不再有 spinner**，缓存命中秒上屏
- 切回 Dashboard **不再触发**全量价格刷新和重复建快照（每会话各跑一次）
- 首次访问/硬刷新 nginx gzip 进一步压缩静态资源传输

## 已知限制
- 缓存是 module-level 单例，跨标签页不共享（同一标签页内才生效）
- 强制刷新页面后所有缓存清空，重新走完整 fetch（这是预期行为）
- 写操作后其他 owner 视图的缓存被清掉，下次切到该 owner 仍会 fetch 一次（SWR 语义，不显 spinner）
