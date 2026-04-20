'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import AIRecommendations from '@/components/heatmap/AIRecommendations'
import HeatmapCanvas from '@/components/heatmap/HeatmapCanvas'
import HeatmapControls from '@/components/heatmap/HeatmapControls'
import HeatmapSetup from '@/components/heatmap/HeatmapSetup'
import PageList from '@/components/heatmap/PageList'
import StatsHeader from '@/components/heatmap/StatsHeader'
import { apiUrl } from '@/lib/api'
import { getSelectedRepo } from '@/lib/selectedRepo'
import type { HeatmapData, HeatmapDevice, HeatmapLayer, HeatmapPage, HeatmapSite, Suggestion } from '@/types/heatmap'
import { mapHeatmapData, mapPage, mapSite } from '@/types/heatmap'

const POLL_INTERVAL_MS = 10_000
const STORAGE_SITE_ID = 'refineui_heatmap_site_id'

// Matches backend/app/services/heatmap_insights.py:MIN_SESSIONS_FOR_INSIGHTS.
// Below this we hide the heatmap panel and show a friendly collecting state
// rather than rendering a stale pre-merge screenshot with a half-empty
// overlay — the map isn't meaningful yet and the screenshot is probably
// from before the user's most recent deploy.
const MIN_SESSIONS_FOR_HEATMAP = 10

export default function HeatmapRoute() {
  return (
    <Suspense fallback={<LoadingShell />}>
      <HeatmapPageInner />
    </Suspense>
  )
}

