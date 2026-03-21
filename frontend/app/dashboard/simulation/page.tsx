'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ── Types ───────────────────────────────────────────────────────────
interface Annotation {
  id: string
  label: string
  detail: string
  type: 'positive' | 'issue' | 'warning' | 'insight'
  principle: string
  confidence: number
  zone: { x: number; y: number; w: number; h: number }
}

interface AnalysisResult {
  screenshot_b64: string
  before: { annotations: Annotation[]; ux_score: number }
  after: { annotations: Annotation[]; ux_score: number; ai_forecast: number }
  analytics: { roi: string; engagement_change: string; confidence: string; insight: string }
  html_preview?: string
}

// ── UX Simulation data ─────────────────────────────────────────────
const DEFAULT_SCREENS = [
  { label: 'Home', route: '/' },
  { label: 'Dashboard', route: '/dashboard' },
  { label: 'Settings', route: '/settings' },
  { label: 'Pricing', route: '/pricing' },
  { label: 'Onboarding', route: '/onboarding' },
]

const HEATMAP_TYPES = [
  { key: 'attention', label: 'Attention' },
  { key: 'click', label: 'Click' },
  { key: 'scroll', label: 'Scroll' },
  { key: 'eye', label: 'Eye Tracking' },
  { key: 'dropoff', label: 'Drop-off' },
  { key: 'rageclicks', label: 'Rage Click' },
]

const ANALYTICS_FALLBACK: Record<string, { roi: string; engagement: string; engagementRaw: number; confidence: string; confidenceRaw: number; insight: string }> = {
  attention:  { roi: '+34%', engagement: '+28%', engagementRaw: 28, confidence: '94.2%', confidenceRaw: 94, insight: 'Primary CTA achieves 88% visual saliency within 2s. Consolidating layout clusters reduces cognitive load.' },
  click:      { roi: '+22%', engagement: '+19%', engagementRaw: 19, confidence: '91.5%', confidenceRaw: 91, insight: 'Click concentration shifted to conversion zones. Navigation clicks down 18%, intent clicks up 22%.' },
  scroll:     { roi: '+15%', engagement: '+31%', engagementRaw: 31, confidence: '89.0%', confidenceRaw: 89, insight: 'Users scroll 31% deeper on transformed design. Content fold restructuring improved depth.' },
  eye:        { roi: '+41%', engagement: '+37%', engagementRaw: 37, confidence: '96.1%', confidenceRaw: 96, insight: 'Eye tracking predicts 1.8x more fixations on key CTAs. F-pattern improved to Z-pattern.' },
  dropoff:    { roi: '+27%', engagement: '+24%', engagementRaw: 24, confidence: '92.8%', confidenceRaw: 92, insight: 'Drop-off point moved from 35% to 68% scroll depth. Friction reduction improved retention.' },
  rageclicks: { roi: '+18%', engagement: '+14%', engagementRaw: 14, confidence: '88.3%', confidenceRaw: 88, insight: 'Rage click zones reduced by 76%. Frustration points eliminated in checkout and auth flows.' },
}

const SCORES_FALLBACK: Record<string, { beforeEng: string; afterEng: string }> = {
  attention:  { beforeEng: '52', afterEng: '86' },
  click:      { beforeEng: '61', afterEng: '83' },
  scroll:     { beforeEng: '44', afterEng: '75' },
  eye:        { beforeEng: '57', afterEng: '94' },
  dropoff:    { beforeEng: '48', afterEng: '79' },
  rageclicks: { beforeEng: '39', afterEng: '77' },
}

// ── Annotation colours ─────────────────────────────────────────────
const ANNOTATION_COLORS = {
  positive: { pin: '#22c55e',  ring: 'rgba(34,197,94,0.25)',  border: 'rgba(34,197,94,0.5)',  zoneBorder: 'rgba(34,197,94,0.45)',  label: '#86efac' },
  issue:    { pin: '#ef4444',  ring: 'rgba(239,68,68,0.25)',   border: 'rgba(239,68,68,0.5)',   zoneBorder: 'rgba(239,68,68,0.45)',   label: '#fca5a5' },
  warning:  { pin: '#f59e0b',  ring: 'rgba(245,158,11,0.25)', border: 'rgba(245,158,11,0.5)', zoneBorder: 'rgba(245,158,11,0.45)', label: '#fcd34d' },
  insight:  { pin: '#6366f1',  ring: 'rgba(99,102,241,0.25)', border: 'rgba(99,102,241,0.5)', zoneBorder: 'rgba(99,102,241,0.45)', label: '#a5b4fc' },
}

