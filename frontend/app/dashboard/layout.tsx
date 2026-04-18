'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ProgressProvider, useProgress } from '@/components/dashboard/ProgressContext'
import AccountMenu from '@/components/layout/AccountMenu'
import { clearSelectedRepo } from '@/lib/selectedRepo'

const NAV_ITEMS = [
  { href: '/dashboard/discovery', label: 'Project Discovery' },
  { href: '/dashboard/simulation', label: 'UX Analysis' },
  { href: '/dashboard/transform', label: 'UI Transformation' },
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
      <div className="h-[2px] w-full" style={{ background: 'rgba(0,0,0,0.05)' }}>
        <div className="h-full bg-neutral-950 transition-all duration-700 ease-out" style={{ width: `${state.progress}%` }} />
      </div>
      {state.label && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-[10px] font-medium" style={{ background: '#ffffff', color: '#525252', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-5 h-5 rounded-full animate-spin" style={{ border: '2px solid rgba(0,0,0,0.12)', borderTopColor: '#0a0a0a' }} />
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

  return (
    <div className="min-h-screen bg-white">
      <GlobalProgressBar />

      <header
        className="fixed top-0 left-0 right-0 z-50 border-b"
        style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(20px)',
          borderColor: 'rgba(0,0,0,0.07)',
        }}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 flex justify-between items-center gap-4">
          <div className="flex items-center gap-3 sm:gap-8 min-w-0">
            <Link href="/" className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[20px] font-bold text-neutral-950" style={{ letterSpacing: '-0.04em' }}>Reform</span>
              <span className="hidden sm:inline-block text-[11px] text-neutral-400 ml-1">analysis workspace</span>
            </Link>

            <DashboardNav
              pathname={pathname}
              progressActive={progressState.active}
              className="relative hidden sm:flex items-center gap-1 rounded-full p-1 overflow-hidden"
              itemClassName="block px-4 py-2 rounded-full text-[12px] font-medium transition-colors duration-200 whitespace-nowrap"
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
              className="rounded-full border border-black/[0.12] bg-white px-3 sm:px-4 py-1.5 text-[11px] font-medium text-neutral-950 transition hover:bg-neutral-50"
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
          background: 'rgba(255,255,255,0.96)',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        <div className="px-3 py-2.5">
          <DashboardNav
            pathname={pathname}
            progressActive={progressState.active}
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

function DashboardNav({
  pathname,
  progressActive,
  className,
  itemClassName,
  indicatorInset = 4,
  compact = false,
}: {
  pathname: string
  progressActive: boolean
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
      const disabled = item.href === '/dashboard/discovery' && progressActive
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
  }, [activeHref, indicatorInset, progressActive])

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
        background: '#fafafa',
        border: '1px solid rgba(0,0,0,0.06)',
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
          background: '#ffffff',
          border: '1px solid rgba(0,0,0,0.08)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}
      />

      {NAV_ITEMS.map((item) => {
        const isActive = item.href === visibleHref
        const isLocked = item.href === '/dashboard/discovery' && progressActive
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
                className={itemClassName}
                style={{ color: isActive ? '#0a0a0a' : '#9ca3af', opacity: 0.72 }}
              >
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
                  color: isActive ? '#0a0a0a' : '#6b7280',
                  fontWeight: isActive ? 600 : 500,
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
