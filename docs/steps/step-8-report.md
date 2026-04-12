# Step 8 执行简报 — 资产列表页

> 交付日期：2026-04-12
> 目标：展示所有资产明细，支持排序

---

## 1. 新增文件

| 路径 | 作用 |
|------|------|
| `src/components/ui/table.tsx` | Shadcn Table 组件（Table / TableHeader / TableBody / TableRow / TableHead / TableCell 等），手动安装 |
| `src/components/assets/AssetTable.tsx` | 资产列表组件：8 列数据 + 操作列 + 列排序 |

## 2. 修改文件

| 路径 | 变更 |
|------|------|
| `src/App.tsx` | 引入 `AssetTable`，assets 页渲染列表组件；用 `PageContent` switch 替代原有三元表达式；移除未使用的 `Button` import |

---

## 3. AssetTable 功能明细

### 列定义（8 列 + 操作列）
| 列 | 字段来源 | 对齐 | 格式 |
|----|---------|------|------|
| 名称/代码 | `asset.symbol` | 左 | 原始文本 |
| 分类 | `CATEGORY_LABELS[asset.category]` | 左 | 中文 |
| 数量 | `asset.quantity` | 右 | 原始数值 |
| 成本价 | `asset.costBasis` | 右 | 千分位 2 位小数 |
| 现价 | `asset.currentPrice` | 右 | 千分位 2 位小数 |
| 市值 | `currentPrice × quantity` | 右 | 千分位 2 位小数 |
| 盈亏额 | `市值 - 成本` | 右 | 正绿负红，带 +/- 前缀 |
| 盈亏率 | `盈亏额 / 成本` | 右 | 正绿负红，百分比 |
| 操作 | — | 右 | 编辑 ✏️ / 删除 🗑️ 按钮 |

### 排序
- 点击表头切换排序列
- 再次点击同一列切换升序/降序
- 排序图标：未激活 `ArrowUpDown`，升序 `ArrowUp`，降序 `ArrowDown`
- 文本列使用 `localeCompare('zh-CN')`，数值列直接比较

### 操作按钮
- 编辑按钮（`Pencil` 图标）、删除按钮（`Trash2` 图标，红色）
- **功能尚未接入**（Step 9 接编辑，Step 10 接删除确认）

---

## 4. 红线遵守情况

| 约束 | 是否遵守 |
|------|----------|
| 使用 Shadcn Table 组件 | ✅ 手动安装到 ui/ |
| 盈亏列正绿负红 | ✅ `#22c55e` / `#ef4444` |
| 支持按列排序 | ✅ 8 列全部可排序 |
| 不提前实现编辑/删除功能 | ✅ 按钮已放置，无 onClick |
| 数字等宽字体 | ✅ `font-mono` |
| 派生计算在前端 calc.ts | ✅ |

---

## 5. 验收结果

- `npx tsc -b` — 0 错误
- Go server + Vite dev 同时启动成功
- API proxy 返回 10 条资产
- 浏览器预期效果：
  - 点击侧边栏「资产」→ 显示 10 行资产表格
  - 点击表头排序：名称中文排序 / 盈亏率数值排序等
  - 盈亏列正绿负红，数字等宽对齐
  - 每行末尾编辑/删除按钮可见（暂无功能）
  - 点击回「总览」看板仍正常