const CARD_W = 224
const CARD_H = 116 // approximate rendered height

// ── Annotated preview ──────────────────────────────────────────────
function AnnotatedPreview({
  screenshotB64,
  annotations,
  uxScore,
  showForecast,
  forecastScore,
}: {
  screenshotB64: string
  annotations: Annotation[]
  uxScore: number
  showForecast: boolean
  forecastScore?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [cardPos, setCardPos] = useState<{ left: number; top: number } | null>(null)

  const hoveredAnn = annotations.find(a => a.id === hoveredId) ?? null

  const handleEnter = useCallback((ann: Annotation) => {
    setHoveredId(ann.id)
    if (!containerRef.current) return
    const { width, height } = containerRef.current.getBoundingClientRect()
    const cx = (ann.zone.x + ann.zone.w / 2) / 100 * width
    const cy = (ann.zone.y + ann.zone.h / 2) / 100 * height
    const gap = 10

    // Horizontal: prefer right of pin, flip left if it would overflow
    let left = cx + gap
    if (left + CARD_W > width) left = cx - CARD_W - gap
    left = Math.max(4, Math.min(left, width - CARD_W - 4))

    // Vertical: align top of card to pin, clamp so bottom doesn't overflow
    let top = cy - 9
    top = Math.max(4, Math.min(top, height - CARD_H - 4))

    setCardPos({ left, top })
  }, [])

  const handleLeave = useCallback(() => {
    setHoveredId(null)
    setCardPos(null)
  }, [])

  const hoveredColors = hoveredAnn
    ? (ANNOTATION_COLORS[hoveredAnn.type] ?? ANNOTATION_COLORS.insight)
    : null

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', aspectRatio: '16/5', background: '#0d0c16' }}
    >
      {/* Screenshot — clipped to container */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/png;base64,${screenshotB64}`}
          alt="Page screenshot"
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top left', display: 'block' }}
        />
      </div>

      {/* Annotation layer — NOT clipped so card can position freely */}
      <div style={{ position: 'absolute', inset: 0 }}>

        {annotations.map((ann, idx) => {
          const colors = ANNOTATION_COLORS[ann.type] ?? ANNOTATION_COLORS.insight
          const isHovered = hoveredId === ann.id
          const cx = ann.zone.x + ann.zone.w / 2
          const cy = ann.zone.y + ann.zone.h / 2

          return (
            <div key={ann.id}>
              {/* Zone bounding box */}
              <div
                onMouseEnter={() => handleEnter(ann)}
                onMouseLeave={handleLeave}
                style={{
                  position: 'absolute',
                  left: `${ann.zone.x}%`,
                  top: `${ann.zone.y}%`,
                  width: `${ann.zone.w}%`,
                  height: `${ann.zone.h}%`,
                  border: `1.5px solid ${colors.zoneBorder}`,
                  background: isHovered ? `${colors.pin}12` : 'transparent',
                  transition: 'background 0.15s',
                  cursor: 'default',
                }}
              />
              {/* Numbered pin at zone center */}
              <div
                onMouseEnter={() => handleEnter(ann)}
                onMouseLeave={handleLeave}
                style={{
                  position: 'absolute',
                  left: `${cx}%`,
                  top: `${cy}%`,
                  transform: 'translate(-50%, -50%)',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: colors.pin,
                  boxShadow: `0 0 0 ${isHovered ? '5px' : '3px'} ${colors.ring}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '8px',
                  fontWeight: 800,
                  color: 'white',
                  cursor: 'default',
                  zIndex: 20,
                  transition: 'box-shadow 0.15s',
                  userSelect: 'none',
                }}
              >
                {idx + 1}
              </div>
            </div>
          )
        })}

        {/* Expanded card — rendered at container level with pixel-clamped position */}
        {hoveredAnn && hoveredColors && cardPos && (
          <div
            style={{
              position: 'absolute',
              left: cardPos.left,
              top: cardPos.top,
              width: CARD_W,
              zIndex: 50,
              background: 'rgba(13,12,22,0.97)',
              backdropFilter: 'blur(14px)',
              border: `1px solid ${hoveredColors.border}`,
              borderRadius: '10px',
              padding: '9px 11px',
              pointerEvents: 'none',
            }}
          >
            <p style={{ fontSize: '10px', fontWeight: 700, color: hoveredColors.label, marginBottom: '5px', lineHeight: 1.3 }}>
              {hoveredAnn.label}
            </p>
            <p style={{ fontSize: '10px', color: 'rgba(204,195,216,0.85)', lineHeight: 1.5, marginBottom: '6px' }}>
              {hoveredAnn.detail}
            </p>
            <p style={{ fontSize: '9px', fontWeight: 700, color: hoveredColors.label, letterSpacing: '0.05em', textTransform: 'uppercase', opacity: 0.7 }}>
              {hoveredAnn.principle} · {Math.round(hoveredAnn.confidence * 100)}%
            </p>
          </div>
        )}

        {/* UX Score badge */}
        <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 8, background: 'rgba(15,13,24,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(74,68,85,0.3)' }}>
            <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(204,195,216,0.5)' }}>UX Score</span>
            <span style={{ fontSize: '14px', fontWeight: 900, color: '#d2bbff' }}>{uxScore}</span>
          </div>
          {showForecast && forecastScore !== undefined && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 8, background: 'rgba(15,13,24,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(124,58,237,0.25)' }}>
              <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(204,195,216,0.5)' }}>AI Forecast</span>
              <span style={{ fontSize: '14px', fontWeight: 900, color: '#a855f7' }}>{forecastScore}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Loading placeholder ────────────────────────────────────────────
