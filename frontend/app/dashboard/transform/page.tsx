'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const COMMITS = [
  { hash: 'a717c5', msg: 'fix: navigation jumping', time: 'months ago', color: '#a855f7' },
  { hash: 'a712c1', msg: 'fix: navigation jumping', time: '3 hours ago', color: '#a855f7' },
  { hash: 'a712c1', msg: 'fix: navigation jumping', time: '3 hours ago', color: '#3b82f6' },
  { hash: 'a712c1', msg: 'fix: navigation jumping', time: '3 hours ago', color: '#3b82f6' },
  { hash: 'c1a9d5', msg: 'feat: add auth flow', time: '3 hours ago', color: '#ef4444' },
  { hash: 'c1a9d5', msg: 'feat: add auth flow', time: '2 hours ago', color: '#ef4444' },
  { hash: 'c1a9d5', msg: 'chore: dependency update', time: '2 hours ago', color: '#f59e0b' },
  { hash: 'o01371', msg: 'feat: add auth flow', time: '2 hours ago', color: '#f59e0b' },
  { hash: 'o0fd71', msg: 'feat: add auth flow', time: '2 hours ago', color: '#a855f7' },
  { hash: 'o0d77c', msg: 'chore: dependency update', time: '2 hours ago', color: '#3b82f6' },
  { hash: 'c1e9d5', msg: 'feat: add auth flow', time: '2 hours ago', color: '#3b82f6' },
  { hash: 'c1a83a', msg: 'feat: add auth flow', time: '2 hours ago', color: '#a855f7' },
  { hash: 'e83321', msg: 'feat: add auth flow', time: '3 hours ago', color: '#f59e0b' },
  { hash: 'd8d9f1t', msg: 'chore: dependency update', time: '2 hours ago', color: '#a855f7' },
]

interface AnalysisData {
  meta: { project_style_goal: string; description: string }
  sources: { url: string; page_type: string }[]
  design_tokens: Record<string, unknown>
}

