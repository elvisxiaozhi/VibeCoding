# Step 30: 风险暴露面板与本地运行容错

## 交付内容

### 1. Dashboard 风险暴露面板
- 新增风险暴露计算模块：
  - 按币种汇总资产暴露
  - 按市场汇总资产暴露
  - 计算最大单一标的占比
  - 计算 Top 5 持仓集中度
  - 根据预设阈值生成 warning / danger 提醒
- 新增 Dashboard 展示面板：
  - 展示币种暴露进度条
  - 展示市场暴露进度条
  - 展示最大单一标的、Top 5 持仓占比、持仓标的数、高亮提醒数
  - 使用不同颜色区分正常、预警、危险状态
- Dashboard 接入 `calculateRiskExposure()`，基于当前筛选后的 holdings、汇率和组合总市值实时计算风险暴露。

### 2. 风险阈值口径
- 币种阈值：
  - CNY：75% 预警
  - USD：60% 预警，75% 危险
  - HKD：50% 预警，65% 危险
  - BTC / USDT / USDC：25% 预警，40% 危险
- 市场阈值：
  - A 股 / 港股 / 美股：60% 预警，75% 危险
  - 加密：25% 预警，40% 危险
  - 黄金：30% 预警，45% 危险
- 集中度阈值：
  - 单一标的：15% 预警，25% 危险
  - Top 5 持仓：60% 预警，75% 危险
  - 稳定币合计：25% 预警，40% 危险

### 3. 本地后端数据库路径容错
- 后端启动时优先读取 `ASSET_DASHBOARD_DB`
- 未设置环境变量时自动探测：
  - `./data.db`
  - `./server/data.db`
- 启动日志输出当前使用的数据库路径，便于排查本地前后端目录不同导致的空库问题。

### 4. 登录失败提示优化
- 登录请求增加网络错误捕获
- 当本地 API 服务未启动或无法连接时，返回明确提示：
  - `无法连接本地后端，请确认 API 服务已启动`
- 保留后端返回的业务错误信息优先展示。

### 5. Lint 忽略构建产物
- ESLint 全局忽略新增：
  - `ios/build`
  - `server/asset-dashboard*`
  - `server/vibecoding-server`
- 目的：避免 iOS 构建目录和后端二进制进入前端 lint 范围。

## 关键文件

| 文件 | 变更 |
|------|------|
| `src/lib/risk.ts` | 新建：风险暴露、集中度和提醒计算 |
| `src/components/dashboard/RiskExposurePanel.tsx` | 新建：Dashboard 风险暴露展示面板 |
| `src/components/dashboard/Dashboard.tsx` | 接入风险暴露计算和面板渲染 |
| `src/vendor/lucide.ts` | 新增 `AlertTriangle`、`ShieldCheck` 图标导出 |
| `server/main.go` | 支持 `ASSET_DASHBOARD_DB` 和本地数据库路径自动探测 |
| `server/internal/store/store_test.go` | 补齐测试内存库 schema，使 store 测试匹配当前资产字段 |
| `src/hooks/useAuth.ts` | 登录请求增加无法连接后端时的明确提示 |
| `eslint.config.js` | 忽略本地构建产物和后端二进制 |
| `.gitignore` | 忽略 iOS build、后端二进制和本地临时数据库 |

## 伴随文件

以下文件当前仍处于未跟踪状态，需要后续确认是否纳入正式提交：

| 文件 / 目录 | 当前判断 |
|------|------|
| `scripts/process-vbrokers-tlt.mjs` | VBrokers TLT PDF 结单整理脚本 |
| `scripts/process-mywife-cny.py` | 人民币资产 Excel 整理脚本 |
| `scripts/generate-tlt-report.mjs` | 从 seed 数据生成 TLT 统计报表的脚本 |
| `deploy/seed-misc.json` | 零散资产 seed 数据 |
| `.rtk/filters.toml` | 项目本地 RTK 过滤配置，当前尚未 trust |
| `ios/build/` | iOS 构建产物，不应提交 |
| `server/asset-dashboard-linux` | 后端构建产物，不应提交 |
| `server/assets.db` | 本地运行产生的数据库文件，当前为空库 |

## 红线遵守

- 不改数据库 schema
- 不改 API response schema
- 不删除真实资产数据
- 不改变现有资产收益、年化、分类、市场汇总计算口径
- 风险暴露仅新增展示和提醒，不参与资产数据写入
- 本地数据库路径探测仅影响启动时选择数据库文件，不迁移、不覆盖数据库

## 验收状态

- 当前改动尚未提交
- `docs/steps/step-30-report.md` 用于补记本次工作
- `npm run build` 通过
- `go test ./...` 通过：8 个测试通过，覆盖 5 个 Go package
- `npm run lint` 长时间无输出，已手动停止；表现与 Step 28 记录的 ESLint 挂起问题一致
- 尚未完成浏览器人工验收；后续可本地打开 Dashboard，确认风险暴露面板渲染、登录失败提示和数据库路径选择符合预期

## 已知限制

- 风险阈值目前是代码内固定常量，尚未做设置页可配置
- 币种 / 市场阈值是初始经验值，后续需要根据真实资产结构调参
- 风险提醒没有持久化，也没有历史趋势记录
- 当前面板按筛选后的 holdings 计算；切换 owner filter 时展示的是当前视图风险，不一定等于全账户风险
- 未跟踪的数据处理脚本和构建产物需要在提交前分拣，避免把临时产物混入正式 commit
