'use client'

const METRICS = [
  { label: 'Engagement Score', value: '+34%', percent: 34, color: '#d2bbff', desc: 'Predicted increase in session duration and feature interaction.' },
  { label: 'CTA Click Probability', value: '+22%', percent: 22, color: '#ddb7ff', desc: 'Calculated based on Fitts\' Law and visual contrast improvements.' },
  { label: 'Scroll Depth Change', value: '+15%', percent: 15, color: '#d2bbff', desc: 'Users predicted to explore 15% more content below the fold.' },
]

export default function SimulationPage() {
  return (
    <div className="px-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest" style={{ background: 'rgba(111,0,190,0.3)', color: '#ddb7ff' }}>Simulation Active</span>
        <span className="text-xs" style={{ color: 'rgba(204,195,216,0.5)' }}>AI Predicted Metrics</span>
      </div>
      <h1 className="text-3xl font-extrabold tracking-tight text-white mb-8">UX Performance Prediction Layer</h1>

      <div className="grid grid-cols-12 gap-8 items-start">
        {/* Left: Heatmap Preview */}
        <div className="col-span-12 lg:col-span-8">
          <div className="relative rounded-xl overflow-hidden" style={{ background: '#201e2a', border: '1px solid rgba(74,68,85,0.15)' }}>
            {/* Simulated UI base */}
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

            {/* Heatmap overlay */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'radial-gradient(circle at 30% 25%, rgba(255,0,0,0.35) 0%, transparent 25%), radial-gradient(circle at 25% 70%, rgba(255,165,0,0.25) 0%, transparent 30%), radial-gradient(circle at 65% 55%, rgba(0,100,255,0.15) 0%, transparent 35%)',
                mixBlendMode: 'screen',
                opacity: 0.8,
              }}
            />

            {/* Floating AI insight */}
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

            {/* Before/After toggle */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center p-1.5 rounded-full" style={{ background: 'rgba(15,13,24,0.8)', backdropFilter: 'blur(12px)', border: '1px solid rgba(74,68,85,0.3)' }}>
              <button className="px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(204,195,216,0.5)' }}>Before</button>
              <button className="px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest" style={{ background: '#7c3aed', color: 'white' }}>After</button>
            </div>
          </div>

          {/* Legend */}
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
          {/* Metrics card */}
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

            {/* Attention Focus */}
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

          {/* Confidence */}
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
    </div>
  )
}
