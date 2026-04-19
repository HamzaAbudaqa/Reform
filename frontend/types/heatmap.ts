// Shared types for the heatmap feature. Mirrors backend/app/schemas/heatmap.py
// with camelCase at the API boundary.

export type HeatmapLayer = 'click' | 'move' | 'scroll' | 'rage'
export type HeatmapDevice = 'desktop' | 'tablet' | 'mobile' | 'all'
export type ViewportClass = 'desktop' | 'tablet' | 'mobile'

export interface HeatmapBucket {
  x: number   // 0..49
  y: number   // 0..49
  count: number
}

export interface HeatmapData {
  pageId: string
  layer: HeatmapLayer
  device: HeatmapDevice
  buckets: HeatmapBucket[]
  totalSessions: number
  totalEvents: number
  avgScrollDepthPct: number
  rageClickRate: number
}

// Persisted install state — mirrors the backend's HeatmapSite columns so the
// frontend can resume the right step after a refresh.
export type InstallStatus =
  | 'not_started'
  | 'awaiting_github_action'
  | 'manual_fallback'
  | 'tracking_live'
  | 'failed'

export type InstallMode = 'automatic' | 'manual' | null

export interface HeatmapSite {
  id: string
  projectId: string
  domain: string
  siteKey: string
  snippet: string
  verifiedAt: string | null
  lastEventAt: string | null
  firstEventAt: string | null
  createdAt: string
  installStatus: InstallStatus
  installMode: InstallMode
  installFramework: string | null
  installTargetFile: string | null
  installPrUrl: string | null
  installPrNumber: number | null
  installBranchName: string | null
  installError: string | null
  installAttemptedAt: string | null
}

export interface HeatmapPage {
  id: string
  path: string
  viewportClass: ViewportClass
  sessionCount: number
  lastSeenAt: string
  screenshotUrl: string
  pageHeightPx: number
}

export interface VerifyResult {
  reachable: boolean
  snippetDetected: boolean
  lastEventAt: string | null
  error: string | null
}

export const HEATMAP_GRID = 50

// ── API payload mappers ─────────────────────────────────────────────────

export function mapSite(raw: Record<string, unknown>): HeatmapSite {
  const status = String(raw.install_status ?? 'not_started') as InstallStatus
  const mode = raw.install_mode ? (String(raw.install_mode) as InstallMode) : null
  return {
    id: String(raw.id ?? ''),
    projectId: String(raw.project_id ?? ''),
    domain: String(raw.domain ?? ''),
    siteKey: String(raw.site_key ?? ''),
    snippet: String(raw.snippet ?? ''),
    verifiedAt: raw.verified_at ? String(raw.verified_at) : null,
    lastEventAt: raw.last_event_at ? String(raw.last_event_at) : null,
    firstEventAt: raw.first_event_at ? String(raw.first_event_at) : null,
    createdAt: String(raw.created_at ?? ''),
    installStatus: status,
    installMode: mode,
    installFramework: raw.install_framework ? String(raw.install_framework) : null,
    installTargetFile: raw.install_target_file ? String(raw.install_target_file) : null,
    installPrUrl: raw.install_pr_url ? String(raw.install_pr_url) : null,
    installPrNumber: raw.install_pr_number != null ? Number(raw.install_pr_number) : null,
    installBranchName: raw.install_branch_name ? String(raw.install_branch_name) : null,
    installError: raw.install_error ? String(raw.install_error) : null,
    installAttemptedAt: raw.install_attempted_at ? String(raw.install_attempted_at) : null,
  }
}

export function mapPage(raw: Record<string, unknown>): HeatmapPage {
  return {
    id: String(raw.id ?? ''),
    path: String(raw.path ?? ''),
    viewportClass: (raw.viewport_class as ViewportClass) ?? 'desktop',
    sessionCount: Number(raw.session_count ?? 0),
    lastSeenAt: String(raw.last_seen_at ?? ''),
    screenshotUrl: String(raw.screenshot_url ?? ''),
    pageHeightPx: Number(raw.page_height_px ?? 0),
  }
}

export function mapHeatmapData(raw: Record<string, unknown>): HeatmapData {
  return {
    pageId: String(raw.page_id ?? ''),
    layer: (raw.layer as HeatmapLayer) ?? 'click',
    device: (raw.device as HeatmapDevice) ?? 'all',
    buckets: Array.isArray(raw.buckets)
      ? (raw.buckets as Array<Record<string, unknown>>).map(b => ({
          x: Number(b.x ?? 0),
          y: Number(b.y ?? 0),
          count: Number(b.count ?? 0),
        }))
      : [],
    totalSessions: Number(raw.total_sessions ?? 0),
    totalEvents: Number(raw.total_events ?? 0),
    avgScrollDepthPct: Number(raw.avg_scroll_depth_pct ?? 0),
    rageClickRate: Number(raw.rage_click_rate ?? 0),
  }
}

export function mapVerify(raw: Record<string, unknown>): VerifyResult {
  return {
    reachable: Boolean(raw.reachable),
    snippetDetected: Boolean(raw.snippet_detected),
    lastEventAt: raw.last_event_at ? String(raw.last_event_at) : null,
    error: raw.error ? String(raw.error) : null,
  }
}

// ── Event summary (proof-of-life after tracking goes live) ─────────────

export interface EventSummary {
  hasEvents: boolean
  sessionCount: number
  firstEventAt: string | null
  latestEventAt: string | null
  latestViewportClass: 'desktop' | 'tablet' | 'mobile' | null
  latestBrowserLabel: string | null
}