function HeatmapPageInner() {
  const router = useRouter()
  const { data: session, status: authStatus } = useSession()
  const [projectId, setProjectId] = useState<string | null>(null)
  const [projectError, setProjectError] = useState<string | null>(null)
  const [site, setSite] = useState<HeatmapSite | null>(null)
  const [pages, setPages] = useState<HeatmapPage[]>([])
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null)
  const [layer, setLayer] = useState<HeatmapLayer>('click')
  const [device, setDevice] = useState<HeatmapDevice>('all')
  const [days, setDays] = useState<number>(7)
  const [loadingHeatmap, setLoadingHeatmap] = useState(false)
  const [hoveredSuggestion, setHoveredSuggestion] = useState<Suggestion | null>(null)

  const githubUserId = session?.githubId ?? ''
  const githubUsername = session?.githubUsername ?? ''

  // Resolve the currently-selected repo → project.
  useEffect(() => {
    if (authStatus !== 'authenticated' || !githubUserId) return
    const repo = getSelectedRepo()
    if (!repo?.url) {
      setProjectError('Pick a repository in Project Discovery to start.')
      return
    }
    const repoName = parseRepoName(repo.url)
    if (!repoName) {
      setProjectError('Could not parse repo URL.')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(apiUrl('/projects'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            github_user_id: githubUserId,
            github_username: githubUsername || 'unknown',
            repo_name: repoName,
            repo_url: repo.url,
            branch: repo.branch,
          }),
        })
        if (!res.ok) throw new Error(await res.text() || `Project request failed (${res.status})`)
        const project = await res.json() as { id: string }
        if (!cancelled) setProjectId(project.id)
      } catch (e) {
        if (!cancelled) setProjectError(e instanceof Error ? e.message : 'Project resolve failed')
      }
    })()
    return () => { cancelled = true }
  }, [authStatus, githubUserId, githubUsername])

  // Load existing sites for this project.
  useEffect(() => {
    if (!projectId || !githubUserId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(apiUrl(`/api/heatmap/sites?github_user_id=${encodeURIComponent(githubUserId)}&project_id=${encodeURIComponent(projectId)}`))
        if (!res.ok) return
        const raw = await res.json() as Array<Record<string, unknown>>
        const sites = raw.map(mapSite)
        if (cancelled) return
        const storedId = typeof window !== 'undefined' ? sessionStorage.getItem(STORAGE_SITE_ID) : null
        const preferred = sites.find(s => s.id === storedId) ?? sites[0] ?? null
        setSite(preferred)
        if (preferred && typeof window !== 'undefined') {
          sessionStorage.setItem(STORAGE_SITE_ID, preferred.id)
        }
      } catch {
        /* noop — surfaced elsewhere */
      }
    })()
    return () => { cancelled = true }
  }, [projectId, githubUserId])

  const shouldPoll = !!site?.verifiedAt

  // Fetch pages (and poll while empty).
  useEffect(() => {
    if (!site || !githubUserId) return
    let cancelled = false
    async function fetchPages() {
      if (!site) return
      try {
        const res = await fetch(apiUrl(`/api/heatmap/pages?github_user_id=${encodeURIComponent(githubUserId)}&site_id=${encodeURIComponent(site.id)}`))
        if (!res.ok) return
        const raw = await res.json() as Array<Record<string, unknown>>
        if (cancelled) return
        const next = raw.map(mapPage)
        setPages(next)
        if (next.length && !selectedPageId) {
          setSelectedPageId(next[0].id)
        }
      } catch {
        /* noop */
      }
    }
    fetchPages()
    if (!shouldPoll) return
    const interval = window.setInterval(() => {
      if (pages.length === 0) fetchPages()
    }, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [site, githubUserId, shouldPoll, pages.length, selectedPageId])

  // Fetch heatmap data when inputs change.
  useEffect(() => {
    if (!selectedPageId || !githubUserId) return
    let cancelled = false
    setLoadingHeatmap(true)
    ;(async () => {
      try {
        const res = await fetch(apiUrl(
          `/api/heatmap/pages/${selectedPageId}/heatmap` +
          `?github_user_id=${encodeURIComponent(githubUserId)}` +
          `&layer=${layer}&device=${device}&days=${days}`,
        ))
        if (!res.ok) throw new Error(`Heatmap fetch failed (${res.status})`)
        const raw = await res.json()
        if (!cancelled) setHeatmap(mapHeatmapData(raw))
      } catch {
        if (!cancelled) setHeatmap(null)
      } finally {
        if (!cancelled) setLoadingHeatmap(false)
      }
    })()
    return () => { cancelled = true }
  }, [selectedPageId, layer, device, days, githubUserId])

  const selectedPage = useMemo(
    () => pages.find(p => p.id === selectedPageId) ?? null,
    [pages, selectedPageId],
  )

  // Stable handlers so the HeatmapSetup / AlmostDoneCard children don't
  // see a new prop reference on every parent render. The AlmostDoneCard's
  // verify poll loop used to reset on each new reference, which meant
  // 25-second Playwright-backed verify calls were getting abandoned
  // before they could resolve.
  const handleSiteReady = useCallback((next: HeatmapSite) => {
    setSite(next)
    try { sessionStorage.setItem(STORAGE_SITE_ID, next.id) } catch { /* ignore */ }
  }, [])
  const handleVerified = useCallback((next: HeatmapSite) => {
    setSite({ ...next, verifiedAt: new Date().toISOString() })
  }, [])

  const [refreshingShots, setRefreshingShots] = useState(false)
  // Kick every page's screenshot back to "unset" and schedule fresh
  // Playwright captures server-side. Used after a deploy — the stored
  // image can be days stale, but the dashboard couldn't previously
  // surface that to the user.
  const refreshScreenshots = useCallback(async () => {
    if (!site || !githubUserId) return
    setRefreshingShots(true)
    try {
      await fetch(apiUrl(`/api/heatmap/sites/${site.id}/refresh-screenshots`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ github_user_id: githubUserId }),
      })
      // Optimistically blank the local screenshot URLs so the "Capturing…"
      // affordance kicks in immediately — the poll loop below will refetch
      // the pages once the background Playwright capture finishes.
      setPages(prev => prev.map(p => ({ ...p, screenshotUrl: '' })))
    } catch { /* non-fatal — user can retry */ } finally {
      setRefreshingShots(false)
    }
  }, [site, githubUserId])

  const totalSessions = heatmap?.totalSessions ?? 0
  const hasEnoughData = totalSessions >= MIN_SESSIONS_FOR_HEATMAP

  // ── Render branches ────────────────────────────────────────────────

  if (authStatus === 'loading') return <LoadingShell />
  if (authStatus !== 'authenticated') return null

  if (projectError) {
    return (
      <ErrorShell
        title="No repository selected"
        message={projectError}
        action={{ label: 'Go to Discovery', onClick: () => router.push('/dashboard/discovery') }}
      />
    )
  }

  if (!projectId) return <LoadingShell label="Resolving project…" />

  if (!site || !site.verifiedAt) {
    return (
      <div className="max-w-6xl mx-auto px-6 pb-16">
        <HeatmapSetup
          githubUserId={githubUserId}
          projectId={projectId}
          initialSite={site}
          onSiteReady={handleSiteReady}
          onVerified={handleVerified}
        />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 pb-16">
      <header className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-neutral-950" style={{ letterSpacing: '-0.02em' }}>Heatmap</h1>
          <div className="text-[11px] mt-1 text-neutral-500">
            {site.domain}
          </div>
        </div>
        <StatsHeader
          sessions={heatmap?.totalSessions ?? 0}
          events={heatmap?.totalEvents ?? 0}
          avgScrollDepthPct={heatmap?.avgScrollDepthPct ?? 0}
          rageClickRate={heatmap?.rageClickRate ?? 0}
        />
      </header>

      <div className="mb-5">
        <HeatmapControls
          layer={layer}
          device={device}
          days={days}
          onLayerChange={setLayer}
          onDeviceChange={setDevice}
          onDaysChange={setDays}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        <aside>
          <PageList pages={pages} selectedId={selectedPageId} onSelect={setSelectedPageId} />
        </aside>
        <main>
          {!hasEnoughData ? (
            <CollectingCard
              sessions={totalSessions}
              threshold={MIN_SESSIONS_FOR_HEATMAP}
              onRefreshScreenshots={refreshScreenshots}
              refreshing={refreshingShots}
              siteDomain={site.domain}
            />
          ) : selectedPage ? (
            <>
              <HeatmapCanvas
                screenshotUrl={selectedPage.screenshotUrl}
                buckets={heatmap?.buckets ?? []}
                layer={layer}
                highlightRegion={hoveredSuggestion?.targetRegion ?? null}
              />
              <div className="flex items-center justify-between gap-2 mt-3 text-[11px] text-neutral-500">
                <div className="flex items-center gap-2">
                  <span>Page screenshot</span>
                  {!selectedPage.screenshotUrl && (
                    <span className="inline-flex items-center gap-1.5 text-neutral-400">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400" />
                      Capturing…
                    </span>
                  )}
                </div>
                <button
                  onClick={refreshScreenshots}
                  disabled={refreshingShots}
                  className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-2.5 py-1 text-[10.5px] font-medium text-neutral-600 transition hover:bg-neutral-50 disabled:cursor-wait disabled:opacity-60"
                  title="Re-capture from the latest deployed version of your site"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                  {refreshingShots ? 'Refreshing…' : 'Refresh from live site'}
                </button>
              </div>
              {loadingHeatmap && (
                <div className="mt-3 text-[11px] text-neutral-400">Updating heatmap…</div>
              )}
            </>
          ) : (
            <div
              className="rounded-[22px] border border-black/[0.07] bg-white p-8 text-[12px] text-neutral-500"
            >
              Waiting for the first pageview. Open your deployed site in another tab and interact — events stream here within a few seconds.
            </div>
          )}
        </main>
      </div>

      {selectedPage && hasEnoughData && (
        <AIRecommendations
          pageId={selectedPage.id}
          pagePath={selectedPage.path}
          githubUserId={githubUserId}
          onHoverRegion={setHoveredSuggestion}
        />
      )}
    </div>
  )
}

