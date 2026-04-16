'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  fetchProjectRuns,
  formatRelativeTime,
  normalizeStatus,
  stageLabel,
  type TransformRunSummary,
} from '@/lib/projectsApi'

interface RunHistoryDrawerProps {
  projectId: string | null
  repoName: string
  onClose: () => void
}

function statusStyles(status: ReturnType<typeof normalizeStatus>): {
  background: string
  border: string
  color: string
  label: string
  dot: string
  pulse: boolean
} {
  switch (status) {
    case 'in_progress':
      return {
        background: 'rgba(168,85,247,0.08)',
        border: '1px solid rgba(168,85,247,0.18)',
        color: 'rgba(168,85,247,0.8)',
        label: 'In Progress',
        dot: '#a855f7',
        pulse: true,
      }
    case 'completed':
      return {
        background: 'rgba(34,197,94,0.08)',
        border: '1px solid rgba(34,197,94,0.16)',
        color: '#86efac',
        label: 'Completed',
        dot: '#22c55e',
        pulse: false,
      }
    case 'published':
      return {
        background: 'rgba(59,130,246,0.08)',
        border: '1px solid rgba(59,130,246,0.18)',
        color: '#93c5fd',
        label: 'Published',
        dot: '#3b82f6',
        pulse: false,
      }
    case 'failed':
      return {
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.16)',
        color: 'rgba(239,68,68,0.8)',
        label: 'Failed',
        dot: '#ef4444',
        pulse: false,
      }
    default:
      return {
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        color: 'rgba(255,255,255,0.5)',
        label: 'Unknown',
        dot: 'rgba(255,255,255,0.3)',
        pulse: false,
      }
  }
}

function computeDuration(run: TransformRunSummary): string {
  if (!run.started_at) return '—'
  const start = new Date(run.started_at).getTime()
  const endIso = run.updated_at || (isActive(run) ? new Date().toISOString() : run.started_at)
  const end = new Date(endIso).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return '—'
  const diffSec = Math.round((end - start) / 1000)
  if (diffSec < 60) return `${diffSec}s`
  const min = Math.floor(diffSec / 60)
  const sec = diffSec % 60
  return `${min}m ${String(sec).padStart(2, '0')}s`
}

function isActive(run: TransformRunSummary): boolean {
  return normalizeStatus(run.status) === 'in_progress'
}

export default function RunHistoryDrawer({ projectId, repoName, onClose }: RunHistoryDrawerProps) {
  const router = useRouter()
  const [runs, setRuns] = useState<TransformRunSummary[] | null>(null)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    if (!projectId) return
    const ac = new AbortController()
    setRuns(null)
    setError('')
    fetchProjectRuns(projectId, ac.signal)
      .then(data => {
        if (!ac.signal.aborted) setRuns(data.slice(0, 10))
      })
      .catch(e => {
        if (!ac.signal.aborted) setError(e instanceof Error ? e.message : 'Failed to load run history')
      })
    return () => ac.abort()
  }, [projectId])

  useEffect(() => {
    if (!projectId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [projectId, onClose])

  if (!projectId) return null

  function openRun(run: TransformRunSummary) {
    onClose()
    router.push(`/dashboard/transform?project=${projectId}&run=${run.id}`)
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[150]"
        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      <aside
        className="fixed top-0 right-0 bottom-0 z-[160] w-[440px] max-w-[92vw] flex flex-col"
        style={{
          background: 'linear-gradient(180deg, rgba(14,16,24,0.98) 0%, rgba(8,10,16,0.98) 100%)',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '-24px 0 80px rgba(0,0,0,0.6)',
        }}
      >
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="min-w-0">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.15em]"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              Run History
            </p>
            <p className="text-[13px] font-semibold text-white truncate">{repoName}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close run history"
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/[0.05]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {runs === null && !error && (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 rounded-full animate-spin" style={{ border: '2px solid rgba(168,85,247,0.2)', borderTopColor: '#a855f7' }} />
            </div>
          )}
          {error && (
            <div
              className="rounded-lg px-3 py-3 text-[12px]"
              style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', color: 'rgba(252,165,165,0.9)' }}
            >
              {error}
            </div>
          )}
          {runs && runs.length === 0 && !error && (
            <div className="py-16 text-center text-[12px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
              No runs yet for this project.
            </div>
          )}
          {runs && runs.length > 0 && (
            <ul className="space-y-2">
              {runs.map(run => {
                const status = normalizeStatus(run.status)
                const s = statusStyles(status)
                const notes = run.transformation_notes || []
                const stage = run.current_stage ? stageLabel(run.current_stage) : null
                const pagesCount = run.total_transformed ?? null
                const isActive = status === 'in_progress'
                return (
                  <li key={run.id}>
                    <button
                      onClick={() => openRun(run)}
                      className="w-full text-left rounded-xl px-4 py-3 transition-all hover:bg-white/[0.04]"
                      style={{
                        background: 'rgba(255,255,255,0.015)',
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div
                          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                          style={{ background: s.background, border: s.border }}
                        >
                          <div
                            className={`w-1.5 h-1.5 rounded-full${s.pulse ? ' animate-pulse' : ''}`}
                            style={{ background: s.dot }}
                          />
                          <span className="text-[10px] font-medium" style={{ color: s.color }}>
                            {s.label}
                          </span>
                        </div>
                        {run.mode && (
                          <span
                            className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                            style={{
                              background: run.mode === 'explore' ? 'rgba(124,58,237,0.08)' : 'rgba(255,255,255,0.04)',
                              color: run.mode === 'explore' ? 'rgba(168,85,247,0.7)' : 'rgba(255,255,255,0.4)',
                              border: run.mode === 'explore' ? '1px solid rgba(124,58,237,0.18)' : '1px solid rgba(255,255,255,0.06)',
                            }}
                          >
                            {run.mode}
                          </span>
                        )}
                        <span className="ml-auto text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          {formatRelativeTime(run.started_at || run.updated_at)}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        {pagesCount !== null && (
                          <span>{pagesCount} page{pagesCount === 1 ? '' : 's'}</span>
                        )}
                        <span>•</span>
                        <span>{computeDuration(run)}</span>
                        {run.commit_sha && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                              {run.commit_sha.slice(0, 7)}
                            </span>
                          </>
                        )}
                      </div>

                      {isActive && stage && (
                        <p className="mt-2 text-[11px]" style={{ color: 'rgba(168,85,247,0.8)' }}>
                          {stage}
                          {typeof run.progress_percent === 'number' && ` — ${Math.round(run.progress_percent)}%`}
                        </p>
                      )}

                      {notes.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {notes.slice(0, 2).map((note, i) => (
                            <li
                              key={i}
                              className="text-[11px] leading-snug flex items-start gap-1.5"
                              style={{ color: 'rgba(255,255,255,0.5)' }}
                            >
                              <span
                                className="mt-[6px] w-1 h-1 rounded-full flex-shrink-0"
                                style={{ background: 'rgba(168,85,247,0.5)' }}
                              />
                              <span className="truncate">{note}</span>
                            </li>
                          ))}
                          {notes.length > 2 && (
                            <li className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                              +{notes.length - 2} more
                            </li>
                          )}
                        </ul>
                      )}

                      {run.error_message && status === 'failed' && (
                        <p className="mt-2 text-[11px]" style={{ color: 'rgba(252,165,165,0.8)' }}>
                          {run.error_message}
                        </p>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </aside>
    </>
  )
}
