import { AlertTriangle } from 'lucide-react'

import { topSeverity, type AlertSeverity, type DashboardAlert } from '@/lib/alerts'

interface DashboardAlertBarProps {
  alerts: DashboardAlert[]
}

const SEVERITY_CLASS: Record<AlertSeverity, string> = {
  danger: 'border-red-500/40 bg-red-500/10 text-red-400',
  warning: 'border-orange-500/40 bg-orange-500/10 text-orange-400',
  info: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400',
}

const MAX_SEGMENTS = 4

export function DashboardAlertBar({ alerts }: DashboardAlertBarProps) {
  const severity = topSeverity(alerts)
  if (severity === null) return null

  const shown = alerts.slice(0, MAX_SEGMENTS)
  const hidden = alerts.length - shown.length

  return (
    <div className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm ${SEVERITY_CLASS[severity]}`}>
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {shown.map((alert, i) => (
          <span key={alert.id} className="whitespace-nowrap">
            {i > 0 && <span className="mr-1.5 opacity-50">·</span>}
            {alert.message}
          </span>
        ))}
        {hidden > 0 && <span className="whitespace-nowrap opacity-70">· +{hidden} 项</span>}
      </div>
    </div>
  )
}
