'use client'

import { useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useSubscription } from '@/lib/useSubscription'
import { setSelectedRepo } from '@/lib/selectedRepo'
import {
  fetchProjects,
  formatRelativeTime,
  normalizeStatus,
  type ProjectSummary,
  type RunStatus,
  type RunMode,
} from '@/lib/projectsApi'
import CheckoutResult from '@/components/dashboard/CheckoutResult'
import UpgradeBanner from '@/components/dashboard/UpgradeBanner'
import RunHistoryDrawer from '@/components/dashboard/RunHistoryDrawer'

type StatusFilter = 'all' | 'in_progress' | 'completed' | 'failed'
type SortBy = 'recent' | 'name'

interface StatusPillStyle {
  background: string
  border: string
  color: string
  dot: string
  label: string
  pulse: boolean
}

function pillForStatus(status: RunStatus | null): StatusPillStyle {
  switch (status) {
    case 'in_progress':
      return {
        background: 'rgba(168,85,247,0.08)',
        border: '1px solid rgba(168,85,247,0.18)',
        color: 'rgba(168,85,247,0.85)',
        dot: '#a855f7',
        label: 'In Progress',
        pulse: true,
      }
    case 'completed':
      return {
        background: 'rgba(34,197,94,0.08)',
        border: '1px solid rgba(34,197,94,0.16)',
        color: '#86efac',
        dot: '#22c55e',
        label: 'Completed',
        pulse: false,
      }
    case 'published':
      return {
        background: 'rgba(59,130,246,0.08)',
        border: '1px solid rgba(59,130,246,0.18)',
        color: '#93c5fd',
        dot: '#3b82f6',
        label: 'Published',
        pulse: false,
      }
    case 'failed':
      return {
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.16)',
        color: 'rgba(252,165,165,0.9)',
        dot: '#ef4444',
        label: 'Failed',
        pulse: false,
      }
    default:
      return {
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        color: 'rgba(255,255,255,0.5)',
        dot: 'rgba(255,255,255,0.3)',
        label: 'No runs',
        pulse: false,
      }
  }
}

