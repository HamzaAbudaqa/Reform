'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
// Editor import removed — Code Editor tab eliminated in favor of no-code flow
import { apiUrl } from '@/lib/api'
import { getSelectedRepo, setSelectedRepo } from '@/lib/selectedRepo'
import { useSubscription } from '@/lib/useSubscription'
import UpgradeBanner from '@/components/dashboard/UpgradeBanner'
import GateErrorBanner, { parseResponseError, type GateErrorData } from '@/components/dashboard/GateError'
import TransformSummaryHeader from '@/components/dashboard/TransformSummaryHeader'
import TransformCarousel from '@/components/dashboard/TransformCarousel'
import { adaptLegacyResult } from '@/components/dashboard/TransformTypes'
import type { MultiPageTransformResult } from '@/components/dashboard/TransformTypes'
import { safeSetTransformCache } from '@/lib/transformCache'
import {
  fetchActiveRun,
  fetchRunProgress,
  isTerminalStatus,
  normalizeStatus,
  type RunMode,
} from '@/lib/projectsApi'

interface CommitEntry {
  hash: string
  msg: string
  color: string
  status: 'accepted' | 'rejected' | 'pending'
  code?: string
  suggestion?: string
}

const INITIAL_COMMITS: CommitEntry[] = []

interface AnalysisData {
  meta: { project_style_goal: string; description: string }
  sources: { url: string; page_type: string }[]
  design_tokens: Record<string, unknown>
}

interface TransformData {
  refined_ui: Record<string, unknown>
  code: string
}
interface FileEntry { path: string; content: string; size: number }
interface ComponentInfo { name: string; file_path: string; type: string; description: string }
interface CodeAnalysis {
  entry_points: string[]; layout_files: string[]; components: ComponentInfo[]
  dependency_map: Record<string, string[]>; recommended_target: string; target_reason: string
}
interface ChangeAnnotation { region: string; change_type: string; description: string; ux_impact: string }
interface TransformResult {
  transformed_files: { path: string; original_code: string; updated_code: string; diff_summary: string }[]
  change_annotations: ChangeAnnotation[]; change_summary: string[]
  before_screenshot: string; after_screenshot: string
  preview_route: string; preview_error?: string
}
interface GithubRepo {
  id: number; full_name: string; name: string; private: boolean
  language: string | null; updated_at: string; default_branch: string
  homepage: string | null; html_url: string
}
type PipelineStep = 'idle' | 'ingesting' | 'analyzing' | 'transforming' | 'complete'

type PipelineStage = { key: string; label: string; logLine: string; duration: number }

// Hardcoded substage timings that roughly track the backend pipeline.
// The backend is a single blocking request so we can't poll real progress —
// these durations are a realistic approximation for a 5-page run.
const PIPELINE_STAGES: PipelineStage[] = [
  { key: 'clone', label: 'Clone repo', logLine: 'Repository cloned and indexed', duration: 15 },
  { key: 'discover', label: 'Find pages', logLine: 'Discovered pages to analyze', duration: 20 },
  { key: 'evaluate', label: 'Score UI', logLine: 'Scored UI quality per page', duration: 35 },
  { key: 'plan', label: 'Plan rebuild', logLine: 'Built transformation plan', duration: 20 },
  { key: 'rebuild', label: 'Rebuild layouts', logLine: 'Rebuilt page layouts with Claude', duration: 120 },
  { key: 'render', label: 'Render preview', logLine: 'Rendered before/after screenshots', duration: 30 },
]

const PIPELINE_TOTAL_DURATION = PIPELINE_STAGES.reduce((sum, s) => sum + s.duration, 0)

const PIPELINE_TIPS = [
  'Reform rebuilds structure, not styling — your brand colors and voice stay intact.',
  'Every page gets a UX score before and after. Pages already above 85 are left alone.',
  'Competitor patterns from similar products are merged into your design intelligence.',
  'Purely cosmetic changes get rejected and retried — every rebuild must be structural.',
  'Claude extracts your data and handlers, then discards the layout and builds a new one.',
  'Each rebuilt page is rendered in a real Next.js dev server for the before/after preview.',
  'Runs cap at 5 pages — Reform picks the lowest-scoring ones to rebuild.',
  'The transform keeps all your imports, state, and handlers. Only the JSX tree changes.',
]

