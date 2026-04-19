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
  Suggestion,
} from '@/types/heatmap'
import { mapInsightsResponse } from '@/types/heatmap'

interface Props {
  pageId: string
  pagePath: string
  githubUserId: string
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

/**
 * Heatmap → AI insights → Apply changes.
 *
 * Generates evidence-based UX recommendations from the page's behavioral
 * data. The user picks which to apply, then we hand the chosen ones off
 * to the existing UI Transformation flow via sessionStorage.
 */
export default function AIRecommendations({ pageId, pagePath, githubUserId }: Props) {
  const router = useRouter()
  const [data, setData] = useState<InsightsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

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
      // Reset selection when we regenerate — the IDs changed, so old
      // selections wouldn't map onto the new suggestions anyway.
      setSelected(new Set())
    } catch (e) {
      setError(humanizeError(e, "We couldn't load recommendations."))
    } finally {
      setLoading(false)
    }
  }, [pageId, githubUserId])

  // Initial load when the selected page changes. We DON'T auto-regenerate
  // — the backend serves cached results unless ?regenerate=true, so this
  // is cheap and idempotent.
  useEffect(() => {
    fetchInsights(false)
  }, [fetchInsights])

  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectedSuggestions = useMemo<Suggestion[]>(() => {
    if (!data) return []
    return data.suggestions.filter(s => selected.has(s.id))
  }, [data, selected])

  const apply = useCallback(() => {
    if (!selectedSuggestions.length) return
    const handoff: HandoffSuggestion[] = selectedSuggestions.map(s => ({
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
  }, [selectedSuggestions, pagePath, router])

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

  if (data.suggestions.length === 0 && data.insights.length === 0) {
    return (
      <Section title="AI recommendations" subtitle="Based on how visitors are using this page">
        <div className="rounded-xl border border-black/[0.06] bg-neutral-50 p-4 flex items-center justify-between gap-3">
          <p className="text-[12.5px] text-neutral-600">
            {data.note || "No high-confidence recommendations yet — the patterns we see don't yet point to a specific issue."}
          </p>
          <button
            onClick={() => fetchInsights(true)}
            disabled={loading}
            className="rounded-full border border-black/[0.12] bg-white px-3 py-1 text-[11.5px] font-medium text-neutral-950 hover:bg-neutral-50 disabled:opacity-50"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </Section>
    )
  }

  return (
    <Section
      title="AI recommendations"
      subtitle="Based on how visitors are using this page"
      action={(
        <button
          onClick={() => fetchInsights(true)}
          disabled={loading}
          className="text-[11.5px] font-medium text-neutral-500 transition hover:text-neutral-950 disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : data.cached ? 'Regenerate' : 'Refresh'}
        </button>
      )}
    >
      {data.insights.length > 0 && (
        <div className="mb-5 flex flex-col gap-2">
          {data.insights.map(insight => (
            <InsightRow key={insight.id} insight={insight} />
          ))}
        </div>
      )}

      {data.suggestions.length > 0 && (
        <>
          <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
            Suggested changes ({data.suggestions.length})
          </p>
          <div className="flex flex-col gap-2.5">
            {data.suggestions.map(s => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                selected={selected.has(s.id)}
                onToggle={() => toggle(s.id)}
              />
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-black/[0.06] pt-4">
            <p className="text-[12px] text-neutral-500">
              {selectedSuggestions.length === 0
                ? 'Select one or more changes to apply.'
                : `${selectedSuggestions.length} change${selectedSuggestions.length === 1 ? '' : 's'} ready to apply.`}
            </p>
            <button
              onClick={apply}
              disabled={selectedSuggestions.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-neutral-950 px-5 py-2 text-[12.5px] font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
            >
              Apply selected changes
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        </>
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

function InsightRow({ insight }: { insight: Insight }) {
  const tone = CONFIDENCE_TONE[insight.confidence]
  return (
    <div className="rounded-xl border border-black/[0.06] bg-neutral-50 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
          {TYPE_LABEL[insight.type]}
        </span>
        <span className={`ml-auto text-[10px] font-medium ${tone.text}`} title={tone.label}>
          {insight.confidence}
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
  selected,
  onToggle,
}: {
  suggestion: Suggestion
  selected: boolean
  onToggle: () => void
}) {
  const tone = CONFIDENCE_TONE[suggestion.confidence]
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-4 transition hover:border-black/[0.18] ${
        selected ? 'border-neutral-950 bg-neutral-50/60 shadow-sm' : 'border-black/[0.07]'
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="mt-0.5 h-4 w-4 cursor-pointer accent-neutral-950"
        aria-label={`Select: ${suggestion.title}`}
      />
      <div className="flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[13.5px] font-semibold text-neutral-950">{suggestion.title}</h3>
          <span className={`flex items-center gap-1 text-[10px] font-medium ${tone.text}`} title={tone.label}>
            <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
            {suggestion.confidence}
          </span>
        </div>
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
    </label>
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
