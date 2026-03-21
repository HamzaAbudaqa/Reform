'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ProgressProvider, useProgress } from '@/components/dashboard/ProgressContext'

const NAV_ITEMS = [
  { href: '/dashboard/discovery', label: 'Project Discovery', icon: 'search_insights' },
  { href: '/dashboard/transform', label: 'UI Transformation', icon: 'auto_fix_high' },
]

function MaterialIcon({ name, className }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className || ''}`}>{name}</span>
}

function GlobalProgressBar() {
  const { state } = useProgress()
  const pathname = usePathname()
  if (!state.active || pathname === '/dashboard/discovery') return null
  return (
    <div className="fixed top-0 left-0 right-0 z-[100]">
      <div className="h-1 w-full" style={{ background: 'rgba(74,68,85,0.2)' }}>
        <div
          className="h-full transition-all duration-700 ease-out"
          style={{
            width: `${state.progress}%`,
            background: 'linear-gradient(90deg, #7c3aed, #d2bbff)',
            boxShadow: '0 0 12px rgba(124,58,237,0.5)',
          }}
        />
      </div>
      {state.label && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest" style={{ background: 'rgba(15,13,24,0.9)', color: '#d2bbff', border: '1px solid rgba(124,58,237,0.3)' }}>
          {state.label}
        </div>
      )}
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
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
    <div className="min-h-screen" style={{ background: '#14121d', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <GlobalProgressBar />

      {/* Top Bar */}
      <header
        className="fixed top-0 left-0 right-0 z-50 px-5 py-2.5 flex justify-between items-center"
        style={{ background: 'rgba(20,18,29,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(74,68,85,0.15)' }}
      >
        {/* Left: Logo + Nav tabs */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#7c3aed' }}>
              <MaterialIcon name="auto_fix_high" className="text-white text-sm" />
            </div>
            <div>
              <h2 className="text-sm font-black leading-none" style={{ color: '#d2bbff' }}>Reform</h2>
              <p className="text-[8px] uppercase tracking-widest font-semibold" style={{ color: 'rgba(204,195,216,0.4)' }}>AI UX Intel</p>
            </div>
          </Link>

          <div className="h-5 w-px" style={{ background: 'rgba(74,68,85,0.3)' }} />

          {/* Nav tabs */}
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href
              const isDiscovery = item.href === '/dashboard/discovery'
              const isLocked = isDiscovery && progressState.active

              if (isLocked) {
                return (
                  <div key={item.href} className="flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-not-allowed opacity-30" style={{ color: '#ccc3d8' }}>
                    <MaterialIcon name="lock" className="text-sm" />
                    <span className="text-[11px] font-semibold">{item.label}</span>
                  </div>
                )
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all"
                  style={isActive ? {
                    background: 'rgba(124,58,237,0.15)',
                    color: '#d2bbff',
                  } : {
                    color: 'rgba(204,195,216,0.5)',
                  }}
                >
                  <MaterialIcon name={item.icon} className="text-sm" />
                  <span className="text-[11px] font-semibold">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              sessionStorage.removeItem('refineui_analysis')
              sessionStorage.removeItem('refineui_discovery')
              sessionStorage.removeItem('refineui_answers')
              window.location.href = '/dashboard/discovery'
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all active:scale-95"
            style={{ background: 'rgba(124,58,237,0.1)', color: '#d2bbff', border: '1px solid rgba(124,58,237,0.2)' }}
          >
            <MaterialIcon name="add" className="text-xs" />
            New
          </button>
          <button className="p-1.5 rounded-lg transition-colors" style={{ color: 'rgba(204,195,216,0.5)' }}>
            <MaterialIcon name="notifications" className="text-lg" />
          </button>
          <div className="w-7 h-7 rounded-full" style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>
            <div className="w-full h-full flex items-center justify-center text-white text-[10px] font-bold">R</div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-14 min-h-screen">
        {children}
      </main>
    </div>
  )
}