function PipelineProgress({
  repoName,
  startedAt,
  resumeLabel,
  overrideProgress,
  overrideStage,
}: {
  repoName: string
  startedAt: number
  /** Banner text shown when we resumed from an existing run. */
  resumeLabel?: string | null
  /** 0-100 — when provided, pins the progress bar (e.g. from the backend). */
  overrideProgress?: number | null
  /** Backend-provided stage key ('evaluating', 'transforming', etc.). */
  overrideStage?: string | null
}) {
  // Force re-render ~4x/sec so elapsed / stage / bar always reflect real
  // wall-clock, regardless of tab throttling or when the last tick fired.
  // On visibilitychange we force an immediate tick so users see fresh state
  // the moment they come back to the tab.
  const [, forceTick] = useState(0)
  useEffect(() => {
    const tick = () => forceTick(n => (n + 1) % 1_000_000)
    const id = setInterval(tick, 250)
    const onVisibility = () => { if (!document.hidden) tick() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  // Derived directly from wall-clock — never stored in state, so there's
  // no staleness after tab-switch, HMR, or throttling.
  const elapsedMs = Math.max(0, Date.now() - startedAt)
  const elapsed = Math.floor(elapsedMs / 1000)

  // Find the current substage by consuming durations left-to-right — the
  // time-based fallback when the backend hasn't surfaced a stage yet.
  let acc = 0
  let currentIdx = PIPELINE_STAGES.length - 1
  for (let i = 0; i < PIPELINE_STAGES.length; i++) {
    acc += PIPELINE_STAGES[i].duration
    if (elapsed < acc) { currentIdx = i; break }
  }

  // Prefer an explicit stage from the backend when available — map it onto
  // the closest PIPELINE_STAGES index so the step list still lines up.
  if (overrideStage) {
    const key = overrideStage.toLowerCase().trim()
    const mapping: Record<string, number> = {
      cloning: 0, ingesting: 0, clone: 0,
      discovering: 1, discover: 1,
      evaluating: 2, evaluate: 2, scoring: 2,
      planning: 3, plan: 3,
      transforming: 4, rebuild: 4, rebuilding: 4,
      rendering: 5, render: 5, saving: 5,
    }
    const mapped = mapping[key]
    if (typeof mapped === 'number') currentIdx = mapped
  }

  // Stage-based progress: every completed stage bumps the bar by 1/N, and the
  // active stage contributes fractional progress based on how far through
  // its estimated duration we are. Purely time-based progress was dishonest
  // because stage durations are inaccurate — the bar would max out while
  // the pipeline was still grinding through "Render preview".
  const stageCount = PIPELINE_STAGES.length
  const elapsedInCurrentStage = Math.max(0, elapsed - (acc - PIPELINE_STAGES[currentIdx].duration))
  const currentStageRatio = Math.min(0.95, elapsedInCurrentStage / PIPELINE_STAGES[currentIdx].duration)
  // Cap the per-stage contribution so the bar never reaches 100% until the
  // pipeline actually completes and the component unmounts.
  const stageProgress = Math.min(95, ((currentIdx + currentStageRatio) / stageCount) * 100)
  const overallProgress = typeof overrideProgress === 'number'
    ? Math.max(stageProgress, Math.min(95, overrideProgress))
    : stageProgress
  // Estimate remaining from the stages that haven't started + time left in
  // the current stage. When elapsed exceeds the full estimate (pipeline is
  // taking longer than expected), surface "finishing up" instead of 0s.
  const stagesLeft = PIPELINE_STAGES.slice(currentIdx + 1).reduce((s, st) => s + st.duration, 0)
  const timeLeftInCurrentStage = Math.max(0, PIPELINE_STAGES[currentIdx].duration - elapsedInCurrentStage)
  const remaining = stagesLeft + timeLeftInCurrentStage

  const tipIdx = Math.floor(elapsed / 8) % PIPELINE_TIPS.length
  const tip = PIPELINE_TIPS[tipIdx]

  const logLines: { text: string; done: boolean }[] = []
  for (let i = 0; i <= currentIdx; i++) {
    if (i < currentIdx) logLines.push({ text: PIPELINE_STAGES[i].logLine, done: true })
    else logLines.push({ text: PIPELINE_STAGES[i].label + '…', done: false })
  }
  const visibleLines = logLines.slice(-4)

  const fmt = (s: number) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`

  return (
    <div className="max-w-xl mx-auto pt-6 pb-10 w-full px-4">
      {resumeLabel && (
        <div
          className="rounded-lg px-3 py-2 mb-5 flex items-center gap-2"
          style={{ background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.15)' }}
        >
          <div className="w-3 h-3 rounded-full animate-spin flex-shrink-0" style={{ border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#0a0a0a' }} />
          <span className="text-[11px]" style={{ color: 'rgba(0,0,0,0.8)' }}>{resumeLabel}</span>
        </div>
      )}
      <div className="flex items-center justify-center flex-wrap gap-y-2 mb-6">
        {PIPELINE_STAGES.map((s, i) => {
          const isDone = i < currentIdx
          const isActive = i === currentIdx
          return (
            <div key={s.key} className="flex items-center">
              {i > 0 && <div className="w-4 h-px" style={{ background: isDone || isActive ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.06)' }} />}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{
                background: isActive ? 'rgba(0,0,0,0.12)' : isDone ? 'rgba(34,197,94,0.08)' : 'rgba(0,0,0,0.02)',
                border: `1px solid ${isActive ? 'rgba(0,0,0,0.3)' : isDone ? 'rgba(34,197,94,0.18)' : 'rgba(0,0,0,0.05)'}`,
              }}>
                {isDone ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                ) : isActive ? (
                  <div className="w-2.5 h-2.5 rounded-full animate-spin" style={{ border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#0a0a0a' }} />
                ) : (
                  <div className="w-2 h-2 rounded-full" style={{ background: 'rgba(0,0,0,0.1)' }} />
                )}
                <span className="text-[10px] font-medium whitespace-nowrap" style={{ color: isActive ? 'rgba(0,0,0,0.9)' : isDone ? 'rgba(34,197,94,0.7)' : 'rgba(0,0,0,0.25)' }}>{s.label}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="w-full h-1.5 rounded-full mb-3" style={{ background: 'rgba(0,0,0,0.04)' }}>
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-out"
          style={{
            width: `${Math.max(2, overallProgress)}%`,
            background: 'linear-gradient(90deg, #0a0a0a, #0a0a0a)',
            boxShadow: '0 0 14px rgba(0,0,0,0.35)',
          }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] font-mono mb-6" style={{ color: 'rgba(0,0,0,0.3)' }}>
        <span>{fmt(elapsed)} elapsed</span>
        <span>
          {currentIdx === PIPELINE_STAGES.length - 1 && remaining < 10
            ? 'finishing up…'
            : `~${fmt(remaining)} remaining`}
        </span>
      </div>

      <div className="rounded-xl px-4 py-3 mb-5" style={{
        background: 'rgba(0,0,0,0.015)',
        border: '1px solid rgba(0,0,0,0.05)',
      }}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#0a0a0a' }} />
          <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: 'rgba(0,0,0,0.35)' }}>
            {repoName || 'reform pipeline'}
          </span>
        </div>
        <div className="space-y-1 font-mono text-[11px]">
          {visibleLines.map((line, i) => (
            <div key={`${i}-${line.done ? 'd' : 'a'}`} className="flex items-center gap-2">
              {line.done ? (
                <span style={{ color: '#22c55e' }}>✓</span>
              ) : (
                <span className="animate-pulse" style={{ color: '#0a0a0a' }}>◐</span>
              )}
              <span style={{ color: line.done ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.78)' }}>
                {line.text}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center">
        <p className="text-[11px] leading-relaxed max-w-md mx-auto" style={{ color: 'rgba(0,0,0,0.42)' }}>
          <span style={{ color: 'rgba(0,0,0,0.65)' }}>◆ </span>
          {tip}
        </p>
      </div>
    </div>
  )
}

type Phase = 'idle' | 'listening' | 'thinking' | 'responding' | 'ready'

function VoiceOrb({ onFinalPrompt }: { onFinalPrompt: (prompt: string) => void }) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [hasGreeted, setHasGreeted] = useState(false)
  const [orbScale, setOrbScale] = useState(1)
  const [transcript, setTranscript] = useState('')
  const [aiResponse, setAiResponse] = useState('')
  const [displayText, setDisplayText] = useState('')
  const [error, setError] = useState('')
  const [history, setHistory] = useState<{ role: string; content: string }[]>([])
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null)
  const [interpretedIntent, setInterpretedIntent] = useState('')
  const typewriterRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stoppedRef = useRef(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number>(0)
  const ttsCtxRef = useRef<AudioContext | null>(null)
  const micCtxRef = useRef<AudioContext | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const micAnalyserRef = useRef<AnalyserNode | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasSpeechRef = useRef(false)
  const historyRef = useRef<{ role: string; content: string }[]>([])
  const mountedRef = useRef(true)

  useEffect(() => { historyRef.current = history }, [history])
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])

  const visualizeTTS = useCallback(() => {
    if (!analyserRef.current || !mountedRef.current) return
    const data = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(data)
    const avg = data.reduce((a, b) => a + b, 0) / data.length / 255
    setOrbScale(1 + avg * 0.3)
    animFrameRef.current = requestAnimationFrame(visualizeTTS)
  }, [])

  const visualizeMic = useCallback(() => {
    if (!micAnalyserRef.current || !mountedRef.current) return
    const data = new Uint8Array(micAnalyserRef.current.frequencyBinCount)
    micAnalyserRef.current.getByteFrequencyData(data)
    const avg = data.reduce((a, b) => a + b, 0) / data.length / 255
    setOrbScale(1 + avg * 0.25)

    // Track if user has spoken (volume above threshold)
    if (avg > 0.05) {
      hasSpeechRef.current = true
      if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null }
    }

    // Silence detection: user spoke then went quiet for 1.5s → stop recording
    if (avg < 0.02 && hasSpeechRef.current) {
      if (!silenceTimerRef.current) {
        silenceTimerRef.current = setTimeout(() => {
          if (mountedRef.current && recorderRef.current?.state === 'recording') {
            recorderRef.current.stop()
          }
        }, 1500)
      }
    }

    animFrameRef.current = requestAnimationFrame(visualizeMic)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  function stopMic() {
    cancelAnimationFrame(animFrameRef.current)
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop() } catch { /* */ }
    }
    recorderRef.current = null
    if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); micStreamRef.current = null }
    if (micCtxRef.current && micCtxRef.current.state !== 'closed') { micCtxRef.current.close().catch(() => {}); micCtxRef.current = null }
    micAnalyserRef.current = null
    chunksRef.current = []
  }

  function stopTTS() {
    cancelAnimationFrame(animFrameRef.current)
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.onended = null; audioRef.current = null }
    if (ttsCtxRef.current && ttsCtxRef.current.state !== 'closed') { ttsCtxRef.current.close().catch(() => {}); ttsCtxRef.current = null }
    analyserRef.current = null
  }

  async function startListening() {
    if (!mountedRef.current) return
    stoppedRef.current = false
    stopMic()
    setError('')
    setTranscript('')
    chunksRef.current = []
    hasSpeechRef.current = false

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      setError(`Mic: ${e instanceof Error ? e.message : 'denied'}`)
      setPhase('idle')
      return
    }
    if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return }
    micStreamRef.current = stream
    setPhase('listening')

    // Visualizer
    try {
      const ctx = new AudioContext()
      micCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      micAnalyserRef.current = analyser
      animFrameRef.current = requestAnimationFrame(visualizeMic)
    } catch { /* */ }

    // MediaRecorder — works in ALL browsers
    try {
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
        : 'audio/mp4'

      const recorder = new MediaRecorder(stream, { mimeType })
      recorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        // Stop mic stream and visualizer immediately
        cancelAnimationFrame(animFrameRef.current)
        if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); micStreamRef.current = null }
        if (micCtxRef.current && micCtxRef.current.state !== 'closed') { micCtxRef.current.close().catch(() => {}); micCtxRef.current = null }
        micAnalyserRef.current = null

        if (chunksRef.current.length === 0) { setPhase('idle'); return }
        const blob = new Blob(chunksRef.current, { type: mimeType })
        chunksRef.current = []

        // Only process if we're still supposed to be listening
        if (!mountedRef.current) return

        // Stop mic visuals
        cancelAnimationFrame(animFrameRef.current)
        setOrbScale(1)

        // Transcribe via backend
        setPhase('thinking')
        setTranscript('Transcribing...')

        try {
          const formData = new FormData()
          formData.append('audio', blob, `recording.${mimeType.includes('webm') ? 'webm' : 'mp4'}`)

          const res = await fetch(apiUrl('/transcribe'), {
            method: 'POST',
            body: formData,
          })

          if (!res.ok) throw new Error(`Transcribe failed: ${res.status}`)
          const data = await res.json()

          if (data.error && !data.transcript) {
            setTranscript('')
            setError(data.error)
            setPhase('idle')
            stopMic()
            return
          }

          const text = data.transcript?.trim()
          if (!text) {
            setTranscript('')
            setPhase('idle')
            stopMic()
            startListening() // no speech detected, restart
            return
          }

          setTranscript(text)
          stopMic()
          await processUserInput(text)
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Transcription failed')
          setPhase('idle')
          stopMic()
        }
      }

      recorder.start()
      setTranscript('')
      setDisplayText('Listening...')
    } catch (e) {
      setError(`Recorder: ${e instanceof Error ? e.message : 'failed'}`)
      stopMic()
      setPhase('idle')
    }
  }

  function typewrite(text: string, onDone?: () => void) {
    if (typewriterRef.current) clearTimeout(typewriterRef.current)
    setDisplayText('')
    let i = 0
    function tick() {
      if (!mountedRef.current) return
      if (i < text.length) {
        setDisplayText(text.slice(0, i + 1))
        i++
        typewriterRef.current = setTimeout(tick, 30)
      } else {
        onDone?.()
      }
    }
    tick()
  }

  async function processUserInput(userText: string) {
    setOrbScale(1)
    setPhase('thinking')
    typewrite(userText)

    const newHistory = [...historyRef.current, { role: 'user', content: userText }]
    setHistory(newHistory)

    let aiText: string
    let finalPrompt: string | null = null
    try {
      const storedAnalysis = sessionStorage.getItem('refineui_analysis')
      const analysisCtx = storedAnalysis ? JSON.parse(storedAnalysis) : null

      const res = await fetch(apiUrl('/voice-chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_message: userText,
          conversation_history: newHistory,
          analysis_context: analysisCtx,
        }),
      })

      if (!res.ok) throw new Error(`Backend: ${res.status}`)
      const data = await res.json()
      aiText = data.response
      finalPrompt = data.final_prompt || null
    } catch (e) {
      aiText = 'Sorry, I had trouble with that. What were you saying?'
      setError(e instanceof Error ? e.message : 'Backend error')
    }

    if (!mountedRef.current) return
    setAiResponse(aiText)
    setHistory(prev => [...prev, { role: 'assistant', content: aiText }])

    if (stoppedRef.current) return

    // If AI generated a final prompt, show interpreted intent for user confirmation
    if (finalPrompt) {
      setPendingPrompt(finalPrompt)
      // Extract a short intent summary from the AI response or prompt
      const intentSummary = finalPrompt.length > 80 ? finalPrompt.slice(0, 77) + '...' : finalPrompt
      setInterpretedIntent(intentSummary)
      typewrite(aiText, async () => {
        if (stoppedRef.current) return
        await playTTS(aiText)
        if (mountedRef.current && !stoppedRef.current) setPhase('ready')
      })
      return
    }

    // Otherwise continue conversation
    typewrite(aiText, async () => {
      if (stoppedRef.current) return
      await playTTS(aiText)
      if (mountedRef.current && !stoppedRef.current) startListening()
    })
  }

  async function playTTS(text: string): Promise<void> {
    if (!mountedRef.current) return
    setPhase('responding')

    try {
      const res = await fetch(apiUrl('/tts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      if (!res.ok) throw new Error('TTS failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)

      await new Promise<void>((resolve, reject) => {
        if (!mountedRef.current) { URL.revokeObjectURL(url); resolve(); return }

        const audio = new Audio(url)
        audioRef.current = audio

        try {
          const ctx = new AudioContext()
          ttsCtxRef.current = ctx
          const source = ctx.createMediaElementSource(audio)
          const analyser = ctx.createAnalyser()
          analyser.fftSize = 256
          source.connect(analyser)
          analyser.connect(ctx.destination)
          analyserRef.current = analyser
        } catch { /* play without visualizer */ }

        audio.onplay = () => {
          if (analyserRef.current) animFrameRef.current = requestAnimationFrame(visualizeTTS)
        }
        audio.onended = () => {
          cancelAnimationFrame(animFrameRef.current)
          setOrbScale(1)
          URL.revokeObjectURL(url)
          stopTTS()
          resolve()
        }
        audio.onerror = () => { URL.revokeObjectURL(url); stopTTS(); reject(new Error('Playback failed')) }
        audio.play().catch(reject)
      })
    } catch {
      stopTTS()
      if (mountedRef.current) setPhase('idle')
    }
  }

  async function greet() {
    const text = 'Hey! What are we designing today?'
    setAiResponse(text)
    setHistory([{ role: 'assistant', content: text }])
    typewrite(text)
    try { await playTTS(text) } catch { /* */ }
    if (mountedRef.current && !stoppedRef.current) { setPhase('idle'); startListening() }
  }

  function handleStop() {
    stoppedRef.current = true
    if (typewriterRef.current) { clearTimeout(typewriterRef.current); typewriterRef.current = null }
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null }
    stopMic()
    stopTTS()
    setOrbScale(1)
    setPhase('idle')
    setDisplayText('')
    setTranscript('')
  }

  function handleButtonClick() {
    if (phase === 'listening' || phase === 'responding') {
      handleStop()
    } else {
      stopTTS()
      startListening()
    }
  }

  useEffect(() => {
    if (!hasGreeted) {
      setHasGreeted(true)
      const timer = setTimeout(() => greet(), 600)
      return () => clearTimeout(timer)
    }
    return () => { stopMic(); stopTTS() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isActive = phase === 'listening' || phase === 'responding'
  const intensity = orbScale - 1

  const phaseLabel = {
    idle: 'Reform Voice',
    listening: 'Listening...',
    thinking: 'Thinking...',
    responding: 'Responding...',
    ready: 'Ready to send',
  }[phase]

  const phaseSub = {
    idle: 'Tap the mic to start talking',
    listening: 'Speak now \u2014 I\u2019ll respond when you pause',
    thinking: 'Processing your input...',
    responding: 'Reform AI is speaking',
    ready: 'Review your request below',
  }[phase]

  return (
    <div className="relative p-8 flex flex-col items-center justify-center overflow-hidden" style={{ minHeight: '340px' }}>
      <style>{`
        @keyframes blob1 {
          0%, 100% { border-radius: 42% 58% 62% 38% / 45% 55% 45% 55%; }
          25% { border-radius: 55% 45% 38% 62% / 58% 42% 58% 42%; }
          50% { border-radius: 38% 62% 55% 45% / 42% 58% 42% 58%; }
          75% { border-radius: 62% 38% 45% 55% / 55% 45% 55% 45%; }
        }
        @keyframes blob2 {
          0%, 100% { border-radius: 58% 42% 45% 55% / 62% 38% 55% 45%; }
          33% { border-radius: 45% 55% 58% 42% / 38% 62% 42% 58%; }
          66% { border-radius: 55% 45% 42% 58% / 45% 55% 62% 38%; }
        }
        @keyframes blobIdle {
          0%, 100% { border-radius: 47% 53% 51% 49% / 48% 52% 50% 50%; }
          50% { border-radius: 53% 47% 49% 51% / 52% 48% 50% 50%; }
        }
        @keyframes pulseThink {
          0%, 100% { transform: scale(1); opacity: 0.25; border-radius: 50%; }
          50% { transform: scale(1.08); opacity: 0.5; border-radius: 50%; }
        }
      `}</style>

      {/* Ambient background glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="absolute w-72 h-72 rounded-full transition-all duration-300" style={{
          background: `radial-gradient(circle, rgba(0,0,0,${isActive ? 0.06 + intensity * 0.12 : phase === 'thinking' ? 0.06 : 0.03}) 0%, transparent 70%)`,
          transform: `scale(${isActive ? 1 + intensity * 0.3 : 1})`,
        }} />
      </div>

      {/* Orb container */}
      <div className="relative mb-5">
        {/* Outer glow layer */}
        <div
          className="absolute -inset-3 transition-all duration-150"
          style={{
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(0,0,0,${isActive ? 0.08 + intensity * 0.15 : 0.03}), transparent 70%)`,
            filter: `blur(${isActive ? 12 + intensity * 15 : 8}px)`,
            transform: `scale(${1 + intensity * 0.4})`,
          }}
        />

        {/* Main orb blob */}
        <div
          className="relative w-28 h-28 flex items-center justify-center rounded-full"
          style={{
            borderRadius: '50%',
            animation: isActive
              ? `blob1 ${Math.max(0.8, 2 - intensity * 4)}s ease-in-out infinite, blob2 ${Math.max(0.6, 1.5 - intensity * 3)}s ease-in-out infinite`
              : phase === 'thinking'
                ? 'pulseThink 1.5s ease-in-out infinite'
                : 'blobIdle 4s ease-in-out infinite',
            background: isActive
              ? `radial-gradient(circle at ${45 + intensity * 10}% ${40 - intensity * 5}%, rgba(0,0,0,${0.4 + intensity * 0.5}), rgba(0,0,0,${0.2 + intensity * 0.3}) 50%, rgba(59,130,246,${0.08 + intensity * 0.15}))`
              : phase === 'thinking'
                ? 'radial-gradient(circle at 45% 40%, rgba(0,0,0,0.35), rgba(0,0,0,0.18) 55%, rgba(59,130,246,0.08))'
                : 'radial-gradient(circle at 45% 40%, rgba(0,0,0,0.25), rgba(0,0,0,0.12) 55%, rgba(59,130,246,0.06))',
            boxShadow: isActive
              ? `0 0 ${20 + intensity * 50}px rgba(0,0,0,${0.15 + intensity * 0.4}), 0 0 ${40 + intensity * 80}px rgba(0,0,0,${0.05 + intensity * 0.15}), inset 0 0 ${20 + intensity * 30}px rgba(0,0,0,${0.1 + intensity * 0.25})`
              : phase === 'thinking'
                ? '0 0 40px rgba(0,0,0,0.15), 0 0 80px rgba(0,0,0,0.06), inset 0 0 25px rgba(0,0,0,0.12)'
                : '0 0 30px rgba(0,0,0,0.1), 0 0 60px rgba(0,0,0,0.04), inset 0 0 20px rgba(0,0,0,0.08)',
            transform: `scale(${orbScale})`,
            transition: 'transform 80ms ease-out, box-shadow 150ms ease-out',
          }}
        />
      </div>

      {/* Phase label */}
      <p className="text-[14px] font-semibold text-neutral-950 mb-0.5 relative">{phaseLabel}</p>

      {/* Typewriter text */}
      <p className="text-[12px] mt-2 max-w-sm text-center relative leading-relaxed" style={{
        color: phase === 'listening' ? 'rgba(0,0,0,0.5)'
          : (phase === 'responding' || phase === 'thinking') ? 'rgba(0,0,0,0.6)'
          : 'rgba(0,0,0,0.2)',
        minHeight: '18px',
      }}>
        {displayText || phaseSub}
      </p>

      {error && (
        <p className="text-[10px] mt-1 relative" style={{ color: 'rgba(239,68,68,0.5)' }}>{error}</p>
      )}

      {/* Interpreted intent card — shown in ready phase */}
      {phase === 'ready' && interpretedIntent && (
        <div className="relative mt-2 mb-3 w-full max-w-sm">
          <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.15)' }}>
            <p className="text-[9px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'rgba(0,0,0,0.6)' }}>Interpreted intent</p>
            <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(0,0,0,0.75)' }}>{interpretedIntent}</p>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {phase === 'ready' ? (
        <div className="flex items-center gap-2 relative">
          <button
            onClick={() => { setPendingPrompt(null); setInterpretedIntent(''); setPhase('idle'); startListening() }}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-medium transition-all active:scale-95"
            style={{ color: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,0,0,0.08)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            </svg>
            Re-record
          </button>
          <button
            onClick={() => { if (pendingPrompt) onFinalPrompt(pendingPrompt) }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[11px] font-semibold transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, #0a0a0a, #0a0a0a)', color: '#ffffff', boxShadow: '0 0 25px rgba(0,0,0,0.25)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
            Send to AI
          </button>
        </div>
      ) : (
        <button
          onClick={handleButtonClick}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-semibold transition-all active:scale-95 mt-1"
          style={phase === 'listening' || phase === 'responding' ? {
            background: 'rgba(239,68,68,0.1)',
            color: 'rgba(239,68,68,0.8)',
            border: '1px solid rgba(239,68,68,0.2)',
            boxShadow: '0 0 15px rgba(239,68,68,0.1)',
          } : phase === 'thinking' ? {
            background: 'rgba(0,0,0,0.05)',
            color: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(0,0,0,0.1)',
          } : {
            background: 'rgba(0,0,0,0.1)',
            color: 'rgba(0,0,0,0.8)',
            border: '1px solid rgba(0,0,0,0.2)',
            boxShadow: '0 0 15px rgba(0,0,0,0.1)',
          }}
        >
          {phase === 'listening' || phase === 'responding' ? (
            <>
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: 'rgba(239,68,68,0.8)' }} />
              Stop
            </>
          ) : phase === 'thinking' ? (
            <>
              <div className="w-3 h-3 rounded-full animate-spin" style={{ border: '2px solid rgba(0,0,0,0.15)', borderTopColor: 'rgba(0,0,0,0.5)' }} />
              Processing...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
              Start Listening
            </>
          )}
        </button>
      )}
    </div>
  )
}

