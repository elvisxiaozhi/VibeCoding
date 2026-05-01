# VibeCoding — Asset Dashboard 项目上下文

## 项目简介
前后端分离的个人资产汇总看板。权威规范见根目录 `asset-dashboard-spec.md`（v3），每个新会话开始前请先读取。

## 架构速览
三端共享一个 Go 后端 + SQLite，前端做派生计算：

```
  iOS App ─┐
           ├─→ Go HTTP API (server/) ─→ SQLite (server/data.db)
  Web SPA ─┘    · Bearer token (iOS) / Cookie (Web)
                · 只做存储 + CRUD，不算派生指标

  Web 派生层 (src/lib/{calc,attribution,risk}.ts)
  · 市值、盈亏、XIRR、归因、风险敞口都在前端算
  · 后端字段变 → 前后端 Asset 类型 + calc.ts 三处同步
```

外部数据源：实时行情（`handler/quotes.go`）、汇率（`handler/fx_rates.go`）、定时刷新（`handler/price_refresh.go`）。已部署至腾讯云 62.234.19.227。

## 技术栈（严格约束，不得替换）
- **前端**：Vite + React + TypeScript + Tailwind CSS v3 + Shadcn UI（手动安装，Default 风格 / Slate / CSS Variables）+ lucide-react + Recharts（Step 7 起引入）
- **后端**：Go 1.22+ + `net/http` 标准库 + SQLite（`modernc.org/sqlite`）+ `database/sql` + goose（Phase 2 起引入）
- **禁止引入**：Web 框架（gin/echo/chi）、ORM（gorm）、React Router、状态管理库

## 当前进度
### Phase 1 — 前端基础（已完成）
- ✅ **Step 1 — 项目初始化 + 布局骨架**（见 `docs/steps/step-1-report.md`）
- ✅ **Step 2 — Mock 数据 + 本地存储层**（见 `docs/steps/step-2-report.md`）

### Phase 2 — Go 后端
- ✅ **Step 3 — Go 项目骨架 + Health API**（见 `docs/steps/step-3-report.md`）
- ✅ **Step 4 — SQLite 数据层 + 迁移 + Seed**（见 `docs/steps/step-4-report.md`）
- ✅ **Step 5 — Assets CRUD API**（见 `docs/steps/step-5-report.md`）
- ✅ **Step 6 — 前端接入后端**（见 `docs/steps/step-6-report.md`）

### Phase 3 — 前端功能完善（基于真实 API）
- ✅ **Step 7 — 首页看板**（见 `docs/steps/step-7-report.md`）
- ✅ **Step 8 — 资产列表页**（见 `docs/steps/step-8-report.md`）
- ✅ **Step 9 — 新增 / 编辑资产**（见 `docs/steps/step-9-report.md`）
- ✅ **Step 10 — 删除确认 + 全局优化**（见 `docs/steps/step-10-report.md`）

### Phase 4 — 用户认证
- ✅ **Step 11 — 后端认证体系**（见 `docs/steps/step-11-report.md`）
- ✅ **Step 12 — 前端登录与双模式切换**（见 `docs/steps/step-12-report.md`）

### Phase 5 前置 — 后端适配 iOS
- ✅ **Step 13 — 后端支持 Bearer Token 认证**（见 `docs/steps/step-13-report.md`）

### Phase 5 — iOS App（规范见 `asset-dashboard-ios-spec.md`）
- ✅ **Step 14 — Xcode 项目初始化 + 网络层 + 登录**（见 `docs/steps/step-14-report.md`）
- ✅ **Step 15 — 看板首页**（见 `docs/steps/step-15-report.md`）
- ✅ **Step 16 — 资产列表 + CRUD**（见 `docs/steps/step-16-report.md`）
- ✅ **Step 17 — 体验打磨**（见 `docs/steps/step-17-report.md`）

### Phase 6 — 年化收益率
- ✅ **Step 18 — 买入日期 + 年化收益率**（见 `docs/steps/step-18-report.md`）

### Phase 7 — 货币资产
- ✅ **Step 19 — 货币资产类型 + 货币汇总**（见 `docs/steps/step-19-report.md`）
- ✅ **Step 20 — 资产板块分类展示**（见 `docs/steps/step-20-report.md`）

### Phase 8 — 真实数据与多币种
- ✅ **Step 21 — 卖出记录追踪 + IBKR 数据导入**（见 `docs/steps/step-21-report.md`）
- ✅ **Step 22 — 多币种显示 + 实时汇率换算**（见 `docs/steps/step-22-report.md`）

### Phase 9 — 体验打磨与分红
- ✅ **Step 23 — 年化收益率修正 + 红涨绿跌 + 美股实时行情**（见 `docs/steps/step-23-report.md`）
- ✅ **Step 24 — 分红记录追踪 + 逐笔时间线展示**（见 `docs/steps/step-24-report.md`）

### Phase 10 — 数据完善与 XIRR
- ✅ **Step 25 — 年化 XIRR 修正 + 备注字段 + 数据完善**（见 `docs/steps/step-25-report.md`）

