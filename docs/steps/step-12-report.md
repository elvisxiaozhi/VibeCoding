# Step 12 执行简报 — 前端登录与双模式切换

## 交付内容

### 新增文件
- `src/hooks/useAuth.ts` — 认证状态管理 hook（login/logout/me 接口调用、user 状态）
- `src/components/auth/LoginDialog.tsx` — 登录弹窗（Shadcn Dialog + Input，含错误提示）

### 修改文件
- `src/hooks/useAssets.ts` — 接收 `isLoggedIn` 参数，游客态从 `mock.ts` 读取静态数据，登录态走 `/api/assets`；fetch 请求加 `credentials: 'include'`
- `src/components/layout/Header.tsx` — 右上角新增：游客显示「登录」按钮，登录后显示用户名 + 「登出」按钮
- `src/components/layout/AppLayout.tsx` — 透传 user/onLogin/onLogout 给 Header
- `src/components/dashboard/Dashboard.tsx` — 接收 `isLoggedIn` prop，游客模式显示演示 banner
- `src/components/assets/AssetTable.tsx` — 接收 `isLoggedIn` prop，游客模式隐藏新增/编辑/删除按钮和操作列，显示演示 banner
- `src/App.tsx` — 引入 `useAuth`，初始化加载显示 loading，将 `isLoggedIn` 传递给子组件

## 双模式逻辑
- **游客模式（默认）**：`GET /api/me` 返回 401 → `user = null`；`useAssets(false)` 从 `mock.ts` 加载静态数据，CRUD 操作为 no-op；UI 隐藏编辑/删除/新增按钮，页面显示蓝色演示 banner
- **登录模式**：登录成功 → `user` 有值；`useAssets(true)` 走后端 API，完整 CRUD 可用；登出后自动切回游客模式

## 红线遵守
- ✅ 未引入 React Router（登录用 Dialog 弹窗）
- ✅ 未引入状态管理库（useAuth 自定义 hook）
- ✅ 未涉及后端改动
- ✅ 派生计算保留在前端 calc.ts

## 验收结果
- `npx tsc -b` — 0 错误
- 同时启动前后端：
  - 未登录：看到 mock 数据看板 + 演示 banner，无编辑/删除按钮
  - 点击登录 → 弹出 Dialog → 输入 admin/admin123 → 登录成功
  - 登录后：看到真实数据，新增/编辑/删除按钮可用
  - 点击登出 → 回到游客模式
  - 登录失败：显示错误提示
