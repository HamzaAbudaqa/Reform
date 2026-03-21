'use client'

import { useState } from 'react'

// ── Existing tab data ──────────────────────────────────────────────
const METRICS = [
  { label: 'Engagement Score', value: '+34%', percent: 34, color: '#d2bbff', desc: 'Predicted increase in session duration and feature interaction.' },
  { label: 'CTA Click Probability', value: '+22%', percent: 22, color: '#ddb7ff', desc: 'Calculated based on Fitts\' Law and visual contrast improvements.' },
  { label: 'Scroll Depth Change', value: '+15%', percent: 15, color: '#d2bbff', desc: 'Users predicted to explore 15% more content below the fold.' },
]

// ── UX Simulation tab data ─────────────────────────────────────────
const SCREENS = ['Landing Page', 'Dashboard / Home', 'Onboarding Flow', 'Pricing Page', 'Settings']

const HEATMAP_TYPES = [
  { key: 'attention', label: 'Attention' },
  { key: 'click', label: 'Click' },
  { key: 'scroll', label: 'Scroll' },
  { key: 'eye', label: 'Eye Tracking' },
  { key: 'dropoff', label: 'Drop-off' },
  { key: 'rageclicks', label: 'Rage Click' },
]

const HEATMAP_OVERLAYS: Record<string, { before: string; after: string }> = {
  attention: {
    before: 'radial-gradient(circle at 18% 18%, rgba(255,0,0,0.45) 0%, transparent 22%), radial-gradient(circle at 72% 62%, rgba(255,100,0,0.3) 0%, transparent 28%), radial-gradient(circle at 42% 80%, rgba(0,80,255,0.2) 0%, transparent 30%)',
    after:  'radial-gradient(circle at 32% 28%, rgba(255,0,0,0.55) 0%, transparent 18%), radial-gradient(circle at 58% 42%, rgba(255,165,0,0.4) 0%, transparent 20%), radial-gradient(circle at 50% 62%, rgba(0,100,255,0.18) 0%, transparent 25%)',
  },
  click: {
    before: 'radial-gradient(circle at 14% 82%, rgba(0,255,120,0.55) 0%, transparent 10%), radial-gradient(circle at 82% 18%, rgba(0,200,255,0.4) 0%, transparent 12%), radial-gradient(circle at 56% 55%, rgba(255,240,0,0.3) 0%, transparent 16%)',
    after:  'radial-gradient(circle at 36% 68%, rgba(0,255,120,0.6) 0%, transparent 10%), radial-gradient(circle at 58% 36%, rgba(0,200,255,0.45) 0%, transparent 11%), radial-gradient(circle at 50% 50%, rgba(255,240,0,0.38) 0%, transparent 13%)',
  },
  scroll: {
    before: 'linear-gradient(to bottom, rgba(255,50,50,0.45) 0%, rgba(255,165,0,0.32) 28%, rgba(0,100,255,0.22) 58%, rgba(0,0,180,0.1) 78%, transparent 100%)',
    after:  'linear-gradient(to bottom, rgba(255,50,50,0.5) 0%, rgba(255,165,0,0.38) 42%, rgba(0,100,255,0.28) 72%, rgba(0,0,180,0.16) 90%, transparent 100%)',
  },
  eye: {
    before: 'radial-gradient(circle at 24% 18%, rgba(255,0,0,0.65) 0%, transparent 8%), radial-gradient(circle at 76% 22%, rgba(255,0,0,0.45) 0%, transparent 10%), radial-gradient(circle at 38% 62%, rgba(255,100,0,0.28) 0%, transparent 16%)',
    after:  'radial-gradient(circle at 36% 28%, rgba(255,0,0,0.7) 0%, transparent 7%), radial-gradient(circle at 56% 44%, rgba(255,0,0,0.55) 0%, transparent 8%), radial-gradient(circle at 48% 36%, rgba(255,100,0,0.38) 0%, transparent 11%)',
  },
  dropoff: {
    before: 'linear-gradient(to bottom, rgba(0,255,120,0.38) 0%, rgba(255,200,0,0.32) 32%, rgba(255,100,0,0.38) 58%, rgba(255,0,0,0.5) 84%, transparent 100%)',
    after:  'linear-gradient(to bottom, rgba(0,255,120,0.42) 0%, rgba(255,200,0,0.32) 50%, rgba(255,100,0,0.22) 74%, rgba(255,0,0,0.18) 90%, transparent 100%)',
  },
  rageclicks: {
    before: 'radial-gradient(circle at 19% 80%, rgba(255,0,0,0.75) 0%, transparent 6%), radial-gradient(circle at 21% 80%, rgba(255,0,60,0.55) 0%, transparent 8%), radial-gradient(circle at 79% 14%, rgba(255,0,0,0.65) 0%, transparent 7%), radial-gradient(circle at 62% 50%, rgba(255,50,0,0.4) 0%, transparent 10%)',
    after:  'radial-gradient(circle at 20% 79%, rgba(255,0,0,0.25) 0%, transparent 5%), radial-gradient(circle at 62% 49%, rgba(255,50,0,0.18) 0%, transparent 8%), radial-gradient(circle at 44% 36%, rgba(255,100,0,0.12) 0%, transparent 10%)',
  },
}

