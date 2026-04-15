'use client'

import Link from 'next/link'

const HIGHLIGHTS = [
  {
    title: 'Preserve product behavior',
    body: 'Buttons, forms, navigation, and backend integrations keep working exactly as they do now. Reform focuses on presentation, not product logic.',
  },
  {
    title: 'Create a consistent design system',
    body: 'Normalize spacing, typography, cards, inputs, and shell chrome into one visual language that scales beyond a single screen.',
  },
  {
    title: 'Move from critique to implementation',
    body: 'Analyze competitor interfaces, synthesize direction, and turn that guidance into a production-ready frontend pass.',
  },
]

const OPERATIONAL = [
  ['Scope', 'Frontend redesign only'],
  ['Backend', 'No endpoint or data-flow changes'],
  ['Interaction model', 'Existing handlers preserved'],
  ['Output', 'Original UI with stronger polish and hierarchy'],
]

export default function FeatureHighlights() {
  return (
    <section style={{
      paddingTop: 80, paddingBottom: 120,
      background: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Geist", sans-serif',
    }}>
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 40px' }}>

        {/* Section header */}
        <div style={{ marginBottom: 80 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 100, marginBottom: 20,
            fontSize: 10.5, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.08em',
            background: '#f5f5f5', border: '0.5px solid rgba(0,0,0,0.08)', color: '#888',
          }}>
            Designed for modern product teams
          </div>
          <h2 style={{
            fontSize: 'clamp(28px, 4.5vw, 48px)', fontWeight: 600,
            letterSpacing: '-0.03em', lineHeight: 1.1,
            color: '#0a0a0a', margin: '0 0 18px',
          }}>
            High-end frontend polish
            <br />
            <span style={{ color: 'rgba(10,10,10,0.28)' }}>without a rewrite.</span>
          </h2>
          <p style={{ fontSize: 15, color: '#6b6b6b', lineHeight: 1.8, maxWidth: 480, margin: 0 }}>
            Use Reform when the product already works, but the interface still feels inconsistent,
            dated, or harder to use than it should be.
          </p>
        </div>

        {/* Highlight cards */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 1, background: 'rgba(0,0,0,0.06)',
          borderRadius: 20, overflow: 'hidden',
          marginBottom: 80,
        }}>
          {HIGHLIGHTS.map((h, i) => (
            <div key={h.title} style={{ background: '#fafafa', padding: '32px 28px' }}>
              <div style={{
                fontSize: 11, fontFamily: 'monospace', color: '#ccc',
                marginBottom: 18, letterSpacing: '0.04em',
              }}>
                0{i + 1}
              </div>
              <h3 style={{
                fontSize: 16, fontWeight: 600, color: '#0a0a0a',
                letterSpacing: '-0.02em', margin: '0 0 12px', lineHeight: 1.3,
              }}>
                {h.title}
              </h3>
              <p style={{ fontSize: 13.5, color: '#6b6b6b', lineHeight: 1.75, margin: 0 }}>
                {h.body}
              </p>
            </div>
          ))}
        </div>

        {/* Operational framing + CTA */}
        <div style={{ borderTop: '0.5px solid rgba(0,0,0,0.07)', paddingTop: 72 }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: 80, alignItems: 'start',
          }}>

            {/* Left — table */}
            <div>
              <div style={{
                fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase' as const,
                letterSpacing: '0.08em', color: '#bbb', marginBottom: 24,
              }}>
                Operational framing
              </div>
              <div>
                {OPERATIONAL.map(([label, value]) => (
                  <div key={label} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 24, padding: '14px 0',
                    borderBottom: '0.5px solid rgba(0,0,0,0.07)',
                  }}>
                    <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#bbb' }}>{label}</span>
                    <span style={{ fontSize: 13.5, color: '#555', textAlign: 'right' as const }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — CTA */}
            <div style={{ paddingTop: 36 }}>
              <p style={{
                fontSize: 'clamp(20px, 2.5vw, 26px)', fontWeight: 600,
                color: '#0a0a0a', letterSpacing: '-0.03em', lineHeight: 1.3,
                margin: '0 0 16px',
              }}>
                Make the product feel deliberate, premium, and easier to trust at first glance.
              </p>
              <p style={{
                fontSize: 14, color: '#888', lineHeight: 1.75,
                maxWidth: 380, margin: '0 0 32px',
              }}>
                Start with a GitHub repo. Reform handles the rest — scanning, analysis, and a
                production-ready polish pass.
              </p>
              <Link href="/new" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                fontSize: 14, fontWeight: 500, color: '#fff',
                background: '#0a0a0a', textDecoration: 'none',
                borderRadius: 100, padding: '11px 22px',
              }}>
                Start with a repo
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6h7M7 3.5 9.5 6 7 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>

          </div>
        </div>

      </div>
    </section>
  )
}