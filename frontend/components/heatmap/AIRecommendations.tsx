'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiUrl } from '@/lib/api'
import {
  clearHeatmapHandoff,
  writeHeatmapHandoff,
  type HandoffSuggestion,
} from '@/lib/heatmapHandoff'
import { humanizeError, humanizeResponse } from '@/lib/humanizeError'
import type {
  ConfidenceLevel,
  Insight,
  InsightsResponse,
  SeverityLevel,
  Suggestion,
  SuggestionStatus,
} from '@/types/heatmap'
import { mapInsightsResponse, mapSuggestion } from '@/types/heatmap'

interface Props {
  pageId: string
  pagePath: string
  githubUserId: string
  onHoverRegion?: (sug: Suggestion | null) => void
}

const TYPE_LABEL: Record<Insight['type'], string> = {
  rage_click: 'Frustration',
  scroll_depth: 'Scroll reach',
  cta_prominence: 'CTA visibility',
  navigation: 'Navigation',
}

const CONFIDENCE_TONE: Record<ConfidenceLevel, { dot: string; text: string; label: string }> = {
  high:   { dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'High confidence' },
  medium: { dot: 'bg-amber-500',   text: 'text-amber-700',   label: 'Medium confidence' },
  low:    { dot: 'bg-neutral-400', text: 'text-neutral-500', label: 'Low confidence' },
}

// Severity is visually stronger than confidence because it drives the
// "how urgently should the user care" decision. Confidence is a
// qualifier on the observation; severity is the stakes.
const SEVERITY_STYLE: Record<SeverityLevel, { pill: string; label: string }> = {
  high:   { pill: 'bg-red-100 text-red-700 border-red-200',       label: 'High severity' },
  medium: { pill: 'bg-amber-100 text-amber-800 border-amber-200', label: 'Medium severity' },
  low:    { pill: 'bg-neutral-100 text-neutral-700 border-neutral-200', label: 'Low severity' },
}

/**
 * Heatmap → AI insights → Apply changes.
 *
 * Selection is persisted per-suggestion via
 * POST /api/heatmap/pages/{pageId}/suggestions/{sid}/status, so a page
 * refresh restores the user's staged picks. Each card also has a
 * regenerate button that calls the per-card magic wand endpoint —
 * useful when a single suggestion isn't compelling but the rest are.
 */
