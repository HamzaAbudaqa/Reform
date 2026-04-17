'use client'

import type { HeatmapBucket } from '@/types/heatmap'
import { HEATMAP_GRID } from '@/types/heatmap'

interface Props {
  /** Scroll-layer buckets (bucket_x is always 0, bucket_y is 0..49). */
  buckets: HeatmapBucket[]
}

/**
 * Vertical retention curve shown to the right of the heatmap canvas.
 * Derives a cumulative "fraction of sessions that scrolled past row N"
 * curve from the 1D scroll layer, with 25/50/75/100% fold markers.
 */
export default function ScrollDepthRail({ buckets }: Props) {
  const rows = new Array<number>(HEATMAP_GRID).fill(0)
  for (const b of buckets) {
    if (b.y >= 0 && b.y < HEATMAP_GRID) rows[b.y] += b.count
  }
  const total = rows.reduce((s, v) => s + v, 0)
  // retention[y] = fraction of sessions that scrolled at least as far as y.
  const retention = new Array<number>(HEATMAP_GRID).fill(0)
  if (total > 0) {
    let cumulativeAbove = total
    for (let y = 0; y < HEATMAP_GRID; y++) {
      retention[y] = cumulativeAbove / total
      cumulativeAbove -= rows[y]
    }
  }

  return (
    <div
      className="relative h-full flex flex-col"
      style={{ width: 56 }}
    >
      <div className="text-[10px] font-medium mb-2 text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
        Scroll
      </div>
      <div
        className="relative flex-1 rounded-xl overflow-hidden"
        style={{
          background: 'rgba(8,10,18,0.6)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {retention.map((r, y) => (
          <div
            key={y}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: `${(y / HEATMAP_GRID) * 100}%`,
              height: `${100 / HEATMAP_GRID}%`,
              background: gradient(r),
            }}
          />
        ))}
        {[0.25, 0.5, 0.75].map(frac => (
          <div
            key={frac}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: `${frac * 100}%`,
              height: 1,
              background: 'rgba(255,255,255,0.14)',
            }}
          />
        ))}
      </div>
      {total === 0 && (
        <div className="mt-2 text-[10px] text-center" style={{ color: 'rgba(255,255,255,0.28)' }}>
          No data
        </div>
      )}
    </div>
  )
}

function gradient(retention: number): string {
  // Retention 1.0 → saturated purple; 0.0 → near-black.
  const r = Math.round(40 + retention * 100)
  const g = Math.round(50 + retention * 60)
  const b = Math.round(90 + retention * 160)
  const a = 0.25 + retention * 0.55
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`
}
