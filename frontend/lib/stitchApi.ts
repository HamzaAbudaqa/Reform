/**
 * Client for the Stitch design-reference endpoints.
 * Keeps the edit-lab integration thin — just POST /stitch/ingest with typed
 * request/response and a shaped error class so callers can surface backend
 * detail messages (allowlist rejection, feature-flag off, Anthropic errors).
 */

import { apiUrl } from './api'

export interface StitchDesignTokens {
  theme: string
  palette: Record<string, string>
  typography_tone: string
  spacing_rhythm: string
  border_radius: string
}

export interface StitchPatterns {
  layout_patterns: string[]
  cta_hierarchy: string
  spacing_rhythm: string
  card_style: string
  typography_tone: string
  component_patterns: string[]
}

export interface StitchDesign {
  url: string
  label: string
  screenshot_key: string
  screenshot_url: string
  summary: string
  design_tokens: StitchDesignTokens
  patterns: StitchPatterns
  error: string
  cached: boolean
}

export interface StitchIngestResponse {
  designs: StitchDesign[]
}

export class StitchApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'StitchApiError'
    this.status = status
  }
}

export const STITCH_MAX_URLS = 5

export async function ingestStitchUrls(
  urls: string[],
  label = '',
  signal?: AbortSignal,
): Promise<StitchIngestResponse> {
  const res = await fetch(apiUrl('/stitch/ingest'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls, label }),
    signal,
  })

  if (!res.ok) {
    let detail = `Request failed (${res.status})`
    try {
      const data = await res.json()
      if (typeof data?.detail === 'string' && data.detail) {
        detail = data.detail
      }
    } catch {
      /* non-JSON body — fall back to status-based message */
    }
    throw new StitchApiError(res.status, detail)
  }

  const data = (await res.json()) as StitchIngestResponse
  return { designs: Array.isArray(data.designs) ? data.designs : [] }
}
