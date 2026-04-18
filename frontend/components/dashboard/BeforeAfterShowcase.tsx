'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import MagicWandEditor from './MagicWandEditor'

type ViewMode = 'toggle' | 'split' | 'before' | 'after'

function resolveImgSrc(raw: string) {
  return raw.startsWith('http://') || raw.startsWith('https://')
    ? raw
    : `data:image/png;base64,${raw}`
}

// Defined at module scope so React keeps the same component identity
// across re-renders of the parent BeforeAfterShowcase — critical so that
// MagicWandEditor's edit-mode state (and its Edit Lab session) survives
// carousel tab switches and other parent prop changes.
function ToggleView({
  effectiveBefore,
  effectiveAfter,
  pageName,
  route,
  afterPulse,
  canEdit,
  editDisabledReason,
  repoUrl,
  repoBranch,
  onAfterScreenshotChange,
  overlayFiles,
}: {
  effectiveBefore: string
  effectiveAfter: string
  pageName: string
  route?: string
  afterPulse: boolean
  canEdit: boolean
  editDisabledReason?: string
  repoUrl: string | null
  repoBranch: string | null
  onAfterScreenshotChange?: (next: string) => void
  overlayFiles?: Record<string, string> | null
}) {
  const [showAfter, setShowAfter] = useState(true)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-center">
        <div
          className="relative inline-flex items-center p-1 rounded-full"
          style={{
            background: 'rgba(0,0,0,0.05)',
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          <div
            className="absolute top-1 bottom-1 rounded-full"
            style={{
              left: 4,
              width: 'calc(50% - 4px)',
              background: showAfter
                ? 'linear-gradient(135deg, #0a0a0a, #1a1a1a)'
                : '#ffffff',
              border: showAfter ? 'none' : '1px solid rgba(0,0,0,0.08)',
              transform: showAfter ? 'translateX(100%)' : 'translateX(0)',
              transition: 'transform 280ms cubic-bezier(0.22,1,0.36,1), background 280ms ease',
              boxShadow: showAfter
                ? '0 4px 14px rgba(0,0,0,0.25)'
                : '0 1px 3px rgba(0,0,0,0.08)',
            }}
          />
          <button
            type="button"
            onClick={() => setShowAfter(false)}
            className="relative z-[1] px-7 py-2 text-[12px] font-semibold uppercase tracking-[0.1em] transition-colors duration-200"
            style={{ color: !showAfter ? '#0a0a0a' : 'rgba(0,0,0,0.45)' }}
          >
            Before
          </button>
          <button
            type="button"
            onClick={() => setShowAfter(true)}
            className="relative z-[1] px-7 py-2 text-[12px] font-semibold uppercase tracking-[0.1em] transition-colors duration-200"
            style={{ color: showAfter ? '#ffffff' : 'rgba(0,0,0,0.45)' }}
          >
            After
          </button>
        </div>
      </div>

      <div
        className={`rounded-2xl overflow-hidden${afterPulse && showAfter ? ' ring-2 ring-green-400/40' : ''}`}
        style={{
          border: '1px solid rgba(0,0,0,0.18)',
          boxShadow: afterPulse && showAfter
            ? '0 0 40px rgba(34,197,94,0.25), 0 0 80px rgba(34,197,94,0.1), 0 20px 60px rgba(0,0,0,0.5)'
            : '0 0 60px rgba(0,0,0,0.18), 0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        <div
          className="border-b px-4 py-2.5 flex items-center justify-between gap-3"
          style={{ background: 'rgba(0,0,0,0.03)', borderColor: 'rgba(0,0,0,0.06)' }}
        >
          <span
            className="text-[10px] font-mono truncate"
            style={{ color: 'rgba(0,0,0,0.45)' }}
            title={route || '/'}
          >
            {route || '/'}
          </span>
          <span
            className="text-[9px] font-semibold uppercase tracking-[0.14em] shrink-0 px-2 py-0.5 rounded-md"
            style={{
              background: showAfter ? 'rgba(10,10,10,0.85)' : 'rgba(255,255,255,0.9)',
              color: showAfter ? '#ffffff' : 'rgba(0,0,0,0.6)',
              border: showAfter ? 'none' : '0.5px solid rgba(0,0,0,0.08)',
              transition: 'background 280ms ease, color 280ms ease',
            }}
          >
            {showAfter ? 'After' : 'Before'}
          </span>
        </div>

        <div className="relative" style={{ height: 560, background: '#fafafa' }}>
          <div
            className="absolute inset-0 overflow-y-auto reform-screenshot-scroll"
            style={{
              opacity: showAfter ? 0 : 1,
              pointerEvents: showAfter ? 'none' : 'auto',
              transition: 'opacity 280ms ease',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolveImgSrc(effectiveBefore)}
              alt={`Before — ${pageName}`}
              className="block"
              style={{ width: '100%', height: 'auto' }}
            />
          </div>
          <div
            className="absolute inset-0 overflow-y-auto reform-screenshot-scroll"
            style={{
              opacity: showAfter ? 1 : 0,
              pointerEvents: showAfter ? 'auto' : 'none',
              transition: 'opacity 280ms ease',
            }}
          >
            <MagicWandEditor
              screenshot={effectiveAfter}
              pageName={pageName}
              route={route}
              repoUrl={repoUrl}
              branch={repoBranch}
              disabled={!canEdit}
              disabledReason={editDisabledReason}
              onScreenshotChange={onAfterScreenshotChange}
              overlayFiles={overlayFiles}
            />
          </div>
        </div>
      </div>

      <p className="text-center text-[10px]" style={{ color: 'rgba(0,0,0,0.3)' }}>
        Toggle between the before and after versions of this page.
      </p>
    </div>
  )
}

export default function BeforeAfterShowcase({
  beforeScreenshot,
  afterScreenshot,
  pageName,
  route,
  afterPulse = false,
  canEdit = false,
  editDisabledReason,
  repoUrl = null,
  repoBranch = null,
  onAfterScreenshotChange,
  lockedToBefore = false,
  overlayFiles,
}: {
  beforeScreenshot?: string
  afterScreenshot?: string
  pageName: string
  route?: string
  afterPulse?: boolean
  canEdit?: boolean
  editDisabledReason?: string
  repoUrl?: string | null
  repoBranch?: string | null
  onAfterScreenshotChange?: (next: string) => void
  lockedToBefore?: boolean
  overlayFiles?: Record<string, string> | null
}) {
  const [view, setView] = useState<ViewMode>('toggle')
  const [fitWidth, setFitWidth] = useState(true)
  const beforeScrollRef = useRef<HTMLDivElement | null>(null)
  const afterScrollRef = useRef<HTMLDivElement | null>(null)
  const syncingRef = useRef(false)

  const handleScroll = useCallback((source: 'before' | 'after') => {
    if (syncingRef.current) return
    const src = source === 'before' ? beforeScrollRef.current : afterScrollRef.current
    const dst = source === 'before' ? afterScrollRef.current : beforeScrollRef.current
    if (!src || !dst) return
    const srcMax = src.scrollHeight - src.clientHeight
    const dstMax = dst.scrollHeight - dst.clientHeight
    if (srcMax <= 0 || dstMax <= 0) return
    const ratio = src.scrollTop / srcMax
    syncingRef.current = true
    dst.scrollTop = ratio * dstMax
    requestAnimationFrame(() => { syncingRef.current = false })
  }, [])

  useEffect(() => {
    if (view !== 'split') return
    const before = beforeScrollRef.current
    const after = afterScrollRef.current
    if (!before || !after) return
    const onBefore = () => handleScroll('before')
    const onAfter = () => handleScroll('after')
    before.addEventListener('scroll', onBefore, { passive: true })
    after.addEventListener('scroll', onAfter, { passive: true })
    return () => {
      before.removeEventListener('scroll', onBefore)
      after.removeEventListener('scroll', onAfter)
    }
  }, [handleScroll, view])

  const hasBefore = !!beforeScreenshot
  const hasAfter = !!afterScreenshot
  const effectiveBefore = beforeScreenshot || afterScreenshot || ''
  const effectiveAfter = afterScreenshot || beforeScreenshot || ''
  const beforeIsFallback = !hasBefore && hasAfter
  const afterIsFallback = !hasAfter && hasBefore
  const bothMissing = !hasBefore && !hasAfter

  function ScreenshotFrame({
    label,
    screenshot,
    accent = false,
    scrollRef,
    isFallback = false,
  }: {
    label: string
    screenshot: string
    accent?: boolean
    scrollRef?: React.Ref<HTMLDivElement>
    isFallback?: boolean
  }) {
    return (
      <div className="flex flex-col gap-3 flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                background: accent ? '#0a0a0a' : 'rgba(0,0,0,0.25)',
                boxShadow: accent ? '0 0 8px rgba(0,0,0,0.5)' : 'none',
              }}
            />
            <span
              className="text-[12px] font-semibold uppercase tracking-[0.15em]"
              style={{ color: accent ? 'rgba(82,82,82,0.85)' : 'rgba(0,0,0,0.5)' }}
            >
              {label}
            </span>
          </div>
        </div>
        <div
          className={`rounded-2xl overflow-hidden flex flex-col transition-shadow duration-500${accent && afterPulse ? ' ring-2 ring-green-400/40' : ''}`}
          style={{
            border: accent ? '1px solid rgba(0,0,0,0.35)' : '1px solid rgba(0,0,0,0.08)',
            boxShadow: accent && afterPulse
              ? '0 0 40px rgba(34,197,94,0.25), 0 0 80px rgba(34,197,94,0.1), 0 20px 60px rgba(0,0,0,0.5)'
              : accent
              ? '0 0 60px rgba(0,0,0,0.18), 0 20px 60px rgba(0,0,0,0.5)'
              : '0 20px 60px rgba(0,0,0,0.5)',
          }}
        >
          <div
            className="border-b px-4 py-2.5"
            style={{ background: 'rgba(0,0,0,0.03)', borderColor: 'rgba(0,0,0,0.06)' }}
          >
            <span
              className="text-[10px] font-mono truncate block"
              style={{ color: 'rgba(0,0,0,0.45)' }}
              title={route || '/'}
            >
              {route || '/'}
            </span>
          </div>

          <div
            ref={scrollRef}
            className="overflow-y-auto reform-screenshot-scroll"
            style={{ background: '#fafafa', height: '560px' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolveImgSrc(screenshot)}
              alt={`${label} — ${pageName}`}
              className="block"
              style={fitWidth ? { width: '100%', height: 'auto' } : { maxWidth: 'none', height: 'auto' }}
            />
          </div>
        </div>
        {isFallback && (
          <p className="pt-1.5 text-center text-[10px]" style={{ color: 'rgba(0,0,0,0.3)' }}>
            Showing last generated version
          </p>
        )}
      </div>
    )
  }

  // ToggleView is intentionally NOT declared here — see module-scope
  // component below. Declaring it inside this function would create a new
  // component identity on every render, which remounts MagicWandEditor and
  // wipes its edit-mode / session state whenever the parent re-renders
  // (e.g. the user switches carousel tabs).

  if (bothMissing) {
    return (
      <div
        className="rounded-2xl px-6 py-12 text-center"
        style={{ background: 'rgba(0,0,0,0.02)', border: '1px dashed rgba(0,0,0,0.12)' }}
      >
        <div
          className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full"
          style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="9" cy="9" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: 'rgba(0,0,0,0.55)' }}>
          No preview for this page
        </p>
        <p className="mt-2 text-[12px] leading-relaxed max-w-md mx-auto" style={{ color: 'rgba(0,0,0,0.45)' }}>
          Screenshots weren&apos;t generated for <span className="font-mono">{route || pageName}</span>.
          The transformed code and structural changes are listed below.
        </p>
      </div>
    )
  }

  // When the proposed transform has been rejected, only the original repo
  // state is meaningful — hide the After side entirely.
  if (lockedToBefore) {
    return (
      <div>
        <ScreenshotFrame
          label="Before"
          screenshot={effectiveBefore}
          scrollRef={beforeScrollRef}
          isFallback={beforeIsFallback}
        />
      </div>
    )
  }

  const viewOptions: { key: ViewMode; label: string }[] = [
    { key: 'toggle', label: 'Toggle' },
    { key: 'split', label: 'Side by Side' },
  ]

  return (
    <div>
      <div className="flex items-center justify-center gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-1.5">
          {viewOptions.map(opt => (
            <button
              key={opt.key}
              onClick={() => setView(opt.key)}
              className="px-4 py-2 rounded-full text-[12px] font-medium transition-all"
              style={view === opt.key
                ? { background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(0,0,0,0.35)', color: '#525252' }
                : { background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.06)', color: 'rgba(0,0,0,0.4)' }
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
        {view !== 'toggle' && (
          <button
            onClick={() => setFitWidth(f => !f)}
            className="px-3 py-2 rounded-full text-[11px] font-medium transition-all flex items-center gap-1.5"
            style={{
              background: fitWidth ? 'rgba(0,0,0,0.04)' : 'rgba(0,0,0,0.1)',
              border: '1px solid rgba(0,0,0,0.08)',
              color: 'rgba(0,0,0,0.55)',
            }}
            title={fitWidth ? 'Showing fit-to-width — click for actual size' : 'Showing actual size — click to fit width'}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {fitWidth
                ? <><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></>
                : <><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" /></>
              }
            </svg>
            {fitWidth ? 'Fit width' : 'Actual size'}
          </button>
        )}
      </div>

      {view === 'toggle' ? (
        <ToggleView
          effectiveBefore={effectiveBefore}
          effectiveAfter={effectiveAfter}
          pageName={pageName}
          route={route}
          afterPulse={afterPulse}
          canEdit={canEdit}
          editDisabledReason={editDisabledReason}
          repoUrl={repoUrl}
          repoBranch={repoBranch}
          onAfterScreenshotChange={onAfterScreenshotChange}
          overlayFiles={overlayFiles}
        />
      ) : view === 'split' ? (
        <div className="flex flex-col lg:flex-row gap-6 items-stretch">
          <ScreenshotFrame
            label="Before"
            screenshot={effectiveBefore}
            scrollRef={beforeScrollRef}
            isFallback={beforeIsFallback}
          />
          <div className="hidden lg:flex items-center justify-center px-1">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #0a0a0a, #0a0a0a)', boxShadow: '0 0 32px rgba(0,0,0,0.45)' }}
            >
              <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
                <path d="M3 7h8M8 4l3 3-3 3" stroke="#0a0a0a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <ScreenshotFrame
            label="After"
            screenshot={effectiveAfter}
            accent
            scrollRef={afterScrollRef}
            isFallback={afterIsFallback}
          />
        </div>
      ) : view === 'before' ? (
        <ScreenshotFrame
          label="Before"
          screenshot={effectiveBefore}
          scrollRef={beforeScrollRef}
          isFallback={beforeIsFallback}
        />
      ) : (
        <ScreenshotFrame
          label="After — Improved"
          screenshot={effectiveAfter}
          accent
          scrollRef={afterScrollRef}
          isFallback={afterIsFallback}
        />
      )}

      {view === 'split' && (
        <p className="text-center text-[10px] mt-4" style={{ color: 'rgba(0,0,0,0.2)' }}>
          Scroll a frame to see the rest of the page — both panels stay in sync.
        </p>
      )}
    </div>
  )
}