### Phase 11 — 组合年化精确化
- ✅ **Step 26 — 历史汇率换算 CNY + 黄金过滤**（见 `docs/steps/step-26-report.md`）

### Phase 12 — 安全与体验
- ✅ **Step 27 — 设置页只读 / 编辑模式开关**（见 `docs/steps/step-27-report.md`）

### Phase 13 起 — 持续迭代（Phase 划分待 spec 校对）
- ✅ **Step 28 — 长期资产管理口径：年化收益率 90 天阈值**（见 `docs/steps/step-28-report.md`）
- ✅ **Step 29 — 真实数据改动前自动备份机制**（见 `docs/steps/step-29-report.md`）
- ✅ **Step 30 — 风险暴露面板与本地运行容错**（见 `docs/steps/step-30-report.md`）
- ✅ **Step 31 — 当前持仓收益归因面板**（见 `docs/steps/step-31-report.md`）
- ✅ **Step 32 — 资产快照与净值曲线**（见 `docs/steps/step-32-report.md`）
- ✅ **Step 33 — 价格刷新中心**（见 `docs/steps/step-33-report.md`）
- ✅ **Step 34 — 总览页信息架构优化**（见 `docs/steps/step-34-report.md`）
- ✅ **Step 35 — 切页面性能优化：Hook 模块级缓存 + nginx gzip**（见 `docs/steps/step-35-report.md`）

## 红线（必须遵守）
- **每个 Step 只做 spec 中列出的内容**，禁止提前实现下一 Step 的功能
- 禁止引入 React Router，页面切换一律用 `useState`
- 禁止引入状态管理库，数据层用自定义 Hook
- Go 后端不引入 Web 框架，用 `net/http` 标准库
- Go 后端不引入 ORM，用 `database/sql` 直接写 SQL
- 前后端 `Asset` 类型手动同步，字段变更时两端都要改
- 派生计算（市值、盈亏等）保留在前端 `calc.ts`，后端只做存储和 CRUD
- 保持极简：不做 spec 未要求的抽象、封装、可配置项
- 每个 Step 结束必须可运行，无控制台报错

## 关键陷阱速查
踩过的坑，每条都有具体反例：

- **加 lucide 图标必改 vendor shim**：在组件里 `import { NewIcon } from 'lucide-react'` 后，`npx tsc -b` 通过、`npm run dev` 正常，但 `vite build` 会挂。必须同步在 `src/vendor/lucide.ts` 加导出。
- **commit 不带 Co-Authored-By**：用户已声明禁止。message 体格式 `Step N: <中文标题>` + 要点，**不加任何 Co-Authored-By 尾行**。
- **派生指标只在前端算**：市值、盈亏、XIRR、归因、风险敞口都在 `src/lib/{calc,attribution,risk}.ts`。后端只存 + CRUD，别在 Go 里加派生计算。
- **Asset 字段变更要改三处**：`server/migrations/` 新增 SQL → `server/internal/model/asset.go` → `src/lib/types.ts`。如果新字段进入派生计算，再加 `src/lib/calc.ts`。
- **不要 push**：本地 commit 即停，等用户决定何时 push。
- **本地 SQLite 在 `server/data.db`**：直接动这个文件就是动用户的真实数据。改 schema 一律走迁移，别手动 SQL。

## 目录地图
**前端 `src/`**
- `components/layout/` — 布局骨架
- `components/ui/` — Shadcn 组件（手动安装，勿改 generator）
- `components/dashboard/` — 看板：`Dashboard.tsx` 总入口，下挂 `PerformancePanel`、`AssetStructurePanel`、`ReturnAttributionPanel`、`RiskExposurePanel`、`PortfolioSnapshotPanel`、`PriceRefreshCenter`、`CategoryPieChart`、`StatCard`
- `components/assets/` — 资产 CRUD：`AssetTable.tsx`（主表，最大文件）、`AssetForm.tsx`、`ClearedAssetsTable.tsx`
- `components/auth/LoginDialog.tsx`、`components/settings/Settings.tsx`
- `hooks/` — 数据层：`useAssets`、`useAuth`、`useExchangeRates`、`useHistoricalRates`、`usePortfolioSnapshots`、`usePriceRefresh`、`useEditMode`、`useClearedAssets`
- `lib/` — 纯函数：`calc.ts`（市值/盈亏/XIRR）、`attribution.ts`（收益归因）、`risk.ts`（风险敞口）、`currency.ts`、`types.ts`（前端 Asset 类型）、`utils.ts`
- `vendor/lucide.ts` — **加图标必须同步这里**（tsc 不报错但 vite build 会挂）
- `data/mock.ts` — 早期 mock 数据，仅 fallback 用

