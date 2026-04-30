import fs from 'node:fs'
import path from 'node:path'

const rootDir = process.cwd()
const sourcePath = path.join(rootDir, 'deploy', 'seed-real.json')
const outputDir = path.join(rootDir, 'hk', 'long')
const reportPath = path.join(outputDir, 'tlt_report.md')
const csvPath = path.join(outputDir, 'tlt_transactions.csv')

fs.mkdirSync(outputDir, { recursive: true })

const raw = fs.readFileSync(sourcePath, 'utf8')
const data = JSON.parse(raw)

const symbolMatch = 'TLT'
const rows = data
  .filter((item) => String(item.symbol ?? '').includes(symbolMatch))
  .map((item) => ({
    symbol: String(item.symbol ?? ''),
    category: String(item.category ?? ''),
    market: String(item.market ?? ''),
    costBasis: Number(item.costBasis ?? 0),
    currentPrice: Number(item.currentPrice ?? 0),
    quantity: Number(item.quantity ?? 0),
    currency: String(item.currency ?? ''),
    dividends: Number(item.dividends ?? 0),
    purchasedAt: String(item.purchasedAt ?? ''),
    owner: String(item.owner ?? ''),
  }))

if (rows.length === 0) {
  throw new Error(`No ${symbolMatch} records found in ${sourcePath}`)
}

const typeOrder = {
  buy: 0,
  sell: 1,
  dividend: 2,
  other: 3,
}

const classify = (row) => {
  if (row.quantity > 0) return 'buy'
  if (row.quantity < 0) return 'sell'
  if (row.dividends > 0) return 'dividend'
  return 'other'
}

const sortedRows = [...rows].sort((left, right) => {
  const dateCompare = left.purchasedAt.localeCompare(right.purchasedAt)
  if (dateCompare !== 0) return dateCompare

  const typeCompare = typeOrder[classify(left)] - typeOrder[classify(right)]
  if (typeCompare !== 0) return typeCompare

  return left.symbol.localeCompare(right.symbol)
})

const buyRows = sortedRows.filter((row) => row.quantity > 0)
const sellRows = sortedRows.filter((row) => row.quantity < 0)
const dividendRows = sortedRows.filter((row) => row.quantity === 0 && row.dividends > 0)

const sum = (items, getter) => items.reduce((acc, item) => acc + getter(item), 0)
const formatMoney = (value) => value.toFixed(2)
const formatQty = (value) => Number.isInteger(value) ? String(value) : value.toFixed(4)
const formatPct = (value) => `${(value * 100).toFixed(2)}%`

const totalQuantity = sum(buyRows, (row) => row.quantity) + sum(sellRows, (row) => row.quantity)
const totalCost = sum(buyRows, (row) => row.quantity * row.costBasis)
const currentMarketValue = sum(
  buyRows,
  (row) => row.quantity * row.currentPrice,
) + sum(
  sellRows,
  (row) => row.quantity * row.currentPrice,
)
const totalDividends = sum(dividendRows, (row) => row.dividends)
const averageCost = totalQuantity === 0 ? 0 : totalCost / totalQuantity
const averageCurrentPrice = totalQuantity === 0 ? 0 : currentMarketValue / totalQuantity
const unrealizedPnL = currentMarketValue - totalCost
const totalPnLWithDividends = unrealizedPnL + totalDividends
const totalReturnRate = totalCost === 0 ? 0 : totalPnLWithDividends / totalCost
const netCostAfterDividends = totalCost - totalDividends
const breakEvenPriceAfterDividends = totalQuantity === 0 ? 0 : netCostAfterDividends / totalQuantity
const dividendCoverageOfUnrealizedLoss =
  unrealizedPnL < 0 ? totalDividends / Math.abs(unrealizedPnL) : 0

const dividendByYear = dividendRows.reduce((acc, row) => {
  const year = row.purchasedAt.slice(0, 4) || 'unknown'
  acc[year] = (acc[year] ?? 0) + row.dividends
  return acc
}, {})