export default function TransformPageWrapper() {
  return (
    <Suspense fallback={null}>
      <TransformPage />
    </Suspense>
  )
}

function TransformPage() {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null)
  const [transform, setTransform] = useState<TransformData | null>(null)
  const [scOpen, setScOpen] = useState(false)
  const [codeOpen, setCodeOpen] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  const [commits, setCommits] = useState<CommitEntry[]>(INITIAL_COMMITS)
  const [changeStatus, setChangeStatus] = useState<'pending' | 'accepted' | 'rejected'>('pending')
  const [showSuggestModal, setShowSuggestModal] = useState(false)
  // Voice prompt tab was removed — only the text flow is supported now.
  const [suggestion, setSuggestion] = useState('')
  // Refinement status card state — floating bottom-right feedback
  const [refineStatus, setRefineStatus] = useState<{
    status: 'pending' | 'processing' | 'success' | 'error'
    summary: string
    error?: string
  } | null>(null)
  const [afterPulse, setAfterPulse] = useState(false)
  const [selectedCommit, setSelectedCommit] = useState<CommitEntry | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const { canAutofix, isFree } = useSubscription()

  // ── Code Pipeline State ──
  const [pipelineStep, setPipelineStep] = useState<PipelineStep>(() => {
    if (typeof window === 'undefined') return 'idle'
    // UX Lab findings pending → always start fresh so they get applied.
    if (sessionStorage.getItem('refineui_ux_lab_findings')) return 'idle'
    if (sessionStorage.getItem('refineui_transform')) return 'complete'
    return 'idle'
  })
  // Persistent start timestamp for the progress timer. Survives unmount so
  // navigating away mid-run and coming back resumes the real elapsed clock
  // instead of snapping back to 0s. Stale timestamps (>15min old) are
  // discarded on mount to protect against crashed/abandoned runs.
  const [pipelineStartedAt, setPipelineStartedAt] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const raw = localStorage.getItem('refineui_pipeline_started_at')
      if (!raw) return null
      const ts = Number(raw)
      if (!Number.isFinite(ts)) return null
      if (Date.now() - ts > 15 * 60 * 1000) {
        localStorage.removeItem('refineui_pipeline_started_at')
        return null
      }
      return ts
    } catch { return null }
  })
  const [pipelineError, setPipelineError] = useState('')
  const [gateError, setGateError] = useState<GateErrorData | null>(null)
  const [ingestedFiles, setIngestedFiles] = useState<FileEntry[]>([])
  const [codeAnalysis, setCodeAnalysis] = useState<CodeAnalysis | null>(null)
  const [selectedTarget, setSelectedTarget] = useState('')
  const [userIntent, setUserIntent] = useState('')
  const [transformResult, setTransformResult] = useState<TransformResult | null>(null)
  const [repoName, setRepoName] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    const stored = sessionStorage.getItem('refineui_transform')
    if (!stored) return ''
    try { return JSON.parse(stored).repoName ?? '' } catch { return '' }
  })
  const [repoBranch, setRepoBranch] = useState<string>(() => {
    if (typeof window === 'undefined') return 'main'
    const stored = sessionStorage.getItem('refineui_transform')
    if (!stored) return 'main'
    try { return JSON.parse(stored).branch || 'main' } catch { return 'main' }
  })
  const [repos, setRepos] = useState<GithubRepo[]>([])
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [repoSearch, setRepoSearch] = useState('')
  const [publishLoading, setPublishLoading] = useState(false)
  const [publishResult, setPublishResult] = useState<{ branch_name: string; branch_url: string; files_changed: string[] } | null>(null)
  // Branch picker for the Publish-to-GitHub flow. `__new__` means "create
  // a new branch off default"; any other value is an existing branch to
  // commit directly to.
  const [repoBranches, setRepoBranches] = useState<{ name: string; protected: boolean }[]>([])
  const [branchesLoading, setBranchesLoading] = useState(false)
  const [publishTarget, setPublishTarget] = useState<string>('__new__')
  const [multiPageResult, setMultiPageResult] = useState<MultiPageTransformResult | null>(() => {
    if (typeof window === 'undefined') return null
    const stored = sessionStorage.getItem('refineui_transform')
    if (!stored) return null
    try { return JSON.parse(stored).multiPageResult ?? null } catch { return null }
  })
  const [reRendering, setReRendering] = useState(false)
  const [reRenderStatus, setReRenderStatus] = useState('')

  // ── Mode selection + resumable run state ──
  // Which variant of the pipeline to run. Default stable — matches backend default.
  const [runMode, setRunMode] = useState<RunMode>(() => {
    const m = searchParams?.get('mode')
    return m === 'explore' ? 'explore' : 'stable'
  })
  // Progress snapshot for a resumed run — pre-seeds PipelineProgress so the
  // bar doesn't restart at 0s when the user reloads mid-run.
  const [resumeState, setResumeState] = useState<{
    runId: string
    stage: string | null
    progressPercent: number | null
    mode: RunMode | null
    banner: string
  } | null>(null)
  // Transformation notes from the latest completed run — rendered beneath
  // the result header so users see which competitor patterns were applied.
  const [transformationNotes, setTransformationNotes] = useState<string[]>([])
  const [resultMode, setResultMode] = useState<RunMode | null>(null)

  // Clear the persisted start timestamp whenever the pipeline settles into
  // a non-running state. Skip if a background promise is still attached —
  // the rehydrate effect below is about to flip us back into 'ingesting'.
  useEffect(() => {
    if (pipelineStep !== 'idle' && pipelineStep !== 'complete') return
    const hasBgPromise = typeof window !== 'undefined'
      && !!(window as { __reformPipelinePromise?: unknown }).__reformPipelinePromise
    if (hasBgPromise) return
    setPipelineStartedAt(null)
    try { localStorage.removeItem('refineui_pipeline_started_at') } catch { /* */ }
  }, [pipelineStep])

  useEffect(() => {
    if (session?.accessToken && repos.length === 0 && pipelineStep === 'idle') {
      setLoadingRepos(true)
      fetch('https://api.github.com/user/repos?sort=updated&per_page=50&affiliation=owner,collaborator', {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      })
        .then(r => r.json())
        .then(data => { setRepos(Array.isArray(data) ? data : []); setLoadingRepos(false) })
        .catch(() => setLoadingRepos(false))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken, pipelineStep])

  // Fetch the repo's branch list once the pipeline lands on a completed
  // state. Powers the "push target" dropdown on the Publish toolbar — the
  // user can either create a new branch or commit directly to an existing
  // one. Re-runs when the repo changes so switching projects doesn't show
  // stale branches.
  useEffect(() => {
    if (pipelineStep !== 'complete') return
    if (!session?.accessToken || !repoName) return
    const [owner, repo] = repoName.split('/')
    if (!owner || !repo) return
    let cancelled = false
    setBranchesLoading(true)
    setRepoBranches([])
    setPublishTarget('__new__')
    fetch(apiUrl('/github/list-branches'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner, repo, access_token: session.accessToken }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled || !data) return
        setRepoBranches(Array.isArray(data.branches) ? data.branches : [])
      })
      .catch(() => { /* non-fatal — the dropdown just shows the default option */ })
      .finally(() => { if (!cancelled) setBranchesLoading(false) })
    return () => { cancelled = true }
  }, [pipelineStep, session?.accessToken, repoName])

  const autoStartedRef = useRef(false)

  useEffect(() => {
    type PipelineWindow = Window & { __reformPipelinePromise?: Promise<unknown> }
    const bgPromise = (window as PipelineWindow).__reformPipelinePromise
    const alreadyCached = !!sessionStorage.getItem('refineui_transform')

    if (bgPromise && !alreadyCached) {
      autoStartedRef.current = true
      setPipelineStep('ingesting')
      bgPromise
        .then((result) => {
          const r = result as MultiPageTransformResult | null
          if (r) {
            setMultiPageResult(r)
            setRepoName(r.repo_name || '')
            setRepoBranch(r.branch || 'main')
            const notes = (r as unknown as { transformation_notes?: unknown }).transformation_notes
            if (Array.isArray(notes)) setTransformationNotes(notes.filter((n): n is string => typeof n === 'string'))
            const rMode = (r as unknown as { mode?: unknown }).mode
            if (rMode === 'stable' || rMode === 'explore') setResultMode(rMode)
            setPipelineStep('complete')
          } else {
            autoStartedRef.current = false
            setPipelineStep('idle')
          }
          delete (window as PipelineWindow).__reformPipelinePromise
        })
        .catch((e) => {
          // Original runPipeline already handled its own error state on
          // the (now-unmounted) prior component. Here we just fail soft:
          // drop the promise and drop the user back to idle so they can retry.
          console.warn('Background pipeline promise rejected:', e)
          autoStartedRef.current = false
          setPipelineStep('idle')
          setPipelineStartedAt(null)
          try { localStorage.removeItem('refineui_pipeline_started_at') } catch { /* */ }
          delete (window as PipelineWindow).__reformPipelinePromise
        })
      return
    }

    delete (window as PipelineWindow).__reformPipelinePromise

    const stored = sessionStorage.getItem('refineui_analysis')
    if (stored) { try { setAnalysis(JSON.parse(stored)) } catch { /* */ } }
    const storedTransform = sessionStorage.getItem('refineui_transform')
    if (storedTransform) {
      try {
        autoStartedRef.current = true
        const t = JSON.parse(storedTransform)
        setTransform(JSON.parse(storedTransform))
        setTransformResult(t.result); setCodeAnalysis(t.codeAnalysis)
        setSelectedTarget(t.target); setRepoName(t.repoName)
        setRepoBranch(t.branch || 'main'); setPipelineStep('complete')
        // Derive multi-page result for new UI
        if (t.multiPageResult) {
          setMultiPageResult(t.multiPageResult)
        } else if (t.result) {
          setMultiPageResult(adaptLegacyResult(t.result, t.repoName || '', t.target || ''))
        }
      } catch { /* */ }
    }
  }, [])

  // Restore a past run when navigated with ?project=<id>
  const restoredProjectRef = useRef<string | null>(null)
  useEffect(() => {
    const projectId = searchParams?.get('project')
    const wantsResume = searchParams?.get('resume') === '1'
    // When the user asked to resume an active run, the resume effect above
    // owns the progress UI — don't clobber it by rendering a past result.
    if (wantsResume) return
    if (!projectId || restoredProjectRef.current === projectId) return
    restoredProjectRef.current = projectId
    autoStartedRef.current = true // prevent auto-start from sessionStorage repo
    ;(async () => {
      try {
        setPipelineStep('ingesting')
        const runsRes = await fetch(apiUrl(`/projects/${projectId}/runs`))
        if (!runsRes.ok) throw new Error('runs fetch failed')
        const runs: { id: string; status: string }[] = await runsRes.json()
        const latest = runs[0]
        if (!latest) throw new Error('no runs')
        const runRes = await fetch(apiUrl(`/projects/runs/${latest.id}`))
        if (!runRes.ok) throw new Error('run fetch failed')
        const run = await runRes.json()
        const multi: MultiPageTransformResult = {
          repo_name: run.repo_name,
          branch: run.branch,
          framework: run.framework,
          total_pages_found: run.total_pages_found,
          total_evaluated: run.total_pages_found,
          total_transformed: run.total_transformed,
          total_skipped: run.total_skipped,
          global_summary: run.global_summary || [],
          pipeline_errors: run.pipeline_errors || [],
          pages: (run.pages || []).map((p: Record<string, unknown>) => ({
            page_path: p.page_path as string,
            page_name: p.page_name as string,
            route: p.route as string,
            status: (p.status as 'transformed' | 'high_quality' | 'error') || 'transformed',
            score: (p.score as number) || 0,
            original_code: p.original_code as string,
            updated_code: p.updated_code as string,
            diff_summary: p.diff_summary as string,
            change_annotations: (p.change_annotations as ChangeAnnotation[]) || [],
            change_summary: (p.change_summary as string[]) || [],
            before_screenshot: p.before_screenshot as string,
            after_screenshot: p.after_screenshot as string,
            error: p.error as string,
            retries_used: (p.retries_used as number) || 0,
          })),
        }
        setMultiPageResult(multi)
        setRepoName(run.repo_name)
        setRepoBranch(run.branch || 'main')
        const notes = (run as { transformation_notes?: unknown }).transformation_notes
        if (Array.isArray(notes)) setTransformationNotes(notes.filter((n): n is string => typeof n === 'string'))
        const mode = (run as { mode?: unknown }).mode
        if (mode === 'stable' || mode === 'explore') setResultMode(mode)
        setPipelineStep('complete')
      } catch (e) {
        setPipelineError(e instanceof Error ? e.message : 'Failed to load past run')
        setPipelineStep('idle')
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Resume a mid-run transform when landing on the page with ?project=<id>
  // and ?resume=1. We poll /projects/runs/<run_id>/progress because the
  // original SSE stream is tied to the request that started it — once this
  // tab is gone the stream can't be reconnected. 404 on /active-run means
  // nothing is running; we just fall through to the normal idle/restore flow.
  const activeRunPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    const projectId = searchParams?.get('project')
    const explicitRun = searchParams?.get('run')
    const wantsFresh = searchParams?.get('forceFresh') === '1' || searchParams?.get('resume') === '0'
    const wantsResume = searchParams?.get('resume') === '1'
    // Only run when the user explicitly asked to resume. Without the flag
    // the normal "restore latest completed run" path handles project= URLs
    // and we don't want to race with it.
    if (!projectId || !wantsResume || explicitRun || wantsFresh) return
    if (typeof window === 'undefined') return
    const hasBgPromise = !!(window as { __reformPipelinePromise?: unknown }).__reformPipelinePromise
    if (hasBgPromise) return

    let cancelled = false

    ;(async () => {
      const active = await fetchActiveRun(projectId)
      if (cancelled) return
      if (!active || isTerminalStatus(active.status)) {
        // Nothing live to resume — fetch the latest run instead so the user
        // lands on a useful screen. Mirrors the restore-latest effect which
        // bails early when resume=1 is in the URL.
        try {
          const runsRes = await fetch(apiUrl(`/projects/${projectId}/runs`))
          if (!runsRes.ok) throw new Error('runs fetch failed')
          const runs: { id: string }[] = await runsRes.json()
          const latest = runs[0]
          if (!latest) { setPipelineStep('idle'); return }
          const runRes = await fetch(apiUrl(`/projects/runs/${latest.id}`))
          if (!runRes.ok) throw new Error('run fetch failed')
          const run = await runRes.json()
          if (cancelled) return
          const multi: MultiPageTransformResult = {
            repo_name: run.repo_name,
            branch: run.branch,
            framework: run.framework,
            total_pages_found: run.total_pages_found,
            total_evaluated: run.total_pages_found,
            total_transformed: run.total_transformed,
            total_skipped: run.total_skipped,
            global_summary: run.global_summary || [],
            pipeline_errors: run.pipeline_errors || [],
            pages: (run.pages || []) as MultiPageTransformResult['pages'],
          }
          setMultiPageResult(multi)
          setRepoName(run.repo_name)
          setRepoBranch(run.branch || 'main')
          const notes = (run as { transformation_notes?: unknown }).transformation_notes
          if (Array.isArray(notes)) setTransformationNotes(notes.filter((n): n is string => typeof n === 'string'))
          const mode = (run as { mode?: unknown }).mode
          if (mode === 'stable' || mode === 'explore') setResultMode(mode)
          setPipelineStep('complete')
        } catch (e) {
          if (!cancelled) {
            setPipelineError(e instanceof Error ? e.message : 'Failed to load run')
            setPipelineStep('idle')
          }
        }
        return
      }
      autoStartedRef.current = true
      restoredProjectRef.current = projectId // prevent the restore-latest effect from clobbering
      setResumeState({
        runId: active.run_id,
        stage: active.current_stage,
        progressPercent: active.progress_percent,
        mode: active.mode,
        banner: 'Resuming your run…',
      })
      if (active.mode === 'stable' || active.mode === 'explore') setRunMode(active.mode)
      // Seed a timer baseline from when the run originally started, so the
      // elapsed counter reflects real wall-clock. Fallback to "now" when the
      // backend didn't send started_at.
      const started = active.started_at ? new Date(active.started_at).getTime() : Date.now()
      setPipelineStartedAt(Number.isFinite(started) ? started : Date.now())
      setPipelineStep('ingesting')

      let pollsSinceUpdate = 0
      activeRunPollRef.current = setInterval(async () => {
        if (cancelled) return
        const progress = await fetchRunProgress(active.run_id)
        if (cancelled) return
        if (!progress) {
          // Transient failure — keep polling (up to ~2min) before giving up.
          pollsSinceUpdate += 1
          if (pollsSinceUpdate > 60) {
            if (activeRunPollRef.current) clearInterval(activeRunPollRef.current)
            activeRunPollRef.current = null
            setPipelineError('Lost connection to the server. Please reload to retry.')
            setPipelineStep('idle')
          }
          return
        }
        pollsSinceUpdate = 0
        setResumeState(prev => prev ? { ...prev, stage: progress.current_stage, progressPercent: progress.progress_percent, banner: '' } : prev)

        const status = normalizeStatus(progress.status)
        if (status === 'failed') {
          if (activeRunPollRef.current) clearInterval(activeRunPollRef.current)
          activeRunPollRef.current = null
          setPipelineError(progress.error_message || 'Transform failed')
          setPipelineStep('idle')
          setResumeState(null)
          try { localStorage.removeItem('refineui_pipeline_started_at') } catch { /* */ }
          return
        }

        if (status === 'completed' || status === 'published') {
          if (activeRunPollRef.current) clearInterval(activeRunPollRef.current)
          activeRunPollRef.current = null
          // Terminal: pull the full run result so we can render the carousel.
          try {
            const runRes = await fetch(apiUrl(`/projects/runs/${active.run_id}`))
            if (!runRes.ok) throw new Error('run fetch failed')
            const run = await runRes.json()
            const multi: MultiPageTransformResult = {
              repo_name: run.repo_name,
              branch: run.branch,
              framework: run.framework,
              total_pages_found: run.total_pages_found,
              total_evaluated: run.total_pages_found,
              total_transformed: run.total_transformed,
              total_skipped: run.total_skipped,
              global_summary: run.global_summary || [],
              pipeline_errors: run.pipeline_errors || [],
              pages: (run.pages || []).map((p: Record<string, unknown>) => ({
                page_path: p.page_path as string,
                page_name: p.page_name as string,
                route: p.route as string,
                status: (p.status as 'transformed' | 'high_quality' | 'error') || 'transformed',
                score: (p.score as number) || 0,
                original_code: p.original_code as string,
                updated_code: p.updated_code as string,
                diff_summary: p.diff_summary as string,
                change_annotations: (p.change_annotations as ChangeAnnotation[]) || [],
                change_summary: (p.change_summary as string[]) || [],
                before_screenshot: p.before_screenshot as string,
                after_screenshot: p.after_screenshot as string,
                error: p.error as string,
                retries_used: (p.retries_used as number) || 0,
              })),
            }
            setMultiPageResult(multi)
            setRepoName(run.repo_name)
            setRepoBranch(run.branch || 'main')
            const notes = progress.transformation_notes || (run as { transformation_notes?: unknown }).transformation_notes
            if (Array.isArray(notes)) setTransformationNotes(notes.filter((n): n is string => typeof n === 'string'))
            const mode = active.mode || ((run as { mode?: unknown }).mode as RunMode | undefined)
            if (mode === 'stable' || mode === 'explore') setResultMode(mode)
            setPipelineStep('complete')
            setResumeState(null)
            try { localStorage.removeItem('refineui_pipeline_started_at') } catch { /* */ }
          } catch (e) {
            setPipelineError(e instanceof Error ? e.message : 'Failed to load completed run')
            setPipelineStep('idle')
            setResumeState(null)
          }
        }
      }, 2000)
    })()

    return () => {
      cancelled = true
      if (activeRunPollRef.current) {
        clearInterval(activeRunPollRef.current)
        activeRunPollRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Auto-start pipeline if a repo was selected anywhere (session OR local
  // storage) — picks up selections made in /new or in a previous tab so the
  // user isn't re-prompted to choose the same repo again.
  useEffect(() => {
    if (autoStartedRef.current || pipelineStep !== 'idle' || transformResult) return

    // Prefer URL params (passed by UX Lab navigation) — more reliable than storage.
    const paramRepo = searchParams?.get('repo')
    const paramBranch = searchParams?.get('branch')
    const paramMode = searchParams?.get('mode')
    const paramForceFresh = searchParams?.get('forceFresh') === '1'
    const selected = paramRepo
      ? { url: paramRepo, branch: paramBranch || 'main' }
      : getSelectedRepo()

    if (!selected?.url) return
    autoStartedRef.current = true

    // Ensure storage is up to date so other parts of the app find the selection.
    setSelectedRepo(selected.url, selected.branch)

    // Extract owner/repo from URL like https://github.com/owner/repo
    const match = selected.url.match(/github\.com\/([^/]+\/[^/]+)/)
    if (!match) return
    const fullName = match[1].replace(/\.git$/, '')
    const mode: RunMode = paramMode === 'explore' ? 'explore' : 'stable'
    setRunMode(mode)

    // Create a minimal GithubRepo object and start pipeline
    runPipeline({
      id: 0, full_name: fullName, name: fullName.split('/')[1],
      private: false, language: null, updated_at: '', default_branch: selected.branch || 'main',
      homepage: null, html_url: selected.url,
    }, { mode, forceFresh: paramForceFresh })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineStep])

  function handleCopyCode() {
    if (!transform?.code) return
    navigator.clipboard.writeText(transform.code).then(() => {
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    })
  }

  const filteredRepos = repos.filter(r => r.full_name.toLowerCase().includes(repoSearch.toLowerCase()))

  async function runPipeline(
    repo: GithubRepo,
    { forceFresh = false, mode }: { forceFresh?: boolean; mode?: RunMode } = {},
  ) {
    setPipelineError(''); setGateError(null); setRepoName(repo.full_name); setRepoBranch(repo.default_branch || 'main')
    setResumeState(null)
    setTransformationNotes([])
    setResultMode(null)
    const branch = repo.default_branch || 'main'
    const effectiveMode: RunMode = mode || runMode

    // Show loading immediately so the user gets instant visual feedback.
    setPipelineStep('ingesting')

    // Persist the selection so the user isn't re-prompted in future tabs.
    const repoUrl = repo.html_url || `https://github.com/${repo.full_name}`
    setSelectedRepo(repoUrl, branch)

    // ── Fetch current HEAD SHA from GitHub so we can look up a cached run.
    // A run is considered valid until the next commit on this branch.
    let headSha: string | null = null
    try {
      const shaRes = await fetch(
        `https://api.github.com/repos/${repo.full_name}/commits/${branch}`,
        session?.accessToken
          ? { headers: { Authorization: `Bearer ${session.accessToken}` } }
          : undefined,
      )
      if (shaRes.ok) {
        const shaData = await shaRes.json()
        headSha = shaData?.sha || null
      }
    } catch { /* non-fatal — we'll just run fresh */ }

    // ── Try cached run for this (user, repo, branch, commit). If the DB has
    // a complete run for the same commit SHA, load it and skip the pipeline.
    // Skip this lookup entirely when the caller asked for a forced regeneration.
    if (!forceFresh && headSha && session?.githubId) {
      try {
        const cacheRes = await fetch(
          apiUrl(`/projects/latest-run?github_user_id=${encodeURIComponent(session.githubId)}`
            + `&repo_name=${encodeURIComponent(repo.full_name)}`
            + `&branch=${encodeURIComponent(branch)}`
            + `&commit_sha=${encodeURIComponent(headSha)}`),
        )
        if (cacheRes.ok) {
          const cached = await cacheRes.json()
          // Adapt RunResponse → MultiPageTransformResult (shapes match closely).
          const adapted: MultiPageTransformResult = {
            repo_name: cached.repo_name,
            branch: cached.branch,
            framework: cached.framework,
            total_pages_found: cached.total_pages_found,
            total_evaluated: cached.total_pages_found,
            total_transformed: cached.total_transformed,
            total_skipped: cached.total_skipped,
            pages: cached.pages || [],
            global_summary: cached.global_summary || [],
            pipeline_errors: cached.pipeline_errors || [],
          }
          setMultiPageResult(adapted)
          setPipelineStep('complete')
          safeSetTransformCache({
            multiPageResult: adapted,
            repoName: repo.full_name,
            branch,
          })
          console.info('Loaded cached transform for', repo.full_name, 'at', headSha.slice(0, 7))
          return
        }
      } catch { /* non-fatal — fall through to fresh run */ }
    }

    // Stamp a persistent start time so the progress timer resumes after
    // tab-switches / component remounts instead of snapping back to 0s.
    const pipelineStartTs = Date.now()
    setPipelineStartedAt(pipelineStartTs)
    try { localStorage.setItem('refineui_pipeline_started_at', String(pipelineStartTs)) } catch { /* */ }

    try {
      let uxLabFindings: unknown[] | null = null
      try {
        const raw = sessionStorage.getItem('refineui_ux_lab_findings')
        if (raw) {
          uxLabFindings = JSON.parse(raw)
          sessionStorage.removeItem('refineui_ux_lab_findings')
        }
      } catch { /* ignore */ }

      // Kick off the pipeline as a window-scoped promise so a tab-switch or
      // in-app navigation that unmounts this component can still rehydrate
      // from the in-flight run via the mount effect above. The server-side
      // pipeline runs to completion regardless of whether this tab stays
      // mounted; we just need a handle to its result.
      type PipelineWindow = Window & { __reformPipelinePromise?: Promise<MultiPageTransformResult | null> }
      const pipelinePromise: Promise<MultiPageTransformResult | null> = (async () => {
        const res = await fetch(apiUrl(`/transform-repo-v2?mode=${effectiveMode}`), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            github_url: `https://github.com/${repo.full_name}`,
            branch: repo.default_branch || 'main',
            access_token: session?.accessToken || null,
            design_intelligence: analysis || null,
            user_intent: userIntent,
            max_pages: 50,
            github_user_id: session?.githubId,
            ux_lab_findings: uxLabFindings,
          }),
        })
        // Non-2xx — gate errors (402/429) and pre-stream failures still
        // come back as real HTTP errors, not stream messages.
        if (!res.ok) {
          const { gate, message } = await parseResponseError(res)
          const err = new Error(message || 'Transform failed') as Error & { __gate?: GateErrorData | null }
          err.__gate = gate
          throw err
        }
        // NDJSON stream: `{type: "heartbeat"}` lines keep the socket warm
        // across mobile carriers / proxies that would otherwise kill a
        // 3-8 minute idle HTTPS connection (this was breaking the run for
        // users on aggressive-NAT networks). The single `result` line is
        // the real payload; any `error` line surfaces as a thrown Error.
        if (!res.body) throw new Error('Transform returned no stream body')
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let finalResult: MultiPageTransformResult | null = null
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          let newlineIdx = buffer.indexOf('\n')
          while (newlineIdx !== -1) {
            const line = buffer.slice(0, newlineIdx).trim()
            buffer = buffer.slice(newlineIdx + 1)
            newlineIdx = buffer.indexOf('\n')
            if (!line) continue
            let msg: { type: string; data?: MultiPageTransformResult; detail?: string }
            try {
              msg = JSON.parse(line)
            } catch {
              console.warn('Skipping non-JSON stream line:', line.slice(0, 120))
              continue
            }
            if (msg.type === 'heartbeat') continue
            if (msg.type === 'error') {
              throw new Error(msg.detail || 'Transform failed')
            }
            if (msg.type === 'result' && msg.data) {
              finalResult = msg.data
            }
          }
        }
        if (!finalResult) throw new Error('Stream ended without a result')
        return finalResult
      })()
      ;(window as PipelineWindow).__reformPipelinePromise = pipelinePromise

      let result: MultiPageTransformResult
      try {
        const parsed = await pipelinePromise
        if (!parsed) throw new Error('Transform returned no result')
        result = parsed
      } catch (e) {
        const err = e as Error & { __gate?: GateErrorData | null }
        if (err.__gate) { setGateError(err.__gate); setPipelineStep('idle'); return }
        throw e
      } finally {
        // Only clear if still pointing at our promise — the rehydrate effect
        // may have already cleared it after consuming the result.
        if ((window as PipelineWindow).__reformPipelinePromise === pipelinePromise) {
          delete (window as PipelineWindow).__reformPipelinePromise
        }
      }

      setMultiPageResult(result)
      setResultMode(effectiveMode)
      // Pipeline v2 may return transformation_notes on the top-level result.
      const topLevelNotes = (result as unknown as { transformation_notes?: unknown }).transformation_notes
      if (Array.isArray(topLevelNotes)) {
        setTransformationNotes(topLevelNotes.filter((n): n is string => typeof n === 'string'))
      } else {
        setTransformationNotes([])
      }
      setPipelineStep('complete')

      // Save for session persistence (legacy). Uses safeSetTransformCache
      // because the full payload (base64 screenshots + per-page code) can
      // exceed the ~5 MB sessionStorage quota — the helper degrades by
      // stripping screenshots/code rather than throwing.
      safeSetTransformCache({
        multiPageResult: result,
        repoName: repo.full_name,
        branch: repo.default_branch || 'main',
      })

      // Save to database + S3 for permanent persistence
      if (session?.githubId) {
        try {
          await fetch(apiUrl('/projects/save-run'), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              github_user_id: session.githubId,
              github_username: session.githubUsername || '',
              repo_name: repo.full_name,
              repo_url: `https://github.com/${repo.full_name}`,
              branch: repo.default_branch || 'main',
              framework: result.framework || 'unknown',
              source_commit_sha: headSha,
              user_intent: userIntent,
              design_intelligence: analysis || null,
              file_tree: [],
              files: [],
              total_pages_found: result.total_pages_found || 0,
              total_transformed: result.total_transformed || 0,
              total_skipped: result.total_skipped || 0,
              global_summary: result.global_summary || [],
              pipeline_errors: result.pipeline_errors || [],
              pages: result.pages || [],
            }),
          })
        } catch (e) {
          console.warn('Failed to save run to DB (non-fatal):', e)
        }
      }

      // Create commit entry from first transformed page
      const firstTransformed = result.pages?.find((p: { status: string }) => p.status === 'transformed')
      if (firstTransformed) {
        setSelectedTarget(firstTransformed.page_path)
        const commitLabel = firstTransformed.diff_summary?.split('.')[0]?.trim()?.slice(0, 60) || 'UI improvements'
        const newCommit: CommitEntry = { hash: Math.random().toString(16).slice(2, 8), msg: commitLabel, color: '#f59e0b', status: 'pending', code: firstTransformed.updated_code, suggestion: userIntent || 'Applied design intelligence' }
        setCommits(prev => [newCommit, ...prev])
      }
    } catch (e) { setPipelineError(e instanceof Error ? e.message : 'Transform failed'); setPipelineStep('idle') }
  }

  async function handleRegenerate(mode: RunMode = 'stable') {
    if (!repoName) return
    // Clear every cache layer so the pipeline runs fresh.
    sessionStorage.removeItem('refineui_transform')
    sessionStorage.removeItem('refineui_ux_lab_findings')
    setMultiPageResult(null)
    setTransformResult(null)
    setPublishResult(null)
    setTransformationNotes([])
    setResultMode(null)
    setRunMode(mode)
    autoStartedRef.current = true
    setPipelineStep('idle')
    // Reconstruct a minimal GithubRepo from the current state so runPipeline
    // has what it needs; forceFresh bypasses the DB cache lookup.
    await runPipeline(
      {
        id: 0,
        full_name: repoName,
        name: repoName.split('/')[1] || repoName,
        private: false,
        language: null,
        updated_at: '',
        default_branch: repoBranch || 'main',
        homepage: null,
        html_url: `https://github.com/${repoName}`,
      },
      { forceFresh: true, mode },
    )
  }

  async function handleAccept() {
    // Collect all transformed pages with updated code
    const pages = multiPageResult?.pages.filter(p => (p.status === 'transformed' || p.status === 'weak') && p.updated_code) || []
    const hasGitHub = session?.accessToken && repoName && pages.length > 0

    if (hasGitHub) {
      setPublishLoading(true); setPipelineError('')
      try {
        const [owner, repo] = repoName.split('/')
        // Branch-picker semantics:
        //   __new__           → create a new branch off the repo default
        //   any other value   → commit directly to that existing branch
        const createNewBranch = publishTarget === '__new__'
        const baseBranchForPublish = createNewBranch
          ? (repoBranch || null)
          : publishTarget
        const res = await fetch(apiUrl('/github/publish-approved-branch'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            owner, repo,
            base_branch: baseBranchForPublish,
            create_new_branch: createNewBranch,
            approved_files: pages.map(p => ({ path: p.page_path, content: p.updated_code })),
            transform_summary: {
              pages_transformed: pages.map(p => p.page_path),
              summary_text: multiPageResult?.global_summary?.[0] || null,
            },
            access_token: session.accessToken,
            github_user_id: session.githubId,
          }),
        })
        if (!res.ok) {
          const { gate, message } = await parseResponseError(res)
          if (gate) { setGateError(gate); setPublishLoading(false); return }
          throw new Error(message || 'Publish failed')
        }
        const data = await res.json()
        setPublishResult({ branch_name: data.branch_name, branch_url: data.branch_url, files_changed: data.files_changed })
      } catch (e) { setPipelineError(e instanceof Error ? e.message : 'Failed to publish changes'); setPublishLoading(false); return }
      setPublishLoading(false)
    }

    setChangeStatus('accepted')
    const realHash = Math.random().toString(16).slice(2, 8)
    setCommits(prev => {
      const hasPending = prev.some(c => c.status === 'pending')
      if (hasPending) return prev.map(c => c.status === 'pending' ? { ...c, status: 'accepted' as const, color: '#22c55e', hash: realHash } : c)
      const fallbackLabel = transformResult?.change_annotations[0]?.ux_impact?.split(',')[0]?.split('.')[0]?.trim() || transformResult?.transformed_files[0]?.diff_summary?.split('.')[0]?.trim()?.slice(0, 50) || 'Improve UI layout and polish'
      return [{ hash: realHash, msg: fallbackLabel, color: '#22c55e', status: 'accepted', code: transformResult?.transformed_files[0]?.updated_code } as CommitEntry, ...prev]
    })
    setScOpen(true)
  }

  function handleReject() {
    setChangeStatus('rejected')
    const hasPending = commits.some(c => c.status === 'pending')
    if (hasPending) {
      // Update ALL pending commits to rejected
      setCommits(prev => prev.map(c =>
        c.status === 'pending' ? { ...c, status: 'rejected', color: '#ef4444' } : c
      ))
    } else {
      const newCommit: CommitEntry = {
        hash: Math.random().toString(16).slice(2, 8),
        msg: 'feat: UI transformation',
        color: '#ef4444',
        status: 'rejected',
      }
      setCommits(prev => [newCommit, ...prev])
    }
    setScOpen(true)
  }

  async function handleSuggestSubmit(directPrompt?: string) {
    const promptText = (directPrompt || suggestion).trim()
    if (!promptText) return

    // Close modal and clear input immediately — never make the user wait inside a modal
    const summaryText = promptText.length > 60 ? promptText.slice(0, 57) + '...' : promptText
    setShowSuggestModal(false)
    setSuggestion('')
    setRefineStatus({ status: 'pending', summary: summaryText })

    try {
      setRefineStatus({ status: 'processing', summary: summaryText })

      const currentPage = multiPageResult?.pages.find(p => p.page_path === selectedTarget)
      const currentCode = currentPage?.updated_code || currentPage?.original_code || ''
      const res = await fetch(apiUrl('/suggest-edit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestion: promptText,
          current_code: currentCode,
          analysis_context: analysis,
        }),
      })

      if (!res.ok) throw new Error('Suggest edit failed')
      const data = await res.json()

      const newCommit: CommitEntry = {
        hash: Math.random().toString(16).slice(2, 8),
        msg: `edit: ${data.summary || promptText.slice(0, 40)}`,
        color: '#f59e0b',
        status: 'pending',
        code: data.revised_code,
        suggestion: promptText,
      }
      setCommits(prev => [newCommit, ...prev])
      setChangeStatus('pending')

      // Persist the new code into the multi-page result so subsequent edits chain
      if (data.revised_code && multiPageResult && selectedTarget) {
        const updatedPages = multiPageResult.pages.map(p =>
          p.page_path === selectedTarget ? { ...p, updated_code: data.revised_code } : p
        )
        setMultiPageResult({ ...multiPageResult, pages: updatedPages })
      }

      // Re-render screenshots in the background
      if (data.revised_code && repoName && selectedTarget) {
        setReRendering(true)
        setReRenderStatus('Rendering preview...')
        try {
          const renderRes = await fetch(apiUrl('/re-render'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              repo_clone_url: `https://github.com/${repoName}.git`,
              branch: repoBranch,
              target_file: selectedTarget,
              updated_code: data.revised_code,
              access_token: session?.accessToken || '',
            }),
          })

          if (renderRes.ok) {
            const renderData = await renderRes.json()
            if (renderData.after_screenshot && multiPageResult) {
              const updatedPages = multiPageResult.pages.map(p =>
                p.page_path === selectedTarget
                  ? {
                      ...p,
                      after_screenshot: renderData.after_screenshot,
                      before_screenshot: renderData.before_screenshot || p.before_screenshot,
                      after_screenshot_key: renderData.after_screenshot_key || p.after_screenshot_key,
                      before_screenshot_key: renderData.before_screenshot_key || p.before_screenshot_key,
                    }
                  : p
              )
              setMultiPageResult({ ...multiPageResult, pages: updatedPages })
            }
          }
        } catch { /* re-render is best-effort */ }
        setReRendering(false)
        setReRenderStatus('')
      }

      // Success — pulse the after panel and show success status
      setRefineStatus({ status: 'success', summary: summaryText })
      setAfterPulse(true)
      setTimeout(() => setAfterPulse(false), 2000)
      setTimeout(() => setRefineStatus(null), 4000)
    } catch (err) {
      setRefineStatus({
        status: 'error',
        summary: summaryText,
        error: err instanceof Error ? err.message : 'Something went wrong',
      })
      setTimeout(() => setRefineStatus(null), 6000)
    }
  }

  function openSuggestModal() {
    setShowSuggestModal(true)
  }

  function handleCommitClick(commit: CommitEntry) {
    setSelectedCommit(commit)
  }

  function handleAcceptRejected(commit: CommitEntry) {
    setCommits(prev =>
      prev.map(c => c.hash === commit.hash && c.msg === commit.msg ? { ...c, status: 'accepted', color: '#22c55e' } : c)
    )
    setSelectedCommit({ ...commit, status: 'accepted', color: '#22c55e' })
  }


  return (
    <div className="flex justify-center px-3 sm:px-6 py-6 sm:py-10 pb-20">
      <div className="w-full max-w-[1760px] space-y-10">

        {/* ── HEADER ── */}
        {pipelineStep === 'complete' && multiPageResult ? (
          <TransformSummaryHeader
            result={multiPageResult}
            publishResult={publishResult}
            onRegenerate={handleRegenerate}
            mode={resultMode}
            transformationNotes={transformationNotes}
          />
        ) : (
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-neutral-950 mb-3">UI Transformation</h1>
            <div className="flex items-center justify-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: 'rgba(0,0,0,0.08)', border: '1px solid rgba(0,0,0,0.15)' }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#0a0a0a', boxShadow: '0 0 6px rgba(0,0,0,0.4)' }} />
                <span className="text-[11px] font-medium" style={{ color: 'rgba(0,0,0,0.8)' }}>
                  {pipelineStep === 'idle' ? 'Select a Repository' : 'Processing...'}
                </span>
              </div>
              <span className="text-[12px]" style={{ color: 'rgba(0,0,0,0.25)' }}>{repoName || `${analysis?.sources?.length || 0} sources analyzed`}</span>
            </div>
          </div>
        )}

        {/* ── REPO PICKER ── */}
        {pipelineStep === 'idle' && (
          <div className="max-w-2xl mx-auto">
            <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.06)' }}>
              <div className="flex items-center gap-3 px-5 pt-5 pb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.08)', border: '1px solid rgba(0,0,0,0.12)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" /></svg>
                </div>
                <div>
                  <h3 className="text-neutral-950 font-semibold text-[14px]">Select a Repository</h3>
                  <p className="text-[11px]" style={{ color: 'rgba(0,0,0,0.3)' }}>{session ? 'Choose a repo to analyze and improve' : 'Sign in with GitHub to see your repos'}</p>
                </div>
              </div>
              <div className="px-5 pb-3">
                <input type="text" value={repoSearch} onChange={e => setRepoSearch(e.target.value)} placeholder="Search repositories..." className="w-full bg-transparent px-4 py-2.5 text-[13px] outline-none rounded-lg text-neutral-950 placeholder:text-neutral-950/20" style={{ border: '1px solid rgba(0,0,0,0.08)', background: 'rgba(0,0,0,0.02)' }} />
              </div>
              <div className="px-5 pb-3">
                <input type="text" value={userIntent} onChange={e => setUserIntent(e.target.value)} placeholder="Optional: describe your goal (e.g., 'make it more modern')" className="w-full bg-transparent px-4 py-2 text-[12px] outline-none rounded-lg text-neutral-950/60 placeholder:text-neutral-950/15" style={{ border: '1px solid rgba(0,0,0,0.04)' }} />
              </div>
              <div className="px-5 pb-4">
                <p className="text-[10px] font-medium uppercase tracking-wider mb-2" style={{ color: 'rgba(0,0,0,0.3)' }}>Mode</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setRunMode('stable')}
                    className="flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-lg text-left transition-all"
                    style={{
                      background: runMode === 'stable' ? 'linear-gradient(135deg, rgba(0,0,0,0.18), rgba(109,40,217,0.12))' : 'rgba(0,0,0,0.02)',
                      border: runMode === 'stable' ? '1px solid rgba(0,0,0,0.4)' : '1px solid rgba(0,0,0,0.06)',
                      boxShadow: runMode === 'stable' ? '0 0 20px rgba(0,0,0,0.15)' : 'none',
                    }}
                  >
                    <span className="text-[12px] font-semibold" style={{ color: runMode === 'stable' ? 'white' : 'rgba(0,0,0,0.7)' }}>Run Again (Stable)</span>
                    <span className="text-[10px]" style={{ color: 'rgba(0,0,0,0.4)' }}>Reuses prior competitor intel for consistency.</span>
                  </button>
                  <button
                    onClick={() => setRunMode('explore')}
                    className="flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-lg text-left transition-all"
                    style={{
                      background: runMode === 'explore' ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.02)',
                      border: runMode === 'explore' ? '1px solid rgba(0,0,0,0.3)' : '1px solid rgba(0,0,0,0.06)',
                    }}
                  >
                    <span className="text-[12px] font-semibold" style={{ color: runMode === 'explore' ? 'white' : 'rgba(0,0,0,0.7)' }}>Explore New Version</span>
                    <span className="text-[10px]" style={{ color: 'rgba(0,0,0,0.4)' }}>Fresh competitor discovery. Takes longer, may differ.</span>
                  </button>
                </div>
              </div>
              <div style={{ maxHeight: '340px', overflowY: 'auto', borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                {session && loadingRepos && <div className="flex items-center justify-center py-8"><div className="w-6 h-6 rounded-full animate-spin mr-3" style={{ border: '2px solid rgba(0,0,0,0.06)', borderTopColor: '#0a0a0a' }} /><span className="text-[13px]" style={{ color: 'rgba(0,0,0,0.3)' }}>Loading repos...</span></div>}
                {session && !loadingRepos && filteredRepos.map(repo => (
                  <div key={repo.id} onClick={() => runPipeline(repo, { mode: runMode })} className="flex items-center justify-between px-5 py-3 cursor-pointer transition-colors hover:bg-white/[0.04]" style={{ borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(0,0,0,0.25)"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" /></svg>
                      <div className="min-w-0"><span className="text-[13px] text-neutral-950/70 truncate block">{repo.full_name}</span><span className="text-[10px]" style={{ color: 'rgba(0,0,0,0.2)' }}>{repo.language || 'Unknown'}</span></div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {repo.private && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.06)', color: 'rgba(0,0,0,0.3)' }}>Private</span>}
                      <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M5.5 3.5L9 7l-3.5 3.5" stroke="rgba(0,0,0,0.2)" strokeWidth="1.2" strokeLinecap="round" /></svg>
                    </div>
                  </div>
                ))}
                {session && !loadingRepos && filteredRepos.length === 0 && <div className="px-5 py-8 text-center"><p className="text-[13px]" style={{ color: 'rgba(0,0,0,0.25)' }}>No repositories found</p></div>}
                {!session && <div className="px-5 py-8 text-center"><p className="text-[13px]" style={{ color: 'rgba(0,0,0,0.35)' }}>Sign in with GitHub to see your repositories</p></div>}
              </div>
            </div>
            {(gateError || pipelineError) && (
              <div className="mt-3">
                <GateErrorBanner
                  error={gateError}
                  fallbackMessage={pipelineError}
                  onDismiss={() => { setGateError(null); setPipelineError('') }}
                />
              </div>
            )}
          </div>
        )}

        {/* ── PIPELINE PROGRESS ── */}
        {(pipelineStep === 'ingesting' || pipelineStep === 'analyzing' || pipelineStep === 'transforming') && (
          <PipelineProgress
            repoName={repoName}
            startedAt={pipelineStartedAt ?? Date.now()}
            resumeLabel={resumeState?.banner || null}
            overrideProgress={resumeState?.progressPercent ?? null}
            overrideStage={resumeState?.stage ?? null}
          />
        )}

        {/* ── RE-RENDER PROGRESS BAR ── */}
        {reRendering && (
          <div className="max-w-xl mx-auto mb-6">
            <div className="rounded-xl p-5" style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.12)' }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-4 h-4 rounded-full animate-spin" style={{ border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#0a0a0a' }} />
                <span className="text-[13px] font-medium text-neutral-950">Reapplying your changes</span>
              </div>
              <div className="w-full h-1.5 rounded-full mb-2" style={{ background: 'rgba(0,0,0,0.06)' }}>
                <div className="h-full rounded-full animate-pulse" style={{ width: '60%', background: 'linear-gradient(90deg, #0a0a0a, #0a0a0a)', boxShadow: '0 0 12px rgba(0,0,0,0.3)' }} />
              </div>
              <p className="text-[11px]" style={{ color: 'rgba(0,0,0,0.35)' }}>{reRenderStatus}</p>
            </div>
          </div>
        )}

        {/* ── MULTI-PAGE TRANSFORMATION SHOWCASE ── */}
        {pipelineStep === 'complete' && multiPageResult && (
          <>
            <TransformCarousel
              pages={multiPageResult.pages}
              result={multiPageResult}
              onSelectedPathChange={setSelectedTarget}
              afterPulse={afterPulse}
              canEdit={changeStatus !== 'pending'}
              editDisabledReason="Accept or keep the proposed changes before editing."
              repoUrl={repoName ? `https://github.com/${repoName}` : null}
              repoBranch={repoBranch || 'main'}
              lockedToBefore={changeStatus === 'rejected'}
              overlayFiles={
                // Layer the unpublished proposal on top of the repo when the
                // user hasn't rejected it — so wand edits stack on the proposal.
                // Each TransformedPageData carries its own updated_code; the
                // backend's _resolve_overlay_target suffix-matches page_path
                // to a real file inside the cloned workspace.
                changeStatus !== 'rejected'
                  ? multiPageResult.pages.reduce<Record<string, string>>((acc, p) => {
                      if (p.page_path && typeof p.updated_code === 'string') acc[p.page_path] = p.updated_code
                      return acc
                    }, {})
                  : null
              }
              onAfterScreenshotChange={(pagePath, next) => {
                setMultiPageResult(prev => {
                  if (!prev) return prev
                  return {
                    ...prev,
                    pages: prev.pages.map(p =>
                      p.page_path === pagePath ? { ...p, after_screenshot: next } : p,
                    ),
                  }
                })
              }}
              headerAction={
                changeStatus === 'pending' ? (
                  !canAutofix ? (
                    <UpgradeBanner message="Upgrade to Pro to publish fixes to GitHub" compact />
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <div className="flex items-center gap-1.5">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" /></svg>
                        <select
                          value={publishTarget}
                          onChange={e => setPublishTarget(e.target.value)}
                          disabled={publishLoading || branchesLoading}
                          title="Where to publish the approved changes"
                          className="bg-white text-[11px] font-medium rounded-lg px-2.5 py-2 outline-none cursor-pointer transition-colors hover:bg-neutral-50 focus:bg-white"
                          style={{ color: 'rgba(0,0,0,0.8)', border: '1px solid rgba(0,0,0,0.1)', maxWidth: 220, colorScheme: 'light' }}
                        >
                          <option value="__new__" style={{ background: '#fafafa', color: 'rgba(0,0,0,0.9)' }}>
                            ✨ New branch {repoBranch ? `(from ${repoBranch})` : ''}
                          </option>
                          {repoBranches.length > 0 && (
                            <option disabled style={{ background: '#fafafa', color: 'rgba(0,0,0,0.3)' }}>
                              ──── Commit directly to ────
                            </option>
                          )}
                          {repoBranches.map(b => (
                            <option
                              key={b.name}
                              value={b.name}
                              disabled={b.protected}
                              style={{
                                background: '#fafafa',
                                color: b.protected ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.9)',
                              }}
                            >
                              {b.name}{b.protected ? ' 🔒 (protected)' : ''}
                            </option>
                          ))}
                          {branchesLoading && (
                            <option disabled style={{ background: '#fafafa', color: 'rgba(0,0,0,0.3)' }}>
                              Loading branches…
                            </option>
                          )}
                        </select>
                      </div>

                      <button
                        onClick={handleAccept}
                        disabled={publishLoading}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-semibold transition-all active:scale-[0.98]"
                        style={{
                          background: 'rgba(34,197,94,0.08)',
                          color: 'rgba(22,163,74,0.9)',
                          border: '1px solid rgba(34,197,94,0.25)',
                          opacity: publishLoading ? 0.5 : 1,
                        }}
                      >
                        {publishLoading ? (
                          <><div className="w-3 h-3 rounded-full animate-spin" style={{ border: '2px solid rgba(34,197,94,0.2)', borderTopColor: 'rgba(34,197,94,0.7)' }} />Publishing…</>
                        ) : (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                            {publishTarget === '__new__' ? 'Publish to new branch' : `Publish to ${publishTarget}`}
                          </>
                        )}
                      </button>

                      <button
                        onClick={handleReject}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-medium transition-all active:scale-[0.98]"
                        style={{
                          color: 'rgba(239,68,68,0.8)',
                          background: 'rgba(239,68,68,0.05)',
                          border: '1px solid rgba(239,68,68,0.18)',
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        Keep Original
                      </button>
                    </div>
                  )
                ) : (
                  <button
                    onClick={() => setChangeStatus('pending')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors hover:bg-white/[0.02]"
                    style={{
                      background: changeStatus === 'accepted' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                      border: `1px solid ${changeStatus === 'accepted' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                    }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: changeStatus === 'accepted' ? '#22c55e' : '#ef4444', boxShadow: `0 0 6px ${changeStatus === 'accepted' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}` }} />
                    <span className="text-[11px] font-medium" style={{ color: changeStatus === 'accepted' ? 'rgba(22,163,74,0.85)' : 'rgba(239,68,68,0.75)' }}>
                      {changeStatus === 'accepted' ? 'Changes applied' : 'Original kept'}
                    </span>
                  </button>
                )
              }
            />
          </>
        )}

        {/* ── Generated Code ── */}
        {transform?.code && (
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.2)', background: 'rgba(13,12,22,0.6)', backdropFilter: 'blur(12px)' }}>
            {/* Header row */}
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: codeOpen ? '1px solid rgba(0,0,0,0.15)' : 'none' }}>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full" style={{ background: '#0a0a0a', boxShadow: '0 0 8px rgba(0,0,0,0.5)' }} />
                <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'rgba(204,195,216,0.6)' }}>Generated Component Code</span>
                <span className="text-[9px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(0,0,0,0.15)', color: 'rgba(0,0,0,0.8)' }}>React + Tailwind</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-medium transition-all"
                  style={{ background: codeCopied ? 'rgba(34,197,94,0.15)' : 'rgba(0,0,0,0.04)', border: codeCopied ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(0,0,0,0.07)', color: codeCopied ? '#86efac' : 'rgba(204,195,216,0.5)' }}
                >
                  {codeCopied ? '✓ Copied' : 'Copy'}
                </button>
                <button
                  onClick={() => setCodeOpen(!codeOpen)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-medium transition-all"
                  style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.07)', color: 'rgba(204,195,216,0.5)' }}
                >
                  {codeOpen ? 'Collapse' : 'View Code'}
                </button>
              </div>
            </div>
            {/* Code block */}
            {codeOpen && (
              <div className="overflow-auto" style={{ maxHeight: '400px' }}>
                <pre className="p-5 text-[11px] leading-relaxed" style={{ color: 'rgba(204,195,216,0.75)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  <code>{transform.code}</code>
                </pre>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── SOURCE CONTROL — only when complete ── */}
      {pipelineStep === 'complete' && <div className="fixed bottom-5 left-5 z-40">
        {/* Expanded panel */}
        <div
          className="overflow-hidden transition-all duration-300 ease-out rounded-2xl mb-2"
          style={{
            maxHeight: scOpen ? '380px' : '0px',
            width: '340px',
            opacity: scOpen ? 1 : 0,
            background: 'rgba(255,255,255,0.96)',
            backdropFilter: 'blur(24px) saturate(1.5)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
            border: scOpen ? '1px solid rgba(0,0,0,0.08)' : '1px solid transparent',
            boxShadow: scOpen ? '0 12px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.04)' : 'none',
          }}
        >
          <div className="p-4 overflow-y-auto" style={{ maxHeight: '360px' }}>
            <div className="flex items-center justify-between mb-3 pb-2.5" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
              <div className="flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><line x1="1.05" y1="12" x2="7" y2="12" /><line x1="17.01" y1="12" x2="22.96" y2="12" /></svg>
                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'rgba(0,0,0,0.35)' }}>Source Control</span>
              </div>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full" style={{ color: 'rgba(0,0,0,0.2)', background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>{commits.length}</span>
            </div>
            {commits.length === 0 ? (
              <div className="text-center py-6">
                <span className="text-[11px]" style={{ color: 'rgba(0,0,0,0.15)' }}>No commits yet</span>
              </div>
            ) : (
            <div className="relative">
              <div className="absolute left-[4px] top-1 bottom-1 w-[1.5px]" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(59,130,246,0.3), rgba(239,68,68,0.3), rgba(245,158,11,0.3), rgba(0,0,0,0.1))' }} />
              {commits.map((c, i) => (
                <div
                  key={i}
                  onClick={() => handleCommitClick(c)}
                  className="flex items-center gap-2.5 py-[6px] relative cursor-pointer rounded-lg px-1.5 -mx-1 transition-all hover:bg-white/[0.03]"
                >
                  <div className="w-[9px] h-[9px] rounded-full flex-shrink-0 z-10" style={{ background: c.color, boxShadow: `0 0 8px ${c.color}40` }} />
                  <span className="text-[9px] font-mono w-11 flex-shrink-0" style={{ color: 'rgba(0,0,0,0.2)' }}>{c.hash}</span>
                  <span className="text-[10px] text-neutral-950/60 font-medium flex-1 truncate">{c.msg}</span>
                  {c.status === 'rejected' && (
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(239,68,68,0.1)', color: 'rgba(239,68,68,0.7)', border: '1px solid rgba(239,68,68,0.15)' }}>
                      REJECTED
                    </span>
                  )}
                  {c.status === 'pending' && (
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(245,158,11,0.1)', color: 'rgba(245,158,11,0.7)', border: '1px solid rgba(245,158,11,0.15)' }}>
                      PENDING
                    </span>
                  )}
                </div>
              ))}
            </div>
            )}
          </div>
        </div>

        {/* Toggle pill */}
        <button
          onClick={() => setScOpen(!scOpen)}
          className="flex items-center gap-2 px-4 py-2 rounded-full transition-all active:scale-95"
          style={{
            background: 'rgba(255,255,255,0.96)',
            backdropFilter: 'blur(20px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 6px 20px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)',
          }}
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: scOpen ? '#22c55e' : '#0a0a0a', boxShadow: scOpen ? '0 0 6px rgba(34,197,94,0.4)' : '0 0 6px rgba(0,0,0,0.3)' }} />
          <span className="text-[10px] font-medium" style={{ color: 'rgba(0,0,0,0.45)' }}>Source Control</span>
          <span className="text-[8px] transition-transform duration-300" style={{ color: 'rgba(0,0,0,0.2)', transform: scOpen ? 'rotate(180deg)' : '' }}>&#9650;</span>
        </button>
      </div>}

      {/* ── SUGGEST EDIT MODAL ── */}
      {showSuggestModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(12px)' }}>
          <div className="rounded-2xl w-full max-w-3xl mx-4 overflow-hidden animate-in fade-in zoom-in duration-200" style={{ background: 'linear-gradient(180deg, rgba(30,27,46,1) 0%, rgba(19,17,28,1) 100%)', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 60px rgba(0,0,0,0.1)' }}>
            {/* Accent top bar */}
            <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, #0a0a0a, #0a0a0a, rgba(0,0,0,0.2), transparent)' }} />

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.08)', border: '1px solid rgba(0,0,0,0.15)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                </div>
                <div>
                  <h2 className="text-neutral-950 font-semibold text-[15px]">Suggest an Edit</h2>
                  <p className="text-[11px] mt-0.5" style={{ color: 'rgba(0,0,0,0.3)' }}>Describe the change you&apos;d like Reform to apply</p>
                </div>
              </div>
              <button onClick={() => setShowSuggestModal(false)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/[0.05]" style={{ color: 'rgba(0,0,0,0.3)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {/* Text Prompt (voice prompt removed) */}
            <div className="px-6 pt-5 pb-6">
              <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.06)' }}>
                <div className="p-5">
                  <textarea
                    autoFocus
                    value={suggestion}
                    onChange={e => setSuggestion(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleSuggestSubmit() }}
                    placeholder="Describe what you'd like to change... (e.g., 'Make the sidebar collapsible', 'Change the accent color to blue')"
                    className="w-full bg-transparent text-[13px] text-neutral-950 outline-none resize-none placeholder:text-neutral-950/20"
                    style={{ minHeight: '140px', lineHeight: '1.7' }}
                  />
                  <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                    <span className="text-[10px] flex items-center gap-1.5" style={{ color: 'rgba(0,0,0,0.15)' }}>
                      <kbd className="px-1.5 py-0.5 rounded text-[9px] font-mono" style={{ background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.08)' }}>&#8984;</kbd>
                      <span>+</span>
                      <kbd className="px-1.5 py-0.5 rounded text-[9px] font-mono" style={{ background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.08)' }}>Enter</kbd>
                      <span className="ml-1">to submit</span>
                    </span>
                    <button
                      onClick={() => handleSuggestSubmit()}
                      disabled={!suggestion.trim()}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-semibold transition-all active:scale-[0.97]"
                      style={{
                        background: suggestion.trim() ? 'linear-gradient(135deg, #0a0a0a, #0a0a0a)' : 'rgba(0,0,0,0.04)',
                        color: suggestion.trim() ? 'white' : 'rgba(0,0,0,0.2)',
                        boxShadow: suggestion.trim() ? '0 0 25px rgba(0,0,0,0.25)' : 'none',
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                      Send to AI
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── COMMIT DETAIL MODAL ── */}
      {selectedCommit && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(12px)' }}>
          <div className="rounded-2xl max-w-lg w-full mx-4 overflow-hidden animate-in fade-in zoom-in duration-200" style={{ background: 'linear-gradient(180deg, rgba(30,27,46,1) 0%, rgba(19,17,28,1) 100%)', border: '1px solid rgba(0,0,0,0.08)', boxShadow: `0 24px 80px rgba(0,0,0,0.6), 0 0 40px ${selectedCommit.color}12` }}>
            {/* Accent top bar */}
            <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${selectedCommit.color}80, ${selectedCommit.color}20, transparent)` }} />

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${selectedCommit.color}15`, border: `1px solid ${selectedCommit.color}25` }}>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: selectedCommit.color, boxShadow: `0 0 10px ${selectedCommit.color}50` }} />
                </div>
                <div>
                  <span className="text-[11px] font-mono block" style={{ color: 'rgba(0,0,0,0.3)' }}>{selectedCommit.hash}</span>
                  {selectedCommit.status === 'rejected' && (
                    <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#ef4444' }}>Rejected</span>
                  )}
                  {selectedCommit.status === 'accepted' && (
                    <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#86efac' }}>Accepted</span>
                  )}
                  {selectedCommit.status === 'pending' && (
                    <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#f59e0b' }}>Pending Review</span>
                  )}
                </div>
              </div>
              <button onClick={() => setSelectedCommit(null)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/[0.05]" style={{ color: 'rgba(0,0,0,0.3)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Commit message */}
              <div>
                <span className="text-[9px] font-medium uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(0,0,0,0.2)' }}>Commit Message</span>
                <h3 className="text-neutral-950 font-semibold text-[15px] leading-snug">{selectedCommit.msg}</h3>
              </div>

              {/* Suggestion text if available */}
              {selectedCommit.suggestion && (
                <div className="rounded-xl p-4" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.08)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    <span className="text-[9px] font-medium uppercase tracking-wider" style={{ color: 'rgba(0,0,0,0.5)' }}>Suggested Edit</span>
                  </div>
                  <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(0,0,0,0.55)' }}>{selectedCommit.suggestion}</p>
                </div>
              )}

              {/* Code preview if available */}
              {selectedCommit.code && (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
                  <div className="px-4 py-2 flex items-center justify-between" style={{ background: 'rgba(0,0,0,0.03)', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                    <span className="text-[9px] font-medium uppercase tracking-wider" style={{ color: 'rgba(0,0,0,0.2)' }}>Code Preview</span>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.08)', color: 'rgba(0,0,0,0.5)' }}>
                      {selectedCommit.code.split('\n').length} lines
                    </span>
                  </div>
                  <pre className="p-4 text-[11px] font-mono overflow-x-auto leading-relaxed" style={{ background: 'rgba(0,0,0,0.25)', color: 'rgba(0,0,0,0.45)', maxHeight: '200px' }}>
                    {selectedCommit.code.slice(0, 500)}{selectedCommit.code.length > 500 ? '\n...' : ''}
                  </pre>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 px-6 py-4" style={{ borderTop: '1px solid rgba(0,0,0,0.06)', background: 'rgba(0,0,0,0.01)' }}>
              {(selectedCommit.status === 'rejected' || selectedCommit.status === 'pending') && (
                <button
                  onClick={() => handleAcceptRejected(selectedCommit)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-semibold transition-all active:scale-[0.97]"
                  style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.08))', color: '#86efac', border: '1px solid rgba(34,197,94,0.2)', boxShadow: '0 0 20px rgba(34,197,94,0.08)' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  Accept{selectedCommit.status === 'rejected' ? ' Now' : ' Changes'}
                </button>
              )}
              <button
                onClick={() => setSelectedCommit(null)}
                className="px-5 py-2.5 rounded-xl text-[11px] font-medium transition-colors hover:bg-white/[0.03]"
                style={{ color: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,0,0,0.08)' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REFINEMENT STATUS CARD — floating bottom-right ── */}
      {refineStatus && (
        <div
          className="fixed bottom-6 right-6 z-[250] animate-in slide-in-from-bottom-4 fade-in duration-300"
          style={{ maxWidth: '320px', width: '100%' }}
        >
          <div
            className="rounded-xl overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, rgba(30,27,46,0.98) 0%, rgba(19,17,28,0.98) 100%)',
              border: `1px solid ${
                refineStatus.status === 'success' ? 'rgba(34,197,94,0.2)'
                : refineStatus.status === 'error' ? 'rgba(239,68,68,0.2)'
                : 'rgba(0,0,0,0.2)'
              }`,
              boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 1px rgba(0,0,0,0.1)',
              backdropFilter: 'blur(20px)',
            }}
          >
            {/* Accent top line */}
            <div className="h-[2px]" style={{
              background: refineStatus.status === 'success'
                ? 'linear-gradient(90deg, #22c55e, rgba(34,197,94,0.2), transparent)'
                : refineStatus.status === 'error'
                ? 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.2), transparent)'
                : 'linear-gradient(90deg, #0a0a0a, rgba(0,0,0,0.2), transparent)',
            }} />

            <div className="flex items-start gap-3 px-4 py-3.5">
              {/* Status icon */}
              <div className="flex-shrink-0 mt-0.5">
                {refineStatus.status === 'pending' && (
                  <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.1)' }}>
                    <div className="w-2 h-2 rounded-full" style={{ background: '#0a0a0a', boxShadow: '0 0 6px rgba(0,0,0,0.5)' }} />
                  </div>
                )}
                {refineStatus.status === 'processing' && (
                  <div className="w-5 h-5 rounded-full animate-spin" style={{ border: '2px solid rgba(0,0,0,0.15)', borderTopColor: '#0a0a0a' }} />
                )}
                {refineStatus.status === 'success' && (
                  <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.1)' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                )}
                {refineStatus.status === 'error' && (
                  <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-neutral-950 leading-tight">
                  {refineStatus.status === 'pending' && 'Change pending'}
                  {refineStatus.status === 'processing' && 'Applying changes'}
                  {refineStatus.status === 'success' && 'Changes applied'}
                  {refineStatus.status === 'error' && 'Change failed'}
                </p>
                <p className="text-[11px] mt-0.5 truncate" style={{
                  color: refineStatus.status === 'error'
                    ? 'rgba(252,165,165,0.7)'
                    : refineStatus.status === 'success'
                    ? 'rgba(134,239,172,0.7)'
                    : 'rgba(0,0,0,0.4)',
                }}>
                  {refineStatus.status === 'error'
                    ? (refineStatus.error || 'Something went wrong')
                    : refineStatus.status === 'success'
                    ? 'Your updated UI is ready'
                    : refineStatus.status === 'processing'
                    ? 'Refining the selected page...'
                    : refineStatus.summary
                  }
                </p>
              </div>

              {/* Dismiss */}
              <button
                onClick={() => setRefineStatus(null)}
                className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors hover:bg-white/[0.05]"
                style={{ color: 'rgba(0,0,0,0.25)' }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
