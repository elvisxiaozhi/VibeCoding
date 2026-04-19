# Step 21 执行简报：卖出记录追踪 + IBKR 数据导入

## 交付内容

支持卖出记录（负数 quantity）的存储和展示，新增 IBKR 交易报表解析工具和数据导入脚本，资产列表按 symbol 分组展示并支持展开查看买入/卖出明细。

## 后端改动

| 文件 | 说明 |
|------|------|
| `server/internal/handler/assets.go` | 验证逻辑从 `quantity <= 0` 改为 `quantity == 0`，允许负数（卖出记录） |

## 前端改动

| 文件 | 说明 |
|------|------|
| `src/hooks/useAssets.ts` | 新增 `holdings` 过滤（qty > 0），所有组合计算只统计持仓 |
| `src/components/dashboard/Dashboard.tsx` | 所有计算使用 `holdings` 而非 `assets`，排除卖出记录 |
| `src/components/assets/AssetTable.tsx` | 重写为 SymbolGroup 模式：按 symbol 合并多条记录，支持展开明细；买入绿色边框+标签，卖出红色边框+标签；已清仓标的显示「已清仓」标签和已实现盈亏 |

## 部署/工具脚本

| 文件 | 说明 |
|------|------|
| `deploy/parse-ibkr.py` | 解析 IBKR Activity Statement CSV，提取交易记录，FIFO 匹配卖出，输出持仓+卖出 JSON；支持 SPLG→SPYM 重命名；解析现金余额（USD/HKD） |
| `deploy/seed-real.sh` | 通过 API（curl）批量导入资产，`--clear` 先清空已有数据 |
| `.gitignore` | 新增 `deploy/seed-real.json` 和 `deploy/ibkr/`，真实数据不进 git |

## 数据导入结果

- 101 条买入 lot（81 条）+ 卖出记录（20 条，BOXX/RUM/SGOV）
- 后追加 2 条现金余额（USD $25.94 / HKD HK$107.41），最终 103 条

## 红线遵守
- 未引入任何新依赖
- 敏感数据（IBKR CSV、seed JSON）通过 .gitignore 排除
- 派生计算保留在前端 calc.ts

## 验收结果
- `go build ./...` — 0 错误
- `npx tsc -b` — 0 错误
- 服务器数据：103 条记录（81 买入 + 20 卖出 + 2 现金）
- Commit: `a29a300`
