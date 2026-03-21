'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TransformState, StylePreset } from '@/types'
import RepoInputPanel from './RepoInputPanel'
import BeforeAfterCanvas from './BeforeAfterCanvas'
import ControlsPanel from './ControlsPanel'

export default function DemoWorkspace({ initialRepoUrl }: { initialRepoUrl?: string } = {}) {
  const searchParams = useSearchParams()
  const [state, setState] = useState<TransformState>(initialRepoUrl ? 'uploaded' : 'empty')
  const [preset, setPreset] = useState<StylePreset>('railway')
  const [repoUrl, setRepoUrl] = useState(initialRepoUrl ?? '')

  useEffect(() => {
    const repo = searchParams.get('repo')
    if (repo) {
      setRepoUrl(repo)
      setState('uploaded')
    }
  }, [searchParams])
  const [isDraggingOver, setIsDraggingOver] = useState(false)

  const handleSubmit = () => {
    if (state === 'empty') setState('uploaded')
  }

  const handleRefine = () => {
    setState('loading')
    setTimeout(() => setState('complete'), 2800)
  }

  const handleRemove = () => {
    setState('empty')
  }

  const handleReset = () => {
    setState('empty')
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingOver(false)
  }

  return (
    <section id="demo" className="py-24 relative">
      {/* Subtle background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full blur-3xl" style={{ background: 'rgba(124,58,237,0.06)' }} />
      </div>

      <div className="max-w-[1280px] mx-auto px-6 relative">
        {/* Section header */}
        <div className="flex flex-col items-center text-center mb-10">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-4"
            style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)', color: '#a855f7' }}
          >
            <Zap size={11} />
            Live demo
          </div>
          <h2 className="font-bold tracking-tight mb-3" style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', color: '#ffffff' }}>
            See it in action
          </h2>
          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.35)', maxWidth: '480px', lineHeight: 1.7 }}>
            Paste a GitHub repo URL, choose a style preset, and watch RefineUI transform your
            frontend in seconds.
          </p>
        </div>

        {/* Workspace panel */}
        <div
          className="rounded-2xl overflow-hidden shadow-2xl"
          style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(8px)' }}
        >
          {/* Title bar */}
          <div
            className="px-5 py-3 flex items-center gap-3"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
          >
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/60 hover:bg-red-500 transition-colors" />
              <div className="w-3 h-3 rounded-full bg-amber-500/60 hover:bg-amber-500 transition-colors" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/60 hover:bg-emerald-500 transition-colors" />
            </div>
            <div className="flex-1 flex items-center justify-center">
              <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>refineui — workspace</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  state === 'loading'
                    ? 'bg-amber-400 animate-pulse'
                    : state === 'complete'
                      ? 'bg-emerald-400'
                      : ''
                }`}
                style={state === 'empty' || state === 'uploaded' ? { background: 'rgba(255,255,255,0.15)' } : {}}
              />
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
                {state === 'empty' && 'Waiting for input'}
                {state === 'uploaded' && 'Ready to refine'}
                {state === 'loading' && 'Processing...'}
                {state === 'complete' && 'Transformation complete'}
              </span>
            </div>
          </div>

          {/* Workspace body */}
          <div
            className={cn(
              'grid grid-cols-[200px_1fr_220px] gap-0 transition-all duration-150',
              isDraggingOver && 'ring-2 ring-inset ring-purple-500/30'
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Left: repo input */}
            <div className="p-5" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
              <RepoInputPanel
                state={state}
                repoUrl={repoUrl}
                onRepoUrl={setRepoUrl}
                onSubmit={handleSubmit}
                onRemove={handleRemove}
              />
            </div>

            {/* Center: canvas */}
            <div className="p-5 flex flex-col min-h-[380px]">
              <BeforeAfterCanvas
                state={state}
                preset={preset}
                repoUrl={repoUrl}
              />

              {/* Refine button */}
              {state === 'uploaded' && (
                <div className="mt-4 flex justify-center animate-slide-up">
                  <button
                    onClick={handleRefine}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-semibold transition-all"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 0 20px rgba(124,58,237,0.3)' }}
                  >
                    <Zap size={14} strokeWidth={2.5} />
                    Refine UI
                  </button>
                </div>
              )}
            </div>

            {/* Right: controls */}
            <div className="p-5" style={{ borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
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

        <p className="text-center text-xs mt-5" style={{ color: 'rgba(255,255,255,0.18)' }}>
          Works with any public GitHub repository. No account required.
        </p>
      </div>
    </section>
  )
}
