'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Editor from '@monaco-editor/react'

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

function BrowserFrame({ children, label, accent = false }: { children: React.ReactNode; label: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-2 flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: accent ? '#a855f7' : 'rgba(255,255,255,0.2)' }} />
        <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</span>
      </div>
      <div className="rounded-xl overflow-hidden flex flex-col" style={{
        border: accent ? '1px solid rgba(168,85,247,0.3)' : '1px solid rgba(255,255,255,0.06)',
        boxShadow: accent ? '0 0 40px rgba(124,58,237,0.15)' : '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div className="border-b px-3 py-1.5 flex items-center gap-1.5" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="w-2 h-2 rounded-full bg-red-500/60" />
          <div className="w-2 h-2 rounded-full bg-amber-500/60" />
          <div className="w-2 h-2 rounded-full bg-emerald-500/60" />
        </div>
        <div style={{ background: '#0d0c16', minHeight: '280px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

type Phase = 'idle' | 'listening' | 'thinking' | 'responding'

function VoiceOrb({ onFinalPrompt }: { onFinalPrompt: (prompt: string) => void }) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [hasGreeted, setHasGreeted] = useState(false)
  const [orbScale, setOrbScale] = useState(1)
  const [transcript, setTranscript] = useState('')
  const [aiResponse, setAiResponse] = useState('')
  const [displayText, setDisplayText] = useState('')
  const [error, setError] = useState('')
  const [history, setHistory] = useState<{ role: string; content: string }[]>([])
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

          const res = await fetch('http://localhost:8000/transcribe', {
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

      const res = await fetch('http://localhost:8000/voice-chat', {
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

    // If AI generated a final prompt, send it to the pipeline and close
    if (finalPrompt) {
      typewrite(aiText, async () => {
        if (stoppedRef.current) return
        await playTTS(aiText)
        if (mountedRef.current && !stoppedRef.current) onFinalPrompt(finalPrompt!)
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
      const res = await fetch('http://localhost:8000/tts', {
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
  }[phase]

  const phaseSub = {
    idle: 'Tap the mic to start talking',
    listening: 'Speak now \u2014 I\u2019ll respond when you pause',
    thinking: 'Processing your input...',
    responding: 'Reform AI is speaking',
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
          background: `radial-gradient(circle, rgba(124,58,237,${isActive ? 0.06 + intensity * 0.12 : phase === 'thinking' ? 0.06 : 0.03}) 0%, transparent 70%)`,
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
            background: `radial-gradient(circle, rgba(124,58,237,${isActive ? 0.08 + intensity * 0.15 : 0.03}), transparent 70%)`,
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
              ? `radial-gradient(circle at ${45 + intensity * 10}% ${40 - intensity * 5}%, rgba(168,85,247,${0.4 + intensity * 0.5}), rgba(124,58,237,${0.2 + intensity * 0.3}) 50%, rgba(59,130,246,${0.08 + intensity * 0.15}))`
              : phase === 'thinking'
                ? 'radial-gradient(circle at 45% 40%, rgba(168,85,247,0.35), rgba(124,58,237,0.18) 55%, rgba(59,130,246,0.08))'
                : 'radial-gradient(circle at 45% 40%, rgba(168,85,247,0.25), rgba(124,58,237,0.12) 55%, rgba(59,130,246,0.06))',
            boxShadow: isActive
              ? `0 0 ${20 + intensity * 50}px rgba(124,58,237,${0.15 + intensity * 0.4}), 0 0 ${40 + intensity * 80}px rgba(124,58,237,${0.05 + intensity * 0.15}), inset 0 0 ${20 + intensity * 30}px rgba(168,85,247,${0.1 + intensity * 0.25})`
              : phase === 'thinking'
                ? '0 0 40px rgba(124,58,237,0.15), 0 0 80px rgba(124,58,237,0.06), inset 0 0 25px rgba(168,85,247,0.12)'
                : '0 0 30px rgba(124,58,237,0.1), 0 0 60px rgba(124,58,237,0.04), inset 0 0 20px rgba(168,85,247,0.08)',
            transform: `scale(${orbScale})`,
            transition: 'transform 80ms ease-out, box-shadow 150ms ease-out',
          }}
        />
      </div>

      {/* Phase label */}
      <p className="text-[14px] font-semibold text-white mb-0.5 relative">{phaseLabel}</p>

      {/* Typewriter text */}
      <p className="text-[12px] mt-2 max-w-sm text-center relative leading-relaxed" style={{
        color: phase === 'listening' ? 'rgba(255,255,255,0.5)'
          : (phase === 'responding' || phase === 'thinking') ? 'rgba(168,85,247,0.6)'
          : 'rgba(255,255,255,0.2)',
        minHeight: '18px',
      }}>
        {displayText || phaseSub}
      </p>

      {error && (
        <p className="text-[10px] mt-1 relative" style={{ color: 'rgba(239,68,68,0.5)' }}>{error}</p>
      )}

      {/* Action button */}
      <button
        onClick={handleButtonClick}
        className="flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-semibold transition-all active:scale-95 mt-1"
        style={phase === 'listening' || phase === 'responding' ? {
          background: 'rgba(239,68,68,0.1)',
          color: 'rgba(239,68,68,0.8)',
          border: '1px solid rgba(239,68,68,0.2)',
          boxShadow: '0 0 15px rgba(239,68,68,0.1)',
        } : phase === 'thinking' ? {
          background: 'rgba(168,85,247,0.05)',
          color: 'rgba(168,85,247,0.4)',
          border: '1px solid rgba(168,85,247,0.1)',
        } : {
          background: 'rgba(168,85,247,0.1)',
          color: 'rgba(168,85,247,0.8)',
          border: '1px solid rgba(168,85,247,0.2)',
          boxShadow: '0 0 15px rgba(124,58,237,0.1)',
        }}
      >
        {phase === 'listening' || phase === 'responding' ? (
          <>
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: 'rgba(239,68,68,0.8)' }} />
            Stop
          </>
        ) : phase === 'thinking' ? (
          <>
            <div className="w-3 h-3 rounded-full animate-spin" style={{ border: '2px solid rgba(168,85,247,0.15)', borderTopColor: 'rgba(168,85,247,0.5)' }} />
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
    </div>
  )
}

export default function TransformPage() {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null)
  const [scOpen, setScOpen] = useState(false)
  const [commits, setCommits] = useState<CommitEntry[]>(INITIAL_COMMITS)
  const [changeStatus, setChangeStatus] = useState<'pending' | 'accepted' | 'rejected'>('pending')
  const [showSuggestModal, setShowSuggestModal] = useState(false)
  const [suggestTab, setSuggestTab] = useState<'text' | 'voice' | 'code'>('text')
  const [suggestion, setSuggestion] = useState('')
  const [codeEdit, setCodeEdit] = useState('')
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [selectedCommit, setSelectedCommit] = useState<CommitEntry | null>(null)
  const router = useRouter()

  useEffect(() => {
    const stored = sessionStorage.getItem('refineui_analysis')
    if (stored) { try { setAnalysis(JSON.parse(stored)) } catch { /* */ } }
  }, [])

  function handleAccept() {
    setChangeStatus('accepted')
    const hasPending = commits.some(c => c.status === 'pending')
    if (hasPending) {
      // Update ALL pending commits to accepted
      setCommits(prev => prev.map(c =>
        c.status === 'pending' ? { ...c, status: 'accepted', color: '#22c55e' } : c
      ))
    } else {
      const newCommit: CommitEntry = {
        hash: Math.random().toString(16).slice(2, 8),
        msg: 'feat: apply UI transformation',
        color: '#22c55e',
        status: 'accepted',
      }
      setCommits(prev => [newCommit, ...prev])
    }
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
    setSuggestLoading(true)

    try {
      const currentCode = sessionStorage.getItem('refineui_analysis') || ''
      const res = await fetch('http://localhost:8000/suggest-edit', {
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
      setShowSuggestModal(false)
      setSuggestion('')
      setScOpen(true)
    } catch {
      const newCommit: CommitEntry = {
        hash: Math.random().toString(16).slice(2, 8),
        msg: `edit: ${promptText.slice(0, 40)}`,
        color: '#f59e0b',
        status: 'pending',
        suggestion: promptText,
      }
      setCommits(prev => [newCommit, ...prev])
      setShowSuggestModal(false)
      setSuggestion('')
      setScOpen(true)
    } finally {
      setSuggestLoading(false)
    }
  }

  function handleCodeSubmit() {
    if (!codeEdit.trim()) return
    const newCommit: CommitEntry = {
      hash: Math.random().toString(16).slice(2, 8),
      msg: 'edit: manual code change',
      color: '#f59e0b',
      status: 'pending',
      code: codeEdit,
      suggestion: 'Manual code edit via IDE',
    }
    setCommits(prev => [newCommit, ...prev])
    setShowSuggestModal(false)
    setCodeEdit('')
    setScOpen(true)
  }

  function openSuggestModal() {
    // Pre-populate the code editor with existing generated code if available
    const storedAnalysis = sessionStorage.getItem('refineui_analysis')
    if (storedAnalysis && !codeEdit) {
      setCodeEdit(`export default function Dashboard() {\n  return (\n    <div className="flex gap-6 p-8">\n      <Sidebar />\n      <MainContent />\n    </div>\n  )\n}`)
    }
    setSuggestTab('text')
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

  if (!analysis) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.12)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(168,85,247,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No Analysis Data</h2>
          <p className="text-[13px] mb-6 leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>Complete a Project Discovery first to generate your UI transformation.</p>
          <button onClick={() => router.push('/dashboard/discovery')} className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.98]" style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 0 30px rgba(124,58,237,0.25)' }}>
            Start Discovery
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-center px-6 py-10 pb-20">
      <div className="w-full max-w-6xl space-y-10">

        {/* ── HERO: Before / After ── */}
        <div>
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-3">UI Transformation</h1>
            <div className="flex items-center justify-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)' }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#a855f7', boxShadow: '0 0 6px rgba(168,85,247,0.4)' }} />
                <span className="text-[11px] font-medium" style={{ color: 'rgba(168,85,247,0.8)' }}>
                  {changeStatus === 'accepted' ? 'Applied' : changeStatus === 'rejected' ? 'Original Kept' : 'Ready for Review'}
                </span>
              </div>
              <span className="text-[12px]" style={{ color: 'rgba(255,255,255,0.25)' }}>{analysis.sources?.length || 0} sources analyzed</span>
            </div>
          </div>
          <div className="flex flex-col lg:flex-row gap-6">
            <BrowserFrame label="Before">
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="w-3.5 h-3.5 rounded-full" style={{ background: '#7c3aed' }} />
                  <span className="text-[9px] font-semibold text-white">RefineUI</span>
                  <div className="flex-1" />
                  <div className="flex gap-1">{[1,2,3].map(n => <div key={n} className="h-2.5 w-6 rounded" style={{ background: 'rgba(255,255,255,0.05)' }} />)}</div>
                </div>
                <div className="flex gap-2">
                  <div className="w-20 space-y-1.5">
                    {['Discovery', 'Competitors', 'Design', 'Insights'].map(n => (
                      <div key={n} className="px-2 py-1 rounded text-[7px]" style={{ background: n === 'Discovery' ? 'rgba(255,255,255,0.06)' : 'transparent', color: 'rgba(255,255,255,0.4)' }}>{n}</div>
                    ))}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="text-[8px] font-semibold text-white/60 px-1">Discovery</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {['Companies', 'Context'].map(l => (
                        <div key={l} className="rounded-lg p-2 space-y-1.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                          <div className="text-[6px] font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>{l}</div>
                          {[70,85,55].map((w, i) => <div key={i} className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.04)', width: `${w}%` }} />)}
                        </div>
                      ))}
                    </div>
                    <div className="h-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }} />
                  </div>
                </div>
                <div className="mt-3 px-1"><span className="text-[6px]" style={{ color: 'rgba(255,255,255,0.15)' }}>Settings</span></div>
              </div>
            </BrowserFrame>

            {/* Arrow */}
            <div className="hidden lg:flex items-center justify-center">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 0 30px rgba(124,58,237,0.3)' }}>
                <span className="text-white text-lg">&rarr;</span>
              </div>
            </div>

            <BrowserFrame label="After" accent>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded-lg" style={{ background: 'rgba(168,85,247,0.06)' }}>
                  <div className="w-3.5 h-3.5 rounded-full" style={{ background: '#7c3aed' }} />
                  <span className="text-[9px] font-semibold text-white">RefineUI</span>
                  <div className="flex-1" />
                  <div className="flex gap-1">
                    <span className="text-[6px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(168,85,247,0.15)', color: 'rgba(168,85,247,0.8)' }}>Pro</span>
                    <span className="text-[6px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.15)', color: '#86efac' }}>Live</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="w-16 space-y-1">
                    {['Team', 'Yours', 'Config', 'Library'].map((n, i) => (
                      <div key={n} className="px-1.5 py-1 rounded text-[6px]" style={{ background: i === 0 ? 'rgba(168,85,247,0.08)' : 'transparent', color: i === 0 ? 'rgba(168,85,247,0.7)' : 'rgba(255,255,255,0.25)' }}>{n}</div>
                    ))}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="text-[8px] font-semibold text-white/70 px-1">Discovery</div>
                    <div className="text-[6px] px-1" style={{ color: 'rgba(255,255,255,0.2)' }}>Latest AI inspection</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {['Frameworks', 'Context'].map(l => (
                        <div key={l} className="rounded-lg p-2 space-y-1.5" style={{ background: 'rgba(168,85,247,0.03)', border: '1px solid rgba(168,85,247,0.08)' }}>
                          <div className="text-[6px] font-semibold" style={{ color: 'rgba(168,85,247,0.6)' }}>{l}</div>
                          {[75,60,90].map((w, i) => <div key={i} className="h-1.5 rounded-full" style={{ background: 'rgba(168,85,247,0.06)', width: `${w}%` }} />)}
                        </div>
                      ))}
                    </div>
                    <div className="h-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.01)' }} />
                  </div>
                </div>
              </div>
            </BrowserFrame>
          </div>
        </div>

        {/* ── TOOLBAR ── */}
        <div className="rounded-xl max-w-4xl mx-auto overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
          {changeStatus === 'pending' ? (
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.12)' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(168,85,247,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                </div>
                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>Review Changes</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleAccept}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-medium transition-all hover:bg-green-500/[0.06] active:scale-[0.97]"
                  style={{ color: 'rgba(34,197,94,0.7)', border: '1px solid transparent' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  Apply Changes
                </button>
                <button
                  onClick={handleReject}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-medium transition-all hover:bg-red-500/[0.06] active:scale-[0.97]"
                  style={{ color: 'rgba(239,68,68,0.5)', border: '1px solid transparent' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  Keep Original
                </button>
                <div className="w-px h-5 mx-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
                <button
                  onClick={openSuggestModal}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-semibold transition-all hover:bg-purple-500/[0.06] active:scale-[0.97]"
                  style={{ color: 'rgba(168,85,247,0.7)', border: '1px solid rgba(168,85,247,0.12)' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  Refine Further
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between px-5 py-4 cursor-pointer transition-colors hover:bg-white/[0.01]" onClick={() => setChangeStatus('pending')}>
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: changeStatus === 'accepted' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${changeStatus === 'accepted' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'}` }}>
                  {changeStatus === 'accepted' ? (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(34,197,94,0.6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  ) : (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(239,68,68,0.5)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  )}
                </div>
                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.2)' }}>Review Changes</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: changeStatus === 'accepted' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${changeStatus === 'accepted' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'}` }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: changeStatus === 'accepted' ? '#22c55e' : '#ef4444', boxShadow: `0 0 6px ${changeStatus === 'accepted' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}` }} />
                  <span className="text-[11px] font-medium" style={{ color: changeStatus === 'accepted' ? '#86efac' : 'rgba(239,68,68,0.7)' }}>
                    {changeStatus === 'accepted' ? 'Changes applied' : 'Original kept'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── SECONDARY: Heatmaps (small) ── */}
        <div>
          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="h-px flex-1 max-w-[80px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06))' }} />
            <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>Predicted Attention Analysis</p>
            <div className="h-px flex-1 max-w-[80px]" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.06), transparent)' }} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-4xl mx-auto">
            {[
              { label: 'Original UI', gradient: 'radial-gradient(ellipse at 45% 35%, rgba(255,0,0,0.5) 0%, rgba(255,100,0,0.25) 20%, transparent 45%), radial-gradient(ellipse at 30% 65%, rgba(255,80,0,0.4) 0%, transparent 40%)', accent: false },
              { label: 'Refined UI', gradient: 'radial-gradient(ellipse at 35% 30%, rgba(80,0,255,0.35) 0%, transparent 45%), radial-gradient(ellipse at 65% 50%, rgba(255,0,0,0.25) 0%, transparent 35%), radial-gradient(ellipse at 50% 75%, rgba(0,50,255,0.25) 0%, transparent 40%)', accent: true },
            ].map((hm) => (
              <div key={hm.label} className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: hm.accent ? '1px solid rgba(168,85,247,0.1)' : '1px solid rgba(255,255,255,0.06)', boxShadow: hm.accent ? '0 0 30px rgba(124,58,237,0.05)' : 'none' }}>
                <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                  <span className="text-[11px] font-medium" style={{ color: hm.accent ? 'rgba(168,85,247,0.6)' : 'rgba(255,255,255,0.4)' }}>Heatmap: {hm.label}</span>
                  {hm.accent && <span className="text-[8px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(168,85,247,0.08)', color: 'rgba(168,85,247,0.5)', border: '1px solid rgba(168,85,247,0.12)' }}>IMPROVED</span>}
                </div>
                <div className="px-3 pb-3">
                  <div className="relative rounded-lg overflow-hidden" style={{ background: '#0a0820', aspectRatio: '16/7' }}>
                    <div className="absolute inset-0 p-3 opacity-20">
                      <div className="flex gap-2 h-full">
                        <div className="w-10 space-y-1">{[1,2,3,4].map(n => <div key={n} className="h-1.5 rounded" style={{ background: 'rgba(255,255,255,0.1)' }} />)}</div>
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 w-1/2 rounded" style={{ background: 'rgba(255,255,255,0.06)' }} />
                          <div className="grid grid-cols-3 gap-1">{[1,2,3].map(n => <div key={n} className="h-10 rounded" style={{ background: 'rgba(255,255,255,0.03)' }} />)}</div>
                        </div>
                      </div>
                    </div>
                    <div className="absolute inset-0 pointer-events-none" style={{ background: hm.gradient, mixBlendMode: 'screen' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SOURCE CONTROL — liquid glass, bottom-left ── */}
      <div className="fixed bottom-5 left-5 z-40">
        {/* Expanded panel */}
        <div
          className="overflow-hidden transition-all duration-300 ease-out rounded-2xl mb-2"
          style={{
            maxHeight: scOpen ? '380px' : '0px',
            width: '340px',
            opacity: scOpen ? 1 : 0,
            background: 'rgba(19,17,28,0.6)',
            backdropFilter: 'blur(24px) saturate(1.5)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
            border: scOpen ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
            boxShadow: scOpen ? '0 24px 80px rgba(0,0,0,0.6), 0 0 40px rgba(124,58,237,0.08)' : 'none',
          }}
        >
          <div className="p-4 overflow-y-auto" style={{ maxHeight: '360px' }}>
            <div className="flex items-center justify-between mb-3 pb-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(168,85,247,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><line x1="1.05" y1="12" x2="7" y2="12" /><line x1="17.01" y1="12" x2="22.96" y2="12" /></svg>
                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>Source Control</span>
              </div>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full" style={{ color: 'rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>{commits.length}</span>
            </div>
            {commits.length === 0 ? (
              <div className="text-center py-6">
                <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.15)' }}>No commits yet</span>
              </div>
            ) : (
            <div className="relative">
              <div className="absolute left-[4px] top-1 bottom-1 w-[1.5px]" style={{ background: 'linear-gradient(to bottom, rgba(168,85,247,0.4), rgba(59,130,246,0.3), rgba(239,68,68,0.3), rgba(245,158,11,0.3), rgba(168,85,247,0.1))' }} />
              {commits.map((c, i) => (
                <div
                  key={i}
                  onClick={() => handleCommitClick(c)}
                  className="flex items-center gap-2.5 py-[6px] relative cursor-pointer rounded-lg px-1.5 -mx-1 transition-all hover:bg-white/[0.03]"
                >
                  <div className="w-[9px] h-[9px] rounded-full flex-shrink-0 z-10" style={{ background: c.color, boxShadow: `0 0 8px ${c.color}40` }} />
                  <span className="text-[9px] font-mono w-11 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }}>{c.hash}</span>
                  <span className="text-[10px] text-white/60 font-medium flex-1 truncate">{c.msg}</span>
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
            background: 'rgba(19,17,28,0.6)',
            backdropFilter: 'blur(20px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 20px rgba(124,58,237,0.06)',
          }}
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: scOpen ? '#22c55e' : '#a855f7', boxShadow: scOpen ? '0 0 6px rgba(34,197,94,0.4)' : '0 0 6px rgba(168,85,247,0.3)' }} />
          <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Source Control</span>
          <span className="text-[8px] transition-transform duration-300" style={{ color: 'rgba(255,255,255,0.2)', transform: scOpen ? 'rotate(180deg)' : '' }}>&#9650;</span>
        </button>
      </div>

      {/* ── SUGGEST EDIT MODAL ── */}
      {showSuggestModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(12px)' }}>
          <div className="rounded-2xl w-full max-w-3xl mx-4 overflow-hidden animate-in fade-in zoom-in duration-200" style={{ background: 'linear-gradient(180deg, rgba(30,27,46,1) 0%, rgba(19,17,28,1) 100%)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 60px rgba(124,58,237,0.1)' }}>
            {/* Accent top bar */}
            <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, #7c3aed, #a855f7, rgba(168,85,247,0.2), transparent)' }} />

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                </div>
                <div>
                  <h2 className="text-white font-semibold text-[15px]">Suggest an Edit</h2>
                  <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Choose how you&apos;d like to describe your change</p>
                </div>
              </div>
              <button onClick={() => setShowSuggestModal(false)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/[0.05]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex px-6 pt-4 gap-1">
              {([
                { key: 'text' as const, label: 'Text Prompt', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg> },
                { key: 'voice' as const, label: 'Voice Prompt', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg> },
                { key: 'code' as const, label: 'Code Editor', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg> },
              ]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setSuggestTab(tab.key)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-[11px] font-medium transition-all duration-200"
                  style={suggestTab === tab.key ? {
                    background: 'rgba(168,85,247,0.06)',
                    color: 'white',
                    borderTop: '2px solid #a855f7',
                    borderLeft: '1px solid rgba(255,255,255,0.06)',
                    borderRight: '1px solid rgba(255,255,255,0.06)',
                    boxShadow: '0 -4px 12px rgba(168,85,247,0.06)',
                  } : {
                    color: 'rgba(255,255,255,0.35)',
                    border: '1px solid transparent',
                  }}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="px-6 pb-6">
              <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>

                {/* TEXT PROMPT TAB */}
                {suggestTab === 'text' && (
                  <div className="p-5">
                    <textarea
                      autoFocus
                      value={suggestion}
                      onChange={e => setSuggestion(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleSuggestSubmit() }}
                      placeholder="Describe what you'd like to change... (e.g., 'Make the sidebar collapsible', 'Change the accent color to blue')"
                      className="w-full bg-transparent text-[13px] text-white outline-none resize-none placeholder:text-white/20"
                      style={{ minHeight: '140px', lineHeight: '1.7' }}
                      disabled={suggestLoading}
                    />
                    <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      <span className="text-[10px] flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.15)' }}>
                        <kbd className="px-1.5 py-0.5 rounded text-[9px] font-mono" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>&#8984;</kbd>
                        <span>+</span>
                        <kbd className="px-1.5 py-0.5 rounded text-[9px] font-mono" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>Enter</kbd>
                        <span className="ml-1">to submit</span>
                      </span>
                      <button
                        onClick={() => handleSuggestSubmit()}
                        disabled={suggestLoading || !suggestion.trim()}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-semibold transition-all active:scale-[0.97]"
                        style={{
                          background: suggestion.trim() ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : 'rgba(255,255,255,0.04)',
                          color: suggestion.trim() ? 'white' : 'rgba(255,255,255,0.2)',
                          boxShadow: suggestion.trim() ? '0 0 25px rgba(124,58,237,0.25)' : 'none',
                        }}
                      >
                        {suggestLoading ? (
                          <>
                            <div className="w-3.5 h-3.5 rounded-full animate-spin" style={{ border: '2px solid rgba(255,255,255,0.2)', borderTopColor: 'white' }} />
                            Processing...
                          </>
                        ) : (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                            Send to AI
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* VOICE PROMPT TAB */}
                {suggestTab === 'voice' && <VoiceOrb onFinalPrompt={(prompt) => {
                  setShowSuggestModal(false)
                  handleSuggestSubmit(prompt)
                }} />}

                {/* CODE EDITOR TAB */}
                {suggestTab === 'code' && (
                  <div className="flex flex-col">
                    {/* Editor toolbar */}
                    <div className="flex items-center justify-between px-4 py-2.5" style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div className="flex items-center gap-2.5">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(168,85,247,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
                        <span className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>Dashboard.tsx</span>
                      </div>
                      <span className="text-[9px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5" style={{ background: 'rgba(34,197,94,0.08)', color: '#86efac', border: '1px solid rgba(34,197,94,0.12)' }}>
                        <div className="w-1 h-1 rounded-full" style={{ background: '#22c55e' }} />
                        Editable
                      </span>
                    </div>
                    {/* Monaco Editor */}
                    <div style={{ height: '340px' }}>
                      <Editor
                        height="100%"
                        defaultLanguage="typescript"
                        value={codeEdit}
                        onChange={(val) => setCodeEdit(val || '')}
                        theme="vs-dark"
                        options={{
                          minimap: { enabled: false },
                          fontSize: 13,
                          lineHeight: 22,
                          padding: { top: 12, bottom: 12 },
                          scrollBeyondLastLine: false,
                          wordWrap: 'on',
                          tabSize: 2,
                          renderLineHighlight: 'gutter',
                          scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
                          overviewRulerLanes: 0,
                          hideCursorInOverviewRuler: true,
                          overviewRulerBorder: false,
                        }}
                      />
                    </div>
                    {/* Submit bar */}
                    <div className="flex items-center justify-between px-4 py-3.5" style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.01)' }}>
                      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.15)' }}>Edit the code directly, then submit</span>
                      <button
                        onClick={handleCodeSubmit}
                        disabled={!codeEdit.trim()}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-semibold transition-all active:scale-[0.97]"
                        style={{
                          background: codeEdit.trim() ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : 'rgba(255,255,255,0.04)',
                          color: codeEdit.trim() ? 'white' : 'rgba(255,255,255,0.2)',
                          boxShadow: codeEdit.trim() ? '0 0 25px rgba(124,58,237,0.25)' : 'none',
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        Submit Code
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── COMMIT DETAIL MODAL ── */}
      {selectedCommit && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(12px)' }}>
          <div className="rounded-2xl max-w-lg w-full mx-4 overflow-hidden animate-in fade-in zoom-in duration-200" style={{ background: 'linear-gradient(180deg, rgba(30,27,46,1) 0%, rgba(19,17,28,1) 100%)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: `0 24px 80px rgba(0,0,0,0.6), 0 0 40px ${selectedCommit.color}12` }}>
            {/* Accent top bar */}
            <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${selectedCommit.color}80, ${selectedCommit.color}20, transparent)` }} />

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${selectedCommit.color}15`, border: `1px solid ${selectedCommit.color}25` }}>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: selectedCommit.color, boxShadow: `0 0 10px ${selectedCommit.color}50` }} />
                </div>
                <div>
                  <span className="text-[11px] font-mono block" style={{ color: 'rgba(255,255,255,0.3)' }}>{selectedCommit.hash}</span>
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
              <button onClick={() => setSelectedCommit(null)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/[0.05]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Commit message */}
              <div>
                <span className="text-[9px] font-medium uppercase tracking-wider block mb-1.5" style={{ color: 'rgba(255,255,255,0.2)' }}>Commit Message</span>
                <h3 className="text-white font-semibold text-[15px] leading-snug">{selectedCommit.msg}</h3>
              </div>

              {/* Suggestion text if available */}
              {selectedCommit.suggestion && (
                <div className="rounded-xl p-4" style={{ background: 'rgba(168,85,247,0.03)', border: '1px solid rgba(168,85,247,0.08)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(168,85,247,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    <span className="text-[9px] font-medium uppercase tracking-wider" style={{ color: 'rgba(168,85,247,0.5)' }}>Suggested Edit</span>
                  </div>
                  <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>{selectedCommit.suggestion}</p>
                </div>
              )}

              {/* Code preview if available */}
              {selectedCommit.code && (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="px-4 py-2 flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span className="text-[9px] font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.2)' }}>Code Preview</span>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(168,85,247,0.08)', color: 'rgba(168,85,247,0.5)' }}>
                      {selectedCommit.code.split('\n').length} lines
                    </span>
                  </div>
                  <pre className="p-4 text-[11px] font-mono overflow-x-auto leading-relaxed" style={{ background: 'rgba(0,0,0,0.25)', color: 'rgba(255,255,255,0.45)', maxHeight: '200px' }}>
                    {selectedCommit.code.slice(0, 500)}{selectedCommit.code.length > 500 ? '\n...' : ''}
                  </pre>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 px-6 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)' }}>
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
                style={{ color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
