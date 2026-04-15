'use client'

import { useEffect, useRef, useState } from 'react'

// ─── Data ─────────────────────────────────────────────────────────────────────

const SECTIONS = [
  {
    tag: 'Analyze',
    headline: 'Connect your repo, we handle the rest',
    body: 'Paste any public GitHub URL. Reform scans the frontend components, detects spacing inconsistencies, poor hierarchy, and mixed design patterns — automatically, without any config.',
    detail: 'No Figma. No design system. Just a URL.',
    visual: <AnalyzeVisual />,
  },
  {
    tag: 'Compare',
    headline: 'Same task, better path.',
    body: 'Not just a visual diff — Reform shows how user flows improve. See the old journey vs the new one side-by-side. Stakeholders immediately understand the impact.',
    detail: 'Fewer clicks · Clearer paths · Better conversions',
    visual: <CompareVisual />,
  },
  {
    tag: 'Export',
    headline: 'Production-ready code, not mockups.',
    body: 'Get React + Tailwind CSS components that drop straight into your codebase. The logic stays untouched — only the presentation layer is upgraded. Ship the fix, not the redesign spec.',
    detail: 'React · Tailwind CSS · TypeScript',
    visual: <ExportVisual />,
  },
]

// ─── Visuals ──────────────────────────────────────────────────────────────────

function AnalyzeVisual() {
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
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f57' }} />
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#febc2e' }} />
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#28c840' }} />
        </div>
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#bbb' }}>reform — scanner</span>
        <div style={{ width: 40 }} />
      </div>
      <div style={{ padding: 20, fontFamily: 'monospace', fontSize: 11, lineHeight: 2 }}>
        <div><span style={{ color: '#888' }}>$</span> <span style={{ color: '#0a0a0a' }}>reform scan github.com/acme/dashboard</span></div>
        <div style={{ color: '#aaa' }}>↳ Cloning repository...</div>
        <div style={{ color: '#aaa' }}>↳ Scanning 47 components...</div>
        <div style={{ color: '#d97706' }}>⚠ 12 spacing violations</div>
        <div style={{ color: '#d97706' }}>⚠ 5 inconsistent border-radius values</div>
        <div style={{ color: '#d97706' }}>⚠ Mixed color system detected</div>
        <div style={{ color: '#16a34a', paddingTop: 4 }}>✓ Analysis complete — 19 issues found</div>
      </div>
    </div>
  )
}

function CompareVisual() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {[
        {
          label: 'Before', accent: false,
          steps: ['Open menu', 'Find settings', 'Scroll to option', 'Confirm'],
        },
        {
          label: 'After', accent: true,
          steps: ['One click'],
        },
      ].map(({ label, accent, steps }) => (
        <div key={label}>
          <div style={{
            fontSize: 9, fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.1em', color: accent ? '#0a0a0a' : '#aaa',
            marginBottom: 8,
          }}>
            {label}
          </div>
          <div style={{
            borderRadius: 12, overflow: 'hidden',
            border: accent ? '0.5px solid rgba(0,0,0,0.16)' : '0.5px solid rgba(0,0,0,0.07)',
            background: '#fff', padding: 12,
          }}>
            {steps.map((step, i) => (
              <div key={step} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 9px', borderRadius: 7, marginBottom: 5,
                background: i === steps.length - 1 ? '#f5f5f5' : '#fff',
                border: '0.5px solid rgba(0,0,0,0.07)',
                fontSize: 11, color: '#555',
              }}>
                <div style={{
                  width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                  background: accent ? '#34c759' : '#ddd',
                }} />
                {step}
                <span style={{ fontSize: 9, color: '#ccc', marginLeft: 'auto' }}>{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

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
            <span style={{ color: 'rgba(10,10,10,0.28)' }}>in three steps.</span>
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