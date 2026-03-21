'use client'

import { useEffect, useState } from 'react'
import { Github } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TransformState, StylePreset } from '@/types'
import MockDashboardBefore from './MockDashboardBefore'
import MockDashboardAfter from './MockDashboardAfter'

interface Props {
  state: TransformState
  preset: StylePreset
  repoUrl?: string
}

function getGithubOgImage(repoUrl: string) {
  const match = repoUrl.match(/github\.com\/([^/]+\/[^/]+)/)
  if (!match) return null
  return `https://opengraph.githubassets.com/1/${match[1]}`
}

const LOADING_STEPS = [
  'Cloning repository...',
  'Scanning frontend components...',
  'Detecting UI inconsistencies...',
  'Applying style preset...',
  'Generating redesign...',
]

function DashboardFrame({
  children,
  label,
  badge,
  badgeVariant = 'default',
  scale = 0.5,
}: {
  children: React.ReactNode
  label: string
  badge?: string
  badgeVariant?: 'default' | 'success'
  scale?: number
}) {
  const contentHeight = 560 * scale

  return (
    <div className="flex flex-col gap-2 flex-1 min-w-0">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>
          {label}
        </span>
        {badge && (
          <span
            className="text-[9px] font-medium px-2 py-0.5 rounded-full"
            style={
              badgeVariant === 'success'
                ? { color: '#a855f7', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)' }
                : { color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }
            }
          >
            {badge}
          </span>
        )}
      </div>

      <div className="rounded-xl overflow-hidden flex flex-col shadow-xl" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="border-b px-3 py-2 flex items-center gap-1.5" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
          <div className="flex-1 mx-3">
            <div className="rounded text-[9px] px-2 py-1 text-center truncate" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.2)' }}>
              acme-admin.vercel.app
            </div>
          </div>
        </div>
        <div className="w-full overflow-hidden" style={{ height: `${contentHeight}px` }}>
          <div
            style={{
              width: '900px',
              height: '560px',
              transform: `scale(${scale})`,
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
    <div
      className="flex-1 flex flex-col items-center justify-center gap-4 rounded-xl min-h-[320px]"
      style={{ border: '1.5px dashed rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.01)' }}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <Github size={22} style={{ color: 'rgba(255,255,255,0.2)' }} />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>No repository linked</p>
        <p className="text-xs mt-1.5 max-w-[240px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Paste a GitHub repo URL in the input panel to see the before/after transformation.
        </p>
      </div>
    </div>
  )
}

function LoadingState({ repoUrl }: { repoUrl?: string }) {
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
        <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>
          Before
        </span>
        <span className="text-[10px] font-medium animate-pulse" style={{ color: '#a855f7' }}>
          Analyzing...
        </span>
      </div>

      <div
        className="rounded-xl overflow-hidden flex flex-col shadow-xl relative flex-1"
        style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}
      >
        <div className="border-b px-3 py-2 flex items-center gap-1.5" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
          <div className="flex-1 mx-3">
            <div className="rounded text-[9px] px-2 py-1 text-center" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.2)' }}>
              acme-admin.vercel.app
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden" style={{ height: '280px' }}>
          <RepoPreview imageUrl={repoUrl ? getGithubOgImage(repoUrl) : null} repoUrl={repoUrl} />

          <div className="absolute inset-0" style={{ background: 'rgba(13,12,22,0.55)' }} />

          <div
            className="absolute left-0 right-0 h-0.5 opacity-80 transition-none"
            style={{ top: `${scanY}%`, background: 'linear-gradient(to right, transparent, #a855f7, transparent)' }}
          />
          <div
            className="absolute left-0 right-0 h-8"
            style={{ top: `calc(${scanY}% - 16px)`, background: 'linear-gradient(to bottom, transparent, rgba(168,85,247,0.08), transparent)' }}
          />
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div
            className="h-full transition-all duration-150"
            style={{ width: `${progress}%`, background: 'linear-gradient(to right, #7c3aed, #a855f7)' }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[11px] animate-fade-in" key={stepIndex} style={{ color: 'rgba(255,255,255,0.3)' }}>
          {LOADING_STEPS[stepIndex]}
        </span>
        <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>{Math.round(progress)}%</span>
      </div>
    </div>
  )
}

function RepoPreview({ imageUrl, repoUrl }: { imageUrl: string | null; repoUrl?: string }) {
  const repoName = repoUrl?.replace('https://github.com/', '') ?? 'repository'
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={imageUrl} alt={repoName} className="w-full h-full object-cover" />
    )
  }
  return (
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
  )
}

function UploadedState({ repoUrl }: { repoUrl?: string }) {
  const imageUrl = repoUrl ? getGithubOgImage(repoUrl) : null
  const repoName = repoUrl?.replace('https://github.com/', '') ?? 'repository'

  return (
    <div className="flex-1 flex flex-col gap-2 animate-fade-in">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>
          Before
        </span>
        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>Ready to refine</span>
      </div>

      <div className="rounded-xl overflow-hidden flex flex-col shadow-xl flex-1" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="border-b px-3 py-2 flex items-center gap-1.5" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
          <div className="flex-1 mx-3">
            <div className="rounded text-[9px] px-2 py-1 text-center truncate" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.2)' }}>
              github.com/{repoName}
            </div>
          </div>
        </div>
        <div className="overflow-hidden flex-1" style={{ height: '280px' }}>
          <RepoPreview imageUrl={imageUrl} repoUrl={repoUrl} />
        </div>
      </div>
    </div>
  )
}

function CompleteState({ preset, repoUrl }: { preset: StylePreset; repoUrl?: string }) {
  return (
    <div className="flex gap-4 flex-1 animate-fade-in">
      <DashboardFrame label="Before" badge="Original" scale={0.38}>
        {repoUrl && getGithubOgImage(repoUrl) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={getGithubOgImage(repoUrl)!} alt={repoUrl} className="w-full h-full object-cover" />
        ) : (
          <MockDashboardBefore />
        )}
      </DashboardFrame>

      <div className="flex flex-col items-center justify-center gap-2 flex-shrink-0">
        <div className="flex flex-col items-center gap-1">
          <div className="w-px flex-1" style={{ height: '100px', background: 'linear-gradient(to bottom, transparent, rgba(168,85,247,0.3), transparent)' }} />
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)' }}
          >
            <span style={{ color: '#a855f7', fontSize: '11px' }}>→</span>
          </div>
          <div className="w-px flex-1" style={{ height: '100px', background: 'linear-gradient(to bottom, transparent, rgba(168,85,247,0.3), transparent)' }} />
        </div>
      </div>

      <DashboardFrame
        label="After"
        badge={`${preset.charAt(0).toUpperCase() + preset.slice(1)} preset`}
        badgeVariant="success"
        scale={0.38}
      >
        <MockDashboardAfter />
      </DashboardFrame>
    </div>
  )
}

export default function BeforeAfterCanvas({ state, preset, repoUrl }: Props) {
  if (state === 'empty') return <EmptyState />
  if (state === 'uploaded') return <UploadedState repoUrl={repoUrl} />
  if (state === 'loading') return <LoadingState repoUrl={repoUrl} />
  return <CompleteState preset={preset} repoUrl={repoUrl} />
}
