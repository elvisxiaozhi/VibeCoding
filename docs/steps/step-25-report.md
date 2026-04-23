# Step 25: 年化收益率 XIRR 修正 + 备注字段 + 数据完善

## 交付内容

### 1. 资产备注字段（全栈）
- 后端：`server/migrations/008_add_note_to_assets.sql` 新增 `note` 列
- 后端：model/store/handler 全部同步 `note` 字段的读写
- 前端：`Asset` 类型、`AssetForm`、`AssetTable` 均支持 note 展示和编辑
- Mock 数据同步更新

### 2. 已清仓记录展示
- AssetTable 新增 `isConsumed` 检测（qty=0, div=0）
- 已清仓记录显示为"买入（已清仓）"标签，opacity-50 弱化样式
- 记录总数改用 `allRecords.length` 确保包含已清仓

### 3. 涨跌排行按 symbol 聚合
- Dashboard 新增 `SymbolSummary` 接口，按 symbol 汇总持仓
- Top5 涨跌排行和年化排行改为按 symbol 汇总后排序

### 4. 年化收益率 XIRR 修正（核心改动）
- **问题**：原 CAGR 公式 `(1+rate)^(365/days)-1` 对定投场景严重高估（中欧时代先锋 ~35% vs 有知有行 ~10%）
- **方案**：实现 XIRR（Newton-Raphson 求解），但仅对有 `orig_qty` 已清仓记录的资产启用
- **回退**：无已清仓记录的资产继续使用成本加权 CAGR（BOXX、鹏华丰禄等不受影响）
- 新增函数：`xirrRate()`、`holdingsXIRR()`、`cagrReturn()`
- 中欧时代先锋 150 条已清仓记录的 note 字段写入 `orig_qty:xxx` 恢复原始份额

### 5. Tiger 券商港股数据导入
- 解析 Tiger Brokers PDF 报表，导入为 HKD 资产

### 6. 基金卖出记录修正
- 中欧时代先锋：FIFO 匹配修正，保留全部 188 条买入记录（150 已清仓 + 38 活跃）
- 其余 CNY 基金逐一检查卖出记录完整性

## 关键文件
| 文件 | 变更 |
|------|------|
| `src/lib/calc.ts` | 新增 xirrRate / holdingsXIRR / cagrReturn，智能切换 XIRR/CAGR |
| `src/components/dashboard/Dashboard.tsx` | symbol 汇总 + XIRR 四参数调用 |
| `src/components/assets/AssetTable.tsx` | 已清仓展示 + XIRR 四参数调用 |
| `src/components/assets/AssetForm.tsx` | 备注字段 |
| `src/lib/types.ts` | Asset.note |
| `src/hooks/useAssets.ts` | note 字段同步 |
| `src/data/mock.ts` | note 字段 |
| `server/migrations/008_add_note_to_assets.sql` | ALTER TABLE |
| `server/internal/model/asset.go` | Note 字段 |
| `server/internal/store/store.go` | note 列读写 |
| `server/internal/handler/assets.go` | note 请求/响应 |

## 关键 commits
- `e667011` feat: 归属人筛选 + 涨跌排行按symbol汇总 + 基金卖出记录修正
- `c0b4402` feat: 资产备注字段 + 已清仓记录展示 + Tiger数据导入
- `2c0c11f` feat: 年化收益率改用 XIRR 替代 CAGR
- `c4cbc51` fix: XIRR 计算纳入已清仓买入和卖出记录
- `2f646f2` fix: XIRR 仅用于有 orig_qty 已清仓记录的资产，其余回退 CAGR

## 红线遵守
- 未引入新依赖，XIRR 纯前端实现（Newton-Raphson）
- Go 后端仅增加 note 字段的存储 CRUD，无框架/ORM 引入
- 派生计算（XIRR/CAGR）保留在前端 calc.ts

## 验收结果
- `npx tsc -b` 零错误
- 部署到 62.234.19.227 运行正常
- 中欧时代先锋年化 ~10%（与有知有行一致）
- BOXX、鹏华丰禄、大成中证红利等无已清仓记录资产保持原有 CAGR 计算不变
