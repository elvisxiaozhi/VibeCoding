# VibeCoding — Asset Dashboard 项目上下文

## 项目简介
前后端分离的个人资产汇总看板。权威规范见根目录 `asset-dashboard-spec.md`（v3），每个新会话开始前请先读取。

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

## 目录约定
- `src/components/layout/` — 布局组件
- `src/components/ui/` — Shadcn 组件
- `src/components/dashboard/`、`src/components/assets/` — 业务组件（Phase 3 创建）
- `src/hooks/`、`src/lib/`、`src/data/` — 前端数据与逻辑
- `server/` — Go 后端根目录（Phase 2 起创建）
- `server/internal/model/` — Go 领域类型
- `server/internal/store/` — 数据库访问层
- `server/internal/handler/` — HTTP handlers
- `server/internal/middleware/` — 中间件
- `server/migrations/` — SQL 迁移文件
- `docs/steps/step-N-report.md` — 每个 Step 的执行简报归档

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
- commit message 格式 `Step N: <中文标题>`，body 列出本次交付要点，带 `Co-Authored-By: Claude` 尾行
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