function CollectingCard({
  sessions,
  threshold,
  onRefreshScreenshots,
  refreshing,
  siteDomain,
}: {
  sessions: number
  threshold: number
  onRefreshScreenshots: () => void
  refreshing: boolean
  siteDomain: string
}) {
  const remaining = Math.max(0, threshold - sessions)
  const pct = Math.min(100, Math.round((sessions / threshold) * 100))
  return (
    <div className="rounded-[22px] border border-black/[0.07] bg-white p-8">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-black/[0.06] bg-neutral-50 px-3 py-1">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neutral-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-neutral-700" />
        </span>
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
          Collecting data
        </span>
      </div>
      <h2 className="text-[20px] font-semibold text-neutral-950" style={{ letterSpacing: '-0.01em' }}>
        We need at least {threshold} sessions before we can show a heatmap
      </h2>
      <p className="mt-2 max-w-xl text-[13px] leading-6 text-neutral-500">
        Heatmaps built on a handful of sessions are misleading — a couple of
        outlier clicks dominate the whole map. Come back once more visitors
        have interacted with {siteDomain || 'your site'} and we&apos;ll have a
        meaningful picture for you.
      </p>

      <div className="mt-5 max-w-md">
        <div className="mb-2 flex items-center justify-between text-[11px] font-medium">
          <span className="text-neutral-700">
            {sessions} / {threshold} session{threshold === 1 ? '' : 's'}
          </span>
          <span className="text-neutral-400">
            {remaining === 0 ? 'ready' : `${remaining} to go`}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full bg-neutral-900 transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <a
          href={siteDomain}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-neutral-950 px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-neutral-800"
        >
          Open my site ↗
        </a>
        <button
          onClick={onRefreshScreenshots}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-4 py-2 text-[12px] font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-wait disabled:opacity-60"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          {refreshing ? 'Refreshing…' : 'Refresh screenshot from live site'}
        </button>
      </div>

      <p className="mt-5 text-[11px] text-neutral-400">
        Tip: share the URL with a few teammates or test accounts — once {threshold} real
        sessions land, this view unlocks automatically.
      </p>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────

function parseRepoName(url: string): string | null {
  const m = url.match(/github\.com[/:]([^/]+)\/([^/.]+)(?:\.git)?\/?$/i)
  if (!m) return null
  return `${m[1]}/${m[2]}`
}

function LoadingShell({ label = 'Loading…' }: { label?: string } = {}) {
  return (
    <div className="max-w-6xl mx-auto px-6 py-24 text-center text-neutral-500">
      {label}
    </div>
  )
}

function ErrorShell({ title, message, action }: { title: string; message: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="max-w-xl mx-auto px-6 py-24 text-center">
      <h2 className="text-xl font-semibold text-neutral-950 mb-2">{title}</h2>
      <p className="text-[13px] mb-6 text-neutral-500">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-4 py-2 text-[12px] font-medium text-white transition hover:bg-neutral-800"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
