# VibeCoding — Asset Dashboard 项目上下文

## 项目简介
纯前端个人资产汇总看板。权威规范见根目录 `asset-dashboard-spec.md`（v2），每个新会话开始前请先读取。

## 技术栈（严格约束，不得替换）
Vite + React + TypeScript + Tailwind CSS v3 + Shadcn UI（手动安装，Default 风格 / Slate / CSS Variables）+ lucide-react + Recharts（Step 3 起引入）+ localStorage。

## 当前进度
- ✅ **Step 1 — 项目初始化 + 布局骨架**（见 `docs/steps/step-1-report.md`）
- ✅ **Step 2 — Mock 数据 + 本地存储层**（见 `docs/steps/step-2-report.md`）
- ⏭️ **Step 3 — 首页看板**（下一步，需引入 recharts，并删除 `src/App.tsx` 里的临时 `DataSelfCheck`）
- ⏸️ Step 4 — 资产列表页
- ⏸️ Step 5 — 新增 / 编辑资产
- ⏸️ Step 6 — 删除确认 + 全局优化

## 红线（必须遵守）
- **每个 Step 只做 spec 中列出的内容**，禁止提前实现下一 Step 的功能
- 禁止引入 React Router，页面切换一律用 `useState`
- 禁止引入状态管理库，数据层用自定义 Hook + localStorage
- 保持极简：不做 spec 未要求的抽象、封装、可配置项
- 每个 Step 结束必须 `npm run dev` 可运行，无控制台报错

## 目录约定
- `src/components/layout/` — 布局组件
- `src/components/ui/` — Shadcn 组件
- `src/components/dashboard/`、`src/components/assets/` — 业务组件（后续 Step 创建）
- `src/hooks/`、`src/lib/`、`src/data/` — 数据与逻辑（Step 2 起创建）
- `docs/steps/step-N-report.md` — 每个 Step 的执行简报归档

## 启动
```bash
npm run dev   # http://localhost:5173/
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
