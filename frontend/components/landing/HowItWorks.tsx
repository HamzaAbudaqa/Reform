'use client'

import { useEffect, useRef, useState } from 'react'
import FlowDemoCard from '@/components/demo/FlowDemoCard'

const SECTIONS = [
  {
    tag: 'Analyze',
    headline: 'Connect your repo, we handle the rest',
    body: 'Paste any public GitHub URL. Reform scans the frontend components, detects spacing inconsistencies, poor hierarchy, and mixed design patterns — automatically, without any config.',
    detail: 'No Figma. No design system. Just a URL.',
    visual: (
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}
      >
        <div
          className="px-4 py-2.5 border-b flex items-center gap-2"
          style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
        >
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
          </div>
          <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>reform — scanner</span>
        </div>
        <div className="p-4 font-mono text-[11px] space-y-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
          <div><span style={{ color: '#a855f7' }}>$</span> reform scan github.com/acme/dashboard</div>
          <div style={{ color: 'rgba(255,255,255,0.2)' }}>↳ Cloning repository...</div>
          <div style={{ color: 'rgba(255,255,255,0.2)' }}>↳ Scanning 47 components...</div>
          <div style={{ color: '#f59e0b' }}>⚠ 12 spacing violations</div>
          <div style={{ color: '#f59e0b' }}>⚠ 5 inconsistent border-radius values</div>
          <div style={{ color: '#f59e0b' }}>⚠ Mixed color system detected</div>
          <div className="pt-1" style={{ color: '#34d399' }}>✓ Analysis complete — 19 issues found</div>
        </div>
      </div>
    ),
  },
  {
    tag: 'Compare',
    headline: 'Same task, better path.',
    body: 'Not just a visual diff — Reform shows how user flows improve. See the old journey vs the new one side-by-side. Stakeholders immediately understand the impact.',
    detail: 'Fewer clicks · Clearer paths · Better conversions',
    visual: (
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[9px] font-medium uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.2)' }}>Before</div>
          <div className="rounded-lg overflow-hidden relative" style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', height: '180px' }}>
            <FlowDemoCard
              steps={[
                { label: 'Open menu', target: 'sidebar:Integrations', duration: 1000 },
                { label: 'Find settings', target: 'nav:Settings', duration: 900 },
                { label: 'Scroll to option', target: 'card:3', duration: 1100 },
                { label: 'Confirm', target: 'modal:confirm', duration: 1200 },
              ]}
              variant="before"
            />
          </div>
        </div>
        <div>
          <div className="text-[9px] font-medium uppercase tracking-wider mb-2" style={{ color: '#a855f7' }}>After</div>
          <div className="rounded-lg overflow-hidden relative" style={{ border: '1px solid rgba(168,85,247,0.25)', background: 'rgba(124,58,237,0.05)', height: '180px' }}>
            <FlowDemoCard
              steps={[
                { label: 'One click', target: 'cta:deploy', duration: 700 },
              ]}
              variant="after"
            />
          </div>
        </div>
      </div>
    ),
  },
  {
    tag: 'Export',
    headline: 'Production-ready code, not mockups.',
    body: 'Get React + Tailwind CSS components that drop straight into your codebase. The logic stays untouched — only the presentation layer is upgraded. Ship the fix, not the redesign spec.',
    detail: 'React · Tailwind CSS · TypeScript',
    visual: (
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}
      >
        <div
          className="px-4 py-2.5 border-b flex items-center justify-between"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>Dashboard.tsx</span>
          <span
            className="text-[9px] px-2 py-0.5 rounded"
            style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}
          >
            Exported
          </span>
        </div>
        <div className="p-4 font-mono text-[10.5px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
          <div><span style={{ color: '#c084fc' }}>export default function</span> <span style={{ color: '#67e8f9' }}>Dashboard</span>() {'{'}</div>
          <div className="pl-4"><span style={{ color: '#c084fc' }}>return</span> (</div>
          <div className="pl-8">&lt;<span style={{ color: '#86efac' }}>div</span> <span style={{ color: '#fcd34d' }}>className</span>=<span style={{ color: '#f9a8d4' }}>&quot;flex gap-6 p-8&quot;</span>&gt;</div>
          <div className="pl-12">&lt;<span style={{ color: '#86efac' }}>Sidebar</span> /&gt;</div>
          <div className="pl-12">&lt;<span style={{ color: '#86efac' }}>MainContent</span> /&gt;</div>
          <div className="pl-8">&lt;/<span style={{ color: '#86efac' }}>div</span>&gt;</div>
          <div className="pl-4">)</div>
          <div>{'}'}</div>
        </div>
      </div>
    ),
  },
]

