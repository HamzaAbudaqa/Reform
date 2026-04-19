'use client'

import { useEffect, useState } from 'react'
import { apiUrl } from '@/lib/api'
import { humanizeResponse } from '@/lib/humanizeError'
import type { VersionComparison as VC, VersionInfo } from '@/types/heatmap'
import { mapVersionComparison } from '@/types/heatmap'

interface Props {
  siteId: string
  githubUserId: string
  /** Bumping this triggers a refetch — used by the parent when the
   *  selected site changes or after a fresh transform run. */
  refreshKey?: number
}

/**
 * Side-by-side comparison of the most recently accepted UI version
 * (Current design) and the one just before it (Before this change).
 *
 * Rendered below the heatmap canvas. When the current version doesn't
 * yet have meaningful traffic, surfaces a calm "still collecting data"
 * notice that nudges the user to use the previous version as a baseline.
 */
export default function VersionComparison({ siteId, githubUserId, refreshKey }: Props) {
  const [data, setData] = useState<VC | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const res = await fetch(apiUrl(
          `/api/heatmap/sites/${siteId}/version-comparison`
          + `?github_user_id=${encodeURIComponent(githubUserId)}`
        ))
        if (!res.ok) throw new Error(await humanizeResponse(res, "We couldn't load version comparison."))
        if (cancelled) return
        setData(mapVersionComparison(await res.json()))
      } catch {
        if (!cancelled) setData(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [siteId, githubUserId, refreshKey])

  // Don't render anything until we have at least one version to show.
  // Showing a skeleton would just add clutter for users who haven't run
  // a transform yet — the heatmap above is still the primary content.
  if (loading && !data) return null
  if (!data || !data.hasVersions || !data.current) return null

  return (
    <section className="mt-10 rounded-[22px] border border-black/[0.07] bg-white p-6">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
            Version comparison
          </p>
          <h2 className="mt-1 text-[16px] font-semibold text-neutral-950">
            Current design vs. before this change
          </h2>
        </div>
        {!data.previous && (
          <span className="text-[11px] text-neutral-400">
            No earlier version yet
          </span>
        )}
      </header>

      {data.lowData && (
        <div className="mb-4 rounded-xl border border-amber-200/60 bg-amber-50/70 px-4 py-3">
          <p className="text-[12.5px] font-semibold text-amber-900">
            This version is still collecting visitor data.
          </p>
          <p className="mt-0.5 text-[11.5px] text-amber-800">
            {data.previous
              ? "Compare it with the previous version below while traffic comes in."
              : "Heatmaps will get sharper as more visitors arrive on your site."}
            {' '}
            <span className="text-amber-700">
              ({data.currentSessionCount} of {data.lowDataThreshold} sessions so far)
            </span>
          </p>
        </div>
      )}

      <div className={`grid gap-4 ${data.previous ? 'sm:grid-cols-2' : 'sm:grid-cols-1'}`}>
        <VersionCard
          version={data.current}
          accent="current"
          sessionCount={data.currentSessionCount}
          lowData={data.lowData}
        />
        {data.previous && (
          <VersionCard
            version={data.previous}
            accent="previous"
          />
        )}
      </div>
    </section>
  )
}

// ── Sub-components ────────────────────────────────────────────────────

function VersionCard({
  version,
  accent,
  sessionCount,
  lowData,
}: {
  version: VersionInfo
  accent: 'current' | 'previous'
  sessionCount?: number
  lowData?: boolean
}) {
  const isCurrent = accent === 'current'
  return (
    <article
      className="flex flex-col overflow-hidden rounded-2xl border bg-neutral-50"
      style={{ borderColor: isCurrent ? 'rgba(34,197,94,0.3)' : 'rgba(0,0,0,0.07)' }}
    >
      <div
        className="flex items-center justify-between gap-2 px-4 py-2.5"
        style={{
          background: isCurrent ? 'rgba(34,197,94,0.06)' : 'rgba(0,0,0,0.025)',
          borderBottom: '1px solid rgba(0,0,0,0.05)',
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className={`flex h-1.5 w-1.5 rounded-full ${isCurrent ? 'bg-emerald-500' : 'bg-neutral-400'}`}
          />
          <span className="text-[11.5px] font-semibold text-neutral-950">{version.label}</span>
        </div>
        {isCurrent && lowData && (
          <span className="text-[10px] font-medium uppercase tracking-wider text-amber-700">
            Still collecting
          </span>
        )}
        {isCurrent && !lowData && typeof sessionCount === 'number' && (
          <span className="text-[10px] font-medium text-emerald-700">
            {sessionCount} {sessionCount === 1 ? 'session' : 'sessions'}
          </span>
        )}
      </div>

      <div className="relative bg-white">
        {version.screenshotUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={version.screenshotUrl}
            alt={`${version.label} preview`}
            className="block w-full h-auto max-h-[280px] object-cover object-top"
          />
        ) : (
          <div
            className="flex aspect-[16/10] items-center justify-center text-[11.5px] text-neutral-400"
          >
            No preview captured
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 px-4 py-2.5 text-[11px] text-neutral-500">
        <span className="truncate">
          {version.pagePath || '/'}
        </span>
        <span className="flex-shrink-0 text-neutral-400">
          {version.deployedAt ? formatRelative(version.deployedAt) : ''}
        </span>
      </div>
    </article>
  )
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms) || ms < 0) return ''
  const m = Math.floor(ms / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  // Older than a week — show date instead of "12d ago" etc.
  return new Date(iso).toLocaleDateString()
}
