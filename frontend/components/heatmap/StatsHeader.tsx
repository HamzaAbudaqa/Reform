'use client'

interface Props {
  sessions: number
  events: number
  avgScrollDepthPct: number
  rageClickRate: number
}

export default function StatsHeader({ sessions, events, avgScrollDepthPct, rageClickRate }: Props) {
  const stats = [
    { label: 'Sessions', value: formatInteger(sessions), color: '#0a0a0a' },
    { label: 'Events', value: formatInteger(events), color: '#262626' },
    { label: 'Avg scroll', value: `${avgScrollDepthPct.toFixed(0)}%`, color: '#0a0a0a' },
    { label: 'Rage rate', value: `${(rageClickRate * 100).toFixed(1)}%`, color: rageClickRate > 0.05 ? '#dc2626' : '#16a34a' },
  ]
  return (
    <div className="flex flex-wrap gap-3">
      {stats.map(s => (
        <div
          key={s.label}
          className="flex items-baseline gap-2 rounded-[14px] border border-black/[0.07] bg-white px-3 py-2"
        >
          <div className="text-[18px] font-semibold tabular-nums" style={{ color: s.color }}>
            {s.value}
          </div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-neutral-400">
            {s.label}
          </div>
        </div>
      ))}
    </div>
  )
}

function formatInteger(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}
