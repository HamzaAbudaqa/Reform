'use client'

import { useCallback } from 'react'
import type { Finding } from '@/types/uxlab'

/**
 * FindingsSidebar — vertical panel variant of the legacy bottom FindingsShelf.
 *
 * Contract matches the subset of FindingsShelf props that the UX Lab page uses,
 * so the two can be swapped without restructuring state.
 */
interface FindingsSidebarProps {
  findings: Finding[]
  activeFindingId: string | null
  setActiveFindingId: (id: string | null) => void
  selectedFindingIds: Set<string>
  onToggleSelection: (id: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
  onApplySelected: () => void
  onRevertFinding: (id: string) => void
  onScrollToAnnotation: (id: string) => void
  status?: 'idle' | 'loading' | 'error' | 'ready'
  statusMessage?: string
}

function typeLabel(type: string): string {
  switch (type) {
    case 'ISSUE':    return 'Issue'
    case 'WARNING':  return 'Warning'
    case 'POSITIVE': return 'Positive'
    default:         return type
  }
}

function typeColor(type: string): string {
  switch (type) {
    case 'ISSUE':    return '#ef4444'
    case 'WARNING':  return '#f59e0b'
    case 'POSITIVE': return '#22c55e'
    default:         return '#737373'
  }
}

export default function FindingsSidebar({
  findings,
  activeFindingId,
  setActiveFindingId,
  selectedFindingIds,
  onToggleSelection,
  onSelectAll,
  onDeselectAll,
  onApplySelected,
  onRevertFinding,
  onScrollToAnnotation,
  status = 'ready',
  statusMessage,
}: FindingsSidebarProps) {
  const isEmpty = findings.length === 0
  const queuedCount  = findings.filter((f) => f.status === 'queued').length
  const patchedCount = findings.filter((f) => f.status === 'patched').length
  const anySelected  = selectedFindingIds.size > 0
  const openCount    = findings.filter((f) => f.status === 'open').length

  const emptyStateTitle =
    status === 'loading' ? 'Preparing findings'
    : status === 'error' ? 'Analysis needs another pass'
    : 'This shelf is ready for UX review'

  const emptyStateBody = statusMessage ?? (
    status === 'loading'
      ? 'We are scanning this screen now. Findings, principles, and recommendations will appear here as soon as the analysis completes.'
      : status === 'error'
        ? 'This screen did not return findings. Try rerunning the analysis or switching to another route.'
        : 'Run a UX analysis to populate this sidebar with prioritized findings, rationale, and recommended changes.'
  )

  const activeIdx = findings.findIndex((f) => f.id === activeFindingId)
  const activeFinding = activeIdx >= 0 ? findings[activeIdx] : null

  const handleRowClick = useCallback((id: string) => {
    setActiveFindingId(id)
    onScrollToAnnotation(id)
  }, [setActiveFindingId, onScrollToAnnotation])

  const goToIndex = useCallback((nextIdx: number) => {
    if (findings.length === 0) return
    const wrapped = ((nextIdx % findings.length) + findings.length) % findings.length
    const target = findings[wrapped]
    setActiveFindingId(target.id)
    onScrollToAnnotation(target.id)
  }, [findings, setActiveFindingId, onScrollToAnnotation])

  const goPrev = useCallback(() => {
    goToIndex((activeIdx < 0 ? 0 : activeIdx) - 1)
  }, [activeIdx, goToIndex])

  const goNext = useCallback(() => {
    goToIndex((activeIdx < 0 ? -1 : activeIdx) + 1)
  }, [activeIdx, goToIndex])

  return (
    <aside className="flex h-full min-h-0 flex-col bg-neutral-50">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-black/[0.06] px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">Findings</div>
          {!isEmpty && (
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11px] text-neutral-400">{findings.length}</span>
              {queuedCount > 0 && (
                <span className="rounded-full border border-black/[0.1] bg-white px-2 py-0.5 font-mono text-[10px] text-neutral-700">
                  {queuedCount} staged
                </span>
              )}
              {patchedCount > 0 && (
                <span className="rounded-full border border-emerald-500/20 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] text-emerald-700">
                  {patchedCount} patched
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Empty state */}
      {isEmpty ? (
        <div className="flex-1 overflow-y-auto px-5 py-6">
          <div className="rounded-[18px] border border-black/[0.06] bg-white p-5">
            <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-neutral-500">
              {status === 'loading' ? 'Analyzing' : status === 'error' ? 'Attention' : 'Idle'}
            </div>
            <h3 className="text-[17px] font-semibold leading-[1.3] tracking-[-0.02em] text-neutral-950">
              {emptyStateTitle}
            </h3>
            <p className="mt-2.5 text-[13px] leading-[1.6] text-neutral-500">
              {emptyStateBody}
            </p>
          </div>

          {status !== 'error' && (
            <div className="mt-5 space-y-2">
              {['Primary friction point', 'Hierarchy issue', 'Recommendation preview'].map((label) => (
                <div key={label} className="flex items-center gap-2.5 rounded-[14px] border border-dashed border-black/[0.07] bg-white/60 px-3.5 py-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-black/[0.12]" />
                  <span className="truncate text-[12px] text-neutral-400">{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Active finding detail */}
          {activeFinding && (
            <div className="flex-shrink-0 border-b border-black/[0.06] bg-white px-5 py-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]"
                    style={{ background: `${typeColor(activeFinding.type)}1A`, color: typeColor(activeFinding.type) }}
                  >
                    {typeLabel(activeFinding.type)}
                  </span>
                  {activeFinding.component && (
                    <span className="truncate font-mono text-[10px] text-neutral-400">{activeFinding.component}</span>
                  )}
                </div>
                {findings.length > 1 && (
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <button
                      onClick={goPrev}
                      aria-label="Previous finding"
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-black/[0.08] bg-white text-neutral-600 transition-colors hover:border-black/[0.2] hover:text-neutral-950"
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M6.5 2L3.5 5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <span className="font-mono text-[10px] tabular-nums text-neutral-500">
                      {activeIdx + 1} / {findings.length}
                    </span>
                    <button
                      onClick={goNext}
                      aria-label="Next finding"
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-black/[0.08] bg-white text-neutral-600 transition-colors hover:border-black/[0.2] hover:text-neutral-950"
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M3.5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => onScrollToAnnotation(activeFinding.id)}
                className="flex items-baseline gap-2 text-left text-[15px] font-semibold leading-[1.35] tracking-[-0.01em] text-neutral-950 transition-colors hover:text-neutral-600"
                title="Reveal on preview"
              >
                <span className="font-mono text-[13px] text-neutral-400">{activeIdx + 1})</span>
                <span>{activeFinding.title}</span>
              </button>
              {activeFinding.description && (
                <p className="mt-2 text-[12.5px] leading-[1.6] text-neutral-500">{activeFinding.description}</p>
              )}
              {activeFinding.principle && (
                <div className="mt-3 rounded-[10px] border-l-2 border-neutral-950 bg-neutral-100 px-3 py-2">
                  <div className="text-[11px] font-semibold text-neutral-950">{activeFinding.principle}</div>
                  {activeFinding.principleExplanation && (
                    <div className="mt-0.5 text-[11px] leading-[1.5] text-neutral-500">
                      {activeFinding.principleExplanation}
                    </div>
                  )}
                </div>
              )}
              {activeFinding.recommendation && (
                <div className="mt-3">
                  <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                    Recommendation
                  </div>
                  <div className="text-[12px] leading-[1.6] text-neutral-700">{activeFinding.recommendation}</div>
                </div>
              )}
            </div>
          )}

          {/* Action bar */}
          <div className="flex-shrink-0 flex items-center justify-between gap-3 border-b border-black/[0.06] bg-neutral-50 px-5 py-3">
            <div className="flex items-center gap-3">
              <button
                onClick={anySelected ? onDeselectAll : onSelectAll}
                disabled={openCount === 0 && !anySelected}
                className="text-[11px] font-medium text-neutral-600 transition-colors hover:text-neutral-950 disabled:cursor-not-allowed disabled:text-neutral-300"
              >
                {anySelected ? `Deselect all (${selectedFindingIds.size})` : 'Select all'}
              </button>
              {activeFinding && activeFinding.status === 'open' && (
                <>
                  <span className="h-3 w-px bg-black/[0.1]" aria-hidden />
                  {selectedFindingIds.has(activeFinding.id) ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Selected
                    </span>
                  ) : (
                    <button
                      onClick={() => onToggleSelection(activeFinding.id)}
                      className="text-[11px] font-medium text-neutral-600 transition-colors hover:text-neutral-950"
                    >
                      Select this
                    </button>
                  )}
                </>
              )}
            </div>
            <button
              onClick={onApplySelected}
              disabled={!anySelected}
              className="inline-flex items-center gap-1.5 rounded-full bg-neutral-950 px-3.5 py-1.5 text-[11px] font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
            >
              {anySelected ? `Apply (${selectedFindingIds.size})` : 'Apply selected'}
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            <ul>
              {findings.map((finding, i) => {
                const isActive = finding.id === activeFindingId
                const isSelected = selectedFindingIds.has(finding.id)
                return (
                  <li
                    key={finding.id}
                    onClick={() => handleRowClick(finding.id)}
                    className="group flex cursor-pointer items-start gap-3 px-5 py-3.5 transition-colors hover:bg-white"
                    style={{
                      background: isActive ? '#ffffff' : 'transparent',
                      borderBottom: '1px solid rgba(0,0,0,0.04)',
                      boxShadow: isActive ? 'inset 2px 0 0 0 #0a0a0a' : 'none',
                    }}
                  >
                    <span className="mt-[2px] flex-shrink-0 font-mono text-[11px] font-medium text-neutral-400 tabular-nums">
                      {i + 1})
                    </span>

                    <span
                      className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full"
                      style={{ background: typeColor(finding.type) }}
                      aria-label={typeLabel(finding.type)}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-medium leading-[1.4] text-neutral-950 line-clamp-2">
                        {finding.title}
                      </div>
                      {finding.principle && (
                        <div className="mt-1 text-[10.5px] text-neutral-400">{finding.principle}</div>
                      )}
                    </div>

                    <div className="flex flex-shrink-0 items-center gap-1.5">
                      {finding.status === 'queued' ? (
                        <>
                          <span className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-neutral-700">
                            Staged
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); onRevertFinding(finding.id) }}
                            className="flex h-4 w-4 items-center justify-center rounded text-neutral-400 transition-colors hover:bg-black/[0.05] hover:text-neutral-950"
                            aria-label="Undo queue"
                          >×</button>
                        </>
                      ) : finding.status === 'patched' ? (
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-emerald-700">
                          Patched
                        </span>
                      ) : finding.status === 'dismissed' ? (
                        <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-neutral-400">
                          Dismissed
                        </span>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); onToggleSelection(finding.id) }}
                          aria-label={isSelected ? 'Deselect finding' : 'Select finding'}
                          className="flex h-[16px] w-[16px] items-center justify-center rounded transition-colors"
                          style={{
                            border: isSelected ? 'none' : '1.5px solid rgba(0,0,0,0.18)',
                            background: isSelected ? '#0a0a0a' : 'transparent',
                          }}
                        >
                          {isSelected && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <path d="M2 5l2.5 2.5L8 3" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      )}
    </aside>
  )
}
