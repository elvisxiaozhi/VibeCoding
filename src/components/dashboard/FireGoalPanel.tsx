import { useState } from 'react'
import { Pencil, Target, X } from 'lucide-react'
import { yearsToGoal } from '@/lib/calc'

const LS_TARGET = 'fire_goal_target'
const LS_MONTHLY = 'fire_goal_monthly'
const LS_RATE = 'fire_goal_rate'
const DEFAULT_TARGET = 6_000_000

function readLS(key: string, fallback: string): string {
  try { return localStorage.getItem(key) ?? fallback } catch { return fallback }
}
function writeLS(key: string, value: string): void {
  try { localStorage.setItem(key, value) } catch {}
}

function formatYears(years: number): string {
  const totalMonths = Math.round(years * 12)
  const y = Math.floor(totalMonths / 12)
  const m = totalMonths % 12
  if (y === 0) return `${m} 个月`
  if (m === 0) return `${y} 年`
  return `${y} 年 ${m} 个月`
}

function goalDate(years: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + Math.round(years * 12))
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`
}

interface FireGoalPanelProps {
  netWorthCNY: number
  annReturn: number | null
}

export function FireGoalPanel({ netWorthCNY, annReturn }: FireGoalPanelProps) {
  const [target, setTarget] = useState(() => {
    const v = parseFloat(readLS(LS_TARGET, String(DEFAULT_TARGET)))
    return isNaN(v) || v <= 0 ? DEFAULT_TARGET : v
  })
  const [monthly, setMonthly] = useState(() => {
    const v = parseFloat(readLS(LS_MONTHLY, '0'))
    return isNaN(v) || v < 0 ? 0 : v
  })
  const [rateStr, setRateStr] = useState(() => readLS(LS_RATE, ''))

  const [editingTarget, setEditingTarget] = useState(false)
  const [targetInput, setTargetInput] = useState('')

  const rateOverride = rateStr.trim() === '' ? null : parseFloat(rateStr) / 100
  const effectiveRate = rateOverride !== null && !isNaN(rateOverride) ? rateOverride : annReturn
  const hasScenario = monthly > 0 || (rateStr.trim() !== '' && rateOverride !== null && !isNaN(rateOverride))

  const safeCurrent = Math.max(netWorthCNY, 0)
  const progress = Math.min(safeCurrent / target, 1)
  const baseYears = annReturn !== null ? yearsToGoal(netWorthCNY, target, annReturn, 0) : null
  const scenarioYears = hasScenario && effectiveRate !== null
    ? yearsToGoal(netWorthCNY, target, effectiveRate, monthly)
    : null
  const savedYears = baseYears !== null && scenarioYears !== null && baseYears > scenarioYears
    ? baseYears - scenarioYears
    : null

  function handleMonthlyChange(val: string) {
    const n = parseFloat(val)
    const v = isNaN(n) || n < 0 ? 0 : n
    setMonthly(v)
    writeLS(LS_MONTHLY, String(v))
  }

  function handleRateChange(val: string) {
    setRateStr(val)
    writeLS(LS_RATE, val)
  }

  function openTargetEdit() {
    setTargetInput(String(target / 10000))
    setEditingTarget(true)
  }

  function applyTargetEdit() {
    const wan = parseFloat(targetInput)
    if (!isNaN(wan) && wan > 0) {
      const v = wan * 10000
      setTarget(v)
      writeLS(LS_TARGET, String(v))
    }
    setEditingTarget(false)
  }

  const formatWan = (n: number) => `${(n / 10000).toFixed(0)} 万`

  return (
    <div className="rounded-xl border border-border/50 bg-card px-4 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-orange-400" />
          <h3 className="text-sm font-medium text-white">净资产目标</h3>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>目标</span>
          {editingTarget ? (
            <span className="flex items-center gap-1">
              <input
                autoFocus
                type="number"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                onBlur={applyTargetEdit}
                onKeyDown={(e) => { if (e.key === 'Enter') applyTargetEdit() }}
                className="w-20 rounded border border-orange-500/50 bg-background px-1.5 py-0.5 font-mono text-white focus:outline-none"
                placeholder="600"
              />
              <span>万</span>
            </span>
          ) : (
            <span className="font-mono text-white">¥{formatWan(target)}</span>
          )}
          <button
            onClick={editingTarget ? applyTargetEdit : openTargetEdit}
            className="rounded p-0.5 hover:text-white transition-colors"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
          <span>当前 <span className="font-mono text-white">¥{formatWan(safeCurrent)}</span></span>
          <span className="font-mono text-white">{(progress * 100).toFixed(1)}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-background/60 overflow-hidden">
          <div
            className="h-full rounded-full bg-orange-500 transition-all duration-500"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      {/* Base calculation */}
      <div className="mt-3 rounded-lg border border-border/40 bg-background/40 px-3 py-2.5">
        <div className="text-xs text-muted-foreground">
          按持仓年化 {annReturn !== null ? `${(annReturn * 100).toFixed(1)}%` : '—'}，不计月投入
        </div>
        <div className="mt-1 text-sm text-white">
          {baseYears === null ? (
            <span className="text-muted-foreground">— （年化数据不足）</span>
          ) : baseYears === 0 ? (
            <span className="text-orange-400">已达成目标</span>
          ) : (
            <>
              还需 <span className="font-mono font-medium">{formatYears(baseYears)}</span>
              <span className="ml-1.5 text-xs text-muted-foreground">（{goalDate(baseYears)}）</span>
            </>
          )}
        </div>
      </div>

      {/* Scenario simulation */}
      <div className="mt-2.5 rounded-lg border border-border/40 bg-background/40 px-3 py-2.5">
        <div className="mb-2 text-xs text-muted-foreground">情景模拟</div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">月投入</span>
            <span className="text-xs text-muted-foreground">¥</span>
            <input
              type="number"
              value={monthly === 0 ? '' : monthly}
              onChange={(e) => handleMonthlyChange(e.target.value)}
              className="w-24 rounded border border-border/50 bg-background px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-orange-500/50"
              placeholder="0"
              min="0"
            />
            <span className="text-xs text-muted-foreground">元</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">年化</span>
            <input
              type="number"
              value={rateStr}
              onChange={(e) => handleRateChange(e.target.value)}
              className="w-16 rounded border border-border/50 bg-background px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-orange-500/50"
              placeholder={annReturn !== null ? `${(annReturn * 100).toFixed(1)}` : '如 8.0'}
            />
            <span className="text-xs text-muted-foreground">%</span>
            {rateStr.trim() !== '' && (
              <button
                onClick={() => handleRateChange('')}
                className="rounded p-0.5 text-muted-foreground hover:text-white transition-colors"
                title="清除自定义年化"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
        <div className="mt-1.5 text-sm text-white">
          {!hasScenario ? (
            <span className="text-xs text-muted-foreground">输入月投入或自定义年化后查看推演结果</span>
          ) : scenarioYears === null ? (
            <span className="text-xs text-muted-foreground">— （300 年内无法达成，请调整参数）</span>
          ) : scenarioYears === 0 ? (
            <span className="text-orange-400">已达成目标</span>
          ) : (
            <>
              → 还需 <span className="font-mono font-medium">{formatYears(scenarioYears)}</span>
              <span className="ml-1.5 text-xs text-muted-foreground">
                （{goalDate(scenarioYears)}，年化 {effectiveRate !== null ? `${(effectiveRate * 100).toFixed(1)}%` : '—'}）
              </span>
              {savedYears !== null && savedYears > 0.08 && (
                <span className="ml-2 text-xs text-orange-400">↑ 节省 {formatYears(savedYears)}</span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