export default function AIRecommendations({ pageId, pagePath, githubUserId, onHoverRegion }: Props) {
  const router = useRouter()
  const [data, setData] = useState<InsightsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // One in-flight regenerate per card at most. Keyed by suggestion id.
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)

  const fetchInsights = useCallback(async (regenerate: boolean) => {
    setLoading(true)
    setError(null)
    try {
      const url = apiUrl(
        `/api/heatmap/pages/${pageId}/insights`
        + `?github_user_id=${encodeURIComponent(githubUserId)}`
        + (regenerate ? '&regenerate=true' : ''),
      )
      const res = await fetch(url, { method: 'POST' })
      if (!res.ok) throw new Error(await humanizeResponse(res, "We couldn't load recommendations."))
      const next = mapInsightsResponse(await res.json())
      setData(next)
    } catch (e) {
      setError(humanizeError(e, "We couldn't load recommendations."))
    } finally {
      setLoading(false)
    }
  }, [pageId, githubUserId])

  // Initial load when the selected page changes. Cached unless ?regenerate=true.
  useEffect(() => {
    fetchInsights(false)
  }, [fetchInsights])

  // Optimistic status mutation. Updates local state first, then POSTs — on
  // failure we surface the error but don't hard-revert, because the typical
  // cause is a transient network blip and the next load will reconcile.
  const setStatus = useCallback(async (sugId: string, next: SuggestionStatus) => {
    setData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        suggestions: prev.suggestions.map(s =>
          s.id === sugId ? { ...s, status: next } : s
        ),
      }
    })
    try {
      const res = await fetch(
        apiUrl(`/api/heatmap/pages/${pageId}/suggestions/${sugId}/status`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ github_user_id: githubUserId, status: next }),
        },
      )
      if (!res.ok) {
        setError(await humanizeResponse(res, "We couldn't save that change."))
      } else {
        setError(null)
      }
    } catch (e) {
      setError(humanizeError(e, "We couldn't save that change."))
    }
  }, [pageId, githubUserId])

  const regenerateOne = useCallback(async (sugId: string) => {
    setRegeneratingId(sugId)
    setError(null)
    try {
      const res = await fetch(
        apiUrl(`/api/heatmap/pages/${pageId}/insights/${sugId}/regenerate`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ github_user_id: githubUserId }),
        },
      )
      if (!res.ok) throw new Error(await humanizeResponse(res, "We couldn't regenerate that suggestion."))
      const raw = await res.json() as { suggestions?: Array<Record<string, unknown>> }
      const nextSuggestions = Array.isArray(raw.suggestions) ? raw.suggestions.map(mapSuggestion) : []
      setData(prev => (prev ? { ...prev, suggestions: nextSuggestions } : prev))
    } catch (e) {
      setError(humanizeError(e, "We couldn't regenerate that suggestion."))
    } finally {
      setRegeneratingId(null)
    }
  }, [pageId, githubUserId])

  const visibleSuggestions = useMemo(() => {
    // Rejected cards are filtered out of the main list — they're still in
    // state (so "Restore rejected" could unhide them) but don't clutter
    // the panel.
    if (!data) return []
    return data.suggestions.filter(s => s.status !== 'rejected')
  }, [data])

  const rejectedCount = useMemo(
    () => (data?.suggestions ?? []).filter(s => s.status === 'rejected').length,
    [data],
  )

  const stagedSuggestions = useMemo<Suggestion[]>(
    () => visibleSuggestions.filter(s => s.status === 'staged'),
    [visibleSuggestions],
  )

  const apply = useCallback(() => {
    if (!stagedSuggestions.length) return
    const handoff: HandoffSuggestion[] = stagedSuggestions.map(s => ({
      id: s.id,
      title: s.title,
      transformInstruction: s.transformInstruction,
      sourcePagePath: pagePath,
    }))
    clearHeatmapHandoff()
    writeHeatmapHandoff({
      pickedAt: new Date().toISOString(),
      pagePath,
      suggestions: handoff,
    })
    router.push('/dashboard/transform')
  }, [stagedSuggestions, pagePath, router])

  const restoreRejected = useCallback(() => {
    if (!data) return
    // Reset every rejected card back to "none" in parallel. We don't
    // batch into one API call — the overlay endpoint is one row at a
    // time and the common case is 0-2 rejected cards.
    data.suggestions
      .filter(s => s.status === 'rejected')
      .forEach(s => { void setStatus(s.id, 'none') })
  }, [data, setStatus])

  // ── Render branches ─────────────────────────────────────────────────

  if (loading && !data) {
    return (
      <Section title="AI recommendations" subtitle="Reading the heatmap…">
        <div className="flex items-center gap-2 text-[12px] text-neutral-500">
          <Spinner /> Analyzing visitor behavior on {pagePath}…
        </div>
      </Section>
    )
  }

  if (error && !data) {
    return (
      <Section title="AI recommendations">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] text-amber-700">
            We couldn&apos;t load recommendations. {error}
          </p>
          <button
            onClick={() => fetchInsights(false)}
            className="rounded-full border border-black/[0.12] bg-white px-3 py-1 text-[11.5px] font-medium text-neutral-950 hover:bg-neutral-50"
          >
            Try again
          </button>
        </div>
      </Section>
    )
  }

  if (!data) return null

  if (data.stillCollecting) {
    return (
      <Section title="AI recommendations" subtitle="Based on how visitors are using this page">
        <div className="rounded-xl border border-black/[0.06] bg-neutral-50 p-4">
          <p className="text-[13px] font-semibold text-neutral-950">
            We&apos;re still collecting enough visitor data to generate confident recommendations.
          </p>
          <p className="mt-1 text-[12px] text-neutral-500">
            Currently {data.sessionCount} of {data.threshold} sessions. Come back once a few more
            visitors have hit your site, and we&apos;ll surface specific UX issues with concrete
            suggestions tied to how they actually use the page.
          </p>
        </div>
      </Section>
    )
  }

  if (visibleSuggestions.length === 0 && data.insights.length === 0) {
    return (
      <Section title="AI recommendations" subtitle="Based on how visitors are using this page">
        <div className="rounded-xl border border-black/[0.06] bg-neutral-50 p-4 flex items-center justify-between gap-3">
          <p className="text-[12.5px] text-neutral-600">
            {rejectedCount > 0
              ? `All ${rejectedCount} suggestion${rejectedCount === 1 ? '' : 's'} rejected.`
              : data.note || "No high-confidence recommendations yet — the patterns we see don't yet point to a specific issue."}
          </p>
          <div className="flex gap-2">
            {rejectedCount > 0 && (
              <button
                onClick={restoreRejected}
                className="rounded-full border border-black/[0.12] bg-white px-3 py-1 text-[11.5px] font-medium text-neutral-950 hover:bg-neutral-50"
              >
                Restore rejected
              </button>
            )}
            <button
              onClick={() => fetchInsights(true)}
              disabled={loading}
              className="rounded-full border border-black/[0.12] bg-white px-3 py-1 text-[11.5px] font-medium text-neutral-950 hover:bg-neutral-50 disabled:opacity-50"
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
      </Section>
    )
  }

  return (
    <Section
      title="AI recommendations"
      subtitle="Based on how visitors are using this page"
      action={(
        <div className="flex items-center gap-3">
          {rejectedCount > 0 && (
            <button
              onClick={restoreRejected}
              className="text-[11.5px] font-medium text-neutral-500 transition hover:text-neutral-950"
            >
              Restore {rejectedCount} rejected
            </button>
          )}
          <button
            onClick={() => fetchInsights(true)}
            disabled={loading}
            className="text-[11.5px] font-medium text-neutral-500 transition hover:text-neutral-950 disabled:opacity-50"
          >
            {loading ? 'Refreshing…' : data.cached ? 'Regenerate all' : 'Refresh'}
          </button>
        </div>
      )}
    >
      {data.insights.length > 0 && (
        <div className="mb-5 flex flex-col gap-2">
          {data.insights.map(insight => (
            <InsightRow key={insight.id} insight={insight} />
          ))}
        </div>
      )}

      {visibleSuggestions.length > 0 && (
        <>
          <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
            Suggested changes ({visibleSuggestions.length})
          </p>
          <div className="flex flex-col gap-2.5">
            {visibleSuggestions.map(s => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                regenerating={regeneratingId === s.id}
                onStage={() => setStatus(s.id, s.status === 'staged' ? 'none' : 'staged')}
                onReject={() => setStatus(s.id, 'rejected')}
                onRegenerate={() => regenerateOne(s.id)}
                onHover={(hover) => onHoverRegion?.(hover ? s : null)}
              />
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-black/[0.06] pt-4">
            <p className="text-[12px] text-neutral-500">
              {stagedSuggestions.length === 0
                ? 'Stage one or more changes to apply.'
                : `${stagedSuggestions.length} change${stagedSuggestions.length === 1 ? '' : 's'} staged.`}
            </p>
            <button
              onClick={apply}
              disabled={stagedSuggestions.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-neutral-950 px-5 py-2 text-[12.5px] font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
            >
              Apply staged changes
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        </>
      )}

      {error && (
        <p className="mt-3 text-[11.5px] text-amber-700">{error}</p>
      )}

      {data.note && (
        <p className="mt-4 text-[11px] text-neutral-400">{data.note}</p>
      )}
    </Section>
  )
}

// ── Sub-components ────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  action,
  children,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="mt-8 rounded-[22px] border border-black/[0.07] bg-white p-6">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
            {title}
          </p>
          {subtitle && (
            <h2 className="mt-1 text-[16px] font-semibold text-neutral-950">{subtitle}</h2>
          )}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

function SeverityBadge({ severity }: { severity: SeverityLevel }) {
  const tone = SEVERITY_STYLE[severity]
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone.pill}`}
      title={tone.label}
    >
      {severity} severity
    </span>
  )
}

function InsightRow({ insight }: { insight: Insight }) {
  const conf = CONFIDENCE_TONE[insight.confidence]
  return (
    <div className="rounded-xl border border-black/[0.06] bg-neutral-50 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${conf.dot}`} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
          {TYPE_LABEL[insight.type]}
        </span>
        <span className="ml-auto flex items-center gap-2">
          <SeverityBadge severity={insight.severity} />
          <span className={`text-[10px] font-medium ${conf.text}`} title={conf.label}>
            {insight.confidence}
          </span>
        </span>
      </div>
      <p className="mt-1.5 text-[13px] font-semibold text-neutral-950">{insight.title}</p>
      <p className="mt-0.5 text-[12px] text-neutral-600">{insight.summary}</p>
      <p className="mt-1.5 text-[11.5px] text-neutral-500">
        <span className="font-semibold text-neutral-700">Evidence:</span> {insight.evidence}
      </p>
    </div>
  )
}

