'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import HeatmapCanvas from '@/components/heatmap/HeatmapCanvas'
import HeatmapControls from '@/components/heatmap/HeatmapControls'
import HeatmapSetup from '@/components/heatmap/HeatmapSetup'
import PageList from '@/components/heatmap/PageList'
import ScrollDepthRail from '@/components/heatmap/ScrollDepthRail'
import StatsHeader from '@/components/heatmap/StatsHeader'
import { apiUrl } from '@/lib/api'
import { getSelectedRepo } from '@/lib/selectedRepo'
import type { HeatmapData, HeatmapDevice, HeatmapLayer, HeatmapPage, HeatmapSite } from '@/types/heatmap'
import { mapHeatmapData, mapPage, mapSite } from '@/types/heatmap'

const POLL_INTERVAL_MS = 10_000
const STORAGE_SITE_ID = 'refineui_heatmap_site_id'

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
  const [capturingScreenshot, setCapturingScreenshot] = useState(false)

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

  // Scroll-layer buckets always fetched separately so the scroll rail shows
  // retention regardless of the currently-viewed layer.
  const [scrollBuckets, setScrollBuckets] = useState<HeatmapData['buckets']>([])
  useEffect(() => {
    if (!selectedPageId || !githubUserId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(apiUrl(
          `/api/heatmap/pages/${selectedPageId}/heatmap` +
          `?github_user_id=${encodeURIComponent(githubUserId)}` +
          `&layer=scroll&device=${device}&days=${days}`,
        ))
        if (!res.ok) return
        const raw = await res.json()
        if (!cancelled) setScrollBuckets(mapHeatmapData(raw).buckets)
      } catch {
        /* noop */
      }
    })()
    return () => { cancelled = true }
  }, [selectedPageId, device, days, githubUserId])

  const selectedPage = useMemo(
    () => pages.find(p => p.id === selectedPageId) ?? null,
    [pages, selectedPageId],
  )

  const captureScreenshot = useCallback(async () => {
    if (!selectedPage || !githubUserId) return
    setCapturingScreenshot(true)
    try {
      const res = await fetch(apiUrl(`/api/heatmap/pages/${selectedPage.id}/screenshot`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ github_user_id: githubUserId, path: selectedPage.path }),
      })
      if (!res.ok) throw new Error(`Screenshot failed (${res.status})`)
      const json = await res.json() as { screenshot_url?: string }
      setPages(prev => prev.map(p => p.id === selectedPage.id ? { ...p, screenshotUrl: json.screenshot_url ?? p.screenshotUrl } : p))
    } catch {
      /* surfaced via UI below */
    } finally {
      setCapturingScreenshot(false)
    }
  }, [selectedPage, githubUserId])

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
          onSiteReady={next => {
            setSite(next)
            try { sessionStorage.setItem(STORAGE_SITE_ID, next.id) } catch { /* ignore */ }
          }}
          onVerified={next => {
            setSite({ ...next, verifiedAt: new Date().toISOString() })
          }}
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

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_80px] gap-4">
        <aside>
          <PageList pages={pages} selectedId={selectedPageId} onSelect={setSelectedPageId} />
        </aside>
        <main>
          {selectedPage ? (
            <>
              <HeatmapCanvas
                screenshotUrl={selectedPage.screenshotUrl}
                buckets={heatmap?.buckets ?? []}
                layer={layer}
              />
              <div className="flex items-center gap-2 mt-3 text-[11px] text-neutral-500">
                <span>Page screenshot</span>
                {!selectedPage.screenshotUrl && <span style={{ color: '#b45309' }}>— not captured yet</span>}
                <button
                  onClick={captureScreenshot}
                  disabled={capturingScreenshot}
                  className="ml-auto rounded-full border border-black/[0.12] bg-white px-3 py-1 text-[11px] font-medium text-neutral-950 transition hover:bg-neutral-50 disabled:opacity-50"
                >
                  {capturingScreenshot ? 'Capturing…' : selectedPage.screenshotUrl ? 'Recapture' : 'Capture screenshot'}
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
        <aside className="hidden lg:block">
          <ScrollDepthRail buckets={scrollBuckets} />
        </aside>
      </div>
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
