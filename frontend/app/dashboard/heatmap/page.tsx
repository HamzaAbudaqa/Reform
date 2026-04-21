'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

  // Current pages, kept as a ref so the poll interval can read the
  // latest value without `pages` going in its deps (which would
  // re-create the interval on every state update — worst case an
  // infinite loop, best case extra network churn).
  const pagesRef = useRef<HeatmapPage[]>([])
  useEffect(() => { pagesRef.current = pages }, [pages])

  // Exposed so the refresh-screenshots button can trigger an immediate
  // fetch without duplicating the fetch body.
  const fetchPagesRef = useRef<(() => Promise<HeatmapPage[] | null>) | null>(null)

  // Fetch pages (and poll while empty OR while any screenshot is missing).
  useEffect(() => {
    if (!site || !githubUserId) return
    let cancelled = false
    const siteId = site.id
    async function fetchPages(): Promise<HeatmapPage[] | null> {
      try {
        const res = await fetch(apiUrl(`/api/heatmap/pages?github_user_id=${encodeURIComponent(githubUserId)}&site_id=${encodeURIComponent(siteId)}`))
        if (!res.ok) return null
        const raw = await res.json() as Array<Record<string, unknown>>
        if (cancelled) return null
        const next = raw.map(mapPage)
        setPages(next)
        if (next.length && !selectedPageId) {
          setSelectedPageId(next[0].id)
        }
        return next
      } catch {
        return null
      }
    }
    fetchPagesRef.current = fetchPages
    fetchPages()
    if (!shouldPoll) return
    // Keep polling while (a) no pages yet or (b) some page is still
    // missing its screenshot — the refresh-from-live flow relies on
    // this to pick up Playwright captures without manual refresh.
    const interval = window.setInterval(() => {
      const current = pagesRef.current
      if (current.length === 0 || current.some((p: HeatmapPage) => !p.screenshotUrl)) {
        void fetchPages()
      }
    }, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      fetchPagesRef.current = null
      window.clearInterval(interval)
    }
  }, [site, githubUserId, shouldPoll, selectedPageId])

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
  const [refreshError, setRefreshError] = useState<string | null>(null)
  // Force a fresh Playwright capture. Strategy:
  //
  //   1. Synchronously capture JUST the currently-visible page via the
  //      per-page endpoint — the user gets a guaranteed response in one
  //      Playwright cycle (~6-10s) and sees their card update. This is the
  //      only capture the user is blocked on.
  //   2. Fire the bulk /refresh-screenshots endpoint for everything else
  //      as a background task. The next /pages poll picks up the new
  //      URLs when those captures finish — the user doesn't wait.
  //
  // We DO NOT optimistically blank the screenshot URL before the request
  // resolves — on capture failure (404, dev-server-down, etc.) the old
  // screenshot stays visible rather than the UI falling back to "No
  // screenshot yet" forever.
  const refreshScreenshots = useCallback(async () => {
    if (!site || !githubUserId) return
    setRefreshingShots(true)
    setRefreshError(null)

    try {
      // ── Fire the background bulk refresh for every page except the
      // selected one. Doesn't wait — the main /pages poll handles the
      // update when those captures finish.
      void fetch(apiUrl(`/api/heatmap/sites/${site.id}/refresh-screenshots`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ github_user_id: githubUserId }),
      }).catch(() => { /* non-fatal */ })

      // ── Synchronously capture the selected page.
      if (!selectedPageId) return
      const res = await fetch(apiUrl(`/api/heatmap/pages/${selectedPageId}/screenshot`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ github_user_id: githubUserId }),
      })

      if (!res.ok) {
        // Parse the backend detail for a useful error. 502 with
        // "Live URL returned HTTP 404" is the common case when a route
        // got removed between deploys.
        let detail = `Capture failed (HTTP ${res.status})`
        try {
          const body = await res.json() as { detail?: string }
          if (body?.detail) detail = body.detail
        } catch { /* body wasn't JSON */ }
        setRefreshError(detail)
        return
      }

      const data = await res.json() as {
        screenshot_url: string
        page_height_px: number
      }
      setPages(prev => prev.map(row =>
        row.id === selectedPageId
          ? { ...row, screenshotUrl: data.screenshot_url, pageHeightPx: data.page_height_px }
          : row,
      ))
    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : 'Refresh failed')
    } finally {
      setRefreshingShots(false)
    }
  }, [site, githubUserId, selectedPageId])

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
                      {refreshingShots ? 'Capturing from live site…' : 'Capturing…'}
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
              {refreshError && (
                <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] text-amber-900">
                  <svg className="mt-0.5 shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 9v4" />
                    <path d="M12 17h.01" />
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">Couldn&apos;t refresh — </span>
                    <span>{refreshError}</span>
                    {/^.*HTTP 404/i.test(refreshError) && (
                      <span className="block mt-0.5 text-amber-800">
                        This route may have been removed in your latest deploy, or your site needs a redirect set up for it. The previous screenshot is still shown.
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setRefreshError(null)}
                    className="flex-shrink-0 text-amber-700 hover:text-amber-950"
                    aria-label="Dismiss"
                  >
                    ×
                  </button>
                </div>
              )}
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