const summaryRows = [
  ['TLT 记录总数', String(sortedRows.length)],
  ['买入记录数', String(buyRows.length)],
  ['卖出记录数', String(sellRows.length)],
  ['股息返还记录数', String(dividendRows.length)],
  ['当前持仓数量', formatQty(totalQuantity)],
  ['累计买入成本', `${formatMoney(totalCost)} USD`],
  ['当前市值', `${formatMoney(currentMarketValue)} USD`],
  ['累计股息返还', `${formatMoney(totalDividends)} USD`],
  ['平均持仓成本', `${formatMoney(averageCost)} USD`],
  ['当前均价', `${formatMoney(averageCurrentPrice)} USD`],
  ['未计股息浮盈亏', `${formatMoney(unrealizedPnL)} USD`],
  ['计入股息后总盈亏', `${formatMoney(totalPnLWithDividends)} USD`],
  ['计入股息后收益率', formatPct(totalReturnRate)],
  ['股息后净持仓成本', `${formatMoney(netCostAfterDividends)} USD`],
  ['股息后回本价', `${formatMoney(breakEvenPriceAfterDividends)} USD`],
  ['股息覆盖浮亏比例', formatPct(dividendCoverageOfUnrealizedLoss)],
]

const summaryTable = [
  '| 指标 | 数值 |',
  '| --- | --- |',
  ...summaryRows.map(([label, value]) => `| ${label} | ${value} |`),
].join('\n')

const buyTable = [
  '| 日期 | 类型 | 数量 | 成本价 | 当前价 | 买入金额 | 当前市值 |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  ...buyRows.map((row) => {
    const costValue = row.quantity * row.costBasis
    const marketValue = row.quantity * row.currentPrice
    return `| ${row.purchasedAt} | 买入 | ${formatQty(row.quantity)} | ${formatMoney(row.costBasis)} | ${formatMoney(row.currentPrice)} | ${formatMoney(costValue)} | ${formatMoney(marketValue)} |`
  }),
].join('\n')

const dividendYearTable = [
  '| 年份 | 股息返还总额 |',
  '| --- | --- |',
  ...Object.entries(dividendByYear)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([year, amount]) => `| ${year} | ${formatMoney(amount)} USD |`),
].join('\n')

const dividendDetailTable = [
  '| 日期 | 类型 | 金额 |',
  '| --- | --- | --- |',
  ...dividendRows.map((row) => `| ${row.purchasedAt} | 股息返还 | ${formatMoney(row.dividends)} USD |`),
].join('\n')

const report = [
  '# TLT 数据统计报表',
  '',
  '## 说明',
  '',
  '- 仓库内未找到实际的 `hk/long` 目录。',
  '- 本报表改为使用本地唯一可定位且包含 TLT 明细与股息返还记录的数据源：`deploy/seed-real.json`。',
  '- 过滤条件：`symbol` 包含 `TLT`。',
  '',
  '## 汇总',
  '',
  summaryTable,
  '',
  '## 买入明细',
  '',
  buyTable,
  '',
  '## 股息返还按年汇总',
  '',
  dividendYearTable,
  '',
  '## 股息返还明细',
  '',
  dividendDetailTable,
  '',
  '## 结论',
  '',
  `- 当前 TLT 共持有 ${formatQty(totalQuantity)} 份，累计买入成本 ${formatMoney(totalCost)} USD，当前市值 ${formatMoney(currentMarketValue)} USD。`,
  `- 不计股息时浮亏 ${formatMoney(unrealizedPnL)} USD；计入股息返还 ${formatMoney(totalDividends)} USD 后，总盈亏为 ${formatMoney(totalPnLWithDividends)} USD。`,
  `- 股息已经覆盖了 ${formatPct(dividendCoverageOfUnrealizedLoss)} 的浮亏，股息后回本价降到 ${formatMoney(breakEvenPriceAfterDividends)} USD。`,
  '',
].join('\n')

const csvLines = [
  [
    'date',
    'type',
    'quantity',
    'cost_basis',
    'current_price',
    'cost_value',
    'market_value',
    'dividends',
    'currency',
    'symbol',
    'market',
    'owner',
  ].join(','),
  ...sortedRows.map((row) => {
    const type = classify(row)
    const costValue = row.quantity * row.costBasis
    const marketValue = row.quantity * row.currentPrice
    return [
      row.purchasedAt,
      type,
      row.quantity,
      row.costBasis,
      row.currentPrice,
      costValue,
      marketValue,
      row.dividends,
      row.currency,
      `"${row.symbol.replaceAll('"', '""')}"`,
      row.market,
      row.owner,
    ].join(',')
  }),
]

fs.writeFileSync(reportPath, report)
fs.writeFileSync(csvPath, `${csvLines.join('\n')}\n`)

console.log(`Generated ${path.basename(reportPath)} and ${path.basename(csvPath)} from ${path.relative(rootDir, sourcePath)}`)
