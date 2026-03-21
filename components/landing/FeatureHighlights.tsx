'use client'

import { useEffect, useRef, useState } from 'react'

export default function FeatureHighlights() {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      {/* CTA banner */}
      <section ref={ref} className="pt-16 pb-32">
        <div
          className="max-w-3xl mx-auto px-6 text-center"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(32px)',
            transition: 'opacity 0.7s ease, transform 0.7s ease',
          }}
        >
          <h2
            className="font-bold tracking-tight mb-4"
            style={{ fontSize: 'clamp(28px, 4vw, 48px)', color: '#ffffff' }}
          >
            Ready to reform?
          </h2>
          <p className="mb-10" style={{ fontSize: '16px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.7 }}>
            Paste a GitHub repo URL. Choose a preset. See the difference.
            <br />No account required.
          </p>
          <a
            href="/new"
            className="px-8 py-3 rounded-lg text-white font-semibold text-sm transition-opacity hover:opacity-90"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              boxShadow: '0 0 40px rgba(124,58,237,0.4)',
            }}
          >
            Get Started →
          </a>
        </div>
      </section>
    </>
  )
}
