'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ProgressProvider, useProgress } from '@/components/dashboard/ProgressContext'
import InteractiveBackground from '@/components/landing/InteractiveBackground'

const NAV_ITEMS = [
  { href: '/dashboard/discovery', label: 'Project Discovery' },
  { href: '/dashboard/transform', label: 'UI Transformation' },
]

function GlobalProgressBar() {
  const { state } = useProgress()
  const pathname = usePathname()
  if (!state.active || pathname === '/dashboard/discovery') return null
  return (
    <div className="fixed top-0 left-0 right-0 z-[100]">
      <div className="h-[2px] w-full" style={{ background: 'rgba(255,255,255,0.03)' }}>
        <div className="h-full transition-all duration-700 ease-out" style={{ width: `${state.progress}%`, background: 'linear-gradient(90deg, #7c3aed, #a855f7)', boxShadow: '0 0 20px rgba(124,58,237,0.4)' }} />
      </div>
      {state.label && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-[10px] font-medium" style={{ background: 'rgba(13,12,22,0.9)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
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
    <div className="min-h-screen" style={{ background: '#13111c' }}>
      <InteractiveBackground />
      <GlobalProgressBar />

      {/* Navbar — matches landing page exactly */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-3 flex justify-between items-center" style={{ background: 'rgba(19,17,28,0.8)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="white"><circle cx="6" cy="6" r="3.5" /><circle cx="6" cy="6" r="1.5" fill="rgba(255,255,255,0.4)" /></svg>
            </div>
            <span className="text-sm font-semibold text-white">Reform</span>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href
              const isLocked = item.href === '/dashboard/discovery' && progressState.active
              if (isLocked) return <div key={item.href} className="px-3 py-1.5 text-[12px] font-medium opacity-20" style={{ color: 'rgba(255,255,255,0.5)' }}>{item.label}</div>
              return (
                <Link key={item.href} href={item.href} className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors" style={isActive ? { background: 'rgba(255,255,255,0.06)', color: 'white' } : { color: 'rgba(255,255,255,0.35)' }}>
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => { sessionStorage.removeItem('refineui_analysis'); sessionStorage.removeItem('refineui_discovery'); sessionStorage.removeItem('refineui_answers'); window.location.href = '/dashboard/discovery' }} className="px-3 py-1.5 rounded-lg text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
            + New
          </button>
          <div className="w-7 h-7 rounded-full" style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>
            <div className="w-full h-full flex items-center justify-center text-white text-[10px] font-semibold">R</div>
          </div>
        </div>
      </header>

      <main className="pt-16 min-h-screen relative" style={{ zIndex: 1 }}>{children}</main>
    </div>
  )
}
