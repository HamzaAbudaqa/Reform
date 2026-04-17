'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useProgress } from '@/components/dashboard/ProgressContext'
import { apiUrl } from '@/lib/api'
import { setSelectedRepo } from '@/lib/selectedRepo'
import GateErrorBanner from '@/components/dashboard/GateError'

const MOCK_MODE = false

const MOCK_DISCOVERY: DiscoveryData = {
  project_category: 'SaaS / Developer Tools',
  competitors: [
    { name: 'Linear', url: 'https://linear.app', reason: 'Modern issue tracking with sleek UI', relevance: 0.95 },
    { name: 'Notion', url: 'https://notion.so', reason: 'All-in-one workspace with clean design', relevance: 0.88 },
    { name: 'Vercel', url: 'https://vercel.com', reason: 'Developer-focused deployment platform', relevance: 0.85 },
    { name: 'Railway', url: 'https://railway.app', reason: 'Minimal deployment UI', relevance: 0.82 },
    { name: 'Supabase', url: 'https://supabase.com', reason: 'Open source Firebase alternative', relevance: 0.78 },
  ],
  selected_for_analysis: ['https://linear.app', 'https://vercel.com', 'https://railway.app', 'https://notion.so', 'https://supabase.com'],
}

const MOCK_ANALYSIS = {
  meta: { project_style_goal: 'minimal, developer-focused', description: 'Mock analysis' },
  sources: MOCK_DISCOVERY.selected_for_analysis.map(url => ({ url, page_type: 'landing' })),
  design_tokens: { colors: { primary: '#0a0a0a', background: '#ffffff', surface: '#fafafa', text: '#0a0a0a' }, typography: { fontFamily: 'Inter', baseFontSize: '14px' }, spacing: { unit: '4px' } },
}

const FLAVOR_LINES = [
  'Squinting at competitor whitespace…',
  'Measuring button curves down to the pixel…',
  'Counting navigation items, judging each one…',
  'Reading between the lines of hero sections…',
  'Decoding the politics of dropdown menus…',
  'Looking for hidden gems in the footer…',
  'Grading spacing with a very harsh eye…',
  'Interrogating CTAs about their intentions…',
  'Sniffing out design systems under the hood…',
  'Judging color palettes like it\u2019s fashion week…',
  'Taking notes on every hover state…',
  'Weighing typography choices carefully…',
  'Comparing shadows for competitive advantage…',
  'Arguing about which shade of gray is best…',
  'Stealing ideas, politely and with attribution…',
]

const QUESTIONS = [
  { key: 'product_type', label: 'What are you building?', placeholder: 'e.g. SaaS dashboard, marketplace, mobile app', optional: false },
  { key: 'industry', label: 'What industry or field?', placeholder: 'e.g. Fintech, Healthcare, Education, DevTools', optional: false },
  { key: 'target_audience', label: 'Who is your target user?', placeholder: 'e.g. Developers, Small business owners, Students', optional: false },
  { key: 'core_feature', label: 'What is the core feature?', placeholder: 'e.g. AI code completion, Invoice management', optional: false },
  { key: 'competitors_known', label: 'Any competitors you already know?', placeholder: 'e.g. Linear, Notion, Stripe, Figma', optional: true },
]

const NEXT_STEPS = [
  { num: '01', title: 'Analyze your product type', desc: 'Classify what you\u2019re building and how users interact with it.' },
  { num: '02', title: 'Find design references', desc: 'Surface relevant competitors and adjacent products worth studying.' },
  { num: '03', title: 'Generate UI direction', desc: 'Shape a visual and structural direction for the redesign.' },
]

interface DiscoveryData {
  project_category: string
  competitors: { name: string; url: string; reason: string; relevance: number }[]
  selected_for_analysis: string[]
}

function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3.5 7h7M8 4.5 10.5 7 8 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function DiscoveryPage() {
  return <Suspense><DiscoveryPageInner /></Suspense>
}

