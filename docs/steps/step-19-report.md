# Step 19 执行简报 — 货币资产类型 + 货币汇总

## 交付内容

### 修改文件

**规范：**
- `asset-dashboard-spec.md` — §3 数据契约新增 currency 分类 + CurrencyCode 类型；§5 新增 Phase 7 / Step 19
- `CLAUDE.md` — 新增 Phase 7 进度条目

**后端（Go）：**
- `server/internal/model/asset.go` — 新增 CategoryCurrency 常量
- `server/internal/handler/assets.go` — 校验逻辑新增 currency 为合法 category
- `server/seed.go` — 补充 3 条货币 Mock 数据（USD、HKD、USDT）

**前端（React）：**
- `src/lib/types.ts` — AssetCategory 新增 `'currency'`；新增 CurrencyCode 类型、CURRENCY_LABELS、CURRENCY_CODES
- `src/data/mock.ts` — 补充 3 条货币示例数据（USD 美金、HKD 港币、USDT）
- `src/components/assets/AssetForm.tsx` — 分类选 currency 时：symbol 切换为货币下拉选择器，成本价/现价标签改为买入汇率/当前汇率
- `src/components/dashboard/Dashboard.tsx` — 新增「货币持仓」汇总区域（各币种持有量 + CNY 等值 + 汇率盈亏）
- `src/components/dashboard/CategoryPieChart.tsx` — 新增 currency 分类颜色（cyan）

## 功能要点

### 货币资产分类
- 新增 `currency` 分类，复用现有 Asset 模型，无需数据库迁移
- 支持 6 种货币：CNY 人民币、HKD 港币、USD 美金、BTC 比特币、USDC、USDT
- costBasis = 买入汇率（CNY），currentPrice = 当前汇率（CNY），quantity = 持有数量
- 市值/盈亏/年化自动复用现有计算逻辑

### 表单适配
- 分类选择 currency 时，symbol 自动切换为货币下拉选择器
- 成本价 → 买入汇率，现价 → 当前汇率
- 切换分类时自动重置/预填 symbol

### 看板货币汇总
- 在统计卡片和饼图之间新增「货币持仓」区域
- 3 列网格展示各币种：名称、持有数量、CNY 等值、汇率盈亏
- 仅有货币资产时显示

### 饼图
- currency 分类使用 cyan 色（#06b6d4）

## 红线遵守
- ✅ 无数据库迁移（复用 category 字段）
- ✅ 前后端 AssetCategory 手动同步
- ✅ 未引入第三方依赖
- ✅ 暂不涉及 iOS 改动

## 验收结果
- `go build ./...` — 后端编译通过
- `npx tsc -b` — 前端 0 错误
- `npm run dev` — 前端正常启动
- 游客模式可看到货币 Mock 数据（USD、HKD、USDT）
- 看板「货币持仓」区域正常展示
- 饼图包含 currency 分类（cyan 色）
- 新增资产选 currency 分类时表单切换为货币选择器
