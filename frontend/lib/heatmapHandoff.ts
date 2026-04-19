/**
 * Session-storage handoff between the Heatmap page and the UI Transformation
 * page. When the user picks suggestions on the Heatmap page and clicks
 * "Apply selected changes", we stash the chosen suggestions here and
 * navigate to /dashboard/transform. The Transform page reads + clears
 * this on mount and pre-fills its user_intent input from it.
 *
 * Lives in sessionStorage on purpose: per-tab, ephemeral, and the user
 * can't accidentally re-trigger an apply from a stale state on a refresh
 * because they have to actively click Apply again.
 */

const STORAGE_KEY = 'refineui_heatmap_suggestions'

export interface HandoffSuggestion {
  id: string
  title: string
  /** The transform-engine instruction we want to feed in. */
  transformInstruction: string
  /** "Current design", page label or path — surfaced in the banner. */
  sourcePagePath: string
}

export interface HeatmapHandoff {
  pickedAt: string
  pagePath: string
  suggestions: HandoffSuggestion[]
}

export function writeHeatmapHandoff(handoff: HeatmapHandoff): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(handoff))
  } catch {
    /* ignore — quota exceeded etc., handoff is best-effort */
  }
}

export function readHeatmapHandoff(): HeatmapHandoff | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as HeatmapHandoff
    if (!parsed?.suggestions?.length) return null
    return parsed
  } catch {
    return null
  }
}

export function clearHeatmapHandoff(): void {
  if (typeof window === 'undefined') return
  try { sessionStorage.removeItem(STORAGE_KEY) } catch { /* noop */ }
}

/**
 * Compose a single user_intent string the Transform page can submit
 * directly to the pipeline. Numbered list with the original titles
 * preserved so the user sees what was carried over.
 */
export function suggestionsToIntent(suggestions: HandoffSuggestion[]): string {
  if (!suggestions.length) return ''
  const lines = suggestions.map((s, i) => `${i + 1}. ${s.transformInstruction}`)
  return [
    'Apply these UX improvements identified from real visitor behavior on the heatmap:',
    ...lines,
  ].join('\n')
}
