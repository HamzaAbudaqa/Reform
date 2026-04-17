'use client'

import type { HeatmapPage } from '@/types/heatmap'

interface Props {
  pages: HeatmapPage[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export default function PageList({ pages, selectedId, onSelect }: Props) {
  if (pages.length === 0) {
    return (
      <div
        className="rounded-2xl p-4 text-[11px]"
        style={{
          background: 'rgba(8,10,18,0.6)',
          border: '1px solid rgba(255,255,255,0.06)',
          color: 'rgba(255,255,255,0.4)',
        }}
      >
        Waiting for the first pageview — the tab flips automatically once data arrives.
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(8,10,18,0.6)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        Tracked pages
      </div>
      <ul>
        {pages.map(page => {
          const active = page.id === selectedId
          return (
            <li key={page.id}>
              <button
                onClick={() => onSelect(page.id)}
                className="w-full text-left px-4 py-2.5 transition-colors flex items-center justify-between gap-3"
                style={{
                  background: active ? 'rgba(124,140,255,0.12)' : 'transparent',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <div className="min-w-0">
                  <div className="text-[12px] font-medium truncate" style={{ color: active ? '#ffffff' : 'rgba(255,255,255,0.85)' }}>
                    {page.path || '/'}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {page.viewportClass} · {formatRelativeTime(page.lastSeenAt)}
                  </div>
                </div>
                <div className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)' }}>
                  {page.sessionCount} {page.sessionCount === 1 ? 'sess' : 'sess'}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function formatRelativeTime(iso: string): string {
  if (!iso) return ''
  const ts = new Date(iso).getTime()
  if (Number.isNaN(ts)) return ''
  const diff = Date.now() - ts
  const secs = Math.round(diff / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return `${days}d ago`
}