export default function TransformPage() {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null)
  const [scOpen, setScOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const stored = sessionStorage.getItem('refineui_analysis')
    if (stored) {
      try { setAnalysis(JSON.parse(stored)) } catch { /* ignore */ }
    }
  }, [])

  // Locked state
  if (!analysis) {
    return (
      <div className="px-8 py-8 flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-xl mx-auto mb-6 flex items-center justify-center" style={{ background: 'rgba(74,68,85,0.2)', border: '1px solid rgba(74,68,85,0.3)' }}>
            <span className="material-symbols-outlined text-3xl" style={{ color: 'rgba(204,195,216,0.3)' }}>lock</span>
          </div>
          <h2 className="text-white font-bold text-xl mb-2">No Analysis Data</h2>
          <p className="text-sm mb-6" style={{ color: 'rgba(204,195,216,0.4)' }}>
            Complete a Project Discovery first to generate UI transformation results.
          </p>
          <button
            onClick={() => router.push('/dashboard/discovery')}
            className="px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, #d2bbff, #7c3aed)', color: '#3f008e' }}
          >
            Start Discovery
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-5 pb-16 relative">

      {/* ── 2x2 HERO GRID — all 4 cards equal ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Before */}
        <div className="rounded-xl overflow-hidden flex flex-col" style={{ background: '#1c1a25', border: '1px solid rgba(74,68,85,0.15)', minHeight: '320px' }}>
          <div className="px-5 pt-5 pb-3">
            <h2 className="text-white font-bold text-base">Before proposed change</h2>
          </div>
          <div className="px-4 pb-4 flex-1 flex flex-col">
            <div className="rounded-lg overflow-hidden flex-1" style={{ background: '#0f0d18', border: '1px solid rgba(74,68,85,0.1)' }}>
              <div className="p-4 h-full">
                <div className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded" style={{ background: 'rgba(124,58,237,0.1)' }}>
                  <div className="w-4 h-4 rounded-full" style={{ background: '#7c3aed' }} />
                  <span className="text-[10px] font-bold text-white">RefineUI</span>
                  <div className="flex-1" />
                  <div className="flex gap-1">
                    <div className="h-3 w-8 rounded" style={{ background: 'rgba(255,255,255,0.06)' }} />
                    <div className="h-3 w-3 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="w-20 space-y-1.5">
                    {['Discovery', 'Competitors', 'Design', 'Insights'].map(n => (
                      <div key={n} className="px-2 py-1 rounded text-[8px]" style={{ background: n === 'Discovery' ? 'rgba(124,58,237,0.15)' : 'transparent', color: 'rgba(255,255,255,0.5)' }}>{n}</div>
                    ))}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="text-[9px] font-bold text-white px-1">Discovery</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {['Companies', 'Context'].map(label => (
                        <div key={label} className="rounded p-2 space-y-1.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(74,68,85,0.1)' }}>
                          <div className="text-[7px] font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</div>
                          {[70, 85, 55].map((w, i) => <div key={i} className="h-2 rounded" style={{ background: 'rgba(255,255,255,0.05)', width: `${w}%` }} />)}
                        </div>
                      ))}
                    </div>
                    <div className="h-4 w-full rounded" style={{ background: 'rgba(255,255,255,0.03)' }} />
                  </div>
                </div>
                <div className="mt-3 px-1"><div className="text-[7px]" style={{ color: 'rgba(255,255,255,0.2)' }}>Settings</div></div>
              </div>
            </div>
          </div>
        </div>

        {/* After */}
        <div className="rounded-xl overflow-hidden flex flex-col" style={{ background: '#1c1a25', border: '1px solid rgba(124,58,237,0.2)', boxShadow: '0 0 32px rgba(124,58,237,0.05)', minHeight: '320px' }}>
          <div className="px-5 pt-5 pb-3">
            <h2 className="text-white font-bold text-base">After proposed change</h2>
          </div>
          <div className="px-4 pb-4 flex-1 flex flex-col">
            <div className="rounded-lg overflow-hidden flex-1" style={{ background: '#0f0d18', border: '1px solid rgba(124,58,237,0.15)' }}>
              <div className="p-4 h-full">
                <div className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded" style={{ background: 'rgba(124,58,237,0.08)' }}>
                  <div className="w-4 h-4 rounded-full" style={{ background: '#7c3aed' }} />
                  <span className="text-[10px] font-bold text-white">RefineUI</span>
                  <div className="flex-1" />
                  <div className="flex gap-1">
                    <div className="h-3 px-2 rounded text-[7px] flex items-center" style={{ background: 'rgba(124,58,237,0.2)', color: '#d2bbff' }}>Pro</div>
                    <div className="h-3 px-2 rounded text-[7px] flex items-center" style={{ background: 'rgba(34,197,94,0.2)', color: '#86efac' }}>Live</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="w-16 space-y-1">
                    {['Team', 'Yours', 'Config', 'Library', 'Contrib'].map((n, i) => (
                      <div key={n} className="px-1.5 py-1 rounded text-[7px]" style={{ background: i === 0 ? 'rgba(124,58,237,0.12)' : 'transparent', color: i === 0 ? '#d2bbff' : 'rgba(255,255,255,0.35)' }}>{n}</div>
                    ))}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="text-[9px] font-bold text-white px-1">Discovery</div>
                    <div className="text-[7px] px-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Latest AI inspection</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {['Frameworks', 'Context'].map(label => (
                        <div key={label} className="rounded p-2 space-y-1.5" style={{ background: 'rgba(124,58,237,0.04)', border: '1px solid rgba(124,58,237,0.1)' }}>
                          <div className="text-[7px] font-bold" style={{ color: '#d2bbff' }}>{label}</div>
                          {[75, 60, 90].map((w, i) => <div key={i} className="h-2 rounded" style={{ background: 'rgba(124,58,237,0.08)', width: `${w}%` }} />)}
                        </div>
                      ))}
                    </div>
                    <div className="h-4 rounded" style={{ background: 'rgba(255,255,255,0.02)' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Heatmap Original */}
        <div className="rounded-xl overflow-hidden flex flex-col" style={{ background: '#1c1a25', border: '1px solid rgba(74,68,85,0.1)', minHeight: '320px' }}>
          <div className="px-5 pt-4 pb-2">
            <h2 className="text-white font-bold text-base">Heatmap: Original UI</h2>
          </div>
          <div className="px-4 pb-4 flex-1 flex flex-col">
            <div className="relative rounded-lg overflow-hidden flex-1" style={{ background: '#0a0820' }}>
              <div className="absolute inset-0 p-4 opacity-30">
                <div className="flex gap-2 h-full">
                  <div className="w-14 space-y-1.5">{[1,2,3,4,5].map(n => <div key={n} className="h-2 rounded" style={{ background: 'rgba(255,255,255,0.1)' }} />)}</div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/2 rounded" style={{ background: 'rgba(255,255,255,0.08)' }} />
                    <div className="grid grid-cols-3 gap-2 flex-1">{[1,2,3].map(n => <div key={n} className="h-16 rounded" style={{ background: 'rgba(255,255,255,0.04)' }} />)}</div>
                    <div className="flex gap-2">
                      <div className="h-6 w-16 rounded" style={{ background: 'rgba(255,255,255,0.06)' }} />
                      <div className="h-6 w-16 rounded" style={{ background: 'rgba(255,255,255,0.04)' }} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute inset-0 pointer-events-none" style={{
                background: 'radial-gradient(ellipse at 45% 35%, rgba(255,0,0,0.6) 0%, rgba(255,100,0,0.3) 20%, transparent 45%), radial-gradient(ellipse at 30% 65%, rgba(255,80,0,0.5) 0%, rgba(255,165,0,0.2) 25%, transparent 45%), radial-gradient(ellipse at 70% 55%, rgba(255,0,0,0.35) 0%, transparent 30%)',
                mixBlendMode: 'screen',
              }} />
            </div>
          </div>
        </div>

        {/* Heatmap Refined */}
        <div className="rounded-xl overflow-hidden flex flex-col" style={{ background: '#1c1a25', border: '1px solid rgba(124,58,237,0.15)', minHeight: '320px' }}>
          <div className="px-5 pt-4 pb-2">
            <h2 className="text-white font-bold text-base">Heatmap: Refined UI</h2>
          </div>
          <div className="px-4 pb-4 flex-1 flex flex-col">
            <div className="relative rounded-lg overflow-hidden flex-1" style={{ background: '#0a0820' }}>
              <div className="absolute inset-0 p-4 opacity-30">
                <div className="flex gap-2 h-full">
                  <div className="w-14 space-y-1.5">{[1,2,3,4,5].map(n => <div key={n} className="h-2 rounded" style={{ background: 'rgba(124,58,237,0.15)' }} />)}</div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/2 rounded" style={{ background: 'rgba(124,58,237,0.1)' }} />
                    <div className="grid grid-cols-3 gap-2 flex-1">{[1,2,3].map(n => <div key={n} className="h-16 rounded" style={{ background: 'rgba(124,58,237,0.06)' }} />)}</div>
                    <div className="flex gap-2">
                      <div className="h-6 w-16 rounded" style={{ background: 'rgba(124,58,237,0.08)' }} />
                      <div className="h-6 w-16 rounded" style={{ background: 'rgba(124,58,237,0.05)' }} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute inset-0 pointer-events-none" style={{
                background: 'radial-gradient(ellipse at 35% 30%, rgba(80,0,255,0.4) 0%, rgba(100,50,255,0.2) 25%, transparent 50%), radial-gradient(ellipse at 65% 50%, rgba(255,0,0,0.3) 0%, rgba(255,100,0,0.15) 20%, transparent 40%), radial-gradient(ellipse at 50% 75%, rgba(0,50,255,0.3) 0%, transparent 40%)',
                mixBlendMode: 'screen',
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── SOURCE CONTROL DROP-UP ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        {/* Expanded panel */}
        <div
          className="overflow-hidden transition-all duration-300 ease-out"
          style={{
            maxHeight: scOpen ? '320px' : '0px',
            background: 'rgba(15,13,24,0.97)',
            backdropFilter: 'blur(20px)',
            borderTop: scOpen ? '1px solid rgba(124,58,237,0.15)' : 'none',
          }}
        >
          <div className="max-w-5xl mx-auto px-6 py-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-0">
              {COMMITS.map((c, i) => (
                <div key={i} className="flex items-center gap-2.5 py-1.5">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color, boxShadow: `0 0 4px ${c.color}40` }} />
                  <span className="text-[10px] font-mono w-14 flex-shrink-0" style={{ color: 'rgba(204,195,216,0.3)' }}>{c.hash}</span>
                  <span className="text-[11px] text-white font-medium flex-1 truncate">{c.msg}</span>
                  <span className="text-[9px] flex-shrink-0" style={{ color: 'rgba(204,195,216,0.15)' }}>{c.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Toggle bar */}
        <button
          onClick={() => setScOpen(!scOpen)}
          className="w-full flex items-center justify-center gap-2 py-2.5 transition-colors"
          style={{
            background: 'rgba(15,13,24,0.95)',
            backdropFilter: 'blur(12px)',
            borderTop: '1px solid rgba(74,68,85,0.15)',
          }}
        >
          <span className="material-symbols-outlined text-sm" style={{ color: '#d2bbff' }}>commit</span>
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(204,195,216,0.5)' }}>Source Control</span>
          <span
            className="material-symbols-outlined text-sm transition-transform duration-300"
            style={{ color: 'rgba(204,195,216,0.3)', transform: scOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            expand_less
          </span>
        </button>
      </div>
    </div>
  )
}
