'use client'

import { useEffect, useState } from 'react'

type Phase =
  | 'idle'
  | 'move'
  | 'drag'
  | 'selected'
  | 'type'
  | 'reach'
  | 'press'
  | 'applied'

const PROMPT = 'make it purple and pill-shaped'

const CANVAS = { width: 520, height: 360 }
const BUTTON = { left: 196, top: 170, width: 128, height: 44 }
const DRAG_START = { x: 180, y: 158 }
const DRAG_END = { x: 340, y: 226 }
const RECT = {
  left: DRAG_START.x,
  top: DRAG_START.y,
  width: DRAG_END.x - DRAG_START.x,
  height: DRAG_END.y - DRAG_START.y,
}
const PROMPT_BOX = {
  left: DRAG_START.x,
  top: DRAG_END.y + 16,
  width: 290,
  height: 40,
}
const APPLY_CENTER = {
  x: PROMPT_BOX.left + PROMPT_BOX.width - 30,
  y: PROMPT_BOX.top + PROMPT_BOX.height / 2,
}

function cursorForPhase(phase: Phase) {
  switch (phase) {
    case 'idle':
      return { x: CANVAS.width - 60, y: 36, opacity: 0 }
    case 'move':
      return { x: DRAG_START.x - 6, y: DRAG_START.y - 6, opacity: 1 }
    case 'drag':
    case 'selected':
      return { x: DRAG_END.x - 6, y: DRAG_END.y - 6, opacity: 1 }
    case 'type':
      return { x: PROMPT_BOX.left + 40, y: PROMPT_BOX.top + 22, opacity: 1 }
    case 'reach':
    case 'press':
    case 'applied':
      return { x: APPLY_CENTER.x - 6, y: APPLY_CENTER.y - 6, opacity: 1 }
  }
}

function rectForPhase(phase: Phase) {
  switch (phase) {
    case 'idle':
    case 'move':
      return { width: 0, height: 0, opacity: 0, dashed: true }
    case 'drag':
      return { width: RECT.width, height: RECT.height, opacity: 1, dashed: true }
    case 'selected':
    case 'type':
    case 'reach':
    case 'press':
      return { width: RECT.width, height: RECT.height, opacity: 1, dashed: false }
    case 'applied':
      return { width: RECT.width, height: RECT.height, opacity: 0, dashed: false }
  }
}

function CursorArrow() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.28))' }}
    >
      <path
        d="M4 2 L4 18 L9 14 L11.2 18.5 L13.3 17.5 L11.2 13 L16.5 13 Z"
        fill="#0a0a0a"
        stroke="#ffffff"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DummyPageContent({ applied }: { applied: boolean }) {
  return (
    <>
      {/* Top nav strip */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          right: 0,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 18px',
          borderBottom: '0.5px solid rgba(0,0,0,0.05)',
          background: '#ffffff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: 4,
              background: 'linear-gradient(135deg, #0a0a0a, #404040)',
            }}
          />
          <span style={{ fontSize: 11, fontWeight: 600, color: '#0a0a0a', letterSpacing: '-0.02em' }}>
            acme
          </span>
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          {['Pricing', 'Docs', 'Log in'].map((link) => (
            <span key={link} style={{ fontSize: 10, color: '#737373', fontWeight: 500 }}>
              {link}
            </span>
          ))}
        </div>
      </div>

      {/* Eyebrow pill */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          top: 60,
          padding: '3px 9px',
          borderRadius: 999,
          border: '0.5px solid rgba(0,0,0,0.08)',
          background: '#fafafa',
          fontSize: 9,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          color: '#737373',
        }}
      >
        Beta · Launching soon
      </div>

      {/* Headline */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 88,
          textAlign: 'center',
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: '-0.03em',
          color: '#0a0a0a',
          lineHeight: 1.1,
        }}
      >
        Build faster than ever.
      </div>

      {/* Subtext */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 120,
          textAlign: 'center',
          fontSize: 11,
          color: '#737373',
          lineHeight: 1.5,
          padding: '0 40px',
        }}
      >
        A streamlined workspace for shipping your next product.
      </div>

      {/* The CTA button — what the cursor will select */}
      <button
        disabled
        style={{
          position: 'absolute',
          left: BUTTON.left,
          top: BUTTON.top,
          width: BUTTON.width,
          height: BUTTON.height,
          borderRadius: applied ? 999 : 8,
          background: applied
            ? 'linear-gradient(135deg, #7c3aed, #5b21b6)'
            : '#ffffff',
          color: applied ? '#ffffff' : '#0a0a0a',
          border: applied ? 'none' : '1px solid rgba(0,0,0,0.12)',
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          transition:
            'background 500ms ease, color 500ms ease, border-radius 500ms ease, border 500ms ease, box-shadow 500ms ease',
          boxShadow: applied ? '0 10px 24px rgba(124,58,237,0.35)' : 'none',
          cursor: 'default',
        }}
      >
        Sign up
      </button>

      {/* Secondary link */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: BUTTON.top + BUTTON.height + 10,
          textAlign: 'center',
          fontSize: 10,
          color: '#a3a3a3',
        }}
      >
        No credit card required
      </div>

      {/* Feature strip (bottom) */}
      <div
        style={{
          position: 'absolute',
          left: 24,
          right: 24,
          bottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        {['Fast by default', 'Zero config', 'Open source'].map((label) => (
          <div
            key={label}
            style={{
              flex: 1,
              padding: '7px 10px',
              borderRadius: 8,
              border: '0.5px solid rgba(0,0,0,0.06)',
              background: '#ffffff',
              fontSize: 10,
              color: '#525252',
              fontWeight: 500,
              textAlign: 'center',
            }}
          >
            {label}
          </div>
        ))}
      </div>
    </>
  )
}