const SCORES: Record<string, { beforeEng: string; beforePred: string; afterEng: string; afterPred: string }> = {
  attention:  { beforeEng: '52', beforePred: '58', afterEng: '86', afterPred: '91' },
  click:      { beforeEng: '61', beforePred: '64', afterEng: '83', afterPred: '88' },
  scroll:     { beforeEng: '44', beforePred: '49', afterEng: '75', afterPred: '79' },
  eye:        { beforeEng: '57', beforePred: '60', afterEng: '94', afterPred: '97' },
  dropoff:    { beforeEng: '48', beforePred: '53', afterEng: '79', afterPred: '84' },
  rageclicks: { beforeEng: '39', beforePred: '44', afterEng: '77', afterPred: '80' },
}

const ANALYTICS: Record<string, { roi: string; engagement: string; engagementRaw: number; confidence: string; confidenceRaw: number; insight: string }> = {
  attention:  { roi: '+34%', engagement: '+28%', engagementRaw: 28, confidence: '94.2%', confidenceRaw: 94, insight: 'Primary CTA achieves 88% visual saliency within 2s. Consolidating layout clusters reduces cognitive load.' },
  click:      { roi: '+22%', engagement: '+19%', engagementRaw: 19, confidence: '91.5%', confidenceRaw: 91, insight: 'Click concentration shifted to conversion zones. Navigation clicks down 18%, intent clicks up 22%.' },
  scroll:     { roi: '+15%', engagement: '+31%', engagementRaw: 31, confidence: '89.0%', confidenceRaw: 89, insight: 'Users scroll 31% deeper on transformed design. Content fold restructuring improved depth.' },
  eye:        { roi: '+41%', engagement: '+37%', engagementRaw: 37, confidence: '96.1%', confidenceRaw: 96, insight: 'Eye tracking predicts 1.8x more fixations on key CTAs. F-pattern improved to Z-pattern.' },
  dropoff:    { roi: '+27%', engagement: '+24%', engagementRaw: 24, confidence: '92.8%', confidenceRaw: 92, insight: 'Drop-off point moved from 35% to 68% scroll depth. Friction reduction improved retention.' },
  rageclicks: { roi: '+18%', engagement: '+14%', engagementRaw: 14, confidence: '88.3%', confidenceRaw: 88, insight: 'Rage click zones reduced by 76%. Frustration points eliminated in checkout and auth flows.' },
}

// ── Shared mock UI skeleton ────────────────────────────────────────
function MockUI() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <div className="w-28 h-5 rounded" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="flex gap-3">
          <div className="w-16 h-3.5 rounded" style={{ background: 'rgba(255,255,255,0.04)' }} />
          <div className="w-16 h-3.5 rounded" style={{ background: 'rgba(255,255,255,0.04)' }} />
          <div className="w-16 h-3.5 rounded" style={{ background: 'rgba(255,255,255,0.04)' }} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-3">
          <div className="w-3/4 h-10 rounded-lg" style={{ background: 'rgba(124,58,237,0.15)' }} />
          <div className="w-full h-28 rounded-xl" style={{ background: '#1c1a25' }} />
          <div className="flex gap-3">
            <div className="w-28 h-8 rounded" style={{ background: '#7c3aed' }} />
            <div className="w-28 h-8 rounded" style={{ border: '1px solid rgba(74,68,85,0.3)' }} />
          </div>
        </div>
        <div className="space-y-3">
          <div className="w-full h-48 rounded-xl" style={{ background: '#2b2834' }} />
        </div>
      </div>
    </div>
  )
}

