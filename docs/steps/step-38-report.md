# Step 38 简报：写操作反馈 + 网络错误区分

## 交付内容

### 问题修复
1. **增删改静默失败** → 装 Sonner toast，写操作成功/失败都有提示
2. **网络错误 = 空数据** → `useAssets` 增 `error` 状态，Dashboard 区分「真空」与「加载失败」

### 文件清单

| 文件 | 改动 |
|---|---|
| `package.json` / `package-lock.json` | 新增 `sonner` 依赖 |
| `src/components/ui/sonner.tsx` | 新增 Shadcn Sonner 包装组件 |
| `src/App.tsx` | 引入 `<Toaster position="bottom-right" richColors />` |
| `src/hooks/useAssets.ts` | 加 `import toast from 'sonner'`；`addAsset`/`updateAsset`/`deleteAsset` 改返回 `Promise<boolean>`，成功/失败各调 toast；`fetchAssets` 失败时 `setError()`，成功时清零；导出 `error` |
| `src/components/assets/AssetForm.tsx` | `onSubmit` 类型改为 `Promise<boolean>`；`handleSubmit` 改 async，加 `submitting` 状态，只在 `ok === true` 时 `onOpenChange(false)`；提交中按钮显示「提交中…」且 disabled |
| `src/components/assets/AssetTable.tsx` | `handleFormSubmit` 改 async + 返回 `Promise<boolean>`；`handleDeleteConfirm` 改 async + `await deleteAsset` |
| `src/components/dashboard/Dashboard.tsx` | 解构 `assetsError`；在 empty 态前加判断：有 error 时显示错误文案 + 「重试」按钮 |

## 红线遵守
- 未引入路由、状态管理库、Web 框架
- 未做派生计算移至后端
- `npx tsc -b` 0 错误
- `npm run dev` 启动无报错，HTTP 200 正常响应

## 验收结果
- `tsc`: 0 errors
- dev server: 启动正常，curl 返回 HTML
- 写操作改为 async，表单提交失败时弹窗保持打开
- Dashboard 在网络失败时显示错误信息 + 重试按钮，而非误导性的「暂无资产数据」
