'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useProgress } from '@/components/dashboard/ProgressContext'

const QUESTIONS = [
  { key: 'product_type', label: 'What are you building?', placeholder: 'e.g., Dashboard, Mobile app, SaaS platform, E-commerce store' },
  { key: 'industry', label: 'What industry or field?', placeholder: 'e.g., Fintech, Healthcare, Education, DevTools, Logistics' },
  { key: 'target_audience', label: 'Who is your target user?', placeholder: 'e.g., Developers, Small business owners, Students, Enterprise teams' },
  { key: 'core_feature', label: 'What is the core feature?', placeholder: 'e.g., AI code completion, Invoice management, Real-time collaboration' },
  { key: 'competitors_known', label: 'Name any competitors you already know', placeholder: 'e.g., Linear, Notion, Stripe, Figma', optional: true },
] as const

interface DiscoveryData {
  project_category: string
  competitors: { name: string; url: string; reason: string; relevance: number }[]
  selected_for_analysis: string[]
}

export default function DiscoveryPage() {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState('')
  const [error, setError] = useState('')
  const [completed, setCompleted] = useState(false)
  const [discovery, setDiscovery] = useState<DiscoveryData | null>(null)
  const router = useRouter()
  const { startProgress, updateProgress, finishProgress } = useProgress()

  // On mount, check if we already have results
  useEffect(() => {
    const storedDiscovery = sessionStorage.getItem('refineui_discovery')
    const storedAnswers = sessionStorage.getItem('refineui_answers')
    if (storedDiscovery && storedAnswers) {
      setDiscovery(JSON.parse(storedDiscovery))
      setAnswers(JSON.parse(storedAnswers))
      setCompleted(true)
    }
  }, [])

  const currentQ = QUESTIONS[currentStep]
  const isLastStep = currentStep === QUESTIONS.length - 1

  const isOptional = 'optional' in currentQ && currentQ.optional

  function handleNext() {
    if (!isOptional && !answers[currentQ.key]?.trim()) return
    if (isLastStep) {
      handleFullPipeline()
    } else {
      setCurrentStep(currentStep + 1)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleNext()
    }
  }

  async function handleFullPipeline() {
    const description = QUESTIONS.map(q => `${q.label} ${answers[q.key]}`).join('. ')
    setLoading(true)
    setError('')
    startProgress('Running full analysis pipeline...')

    try {
      // Step 1: Discover competitors
      setLoadingStatus('Finding competitors in your space...')
      updateProgress(10)
      const discoverRes = await fetch('http://localhost:8000/discover-competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_description: description, style_goal: '' }),
      })
      if (!discoverRes.ok) throw new Error('Discovery failed')
      const discoveryData = await discoverRes.json()

      // Step 2: Analyze top 5 with TinyFish
      setLoadingStatus(`Analyzing ${discoveryData.selected_for_analysis.length} sites with TinyFish...`)
      updateProgress(35)
      const analyzeRes = await fetch('http://localhost:8000/analyze-competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: discoveryData.selected_for_analysis, style_goal: '' }),
      })
      if (!analyzeRes.ok) throw new Error('Analysis failed')
      const analysis = await analyzeRes.json()

      updateProgress(90)
      setLoadingStatus('Pipeline complete!')

      // Store everything
      sessionStorage.setItem('refineui_discovery', JSON.stringify(discoveryData))
      sessionStorage.setItem('refineui_analysis', JSON.stringify(analysis))
      sessionStorage.setItem('refineui_answers', JSON.stringify(answers))

      finishProgress()
      setDiscovery(discoveryData)
      setCompleted(true)
      setLoading(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Pipeline failed')
      finishProgress()
      setLoading(false)
    }
  }

  // ── COMPLETED STATE ──
  if (completed && discovery) {
    return (
      <div className="px-6 py-6 max-w-6xl mx-auto">
        {/* Status bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-extrabold tracking-tight text-white">Project Discovery</h1>
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e' }} />
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#86efac' }}>Complete</span>
            </div>
            <span className="text-[10px] font-mono" style={{ color: 'rgba(204,195,216,0.3)' }}>
              {discovery.project_category} — {discovery.competitors.length} competitors
            </span>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* LEFT: Project Profile (3 cols) */}
          <div className="lg:col-span-3 rounded-xl p-5" style={{ background: '#1c1a25', border: '1px solid rgba(74,68,85,0.15)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(204,195,216,0.5)' }}>Project Brief</h2>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(124,58,237,0.1)', color: '#d2bbff' }}>AI-Generated Profile</span>
            </div>
            <div className="space-y-1">
              {QUESTIONS.map((q) => (
                <div
                  key={q.key}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors hover:bg-white/[0.015]"
                  style={{ borderBottom: '1px solid rgba(74,68,85,0.06)' }}
                >
                  <span className="text-[11px]" style={{ color: 'rgba(204,195,216,0.35)' }}>{q.label}</span>
                  <span className="text-[12px] font-medium text-white">{answers[q.key] || '—'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: Competitor Results (2 cols) */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            {/* Competitors card */}
            <div className="rounded-xl p-5 flex-1" style={{ background: '#1c1a25', border: '1px solid rgba(74,68,85,0.15)' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(204,195,216,0.5)' }}>Top Competitors Analyzed</h2>
                <span className="text-[10px] font-mono" style={{ color: 'rgba(204,195,216,0.25)' }}>{discovery.selected_for_analysis.length} / {discovery.competitors.length}</span>
              </div>
              <div className="space-y-1">
                {discovery.competitors.slice(0, 5).map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2 rounded-lg transition-colors hover:bg-white/[0.015]"
                    style={{ borderBottom: '1px solid rgba(74,68,85,0.06)' }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-[9px] font-bold" style={{ background: 'rgba(124,58,237,0.15)', color: '#d2bbff' }}>
                        {i + 1}
                      </div>
                      <span className="text-[12px] font-medium text-white truncate">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="w-10 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full rounded-full" style={{ width: `${c.relevance * 100}%`, background: '#d2bbff' }} />
                      </div>
                      <span className="text-[9px] font-mono w-7 text-right" style={{ color: 'rgba(204,195,216,0.35)' }}>{(c.relevance * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA card */}
            <div className="rounded-xl p-5" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(28,26,37,1))', border: '1px solid rgba(124,58,237,0.15)' }}>
              <p className="text-[11px] mb-4 leading-relaxed" style={{ color: 'rgba(204,195,216,0.5)' }}>
                Design intelligence extracted from {discovery.selected_for_analysis.length} competitors. Ready for UI transformation.
              </p>
              <button
                onClick={() => router.push('/dashboard/transform')}
                className="w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg, #d2bbff, #7c3aed)', color: '#3f008e' }}
              >
                View Transformation →
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── LOADING STATE ──
  if (loading) {
    return (
      <div className="px-8 py-8 flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 rounded-full mx-auto mb-5 animate-spin" style={{ border: '3px solid rgba(74,68,85,0.3)', borderTopColor: '#d2bbff' }} />
          <p className="text-white font-semibold mb-2">{loadingStatus || 'Starting pipeline...'}</p>
          <p className="text-xs" style={{ color: 'rgba(204,195,216,0.3)' }}>This takes 1-3 minutes. TinyFish visits each site in a real browser.</p>
        </div>
      </div>
    )
  }

  // ── QUESTIONNAIRE ──
  return (
    <div className="px-6 py-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-extrabold tracking-tight text-white mb-1">Project Discovery</h1>
      <p className="text-xs mb-8" style={{ color: 'rgba(204,195,216,0.4)' }}>
        Answer a few quick questions so we can find the best design references for your product.
      </p>

      {/* Progress bar */}
      <div className="max-w-xl mb-10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(204,195,216,0.4)' }}>
            Question {currentStep + 1} of {QUESTIONS.length}
          </span>
          <span className="text-[10px] font-mono" style={{ color: 'rgba(204,195,216,0.3)' }}>
            {Math.round(((currentStep + 1) / QUESTIONS.length) * 100)}%
          </span>
        </div>
        <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(74,68,85,0.3)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${((currentStep + 1) / QUESTIONS.length) * 100}%`, background: 'linear-gradient(90deg, #7c3aed, #d2bbff)' }}
          />
        </div>
      </div>

      {/* Current question */}
      <div className="max-w-xl">
        <label className="block text-white font-bold text-lg mb-4">
          {currentQ.label}
        </label>
        <input
          autoFocus
          type="text"
          placeholder={currentQ.placeholder}
          value={answers[currentQ.key] || ''}
          onChange={(e) => setAnswers({ ...answers, [currentQ.key]: e.target.value })}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent px-5 py-4 text-sm outline-none rounded-xl"
          style={{
            color: 'rgba(255,255,255,0.8)',
            border: '1px solid rgba(74,68,85,0.3)',
            background: 'rgba(255,255,255,0.02)',
          }}
        />

        {/* Nav buttons */}
        <div className="flex items-center gap-3 mt-6">
          {currentStep > 0 && (
            <button
              onClick={() => setCurrentStep(currentStep - 1)}
              className="px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest"
              style={{ color: 'rgba(204,195,216,0.5)', border: '1px solid rgba(74,68,85,0.3)' }}
            >
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={!isOptional && !answers[currentQ.key]?.trim()}
            className="px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all active:scale-95"
            style={{
              background: (isOptional || answers[currentQ.key]?.trim())
                ? 'linear-gradient(135deg, #d2bbff, #7c3aed)'
                : 'rgba(74,68,85,0.3)',
              color: (isOptional || answers[currentQ.key]?.trim()) ? '#3f008e' : 'rgba(204,195,216,0.3)',
            }}
          >
            {isLastStep ? 'Discover Competitors' : 'Next'}
          </button>
          {isOptional && !answers[currentQ.key]?.trim() && (
            <button
              onClick={handleNext}
              className="px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest"
              style={{ color: 'rgba(204,195,216,0.4)' }}
            >
              Skip
            </button>
          )}
          <span className="text-[10px] ml-2" style={{ color: 'rgba(204,195,216,0.2)' }}>
            press Enter ↵
          </span>
        </div>
      </div>

      {/* Answered summary */}
      {currentStep > 0 && (
        <div className="max-w-xl mt-10 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(204,195,216,0.3)' }}>Your answers</p>
          {QUESTIONS.slice(0, currentStep).map((q) => (
            <div
              key={q.key}
              className="flex items-center justify-between px-4 py-2.5 rounded-lg cursor-pointer transition-colors hover:bg-white/[0.02]"
              style={{ border: '1px solid rgba(74,68,85,0.1)' }}
              onClick={() => setCurrentStep(QUESTIONS.indexOf(q))}
            >
              <span className="text-xs" style={{ color: 'rgba(204,195,216,0.4)' }}>{q.label}</span>
              <span className="text-xs font-medium text-white">{answers[q.key]}</span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="max-w-xl mt-6 px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(255,180,171,0.1)', color: '#ffb4ab', border: '1px solid rgba(255,180,171,0.2)' }}>
          {error}
        </div>
      )}
    </div>
  )
}
