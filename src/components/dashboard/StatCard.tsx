import { Card, CardContent } from '@/components/ui/card'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string
  subtitle?: string
  icon: LucideIcon
  variant?: 'default' | 'profit' | 'loss'
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
}: StatCardProps) {
  const valueColor =
    variant === 'profit'
      ? 'text-[#ef4444]'
      : variant === 'loss'
        ? 'text-[#22c55e]'
        : 'text-white'

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{title}</p>
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className={`mt-3 font-mono text-2xl font-bold ${valueColor}`}>
          {value}
        </p>
        {subtitle ? (
          <p
            className={`mt-1 font-mono text-sm ${variant === 'default' ? 'text-muted-foreground' : valueColor}`}
          >
            {subtitle}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
