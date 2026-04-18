'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ProgressProvider, useProgress } from '@/components/dashboard/ProgressContext'
import InteractiveBackground from '@/components/landing/InteractiveBackground'
import AccountMenu from '@/components/layout/AccountMenu'
import { clearSelectedRepo } from '@/lib/selectedRepo'

const NAV_ITEMS = [
  { href: '/dashboard/discovery', label: 'Project Discovery' },
  { href: '/dashboard/simulation', label: 'UX Analysis' },
  { href: '/dashboard/transform', label: 'UI Transformation' },
  { href: '/dashboard/edit-lab', label: 'The Lab' },
]

type NavBounds = {
  left: number
  width: number
  opacity: number
}

type NavMetric = {
  href: string
  left: number
  width: number
  center: number
  disabled: boolean
}

function GlobalProgressBar() {
  const { state } = useProgress()
  const pathname = usePathname()
  if (!state.active || pathname === '/dashboard/discovery') return null
  return (
    <div className="fixed top-0 left-0 right-0 z-[100]">
      <div className="h-[2px] w-full" style={{ background: 'rgba(255,255,255,0.03)' }}>
        <div
          className="h-full transition-all duration-700 ease-out"
          style={{
            width: `${state.progress}%`,
            background: 'linear-gradient(90deg, #7c8cff, #aab4ff)',
            boxShadow: '0 0 16px rgba(124,140,255,0.35)',
          }}
        />
      </div>
      {state.label && (
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-[10px] font-medium"
          style={{
            background: 'rgba(6,8,13,0.9)',
            color: 'rgba(255,255,255,0.45)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(8px)',
          }}
        >
          {state.label}
        </div>
      )}
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { status } = useSession()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(`/signin?next=${encodeURIComponent(pathname)}`)
    }
  }, [status, pathname, router])

  if (status !== 'authenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#05070c' }}>
        <div className="w-5 h-5 rounded-full animate-spin" style={{ border: '2px solid rgba(168,85,247,0.2)', borderTopColor: '#a855f7' }} />
      </div>
    )
  }

  return (
    <ProgressProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </ProgressProvider>
  )
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { state: progressState } = useProgress()
  const [discoveryDone, setDiscoveryDone] = useState(false)
  const [analysisDone, setAnalysisDone] = useState(false)
  const [transformDone, setTransformDone] = useState(false)

  useEffect(() => {
    function readSession() {
      setDiscoveryDone(!!sessionStorage.getItem('refineui_discovery'))
      setAnalysisDone(!!sessionStorage.getItem('refineui_analysis_cache'))
      setTransformDone(!!sessionStorage.getItem('refineui_transform'))
    }
    readSession()
    window.addEventListener('focus', readSession)
    window.addEventListener('reform:discovery-complete', readSession)
    window.addEventListener('reform:ux-analysis-complete', readSession)
    return () => {
      window.removeEventListener('focus', readSession)
      window.removeEventListener('reform:discovery-complete', readSession)
      window.removeEventListener('reform:ux-analysis-complete', readSession)
    }
  }, [])

  return (
    <div className="app-shell min-h-screen">
      <InteractiveBackground />
      <GlobalProgressBar />

      <header
        className="fixed top-0 left-0 right-0 z-50 border-b"
        style={{
          background: 'rgba(5,7,12,0.78)',
          backdropFilter: 'blur(20px)',
          borderColor: 'rgba(255,255,255,0.08)',
        }}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 flex justify-between items-center gap-4">
          <div className="flex items-center gap-3 sm:gap-8 min-w-0">
            <Link href="/" className="flex items-center gap-3 flex-shrink-0">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden"
                style={{
                  background: 'linear-gradient(180deg, rgba(124,140,255,0.2) 0%, rgba(124,140,255,0.08) 100%)',
                  border: '1px solid rgba(170,180,255,0.16)',
                }}
              >
                <Image src="/reform_justlogo.png" alt="Reform" width={36} height={36} className="object-contain" />
              </div>
              <div className="hidden sm:block">
                <div className="text-[14px] font-semibold text-white" style={{ letterSpacing: '-0.03em' }}>Reform</div>
                <div className="mono text-[10px]" style={{ color: 'rgba(255,255,255,0.28)' }}>analysis workspace</div>
              </div>
            </Link>

            <DashboardNav
              pathname={pathname}
              progressActive={progressState.active}
              discoveryDone={discoveryDone}
              analysisDone={analysisDone}
              transformDone={transformDone}
              className="relative hidden sm:flex items-center gap-1 rounded-[20px] p-1.5 overflow-hidden"
              itemClassName="block px-4 py-2.5 rounded-2xl text-[12px] font-medium transition-colors duration-200 whitespace-nowrap"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                sessionStorage.removeItem('refineui_analysis')
                sessionStorage.removeItem('refineui_discovery')
                sessionStorage.removeItem('refineui_answers')
                sessionStorage.removeItem('refineui_analysis_cache')
                sessionStorage.removeItem('refineui_transform')
                sessionStorage.removeItem('refineui_site_url')
                clearSelectedRepo()
                window.location.href = '/dashboard/discovery'
              }}
              className="btn-ghost px-3 sm:px-4 py-2 rounded-xl text-[10px] sm:text-[11px] font-medium"
            >
              New Analysis
            </button>
            <AccountMenu />
          </div>
        </div>
      </header>

      <div
        className="fixed top-[73px] left-0 right-0 z-40 sm:hidden overflow-x-auto"
        style={{
          background: 'rgba(5,7,12,0.96)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="px-3 py-2.5">
          <DashboardNav
            pathname={pathname}
            progressActive={progressState.active}
            discoveryDone={discoveryDone}
            analysisDone={analysisDone}
            transformDone={transformDone}
            className="relative flex items-center gap-1 rounded-[18px] p-1 overflow-hidden min-w-max"
            itemClassName="block px-3 py-2 rounded-[14px] text-[11px] font-medium transition-colors duration-200 whitespace-nowrap"
            indicatorInset={3}
            compact
          />
        </div>
      </div>

      <main className="pt-[124px] sm:pt-[88px] min-h-screen relative" style={{ zIndex: 1 }}>
        {children}
      </main>
    </div>
  )
}

