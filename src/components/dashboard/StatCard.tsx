import { Card, CardContent } from '@/components/ui/card'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string
  /** hover 时显示完整原始数值（用于缩写后保留精确值） */
  valueTitle?: string
  subtitle?: string
  subtitleVariant?: 'default' | 'profit' | 'loss'
  icon: LucideIcon
  variant?: 'default' | 'profit' | 'loss'
}

export function StatCard({
  title,
  value,
  valueTitle,
  subtitle,
  subtitleVariant,
  icon: Icon,
  variant = 'default',
}: StatCardProps) {
  const valueColor =
    variant === 'profit'
      ? 'text-[#ef4444]'
      : variant === 'loss'
        ? 'text-[#22c55e]'
        : 'text-foreground'

  const subtitleColor =
    subtitleVariant === 'profit'
      ? 'text-[#ef4444]'
      : subtitleVariant === 'loss'
        ? 'text-[#22c55e]'
        : variant === 'default'
          ? 'text-muted-foreground'
          : valueColor

  return (
    <Card className="bg-card/60">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{title}</p>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <p title={valueTitle} className={`mt-2 break-words font-mono text-lg font-semibold sm:text-xl ${valueColor}`}>
          {value}
        </p>
        {subtitle ? (
          <p className={`mt-1 font-mono text-sm ${subtitleColor}`}>
            {subtitle}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
