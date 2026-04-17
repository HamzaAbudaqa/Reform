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

export interface HeatmapSite {
  id: string
  projectId: string
  domain: string
  siteKey: string
  snippet: string
  verifiedAt: string | null
  lastEventAt: string | null
  createdAt: string
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
  return {
    id: String(raw.id ?? ''),
    projectId: String(raw.project_id ?? ''),
    domain: String(raw.domain ?? ''),
    siteKey: String(raw.site_key ?? ''),
    snippet: String(raw.snippet ?? ''),
    verifiedAt: raw.verified_at ? String(raw.verified_at) : null,
    lastEventAt: raw.last_event_at ? String(raw.last_event_at) : null,
    createdAt: String(raw.created_at ?? ''),
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
