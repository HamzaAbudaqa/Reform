'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const COMMITS = [
  { hash: 'a717c5', msg: 'fix: navigation jumping', color: '#a855f7' },
  { hash: 'a712c1', msg: 'fix: navigation jumping', color: '#a855f7' },
  { hash: 'a712c1', msg: 'fix: navigation jumping', color: '#3b82f6' },
  { hash: 'c1a9d5', msg: 'feat: add auth flow', color: '#ef4444' },
  { hash: 'c1a9d5', msg: 'feat: add auth flow', color: '#ef4444' },
  { hash: 'c1a9d5', msg: 'chore: dependency update', color: '#f59e0b' },
  { hash: 'o01371', msg: 'feat: add auth flow', color: '#f59e0b' },
  { hash: 'o0fd71', msg: 'feat: add auth flow', color: '#a855f7' },
  { hash: 'o0d77c', msg: 'chore: dependency update', color: '#3b82f6' },
  { hash: 'c1e9d5', msg: 'feat: add auth flow', color: '#3b82f6' },
  { hash: 'c1a83a', msg: 'feat: add auth flow', color: '#a855f7' },
  { hash: 'e83321', msg: 'feat: add auth flow', color: '#f59e0b' },
]

interface AnalysisData {
  meta: { project_style_goal: string; description: string }
  sources: { url: string; page_type: string }[]
  design_tokens: Record<string, unknown>
}