function isNavLocked(
  href: string,
  progressActive: boolean,
  discoveryDone: boolean,
  analysisDone: boolean,
  transformDone: boolean,
): boolean {
  if (href === '/dashboard/discovery') return progressActive
  if (href === '/dashboard/simulation') return !discoveryDone
  if (href === '/dashboard/transform') return !analysisDone
  if (href === '/dashboard/edit-lab') return !transformDone
  return false
}

function DashboardNav({
  pathname,
  progressActive,
  discoveryDone,
  analysisDone,
  transformDone,
  className,
  itemClassName,
  indicatorInset = 4,
  compact = false,
}: {
  pathname: string
  progressActive: boolean
  discoveryDone: boolean
  analysisDone: boolean
  transformDone: boolean
  className: string
  itemClassName: string
  indicatorInset?: number
  compact?: boolean
}) {
  const router = useRouter()
  const containerRef = useRef<HTMLElement | null>(null)
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const metricsRef = useRef<NavMetric[]>([])
  const dragSessionRef = useRef<{ pointerId: number; startX: number; isDragging: boolean } | null>(null)
  const suppressClickRef = useRef(false)
  const activeHref = useMemo(() => NAV_ITEMS.find(item => item.href === pathname)?.href ?? NAV_ITEMS[0].href, [pathname])
  const [bounds, setBounds] = useState<NavBounds>({ left: 0, width: 0, opacity: 0 })
  const [dragBounds, setDragBounds] = useState<NavBounds | null>(null)
  const [dragPreviewHref, setDragPreviewHref] = useState<string | null>(null)

  const visibleHref = dragPreviewHref ?? activeHref

  const measureMetrics = () => {
    const nextMetrics = NAV_ITEMS.map((item) => {
      const node = itemRefs.current[item.href]
      const disabled = isNavLocked(item.href, progressActive, discoveryDone, analysisDone, transformDone)
      if (!node) return null
      return {
        href: item.href,
        left: node.offsetLeft,
        width: node.offsetWidth,
        center: node.offsetLeft + node.offsetWidth / 2,
        disabled,
      }
    }).filter((metric): metric is NavMetric => metric !== null && metric.width > 0)

    metricsRef.current = nextMetrics
    return nextMetrics
  }

  useEffect(() => {
    const updateMeasurements = () => {
      const nextMetrics = measureMetrics()
      const activeMetric = nextMetrics.find(metric => metric.href === activeHref)

      if (!activeMetric) {
        setBounds(current => ({ ...current, opacity: 0 }))
        return
      }

      setBounds({
        left: activeMetric.left + indicatorInset,
        width: Math.max(activeMetric.width - indicatorInset * 2, 0),
        opacity: 1,
      })
    }

    const frame = window.requestAnimationFrame(updateMeasurements)
    window.addEventListener('resize', updateMeasurements)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', updateMeasurements)
    }
  }, [activeHref, indicatorInset, progressActive, discoveryDone, analysisDone, transformDone])

  const clearDrag = () => {
    dragSessionRef.current = null
    setDragBounds(null)
    setDragPreviewHref(null)
  }

  const getNearestMetric = (clientX: number, sourceMetrics: NavMetric[] = metricsRef.current.filter(metric => !metric.disabled)) => {
    const container = containerRef.current
    if (!container || sourceMetrics.length === 0) return null

    const { left: containerLeft, width: containerWidth } = container.getBoundingClientRect()
    const localX = Math.max(0, Math.min(clientX - containerLeft, containerWidth))

    return sourceMetrics.reduce((closest, metric) =>
      Math.abs(metric.center - localX) < Math.abs(closest.center - localX) ? metric : closest
    )
  }

  const getInterpolatedBounds = (clientX: number, sourceMetrics: NavMetric[] = metricsRef.current.filter(metric => !metric.disabled)) => {
    const container = containerRef.current
    if (!container || sourceMetrics.length === 0) return null

    const { left: containerLeft, width: containerWidth } = container.getBoundingClientRect()
    const localX = Math.max(0, Math.min(clientX - containerLeft, containerWidth))
    const nearestMetric = getNearestMetric(clientX, sourceMetrics)

    if (!nearestMetric) return null
    if (sourceMetrics.length === 1 || localX <= sourceMetrics[0].center) {
      return {
        left: sourceMetrics[0].left + indicatorInset,
        width: Math.max(sourceMetrics[0].width - indicatorInset * 2, 0),
        opacity: 1,
        href: nearestMetric.href,
      }
    }

    const lastMetric = sourceMetrics[sourceMetrics.length - 1]
    if (localX >= lastMetric.center) {
      return {
        left: lastMetric.left + indicatorInset,
        width: Math.max(lastMetric.width - indicatorInset * 2, 0),
        opacity: 1,
        href: nearestMetric.href,
      }
    }

    for (let index = 0; index < sourceMetrics.length - 1; index += 1) {
      const current = sourceMetrics[index]
      const next = sourceMetrics[index + 1]
      if (localX > next.center) continue

      const distance = next.center - current.center || 1
      const progress = Math.max(0, Math.min((localX - current.center) / distance, 1))
      const interpolatedLeft = current.left + (next.left - current.left) * progress
      const interpolatedWidth = current.width + (next.width - current.width) * progress

      return {
        left: interpolatedLeft + indicatorInset,
        width: Math.max(interpolatedWidth - indicatorInset * 2, 0),
        opacity: 1,
        href: nearestMetric.href,
      }
    }

    return {
      left: lastMetric.left + indicatorInset,
      width: Math.max(lastMetric.width - indicatorInset * 2, 0),
      opacity: 1,
      href: nearestMetric.href,
    }
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if ((event.target as HTMLElement).closest('[data-locked="true"]')) return

    const nextMetrics = measureMetrics().filter(metric => !metric.disabled)
    if (nextMetrics.length === 0) return

    dragSessionRef.current = { pointerId: event.pointerId, startX: event.clientX, isDragging: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const session = dragSessionRef.current
    if (!session || session.pointerId !== event.pointerId) return

    const nextBounds = getInterpolatedBounds(event.clientX)
    if (!nextBounds) return

    if (Math.abs(event.clientX - session.startX) > 4) {
      session.isDragging = true
    }

    setDragBounds({
      left: nextBounds.left,
      width: nextBounds.width,
      opacity: nextBounds.opacity,
    })
    setDragPreviewHref(nextBounds.href)
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLElement>) => {
    const session = dragSessionRef.current
    if (!session || session.pointerId !== event.pointerId) return

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const nearestMetric = getNearestMetric(event.clientX)
    const clickedButton = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-href]')

    if (session.isDragging) {
      suppressClickRef.current = true
      window.requestAnimationFrame(() => {
        suppressClickRef.current = false
      })
    }

    if (session.isDragging && nearestMetric && nearestMetric.href !== pathname) {
      router.push(nearestMetric.href)
    } else if (!session.isDragging && !clickedButton && nearestMetric && nearestMetric.href !== pathname) {
      router.push(nearestMetric.href)
    }

    clearDrag()
  }

  const handlePointerCancel = (event: React.PointerEvent<HTMLElement>) => {
    const session = dragSessionRef.current
    if (!session || session.pointerId !== event.pointerId) return

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    clearDrag()
  }

  const displayedBounds = dragBounds ?? bounds

  return (
    <nav
      ref={containerRef}
      className={className}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{
        background: compact
          ? 'rgba(13,17,25,0.98)'
          : 'rgba(13,17,25,0.96)',
        border: compact ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(255,255,255,0.08)',
        boxShadow: compact ? 'inset 0 1px 0 rgba(255,255,255,0.03)' : 'inset 0 1px 0 rgba(255,255,255,0.04)',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute rounded-[18px]"
        style={{
          top: indicatorInset,
          bottom: indicatorInset,
          left: 0,
          width: displayedBounds.width,
          opacity: displayedBounds.opacity,
          transform: `translateX(${displayedBounds.left}px)`,
          transition: dragBounds
            ? 'none'
            : 'transform 300ms cubic-bezier(0.22, 1, 0.36, 1), width 300ms cubic-bezier(0.22, 1, 0.36, 1), opacity 160ms ease',
          background: compact
            ? 'rgba(124,140,255,0.16)'
            : 'rgba(124,140,255,0.18)',
          border: '1px solid rgba(170,180,255,0.18)',
          boxShadow: compact
            ? '0 8px 18px rgba(86,102,245,0.12)'
            : '0 10px 22px rgba(86,102,245,0.14)',
        }}
      />

      {NAV_ITEMS.map((item) => {
        const isActive = item.href === visibleHref
        const isLocked = isNavLocked(item.href, progressActive, discoveryDone, analysisDone, transformDone)
        return (
          <div
            key={item.href}
            ref={node => {
              itemRefs.current[item.href] = node
            }}
            className="relative z-[1] flex-shrink-0"
          >
            {isLocked ? (
              <div
                data-locked="true"
                className={`${itemClassName} flex items-center gap-1.5`}
                style={{ color: 'rgba(255,255,255,0.22)', opacity: 0.6, cursor: 'not-allowed' }}
              >
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, opacity: 0.7 }}>
                  <rect x="2" y="5" width="8" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M4 5V3.5a2 2 0 0 1 4 0V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                {item.label}
              </div>
            ) : (
              <button
                type="button"
                data-href={item.href}
                className={itemClassName}
                onClick={() => {
                  if (suppressClickRef.current) {
                    suppressClickRef.current = false
                    return
                  }
                  if (item.href !== pathname) router.push(item.href)
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: isActive ? 'rgba(255,255,255,0.98)' : 'rgba(255,255,255,0.56)',
                }}
              >
                {item.label}
              </button>
            )}
          </div>
        )
      })}
    </nav>
  )
}
