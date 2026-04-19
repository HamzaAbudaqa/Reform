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
        className="rounded-[22px] border border-black/[0.07] bg-white p-4 text-[11px] text-neutral-500"
      >
        Waiting for the first pageview — the tab flips automatically once data arrives.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-[22px] border border-black/[0.07] bg-white">
      <div className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        Tracked pages
      </div>
      <ul>
        {pages.map(page => {
          const active = page.id === selectedId
          return (
            <li key={page.id}>
              <button
                onClick={() => onSelect(page.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-neutral-50"
                style={{
                  background: active ? '#fafafa' : 'transparent',
                  borderBottom: '1px solid rgba(0,0,0,0.04)',
                  borderLeft: active ? '2px solid #0a0a0a' : '2px solid transparent',
                }}
              >
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-medium" style={{ color: active ? '#0a0a0a' : '#262626' }}>
                    {page.path || '/'}
                  </div>
                  <div className="mt-0.5 text-[10px] text-neutral-400">
                    {page.viewportClass} · {formatRelativeTime(page.lastSeenAt)}
                  </div>
                </div>
                <div className="rounded-full border border-black/[0.06] bg-neutral-50 px-2 py-0.5 font-mono text-[10px] text-neutral-500">
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
