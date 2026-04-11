# Step 1 执行简报 — 项目初始化与布局骨架

> 交付日期：2026-04-11
> 目标：搭建 Vite + React + TS + Tailwind + Shadcn UI 的纯前端深色布局骨架

---

## 1. 关键终端命令

| 顺序 | 命令 | 作用 |
|------|------|------|
| 1 | `npx create-vite@latest . --template react-ts --overwrite` | 在当前目录直接拉取 Vite React+TS 模板（避免嵌套同名文件夹） |
| 2 | `npm install` | 安装基础依赖 |
| 3 | `npm install -D tailwindcss@3 postcss autoprefixer` | 安装 Tailwind v3 及 PostCSS |
| 4 | `npx tailwindcss init -p` | 生成 `tailwind.config.js` / `postcss.config.js` |
| 5 | `npm install lucide-react` | 安装图标库 |
| 6 | `npm install class-variance-authority clsx tailwind-merge tailwindcss-animate` | Shadcn UI 运行时依赖 |
| 7 | `npx tsc -b` | TypeScript 编译校验（0 错误） |
| 8 | `npm run dev` | 启动 Vite 开发服务器（http://localhost:5173/） |

---

## 2. 创建 / 修改的核心文件

### 配置层
- `vite.config.ts` — 新增 `@ → src` 路径别名
- `tsconfig.json` / `tsconfig.app.json` — 同步 `paths` 映射（TS 6 已弃用 baseUrl，直接用 paths）
- `tailwind.config.js` — Shadcn 主题色 token（HSL CSS 变量）+ 容器配置 + `tailwindcss-animate` 插件
- `components.json` — Shadcn CLI 配置（Default 风格 / Slate 颜色 / CSS Variables 开启 / lucide 图标）
- `index.html` — `<html class="dark" lang="zh-CN">`，标题改为 `Asset Dashboard`

### 样式层
- `src/index.css` — 清理 Vite 默认样式，注入 Tailwind 三大指令 + 亮/暗 HSL 变量 + `body` 全局 `bg-[#0a0a0a] text-white`
- 删除 `src/App.css`（Vite 模板冗余 CSS）

### Shadcn 基础组件
- `src/lib/utils.ts` — `cn()` 工具函数
- `src/components/ui/button.tsx` — Button + 6 种 variant（default / destructive / outline / secondary / ghost / link）
- `src/components/ui/card.tsx` — Card 家族（Card / Header / Title / Description / Content / Footer）

### 布局骨架
- `src/components/layout/Sidebar.tsx` — 定宽 240px，三项导航（总览 / 资产 / 设置），激活态高亮
- `src/components/layout/Header.tsx` — 页面标题 + 当前日期（YYYY-MM-DD）
- `src/components/layout/AppLayout.tsx` — 拼装 Sidebar + Header + Main 三区域
- `src/App.tsx` — `useState<PageKey>` 驱动主区域占位内容切换，用 Card + Button 验证 Shadcn 可用

---

## 3. 红线遵守情况

| 约束 | 是否遵守 |
|------|----------|
| 不提前编写 Mock 数据 / Hooks / 计算逻辑 | ✅ |
| 不引入 React Router，仅 `useState` 切换 | ✅ |
| 保持极简视图骨架 | ✅ |
| 深色主题 `#0a0a0a` 基调 | ✅ |
| Sidebar 定宽 240px | ✅ |

---

## 4. 验收结果

- `npx tsc -b` — 0 错误
- `npm run dev` — Vite v8 启动成功（778ms）
- 本地预览：http://localhost:5173/
- 页面可见：左侧 240px 侧边栏 / Header 日期 / 主区域 Card + Button 自检 / 导航点击高亮切换正常
