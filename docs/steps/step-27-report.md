# Step 27: 设置页只读 / 编辑模式开关

## 交付内容

### 1. 编辑模式状态管理（`useEditMode`）
- 模块级状态 + listener 订阅模式，参考 `useExchangeRates` 的写法
- 状态持久化到 `localStorage[vibecoding.editMode]`，默认 `'read'`
- 暴露 `{ mode, isReadOnly, setReadOnly }`，多组件订阅同一份状态
- localStorage 不可用时静默回退到内存态
- **设计定位**：仅前端 UX 锁，不是安全边界。后端无 RBAC，登录用户仍可绕过 UI 直接调 API；如未来需要"管理员真锁住"，需在后端加角色字段，这是单独的工作

### 2. 设置页（`Settings.tsx`）
- 替换 `App.tsx` 里 `'settings'` 分支原本的 `PagePlaceholder`
- 单卡片 + 自撸 Tailwind toggle（避免引入 Shadcn Switch 文件）
- 显示当前模式（Lock/Unlock 图标 + 文字 + 说明），点击 toggle 切换
- 文案明确说明"只读模式下，资产页面的新增/编辑/删除按钮全部隐藏，价格自动刷新不受影响"
- 顺手把 `App.tsx` 里失去意义的 `PagePlaceholder` 组件 + 相关 Card 导入移除

### 3. AssetTable 按钮门禁
- 引入 `useEditMode`，定义 `canEdit = isLoggedIn && !isReadOnly`
- 把所有"操作"相关的 `isLoggedIn` 守卫替换为 `canEdit`：
  - 表头「操作」列（line 438）
  - 顶部「新增资产」按钮（line 326 / 375 两处，含空状态）
  - 主行操作 TableCell（line 544）
  - 分红记录行操作 TableCell（line 601）
  - 已清仓占位 TableCell（line 646，保持列对齐）
  - 卖出记录行操作 TableCell（line 692）
  - 买入明细行操作 TableCell（line 764）
- 顶部新增「只读模式」banner（amber 配色 + Lock 图标 + 「前往设置启用编辑」文案），仅 `isLoggedIn && isReadOnly` 时显示

### 4. 防御性 submit / delete guard
- `handleFormSubmit`: 入口 `if (!canEdit) return`
- `handleDeleteConfirm`: 改为 `if (canEdit && deletingAsset)`，read-only 时仅关闭弹窗不调 deleteAsset
- 这两层是兜底——理论上 `canEdit=false` 时按钮已隐藏不可触发，但兜底防止 modal 打开后中途切换模式

### 5. 不锁的范围（按用户确认）
- **价格自动刷新**：useAssets 内的美股 / 港股 / 加密货币 / 基金 / 黄金 实时行情拉取仍正常运行（系统侧被动同步，非用户编辑）
- **owner / 板块 / 持仓-已清仓 切换**：纯查看，不锁
- **AssetForm / AlertDialog 模态本身**：仍按 `isLoggedIn` 挂载，`canEdit` 检查在 submit/confirm handler 处兜底
- **后端**：未做改动，不发 header / 不加校验

## 关键文件

| 文件 | 变更 |
|------|------|
| `src/hooks/useEditMode.ts` | 新建：模块级状态 + localStorage 持久化 |
| `src/components/settings/Settings.tsx` | 新建：设置页 + 自撸 toggle |
| `src/App.tsx` | settings 分支接入 Settings；移除失效的 PagePlaceholder |
| `src/components/assets/AssetTable.tsx` | canEdit 门禁 + 只读 banner + handler guard |

## 红线遵守
- 未引入新依赖（无 Shadcn Switch、无状态管理库、无 React Router）
- 后端零改动，纯前端
- Toggle 用 Tailwind 自撸，未新增 UI 组件文件
- 派生模式 / 计算继续留在 hook 层

## 验收结果
- `npx tsc -b` 零错误
- `npm run dev` 启动 HTTP 200，无控制台错误
- 设置页显示 toggle，切换后 localStorage 写入成功
- AssetTable 在 read-only 时：顶部 banner 出现、新增按钮消失、操作列整列消失（表头 + 数据行）
- 切回 edit 模式所有操作按钮恢复

## 已知限制
- **不是安全边界**：登录用户仍可通过浏览器 devtools / curl 调 API 修改数据。这是 UX 防误操作锁，非权限系统
- **多 tab 不同步**：模块级状态在同一 tab 共享，但跨 tab 切换需刷新（localStorage storage 事件未监听，本期不做）