function ModeBadge({ mode }: { mode: RunMode | null | undefined }) {
  if (!mode) return null
  const isExplore = mode === 'explore'
  return (
    <span
      className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
      style={{
        background: isExplore ? 'rgba(124,58,237,0.08)' : 'rgba(255,255,255,0.04)',
        color: isExplore ? 'rgba(168,85,247,0.75)' : 'rgba(255,255,255,0.45)',
        border: isExplore ? '1px solid rgba(124,58,237,0.2)' : '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {mode}
    </span>
  )
}

function ProjectRow({
  project,
  canScan,
  onTransform,
  onOpenHistory,
}: {
  project: ProjectSummary
  canScan: boolean
  onTransform: (project: ProjectSummary, mode: RunMode) => void
  onOpenHistory: (project: ProjectSummary) => void
}) {
  const router = useRouter()
  const status = normalizeStatus(project.latest_run_status)
  const pill = pillForStatus(status)
  const repoShort = project.repo_name.split('/')[1] || project.repo_name
  const thumb = project.latest_after_screenshot || null
  const pagesTransformed = project.latest_pages_transformed ?? project.latest_run?.total_transformed ?? null
  const mode = project.latest_mode ?? project.latest_run?.mode ?? null
  const firstNote = (project.latest_transformation_notes ?? project.latest_run?.transformation_notes ?? [])[0]

  const summaryParts: string[] = []
  if (pagesTransformed !== null && pagesTransformed !== undefined) {
    summaryParts.push(`${pagesTransformed} page${pagesTransformed === 1 ? '' : 's'} transformed`)
  }
  if (mode) summaryParts.push(`${mode} mode`)
  const summary = summaryParts.join(' • ')

  const activeRunExists = status === 'in_progress'

  function openLatest() {
    router.push(`/dashboard/transform?project=${project.id}`)
  }

  function openEditLab() {
    const repoUrl = project.repo_url || `https://github.com/${project.repo_name}`
    setSelectedRepo(repoUrl, project.branch || 'main')
    router.push('/dashboard/edit-lab')
  }

  function resumeActive() {
    router.push(`/dashboard/transform?project=${project.id}&resume=1`)
  }

  return (
    <div
      className="rounded-xl transition-all"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 2px 16px rgba(0,0,0,0.2)',
      }}
    >
      <div className="flex flex-col sm:flex-row gap-4 p-4">
        {/* Thumbnail */}
        <button
          onClick={openLatest}
          className="flex-shrink-0 overflow-hidden rounded-lg transition-all hover:brightness-110 active:scale-[0.99]"
          style={{
            width: 168,
            height: 104,
            background: 'linear-gradient(135deg, rgba(124,58,237,0.06), rgba(59,130,246,0.04))',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
          aria-label={`Open ${repoShort}`}
        >
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb}
              alt={`${repoShort} preview`}
              className="w-full h-full object-cover object-top"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(168,85,247,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18" />
                <path d="M9 21V9" />
              </svg>
            </div>
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <button
                onClick={openLatest}
                className="block text-left group"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-[15px] font-semibold text-white truncate group-hover:text-purple-200 transition-colors">
                    {repoShort}
                  </h3>
                  <span
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.4)' }}
                  >
                    {project.branch || 'main'}
                  </span>
                </div>
                <p className="text-[11px] font-mono mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {project.repo_name}
                </p>
              </button>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                style={{ background: pill.background, border: pill.border }}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full${pill.pulse ? ' animate-pulse' : ''}`}
                  style={{ background: pill.dot }}
                />
                <span className="text-[10px] font-medium" style={{ color: pill.color }}>
                  {pill.label}
                </span>
              </div>
              <ModeBadge mode={mode} />
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2 text-[11px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
            <span>{formatRelativeTime(project.updated_at)}</span>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
            <span>{project.total_runs} run{project.total_runs === 1 ? '' : 's'}</span>
          </div>

          {(summary || firstNote) && (
            <div className="mt-2 space-y-1">
              {summary && (
                <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  {summary}
                </p>
              )}
              {firstNote && (
                <p
                  className="text-[11px] italic leading-snug truncate"
                  style={{ color: 'rgba(168,85,247,0.7)' }}
                  title={firstNote}
                >
                  {firstNote}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            <button
              onClick={resumeActive}
              disabled={!activeRunExists}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: activeRunExists ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : 'rgba(255,255,255,0.03)',
                color: activeRunExists ? 'white' : 'rgba(255,255,255,0.3)',
                border: activeRunExists ? 'none' : '1px solid rgba(255,255,255,0.06)',
                boxShadow: activeRunExists ? '0 0 20px rgba(124,58,237,0.2)' : 'none',
              }}
              title={activeRunExists ? 'Continue watching the in-progress run' : 'No active run to resume'}
            >
              Resume Transform
            </button>
            <button
              onClick={() => onTransform(project, 'stable')}
              disabled={!canScan}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: 'rgba(168,85,247,0.08)',
                color: 'rgba(168,85,247,0.85)',
                border: '1px solid rgba(168,85,247,0.2)',
              }}
              title="Re-run using the cached competitor intelligence"
            >
              Run Again (Stable)
            </button>
            <button
              onClick={() => onTransform(project, 'explore')}
              disabled={!canScan}
              className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: 'transparent',
                color: 'rgba(255,255,255,0.55)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
              title="Fresh competitor discovery — takes longer, may differ"
            >
              Explore New Version
            </button>
            <button
              onClick={openLatest}
              className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors hover:bg-white/[0.04]"
              style={{ color: 'rgba(255,255,255,0.5)', border: '1px solid transparent' }}
            >
              View Latest
            </button>
            <button
              onClick={openEditLab}
              className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors hover:bg-white/[0.04]"
              style={{ color: 'rgba(255,255,255,0.5)', border: '1px solid transparent' }}
            >
              Open Edit Lab
            </button>
            <button
              onClick={() => onOpenHistory(project)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors hover:bg-white/[0.04]"
              style={{ color: 'rgba(255,255,255,0.5)', border: '1px solid transparent' }}
            >
              History
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const repo = searchParams.get('repo')
  const branch = searchParams.get('branch')
  const { data: session } = useSession()
  const { subscription, canScan, canAddRepo, isFree, loading: subLoading } = useSubscription()
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortBy, setSortBy] = useState<SortBy>('recent')
  const [historyProject, setHistoryProject] = useState<ProjectSummary | null>(null)

  // If a repo param is present, persist the selection and redirect to discovery.
  useEffect(() => {
    if (repo) {
      setSelectedRepo(repo, branch || 'main')
      const qs = new URLSearchParams({ repo })
      if (branch) qs.set('branch', branch)
      router.replace(`/dashboard/discovery?${qs.toString()}`)
    }
  }, [repo, branch, router])

  useEffect(() => {
    if (!session?.githubId || repo) return
    const ac = new AbortController()
    setLoading(true)
    fetchProjects(session.githubId, ac.signal)
      .then(data => {
        if (ac.signal.aborted) return
        setProjects(data)
      })
      .catch(() => {
        /* keep last list on error */
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false)
      })
    return () => ac.abort()
  }, [session?.githubId, repo])

  const visibleProjects = useMemo(() => {
    let list = projects.slice()
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(p => p.repo_name.toLowerCase().includes(q))
    }
    if (statusFilter !== 'all') {
      list = list.filter(p => {
        const s = normalizeStatus(p.latest_run_status)
        if (statusFilter === 'completed') return s === 'completed' || s === 'published'
        return s === statusFilter
      })
    }
    if (sortBy === 'name') {
      list.sort((a, b) => a.repo_name.localeCompare(b.repo_name))
    } else {
      list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    }
    return list
  }, [projects, search, statusFilter, sortBy])

  function handleTransform(project: ProjectSummary, mode: RunMode) {
    const repoUrl = project.repo_url || `https://github.com/${project.repo_name}`
    setSelectedRepo(repoUrl, project.branch || 'main')
    const qs = new URLSearchParams({
      repo: repoUrl,
      branch: project.branch || 'main',
      mode,
      forceFresh: '1',
    })
    router.push(`/dashboard/transform?${qs.toString()}`)
  }

  if (repo) return null

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <CheckoutResult />

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Your Projects</h1>
          <p className="text-[13px] mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Workspace for every repo you&apos;ve connected — resume, rerun, and explore.
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard/discovery')}
          disabled={!canScan}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
            boxShadow: canScan ? '0 0 30px rgba(124,58,237,0.2)' : 'none',
          }}
        >
          New Analysis
        </button>
      </div>

      {/* Usage stats */}
      {!subLoading && (
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>Scans</span>
            <div className="w-24 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (subscription.scans_used / subscription.scans_limit) * 100)}%`,
                  background: subscription.scans_used >= subscription.scans_limit ? '#ef4444' : 'linear-gradient(90deg, #7c3aed, #a855f7)',
                }}
              />
            </div>
            <span className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {subscription.scans_used}/{subscription.scans_limit}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>Repos</span>
            <span className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {subscription.repos_connected}/{subscription.repos_limit === -1 ? '\u221e' : subscription.repos_limit}
            </span>
          </div>
          <span
            className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{
              background: isFree ? 'rgba(255,255,255,0.04)' : 'rgba(124,58,237,0.1)',
              color: isFree ? 'rgba(255,255,255,0.3)' : 'rgba(168,85,247,0.7)',
              border: isFree ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(124,58,237,0.2)',
            }}
          >
            {subscription.plan}
          </span>
        </div>
      )}

      {!subLoading && !canScan && (
        <div className="mb-6">
          <UpgradeBanner message={`You've used all ${subscription.scans_limit} scans this month. Upgrade for more.`} />
        </div>
      )}
      {!subLoading && !canAddRepo && canScan && (
        <div className="mb-6">
          <UpgradeBanner message={`You've reached your ${subscription.repos_limit} repo limit. Upgrade to connect more.`} />
        </div>
      )}

      {/* Controls bar */}
      {(projects.length > 0 || loading) && (
        <div
          className="rounded-xl px-3 py-2 mb-4 flex flex-wrap items-center gap-2"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search repos..."
              className="bg-transparent flex-1 text-[12px] text-white outline-none placeholder:text-white/20"
            />
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {(['all', 'in_progress', 'completed', 'failed'] as StatusFilter[]).map(f => {
              const active = statusFilter === f
              const labels: Record<StatusFilter, string> = {
                all: 'All',
                in_progress: 'In Progress',
                completed: 'Completed',
                failed: 'Failed',
              }
              return (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors"
                  style={{
                    background: active ? 'rgba(168,85,247,0.12)' : 'transparent',
                    color: active ? 'rgba(168,85,247,0.9)' : 'rgba(255,255,255,0.5)',
                    border: active ? '1px solid rgba(168,85,247,0.25)' : '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  {labels[f]}
                </button>
              )
            })}
          </div>
          <div className="h-4 w-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortBy)}
            className="bg-transparent text-[11px] px-2 py-1 rounded-md outline-none cursor-pointer"
            style={{ color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}
            aria-label="Sort"
          >
            <option value="recent" style={{ background: '#0d0c16' }}>Recent activity</option>
            <option value="name" style={{ background: '#0d0c16' }}>Repo name</option>
          </select>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 rounded-full animate-spin" style={{ border: '2px solid rgba(168,85,247,0.2)', borderTopColor: '#a855f7' }} />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(168,85,247,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">No projects yet</h2>
          <p className="text-[13px] mb-6" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Run your first transformation to see it here.
          </p>
          <button
            onClick={() => router.push('/dashboard/discovery')}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
          >
            Get Started
          </button>
        </div>
      ) : visibleProjects.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
            No projects match your filters.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleProjects.map(project => (
            <ProjectRow
              key={project.id}
              project={project}
              canScan={canScan}
              onTransform={handleTransform}
              onOpenHistory={p => setHistoryProject(p)}
            />
          ))}
        </div>
      )}

      <RunHistoryDrawer
        projectId={historyProject?.id || null}
        repoName={historyProject?.repo_name || ''}
        onClose={() => setHistoryProject(null)}
      />
    </div>
  )
}

export default function DashboardIndex() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  )
}