function BrowserFrame({ children, label, accent = false }: { children: React.ReactNode; label: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-2 flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: accent ? '#a855f7' : 'rgba(255,255,255,0.2)' }} />
        <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</span>
      </div>
      <div className="rounded-xl overflow-hidden flex flex-col" style={{
        border: accent ? '1px solid rgba(168,85,247,0.3)' : '1px solid rgba(255,255,255,0.06)',
        boxShadow: accent ? '0 0 40px rgba(124,58,237,0.15)' : '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div className="border-b px-3 py-1.5 flex items-center gap-1.5" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="w-2 h-2 rounded-full bg-red-500/60" />
          <div className="w-2 h-2 rounded-full bg-amber-500/60" />
          <div className="w-2 h-2 rounded-full bg-emerald-500/60" />
        </div>
        <div style={{ background: '#0d0c16', minHeight: '280px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

export default function TransformPage() {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null)
  const [scOpen, setScOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const stored = sessionStorage.getItem('refineui_analysis')
    if (stored) { try { setAnalysis(JSON.parse(stored)) } catch { /* */ } }
  }, [])

  if (!analysis) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-center max-w-sm">
          <h2 className="text-xl font-bold text-white mb-2">No Analysis Data</h2>
          <p className="text-[13px] mb-6" style={{ color: 'rgba(255,255,255,0.35)' }}>Complete a Project Discovery first.</p>
          <button onClick={() => router.push('/dashboard/discovery')} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 0 30px rgba(124,58,237,0.2)' }}>
            Start Discovery
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-center px-6 py-10 pb-20">
      <div className="w-full max-w-6xl space-y-10">

        {/* ── HERO: Before / After ── */}
        <div>
          <h1 className="text-3xl font-bold text-white text-center mb-8">UI Transformation</h1>
          <div className="flex flex-col lg:flex-row gap-6">
            <BrowserFrame label="Before">
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="w-3.5 h-3.5 rounded-full" style={{ background: '#7c3aed' }} />
                  <span className="text-[9px] font-semibold text-white">RefineUI</span>
                  <div className="flex-1" />
                  <div className="flex gap-1">{[1,2,3].map(n => <div key={n} className="h-2.5 w-6 rounded" style={{ background: 'rgba(255,255,255,0.05)' }} />)}</div>
                </div>
                <div className="flex gap-2">
                  <div className="w-20 space-y-1.5">
                    {['Discovery', 'Competitors', 'Design', 'Insights'].map(n => (
                      <div key={n} className="px-2 py-1 rounded text-[7px]" style={{ background: n === 'Discovery' ? 'rgba(255,255,255,0.06)' : 'transparent', color: 'rgba(255,255,255,0.4)' }}>{n}</div>
                    ))}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="text-[8px] font-semibold text-white/60 px-1">Discovery</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {['Companies', 'Context'].map(l => (
                        <div key={l} className="rounded-lg p-2 space-y-1.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                          <div className="text-[6px] font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>{l}</div>
                          {[70,85,55].map((w, i) => <div key={i} className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.04)', width: `${w}%` }} />)}
                        </div>
                      ))}
                    </div>
                    <div className="h-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }} />
                  </div>
                </div>
                <div className="mt-3 px-1"><span className="text-[6px]" style={{ color: 'rgba(255,255,255,0.15)' }}>Settings</span></div>
              </div>
            </BrowserFrame>

            {/* Arrow */}
            <div className="hidden lg:flex items-center justify-center">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 0 30px rgba(124,58,237,0.3)' }}>
                <span className="text-white text-lg">→</span>
              </div>
            </div>

            <BrowserFrame label="After" accent>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded-lg" style={{ background: 'rgba(168,85,247,0.06)' }}>
                  <div className="w-3.5 h-3.5 rounded-full" style={{ background: '#7c3aed' }} />
                  <span className="text-[9px] font-semibold text-white">RefineUI</span>
                  <div className="flex-1" />
                  <div className="flex gap-1">
                    <span className="text-[6px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(168,85,247,0.15)', color: 'rgba(168,85,247,0.8)' }}>Pro</span>
                    <span className="text-[6px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.15)', color: '#86efac' }}>Live</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="w-16 space-y-1">
                    {['Team', 'Yours', 'Config', 'Library'].map((n, i) => (
                      <div key={n} className="px-1.5 py-1 rounded text-[6px]" style={{ background: i === 0 ? 'rgba(168,85,247,0.08)' : 'transparent', color: i === 0 ? 'rgba(168,85,247,0.7)' : 'rgba(255,255,255,0.25)' }}>{n}</div>
                    ))}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="text-[8px] font-semibold text-white/70 px-1">Discovery</div>
                    <div className="text-[6px] px-1" style={{ color: 'rgba(255,255,255,0.2)' }}>Latest AI inspection</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {['Frameworks', 'Context'].map(l => (
                        <div key={l} className="rounded-lg p-2 space-y-1.5" style={{ background: 'rgba(168,85,247,0.03)', border: '1px solid rgba(168,85,247,0.08)' }}>
                          <div className="text-[6px] font-semibold" style={{ color: 'rgba(168,85,247,0.6)' }}>{l}</div>
                          {[75,60,90].map((w, i) => <div key={i} className="h-1.5 rounded-full" style={{ background: 'rgba(168,85,247,0.06)', width: `${w}%` }} />)}
                        </div>
                      ))}
                    </div>
                    <div className="h-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.01)' }} />
                  </div>
                </div>
              </div>
            </BrowserFrame>
          </div>
        </div>

        {/* ── SECONDARY: Heatmaps (small) ── */}
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-center mb-4" style={{ color: 'rgba(255,255,255,0.2)' }}>Predicted Attention Analysis</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-4xl mx-auto">
            {[
              { label: 'Original UI', gradient: 'radial-gradient(ellipse at 45% 35%, rgba(255,0,0,0.5) 0%, rgba(255,100,0,0.25) 20%, transparent 45%), radial-gradient(ellipse at 30% 65%, rgba(255,80,0,0.4) 0%, transparent 40%)' },
              { label: 'Refined UI', gradient: 'radial-gradient(ellipse at 35% 30%, rgba(80,0,255,0.35) 0%, transparent 45%), radial-gradient(ellipse at 65% 50%, rgba(255,0,0,0.25) 0%, transparent 35%), radial-gradient(ellipse at 50% 75%, rgba(0,50,255,0.25) 0%, transparent 40%)' },
            ].map((hm) => (
              <div key={hm.label} className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="px-4 pt-3 pb-2">
                  <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>Heatmap: {hm.label}</span>
                </div>
                <div className="px-3 pb-3">
                  <div className="relative rounded-lg overflow-hidden" style={{ background: '#0a0820', aspectRatio: '16/7' }}>
                    <div className="absolute inset-0 p-3 opacity-20">
                      <div className="flex gap-2 h-full">
                        <div className="w-10 space-y-1">{[1,2,3,4].map(n => <div key={n} className="h-1.5 rounded" style={{ background: 'rgba(255,255,255,0.1)' }} />)}</div>
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 w-1/2 rounded" style={{ background: 'rgba(255,255,255,0.06)' }} />
                          <div className="grid grid-cols-3 gap-1">{[1,2,3].map(n => <div key={n} className="h-10 rounded" style={{ background: 'rgba(255,255,255,0.03)' }} />)}</div>
                        </div>
                      </div>
                    </div>
                    <div className="absolute inset-0 pointer-events-none" style={{ background: hm.gradient, mixBlendMode: 'screen' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SOURCE CONTROL — liquid glass, bottom-left ── */}
      <div className="fixed bottom-5 left-5 z-40">
        {/* Expanded panel */}
        <div
          className="overflow-hidden transition-all duration-300 ease-out rounded-2xl mb-2"
          style={{
            maxHeight: scOpen ? '320px' : '0px',
            width: '300px',
            opacity: scOpen ? 1 : 0,
            background: 'rgba(19,17,28,0.6)',
            backdropFilter: 'blur(24px) saturate(1.5)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
            border: scOpen ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
            boxShadow: scOpen ? '0 24px 80px rgba(0,0,0,0.6), 0 0 40px rgba(124,58,237,0.08)' : 'none',
          }}
        >
          <div className="p-4 overflow-y-auto" style={{ maxHeight: '300px' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>Source Control</span>
              <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.15)' }}>{COMMITS.length} commits</span>
            </div>
            <div className="relative">
              <div className="absolute left-[4px] top-1 bottom-1 w-[1.5px]" style={{ background: 'linear-gradient(to bottom, rgba(168,85,247,0.4), rgba(59,130,246,0.3), rgba(239,68,68,0.3), rgba(245,158,11,0.3), rgba(168,85,247,0.2))' }} />
              {COMMITS.map((c, i) => (
                <div key={i} className="flex items-center gap-2.5 py-[5px] relative">
                  <div className="w-[9px] h-[9px] rounded-full flex-shrink-0 z-10" style={{ background: c.color, boxShadow: `0 0 6px ${c.color}30` }} />
                  <span className="text-[9px] font-mono w-11 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }}>{c.hash}</span>
                  <span className="text-[10px] text-white/60 font-medium flex-1 truncate">{c.msg}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Toggle pill */}
        <button
          onClick={() => setScOpen(!scOpen)}
          className="flex items-center gap-2 px-4 py-2 rounded-full transition-all active:scale-95"
          style={{
            background: 'rgba(19,17,28,0.6)',
            backdropFilter: 'blur(20px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 20px rgba(124,58,237,0.06)',
          }}
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: scOpen ? '#22c55e' : '#a855f7', boxShadow: scOpen ? '0 0 6px rgba(34,197,94,0.4)' : '0 0 6px rgba(168,85,247,0.3)' }} />
          <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Source Control</span>
          <span className="text-[8px] transition-transform duration-300" style={{ color: 'rgba(255,255,255,0.2)', transform: scOpen ? 'rotate(180deg)' : '' }}>▲</span>
        </button>
      </div>
    </div>
  )
}
