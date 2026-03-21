'use client'

import { useState } from 'react'
import { Zap } from 'lucide-react'
import type { TransformState, StylePreset } from '@/types'
import UploadPanel from './UploadPanel'
import BeforeAfterCanvas from './BeforeAfterCanvas'
import ControlsPanel from './ControlsPanel'

export default function DemoWorkspace() {
  const [state, setState] = useState<TransformState>('empty')
  const [preset, setPreset] = useState<StylePreset>('railway')

  const handleUpload = () => setState('uploaded')

  const handleRefine = () => {
    setState('loading')
    setTimeout(() => setState('complete'), 2800)
  }

  const handleReset = () => {
    setState('empty')
  }

  return (
    <section id="demo" className="py-24 relative">
      {/* Subtle background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-indigo-500/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-[1280px] mx-auto px-6 relative">
        {/* Section header */}
        <div className="flex flex-col items-center text-center mb-10">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-4">
            <Zap size={11} className="text-indigo-400" />
            <span className="text-indigo-400 text-xs font-medium">Live demo</span>
          </div>
          <h2 className="text-3xl font-bold text-zinc-100 mb-3 tracking-tight">
            See it in action
          </h2>
          <p className="text-zinc-500 text-base max-w-xl leading-relaxed">
            Upload a screenshot, choose a style preset, and watch RefineUI transform your interface
            in seconds.
          </p>
        </div>

        {/* Workspace panel */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm overflow-hidden shadow-2xl">
          {/* Workspace title bar */}
          <div className="border-b border-zinc-800 px-5 py-3 flex items-center gap-3 bg-zinc-900/80">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/60 hover:bg-red-500 transition-colors" />
              <div className="w-3 h-3 rounded-full bg-amber-500/60 hover:bg-amber-500 transition-colors" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/60 hover:bg-emerald-500 transition-colors" />
            </div>
            <div className="flex-1 flex items-center justify-center">
              <span className="text-zinc-500 text-xs font-mono">refineui — workspace</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  state === 'loading'
                    ? 'bg-amber-400 animate-pulse'
                    : state === 'complete'
                      ? 'bg-emerald-400'
                      : 'bg-zinc-700'
                }`}
              />
              <span className="text-zinc-600 text-[10px]">
                {state === 'empty' && 'Waiting for input'}
                {state === 'uploaded' && 'Ready to refine'}
                {state === 'loading' && 'Processing...'}
                {state === 'complete' && 'Transformation complete'}
              </span>
            </div>
          </div>

          {/* Workspace body */}
          <div className="grid grid-cols-[200px_1fr_220px] gap-0 divide-x divide-zinc-800/60">
            {/* Left: upload */}
            <div className="p-5">
              <UploadPanel state={state} onUpload={handleUpload} />
            </div>

            {/* Center: canvas */}
            <div className="p-5 flex flex-col min-h-[380px]">
              <BeforeAfterCanvas state={state} preset={preset} />

              {/* Refine button — shown centered when uploaded */}
              {state === 'uploaded' && (
                <div className="mt-4 flex justify-center animate-slide-up">
                  <button
                    onClick={handleRefine}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold transition-all shadow-glow-sm hover:shadow-glow-indigo"
                  >
                    <Zap size={14} strokeWidth={2.5} />
                    Refine UI
                  </button>
                </div>
              )}
            </div>

            {/* Right: controls */}
            <div className="p-5">
              <ControlsPanel
                state={state}
                preset={preset}
                onPresetChange={setPreset}
                onRefine={handleRefine}
                onReset={handleReset}
              />
            </div>
          </div>
        </div>

        {/* Footnote */}
        <p className="text-center text-zinc-700 text-xs mt-5">
          Demo uses a sample dashboard. Works with any screenshot — forms, dashboards, landing
          pages.
        </p>
      </div>
    </section>
  )
}