// ── Score badge ────────────────────────────────────────────────────
function ScoreBadge({ eng, pred }: { eng: string; pred: string }) {
  return (
    <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5 z-10">
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(15,13,24,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(74,68,85,0.3)' }}>
        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(204,195,216,0.5)' }}>Engagement</span>
        <span className="text-sm font-black" style={{ color: '#d2bbff' }}>{eng}</span>
      </div>
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(15,13,24,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(124,58,237,0.25)' }}>
        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(204,195,216,0.5)' }}>Predicted</span>
        <span className="text-sm font-black" style={{ color: '#a855f7' }}>{pred}</span>
      </div>
    </div>
  )
}

// ── Heatmap window ─────────────────────────────────────────────────
function HeatmapWindow({ label, overlay, eng, pred }: { label: string; overlay: string; eng: string; pred: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: label === 'Before' ? 'rgba(255,255,255,0.2)' : '#a855f7' }} />
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(204,195,216,0.5)' }}>{label}</span>
      </div>
      <div className="relative rounded-xl overflow-hidden" style={{ background: '#201e2a', border: label === 'After' ? '1px solid rgba(124,58,237,0.25)' : '1px solid rgba(74,68,85,0.15)', boxShadow: label === 'After' ? '0 0 30px rgba(124,58,237,0.12)' : undefined }}>
        <MockUI />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: overlay, mixBlendMode: 'screen', opacity: 0.85 }}
        />
        <ScoreBadge eng={eng} pred={pred} />
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────
export default function SimulationPage() {
  const [activeTab, setActiveTab] = useState<'performance' | 'ux'>('performance')
  const [selectedScreen, setSelectedScreen] = useState(SCREENS[0])
  const [selectedHeatmap, setSelectedHeatmap] = useState('attention')
  const [panelOpen, setPanelOpen] = useState(true)

  const overlay = HEATMAP_OVERLAYS[selectedHeatmap]
  const scores = SCORES[selectedHeatmap]
  const analytics = ANALYTICS[selectedHeatmap]

  return (
    <div className="px-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest" style={{ background: 'rgba(111,0,190,0.3)', color: '#ddb7ff' }}>Simulation Active</span>
        <span className="text-xs" style={{ color: 'rgba(204,195,216,0.5)' }}>AI Predicted Metrics</span>
      </div>
      <h1 className="text-3xl font-extrabold tracking-tight text-white mb-6">UX Performance Prediction Layer</h1>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-8 p-1 rounded-lg w-fit" style={{ background: '#1c1a25', border: '1px solid rgba(74,68,85,0.15)' }}>
        {[
          { key: 'performance', label: 'UX Performance' },
          { key: 'ux', label: 'UX Simulation' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as 'performance' | 'ux')}
            className="px-4 py-1.5 rounded text-xs font-bold uppercase tracking-widest transition-all"
            style={activeTab === tab.key
              ? { background: '#7c3aed', color: 'white' }
              : { color: 'rgba(204,195,216,0.45)' }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── UX Performance tab (existing) ── */}
      {activeTab === 'performance' && (
        <div className="grid grid-cols-12 gap-8 items-start">
          {/* Left: Heatmap Preview */}
          <div className="col-span-12 lg:col-span-8">
            <div className="relative rounded-xl overflow-hidden" style={{ background: '#201e2a', border: '1px solid rgba(74,68,85,0.15)' }}>
              <div className="w-full" style={{ aspectRatio: '16/9' }}>
                <div className="p-8 space-y-6">
                  <div className="flex justify-between items-center">
                    <div className="w-32 h-6 rounded" style={{ background: 'rgba(255,255,255,0.06)' }} />
                    <div className="flex gap-4">
                      <div className="w-20 h-4 rounded" style={{ background: 'rgba(255,255,255,0.04)' }} />
                      <div className="w-20 h-4 rounded" style={{ background: 'rgba(255,255,255,0.04)' }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-6">
                    <div className="col-span-2 space-y-4">
                      <div className="w-3/4 h-12 rounded-lg" style={{ background: 'rgba(124,58,237,0.15)' }} />
                      <div className="w-full h-40 rounded-xl" style={{ background: '#1c1a25' }} />
                      <div className="flex gap-4">
                        <div className="w-32 h-10 rounded" style={{ background: '#7c3aed' }} />
                        <div className="w-32 h-10 rounded" style={{ border: '1px solid rgba(74,68,85,0.3)' }} />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="w-full h-64 rounded-xl" style={{ background: '#2b2834' }} />
                    </div>
                  </div>
                </div>
              </div>
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'radial-gradient(circle at 30% 25%, rgba(255,0,0,0.35) 0%, transparent 25%), radial-gradient(circle at 25% 70%, rgba(255,165,0,0.25) 0%, transparent 30%), radial-gradient(circle at 65% 55%, rgba(0,100,255,0.15) 0%, transparent 35%)',
                  mixBlendMode: 'screen',
                  opacity: 0.8,
                }}
              />
              <div
                className="absolute top-1/4 left-1/3 p-4 rounded-lg max-w-[220px]"
                style={{ background: 'rgba(54,51,63,0.9)', backdropFilter: 'blur(20px)', border: '1px solid rgba(124,58,237,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-sm" style={{ color: '#d2bbff' }}>filter_center_focus</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#d2bbff' }}>High Attention</span>
                </div>
                <p className="text-xs" style={{ color: 'rgba(230,224,240,0.8)' }}>Primary CTA achieves 88% visual saliency within 2s.</p>
              </div>
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center p-1.5 rounded-full" style={{ background: 'rgba(15,13,24,0.8)', backdropFilter: 'blur(12px)', border: '1px solid rgba(74,68,85,0.3)' }}>
                <button className="px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(204,195,216,0.5)' }}>Before</button>
                <button className="px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest" style={{ background: '#7c3aed', color: 'white' }}>After</button>
              </div>
            </div>
            <div className="mt-4 flex justify-between items-center px-2">
              <p className="text-sm" style={{ color: 'rgba(204,195,216,0.5)' }}>Visual Saliency Map: Transformed Design (Iteration 4.2)</p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-[10px] uppercase font-bold" style={{ color: 'rgba(204,195,216,0.5)' }}>Hot</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-[10px] uppercase font-bold" style={{ color: 'rgba(204,195,216,0.5)' }}>Cold</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: ROI Metrics */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            <div className="rounded-xl p-6" style={{ background: '#1c1a25', border: '1px solid rgba(74,68,85,0.15)' }}>
              <h3 className="text-xs font-bold uppercase tracking-widest mb-6" style={{ color: 'rgba(204,195,216,0.5)' }}>UX Improvement ROI</h3>
              <div className="space-y-8">
                {METRICS.map((m, i) => (
                  <div key={i}>
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-sm font-medium text-white">{m.label}</span>
                      <span className="text-xl font-bold" style={{ color: m.color }}>{m.value}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(54,51,63,1)' }}>
                      <div className="h-full rounded-full" style={{ width: `${m.percent}%`, background: m.color }} />
                    </div>
                    <p className="text-[10px] mt-2" style={{ color: 'rgba(204,195,216,0.4)' }}>{m.desc}</p>
                  </div>
                ))}
              </div>
              <div className="pt-6 mt-6" style={{ borderTop: '1px solid rgba(74,68,85,0.1)' }}>
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg" style={{ background: 'rgba(124,58,237,0.15)', color: '#d2bbff' }}>
                    <span className="material-symbols-outlined">visibility</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(204,195,216,0.5)' }}>Attention Focus</p>
                    <p className="text-2xl font-black text-white">Improved 1.8x</p>
                  </div>
                </div>
                <div className="mt-4 p-3 rounded-lg" style={{ background: 'rgba(54,51,63,0.4)' }}>
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-sm mt-0.5" style={{ color: '#d2bbff' }}>auto_awesome</span>
                    <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(204,195,216,0.6)' }}>
                      The AI predicts a significant reduction in cognitive load by consolidating layout clusters.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-xl p-6" style={{ background: '#1c1a25', border: '1px solid rgba(74,68,85,0.15)' }}>
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(204,195,216,0.5)' }}>Confidence Level</span>
                <span className="text-xs font-bold" style={{ color: '#d2bbff' }}>94.2%</span>
              </div>
              <div className="flex gap-1 h-1.5">
                {[1,2,3,4].map(n => <div key={n} className="flex-1 rounded-full" style={{ background: '#d2bbff' }} />)}
                <div className="flex-1 rounded-full" style={{ background: 'rgba(54,51,63,1)' }} />
              </div>
              <p className="mt-4 text-[10px] leading-relaxed" style={{ color: 'rgba(204,195,216,0.4)' }}>
                Based on 1.2M training sets from top-performing B2B interfaces.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── UX Simulation tab (new) ── */}
      {activeTab === 'ux' && (
        <div>
          {/* Controls row */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            {/* Screen dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(204,195,216,0.4)' }}>Screen</span>
              <select
                value={selectedScreen}
                onChange={(e) => setSelectedScreen(e.target.value)}
                className="text-xs font-medium rounded-lg px-3 py-1.5 outline-none cursor-pointer"
                style={{ background: '#1c1a25', border: '1px solid rgba(74,68,85,0.3)', color: 'rgba(230,224,240,0.85)' }}
              >
                {SCREENS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
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
            <div className="flex-1 min-w-0 space-y-4">
              <HeatmapWindow
                label="Before"
                overlay={overlay.before}
                eng={scores.beforeEng}
                pred={scores.beforePred}
              />
              <HeatmapWindow
                label="After"
                overlay={overlay.after}
                eng={scores.afterEng}
                pred={scores.afterPred}
              />

              {/* Legend */}
              <div className="flex justify-between items-center px-1 pt-1">
                <p className="text-sm" style={{ color: 'rgba(204,195,216,0.4)' }}>
                  {HEATMAP_TYPES.find(h => h.key === selectedHeatmap)?.label} Heatmap · {selectedScreen}
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-[10px] uppercase font-bold" style={{ color: 'rgba(204,195,216,0.5)' }}>Hot</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-[10px] uppercase font-bold" style={{ color: 'rgba(204,195,216,0.5)' }}>Cold</span>
                  </div>
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
                          <span className="text-lg font-bold" style={{ color: '#d2bbff' }}>{analytics.roi}</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(54,51,63,1)' }}>
                          <div className="h-full rounded-full" style={{ width: `${parseInt(analytics.roi)}%`, background: '#d2bbff' }} />
                        </div>
                      </div>
                      {/* Engagement */}
                      <div>
                        <div className="flex justify-between items-end mb-1.5">
                          <span className="text-xs font-medium text-white">Engagement Change</span>
                          <span className="text-lg font-bold" style={{ color: '#ddb7ff' }}>{analytics.engagement}</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(54,51,63,1)' }}>
                          <div className="h-full rounded-full" style={{ width: `${analytics.engagementRaw}%`, background: '#ddb7ff' }} />
                        </div>
                      </div>
                    </div>

                    {/* Score delta */}
                    <div className="mt-5 pt-5 grid grid-cols-2 gap-3" style={{ borderTop: '1px solid rgba(74,68,85,0.1)' }}>
                      <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(54,51,63,0.4)' }}>
                        <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(204,195,216,0.4)' }}>Before</p>
                        <p className="text-xl font-black text-white">{scores.beforeEng}</p>
                        <p className="text-[9px]" style={{ color: 'rgba(204,195,216,0.35)' }}>eng. score</p>
                      </div>
                      <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)' }}>
                        <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(204,195,216,0.4)' }}>After</p>
                        <p className="text-xl font-black" style={{ color: '#d2bbff' }}>{scores.afterEng}</p>
                        <p className="text-[9px]" style={{ color: 'rgba(204,195,216,0.35)' }}>eng. score</p>
                      </div>
                    </div>
                  </div>

                  {/* Confidence card */}
                  <div className="rounded-xl p-5" style={{ background: '#1c1a25', border: '1px solid rgba(74,68,85,0.15)' }}>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(204,195,216,0.5)' }}>Confidence</span>
                      <span className="text-xs font-bold" style={{ color: '#d2bbff' }}>{analytics.confidence}</span>
                    </div>
                    <div className="flex gap-1 h-1.5 mb-4">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-full"
                          style={{ background: i < Math.round(analytics.confidenceRaw / 20) ? '#d2bbff' : 'rgba(54,51,63,1)' }}
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
                      <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(204,195,216,0.6)' }}>{analytics.insight}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
