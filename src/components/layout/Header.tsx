import { CalendarDays } from 'lucide-react'

interface HeaderProps {
  title: string
}

function formatToday(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function Header({ title }: HeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border/50 bg-[#0a0a0a] px-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-white">
          {title}
        </h1>
        <p className="text-xs text-muted-foreground">个人资产汇总看板</p>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-white/5 px-3 py-1.5 text-xs text-muted-foreground font-mono">
        <CalendarDays className="h-3.5 w-3.5" />
        <span>{formatToday()}</span>
      </div>
    </header>
  )
}
