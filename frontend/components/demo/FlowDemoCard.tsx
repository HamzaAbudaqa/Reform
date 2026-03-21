'use client'

import { useEffect, useState, useRef } from 'react'

interface FlowStep {
  label: string
  /** Which mock element to highlight / click */
  target: string
  /** Duration to show this step (ms) */
  duration: number
}

interface FlowDemoCardProps {
  steps: FlowStep[]
  caption?: string
  variant: 'before' | 'after'
}

/**
 * Animated flow demo card — shows a sequence of user interactions
 * inside a mock dashboard UI. Loops infinitely with smooth transitions.
 */
export default function FlowDemoCard({ steps, caption, variant }: FlowDemoCardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'moving' | 'clicking' | 'transitioning'>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isAfter = variant === 'after'
  const accent = isAfter ? '#a855f7' : 'rgba(100,100,120,0.6)'

  useEffect(() => {
    let mounted = true
    let step = 0

    function runStep() {
      if (!mounted) return
      const s = steps[step % steps.length]

      setCurrentStep(step % steps.length)
      setPhase('moving')

      timerRef.current = setTimeout(() => {
        if (!mounted) return
        setPhase('clicking')

        timerRef.current = setTimeout(() => {
          if (!mounted) return
          setPhase('transitioning')

          timerRef.current = setTimeout(() => {
            if (!mounted) return
            step++
            setPhase('idle')
            runStep()
          }, 400)
        }, 300)
      }, s.duration * 0.5)
    }

    // Start after a small delay
    timerRef.current = setTimeout(runStep, isAfter ? 800 : 200)

    return () => {
      mounted = false
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const step = steps[currentStep]

  // Mock dashboard elements with targets
  const navItems = ['Dashboard', 'Projects', 'Settings', 'Deploy']
  const sidebarItems = isAfter
    ? ['Overview', 'Deploy', 'Logs']
    : ['Home', 'Workspace', 'Team', 'Billing', 'Integrations', 'Deploy']

  return (
    <div className="flex flex-col h-full">
      {/* Mock app UI */}
      <div className="flex-1 flex" style={{ background: isAfter ? '#0a0918' : '#f5f5f7', minHeight: '160px', fontSize: '7px' }}>
        {/* Sidebar */}
        <div className="flex flex-col py-2 px-1.5" style={{ width: isAfter ? '52px' : '60px', borderRight: `1px solid ${isAfter ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.08)'}`, background: isAfter ? 'rgba(255,255,255,0.01)' : '#ffffff' }}>
          <div className="flex items-center gap-1 px-1 mb-2">
            <div className="w-2 h-2 rounded-sm" style={{ background: isAfter ? '#7c3aed' : '#d1d5db' }} />
            <span style={{ color: isAfter ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.4)', fontSize: '6px', fontWeight: 600 }}>App</span>
          </div>
          {sidebarItems.map((item) => {
            const isTarget = step?.target === `sidebar:${item}`
            return (
              <div
                key={item}
                className="px-1.5 py-[3px] rounded transition-all duration-300"
                style={{
                  background: isTarget && phase !== 'idle'
                    ? (isAfter ? 'rgba(168,85,247,0.15)' : 'rgba(0,0,0,0.06)')
                    : 'transparent',
                  color: isTarget && phase !== 'idle'
                    ? (isAfter ? 'rgba(168,85,247,0.9)' : 'rgba(0,0,0,0.8)')
                    : (isAfter ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.35)'),
                  fontSize: '6px',
                }}
              >
                {item}
              </div>
            )
          })}
        </div>

        {/* Main content */}
        <div className="flex-1 p-2">
          {/* Top nav */}
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex gap-2">
              {navItems.slice(0, isAfter ? 2 : 4).map((item) => {
                const isTarget = step?.target === `nav:${item}`
                return (
                  <span
                    key={item}
                    className="transition-all duration-300"
                    style={{
                      color: isTarget && phase !== 'idle'
                        ? (isAfter ? '#a855f7' : 'rgba(0,0,0,0.9)')
                        : (isAfter ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.3)'),
                      fontSize: '6px',
                      fontWeight: isTarget ? 600 : 400,
                    }}
                  >
                    {item}
                  </span>
                )
              })}
            </div>
            {isAfter && (
              <div
                className="rounded px-1.5 py-[2px] transition-all duration-300"
                style={{
                  background: step?.target === 'cta:deploy' && phase !== 'idle' ? 'rgba(168,85,247,0.5)' : 'rgba(168,85,247,0.2)',
                  color: 'white',
                  fontSize: '6px',
                  fontWeight: 600,
                  boxShadow: step?.target === 'cta:deploy' && phase === 'clicking' ? '0 0 12px rgba(168,85,247,0.4)' : 'none',
                }}
              >
                Deploy
              </div>
            )}
          </div>

          {/* Content area */}
          <div className="space-y-1.5">
            {[1, 2, 3].map((n) => {
              const isTarget = step?.target === `card:${n}`
              return (
                <div
                  key={n}
                  className="rounded p-1.5 transition-all duration-300"
                  style={{
                    background: isTarget && phase !== 'idle'
                      ? (isAfter ? 'rgba(168,85,247,0.06)' : 'rgba(0,0,0,0.04)')
                      : (isAfter ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'),
                    border: isTarget && phase !== 'idle'
                      ? `1px solid ${isAfter ? 'rgba(168,85,247,0.2)' : 'rgba(0,0,0,0.1)'}`
                      : `1px solid ${isAfter ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)'}`,
                  }}
                >
                  <div className="flex gap-1">
                    <div className="h-1 rounded-full flex-1" style={{ background: isAfter ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)', width: `${50 + n * 10}%` }} />
                    <div className="h-1 rounded-full" style={{ background: isAfter ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', width: '20%' }} />
                  </div>
                </div>
              )
            })}

            {/* Modal overlay for "before" flow — shows extra friction */}
            {!isAfter && step?.target === 'modal:confirm' && phase !== 'idle' && (
              <div className="rounded p-2 mt-1 transition-all duration-300" style={{ background: 'white', border: '1px solid rgba(0,0,0,0.1)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                <div className="text-center">
                  <div style={{ fontSize: '6px', color: 'rgba(0,0,0,0.5)', marginBottom: '3px' }}>Confirm deployment?</div>
                  <div className="flex gap-1 justify-center">
                    <div className="rounded px-1.5 py-[2px]" style={{ background: 'rgba(0,0,0,0.04)', fontSize: '5px', color: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,0,0,0.1)' }}>Cancel</div>
                    <div className="rounded px-1.5 py-[2px]" style={{ background: '#2563eb', fontSize: '5px', color: 'white' }}>Confirm</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Animated cursor */}
      <style>{`
        @keyframes cursorPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.4); } }
      `}</style>
      <div
        className="absolute transition-all duration-500 ease-out pointer-events-none"
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: accent,
          boxShadow: `0 0 8px ${accent}`,
          opacity: phase === 'idle' ? 0 : 0.8,
          animation: phase === 'clicking' ? 'cursorPulse 0.3s ease-out' : 'none',
          // Position roughly based on target area
          left: step?.target?.startsWith('sidebar') ? '15%' : step?.target?.startsWith('cta') ? '85%' : '55%',
          top: step?.target?.startsWith('nav') ? '30%' : step?.target?.includes('modal') ? '75%' : '50%',
        }}
      />

      {/* Step indicator + caption */}
      <div className="px-2 py-1.5 flex items-center justify-between" style={{ borderTop: `1px solid ${isAfter ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)'}`, background: isAfter ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.02)' }}>
        <div className="flex items-center gap-1">
          {steps.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === currentStep ? '10px' : '3px',
                height: '3px',
                background: i === currentStep ? accent : (isAfter ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
              }}
            />
          ))}
        </div>
        <span style={{ fontSize: '6px', color: isAfter ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.3)' }}>
          {step?.label}
        </span>
      </div>

      {/* Caption */}
      {caption && (
        <div className="text-center py-1" style={{ fontSize: '9px', color: isAfter ? 'rgba(168,85,247,0.6)' : 'rgba(0,0,0,0.35)' }}>
          {caption}
        </div>
      )}
    </div>
  )
}