function DiscoveryPageInner() {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState('')
  const [stageIdx, setStageIdx] = useState(0)
  const [siteProgress, setSiteProgress] = useState<{ url: string; status: 'pending' | 'ok' | 'timeout' | 'failed' }[]>([])
  const [flavorIdx, setFlavorIdx] = useState(0)
  const [error, setError] = useState('')
  const [completed, setCompleted] = useState(false)
  const [discovery, setDiscovery] = useState<DiscoveryData | null>(null)
  const [showNotification, setShowNotification] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const repo = searchParams.get('repo')
  const branch = searchParams.get('branch')
  const { data: session } = useSession()
  const { startProgress, updateProgress, finishProgress } = useProgress()

  useEffect(() => {
    if (repo) setSelectedRepo(repo, branch || 'main')
  }, [repo, branch])

  useEffect(() => {
    if (!loading) return
    setFlavorIdx(Math.floor(Math.random() * FLAVOR_LINES.length))
    const id = setInterval(() => {
      setFlavorIdx((prev) => {
        let next = prev
        while (next === prev) next = Math.floor(Math.random() * FLAVOR_LINES.length)
        return next
      })
    }, 2800)
    return () => clearInterval(id)
  }, [loading])

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
  const isOptional = currentQ?.optional
  const canProceed = isOptional || !!answers[currentQ.key]?.trim()

  function handleNext() {
    if (!isOptional && !answers[currentQ.key]?.trim()) return
    if (isLastStep) handleFullPipeline()
    else setCurrentStep(currentStep + 1)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); handleNext() }
  }

  async function handleFullPipeline() {
    setLoading(true); setError('')
    startProgress('Running full analysis pipeline...')

    if (MOCK_MODE) {
      setLoadingStatus('Mock mode: skipping crawl...')
      sessionStorage.setItem('refineui_discovery', JSON.stringify(MOCK_DISCOVERY))
      sessionStorage.setItem('refineui_analysis', JSON.stringify(MOCK_ANALYSIS))
      sessionStorage.setItem('refineui_answers', JSON.stringify(answers))
      finishProgress(); setDiscovery(MOCK_DISCOVERY); setCompleted(true); setLoading(false)
      return
    }

    const description = QUESTIONS.map(q => `${q.label} ${answers[q.key] || ''}`).join('. ')
    try {
      setStageIdx(0)
      setLoadingStatus('Finding competitors in your space...')
      updateProgress(10)
      const discoverRes = await fetch(apiUrl('/discover-competitors'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project_description: description, style_goal: '' }) })
      if (!discoverRes.ok) throw new Error('Discovery failed')
      const discoveryData = await discoverRes.json()

      setStageIdx(1)
      setSiteProgress((discoveryData.selected_for_analysis || []).map((u: string) => ({ url: u, status: 'pending' as const })))
      setLoadingStatus(`Analyzing ${discoveryData.selected_for_analysis.length} sites with TinyFish...`)
      updateProgress(30)

      const backupUrls = (discoveryData.deduped_urls || []).filter(
        (u: string) => !discoveryData.selected_for_analysis.includes(u)
      )

      const analyzeUrl = apiUrl('/analyze-competitors-stream')
      const sseBody = JSON.stringify({ urls: discoveryData.selected_for_analysis, style_goal: '', backup_urls: backupUrls })
      let analysis = null
      let streamErrorMessage: string | null = null

      try {
        const sseRes = await fetch(analyzeUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: sseBody })
        if (!sseRes.ok) {
          let detail = ''
          try { const body = await sseRes.json(); detail = body?.detail || '' } catch {}
          throw new Error(detail || `Analysis stream returned ${sseRes.status}`)
        }
        const reader = sseRes.body?.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              try {
                const evt = JSON.parse(line.slice(6))
                if (evt.event === 'site_complete') {
                  const domain = evt.url.replace('https://', '').replace(/\/$/, '')
                  const status = evt.status === 'timeout' ? ' (timed out, skipping)' : evt.status === 'failed' ? ' (blocked, skipping)' : ''
                  setSiteProgress(prev => prev.map(s => s.url === evt.url ? { ...s, status: evt.status } : s))
                  setLoadingStatus(`Analyzed ${domain}${status} (${evt.index}/${evt.total})`)
                  updateProgress(30 + Math.round((evt.index / evt.total) * 50))
                } else if (evt.event === 'retrying') {
                  const domain = evt.url.replace('https://', '').replace(/\/$/, '')
                  setSiteProgress(prev => [...prev, { url: evt.url, status: 'pending' as const }])
                  setLoadingStatus(`Trying backup: ${domain}...`)
                } else if (evt.event === 'aggregating') {
                  setStageIdx(2)
                  setLoadingStatus('Synthesizing design intelligence...')
                  updateProgress(85)
                } else if (evt.event === 'complete') {
                  analysis = evt.data
                } else if (evt.event === 'error') {
                  streamErrorMessage = evt.message || 'Analysis failed with an unknown error'
                }
              } catch {}
            }
          }
        }
      } catch (streamErr) {
        if (streamErrorMessage) throw new Error(streamErrorMessage)
        const fallbackBody = JSON.stringify({ urls: discoveryData.selected_for_analysis, style_goal: '', backup_urls: backupUrls })
        const analyzeRes = await fetch(apiUrl('/analyze-competitors'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: fallbackBody })
        if (!analyzeRes.ok) {
          let detail = ''
          try { const body = await analyzeRes.json(); detail = body?.detail || '' } catch {}
          throw new Error(detail || (streamErr instanceof Error ? streamErr.message : 'Analysis failed'))
        }
        analysis = await analyzeRes.json()
      }

      if (!analysis) {
        throw new Error(streamErrorMessage || 'Analysis stream ended without returning results.')
      }

      updateProgress(95); setLoadingStatus('Analysis complete!')
      sessionStorage.setItem('refineui_discovery', JSON.stringify(discoveryData))
      sessionStorage.setItem('refineui_analysis', JSON.stringify(analysis))
      sessionStorage.setItem('refineui_answers', JSON.stringify(answers))
      finishProgress(); setDiscovery(discoveryData); setCompleted(true); setLoading(false); setShowNotification(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Pipeline failed')
      finishProgress(); setLoading(false)
    }
  }

  function handleViewReport() { router.push('/dashboard/simulation') }

  // ─── COMPLETED ───────────────────────────────────────────────────────
  if (completed && discovery) {
    return (
      <div className="mx-auto w-full max-w-6xl bg-white px-5 sm:px-6 pb-24 pt-10 sm:pt-14">
        {showNotification && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-4" style={{ background: 'rgba(10,10,10,0.38)', backdropFilter: 'blur(6px)' }}>
            <div className="w-full max-w-md rounded-[24px] bg-white p-8 text-center" style={{ border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 24px 80px rgba(0,0,0,0.12)' }}>
              <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: '#f4f4f5' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 className="text-[20px] font-semibold text-neutral-950" style={{ letterSpacing: '-0.02em' }}>Analysis complete</h2>
              <p className="mt-2 mb-7 text-[14px] leading-relaxed text-neutral-500">
                We&apos;ve mapped your competitive landscape. Let&apos;s put it to work.
              </p>
              <button onClick={() => setShowNotification(false)} className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-6 py-2.5 text-[13px] font-medium text-white transition hover:bg-neutral-800">
                Let&apos;s go <ArrowRightIcon />
              </button>
            </div>
          </div>
        )}

        <div className="mb-10">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-black/[0.06] bg-neutral-50 px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-neutral-950" />
            <span className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">Discovery complete</span>
          </div>
          <h1 className="max-w-3xl text-[clamp(34px,4.8vw,56px)] font-semibold leading-[1.02] tracking-[-0.04em] text-neutral-950">
            Your competitive landscape.
            <br />
            <span className="text-neutral-300">Mapped and ready.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-7 text-neutral-500">
            {discovery.project_category} · {discovery.competitors.length} competitors discovered, {discovery.selected_for_analysis.length} analyzed in depth.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[22px] border border-black/[0.07] bg-white p-6 sm:p-7">
            <div className="mb-5 text-[10px] uppercase tracking-[0.16em] text-neutral-400">Project brief</div>
            <dl>
              {QUESTIONS.map((q, i) => (
                <div key={q.key} className="flex items-start justify-between gap-6 py-3.5" style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(0,0,0,0.05)' }}>
                  <dt className="text-[13px] text-neutral-500">{q.label}</dt>
                  <dd className="text-right text-[13px] font-medium text-neutral-950">{answers[q.key] || '—'}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-[22px] border border-black/[0.07] bg-white p-6 sm:p-7">
              <div className="mb-5 flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-400">Top competitors</div>
                <span className="text-[10px] text-neutral-300">{discovery.selected_for_analysis.length} analyzed</span>
              </div>
              <ul>
                {discovery.competitors.slice(0, 3).map((c, i) => (
                  <li key={c.url} className="flex items-center justify-between gap-4 py-3" style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(0,0,0,0.05)' }}>
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-black/[0.06] bg-neutral-50 font-mono text-[10px] text-neutral-500">{i + 1}</span>
                      <span className="truncate text-[14px] font-medium text-neutral-950">{c.name}</span>
                    </div>
                    <span className="font-mono text-[11px] text-neutral-400">{(c.relevance * 100).toFixed(0)}%</span>
                  </li>
                ))}
              </ul>
            </div>

            <button onClick={handleViewReport} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-neutral-950 px-6 py-3 text-[14px] font-medium text-white transition hover:bg-neutral-800">
              View UX analysis report <ArrowRightIcon />
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {[
            { label: 'Competitors found', value: discovery.competitors.length.toString(), sub: 'in category' },
            { label: 'Sites analyzed', value: discovery.selected_for_analysis.length.toString(), sub: 'via TinyFish' },
            { label: 'Avg relevance', value: `${Math.round((discovery.competitors.slice(0, 3).reduce((a, c) => a + c.relevance, 0) / 3) * 100)}%`, sub: 'top 3 match' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-[22px] border border-black/[0.07] bg-white p-6">
              <div className="text-[28px] font-semibold tracking-[-0.035em] text-neutral-950">{stat.value}</div>
              <div className="mt-2 text-[12px] font-medium text-neutral-600">{stat.label}</div>
              <div className="mt-0.5 text-[11px] text-neutral-400">{stat.sub}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 overflow-hidden rounded-[22px] border border-black/[0.07] bg-white">
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">All discovered competitors</div>
            <span className="font-mono text-[11px] text-neutral-400">{discovery.competitors.length} total</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {discovery.competitors.slice(0, 15).map((c, i) => {
              const col = i % 3
              return (
                <div key={c.url} className="flex items-center justify-between gap-3 px-6 py-3 transition-colors hover:bg-neutral-50" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)', borderRight: col < 2 ? '1px solid rgba(0,0,0,0.04)' : 'none' }}>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="w-5 flex-shrink-0 font-mono text-[10px] text-neutral-300">{i + 1}</span>
                    <span className="truncate text-[13px] font-medium text-neutral-950">{c.name}</span>
                  </div>
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 font-mono text-[10px] text-neutral-400 transition-colors hover:text-neutral-950">
                    {c.url.replace('https://', '').replace(/\/$/, '').substring(0, 22)}
                  </a>
                </div>
              )
            })}
          </div>
          {discovery.competitors.length > 15 && (
            <div className="px-6 py-3 text-center text-[11px] text-neutral-400" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
              + {discovery.competitors.length - 15} more competitors discovered
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── LOADING ─────────────────────────────────────────────────────────
  if (loading) {
    const STAGES = [
      { label: 'Finding competitors in your space', est: 10 },
      { label: 'Analyzing sites with TinyFish', est: 30 },
      { label: 'Synthesizing design intelligence', est: 5 },
    ]
    const currentStage = STAGES[stageIdx] || STAGES[0]
    const completedEst = STAGES.slice(0, stageIdx).reduce((a, s) => a + s.est, 0)
    const totalEst = STAGES.reduce((a, s) => a + s.est, 0)
    const progressPct = Math.min(95, ((completedEst + currentStage.est * 0.5) / totalEst) * 100)

    return (
      <div className="mx-auto w-full max-w-xl bg-white px-6 pb-24 pt-16 sm:pt-24">
        <div className="text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-black/[0.06] bg-neutral-50 px-3 py-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neutral-950 opacity-40" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-neutral-950" />
            </span>
            <span className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">Analyzing</span>
          </div>
          <h1 className="text-[clamp(30px,4vw,44px)] font-semibold leading-[1.05] tracking-[-0.04em] text-neutral-950">
            Mapping your space.
          </h1>
          <p className="mt-4 text-[14px] leading-7 text-neutral-500">
            {loadingStatus || 'Getting started…'}
          </p>
        </div>

        <div className="mt-10 h-[3px] w-full overflow-hidden rounded-full bg-black/[0.06]">
          <div className="h-full rounded-full bg-neutral-950 transition-all duration-1000 ease-out" style={{ width: `${progressPct}%` }} />
        </div>

        <ul className="mt-8 space-y-3.5">
          {STAGES.map((stage, i) => {
            const isDone = i < stageIdx
            const isActive = i === stageIdx
            return (
              <li key={i} className="flex items-center gap-3">
                {isDone ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-950">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                ) : isActive ? (
                  <span className="flex h-5 w-5 items-center justify-center">
                    <span className="h-4 w-4 animate-spin rounded-full" style={{ border: '2px solid rgba(0,0,0,0.10)', borderTopColor: '#0a0a0a' }} />
                  </span>
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-black/[0.12]" />
                  </span>
                )}
                <span className="text-[13px]" style={{ color: isActive ? '#0a0a0a' : isDone ? '#737373' : '#a3a3a3', fontWeight: isActive ? 500 : 400 }}>
                  {stage.label}
                </span>
              </li>
            )
          })}
        </ul>

        {siteProgress.length > 0 && (
          <div className="mt-8 rounded-[22px] border border-black/[0.07] bg-white p-5">
            <p className="mb-3 text-[10px] uppercase tracking-[0.16em] text-neutral-400">Sites</p>
            <ul className="space-y-2.5">
              {siteProgress.map(site => {
                const domain = site.url.replace(/^https?:\/\//, '').replace(/\/$/, '')
                return (
                  <li key={site.url} className="flex items-center gap-2.5">
                    {site.status === 'pending' ? (
                      <span className="h-3 w-3 flex-shrink-0 animate-spin rounded-full" style={{ border: '1.5px solid rgba(0,0,0,0.10)', borderTopColor: '#0a0a0a' }} />
                    ) : site.status === 'ok' ? (
                      <svg className="flex-shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    ) : (
                      <svg className="flex-shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d4d4d4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    )}
                    <span className="truncate font-mono text-[11px]" style={{ color: site.status === 'pending' ? '#525252' : site.status === 'ok' ? '#0a0a0a' : '#a3a3a3', textDecoration: site.status === 'timeout' || site.status === 'failed' ? 'line-through' : 'none' }}>
                      {domain}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <style>{`
          @keyframes discoveryFlavorFade {
            0%   { opacity: 0; transform: translateY(3px); }
            15%  { opacity: 0.6; transform: translateY(0); }
            85%  { opacity: 0.6; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-3px); }
          }
        `}</style>
        <p key={flavorIdx} className="mt-8 text-center text-[12px] italic text-neutral-400" style={{ animation: 'discoveryFlavorFade 2.8s ease-in-out' }}>
          {FLAVOR_LINES[flavorIdx]}
        </p>
      </div>
    )
  }

  // ─── QUESTIONNAIRE ───────────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-6xl bg-white px-5 sm:px-6 pb-24 pt-10 sm:pt-14 lg:pt-20">
      <div className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:gap-20">

        <section>
          <div className="mb-6 inline-flex items-center rounded-full border border-black/[0.06] bg-neutral-50 px-3 py-1.5">
            <span className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">Project discovery</span>
          </div>

          <h1 className="max-w-2xl text-[clamp(38px,5vw,64px)] font-semibold leading-[1.02] tracking-[-0.055em] text-neutral-950">
            Tell us about your product.
          </h1>

          <p className="mt-6 max-w-xl text-[16px] leading-8 text-neutral-500">
            We&apos;ll tailor design direction and references based on your product type.
          </p>

          <div className="mt-14">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                Step {currentStep + 1} of {QUESTIONS.length}
              </span>
              <span className="font-mono text-[11px] text-neutral-300">
                {Math.round(((currentStep + 1) / QUESTIONS.length) * 100)}%
              </span>
            </div>
            <div className="mt-3 h-[2px] w-full overflow-hidden rounded-full bg-black/[0.05]">
              <div className="h-full rounded-full bg-neutral-950 transition-all duration-500" style={{ width: `${((currentStep + 1) / QUESTIONS.length) * 100}%` }} />
            </div>
          </div>

          <div className="mt-10">
            <label htmlFor={`question-${currentQ.key}`} className="block text-[22px] font-medium leading-[1.3] tracking-[-0.02em] text-neutral-950">
              {currentQ.label}
              {isOptional && <span className="ml-2 text-[12px] font-normal text-neutral-400">· optional</span>}
            </label>
            <div className="mt-5 rounded-full border border-black/[0.08] bg-neutral-50 px-5 py-3.5 transition-colors focus-within:border-black/[0.25] focus-within:bg-white">
              <input
                id={`question-${currentQ.key}`}
                autoFocus
                type="text"
                placeholder={currentQ.placeholder}
                value={answers[currentQ.key] || ''}
                onChange={(e) => setAnswers({ ...answers, [currentQ.key]: e.target.value })}
                onKeyDown={handleKeyDown}
                className="w-full bg-transparent text-[15px] text-neutral-950 outline-none placeholder:text-neutral-400"
              />
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={handleNext}
                disabled={!canProceed}
                className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-6 py-3 text-[14px] font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
              >
                {isLastStep ? 'Discover competitors' : 'Continue'}
                <ArrowRightIcon />
              </button>

              {currentStep > 0 && (
                <button onClick={() => setCurrentStep(currentStep - 1)} className="inline-flex items-center gap-2 rounded-full border border-black/[0.12] bg-white px-5 py-3 text-[14px] font-medium text-neutral-950 transition hover:bg-neutral-50">
                  Back
                </button>
              )}

              {isOptional && !answers[currentQ.key]?.trim() && (
                <button onClick={handleNext} className="text-[13px] font-medium text-neutral-400 transition hover:text-neutral-950">
                  Skip
                </button>
              )}

              <span className="ml-auto hidden text-[11px] text-neutral-300 sm:inline-flex">
                Press <kbd className="mx-1.5 rounded-md border border-black/[0.1] bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] text-neutral-600">Enter</kbd> to continue
              </span>
            </div>
          </div>

          {currentStep > 0 && (
            <div className="mt-14">
              <p className="mb-4 text-[10px] uppercase tracking-[0.16em] text-neutral-400">Answered</p>
              <ul className="space-y-0.5">
                {QUESTIONS.slice(0, currentStep).map((q) => (
                  <li key={q.key}>
                    <button onClick={() => setCurrentStep(QUESTIONS.indexOf(q))} className="flex w-full items-center justify-between gap-4 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-neutral-50">
                      <span className="text-[12.5px] text-neutral-400">{q.label}</span>
                      <span className="truncate text-[12.5px] font-medium text-neutral-700">{answers[q.key] || '—'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <div className="mt-6">
              <GateErrorBanner error={null} fallbackMessage={error} onDismiss={() => setError('')} />
            </div>
          )}
        </section>

        <aside className="lg:pt-2">
          <div className="sticky top-[96px] overflow-hidden rounded-[24px] border border-black/[0.07] bg-white">
            <div className="border-b border-black/[0.06] px-6 py-5">
              <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">What happens next</div>
            </div>

            <div className="px-6 py-6">
              <ol className="space-y-7">
                {NEXT_STEPS.map((step, i) => (
                  <li key={step.num} className="flex gap-4">
                    <div className="flex flex-shrink-0 flex-col items-center">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-black/[0.08] bg-neutral-50 font-mono text-[11px] text-neutral-500">{step.num}</span>
                      {i < NEXT_STEPS.length - 1 && <span className="mt-2 h-8 w-px bg-black/[0.07]" />}
                    </div>
                    <div className="pt-1">
                      <div className="text-[14px] font-medium text-neutral-950" style={{ letterSpacing: '-0.01em' }}>{step.title}</div>
                      <p className="mt-1.5 text-[12.5px] leading-5 text-neutral-500">{step.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="border-t border-black/[0.06] px-6 py-5">
              <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-neutral-500">Time</div>
              <p className="text-[12.5px] leading-5 text-neutral-500">
                A full discovery run typically takes about two minutes. You can refine answers anytime before continuing.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
