'use client'

import { RotateCcw, Code2, Download, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STYLE_PRESETS, MOCK_TRANSFORM_RESULT } from '@/lib/mock-data'
import type { TransformState, StylePreset } from '@/types'

interface Props {
  state: TransformState
  preset: StylePreset
  onPresetChange: (p: StylePreset) => void
  onRefine: () => void
  onReset: () => void
}

const CATEGORY_COLORS: Record<string, string> = {
  spacing: 'text-blue-400 bg-blue-950/50 border-blue-800/50',
  typography: 'text-violet-400 bg-violet-950/50 border-violet-800/50',
  color: 'text-orange-400 bg-orange-950/50 border-orange-800/50',
  hierarchy: 'text-indigo-400 bg-indigo-950/50 border-indigo-800/50',
  consistency: 'text-emerald-400 bg-emerald-950/50 border-emerald-800/50',
}

export default function ControlsPanel({ state, preset, onPresetChange, onRefine, onReset }: Props) {
  const { improvements, issuesDetected, issuesFixed, score } = MOCK_TRANSFORM_RESULT

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto">
      <div className="text-zinc-400 text-[11px] font-medium uppercase tracking-wider">Controls</div>

      {/* Style presets */}
      <div>
        <div className="text-zinc-500 text-[10px] font-medium mb-2">Style preset</div>
        <div className="flex flex-col gap-1.5">
          {STYLE_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => onPresetChange(p.id)}
              className={cn(
                'flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all',
                preset === p.id
                  ? 'border-indigo-500/60 bg-indigo-500/10 text-zinc-100'
                  : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
              )}
            >
              <div>
                <div className="text-[11px] font-medium">{p.label}</div>
                <div className="text-[10px] text-zinc-600 mt-0.5">{p.description}</div>
              </div>
              {preset === p.id && (
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Score — visible after complete */}
      {state === 'complete' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
          <div className="text-zinc-500 text-[10px] font-medium mb-3">Quality score</div>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-zinc-600">{score.before}</div>
              <div className="text-[9px] text-zinc-600 mt-0.5">Before</div>
            </div>
            <ChevronRight size={14} className="text-zinc-700" />
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-400">{score.after}</div>
              <div className="text-[9px] text-zinc-500 mt-0.5">After</div>
            </div>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-1000"
              style={{ width: `${score.after}%` }}
            />
          </div>
        </div>
      )}

      {/* Improvements list — visible after complete */}
      {state === 'complete' && (
        <div className="flex-1">
          <div className="text-zinc-500 text-[10px] font-medium mb-2">
            {issuesFixed} of {issuesDetected} issues fixed
          </div>
          <div className="flex flex-col gap-1.5">
            {improvements.slice(0, 5).map((imp) => (
              <div
                key={imp.id}
                className="flex items-start gap-2 p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/60"
              >
                <span
                  className={cn(
                    'text-[9px] font-medium px-1.5 py-0.5 rounded-md border flex-shrink-0 mt-0.5',
                    CATEGORY_COLORS[imp.category]
                  )}
                >
                  {imp.category}
                </span>
                <div>
                  <div className="text-zinc-300 text-[10px] font-medium leading-tight">
                    {imp.label}
                  </div>
                  <div className="text-zinc-600 text-[9px] mt-0.5 leading-relaxed">
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
            disabled={false}
            className={cn(
              'w-full py-2.5 rounded-xl text-[12px] font-semibold transition-all',
              state === 'complete'
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                : 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-glow-sm'
            )}
          >
            {state === 'complete' ? 'Regenerate' : 'Refine UI'}
          </button>
        )}

        {/* Export code button */}
        {state === 'complete' && (
          <button className="w-full py-2 rounded-xl text-[11px] font-medium text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-700 transition-all flex items-center justify-center gap-1.5">
            <Code2 size={12} />
            Export code
          </button>
        )}

        {/* Download */}
        {state === 'complete' && (
          <button className="w-full py-2 rounded-xl text-[11px] font-medium text-zinc-500 hover:text-zinc-300 transition-colors flex items-center justify-center gap-1.5">
            <Download size={12} />
            Save image
          </button>
        )}

        {/* Reset */}
        {state !== 'empty' && (
          <button
            onClick={onReset}
            className="flex items-center justify-center gap-1.5 text-[10px] text-zinc-700 hover:text-zinc-500 transition-colors py-1"
          >
            <RotateCcw size={10} />
            Start over
          </button>
        )}
      </div>
    </div>
  )
}
