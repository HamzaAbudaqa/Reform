'use client'

import { useEffect, useRef, useState } from 'react'

// ─── Data ─────────────────────────────────────────────────────────────────────

const SECTIONS = [
  {
    tag: 'Export',
    headline: 'Production-ready code, not mockups.',
    body: 'Get React + Tailwind CSS components that drop straight into your codebase. The logic stays untouched — only the presentation layer is upgraded. Ship the fix, not the redesign spec.',
    detail: 'React · Tailwind CSS · TypeScript',
    visual: <ExportVisual />,
  },
  {
    tag: 'Ship',
    headline: 'One click to push, straight to your repo.',
    body: 'No copy-paste. No context switching. Reform commits the redesign to a new branch and opens a pull request in your GitHub repo — ready for review, ready to merge.',
    detail: 'New branch · Opened PR · Ready to merge',
    visual: <PushVisual />,
  },
]

// ─── Visuals ──────────────────────────────────────────────────────────────────

function ExportVisual() {
  return (
    <div style={{
      borderRadius: 16, overflow: 'hidden',
      border: '0.5px solid rgba(0,0,0,0.08)',
      background: '#fafafa',
    }}>
      <div style={{
        padding: '10px 16px',
        borderBottom: '0.5px solid rgba(0,0,0,0.07)',
        background: '#f5f5f5',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#888' }}>Dashboard.tsx</span>
        <span style={{
          fontSize: 9, fontWeight: 500, padding: '3px 8px', borderRadius: 6,
          background: 'rgba(22,163,74,0.07)', color: '#16a34a',
          border: '0.5px solid rgba(22,163,74,0.2)',
        }}>
          Exported
        </span>
      </div>
      <div style={{ padding: 20, fontFamily: 'monospace', fontSize: 10.5, lineHeight: 1.9, color: '#aaa' }}>
        <div><span style={{ color: '#7c3aed' }}>export default function</span> <span style={{ color: '#0e7490' }}>Dashboard</span>{'() {'}</div>
        <div style={{ paddingLeft: 16 }}><span style={{ color: '#7c3aed' }}>return</span> {'('}</div>
        <div style={{ paddingLeft: 32 }}>{'<'}<span style={{ color: '#15803d' }}>div</span> <span style={{ color: '#b45309' }}>className</span>=<span style={{ color: '#be185d' }}>&quot;flex gap-6 p-8&quot;</span>{'>'}</div>
        <div style={{ paddingLeft: 48 }}>{'<'}<span style={{ color: '#15803d' }}>Sidebar</span> {'/>'}</div>
        <div style={{ paddingLeft: 48 }}>{'<'}<span style={{ color: '#15803d' }}>MainContent</span> {'/>'}</div>
        <div style={{ paddingLeft: 32 }}>{'</'}<span style={{ color: '#15803d' }}>div</span>{'>'}</div>
        <div style={{ paddingLeft: 16 }}>{')'}</div>
        <div>{'}'}</div>
      </div>
    </div>
  )
}

function PushVisual() {
  return (
    <div style={{
      borderRadius: 16, overflow: 'hidden',
      border: '0.5px solid rgba(0,0,0,0.08)',
      background: '#ffffff',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '0.5px solid rgba(0,0,0,0.07)',
        background: '#fafafa',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="#6e7781">
            <path d="M1.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM0 3.25a1.75 1.75 0 1 1 2.5 1.573v6.354a1.75 1.75 0 1 1-1.5 0V4.823A1.75 1.75 0 0 1 0 3.25zm1.75 10a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm12.5-6.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM12.5 7.5a1.75 1.75 0 1 1 2.5 1.573V11A3.75 3.75 0 0 1 11.25 14.75H9.81a1.75 1.75 0 1 1 0-1.5h1.44a2.25 2.25 0 0 0 2.25-2.25V9.073a1.75 1.75 0 0 1-1-1.573z" />
          </svg>
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#0a0a0a', fontWeight: 500 }}>
            acme/dashboard
          </span>
        </div>
        <span style={{
          fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
          background: 'rgba(22,163,74,0.08)', color: '#16a34a',
          border: '0.5px solid rgba(22,163,74,0.22)',
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          Open
        </span>
      </div>

      {/* PR body */}
      <div style={{ padding: '16px 18px 18px', fontFamily: '-apple-system, BlinkMacSystemFont, "Geist", sans-serif' }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: '#0a0a0a',
          letterSpacing: '-0.01em', marginBottom: 8,
        }}>
          Reform: UI polish pass on /dashboard
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 10.5, fontFamily: 'monospace',
            padding: '2px 7px', borderRadius: 5,
            background: '#f5f5f5', color: '#6b7280',
            border: '0.5px solid rgba(0,0,0,0.06)',
          }}>
            reform/ui-refresh
          </span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
          <span style={{
            fontSize: 10.5, fontFamily: 'monospace',
            padding: '2px 7px', borderRadius: 5,
            background: '#f5f5f5', color: '#6b7280',
            border: '0.5px solid rgba(0,0,0,0.06)',
          }}>
            main
          </span>
        </div>

        <div style={{
          display: 'flex', flexDirection: 'column', gap: 6,
          fontSize: 11, fontFamily: 'monospace', color: '#6b7280',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>7 files changed</span>
            <span style={{ color: '#16a34a' }}>+1,247</span>
            <span style={{ color: '#ef4444' }}>−423</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Checks passed · Ready to merge</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Scroll reveal ─────────────────────────────────────────────────────────────

function ease(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

function ScrollRevealBlock({ children, isLast }: { children: React.ReactNode; isLast: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const progressRef = useRef(0)
  const displayRef = useRef(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const onScroll = () => {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const wh = window.innerHeight
      const revealRaw = (wh * 0.95 - rect.top) / (wh * 0.45)
      const reveal = Math.max(0, Math.min(1, revealRaw))
      let fade = 1
      if (!isLast) {
        const fadeRaw = (rect.bottom - wh * -0.05) / (wh * 0.3)
        fade = Math.max(0, Math.min(1, fadeRaw))
      } else {
        const fadeRaw = (rect.bottom - wh * -0.3) / (wh * 0.2)
        fade = Math.max(0, Math.min(1, fadeRaw))
      }
      progressRef.current = Math.min(reveal, fade)
    }

    const animate = () => {
      displayRef.current += (progressRef.current - displayRef.current) * 0.12
      const p = ease(displayRef.current)
      const el = ref.current
      if (el) {
        el.style.opacity = `${0.08 + p * 0.92}`
        el.style.transform = `translateY(${(1 - p) * 28}px)`
      }
      rafRef.current = requestAnimationFrame(animate)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    rafRef.current = requestAnimationFrame(animate)
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(rafRef.current)
    }
  }, [isLast])

  return (
    <div ref={ref} style={{ willChange: 'opacity, transform' }}>
      {children}
    </div>
  )
}

// ─── Main export ───────────────────────────────────────────────────────────────

export default function HowItWorks() {
  const headerRef = useRef<HTMLDivElement>(null)
  const [headerVisible, setHeaderVisible] = useState(false)

  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setHeaderVisible(true) },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      id="features"
      style={{
        paddingTop: 96, paddingBottom: 112,
        borderTop: '0.5px solid rgba(0,0,0,0.07)',
        background: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Geist", sans-serif',
      }}
    >
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 40px' }}>

        {/* Section header */}
        <div
          ref={headerRef}
          style={{
            textAlign: 'center', marginBottom: 96,
            opacity: headerVisible ? 1 : 0,
            transform: headerVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.8s cubic-bezier(0.16,1,0.3,1), transform 0.8s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          <h2 style={{
            fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 600,
            letterSpacing: '-0.03em', color: '#0a0a0a',
            margin: '0 0 16px', lineHeight: 1.1,
          }}>
            From broken UI to polished product
            <br />
            <span style={{ color: 'rgba(10,10,10,0.28)' }}>in two steps.</span>
          </h2>
          <p style={{
            fontSize: 15, color: '#888', maxWidth: 400,
            margin: '0 auto', lineHeight: 1.75,
          }}>
            No design system required. No Figma handoff.
            Just a GitHub URL and a style choice.
          </p>
        </div>

        {/* Alternating sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 112 }}>
          {SECTIONS.map((section, i) => (
            <ScrollRevealBlock key={i} isLast={i === SECTIONS.length - 1}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 64,
                alignItems: 'center',
              }}>
                {/* Text — swap order on odd rows */}
                <div style={{ order: i % 2 === 1 ? 2 : 1 }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center',
                    padding: '4px 11px', borderRadius: 100, marginBottom: 18,
                    fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em',
                    background: '#f5f5f5', border: '0.5px solid rgba(0,0,0,0.08)', color: '#888',
                  }}>
                    {section.tag}
                  </div>
                  <h3 style={{
                    fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 600,
                    letterSpacing: '-0.02em', color: '#0a0a0a',
                    margin: '0 0 16px', lineHeight: 1.2,
                  }}>
                    {section.headline}
                  </h3>
                  <p style={{
                    fontSize: 15, color: '#6b6b6b',
                    lineHeight: 1.8, margin: '0 0 20px',
                  }}>
                    {section.body}
                  </p>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center',
                    padding: '7px 14px', borderRadius: 10,
                    fontSize: 11, fontFamily: 'monospace', color: '#888',
                    background: '#f5f5f5', border: '0.5px solid rgba(0,0,0,0.08)',
                  }}>
                    {section.detail}
                  </div>
                </div>

                {/* Visual */}
                <div style={{ order: i % 2 === 1 ? 1 : 2 }}>
                  {section.visual}
                </div>
              </div>
            </ScrollRevealBlock>
          ))}
        </div>

      </div>
    </section>
  )
}