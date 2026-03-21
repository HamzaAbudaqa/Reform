'use client'

import { useEffect, useState } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TransformState, StylePreset } from '@/types'
import MockDashboardBefore from './MockDashboardBefore'
import MockDashboardAfter from './MockDashboardAfter'

interface Props {
  state: TransformState
  preset: StylePreset
}

const LOADING_STEPS = [
  'Analyzing layout structure...',
  'Detecting spacing inconsistencies...',
  'Identifying typography issues...',
  'Applying Railway preset...',
  'Generating redesign...',
]

// Wraps a mock dashboard with proper scale transform
function DashboardFrame({
  children,
  label,
  badge,
  badgeVariant = 'default',
}: {
  children: React.ReactNode
  label: string
  badge?: string
  badgeVariant?: 'default' | 'success'
}) {
  return (
    <div className="flex flex-col gap-2 flex-1 min-w-0">
      <div className="flex items-center justify-between">
        <span className="text-zinc-500 text-[10px] font-medium uppercase tracking-wider">
          {label}
        </span>
        {badge && (
          <span
            className={cn(
              'text-[9px] font-medium px-2 py-0.5 rounded-full border',
              badgeVariant === 'success'
                ? 'text-emerald-400 bg-emerald-950/50 border-emerald-800/50'
                : 'text-zinc-500 bg-zinc-900 border-zinc-800'
            )}
          >
            {badge}
          </span>
        )}
      </div>

      {/* Browser chrome */}
      <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900 flex flex-col shadow-xl">
        {/* Traffic lights */}
        <div className="bg-zinc-900 border-b border-zinc-800 px-3 py-2 flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
          <div className="flex-1 mx-3">
            <div className="bg-zinc-800 rounded text-[9px] text-zinc-600 px-2 py-1 text-center truncate">
              acme-admin.vercel.app
            </div>
          </div>
        </div>

        {/* Dashboard content — scaled */}
        <div className="w-full overflow-hidden" style={{ height: '280px' }}>
          <div
            style={{
              width: '900px',
              height: '560px',
              transform: 'scale(0.5)',
              transformOrigin: 'top left',
              pointerEvents: 'none',
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-zinc-800 bg-zinc-900/20 min-h-[320px]">
      <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
        <Upload size={22} className="text-zinc-600" />
      </div>
      <div className="text-center">
        <p className="text-zinc-400 text-sm font-medium">No screenshot uploaded</p>
        <p className="text-zinc-600 text-xs mt-1.5 max-w-[240px] leading-relaxed">
          Upload a UI screenshot in the input panel to see the before/after transformation.
        </p>
      </div>
    </div>
  )
}

function LoadingState() {
  const [stepIndex, setStepIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [scanY, setScanY] = useState(0)

  useEffect(() => {
    const stepTimer = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, LOADING_STEPS.length - 1))
    }, 520)

    const progressTimer = setInterval(() => {
      setProgress((p) => {
        if (p >= 95) return p
        return p + Math.random() * 6
      })
    }, 140)

    const scanTimer = setInterval(() => {
      setScanY((y) => (y >= 100 ? 0 : y + 2))
    }, 30)

    return () => {
      clearInterval(stepTimer)
      clearInterval(progressTimer)
      clearInterval(scanTimer)
    }
  }, [])

  return (
    <div className="flex-1 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-zinc-500 text-[10px] font-medium uppercase tracking-wider">
          Before
        </span>
        <span className="text-indigo-400 text-[10px] font-medium animate-pulse">
          Analyzing...
        </span>
      </div>

      {/* Dashboard with scan overlay */}
      <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900 flex flex-col shadow-xl relative flex-1">
        <div className="bg-zinc-900 border-b border-zinc-800 px-3 py-2 flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
          <div className="flex-1 mx-3">
            <div className="bg-zinc-800 rounded text-[9px] text-zinc-600 px-2 py-1 text-center">
              acme-admin.vercel.app
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden" style={{ height: '280px' }}>
          <div
            style={{
              width: '900px',
              height: '560px',
              transform: 'scale(0.5)',
              transformOrigin: 'top left',
              pointerEvents: 'none',
            }}
          >
            <MockDashboardBefore />
          </div>

          {/* Dark overlay */}
          <div className="absolute inset-0 bg-zinc-950/50" />

          {/* Scan line */}
          <div
            className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-80 transition-none"
            style={{ top: `${scanY}%` }}
          />
          <div
            className="absolute left-0 right-0 h-8 bg-gradient-to-b from-transparent via-indigo-500/10 to-transparent"
            style={{ top: `calc(${scanY}% - 16px)` }}
          />
        </div>

        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-800">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center justify-between">
        <span className="text-zinc-500 text-[11px] animate-fade-in" key={stepIndex}>
          {LOADING_STEPS[stepIndex]}
        </span>
        <span className="text-zinc-600 text-[10px] font-mono">{Math.round(progress)}%</span>
      </div>
    </div>
  )
}

function CompleteState({ preset }: { preset: StylePreset }) {
  return (
    <div className="flex gap-4 flex-1 animate-fade-in">
      <DashboardFrame label="Before" badge="Original">
        <MockDashboardBefore />
      </DashboardFrame>

      {/* Divider */}
      <div className="flex flex-col items-center justify-center gap-2 flex-shrink-0">
        <div className="flex flex-col items-center gap-1">
          <div className="w-px flex-1 bg-gradient-to-b from-transparent via-zinc-700 to-transparent" style={{ height: '100px' }} />
          <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
            <span className="text-zinc-400 text-[10px]">→</span>
          </div>
          <div className="w-px flex-1 bg-gradient-to-b from-transparent via-zinc-700 to-transparent" style={{ height: '100px' }} />
        </div>
      </div>

      <DashboardFrame
        label="After"
        badge={`${preset.charAt(0).toUpperCase() + preset.slice(1)} preset`}
        badgeVariant="success"
      >
        <MockDashboardAfter />
      </DashboardFrame>
    </div>
  )
}

export default function BeforeAfterCanvas({ state, preset }: Props) {
  if (state === 'empty') return <EmptyState />
  if (state === 'loading') return <LoadingState />
  if (state === 'complete') return <CompleteState preset={preset} />

  // uploaded state — show before only
  return (
    <div className="flex-1 flex flex-col gap-2 animate-fade-in">
      <div className="flex items-center justify-between">
        <span className="text-zinc-500 text-[10px] font-medium uppercase tracking-wider">
          Before
        </span>
        <span className="text-zinc-600 text-[10px]">Ready to refine</span>
      </div>

      <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900 flex flex-col shadow-xl flex-1">
        <div className="bg-zinc-900 border-b border-zinc-800 px-3 py-2 flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
          <div className="flex-1 mx-3">
            <div className="bg-zinc-800 rounded text-[9px] text-zinc-600 px-2 py-1 text-center">
              acme-admin.vercel.app
            </div>
          </div>
        </div>
        <div className="overflow-hidden" style={{ height: '280px' }}>
          <div
            style={{
              width: '900px',
              height: '560px',
              transform: 'scale(0.5)',
              transformOrigin: 'top left',
              pointerEvents: 'none',
            }}
          >
            <MockDashboardBefore />
          </div>
        </div>
      </div>
    </div>
  )
}
