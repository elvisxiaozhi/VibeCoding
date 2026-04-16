# Step 18 执行简报 — 买入日期 + 年化收益率

## 交付内容

### 新增文件
- `server/migrations/004_add_purchased_at_to_assets.sql` — 迁移：assets 表新增 purchased_at 列，已有数据默认取 created_at

### 修改文件

**后端（Go）：**
- `server/internal/model/asset.go` — Asset struct 新增 PurchasedAt 字段
- `server/internal/store/store.go` — 所有 SQL 查询/插入/更新同步新增 purchased_at
- `server/internal/handler/assets.go` — createRequest/updateRequest 新增 PurchasedAt，create 时默认取当前时间，update 时默认保留原值
- `server/seed.go` — Mock 数据补充 PurchasedAt（分散在 2024-06 ~ 2025-09）

**前端（React）：**
- `src/lib/types.ts` — Asset 接口新增 purchasedAt 字段
- `src/lib/calc.ts` — 新增 holdingDays()、annualizedReturn()、totalAnnualizedReturn() 三个计算函数
- `src/data/mock.ts` — Mock 数据补充 purchasedAt（与后端 seed 一致）
- `src/hooks/useAssets.ts` — AssetDraft merge 逻辑补充 purchasedAt
- `src/components/assets/AssetForm.tsx` — 表单新增「买入日期」字段（input[type=date]），编辑时预填充
- `src/components/assets/AssetTable.tsx` — 列表新增「年化收益率」列，支持排序，正绿负红
- `src/components/dashboard/Dashboard.tsx` — 看板新增「组合年化」统计卡片（4 列布局）

## 功能要点

### 年化收益率计算
- 单资产：`((1 + 盈亏率) ^ (365 / 持有天数)) - 1`
- 组合：按资产成本加权平均各资产年化收益率
- 持有天数最小为 1 天，避免除零

### 前端表单
- 新增资产默认今天日期
- 编辑资产预填充 purchasedAt（兼容旧数据：无 purchasedAt 则用 createdAt）

### 后端兼容
- 迁移自动为已有数据设置 purchased_at = created_at
- API 创建时若未传 purchasedAt 默认取当前时间
- API 更新时若未传 purchasedAt 保留原值

## 红线遵守
- ✅ 年化收益率留在前端计算，后端只存 purchasedAt
- ✅ 前后端 Asset 类型手动同步
- ✅ 未引入第三方依赖
- ✅ 暂不涉及 iOS 改动（按用户要求）

## 验收结果
- `go build ./...` — 后端编译通过
- `npx tsc -b` — 前端 0 错误
- 迁移 004 运行成功，已有数据自动补充 purchased_at
- API 返回 purchasedAt 字段
- `npm run dev` — 前端正常启动
- 看板新增「组合年化」卡片
- 资产列表新增「年化收益率」列
- 新增/编辑表单含日期选择器
