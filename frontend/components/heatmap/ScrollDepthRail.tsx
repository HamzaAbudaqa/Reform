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
      <div className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
        Scroll
      </div>
      <div className="relative flex-1 overflow-hidden rounded-[14px] border border-black/[0.07] bg-white">
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
              background: 'rgba(0,0,0,0.08)',
            }}
          />
        ))}
      </div>
      {total === 0 && (
        <div className="mt-2 text-center text-[10px] text-neutral-400">
          No data
        </div>
      )}
    </div>
  )
}

function gradient(retention: number): string {
  // Retention 1.0 → saturated ink; 0.0 → near-white. On a light background we
  // want higher retention to read as darker, so opacity rises with retention
  // and the hue shifts slightly toward neutral ink.
  const r = Math.round(10 + (1 - retention) * 140)
  const g = Math.round(10 + (1 - retention) * 140)
  const b = Math.round(20 + (1 - retention) * 130)
  const a = 0.08 + retention * 0.62
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`
}