export default function StitchShowcase() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [typed, setTyped] = useState('')

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    let typeInterval: ReturnType<typeof setInterval> | null = null

    function cycle() {
      setPhase('idle')
      setTyped('')

      timers.push(setTimeout(() => setPhase('move'), 600))
      timers.push(setTimeout(() => setPhase('drag'), 1700))
      timers.push(setTimeout(() => setPhase('selected'), 2800))
      timers.push(setTimeout(() => setPhase('type'), 3300))

      timers.push(
        setTimeout(() => {
          let i = 0
          typeInterval = setInterval(() => {
            i += 1
            setTyped(PROMPT.slice(0, i))
            if (i >= PROMPT.length && typeInterval) {
              clearInterval(typeInterval)
              typeInterval = null
            }
          }, 55)
        }, 3500),
      )

      // Typing lasts ~1700ms (31 chars × 55ms), finishes around 5200ms
      // Cursor then travels to the Apply button (1000ms transition)
      timers.push(setTimeout(() => setPhase('reach'), 5600))
      // Cursor has arrived → button press animation
      timers.push(setTimeout(() => setPhase('press'), 6600))
      // Press completes → change applied
      timers.push(setTimeout(() => setPhase('applied'), 6900))
      // Hold, then loop
      timers.push(setTimeout(cycle, 9800))
    }

    cycle()

    return () => {
      timers.forEach(clearTimeout)
      if (typeInterval) clearInterval(typeInterval)
    }
  }, [])

  const c = cursorForPhase(phase)
  const r = rectForPhase(phase)
  const showPrompt =
    phase === 'type' || phase === 'reach' || phase === 'press' || phase === 'applied'
  const showHandles =
    phase === 'selected' || phase === 'type' || phase === 'reach' || phase === 'press'
  const applied = phase === 'applied'
  const pressing = phase === 'press'

  return (
    <section
      id="stitch"
      style={{
        paddingTop: 96,
        paddingBottom: 112,
        borderTop: '0.5px solid rgba(0,0,0,0.07)',
        background: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Geist", sans-serif',
      }}
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        {/* Section header */}
        <div className="mb-14 text-center">
          <div className="mb-5 inline-flex items-center rounded-full border border-black/[0.06] bg-neutral-50 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-neutral-500">
            Edit Lab
          </div>
          <h2 className="text-[clamp(32px,4.4vw,52px)] font-semibold leading-[1.05] tracking-[-0.045em] text-neutral-950">
            Point. Prompt. Done.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-7 text-neutral-500">
            Drag a selection over any element, describe the change in plain English, and Reform rewrites the code in place — an approach inspired by Google Stitch.
          </p>
        </div>

        {/* Animated demo card */}
        <div className="mx-auto max-w-3xl overflow-hidden rounded-[20px] border border-black/[0.08] bg-white shadow-[0_6px_40px_rgba(0,0,0,0.04)]">
          {/* Browser chrome */}
          <div className="flex items-center gap-2 border-b border-black/[0.06] bg-neutral-50 px-4 py-2.5">
            <span className="flex gap-1.5">
              <span className="h-[9px] w-[9px] rounded-full bg-[#ff5f57]" />
              <span className="h-[9px] w-[9px] rounded-full bg-[#febc2e]" />
              <span className="h-[9px] w-[9px] rounded-full bg-[#28c840]" />
            </span>
            <span className="mx-auto font-mono text-[10px] text-neutral-400">acme.com</span>
            <span className="w-[40px]" />
          </div>

          {/* Canvas */}
          <div
            className="relative mx-auto"
            style={{
              width: CANVAS.width,
              height: CANVAS.height,
              maxWidth: '100%',
              background: '#fafafa',
              overflow: 'hidden',
            }}
          >
            {/* The dummy page being edited */}
            <DummyPageContent applied={applied} />

            {/* Selection rectangle */}
            <div
              style={{
                position: 'absolute',
                left: RECT.left,
                top: RECT.top,
                width: r.width,
                height: r.height,
                border: r.dashed ? '1px dashed #7c3aed' : '1.5px solid #7c3aed',
                background: 'rgba(124,58,237,0.08)',
                borderRadius: 3,
                opacity: r.opacity,
                transition:
                  'width 1000ms cubic-bezier(0.4,0,0.2,1), height 1000ms cubic-bezier(0.4,0,0.2,1), opacity 400ms ease, border 300ms ease',
                pointerEvents: 'none',
              }}
            />

            {/* Selection handles */}
            {showHandles &&
              [
                { x: RECT.left, y: RECT.top },
                { x: RECT.left + RECT.width, y: RECT.top },
                { x: RECT.left, y: RECT.top + RECT.height },
                { x: RECT.left + RECT.width, y: RECT.top + RECT.height },
              ].map((pt, i) => (
                <span
                  key={i}
                  style={{
                    position: 'absolute',
                    left: pt.x - 4,
                    top: pt.y - 4,
                    width: 8,
                    height: 8,
                    background: '#ffffff',
                    border: '1.5px solid #7c3aed',
                    borderRadius: 2,
                    pointerEvents: 'none',
                  }}
                />
              ))}

            {/* Prompt input */}
            <div
              style={{
                position: 'absolute',
                left: PROMPT_BOX.left,
                top: PROMPT_BOX.top,
                width: PROMPT_BOX.width,
                height: PROMPT_BOX.height,
                opacity: showPrompt ? 1 : 0,
                transform: showPrompt ? 'translateY(0)' : 'translateY(-6px)',
                transition: 'opacity 250ms ease, transform 250ms ease',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: '#ffffff',
                border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: 10,
                padding: '0 6px 0 12px',
                boxShadow: '0 10px 28px rgba(0,0,0,0.08)',
                pointerEvents: 'none',
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: '#0a0a0a',
                  fontFamily: 'monospace',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
              >
                {typed}
                {phase === 'type' && typed.length < PROMPT.length && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: 1.5,
                      height: 12,
                      background: '#0a0a0a',
                      marginLeft: 1,
                      verticalAlign: 'middle',
                      animation: 'stitchBlink 0.9s step-end infinite',
                    }}
                  />
                )}
              </span>
              <span
                style={{
                  marginLeft: 'auto',
                  padding: '6px 12px',
                  borderRadius: 7,
                  background: '#0a0a0a',
                  color: '#ffffff',
                  fontSize: 11,
                  fontWeight: 600,
                  border: 'none',
                  transform: pressing ? 'scale(0.9)' : 'scale(1)',
                  boxShadow: pressing
                    ? '0 1px 2px rgba(0,0,0,0.2) inset'
                    : '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'transform 140ms ease, box-shadow 140ms ease',
                }}
              >
                Apply
              </span>
            </div>

            {/* Cursor */}
            <div
              style={{
                position: 'absolute',
                left: c.x,
                top: c.y,
                opacity: c.opacity,
                transition:
                  'left 1000ms cubic-bezier(0.4,0,0.2,1), top 1000ms cubic-bezier(0.4,0,0.2,1), opacity 300ms ease',
                pointerEvents: 'none',
                zIndex: 20,
              }}
            >
              <CursorArrow />
            </div>
          </div>
        </div>

        {/* Step pills */}
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {[
            { step: '01', label: 'Select' },
            { step: '02', label: 'Describe' },
            { step: '03', label: 'Apply' },
          ].map((s) => (
            <div
              key={s.step}
              className="flex items-center gap-2 rounded-full border border-black/[0.06] bg-neutral-50 px-3 py-1.5"
            >
              <span className="font-mono text-[10px] text-neutral-400">{s.step}</span>
              <span className="text-[11px] font-medium text-neutral-700">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes stitchBlink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </section>
  )
}
