'use client'

import { useEffect, useRef } from 'react'

function ease(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

export default function FeatureHighlights() {
  const sectionRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const bloomRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef(0)
  const displayRef = useRef(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const onScroll = () => {
      const el = sectionRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const wh = window.innerHeight

      // Trigger when section top enters lower 85% of viewport
      // Fully revealed when top reaches 40% of viewport
      const raw = (wh * 0.85 - rect.top) / (wh * 0.45)
      progressRef.current = Math.max(0, Math.min(1, raw))
    }

    const animate = () => {
      // Smooth lerp — slower (0.06) for a gradual "settling" feel
      displayRef.current += (progressRef.current - displayRef.current) * 0.06
      const p = ease(displayRef.current)

      if (contentRef.current) {
        contentRef.current.style.opacity = `${p}`
        contentRef.current.style.transform = `translateY(${(1 - p) * 40}px) scale(${0.96 + p * 0.04})`
      }

      if (bloomRef.current) {
        bloomRef.current.style.opacity = `${p * 0.9}`
        bloomRef.current.style.transform = `translate(-50%, -50%) scale(${0.6 + p * 0.4})`
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
  }, [])

  return (
    <section
      ref={sectionRef}
      className="relative pt-40 pb-32"
      style={{
        background: 'linear-gradient(180deg, transparent 0%, rgba(124,58,237,0.03) 30%, rgba(124,58,237,0.06) 55%, rgba(124,58,237,0.03) 80%, transparent 100%)',
      }}
    >
      {/* Atmospheric bloom — scales in with scroll */}
      <div
        ref={bloomRef}
        className="absolute left-1/2 top-1/2 pointer-events-none"
        style={{
          width: '600px',
          height: '400px',
          background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.14) 0%, rgba(109,40,217,0.05) 40%, transparent 70%)',
          filter: 'blur(50px)',
          opacity: 0,
          willChange: 'opacity, transform',
        }}
      />

      <div
        ref={contentRef}
        className="relative max-w-2xl mx-auto px-6 text-center"
        style={{
          opacity: 0,
          willChange: 'opacity, transform',
        }}
      >
        <h2
          className="font-bold tracking-tight mb-5"
          style={{ fontSize: 'clamp(30px, 4vw, 44px)', color: '#ffffff', letterSpacing: '-0.02em' }}
        >
          Ready to reform?
        </h2>
        <p
          className="mb-12 mx-auto"
          style={{
            fontSize: '16px',
            color: 'rgba(255,255,255,0.35)',
            lineHeight: 1.8,
            maxWidth: '380px',
          }}
        >
          Paste a GitHub repo URL and see the difference instantly.
        </p>
        <a
          href="/new"
          className="inline-block px-8 py-3 rounded-lg text-white font-medium text-sm transition-all duration-300 hover:opacity-90"
          style={{
            background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
            boxShadow: '0 0 30px rgba(124,58,237,0.3)',
          }}
        >
          Get Started →
        </a>
      </div>
    </section>
  )
}
