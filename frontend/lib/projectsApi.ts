/**
 * Typed fetchers for the /projects backend surface.
 *
 * Kept narrow on purpose — we only model the fields the UI consumes and
 * never the full backend row. New optional fields (mode, progress,
 * transformation notes) default to null/empty so callers can safely read
 * them even when the backend hasn't deployed the contract yet.
 */

import { apiUrl } from './api'

export type RunMode = 'stable' | 'explore'

export type RunStatus =
  | 'in_progress'
  | 'running' // legacy alias returned by older runs
  | 'completed'
  | 'complete' // legacy alias
  | 'failed'
  | 'published'

export interface TransformRunSummary {
  id: string
  status: RunStatus | null
  mode: RunMode | null
  current_stage: string | null
  progress_percent: number | null
  transformation_notes: string[] | null
  commit_sha: string | null
  started_at: string | null
  updated_at: string | null
  error_message: string | null
  // Present on the /projects list summary but not always in individual run fetches.
  total_transformed?: number | null
  total_pages_found?: number | null
}

export interface ProjectSummary {
  id: string
  repo_name: string
  repo_url: string
  branch: string
  created_at: string
  updated_at: string
  latest_run_status: RunStatus | null
  total_runs: number
  // The fields below are additive — backend may or may not return them.
  latest_run?: TransformRunSummary | null
  latest_after_screenshot?: string | null
  latest_mode?: RunMode | null
  latest_transformation_notes?: string[] | null
  latest_pages_transformed?: number | null
}

export interface ActiveRunResponse {
  run_id: string
  status: RunStatus
  current_stage: string | null
  progress_percent: number | null
  mode: RunMode | null
  started_at: string | null
  commit_sha: string | null
}

export interface RunProgressResponse {
  status: RunStatus
  current_stage: string | null
  progress_percent: number | null
  transformation_notes: string[] | null
  error_message: string | null
}

/** Canonicalise legacy status values so the UI only branches on 4 states. */
export function normalizeStatus(status: RunStatus | string | null | undefined): RunStatus | null {
  if (!status) return null
  if (status === 'running') return 'in_progress'
  if (status === 'complete') return 'completed'
  return status as RunStatus
}

export function isTerminalStatus(status: RunStatus | string | null | undefined): boolean {
  const s = normalizeStatus(status)
  return s === 'completed' || s === 'failed' || s === 'published'
}

export async function fetchProjects(githubUserId: string, signal?: AbortSignal): Promise<ProjectSummary[]> {
  const res = await fetch(apiUrl(`/projects?github_user_id=${encodeURIComponent(githubUserId)}`), { signal })
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? (data as ProjectSummary[]) : []
}

export async function fetchProjectRuns(projectId: string, signal?: AbortSignal): Promise<TransformRunSummary[]> {
  const res = await fetch(apiUrl(`/projects/${projectId}/runs`), { signal })
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? (data as TransformRunSummary[]) : []
}

/** 404-safe wrapper — returns null if there's no active run. */
export async function fetchActiveRun(projectId: string, signal?: AbortSignal): Promise<ActiveRunResponse | null> {
  try {
    const res = await fetch(apiUrl(`/projects/${projectId}/active-run`), { signal })
    if (res.status === 404) return null
    if (!res.ok) return null
    return (await res.json()) as ActiveRunResponse
  } catch {
    return null
  }
}

export async function fetchRunProgress(runId: string, signal?: AbortSignal): Promise<RunProgressResponse | null> {
  try {
    const res = await fetch(apiUrl(`/projects/runs/${runId}/progress`), { signal })
    if (!res.ok) return null
    return (await res.json()) as RunProgressResponse
  } catch {
    return null
  }
}

/** Formats an ISO timestamp to a relative ("2h ago") string. */
export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Date.now() - then
  if (diff < 0) return 'just now'
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  const week = Math.floor(day / 7)
  if (week < 5) return `${week}w ago`
  const month = Math.floor(day / 30)
  if (month < 12) return `${month}mo ago`
  const year = Math.floor(day / 365)
  return `${year}y ago`
}

/** Human label for a stage key returned by the backend. */
const STAGE_LABELS: Record<string, string> = {
  cloning: 'Cloning repo',
  ingesting: 'Cloning repo',
  clone: 'Cloning repo',
  discovering: 'Finding pages',
  discover: 'Finding pages',
  evaluating: 'Scoring pages',
  evaluate: 'Scoring pages',
  planning: 'Planning rebuild',
  plan: 'Planning rebuild',
  transforming: 'Rebuilding pages',
  rebuild: 'Rebuilding pages',
  rendering: 'Rendering previews',
  render: 'Rendering previews',
  saving: 'Saving results',
}

export function stageLabel(stage: string | null | undefined): string {
  if (!stage) return 'Starting up'
  const key = stage.toLowerCase().trim()
  return STAGE_LABELS[key] || stage.charAt(0).toUpperCase() + stage.slice(1)
}
