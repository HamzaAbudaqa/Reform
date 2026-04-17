'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import PreviewFallbackSkeleton from './PreviewFallbackSkeleton'

export default function BeforeAfterShowcase({
  beforeScreenshot,
  afterScreenshot,
  pageName,
  route,
  changeSummary,
  afterPulse = false,
}: {
  beforeScreenshot?: string
  afterScreenshot?: string
  pageName: string
  route?: string
  changeSummary?: string[]
  afterPulse?: boolean
}) {
  const [view, setView] = useState<'split' | 'before' | 'after'>('split')
  const [fitWidth, setFitWidth] = useState(true)
  const beforeScrollRef = useRef<HTMLDivElement | null>(null)
  const afterScrollRef = useRef<HTMLDivElement | null>(null)
  const syncingRef = useRef(false)

  // Synchronized scroll: when one frame scrolls, mirror it on the other.
  // Uses a ratio (0..1) so it works even if the screenshots have different
  // natural heights (the AFTER often does because layout changes).
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

  // Preview fallback chain — preview area is never empty. Priority:
  //   1. real screenshot for this pane
  //   2. the other pane's screenshot (last known good)
  //   3. visual skeleton
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
    skeletonVariant = 'after',
  }: {
    label: string
    screenshot?: string
    accent?: boolean
    scrollRef?: React.Ref<HTMLDivElement>
    isFallback?: boolean
    skeletonVariant?: 'before' | 'after'
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
          {/* Browser chrome */}
          <div
            className="border-b px-4 py-2.5 flex items-center gap-2"
            style={{ background: 'rgba(0,0,0,0.03)', borderColor: 'rgba(0,0,0,0.06)' }}
          >
            <div className="w-3 h-3 rounded-full bg-red-500/70" />
            <div className="w-3 h-3 rounded-full bg-amber-500/70" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
            <div className="flex-1 mx-3">
              <div className="rounded-md text-[10px] px-3 py-1 text-center" style={{ background: 'rgba(0,0,0,0.04)', color: 'rgba(0,0,0,0.3)' }}>
                {pageName.toLowerCase().replace(/ /g, '-')}.vercel.app
              </div>
            </div>
          </div>

          {/* Screenshot — scrollable viewport so tall full-page captures stay readable */}
          <div
            ref={scrollRef}
            className="overflow-y-auto reform-screenshot-scroll"
            style={{ background: '#fafafa', height: '560px' }}
          >
            {screenshot ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={
                  screenshot.startsWith('http://') || screenshot.startsWith('https://')
                    ? screenshot
                    : `data:image/png;base64,${screenshot}`
                }
                alt={`${label} — ${pageName}`}
                className="block"
                style={fitWidth ? { width: '100%', height: 'auto' } : { maxWidth: 'none', height: 'auto' }}
              />
            ) : (
              <div className="flex h-full items-stretch p-4">
                <PreviewFallbackSkeleton
                  pageName={pageName}
                  route={route}
                  changeSummary={changeSummary}
                  variant={skeletonVariant}
                />
              </div>
            )}
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

  return (
    <div>
      {/* View toggle + fit-width control */}
      <div className="flex items-center justify-center gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-1.5">
            {(['split', 'before', 'after'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="px-4 py-2 rounded-full text-[12px] font-medium transition-all"
                style={view === v
                  ? { background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(0,0,0,0.35)', color: '#525252' }
                  : { background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.06)', color: 'rgba(0,0,0,0.4)' }
                }
              >
                {v === 'split' ? 'Side by Side' : v === 'before' ? 'Before Only' : 'After Only'}
              </button>
            ))}
          </div>
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
        </div>

      {/* Screenshots */}
      {view === 'split' ? (
        <div className="flex flex-col lg:flex-row gap-6 items-stretch">
          <ScreenshotFrame
            label="Before"
            screenshot={effectiveBefore}
            scrollRef={beforeScrollRef}
            isFallback={beforeIsFallback}
            skeletonVariant="before"
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
            skeletonVariant="after"
          />
        </div>
      ) : view === 'before' ? (
        <ScreenshotFrame
          label="Before"
          screenshot={effectiveBefore}
          scrollRef={beforeScrollRef}
          isFallback={beforeIsFallback}
          skeletonVariant="before"
        />
      ) : (
        <ScreenshotFrame
          label="After — Improved"
          screenshot={effectiveAfter}
          accent
          scrollRef={afterScrollRef}
          isFallback={afterIsFallback}
          skeletonVariant="after"
        />
      )}

      <p className="text-center text-[10px] mt-4" style={{ color: 'rgba(0,0,0,0.2)' }}>
        {bothMissing
          ? 'Preview may be slightly delayed — the transformed code is ready below.'
          : 'Scroll a frame to see the rest of the page — both panels stay in sync.'}
      </p>
    </div>
  )
}