function AnalysisLoadingWindow({ label }: { label: string }) {
  const isAfter = label === 'After'
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: isAfter ? '#a855f7' : 'rgba(255,255,255,0.2)' }} />
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(204,195,216,0.5)' }}>{label}</span>
      </div>
      <div
        className="relative rounded-xl overflow-hidden flex items-center justify-center"
        style={{
          background: '#201e2a',
          border: isAfter ? '1px solid rgba(124,58,237,0.25)' : '1px solid rgba(74,68,85,0.15)',
          aspectRatio: '16/5',
        }}
      >
        <div className="flex flex-col items-center gap-3">
          {/* Spinner */}
          <div
            style={{
              width: '28px',
              height: '28px',
              border: '2px solid rgba(74,68,85,0.3)',
              borderTop: '2px solid #d2bbff',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <span className="text-xs font-medium" style={{ color: 'rgba(204,195,216,0.5)' }}>Analysing with Claude...</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}

// ── Empty placeholder ──────────────────────────────────────────────
function AnalysisEmptyWindow({ label }: { label: string }) {
  const isAfter = label === 'After'
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: isAfter ? '#a855f7' : 'rgba(255,255,255,0.2)' }} />
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(204,195,216,0.5)' }}>{label}</span>
      </div>
      <div
        className="relative rounded-xl overflow-hidden flex items-center justify-center"
        style={{
          background: '#201e2a',
          border: isAfter ? '1px solid rgba(124,58,237,0.25)' : '1px solid rgba(74,68,85,0.15)',
          aspectRatio: '16/5',
        }}
      >
        <span className="text-xs" style={{ color: 'rgba(204,195,216,0.3)' }}>Select a screen to begin analysis</span>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────
