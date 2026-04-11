# Step 2 执行简报 — Mock 数据 + 本地存储层

> 交付日期：2026-04-11
> 目标：沉淀数据契约、计算工具、Hook 与 Mock，使后续 Step 可以直接消费资产数据

---

## 1. 新增文件

| 路径 | 作用 |
|------|------|
| `src/lib/types.ts` | `AssetCategory` / `Asset` 接口 + `CATEGORY_LABELS` + `CATEGORY_ORDER` |
| `src/lib/calc.ts` | 纯函数计算层：单条市值 / 成本 / 盈亏 / 盈亏率，组合汇总，`categoryBreakdown` |
| `src/data/mock.ts` | 10 条 Mock 资产，覆盖 stock / etf / crypto / cash 四类，币种统一 CNY |
| `src/hooks/useAssets.ts` | 自定义 Hook：`assets` + CRUD + 派生值 + localStorage 持久化 |

## 2. 修改文件

- `src/App.tsx` — 在总览页下方加了一个临时 `DataSelfCheck` Card，纯文本展示 `useAssets()` 输出的汇总值和分类占比，验证全链路数据流；仅在 `overview` 页渲染，Step 3 会被正式看板替换。

## 3. 契约要点

- **类型契约**：严格按 spec §3 的 `Asset` 字段定义，未新增字段。
- **计算契约**：所有金额都在 `calc.ts` 中以原始数值计算，展示层才格式化。
- **存储契约**：`localStorage` key = `vibecoding:assets:v1`。
  - 读取：Hook 初始化时尝试读 key，缺失或解析失败则回退到 `MOCK_ASSETS`。
  - 写入：`useEffect([assets])` 统一同步，首次挂载即把 Mock 写入存储，完成「首次加载 → 写入 Mock」的 spec 要求。
- **ID 生成**：`crypto.randomUUID()` 优先，不可用时退化为 `asset-<ts>-<rand>`。

## 4. 红线遵守情况

| 约束 | 是否遵守 |
|------|----------|
| 只实现 Step 2 列出的数据层，不动 Step 3 看板 UI | ✅（自检卡是纯文本，无图表/无 StatCard 抽象） |
| 不引入状态管理库 | ✅（仅 `useState` + `useEffect`） |
| 金额计算使用原始数值，展示层再格式化 | ✅ |
| Mock 覆盖全部 4 个分类 | ✅（stock×3 / etf×2 / crypto×3 / cash×2） |
| Step 结束 `npm run dev` 可运行 | ✅ |

## 5. 验收结果

- `npx tsc -b` — 0 错误
- `npm run dev` — Vite v8 启动成功（392ms，http://localhost:5173/）
- 页面：切到「总览」可看到「Step 2 数据自检」卡片，展示 10 条资产、总市值 / 总成本 / 浮动盈亏（正绿负红）、四分类占比之和 ≈ 100%
- 刷新页面：数据来自 localStorage，条数与金额保持不变
