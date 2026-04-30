import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const rootDir = process.cwd()
const inputDir = path.join(rootDir, 'deploy', 'hk', 'vbrokers')
const outputDir = path.join(rootDir, 'deploy', 'hk', 'vbrokers_processed')
const password = process.env.VBROKERS_PDF_PASSWORD ?? '0858'

const reportPath = path.join(outputDir, 'tlt_report.md')
const csvPath = path.join(outputDir, 'tlt_cashflows.csv')
const jsonPath = path.join(outputDir, 'tlt_parsed.json')

fs.mkdirSync(outputDir, { recursive: true })

function parseSignedNumber(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return 0

  const normalized = text.replaceAll(',', '')
  if (normalized.startsWith('(') && normalized.endsWith(')')) {
    return -Number(normalized.slice(1, -1))
  }

  return Number(normalized)
}

function formatMoney(value) {
  return value.toFixed(2)
}

function formatQty(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(4)
}

function formatPct(value) {
  return `${(value * 100).toFixed(2)}%`
}

function extractStatementDate(text, fileName) {
  const match = text.match(/Statement As At\s+結單日期：\s+(\d{4}-\d{2}-\d{2})/)
  if (match) return match[1]

  const fileMatch = fileName.match(/^(\d{4})(\d{2})/)
  if (!fileMatch) return ''
  return `${fileMatch[1]}-${fileMatch[2]}-01`
}

function extractTradeFromLines(lines, index, fileName) {
  const headline = lines[index]
  if (!/\b(BUY|SELL)\s+#\s*TLT\b/i.test(headline)) return null

  const qtyLine = lines[index + 2] ?? ''
  if (!/@/.test(qtyLine)) return null

  const dateLine = lines[index + 1] ?? ''
  const parts = dateLine.trim().split(/\s+/)
  if (parts.length < 4) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(parts[0]) || !/^\d{4}-\d{2}-\d{2}$/.test(parts[1]) || !/^\d+$/.test(parts[2])) {
    return null
  }

  const qtyMatch = qtyLine.match(/([0-9]+(?:\.[0-9]+)?)\s*@\s*([0-9]+(?:\.[0-9]+)?)/)
  if (!qtyMatch) return null

  const tradeType = /SELL/i.test(headline) ? 'sell' : 'buy'
  const quantity = Number(qtyMatch[1])
  const tradePrice = Number(qtyMatch[2])
  const cashAmount = parseSignedNumber(parts.at(-1))

  return {
    kind: 'trade',
    type: tradeType,
    tradeDate: parts[0],
    settleDate: parts[1],
    reference: parts[2],
    quantity: tradeType === 'sell' ? -quantity : quantity,
    tradePrice,
    cashAmount,
    fileName,
    description: headline.trim().replace(/\s+/g, ' '),
  }
}

function findEventDateLine(lines, startIndex) {
  for (let offset = 1; offset <= 3; offset += 1) {
    const line = lines[startIndex + offset] ?? ''
    if (/^\s*\d{4}-\d{2}-\d{2}\s+\d{4}-\d{2}-\d{2}\s+\d+/.test(line)) {
      return { line, index: startIndex + offset }
    }
  }
  return null
}

