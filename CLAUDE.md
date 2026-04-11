# VibeCoding — Asset Dashboard 项目上下文

## 项目简介
纯前端个人资产汇总看板。权威规范见根目录 `asset-dashboard-spec.md`（v2），每个新会话开始前请先读取。

## 技术栈（严格约束，不得替换）
Vite + React + TypeScript + Tailwind CSS v3 + Shadcn UI（手动安装，Default 风格 / Slate / CSS Variables）+ lucide-react + Recharts（Step 3 起引入）+ localStorage。

## 当前进度
- ✅ **Step 1 — 项目初始化 + 布局骨架**（见 `docs/steps/step-1-report.md`）
- ⏭️ **Step 2 — Mock 数据 + 本地存储层**（下一步）
- ⏸️ Step 3 — 首页看板
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