export default function SimulationPage() {
  const [screens, setScreens] = useState<{ label: string; route: string }[]>(DEFAULT_SCREENS)
  const [selectedScreen, setSelectedScreen] = useState<{ label: string; route: string } | null>(null)
  const [selectedHeatmap, setSelectedHeatmap] = useState('attention')
  const [panelOpen, setPanelOpen] = useState(true)
  const [loadingScreens, setLoadingScreens] = useState(true)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const analysisCache = useRef<Record<string, AnalysisResult>>({})

  useEffect(() => {
    const repoUrl = sessionStorage.getItem('refineui_repo')
    if (repoUrl) {
      setLoadingScreens(true)
      fetch(`http://localhost:8000/repo-pages?repo_url=${encodeURIComponent(repoUrl)}`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return res.json()
        })
        .then((data: { pages: { label: string; route: string }[] }) => {
          setScreens(data.pages)
          setSelectedScreen(data.pages[0])
        })
        .catch(() => {
          setScreens(DEFAULT_SCREENS)
          setSelectedScreen(DEFAULT_SCREENS[0])
        })
        .finally(() => {
          setLoadingScreens(false)
        })
    } else {
      setScreens(DEFAULT_SCREENS)
      setSelectedScreen(DEFAULT_SCREENS[0] ?? null)
      setLoadingScreens(false)
    }
  }, [])

  // Trigger AI analysis whenever selected screen or heatmap changes
  useEffect(() => {
    if (!selectedScreen) return

    const cacheKey = `${selectedScreen.route}:${selectedHeatmap}`
    if (analysisCache.current[cacheKey]) {
      setAnalysis(analysisCache.current[cacheKey])
      return
    }

    setLoadingAnalysis(true)
    setAnalysis(null)

    fetch('http://localhost:8000/analyze-page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `http://localhost:3000${selectedScreen.route}`,
        heatmap_type: selectedHeatmap,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<AnalysisResult>
      })
      .then((result) => {
        analysisCache.current[cacheKey] = result
        setAnalysis(result)
      })
      .catch((err) => {
        console.error('Analysis failed:', err)
        setAnalysis(null)
      })
      .finally(() => {
        setLoadingAnalysis(false)
      })
  }, [selectedScreen, selectedHeatmap])

  // Derive analytics values — prefer live result, fall back to hardcoded
  const analyticsFallback = ANALYTICS_FALLBACK[selectedHeatmap]
  const scoresFallback = SCORES_FALLBACK[selectedHeatmap]

  const roiValue = analysis?.analytics.roi ?? analyticsFallback.roi
  const engagementValue = analysis?.analytics.engagement_change ?? analyticsFallback.engagement
  const engagementRaw = analysis
    ? parseInt(analysis.analytics.engagement_change.replace(/[^0-9]/g, ''), 10) || analyticsFallback.engagementRaw
    : analyticsFallback.engagementRaw
  const confidenceValue = analysis?.analytics.confidence ?? analyticsFallback.confidence
  const confidenceRaw = analysis
    ? parseFloat(analysis.analytics.confidence.replace('%', '')) || analyticsFallback.confidenceRaw
    : analyticsFallback.confidenceRaw
  const insightValue = analysis?.analytics.insight ?? analyticsFallback.insight
  const beforeScore = analysis?.before.ux_score?.toString() ?? scoresFallback.beforeEng
  const afterScore = analysis?.after.ux_score?.toString() ?? scoresFallback.afterEng

  return (
    <div className="px-8 py-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest" style={{ background: 'rgba(111,0,190,0.3)', color: '#ddb7ff' }}>Simulation Active</span>
        <span className="text-xs" style={{ color: 'rgba(204,195,216,0.5)' }}>AI Predicted Metrics</span>
      </div>
      <h1 className="text-2xl font-extrabold tracking-tight text-white mb-4">UX Performance Prediction Layer</h1>

      <div>
        {/* Controls row */}
        <div className="flex flex-wrap items-center gap-4 mb-3">
          {/* Screen dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(204,195,216,0.4)' }}>Screen</span>
            <select
              value={selectedScreen?.label ?? ''}
              onChange={(e) => setSelectedScreen(screens.find(s => s.label === e.target.value) ?? screens[0])}
              disabled={loadingScreens}
              className="text-xs font-medium rounded-lg px-3 py-1.5 outline-none cursor-pointer"
              style={{ background: '#1c1a25', border: '1px solid rgba(74,68,85,0.3)', color: loadingScreens ? 'rgba(230,224,240,0.35)' : 'rgba(230,224,240,0.85)' }}
            >
              {loadingScreens
                ? <option value="">Loading pages...</option>
                : screens.map((s) => (
                    <option key={s.label} value={s.label}>{s.label}</option>
                  ))
              }
            </select>
          </div>

          {/* Divider */}
          <div className="w-px h-5" style={{ background: 'rgba(74,68,85,0.3)' }} />

          {/* Heatmap type pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(204,195,216,0.4)' }}>Heatmap</span>
            <div className="flex items-center gap-1 flex-wrap">
              {HEATMAP_TYPES.map((h) => (
                <button
                  key={h.key}
                  onClick={() => setSelectedHeatmap(h.key)}
                  className="px-3 py-1 rounded-full text-[11px] font-semibold transition-all"
                  style={selectedHeatmap === h.key
                    ? { background: 'rgba(124,58,237,0.3)', border: '1px solid rgba(124,58,237,0.5)', color: '#d2bbff' }
                    : { background: 'rgba(54,51,63,0.3)', border: '1px solid rgba(74,68,85,0.2)', color: 'rgba(204,195,216,0.4)' }
                  }
                >
                  {h.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main area: windows + collapsible panel */}
        <div className="flex gap-4 items-start">
          {/* Stacked comparison windows */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Before window */}
            {loadingAnalysis ? (
              <AnalysisLoadingWindow label="Before" />
            ) : analysis ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(204,195,216,0.5)' }}>Before</span>
                </div>
                <div className="relative rounded-xl overflow-hidden" style={{ background: '#201e2a', border: '1px solid rgba(74,68,85,0.15)' }}>
                  <AnnotatedPreview
                    screenshotB64={analysis.screenshot_b64}
                    annotations={analysis.before.annotations}
                    uxScore={analysis.before.ux_score}
                    showForecast={false}
                  />
                </div>
              </div>
            ) : (
              <AnalysisEmptyWindow label="Before" />
            )}

            {/* After window */}
            {loadingAnalysis ? (
              <AnalysisLoadingWindow label="After" />
            ) : analysis ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#a855f7' }} />
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(204,195,216,0.5)' }}>After</span>
                  </div>
                  {analysis.html_preview && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(124,58,237,0.15)', color: 'rgba(168,85,247,0.8)', border: '1px solid rgba(124,58,237,0.2)' }}>
                      AI Generated Preview
                    </span>
                  )}
                </div>
                <div className="relative rounded-xl overflow-hidden" style={{ background: '#201e2a', border: '1px solid rgba(124,58,237,0.25)', boxShadow: '0 0 30px rgba(124,58,237,0.12)', aspectRatio: '16/5' }}>
                  {analysis.html_preview ? (
                    <>
                      <iframe
                        srcDoc={analysis.html_preview}
                        sandbox="allow-scripts"
                        style={{ position: 'absolute', top: 0, left: 0, width: '200%', height: '200%', transform: 'scale(0.5)', transformOrigin: 'top left', border: 'none', background: 'white' }}
                      />
                      {/* UX Score badges */}
                      <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5 z-10">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(15,13,24,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(74,68,85,0.3)' }}>
                          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(204,195,216,0.5)' }}>UX Score</span>
                          <span className="text-sm font-black" style={{ color: '#d2bbff' }}>{analysis.after.ux_score}</span>
                        </div>
                        {analysis.after.ai_forecast !== undefined && (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(15,13,24,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(124,58,237,0.25)' }}>
                            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(204,195,216,0.5)' }}>AI Forecast</span>
                            <span className="text-sm font-black" style={{ color: '#a855f7' }}>{analysis.after.ai_forecast}</span>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <AnnotatedPreview
                      screenshotB64={analysis.screenshot_b64}
                      annotations={analysis.after.annotations}
                      uxScore={analysis.after.ux_score}
                      showForecast={true}
                      forecastScore={analysis.after.ai_forecast}
                    />
                  )}
                </div>
              </div>
            ) : (
              <AnalysisEmptyWindow label="After" />
            )}

            {/* Legend */}
            <div className="flex justify-between items-center px-1 pt-1">
              <p className="text-sm" style={{ color: 'rgba(204,195,216,0.4)' }}>
                {HEATMAP_TYPES.find(h => h.key === selectedHeatmap)?.label} Heatmap · {selectedScreen?.label ?? ''}
              </p>
              <div className="flex items-center gap-4">
                {(['positive', 'issue', 'warning', 'insight'] as const).map((t) => (
                  <div key={t} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm" style={{ background: ANNOTATION_COLORS[t].border }} />
                    <span className="text-[10px] uppercase font-bold" style={{ color: 'rgba(204,195,216,0.5)' }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Collapsible analytics panel */}
          <div className="flex items-start gap-0 flex-shrink-0">
            {/* Toggle tab */}
            <button
              onClick={() => setPanelOpen(!panelOpen)}
              className="flex items-center justify-center rounded-l-lg self-stretch px-1.5"
              style={{ background: '#1c1a25', border: '1px solid rgba(74,68,85,0.15)', borderRight: 'none', minHeight: '48px' }}
              title={panelOpen ? 'Collapse panel' : 'Expand panel'}
            >
              <span
                className="text-[10px] font-bold"
                style={{ color: 'rgba(204,195,216,0.4)', transform: panelOpen ? 'rotate(0deg)' : 'rotate(180deg)', display: 'inline-block', transition: 'transform 0.25s' }}
              >
                ›
              </span>
            </button>

            {/* Panel content */}
            <div
              className="overflow-hidden transition-all duration-300"
              style={{ width: panelOpen ? '280px' : '0px', opacity: panelOpen ? 1 : 0 }}
            >
              <div className="space-y-4" style={{ width: '280px' }}>
                {/* ROI card */}
                <div className="rounded-xl p-5" style={{ background: '#1c1a25', border: '1px solid rgba(74,68,85,0.15)' }}>
                  <h3 className="text-[10px] font-bold uppercase tracking-widest mb-5" style={{ color: 'rgba(204,195,216,0.5)' }}>UX Improvement ROI</h3>
                  <div className="space-y-5">
                    {/* ROI */}
                    <div>
                      <div className="flex justify-between items-end mb-1.5">
                        <span className="text-xs font-medium text-white">ROI Estimate</span>
                        <span className="text-lg font-bold" style={{ color: '#d2bbff' }}>{roiValue}</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(54,51,63,1)' }}>
                        <div className="h-full rounded-full" style={{ width: `${parseInt(roiValue.replace(/[^0-9]/g, ''), 10) || 0}%`, background: '#d2bbff' }} />
                      </div>
                    </div>
                    {/* Engagement */}
                    <div>
                      <div className="flex justify-between items-end mb-1.5">
                        <span className="text-xs font-medium text-white">Engagement Change</span>
                        <span className="text-lg font-bold" style={{ color: '#ddb7ff' }}>{engagementValue}</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(54,51,63,1)' }}>
                        <div className="h-full rounded-full" style={{ width: `${engagementRaw}%`, background: '#ddb7ff' }} />
                      </div>
                    </div>
                  </div>

                  {/* Score delta */}
                  <div className="mt-5 pt-5 grid grid-cols-2 gap-3" style={{ borderTop: '1px solid rgba(74,68,85,0.1)' }}>
                    <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(54,51,63,0.4)' }}>
                      <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(204,195,216,0.4)' }}>Before</p>
                      <p className="text-xl font-black text-white">{beforeScore}</p>
                      <p className="text-[9px]" style={{ color: 'rgba(204,195,216,0.35)' }}>eng. score</p>
                    </div>
                    <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)' }}>
                      <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(204,195,216,0.4)' }}>After</p>
                      <p className="text-xl font-black" style={{ color: '#d2bbff' }}>{afterScore}</p>
                      <p className="text-[9px]" style={{ color: 'rgba(204,195,216,0.35)' }}>eng. score</p>
                    </div>
                  </div>
                </div>

                {/* Confidence card */}
                <div className="rounded-xl p-5" style={{ background: '#1c1a25', border: '1px solid rgba(74,68,85,0.15)' }}>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(204,195,216,0.5)' }}>Confidence</span>
                    <span className="text-xs font-bold" style={{ color: '#d2bbff' }}>{confidenceValue}</span>
                  </div>
                  <div className="flex gap-1 h-1.5 mb-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-full"
                        style={{ background: i < Math.round(confidenceRaw / 20) ? '#d2bbff' : 'rgba(54,51,63,1)' }}
                      />
                    ))}
                  </div>
                  <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(204,195,216,0.4)' }}>
                    Based on 1.2M training sets from top-performing B2B interfaces.
                  </p>
                </div>

                {/* AI Insight card */}
                <div className="rounded-xl p-5" style={{ background: '#1c1a25', border: '1px solid rgba(74,68,85,0.15)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(204,195,216,0.5)' }}>AI Insight</span>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: 'rgba(54,51,63,0.4)' }}>
                    <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(204,195,216,0.6)' }}>{insightValue}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