export function mapEventSummary(raw: Record<string, unknown>): EventSummary {
  return {
    hasEvents: Boolean(raw.has_events),
    sessionCount: Number(raw.session_count ?? 0),
    firstEventAt: raw.first_event_at ? String(raw.first_event_at) : null,
    latestEventAt: raw.latest_event_at ? String(raw.latest_event_at) : null,
    latestViewportClass:
      (raw.latest_viewport_class as EventSummary['latestViewportClass']) ?? null,
    latestBrowserLabel: raw.latest_browser_label ? String(raw.latest_browser_label) : null,
  }
}

// ── AI insights & suggestions ───────────────────────────────────────────

export type InsightType = 'rage_click' | 'scroll_depth' | 'cta_prominence' | 'navigation'
export type ConfidenceLevel = 'low' | 'medium' | 'high'
export type SeverityLevel = 'low' | 'medium' | 'high'
export type SuggestionStatus = 'none' | 'staged' | 'rejected'
export type SuggestionChangeType =
  | 'make_clickable' | 'move_higher' | 'increase_contrast'
  | 'enlarge' | 'reposition' | 'simplify' | 'clarify_label'
  | 'shorten' | 'add_cta' | 'add_affordance'

export interface TargetRegion {
  x: number
  y: number
  width: number
  height: number
}

export interface Insight {
  id: string
  type: InsightType
  title: string
  summary: string
  evidence: string
  confidence: ConfidenceLevel
  severity: SeverityLevel
}

export interface Suggestion {
  id: string
  title: string
  description: string
  rationale: string
  confidence: ConfidenceLevel
  severity: SeverityLevel
  targetArea: string
  suggestedChangeType: SuggestionChangeType
  transformInstruction: string
  targetRegion: TargetRegion | null
  status: SuggestionStatus
}

export interface InsightsResponse {
  hasData: boolean
  stillCollecting: boolean
  sessionCount: number
  threshold: number
  pagePath: string
  generatedAt: string | null
  cached: boolean
  insights: Insight[]
  suggestions: Suggestion[]
  note: string
}

function mapSeverity(raw: unknown): SeverityLevel {
  const v = typeof raw === 'string' ? raw : ''
  return v === 'low' || v === 'high' ? v : 'medium'
}

function mapTargetRegion(raw: unknown): TargetRegion | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const x = Number(r.x)
  const y = Number(r.y)
  const width = Number(r.width)
  const height = Number(r.height)
  if (![x, y, width, height].every(Number.isFinite)) return null
  return { x, y, width, height }
}

function mapStatus(raw: unknown): SuggestionStatus {
  return raw === 'staged' || raw === 'rejected' ? raw : 'none'
}

export function mapInsight(raw: Record<string, unknown>): Insight {
  return {
    id: String(raw.id ?? ''),
    type: (raw.type as InsightType) ?? 'rage_click',
    title: String(raw.title ?? ''),
    summary: String(raw.summary ?? ''),
    evidence: String(raw.evidence ?? ''),
    confidence: (raw.confidence as ConfidenceLevel) ?? 'low',
    severity: mapSeverity(raw.severity),
  }
}

export function mapSuggestion(raw: Record<string, unknown>): Suggestion {
  return {
    id: String(raw.id ?? ''),
    title: String(raw.title ?? ''),
    description: String(raw.description ?? ''),
    rationale: String(raw.rationale ?? ''),
    confidence: (raw.confidence as ConfidenceLevel) ?? 'low',
    severity: mapSeverity(raw.severity),
    targetArea: String(raw.target_area ?? ''),
    suggestedChangeType: (raw.suggested_change_type as SuggestionChangeType) ?? 'simplify',
    transformInstruction: String(raw.transform_instruction ?? ''),
    targetRegion: mapTargetRegion(raw.target_region),
    status: mapStatus(raw.status),
  }
}

export function mapInsightsResponse(raw: Record<string, unknown>): InsightsResponse {
  return {
    hasData: Boolean(raw.has_data),
    stillCollecting: Boolean(raw.still_collecting),
    sessionCount: Number(raw.session_count ?? 0),
    threshold: Number(raw.threshold ?? 10),
    pagePath: String(raw.page_path ?? ''),
    generatedAt: raw.generated_at ? String(raw.generated_at) : null,
    cached: Boolean(raw.cached),
    insights: Array.isArray(raw.insights)
      ? (raw.insights as Array<Record<string, unknown>>).map(mapInsight)
      : [],
    suggestions: Array.isArray(raw.suggestions)
      ? (raw.suggestions as Array<Record<string, unknown>>).map(mapSuggestion)
      : [],
    note: String(raw.note ?? ''),
  }
}

// ── Auto-install (GitHub PR) ────────────────────────────────────────────

export interface AutoInstallResult {
  success: boolean
  prUrl: string
  prNumber: number
  branchName: string
  branchUrl: string
  targetFile: string
  framework: string
  error: string | null
  errorKind: string | null
}

export function mapAutoInstall(raw: Record<string, unknown>): AutoInstallResult {
  return {
    success: Boolean(raw.success),
    prUrl: String(raw.pr_url ?? ''),
    prNumber: Number(raw.pr_number ?? 0),
    branchName: String(raw.branch_name ?? ''),
    branchUrl: String(raw.branch_url ?? ''),
    targetFile: String(raw.target_file ?? ''),
    framework: String(raw.framework ?? ''),
    error: raw.error ? String(raw.error) : null,
    errorKind: raw.error_kind ? String(raw.error_kind) : null,
  }
}
