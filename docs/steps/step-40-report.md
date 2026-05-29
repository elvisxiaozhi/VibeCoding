# Step 40 — 数据导出（前端 CSV）

## 目标
在资产列表页持仓 Tab 加「导出」按钮，将当前可见的持仓快照（含派生指标）下载为 CSV 文件，供 Excel / Numbers 分析。

## 实现内容

### 改动文件（共 2 个）

#### `src/vendor/lucide.ts`
- 新增 `Download` 图标 shim（`lucide-react/dist/esm/icons/download.js`）

#### `src/components/assets/AssetTable.tsx`
- import 列表加 `Download`
- 新增 `exportCSV()` 函数：
  - 遍历 `groupedByDisplay.flatMap((dg) => dg.groups)` —— 即当前搜索/过滤后的持仓标的组
  - 每组输出 15 列：标的、分类、货币、数量、均价、现价、市值、市值(CNY)、成本、盈亏额、盈亏率、分红、年化收益率、首次买入日、持有天数
  - CSV 头部加 UTF-8 BOM（`﻿`），保证 Excel 直接打开中文不乱码
  - 单元格值用双引号包裹，内部双引号转义为 `""`
  - 通过 `Blob + URL.createObjectURL + <a download>` 触发浏览器下载，文件名格式 `assets-YYYY-MM-DD.csv`
- 工具栏结构调整：把原来的 `div.relative.ml-auto`（仅含"列"按钮）改为 `div.ml-auto.flex.items-center.gap-1`，内嵌「导出」按钮 + `div.relative`（列设置下拉，原样保留）

## 关键命令

```bash
npx tsc -b   # 0 errors
npm run dev  # 页面正常加载，无控制台报错
```

## 红线遵守
- 纯前端实现，无后端改动
- 派生指标（市值 CNY、盈亏率、年化）在前端计算，与现有架构一致
- 未引入新依赖
- 新增 lucide 图标同步了 vendor shim

## 验收结果
- tsc：0 错误
- dev server：页面正常，工具栏右侧出现「导出」按钮
- 点击「导出」：下载 `assets-<日期>.csv`，含 BOM，Excel 打开中文正常显示
- 搜索/过滤状态下点击「导出」：仅导出当前可见标的