// Smooth easeOutCubic for fluid motion
function ease(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

// Each section reveals and fades independently based on scroll position
function ScrollRevealBlock({
  children,
  isLast,
}: {
  children: React.ReactNode
  isLast: boolean
}) {
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

      // Reveal: top enters viewport from 95% → 50%
      const revealRaw = (wh * 0.95 - rect.top) / (wh * 0.45)
      const reveal = Math.max(0, Math.min(1, revealRaw))

      // Fade: bottom approaches top of viewport
      let fade = 1
      if (!isLast) {
        // Non-last: fade when bottom goes from 25% → -5% of viewport
        const fadeRaw = (rect.bottom - wh * -0.05) / (wh * 0.3)
        fade = Math.max(0, Math.min(1, fadeRaw))
      } else {
        // Last: hold much longer, only fade when almost entirely scrolled past
        const fadeRaw = (rect.bottom - wh * -0.3) / (wh * 0.2)
        fade = Math.max(0, Math.min(1, fadeRaw))
      }

      progressRef.current = Math.min(reveal, fade)
    }

    // Smooth interpolation loop — lerps toward target for silky motion
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
      className="pt-32 pb-16"
      style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="max-w-7xl mx-auto px-6">

        {/* Section header */}
        <div
          ref={headerRef}
          className="text-center mb-20"
          style={{
            opacity: headerVisible ? 1 : 0,
            transform: headerVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 1s cubic-bezier(0.16, 1, 0.3, 1), transform 1s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6"
            style={{
              background: 'rgba(124,58,237,0.1)',
              border: '1px solid rgba(124,58,237,0.2)',
              color: '#a855f7',
            }}
          >
            How it works
          </div>
          <h2
            className="font-bold tracking-tight mb-4"
            style={{ fontSize: 'clamp(28px, 4vw, 44px)', color: '#ffffff' }}
          >
            From broken UI to polished product
            <br />
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>in three steps.</span>
          </h2>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.35)', maxWidth: '440px', margin: '0 auto', lineHeight: 1.7 }}>
            No design system required. No Figma handoff.
            Just a GitHub URL and a style choice.
          </p>
        </div>

        {/* Alternating sections */}
        <div className="space-y-28">
          {SECTIONS.map((section, i) => (
            <ScrollRevealBlock key={i} isLast={i === SECTIONS.length - 1}>
              <div
                className={`grid grid-cols-1 md:grid-cols-2 gap-16 items-center ${i % 2 === 1 ? 'md:[&>*:first-child]:order-2' : ''}`}
              >
                <div>
                  <div
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-medium mb-5"
                    style={{
                      background: 'rgba(124,58,237,0.08)',
                      border: '1px solid rgba(124,58,237,0.15)',
                      color: '#a855f7',
                    }}
                  >
                    {section.tag}
                  </div>
                  <h3
                    className="font-bold tracking-tight mb-4 leading-snug"
                    style={{ fontSize: 'clamp(22px, 3vw, 32px)', color: '#ffffff' }}
                  >
                    {section.headline}
                  </h3>
                  <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.75, marginBottom: '20px' }}>
                    {section.body}
                  </p>
                  <div
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px]"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.3)',
                      fontFamily: 'monospace',
                    }}
                  >
                    {section.detail}
                  </div>
                </div>
                <div>{section.visual}</div>
              </div>
            </ScrollRevealBlock>
          ))}
        </div>
      </div>
    </section>
  )
}
