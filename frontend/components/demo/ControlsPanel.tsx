'use client'

import { RotateCcw, Code2, Download, ChevronRight } from 'lucide-react'
import { STYLE_PRESETS, MOCK_TRANSFORM_RESULT } from '@/lib/mock-data'
import type { TransformState, StylePreset } from '@/types'

interface Props {
  state: TransformState
  preset: StylePreset
  onPresetChange: (p: StylePreset) => void
  onRefine: () => void
  onReset: () => void
}

export default function ControlsPanel({ state, preset, onPresetChange, onRefine, onReset }: Props) {
  const { improvements, issuesDetected, issuesFixed, score } = MOCK_TRANSFORM_RESULT

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto">
      <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>
        Controls
      </div>

      {/* Style presets */}
      <div>
        <div className="text-[10px] font-medium mb-2" style={{ color: 'rgba(255,255,255,0.25)' }}>Style preset</div>
        <div className="flex flex-col gap-1.5">
          {STYLE_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => onPresetChange(p.id)}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-all"
              style={
                preset === p.id
                  ? { border: '1px solid rgba(168,85,247,0.4)', background: 'rgba(124,58,237,0.1)', color: '#ffffff' }
                  : { border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.4)' }
              }
              onMouseEnter={(e) => {
                if (preset !== p.id) {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
                }
              }}
              onMouseLeave={(e) => {
                if (preset !== p.id) {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.4)'
                }
              }}
            >
              <div>
                <div className="text-[11px] font-medium">{p.label}</div>
                <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.2)' }}>{p.description}</div>
              </div>
              {preset === p.id && (
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#a855f7', boxShadow: '0 0 6px #a855f7' }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Score — visible after complete */}
      {state === 'complete' && (
        <div className="rounded-xl p-3" style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
          <div className="text-[10px] font-medium mb-3" style={{ color: 'rgba(255,255,255,0.25)' }}>Quality score</div>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.2)' }}>{score.before}</div>
              <div className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.2)' }}>Before</div>
            </div>
            <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.15)' }} />
            <div className="text-center">
              <div className="text-2xl font-bold" style={{ color: '#a855f7' }}>{score.after}</div>
              <div className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>After</div>
            </div>
          </div>
          <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${score.after}%`, background: 'linear-gradient(to right, #7c3aed, #a855f7)' }}
            />
          </div>
        </div>
      )}

      {/* Improvements list — visible after complete */}
      {state === 'complete' && (
        <div className="flex-1">
          <div className="text-[10px] font-medium mb-2" style={{ color: 'rgba(255,255,255,0.25)' }}>
            {issuesFixed} of {issuesDetected} issues fixed
          </div>
          <div className="flex flex-col gap-1.5">
            {improvements.slice(0, 5).map((imp) => (
              <div
                key={imp.id}
                className="flex items-start gap-2 p-2 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <span
                  className="text-[9px] font-medium px-1.5 py-0.5 rounded-md flex-shrink-0 mt-0.5"
                  style={{ background: 'rgba(124,58,237,0.15)', color: '#c084fc', border: '1px solid rgba(124,58,237,0.25)' }}
                >
                  {imp.category}
                </span>
                <div>
                  <div className="text-[10px] font-medium leading-tight" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    {imp.label}
                  </div>
                  <div className="text-[9px] mt-0.5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    {imp.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-2 pt-2">
        {/* Refine button */}
        {(state === 'uploaded' || state === 'complete') && (
          <button
            onClick={onRefine}
            className="w-full py-2.5 rounded-xl text-[12px] font-semibold transition-all text-white"
            style={
              state === 'complete'
                ? { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }
                : { background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 0 20px rgba(124,58,237,0.3)' }
            }
          >
            {state === 'complete' ? 'Regenerate' : 'Refine UI'}
          </button>
        )}

        {/* Export code button */}
        {state === 'complete' && (
          <button
            className="w-full py-2 rounded-xl text-[11px] font-medium transition-all flex items-center justify-center gap-1.5"
            style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
          >
            <Code2 size={12} />
            Export code
          </button>
        )}

        {/* Download */}
        {state === 'complete' && (
          <button
            className="w-full py-2 rounded-xl text-[11px] font-medium transition-colors flex items-center justify-center gap-1.5"
            style={{ color: 'rgba(255,255,255,0.2)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
          >
            <Download size={12} />
            Save image
          </button>
        )}

        {/* Reset */}
        {state !== 'empty' && (
          <button
            onClick={onReset}
            className="flex items-center justify-center gap-1.5 text-[10px] transition-colors py-1"
            style={{ color: 'rgba(255,255,255,0.15)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.15)')}
          >
            <RotateCcw size={10} />
            Start over
          </button>
        )}
      </div>
    </div>
  )
}
