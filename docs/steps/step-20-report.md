# Step 20 执行简报：资产板块分类展示

## 交付内容

为资产新增 `market` 字段（板块），支持按 **人民币资产 / 港股资产 / 美股资产 / 加密货币资产** 四大板块分组展示和汇总。

## 后端改动

| 文件 | 说明 |
|------|------|
| `server/migrations/005_add_market_to_assets.sql` | 新增 `market TEXT NOT NULL DEFAULT 'cn'`，按已有 category/symbol 推断 market |
| `server/internal/model/asset.go` | 新增 `MarketType` 常量（cn/hk/us/crypto）和 `Market` 字段 |
| `server/internal/store/store.go` | 全部 CRUD SQL 加入 market 字段（SELECT/INSERT/UPDATE/Scan） |
| `server/internal/handler/assets.go` | createRequest/updateRequest 加 Market；create 默认 cn，update 保留原值 |
| `server/seed.go` | 13 条 Mock 数据全部补上 Market 值 |

## 前端改动

| 文件 | 说明 |
|------|------|
| `src/lib/types.ts` | 新增 `MarketType`、`MARKET_LABELS`、`MARKET_ORDER`；Asset 接口加 `market` |
| `src/data/mock.ts` | 13 条 Mock 数据加 `market` |
| `src/hooks/useAssets.ts` | `updateAsset` 合并逻辑加 `market` |
| `src/components/assets/AssetForm.tsx` | 表单新增板块选择器（分类和货币之间） |
| `src/components/assets/AssetTable.tsx` | 资产列表按板块分组显示，每组带市值/盈亏/盈亏率小计 |
| `src/components/dashboard/Dashboard.tsx` | 用板块汇总卡片（市值 + 占比 + 盈亏率）替换原货币持仓区域 |

## 红线遵守
- 未引入任何新依赖
- 未使用 Web 框架、ORM、React Router、状态管理库
- 派生计算保留在前端 calc.ts
- Asset 类型前后端手动同步

## 验收结果
- `go build ./...` — 0 错误
- `npx tsc -b` — 0 错误
