# Step 6 执行简报 — 前端接入后端

> 交付日期：2026-04-12
> 目标：前端数据来源从 localStorage 切换为 Go API，全链路跑通

---

## 1. 修改文件

| 路径 | 变更 |
|------|------|
| `vite.config.ts` | 新增 `server.proxy`：`'/api' → 'http://localhost:8080'`，Vite 代理 API 请求到 Go 后端 |
| `src/hooks/useAssets.ts` | **整体重写**：localStorage 读写 → `fetch('/api/...')`；删除 `STORAGE_KEY`、`loadFromStorage`、`saveToStorage`、`mock.ts` import |

---

## 2. `useAssets.ts` 改动要点

### 删除的逻辑
- `import { MOCK_ASSETS } from '@/data/mock'` — Mock 数据现在由后端 Seed 提供
- `loadFromStorage()` / `saveToStorage()` — 不再使用 localStorage
- `useEffect` 同步回 localStorage

### 新增的逻辑
- `fetchAssets()`：`GET /api/assets` 拉取全部资产，`useEffect` 初始加载时调用
- `addAsset(draft)`：`POST /api/assets` + 自动 refetch
- `updateAsset(id, patch)`：从本地 state 取当前值 → 合并 patch → `PUT /api/assets/{id}` + refetch
- `deleteAsset(id)`：`DELETE /api/assets/{id}` + refetch
- 所有操作加了 try/catch 错误日志（console.error），Step 10 再做 UI 级错误处理

### 保持不变
- 导出签名：`assets` / `addAsset` / `updateAsset` / `deleteAsset` / `totalValue` / `totalCost` / `totalPnL` / `categoryBreakdown`
- 派生计算仍在前端 `calc.ts`
- `AssetDraft` / `AssetPatch` 类型导出不变

### 文件保留
- `src/data/mock.ts` 保留文件（后端 `seed.go` 仍参考其数据），但不再被前端 import

---

## 3. 红线遵守情况

| 约束 | 是否遵守 |
|------|----------|
| 派生计算留在前端 calc.ts | ✅ |
| 不提前实现 Step 7 的看板 UI | ✅ |
| 前后端类型手动同步 | ✅ JSON tag 与 TS interface 一致 |
| useAssets 对外 API 不变 | ✅ 调用方无需修改 |

---

## 4. 验收结果

- `npx tsc -b` — 0 错误
- Go server（`cd server && go run .`）— 迁移 + Seed + 监听 :8080
- Vite dev（`npm run dev`）— 代理 `/api` → `:8080`
- `curl http://localhost:5173/api/assets` — 通过 Vite 代理返回 10 条资产（数据来自 SQLite）
- 浏览器打开 http://localhost:5173/ — 总览页的 Step 2 临时自检卡正确显示来自后端的资产汇总数据
- **Phase 2 Go 后端全部完成**，前后端已打通