function SuggestionCard({
  suggestion,
  regenerating,
  onStage,
  onReject,
  onRegenerate,
  onHover,
}: {
  suggestion: Suggestion
  regenerating: boolean
  onStage: () => void
  onReject: () => void
  onRegenerate: () => void
  onHover: (hover: boolean) => void
}) {
  const conf = CONFIDENCE_TONE[suggestion.confidence]
  const staged = suggestion.status === 'staged'
  return (
    <div
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={`rounded-xl border bg-white p-4 transition ${
        staged ? 'border-neutral-950 bg-neutral-50/60 shadow-sm' : 'border-black/[0.07] hover:border-black/[0.18]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={suggestion.severity} />
            <span className={`flex items-center gap-1 text-[10px] font-medium ${conf.text}`} title={conf.label}>
              <span className={`h-1.5 w-1.5 rounded-full ${conf.dot}`} />
              {suggestion.confidence} confidence
            </span>
          </div>
          <h3 className="mt-1.5 text-[13.5px] font-semibold text-neutral-950">{suggestion.title}</h3>
          <p className="mt-1 text-[12px] text-neutral-600">{suggestion.description}</p>
          <p className="mt-2 text-[11.5px] text-neutral-500">
            <span className="font-semibold text-neutral-700">Why:</span> {suggestion.rationale}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-700">
              {suggestion.targetArea}
            </span>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
              {suggestion.suggestedChangeType.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-black/[0.04] pt-3">
        <button
          onClick={onStage}
          className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-[11.5px] font-semibold transition ${
            staged
              ? 'bg-neutral-950 text-white hover:bg-neutral-800'
              : 'border border-black/[0.12] bg-white text-neutral-950 hover:bg-neutral-50'
          }`}
        >
          {staged ? 'Staged' : 'Stage'}
        </button>
        <button
          onClick={onReject}
          className="inline-flex items-center justify-center rounded-full border border-black/[0.12] bg-white px-3 py-1 text-[11.5px] font-medium text-neutral-600 transition hover:text-neutral-950 hover:bg-neutral-50"
        >
          Reject
        </button>
        <button
          onClick={onRegenerate}
          disabled={regenerating}
          title="Ask for an alternative strategy"
          className="ml-auto inline-flex items-center justify-center gap-1 rounded-full border border-black/[0.12] bg-white px-3 py-1 text-[11.5px] font-medium text-neutral-600 transition hover:text-neutral-950 hover:bg-neutral-50 disabled:opacity-50"
        >
          {regenerating ? <Spinner /> : <WandIcon />}
          {regenerating ? 'Rethinking…' : 'Magic wand'}
        </button>
      </div>
    </div>
  )
}

function WandIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 4V2" />
      <path d="M15 16v-2" />
      <path d="M8 9h2" />
      <path d="M20 9h2" />
      <path d="M17.8 11.8 19 13" />
      <path d="M15 9h0" />
      <path d="M17.8 6.2 19 5" />
      <path d="m3 21 9-9" />
      <path d="M12.2 6.2 11 5" />
    </svg>
  )
}

function Spinner() {
  return (
    <span
      className="inline-block h-3 w-3 rounded-full border-2 border-neutral-300 border-t-neutral-700"
      style={{ animation: 'spin 0.9s linear infinite' }}
    />
  )
}
