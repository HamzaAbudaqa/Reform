'use client'

import { createContext, useContext, useState, useCallback } from 'react'

interface ProgressState {
  active: boolean
  progress: number
  label: string
}

interface ProgressContextType {
  state: ProgressState
  startProgress: (label: string) => void
  updateProgress: (progress: number) => void
  finishProgress: () => void
}

const ProgressContext = createContext<ProgressContextType | null>(null)

export function useProgress() {
  const ctx = useContext(ProgressContext)
  if (!ctx) throw new Error('useProgress must be used within ProgressProvider')
  return ctx
}

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ProgressState>({ active: false, progress: 0, label: '' })

  const startProgress = useCallback((label: string) => {
    setState({ active: true, progress: 5, label })
    // Auto-advance slowly to simulate progress
    let p = 5
    const interval = setInterval(() => {
      p += Math.random() * 8
      if (p > 90) { clearInterval(interval); return }
      setState(s => s.active ? { ...s, progress: Math.min(p, 90) } : s)
    }, 800)
    // Store interval ID for cleanup
    ;(window as unknown as Record<string, unknown>).__progressInterval = interval
  }, [])

  const updateProgress = useCallback((progress: number) => {
    setState(s => ({ ...s, progress: Math.min(progress, 99) }))
  }, [])

  const finishProgress = useCallback(() => {
    const interval = (window as unknown as Record<string, unknown>).__progressInterval as ReturnType<typeof setInterval>
    if (interval) clearInterval(interval)
    setState(s => ({ ...s, progress: 100 }))
    setTimeout(() => setState({ active: false, progress: 0, label: '' }), 500)
  }, [])

  return (
    <ProgressContext.Provider value={{ state, startProgress, updateProgress, finishProgress }}>
      {children}
    </ProgressContext.Provider>
  )
}
