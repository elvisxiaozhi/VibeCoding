# Step 10 执行简报 — 删除确认 + 全局优化

> 交付日期：2026-04-12
> 目标：补全交互细节，打磨体验

---

## 1. 新增文件

| 路径 | 作用 |
|------|------|
| `src/components/ui/alert-dialog.tsx` | Shadcn AlertDialog 组件（基于 @radix-ui/react-alert-dialog），用于删除确认弹窗 |

## 2. 修改文件

| 路径 | 变更 |
|------|------|
| `src/hooks/useAssets.ts` | 新增 `loading` 状态，fetchAssets 时 setLoading(true/false) |
| `src/components/assets/AssetTable.tsx` | 接入删除确认弹窗（AlertDialog）+ 加载状态（Loader2 动画）+ 空状态引导 |
| `src/components/dashboard/Dashboard.tsx` | 加载状态 + 空状态引导 |
| `src/components/layout/Sidebar.tsx` | 响应式适配：窄屏可折叠，遮罩层，点击导航后自动收起 |
| `src/components/layout/AppLayout.tsx` | 管理 sidebar 折叠状态，传递 toggle 给 Header |
| `src/components/layout/Header.tsx` | 窄屏显示汉堡菜单按钮（lg 以上隐藏） |
| `package.json` / `package-lock.json` | 新增 @radix-ui/react-alert-dialog 依赖 |

## 3. 新增依赖

| 包名 | 用途 |
|------|------|
| `@radix-ui/react-alert-dialog` | AlertDialog 原语（Shadcn AlertDialog 底层） |

---

## 4. 功能明细

### 删除确认
- 点击资产行的删除按钮 → 弹出 AlertDialog 确认框
- 显示资产名称，提示「此操作无法撤销」
- 确认按钮红色（`#ef4444`），点击后调用 DELETE API 并刷新列表
- 取消按钮关闭弹窗

### 空状态
- **资产列表页**：无资产时显示 Wallet 图标 + 「暂无资产数据」 + 新增按钮
- **总览看板**：无资产时显示引导文案「请前往资产页面添加」

### 加载状态
- useAssets hook 新增 `loading` 布尔值
- 资产列表页和总览看板均在加载时显示 Loader2 旋转动画

### 响应式侧边栏
- `lg`（1024px）以上：侧边栏固定显示（`lg:static lg:translate-x-0`）
- `lg` 以下：侧边栏隐藏（`-translate-x-full`），通过 Header 汉堡按钮切换
- 展开时显示半透明遮罩，点击遮罩或导航项后自动收起
- 侧边栏头部增加关闭按钮（X 图标）

### 数字格式化
- 已在 Step 7/8 中实现千分位 + 2 位小数（`toLocaleString`），本次确认覆盖全部数值展示

---

## 5. 红线遵守情况

| 约束 | 是否遵守 |
|------|----------|
| 使用 Shadcn AlertDialog 组件 | ✅ 手动安装到 ui/ |
| 删除调用 DELETE API | ✅ 通过 useAssets.deleteAsset |
| 不引入 React Router | ✅ 侧边栏切换仍用 useState |
| 不引入状态管理库 | ✅ loading 状态在 hook 内管理 |
| 派生计算在前端 calc.ts | ✅ |
| 响应式断点使用 Tailwind lg | ✅ |

---

## 6. 验收结果

- `npx tsc -b` — 0 错误
- Go server + Vite dev 同时启动成功
- API DELETE 测试通过（count 11 → 10）
- 浏览器预期效果：
  - 点击删除按钮 → 弹出确认框 → 确认后资产消失、列表刷新
  - 取消按钮正常关闭弹窗
  - 删除所有资产后 → 显示空状态引导
  - 总览看板无数据时 → 显示空状态引导
  - 页面加载时 → 显示旋转加载动画
  - 窄屏（< 1024px）→ 侧边栏隐藏，Header 显示汉堡按钮
  - 点击汉堡按钮 → 侧边栏滑出 + 遮罩
  - 点击导航项 / 遮罩 → 侧边栏自动收起
  - 宽屏（>= 1024px）→ 侧边栏固定显示，无汉堡按钮
