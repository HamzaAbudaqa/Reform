'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Editor from '@monaco-editor/react'

interface CommitEntry {
  hash: string
  msg: string
  color: string
  status: 'accepted' | 'rejected' | 'pending'
  code?: string
  suggestion?: string
}

const INITIAL_COMMITS: CommitEntry[] = []

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
  const [commits, setCommits] = useState<CommitEntry[]>(INITIAL_COMMITS)
  const [changeStatus, setChangeStatus] = useState<'pending' | 'accepted' | 'rejected'>('pending')
  const [showSuggestModal, setShowSuggestModal] = useState(false)
  const [suggestTab, setSuggestTab] = useState<'text' | 'voice' | 'code'>('text')
  const [suggestion, setSuggestion] = useState('')
  const [codeEdit, setCodeEdit] = useState('')
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [selectedCommit, setSelectedCommit] = useState<CommitEntry | null>(null)
  const router = useRouter()

  useEffect(() => {
    const stored = sessionStorage.getItem('refineui_analysis')
    if (stored) { try { setAnalysis(JSON.parse(stored)) } catch { /* */ } }
  }, [])

  function handleAccept() {
    setChangeStatus('accepted')
    const hasPending = commits.some(c => c.status === 'pending')
    if (hasPending) {
      // Update ALL pending commits to accepted
      setCommits(prev => prev.map(c =>
        c.status === 'pending' ? { ...c, status: 'accepted', color: '#22c55e' } : c
      ))
    } else {
      const newCommit: CommitEntry = {
        hash: Math.random().toString(16).slice(2, 8),
        msg: 'feat: apply UI transformation',
        color: '#22c55e',
        status: 'accepted',
      }
      setCommits(prev => [newCommit, ...prev])
    }
    setScOpen(true)
  }

  function handleReject() {
    setChangeStatus('rejected')
    const hasPending = commits.some(c => c.status === 'pending')
    if (hasPending) {
      // Update ALL pending commits to rejected
      setCommits(prev => prev.map(c =>
        c.status === 'pending' ? { ...c, status: 'rejected', color: '#ef4444' } : c
      ))
    } else {
      const newCommit: CommitEntry = {
        hash: Math.random().toString(16).slice(2, 8),
        msg: 'feat: UI transformation',
        color: '#ef4444',
        status: 'rejected',
      }
      setCommits(prev => [newCommit, ...prev])
    }
    setScOpen(true)
  }

  async function handleSuggestSubmit() {
    const promptText = suggestion.trim()
    if (!promptText) return
    setSuggestLoading(true)

    try {
      const currentCode = sessionStorage.getItem('refineui_analysis') || ''
      const res = await fetch('http://localhost:8000/suggest-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestion: promptText,
          current_code: currentCode,
          analysis_context: analysis,
        }),
      })

      if (!res.ok) throw new Error('Suggest edit failed')
      const data = await res.json()

      const newCommit: CommitEntry = {
        hash: Math.random().toString(16).slice(2, 8),
        msg: `edit: ${data.summary || promptText.slice(0, 40)}`,
        color: '#f59e0b',
        status: 'pending',
        code: data.revised_code,
        suggestion: promptText,
      }
      setCommits(prev => [newCommit, ...prev])
      setChangeStatus('pending')
      setShowSuggestModal(false)
      setSuggestion('')
      setScOpen(true)
    } catch {
      const newCommit: CommitEntry = {
        hash: Math.random().toString(16).slice(2, 8),
        msg: `edit: ${promptText.slice(0, 40)}`,
        color: '#f59e0b',
        status: 'pending',
        suggestion: promptText,
      }
      setCommits(prev => [newCommit, ...prev])
      setShowSuggestModal(false)
      setSuggestion('')
      setScOpen(true)
    } finally {
      setSuggestLoading(false)
    }
  }

  function handleCodeSubmit() {
    if (!codeEdit.trim()) return
    const newCommit: CommitEntry = {
      hash: Math.random().toString(16).slice(2, 8),
      msg: 'edit: manual code change',
      color: '#f59e0b',
      status: 'pending',
      code: codeEdit,
      suggestion: 'Manual code edit via IDE',
    }
    setCommits(prev => [newCommit, ...prev])
    setShowSuggestModal(false)
    setCodeEdit('')
    setScOpen(true)
  }

  function openSuggestModal() {
    // Pre-populate the code editor with existing generated code if available
    const storedAnalysis = sessionStorage.getItem('refineui_analysis')
    if (storedAnalysis && !codeEdit) {
      setCodeEdit(`export default function Dashboard() {\n  return (\n    <div className="flex gap-6 p-8">\n      <Sidebar />\n      <MainContent />\n    </div>\n  )\n}`)
    }
    setSuggestTab('text')
    setShowSuggestModal(true)
  }

  function handleCommitClick(commit: CommitEntry) {
    setSelectedCommit(commit)
  }

  function handleAcceptRejected(commit: CommitEntry) {
    setCommits(prev =>
      prev.map(c => c.hash === commit.hash && c.msg === commit.msg ? { ...c, status: 'accepted', color: '#22c55e' } : c)
    )
    setSelectedCommit({ ...commit, status: 'accepted', color: '#22c55e' })
  }

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
                <span className="text-white text-lg">&rarr;</span>
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

        {/* ── TOOLBAR: Accept / Reject / Suggest ── */}
        <div className="flex items-center justify-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {changeStatus === 'pending' ? (
              <>
                <button
                  onClick={handleAccept}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all active:scale-[0.97]"
                  style={{ background: 'rgba(34,197,94,0.1)', color: '#86efac', border: '1px solid rgba(34,197,94,0.15)' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  Accept
                </button>
                <button
                  onClick={handleReject}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all active:scale-[0.97]"
                  style={{ background: 'rgba(239,68,68,0.1)', color: 'rgba(239,68,68,0.7)', border: '1px solid rgba(239,68,68,0.15)' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  Reject
                </button>
                <div className="w-px h-5" style={{ background: 'rgba(255,255,255,0.06)' }} />
                <button
                  onClick={openSuggestModal}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all active:scale-[0.97]"
                  style={{ background: 'rgba(245,158,11,0.1)', color: 'rgba(245,158,11,0.7)', border: '1px solid rgba(245,158,11,0.15)' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  Suggest Edit
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: changeStatus === 'accepted' ? '#22c55e' : '#ef4444' }} />
                <span className="text-[11px] font-medium" style={{ color: changeStatus === 'accepted' ? '#86efac' : 'rgba(239,68,68,0.7)' }}>
                  {changeStatus === 'accepted' ? 'Changes accepted' : 'Changes rejected'}
                </span>
                <button
                  onClick={() => setChangeStatus('pending')}
                  className="text-[10px] px-2 py-1 rounded-lg ml-2"
                  style={{ color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  Reset
                </button>
              </div>
            )}
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
            maxHeight: scOpen ? '380px' : '0px',
            width: '340px',
            opacity: scOpen ? 1 : 0,
            background: 'rgba(19,17,28,0.6)',
            backdropFilter: 'blur(24px) saturate(1.5)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
            border: scOpen ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
            boxShadow: scOpen ? '0 24px 80px rgba(0,0,0,0.6), 0 0 40px rgba(124,58,237,0.08)' : 'none',
          }}
        >
          <div className="p-4 overflow-y-auto" style={{ maxHeight: '360px' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>Source Control</span>
              <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.15)' }}>{commits.length} commits</span>
            </div>
            <div className="relative">
              <div className="absolute left-[4px] top-1 bottom-1 w-[1.5px]" style={{ background: 'linear-gradient(to bottom, rgba(168,85,247,0.4), rgba(59,130,246,0.3), rgba(239,68,68,0.3), rgba(245,158,11,0.3), rgba(168,85,247,0.2))' }} />
              {commits.map((c, i) => (
                <div
                  key={i}
                  onClick={() => handleCommitClick(c, i)}
                  className="flex items-center gap-2.5 py-[5px] relative cursor-pointer rounded-lg px-1 -mx-1 transition-colors hover:bg-white/[0.03]"
                >
                  <div className="w-[9px] h-[9px] rounded-full flex-shrink-0 z-10" style={{ background: c.color, boxShadow: `0 0 6px ${c.color}30` }} />
                  <span className="text-[9px] font-mono w-11 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }}>{c.hash}</span>
                  <span className="text-[10px] text-white/60 font-medium flex-1 truncate">{c.msg}</span>
                  {c.status === 'rejected' && (
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                      REJECTED
                    </span>
                  )}
                  {c.status === 'pending' && (
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
                      PENDING
                    </span>
                  )}
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
          <span className="text-[8px] transition-transform duration-300" style={{ color: 'rgba(255,255,255,0.2)', transform: scOpen ? 'rotate(180deg)' : '' }}>&#9650;</span>
        </button>
      </div>

      {/* ── SUGGEST EDIT MODAL ── */}
      {showSuggestModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(12px)' }}>
          <div className="rounded-2xl w-full max-w-3xl mx-4 overflow-hidden" style={{ background: 'linear-gradient(180deg, rgba(30,27,46,1) 0%, rgba(19,17,28,1) 100%)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 0 80px rgba(0,0,0,0.6), 0 0 40px rgba(124,58,237,0.08)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <h2 className="text-white font-semibold text-base">Suggest an Edit</h2>
                <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Choose how you&apos;d like to describe your change</p>
              </div>
              <button onClick={() => setShowSuggestModal(false)} className="text-[14px] w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/[0.05]" style={{ color: 'rgba(255,255,255,0.3)' }}>&#10005;</button>
            </div>

            {/* Tabs */}
            <div className="flex px-6 pt-4 gap-1">
              {([
                { key: 'text' as const, label: 'Text Prompt', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg> },
                { key: 'voice' as const, label: 'Voice Prompt', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg> },
                { key: 'code' as const, label: 'Code Editor', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg> },
              ]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setSuggestTab(tab.key)}
                  className="flex items-center gap-2 px-4 py-2 rounded-t-lg text-[11px] font-medium transition-colors"
                  style={suggestTab === tab.key ? {
                    background: 'rgba(255,255,255,0.04)',
                    color: 'white',
                    borderTop: '2px solid #a855f7',
                    borderLeft: '1px solid rgba(255,255,255,0.06)',
                    borderRight: '1px solid rgba(255,255,255,0.06)',
                  } : {
                    color: 'rgba(255,255,255,0.35)',
                  }}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="px-6 pb-6">
              <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>

                {/* TEXT PROMPT TAB */}
                {suggestTab === 'text' && (
                  <div className="p-5">
                    <textarea
                      autoFocus
                      value={suggestion}
                      onChange={e => setSuggestion(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleSuggestSubmit() }}
                      placeholder="Describe what you'd like to change... (e.g., 'Make the sidebar collapsible', 'Change the accent color to blue')"
                      className="w-full bg-transparent text-[13px] text-white outline-none resize-none"
                      style={{ minHeight: '120px', lineHeight: '1.6' }}
                      disabled={suggestLoading}
                    />
                    <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.15)' }}>&#8984; + Enter to submit</span>
                      <button
                        onClick={handleSuggestSubmit}
                        disabled={suggestLoading || !suggestion.trim()}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-semibold transition-all active:scale-[0.97]"
                        style={{
                          background: suggestion.trim() ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : 'rgba(255,255,255,0.04)',
                          color: suggestion.trim() ? 'white' : 'rgba(255,255,255,0.2)',
                          boxShadow: suggestion.trim() ? '0 0 20px rgba(124,58,237,0.2)' : 'none',
                        }}
                      >
                        {suggestLoading ? (
                          <>
                            <div className="w-3.5 h-3.5 rounded-full animate-spin" style={{ border: '2px solid rgba(255,255,255,0.2)', borderTopColor: 'white' }} />
                            Processing...
                          </>
                        ) : (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                            Send to AI
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* VOICE PROMPT TAB */}
                {suggestTab === 'voice' && (
                  <div className="relative p-10 flex flex-col items-center justify-center overflow-hidden" style={{ minHeight: '280px' }}>
                    {/* Animated background rings */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="absolute w-64 h-64 rounded-full animate-pulse" style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%)' }} />
                      <div className="absolute w-48 h-48 rounded-full animate-ping" style={{ background: 'rgba(124,58,237,0.03)', animationDuration: '3s' }} />
                      <div className="absolute w-36 h-36 rounded-full animate-ping" style={{ background: 'rgba(168,85,247,0.04)', animationDuration: '2.5s', animationDelay: '0.5s' }} />
                    </div>

                    {/* Mic button with glow rings */}
                    <div className="relative mb-6">
                      <div className="absolute -inset-4 rounded-full" style={{ background: 'conic-gradient(from 0deg, rgba(124,58,237,0.15), rgba(168,85,247,0.05), rgba(59,130,246,0.1), rgba(124,58,237,0.15))', filter: 'blur(8px)' }} />
                      <div className="absolute -inset-2 rounded-full" style={{ border: '1px solid rgba(168,85,247,0.15)' }} />
                      <button
                        className="relative w-20 h-20 rounded-full flex items-center justify-center transition-all active:scale-90"
                        style={{
                          background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(168,85,247,0.1))',
                          border: '1.5px solid rgba(168,85,247,0.3)',
                          boxShadow: '0 0 30px rgba(124,58,237,0.2), inset 0 0 20px rgba(124,58,237,0.1)',
                        }}
                      >
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" fill="rgba(168,85,247,0.3)" stroke="#a855f7" strokeWidth="1.5" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="#a855f7" strokeWidth="1.5" />
                          <line x1="12" y1="19" x2="12" y2="23" stroke="#a855f7" strokeWidth="1.5" />
                          <line x1="8" y1="23" x2="16" y2="23" stroke="#a855f7" strokeWidth="1.5" />
                        </svg>
                      </button>
                    </div>

                    <p className="text-[14px] font-semibold text-white mb-1 relative">Tap to Record</p>
                    <p className="text-[11px] mb-5 relative" style={{ color: 'rgba(255,255,255,0.3)' }}>Speak your change &mdash; AI will interpret and apply it</p>

                    {/* Waveform placeholder */}
                    <div className="flex items-end gap-[3px] h-8 mb-5 relative">
                      {[3, 5, 8, 12, 16, 20, 16, 12, 8, 14, 18, 22, 18, 14, 10, 6, 4, 7, 11, 15, 11, 7, 4, 6, 9].map((h, i) => (
                        <div
                          key={i}
                          className="w-[2px] rounded-full animate-pulse"
                          style={{
                            height: `${h}px`,
                            background: 'linear-gradient(to top, rgba(124,58,237,0.3), rgba(168,85,247,0.6))',
                            animationDelay: `${i * 0.08}s`,
                            animationDuration: '1.5s',
                          }}
                        />
                      ))}
                    </div>

                    {/* Coming soon badge */}
                    <div className="relative px-4 py-1.5 rounded-full" style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)', boxShadow: '0 0 15px rgba(124,58,237,0.1)' }}>
                      <span className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: 'rgba(168,85,247,0.7)' }}>Coming Soon</span>
                    </div>
                  </div>
                )}

                {/* CODE EDITOR TAB */}
                {suggestTab === 'code' && (
                  <div className="flex flex-col">
                    {/* Editor toolbar */}
                    <div className="flex items-center justify-between px-4 py-2" style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>Dashboard.tsx</span>
                      </div>
                      <span className="text-[9px] font-medium px-2 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.1)', color: '#86efac', border: '1px solid rgba(34,197,94,0.15)' }}>Editable</span>
                    </div>
                    {/* Monaco Editor */}
                    <div style={{ height: '340px' }}>
                      <Editor
                        height="100%"
                        defaultLanguage="typescript"
                        value={codeEdit}
                        onChange={(val) => setCodeEdit(val || '')}
                        theme="vs-dark"
                        options={{
                          minimap: { enabled: false },
                          fontSize: 13,
                          lineHeight: 22,
                          padding: { top: 12, bottom: 12 },
                          scrollBeyondLastLine: false,
                          wordWrap: 'on',
                          tabSize: 2,
                          renderLineHighlight: 'gutter',
                          scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
                          overviewRulerLanes: 0,
                          hideCursorInOverviewRuler: true,
                          overviewRulerBorder: false,
                        }}
                      />
                    </div>
                    {/* Submit bar */}
                    <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.01)' }}>
                      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.15)' }}>Edit the code directly, then submit</span>
                      <button
                        onClick={handleCodeSubmit}
                        disabled={!codeEdit.trim()}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-semibold transition-all active:scale-[0.97]"
                        style={{
                          background: codeEdit.trim() ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : 'rgba(255,255,255,0.04)',
                          color: codeEdit.trim() ? 'white' : 'rgba(255,255,255,0.2)',
                          boxShadow: codeEdit.trim() ? '0 0 20px rgba(124,58,237,0.2)' : 'none',
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        Submit Code
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── COMMIT DETAIL MODAL ── */}
      {selectedCommit && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
          <div className="rounded-2xl p-6 max-w-lg w-full mx-4" style={{ background: 'linear-gradient(180deg, rgba(30,27,46,1) 0%, rgba(19,17,28,1) 100%)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 0 60px rgba(0,0,0,0.5)' }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ background: selectedCommit.color, boxShadow: `0 0 8px ${selectedCommit.color}40` }} />
                <span className="text-[12px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>{selectedCommit.hash}</span>
              </div>
              <button onClick={() => setSelectedCommit(null)} className="text-[14px]" style={{ color: 'rgba(255,255,255,0.3)' }}>&#10005;</button>
            </div>

            {/* Commit message */}
            <h3 className="text-white font-semibold text-base mb-2">{selectedCommit.msg}</h3>

            {/* Status badge */}
            <div className="mb-4">
              {selectedCommit.status === 'rejected' && (
                <span className="text-[10px] font-bold px-2 py-1 rounded" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                  REJECTED
                </span>
              )}
              {selectedCommit.status === 'accepted' && (
                <span className="text-[10px] font-bold px-2 py-1 rounded" style={{ background: 'rgba(34,197,94,0.15)', color: '#86efac', border: '1px solid rgba(34,197,94,0.2)' }}>
                  ACCEPTED
                </span>
              )}
              {selectedCommit.status === 'pending' && (
                <span className="text-[10px] font-bold px-2 py-1 rounded" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
                  PENDING
                </span>
              )}
            </div>

            {/* Suggestion text if available */}
            {selectedCommit.suggestion && (
              <div className="mb-4 px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="text-[9px] font-medium uppercase tracking-wider block mb-1" style={{ color: 'rgba(255,255,255,0.2)' }}>Suggested Edit</span>
                <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.6)' }}>{selectedCommit.suggestion}</p>
              </div>
            )}

            {/* Code preview if available */}
            {selectedCommit.code && (
              <div className="mb-4 rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="px-3 py-1.5" style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="text-[9px] font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.2)' }}>Code Preview</span>
                </div>
                <pre className="p-3 text-[10px] overflow-x-auto" style={{ background: 'rgba(0,0,0,0.3)', color: 'rgba(255,255,255,0.5)', maxHeight: '200px' }}>
                  {selectedCommit.code.slice(0, 500)}{selectedCommit.code.length > 500 ? '\n...' : ''}
                </pre>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 mt-4">
              {(selectedCommit.status === 'rejected' || selectedCommit.status === 'pending') && (
                <button
                  onClick={() => handleAcceptRejected(selectedCommit)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-semibold transition-all active:scale-[0.97]"
                  style={{ background: 'rgba(34,197,94,0.1)', color: '#86efac', border: '1px solid rgba(34,197,94,0.15)' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  Accept{selectedCommit.status === 'rejected' ? ' Now' : ''}
                </button>
              )}
              <button
                onClick={() => setSelectedCommit(null)}
                className="px-4 py-2 rounded-lg text-[11px] font-medium"
                style={{ color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
