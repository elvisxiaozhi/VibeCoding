/** 货币符号映射 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: '¥',
  USD: '$',
  HKD: 'HK$',
  BTC: '₿',
  USDC: '$',
  USDT: '$',
}

/** 获取货币符号 */
export function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? currency
}

/** 格式化金额（使用对应货币符号） */
export function formatMoney(amount: number, currency: string): string {
  const sym = currencySymbol(currency)
  const formatted = Math.abs(amount).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return amount < 0 ? `-${sym}${formatted}` : `${sym}${formatted}`
}

/** 格式化带正号的金额 */
export function formatMoneyWithSign(amount: number, currency: string): string {
  if (amount >= 0) return `+${formatMoney(amount, currency)}`
  return formatMoney(amount, currency)
}

/** 汇率表类型：以 USD 为基准的汇率 */
export type ExchangeRates = Record<string, number>

/** 将任意货币金额转换为 CNY */
export function toCNY(amount: number, currency: string, rates: ExchangeRates): number {
  if (currency === 'CNY') return amount
  const cnyRate = rates['CNY'] ?? 1
  const fromRate = rates[currency] ?? 1
  // rates 以 USD 为基准：1 USD = rates[X]
  // amount 单位 currency → USD = amount / fromRate → CNY = (amount / fromRate) * cnyRate
  return (amount / fromRate) * cnyRate
}
