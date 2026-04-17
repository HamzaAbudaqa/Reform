'use client'

interface Props {
  sessions: number
  events: number
  avgScrollDepthPct: number
  rageClickRate: number
}

export default function StatsHeader({ sessions, events, avgScrollDepthPct, rageClickRate }: Props) {
  const stats = [
    { label: 'Sessions', value: formatInteger(sessions), color: '#ffffff' },
    { label: 'Events', value: formatInteger(events), color: 'rgba(255,255,255,0.85)' },
    { label: 'Avg scroll', value: `${avgScrollDepthPct.toFixed(0)}%`, color: '#7c8cff' },
    { label: 'Rage rate', value: `${(rageClickRate * 100).toFixed(1)}%`, color: rageClickRate > 0.05 ? '#ef4444' : '#22c55e' },
  ]
  return (
    <div className="flex flex-wrap gap-3">
      {stats.map(s => (
        <div
          key={s.label}
          className="flex items-baseline gap-2 px-3 py-2 rounded-xl"
          style={{
            background: 'rgba(8,10,18,0.6)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="text-[18px] font-semibold tabular-nums" style={{ color: s.color }}>
            {s.value}
          </div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
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