**后端 `server/`**
- `main.go` — 路由注册、中间件挂载入口
- `seed.go` — 启动期可选 seed
- `internal/handler/` — `assets.go`、`auth.go`、`fx_rates.go`、`fund_navs.go`、`portfolio_snapshots.go`、`price_refresh.go`、`quotes.go`
- `internal/store/` — `store.go`（DB 连接 + assets CRUD）、`user.go`、`portfolio_snapshot.go`、`price_refresh.go`、`store_test.go`
- `internal/model/` — `asset.go`、`user.go`、`fx_rate.go`、`portfolio_snapshot.go`、`price_refresh.go`
- `internal/middleware/` — `auth.go`（cookie + bearer）、`cors.go`
- `migrations/` — SQL 迁移（已到 012）

**iOS `ios/AssetDashboard/`** — SwiftUI，规范见 `asset-dashboard-ios-spec.md`

**其他**
- `docs/steps/step-N-report.md` — Step 1–35 简报归档
- `deploy/` — 数据导入器（`parse-ibkr.py`、`parse-alipay.py`）+ 各市场 seed 脚本（cn / hk / us / crypto / wife / misc）+ `nginx.conf`、`asset-dashboard.service`、`setup-server.sh`、`deploy.sh`
- `scripts/` — `backup-real-data.sh`、`with-backup.sh`、`generate-tlt-report.mjs`、`process-mywife-cny.py`、`process-vbrokers-tlt.mjs`

## 想做 X 看哪里

| 任务 | 改动点 |
|---|---|
| 加 / 改 Asset 字段 | `server/migrations/` 新文件 → `model/asset.go` → `handler/assets.go` → `src/lib/types.ts` → `src/lib/calc.ts`（如影响派生）|
| 加新 lucide 图标 | import 处 + `src/vendor/lucide.ts` 必须同步 |
| 加新 API endpoint | `handler/` 新 handler → `main.go` 注册路由 → 前端 hook 调用 |
| 改派生指标（市值 / XIRR / 归因 / 风险）| 只改 `src/lib/{calc,attribution,risk}.ts`，后端不动 |
| 加新资产板块 / 分类 | `migrations/009_relax_category_check.sql` 模式 + `types.ts` + `Dashboard.tsx` 分组 |
| 改实时行情 / 汇率刷新 | `handler/quotes.go` 或 `price_refresh.go` + `usePriceRefresh.ts` |
| 改组合快照逻辑 | `store/portfolio_snapshot.go` + `usePortfolioSnapshots.ts` + `PortfolioSnapshotPanel.tsx` |
| 加新页面 | **不用 React Router**，在 `App.tsx` 加 `useState` 分支 |
| 数据导入 / 批量 seed | `deploy/parse-*.py` 产出 JSON → `deploy/seed-*.sh` 写库 |
| 部署 / 服务器配置 | `deploy/asset-dashboard.service`、`deploy/nginx.conf`、`deploy/setup-server.sh` |
| 看历史决策 | `docs/steps/step-N-report.md`，Step 编号见「当前进度」|

## 启动
```bash
# 前端
npm run dev          # http://localhost:5173/

# 后端（Phase 2 起可用）
go run ./server      # http://localhost:8080/
```

## Step 交付工作流（每个 Step 严格按此四段式执行）

### 1. 实现 + 自检
- 按 spec 写代码，遵守红线
- `npx tsc -b` 必须 0 错误
- `npm run dev` 启动一次确认无控制台报错（验完即停）

### 2. 写简报 → 停下来等检查
- 在 `docs/steps/step-N-report.md` 写执行简报，参考既有简报的格式
  （关键命令 / 文件清单 / 红线遵守 / 验收结果）
- 停下来向用户报告：「Step N 实现完成，简报已写入 `docs/steps/step-N-report.md`，请检查。确认后我会提交 git 并更新 memory。」
- **必须等用户明确确认**（例如「确认」「没问题」「OK」「ship」）后才进入第 3 步
- 用户提出修改则回到第 1 步，直到他确认

### 3. 提交 git
- `git add` 具体文件，不用 `-A`
- commit message 格式 `Step N: <中文标题>`，body 列出本次交付要点。**禁止附加 `Co-Authored-By` 尾行**（用户已声明）
- 只本地提交，**不要自动 push**

### 4. 更新 memory
- 更新 `~/.claude/projects/-Users-theodore-Desktop-VibeCoding/memory/project_asset_dashboard.md`：
  - 把当前 Step 标记为已交付，写上 commit 哈希
  - 把「下一步」小节刷新为 spec 中的下一个 Step
  - 保留「恢复流程」小节不动
- 如 Step 编号推进，同步更新 `memory/MEMORY.md` 的一行索引
- 顺手刷新本 `CLAUDE.md` 的「当前进度」小节，保持与 memory 一致
- 向用户给一段简短交付摘要：commit 哈希 + memory 已同步 + 下次恢复只需说「继续 Step N」

### 触发
- 用户说「继续 Step N」「开始 Step N」「做 Step N」 → 从第 1 步开始
- 用户说「跳过简报直接提交」等显式绕过 → 尊重，但回复里复述一次确认

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (60-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk go test             # Go test failures only (90%)
rtk jest                # Jest failures only (99.5%)
rtk vitest              # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk pytest              # Python test failures only (90%)
rtk rake test           # Ruby test failures only (90%)
rtk rspec               # RSpec test failures only (60%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%)
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->