function classifyCashEvent(line) {
  if (/0320000\b/.test(line) && /#TLT\b/.test(line)) return 'dividend_gross'
  if (/0320060\b/.test(line) && /#TLT\b/.test(line)) return 'withholding_tax'
  if (/0321000\b/.test(line) && /#TLT\b/.test(line)) return 'dividend_adjustment'
  if (/0321060\b/.test(line) && /#TLT\b/.test(line)) return 'tax_adjustment'
  return null
}

function extractInlineCashEvents(text, fileName) {
  const events = []
  const regex = /^\s*(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})\s+(\d+)\s+(032\d{4})\s+(.+?#TLT.*?)\s+(\(?[\d,]+\.\d+\)?)\s*$/gm

  for (const match of text.matchAll(regex)) {
    const line = match[0]
    const eventType = classifyCashEvent(line)
    if (!eventType) continue

    events.push({
      kind: 'cash_event',
      type: eventType,
      tradeDate: match[1],
      settleDate: match[2],
      reference: match[3],
      amount: parseSignedNumber(match[6]),
      fileName,
      description: line.trim().replace(/\s+/g, ' '),
    })
  }

  return events
}

function extractCashEventFromLines(lines, index, fileName) {
  const headline = lines[index]
  const eventType = classifyCashEvent(headline)
  if (!eventType) return null

  if (/^\s*\d{4}-\d{2}-\d{2}\s+\d{4}-\d{2}-\d{2}\s+\d+\s+032\d{4}\b/.test(headline)) {
    const parts = headline.trim().split(/\s+/)
    if (parts.length >= 5) {
      return {
        kind: 'cash_event',
        type: eventType,
        tradeDate: parts[0],
        settleDate: parts[1],
        reference: parts[2],
        amount: parseSignedNumber(parts.at(-1)),
        fileName,
        description: headline.trim().replace(/\s+/g, ' '),
      }
    }
  }

  const dateLineInfo = findEventDateLine(lines, index)
  if (!dateLineInfo) return null

  const parts = dateLineInfo.line.trim().split(/\s+/)
  if (parts.length < 4) return null

  const continuation = lines[dateLineInfo.index + 1] ?? ''

  return {
    kind: 'cash_event',
    type: eventType,
    tradeDate: parts[0],
    settleDate: parts[1],
    reference: parts[2],
    amount: parseSignedNumber(parts.at(-1)),
    fileName,
    description: [headline.trim(), continuation.trim()].filter(Boolean).join(' ').replace(/\s+/g, ' '),
  }
}

function extractSnapshot(lines, statementDate, fileName) {
  const snapshots = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (!/#TLT 20\+ Year Trsy Bond/i.test(line)) continue
    if (/\b(BUY|SELL)\b/i.test(line)) continue
    if (/0320\d{3}\b/.test(line)) continue

    const combined = [line, lines[index + 1] ?? '', lines[index + 2] ?? ''].join(' ')
    const match = combined.match(/(\d+(?:\.\d+)?)\s+USD\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/)
    if (!match) continue

    snapshots.push({
      statementDate,
      fileName,
      quantity: Number(match[1]),
      currentPrice: Number(match[2]),
      marketValue: Number(match[3]),
    })
  }

  return snapshots
}

function readStatement(fileName) {
  const filePath = path.join(inputDir, fileName)
  const text = execFileSync(
    'pdftotext',
    ['-upw', password, '-layout', filePath, '-'],
    { encoding: 'utf8' },
  )

  const lines = text.split(/\r?\n/)
  const statementDate = extractStatementDate(text, fileName)

  const trades = []
  const cashEvents = extractInlineCashEvents(text, fileName)

  for (let index = 0; index < lines.length; index += 1) {
    const trade = extractTradeFromLines(lines, index, fileName)
    if (trade) {
      trades.push(trade)
      continue
    }

    const cashEvent = extractCashEventFromLines(lines, index, fileName)
    if (cashEvent) {
      cashEvents.push(cashEvent)
    }
  }

  return {
    fileName,
    statementDate,
    trades,
    cashEvents,
    snapshots: extractSnapshot(lines, statementDate, fileName),
  }
}

const files = fs.readdirSync(inputDir)
  .filter((name) => name.endsWith('.pdf'))
  .sort()

if (files.length === 0) {
  throw new Error(`No PDF files found in ${inputDir}`)
}

const statements = files.map(readStatement)
const trades = statements.flatMap((statement) => statement.trades)
const cashEvents = statements.flatMap((statement) => statement.cashEvents)
const snapshots = statements.flatMap((statement) => statement.snapshots)

const uniqueTrades = Array.from(
  new Map(trades.map((trade) => [`${trade.tradeDate}|${trade.reference}|${trade.quantity}|${trade.tradePrice}|${trade.cashAmount}`, trade])).values(),
).sort((left, right) => {
  const leftKey = `${left.tradeDate}|${left.reference}`
  const rightKey = `${right.tradeDate}|${right.reference}`
  return leftKey.localeCompare(rightKey)
})

const uniqueCashEvents = Array.from(
  new Map(cashEvents.map((event) => [`${event.tradeDate}|${event.reference}|${event.type}|${event.amount}`, event])).values(),
).sort((left, right) => {
  const leftKey = `${left.tradeDate}|${left.reference}|${left.type}`
  const rightKey = `${right.tradeDate}|${right.reference}|${right.type}`
  return leftKey.localeCompare(rightKey)
})

const uniqueSnapshots = Array.from(
  new Map(snapshots.map((snapshot) => [`${snapshot.statementDate}|${snapshot.quantity}|${snapshot.currentPrice}|${snapshot.marketValue}`, snapshot])).values(),
).sort((left, right) => left.statementDate.localeCompare(right.statementDate))

const latestSnapshot = uniqueSnapshots.at(-1) ?? {
  statementDate: '',
  quantity: 0,
  currentPrice: 0,
  marketValue: 0,
}

const buyTrades = uniqueTrades.filter((trade) => trade.type === 'buy')
const sellTrades = uniqueTrades.filter((trade) => trade.type === 'sell')

const totalBoughtQuantity = buyTrades.reduce((sum, trade) => sum + trade.quantity, 0)
const totalSoldQuantity = sellTrades.reduce((sum, trade) => sum + Math.abs(trade.quantity), 0)
const currentQuantity = totalBoughtQuantity - totalSoldQuantity
const totalTradeNotional = buyTrades.reduce((sum, trade) => sum + Math.abs(trade.quantity) * trade.tradePrice, 0)
const totalCostCashOutflow = buyTrades.reduce((sum, trade) => sum + Math.abs(trade.cashAmount), 0)
const totalSellCashInflow = sellTrades.reduce((sum, trade) => sum + trade.cashAmount, 0)
const totalFees = totalCostCashOutflow - totalTradeNotional

const grossDividends = uniqueCashEvents
  .filter((event) => event.type === 'dividend_gross')
  .reduce((sum, event) => sum + event.amount, 0)

const withholdingTax = uniqueCashEvents
  .filter((event) => event.type === 'withholding_tax')
  .reduce((sum, event) => sum + event.amount, 0)

const dividendAdjustments = uniqueCashEvents
  .filter((event) => event.type === 'dividend_adjustment')
  .reduce((sum, event) => sum + event.amount, 0)

const taxAdjustments = uniqueCashEvents
  .filter((event) => event.type === 'tax_adjustment')
  .reduce((sum, event) => sum + event.amount, 0)

const netDividendCash = uniqueCashEvents.reduce((sum, event) => sum + event.amount, 0)
const currentMarketValue = latestSnapshot.marketValue
const averageCashCost = currentQuantity === 0 ? 0 : totalCostCashOutflow / currentQuantity
const averageTradePrice = totalBoughtQuantity === 0 ? 0 : totalTradeNotional / totalBoughtQuantity
const unrealizedPnL = currentMarketValue - totalCostCashOutflow
const totalPnLWithDividends = currentMarketValue + netDividendCash + totalSellCashInflow - totalCostCashOutflow
const totalReturnRate = totalCostCashOutflow === 0 ? 0 : totalPnLWithDividends / totalCostCashOutflow
const breakEvenPriceAfterDividends = currentQuantity === 0 ? 0 : (totalCostCashOutflow - netDividendCash) / currentQuantity

const cashEventsByYear = uniqueCashEvents.reduce((acc, event) => {
  const year = event.tradeDate.slice(0, 4) || 'unknown'
  acc[year] = (acc[year] ?? 0) + event.amount
  return acc
}, {})

const reportLines = [
  '# VBrokers TLT 数据整理报表',
  '',
  '## 说明',
  '',
  '- 数据来源：`deploy/hk/vbrokers/*.pdf` 月结单。',
  '- 提取口径：只统计 `TLT` 相关买入、卖出、股息、预扣税和股息调整现金流。',
  `- 最新价格来自最后一份可用结单，结单日期：${latestSnapshot.statementDate || '未知'}。`,
  '',
  '## 汇总',
  '',
  '| 指标 | 数值 |',
  '| --- | --- |',
  `| 月结单文件数 | ${files.length} |`,
  `| TLT 买入记录数 | ${buyTrades.length} |`,
  `| TLT 卖出记录数 | ${sellTrades.length} |`,
  `| TLT 股息相关现金流条数 | ${uniqueCashEvents.length} |`,
  `| 当前持仓数量 | ${formatQty(currentQuantity)} |`,
  `| 累计成交金额 | ${formatMoney(totalTradeNotional)} USD |`,
  `| 累计买入现金流出 | ${formatMoney(totalCostCashOutflow)} USD |`,
  `| 累计交易费用 | ${formatMoney(totalFees)} USD |`,
  `| 平均成交价 | ${formatMoney(averageTradePrice)} USD |`,
  `| 含费用平均成本 | ${formatMoney(averageCashCost)} USD |`,
  `| 最新结单价格 | ${formatMoney(latestSnapshot.currentPrice)} USD |`,
  `| 最新结单市值 | ${formatMoney(currentMarketValue)} USD |`,
  `| 股息毛额合计 | ${formatMoney(grossDividends)} USD |`,
  `| 预扣税合计 | ${formatMoney(withholdingTax)} USD |`,
  `| 股息调整合计 | ${formatMoney(dividendAdjustments)} USD |`,
  `| 税务调整合计 | ${formatMoney(taxAdjustments)} USD |`,
  `| 股息净入账合计 | ${formatMoney(netDividendCash)} USD |`,
  `| 未计股息浮盈亏 | ${formatMoney(unrealizedPnL)} USD |`,
  `| 计入股息后总盈亏 | ${formatMoney(totalPnLWithDividends)} USD |`,
  `| 计入股息后收益率 | ${formatPct(totalReturnRate)} |`,
  `| 股息后回本价 | ${formatMoney(breakEvenPriceAfterDividends)} USD |`,
  '',
  '## 买入明细',
  '',
  '| 交易日期 | 结算日期 | 数量 | 成交价 | 现金流出 | 来源文件 |',
  '| --- | --- | --- | --- | --- | --- |',
  ...buyTrades.map((trade) => `| ${trade.tradeDate} | ${trade.settleDate} | ${formatQty(Math.abs(trade.quantity))} | ${formatMoney(trade.tradePrice)} | ${formatMoney(Math.abs(trade.cashAmount))} | ${trade.fileName} |`),
  '',
  '## 股息现金流按年汇总',
  '',
  '| 年份 | 净现金流 |',
  '| --- | --- |',
  ...Object.entries(cashEventsByYear)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([year, amount]) => `| ${year} | ${formatMoney(amount)} USD |`),
  '',
  '## 股息现金流明细',
  '',
  '| 交易日期 | 类型 | 金额 | 参考编号 | 来源文件 |',
  '| --- | --- | --- | --- | --- |',
  ...uniqueCashEvents.map((event) => `| ${event.tradeDate} | ${event.type} | ${formatMoney(event.amount)} USD | ${event.reference} | ${event.fileName} |`),
  '',
  '## 结论',
  '',
  `- 从 ${files[0]} 到 ${files.at(-1)} 的结单里，TLT 共买入 ${formatQty(totalBoughtQuantity)} 份，当前仍持有 ${formatQty(currentQuantity)} 份。`,
  `- 最新可用价格是 ${latestSnapshot.statementDate} 结单里的 ${formatMoney(latestSnapshot.currentPrice)} USD，对应市值 ${formatMoney(currentMarketValue)} USD。`,
  `- 累计股息净入账 ${formatMoney(netDividendCash)} USD，计入股息后总盈亏 ${formatMoney(totalPnLWithDividends)} USD。`,
  '',
]

const csvLines = [
  'date,settle_date,kind,type,amount,quantity,trade_price,reference,file_name,description',
  ...buyTrades.map((trade) => [
    trade.tradeDate,
    trade.settleDate,
    trade.kind,
    trade.type,
    trade.cashAmount,
    trade.quantity,
    trade.tradePrice,
    trade.reference,
    trade.fileName,
    `"${trade.description.replaceAll('"', '""')}"`,
  ].join(',')),
  ...sellTrades.map((trade) => [
    trade.tradeDate,
    trade.settleDate,
    trade.kind,
    trade.type,
    trade.cashAmount,
    trade.quantity,
    trade.tradePrice,
    trade.reference,
    trade.fileName,
    `"${trade.description.replaceAll('"', '""')}"`,
  ].join(',')),
  ...uniqueCashEvents.map((event) => [
    event.tradeDate,
    event.settleDate,
    event.kind,
    event.type,
    event.amount,
    '',
    '',
    event.reference,
    event.fileName,
    `"${event.description.replaceAll('"', '""')}"`,
  ].join(',')),
]

const parsed = {
  sourceDir: path.relative(rootDir, inputDir),
  fileCount: files.length,
  latestSnapshot,
  summary: {
    buyTradeCount: buyTrades.length,
    sellTradeCount: sellTrades.length,
    cashEventCount: uniqueCashEvents.length,
    totalBoughtQuantity,
    totalSoldQuantity,
    currentQuantity,
    totalTradeNotional,
    totalCostCashOutflow,
    totalSellCashInflow,
    totalFees,
    averageTradePrice,
    averageCashCost,
    currentMarketValue,
    grossDividends,
    withholdingTax,
    dividendAdjustments,
    taxAdjustments,
    netDividendCash,
    unrealizedPnL,
    totalPnLWithDividends,
    totalReturnRate,
    breakEvenPriceAfterDividends,
  },
  trades: uniqueTrades,
  cashEvents: uniqueCashEvents,
  snapshots: uniqueSnapshots,
}

fs.writeFileSync(reportPath, `${reportLines.join('\n')}\n`)
fs.writeFileSync(csvPath, `${csvLines.join('\n')}\n`)
fs.writeFileSync(jsonPath, `${JSON.stringify(parsed, null, 2)}\n`)

console.log(`Generated ${path.relative(rootDir, reportPath)}, ${path.relative(rootDir, csvPath)}, and ${path.relative(rootDir, jsonPath)}`)
