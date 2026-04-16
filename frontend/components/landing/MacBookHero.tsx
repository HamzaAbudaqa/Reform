'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import gsap from 'gsap'
import { BILLING_ENABLED } from '@/lib/billing'

const FONT = '-apple-system, BlinkMacSystemFont, "Geist", sans-serif'

/* ─── Before UI ───────────────────────────────────────────────────────────── */
function DashboardBefore() {
  return (
    <div style={{ width: '100%', height: '100%', background: '#f0f2f5', fontFamily: 'Georgia, serif', overflow: 'hidden' }}>
      <div style={{ background: 'linear-gradient(90deg, #1e3a5f, #2d5a8e)', padding: '0 16px', height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ color: '#fff', fontWeight: 900, fontSize: 15, fontFamily: 'Impact, sans-serif', letterSpacing: 2 }}>ACME CORP</span>
          {['Dashboard', 'Analytics', 'Users', 'Settings', 'Help Center'].map((l, i) => (
            <span key={l} style={{ color: i === 0 ? '#fbbf24' : 'rgba(255,255,255,0.6)', fontSize: i === 0 ? 12 : 11, fontWeight: i === 0 ? 700 : 400, textDecoration: i === 0 ? 'underline' : 'none', fontFamily: 'Arial, sans-serif' }}>{l}</span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          <div style={{ background: '#f59e0b', color: '#000', fontSize: 9, padding: '4px 9px', borderRadius: 2, fontWeight: 900, fontFamily: 'Arial Black, sans-serif', textTransform: 'uppercase', boxShadow: '2px 2px 0 #d97706' }}>⚡ UPGRADE</div>
          <div style={{ background: '#dc2626', color: '#fff', fontSize: 9, padding: '4px 7px', borderRadius: 2, fontWeight: 700 }}>🔔 3</div>
          <div style={{ width: 28, height: 28, borderRadius: 4, background: '#374151', border: '2px solid #fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 10, color: '#fbbf24', fontWeight: 900 }}>AK</span>
          </div>
        </div>
      </div>
      <div style={{ background: '#fff', padding: '7px 14px', borderBottom: '3px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#111', fontFamily: 'Georgia, serif' }}>Dashboard Overview</div>
          <div style={{ fontSize: 8, color: '#9ca3af', fontFamily: 'Courier New, monospace' }}>Last updated: just now | UTC+0</div>
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          <div style={{ border: '2px solid #2563eb', borderRadius: 2, padding: '3px 9px', fontSize: 9, color: '#2563eb', fontWeight: 700, background: '#eff6ff' }}>📊 EXPORT DATA</div>
          <div style={{ border: '1px solid #d1d5db', borderRadius: 20, padding: '3px 9px', fontSize: 9, color: '#374151', background: '#f9fafb' }}>▾ Last 30 days</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 5, padding: '7px 12px' }}>
        <div style={{ flex: 1.2, background: 'linear-gradient(135deg, #1e3a5f, #2563eb)', borderRadius: 12, padding: '9px 11px', color: '#fff', boxShadow: '0 4px 12px rgba(37,99,235,0.4)' }}>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 3, fontFamily: 'Arial, sans-serif' }}>TOTAL REVENUE</div>
          <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'Georgia, serif' }}>$24,521</div>
          <div style={{ fontSize: 8, color: '#86efac', marginTop: 2 }}>▲ +12% vs last month</div>
        </div>
        <div style={{ flex: 1, background: '#fffbeb', border: '2px dashed #f59e0b', borderRadius: 4, padding: '9px 11px' }}>
          <div style={{ fontSize: 8, color: '#92400e', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3, fontFamily: 'Courier New, monospace' }}>Active Users</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#78350f' }}>1,204</div>
          <div style={{ fontSize: 7, color: '#a16207', marginTop: 2 }}>+48 new this week</div>
        </div>
        <div style={{ flex: 1, background: '#f0fdf4', borderLeft: '4px solid #16a34a', borderTop: '1px solid #86efac', borderRight: '1px solid #86efac', borderBottom: '1px solid #86efac', padding: '9px 11px' }}>
          <div style={{ fontSize: 7, color: '#166534', fontFamily: 'Arial, sans-serif', marginBottom: 4 }}>Conversion Rate</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#15803d', fontFamily: 'Impact, sans-serif' }}>3.2%</div>
          <div style={{ fontSize: 7, color: '#16a34a' }}>↑ UP from 2.8%</div>
        </div>
        <div style={{ flex: 1, background: '#fff', border: '1px solid #fecaca', borderRadius: 8, padding: '9px 11px', boxShadow: 'inset 0 0 0 3px #fef2f2' }}>
          <div style={{ fontSize: 7, color: '#991b1b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>bounce rate</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#dc2626' }}>42%</div>
          <div style={{ fontSize: 7, color: '#b91c1c', marginTop: 2 }}>▼ down 3pts</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.9fr 1fr', gap: 5, padding: '0 12px', marginBottom: 5 }}>
        <div style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, padding: '9px 11px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 900, color: '#111', fontFamily: 'Georgia, serif' }}>Monthly Revenue Overview</div>
              <div style={{ fontSize: 7, color: '#9ca3af', fontFamily: 'monospace' }}>FY 2025 — All regions</div>
            </div>
            <div style={{ display: 'flex', gap: 2 }}>
              {['1W','1M','3M','1Y'].map(p => (
                <span key={p} style={{ fontSize: 7, padding: '2px 5px', background: p === '1M' ? '#1e3a5f' : '#f3f4f6', color: p === '1M' ? '#fbbf24' : '#6b7280', borderRadius: p === '1M' ? 0 : 8, fontWeight: p === '1M' ? 700 : 400, border: p === '1M' ? '1px solid #fbbf24' : 'none' }}>{p}</span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 52 }}>
            {[38,52,45,68,55,72,48,63,58,77,65,82].map((h, i) => (
              <div key={i} style={{ flex: 1, height: `${h}%`, background: i === 11 ? '#1e3a5f' : i % 3 === 0 ? '#bfdbfe' : '#dbeafe', borderRadius: '2px 2px 0 0', border: i === 11 ? '1px solid #2563eb' : 'none' }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
            {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map(m => (
              <span key={m} style={{ fontSize: 6, color: '#9ca3af', fontFamily: 'monospace' }}>{m}</span>
            ))}
          </div>
        </div>
        <div style={{ background: '#1e293b', borderRadius: 10, padding: '9px 11px' }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 7, fontFamily: 'monospace' }}>// ACTIVITY LOG</div>
          {[
            { text: 'signup: john@acme.com', time: '2m', dot: '#4ade80' },
            { text: 'ERR: payment failed', time: '5m', dot: '#f87171' },
            { text: 'export by alice', time: '12m', dot: '#60a5fa' },
            { text: 'upgrade: Pro plan', time: '1h', dot: '#fbbf24' },
            { text: 'WARN: api rate limit', time: '2h', dot: '#f87171' },
          ].map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6, paddingBottom: 6, borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: a.dot, flexShrink: 0, boxShadow: `0 0 4px ${a.dot}` }} />
              <span style={{ fontSize: 8, color: '#94a3b8', flex: 1, fontFamily: 'monospace' }}>{a.text}</span>
              <span style={{ fontSize: 7, color: '#475569' }}>{a.time}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ margin: '0 12px', background: '#fff', border: '2px solid #cbd5e0', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(90deg, #1e3a5f, #1e40af)', padding: '5px 11px', display: 'flex' }}>
          {['Customer','Email','Plan','MRR','Status','Action'].map((h, i) => (
            <span key={h} style={{ fontSize: 8, fontWeight: 700, color: '#fbbf24', flex: i === 1 ? 2 : 1, textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'Arial Black, sans-serif' }}>{h}</span>
          ))}
        </div>
        {[['Alice Chen','alice@corp.com','Enterprise','$1,200','Active'],['Bob Smith','bob@startup.io','Pro','$49','Trialing'],['Carol W.','carol@co.com','Free','$0','Inactive']].map((row, i) => (
          <div key={i} style={{ display: 'flex', padding: '5px 11px', borderBottom: i < 2 ? '1px solid #f0f0f0' : 'none', alignItems: 'center', background: i % 2 === 1 ? '#f8fafc' : '#fff' }}>
            {row.map((cell, j) => (
              <span key={j} style={{ fontSize: 8.5, color: j === 4 ? (cell === 'Active' ? '#16a34a' : cell === 'Trialing' ? '#d97706' : '#9ca3af') : '#374151', flex: j === 1 ? 2 : 1, fontFamily: j === 1 ? 'monospace' : 'inherit' }}>{cell}</span>
            ))}
            <span style={{ flex: 1, fontSize: 8, color: '#2563eb', textDecoration: 'underline', cursor: 'pointer' }}>Manage →</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── After UI ────────────────────────────────────────────────────────────── */
function DashboardAfter() {
  return (
    <div style={{ width: '100%', height: '100%', background: '#ffffff', fontFamily: FONT, overflow: 'hidden' }}>
      <div style={{ padding: '0 24px', height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '0.5px solid rgba(0,0,0,0.07)' }}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <span style={{ color: '#0a0a0a', fontWeight: 700, fontSize: 13, letterSpacing: '-0.03em' }}>Acme</span>
          {['Dashboard', 'Analytics', 'Users', 'Settings'].map((l, i) => (
            <span key={l} style={{ color: i === 0 ? '#0a0a0a' : '#aaa', fontSize: 11, fontWeight: i === 0 ? 500 : 400 }}>{l}</span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ background: '#0a0a0a', color: '#fff', fontSize: 9, padding: '4px 12px', borderRadius: 100, fontWeight: 500 }}>Upgrade</div>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#f0f0f0', border: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 9, color: '#888', fontWeight: 600 }}>AK</span>
          </div>
        </div>
      </div>
      <div style={{ padding: '9px 24px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0a', letterSpacing: '-0.02em' }}>Overview</span>
        <div style={{ display: 'flex', gap: 5 }}>
          {['Export', 'Last 30 days ▾'].map(l => (
            <div key={l} style={{ border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 100, padding: '3px 9px', fontSize: 9, color: '#888' }}>{l}</div>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, padding: '0 24px', marginBottom: 7 }}>
        {[
          { label: 'Revenue', val: '$24,521', change: '+12% vs last month' },
          { label: 'Active users', val: '1,204', change: '+48 this week' },
          { label: 'Conversion', val: '3.2%', change: 'Up from 2.8%' },
          { label: 'Bounce rate', val: '42%', change: 'Down 3 pts' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fafafa', border: '0.5px solid rgba(0,0,0,0.07)', borderRadius: 10, padding: '9px 11px' }}>
            <div style={{ fontSize: 8, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#0a0a0a', letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 3 }}>{s.val}</div>
            <div style={{ fontSize: 8, color: '#bbb' }}>{s.change}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.9fr 1fr', gap: 6, padding: '0 24px', marginBottom: 7 }}>
        <div style={{ background: '#fafafa', border: '0.5px solid rgba(0,0,0,0.07)', borderRadius: 10, padding: 11 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#0a0a0a', letterSpacing: '-0.02em' }}>Monthly Revenue</span>
            <div style={{ display: 'flex', gap: 2 }}>
              {['1W','1M','3M','1Y'].map(p => (
                <span key={p} style={{ fontSize: 7, padding: '2px 5px', background: p === '1M' ? '#0a0a0a' : 'transparent', color: p === '1M' ? '#fff' : '#bbb', borderRadius: 100, border: p !== '1M' ? '0.5px solid rgba(0,0,0,0.1)' : 'none' }}>{p}</span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 52 }}>
            {[38,52,45,68,55,72,48,63,58,77,65,82].map((h,i) => (
              <div key={i} style={{ flex: 1, height: `${h}%`, background: i === 11 ? '#0a0a0a' : 'rgba(0,0,0,0.07)', borderRadius: '2px 2px 0 0' }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
            {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map(m => (
              <span key={m} style={{ fontSize: 6, color: '#ccc' }}>{m}</span>
            ))}
          </div>
        </div>
        <div style={{ background: '#fafafa', border: '0.5px solid rgba(0,0,0,0.07)', borderRadius: 10, padding: 11 }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: '#0a0a0a', letterSpacing: '-0.01em', marginBottom: 9 }}>Recent activity</div>
          {[
            { text: 'New signup: john@acme.com', time: '2m', dot: '#34c759' },
            { text: 'Payment failed — retry', time: '5m', dot: '#ff3b30' },
            { text: 'Report exported by Alice', time: '12m', dot: '#007aff' },
            { text: 'User upgraded to Pro', time: '1h', dot: '#ff9500' },
            { text: 'API rate limit reached', time: '2h', dot: '#ff3b30' },
          ].map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: a.dot, flexShrink: 0 }} />
              <span style={{ fontSize: 8, color: '#555', flex: 1 }}>{a.text}</span>
              <span style={{ fontSize: 7, color: '#ccc' }}>{a.time}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ margin: '0 24px', background: '#fafafa', border: '0.5px solid rgba(0,0,0,0.07)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '6px 11px', borderBottom: '0.5px solid rgba(0,0,0,0.07)', display: 'flex' }}>
          {['Customer','Email','Plan','MRR','Status',''].map((h, i) => (
            <span key={i} style={{ fontSize: 7, fontWeight: 500, color: '#bbb', flex: i === 1 ? 2 : 1, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</span>
          ))}
        </div>
        {[['Alice Chen','alice@corp.com','Enterprise','$1,200','Active'],['Bob Smith','bob@startup.io','Pro','$49','Trialing'],['Carol W.','carol@co.com','Free','$0','Inactive']].map((row, i) => (
          <div key={i} style={{ display: 'flex', padding: '6px 11px', borderBottom: i < 2 ? '0.5px solid rgba(0,0,0,0.05)' : 'none', alignItems: 'center' }}>
            {row.map((cell, j) => (
              <span key={j} style={{ fontSize: 8.5, color: j === 4 ? (cell === 'Active' ? '#16a34a' : cell === 'Trialing' ? '#d97706' : '#aaa') : '#555', flex: j === 1 ? 2 : 1 }}>{cell}</span>
            ))}
            <span style={{ flex: 1, fontSize: 8, color: '#bbb', cursor: 'pointer' }}>Manage →</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Main ────────────────────────────────────────────────────────────────── */
export default function ProductHero() {
  const frameRef = useRef<HTMLDivElement>(null)
  const afterRef = useRef<HTMLDivElement>(null)
  const dividerRef = useRef<HTMLDivElement>(null)
  const blurOverlayRef = useRef<HTMLDivElement>(null)

  // We drive the wipe via a plain object so GSAP can tween a numeric value
  const wipeState = useRef({ pct: 0 })

  useEffect(() => {
    // Start: after fully hidden (clip to 0 width), divider at left edge
    gsap.set(afterRef.current, { clipPath: 'inset(0 100% 0 0)' })
    gsap.set(dividerRef.current, { left: '0%', opacity: 0 })
    gsap.set(blurOverlayRef.current, { opacity: 0 })

    const tl = gsap.timeline({ defaults: { ease: 'power3.inOut' }, delay: 0.7 })

    // Frame enters
    tl.fromTo(frameRef.current,
      { opacity: 0, y: 20, scale: 0.985 },
      { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: 'power3.out' }
    )

    // Pause — user reads the ugly Before
    tl.to({}, { duration: 1.0 })

    // Blur builds over Before
    tl.to(blurOverlayRef.current, { opacity: 1, duration: 0.5, ease: 'power2.in' })
    tl.to({}, { duration: 0.15 })

    // Divider line appears at left
    tl.to(dividerRef.current, { opacity: 1, duration: 0.15 }, '-=0.1')

    // Wipe: clip-path and divider sweep together left → right
    tl.to(wipeState.current, {
      pct: 100,
      duration: 1.4,
      ease: 'power2.inOut',
      onUpdate: () => {
        const p = wipeState.current.pct
        const remaining = 100 - p
        if (afterRef.current) {
          afterRef.current.style.clipPath = `inset(0 ${remaining}% 0 0)`
        }
        if (dividerRef.current) {
          dividerRef.current.style.left = `${p}%`
        }
      },
    })

    // Blur + divider fade out as wipe completes
    tl.to(blurOverlayRef.current, { opacity: 0, duration: 0.45, ease: 'power2.out' }, '-=0.5')
    tl.to(dividerRef.current, { opacity: 0, duration: 0.3 }, '-=0.35')

  }, [])

  return (
    <section style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#ffffff',
      fontFamily: FONT,
      padding: '80px 24px 72px',
    }}>
      <div style={{ width: '100%', maxWidth: 1100 }}>

        {/* Headline */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontSize: 'clamp(30px, 4.8vw, 58px)', fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1.05, color: '#0a0a0a', margin: '0 0 14px' }}>
            Upgrade the interface.
            <br />
            <span style={{ color: 'rgba(10,10,10,0.28)' }}>Keep the behavior.</span>
          </h1>
          <p style={{ fontSize: 'clamp(14px, 1.4vw, 16px)', color: '#6b6b6b', lineHeight: 1.65, margin: '0 auto', maxWidth: 500 }}>
            Reform turns inconsistent frontend surfaces into clear, production-grade UI while preserving the logic your team depends on.
          </p>
        </div>

        {/* Browser frame */}
        <div
          ref={frameRef}
          style={{ width: 'min(920px, 92vw)', margin: '0 auto', borderRadius: 14, overflow: 'hidden', border: '0.5px solid rgba(0,0,0,0.1)', background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.08)', opacity: 0 }}
        >
          {/* Chrome */}
          <div style={{ height: 36, background: '#f5f5f5', borderBottom: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', padding: '0 14px', gap: 8 }}>
            <div style={{ display: 'flex', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
            </div>
            <div style={{ flex: 1, maxWidth: 300, margin: '0 auto', background: '#ebebeb', borderRadius: 6, height: 22, display: 'flex', alignItems: 'center', padding: '0 10px' }}>
              <span style={{ fontSize: 10, color: '#bbb', fontFamily: 'monospace' }}>app.acme.com/dashboard</span>
            </div>
          </div>

          {/* Screen */}
          <div style={{ position: 'relative', aspectRatio: '16/9', overflow: 'hidden' }}>

            {/* Before — always underneath */}
            <div style={{ position: 'absolute', inset: 0 }}>
              <DashboardBefore />
            </div>

            {/* Blur overlay sits above Before, below After */}
            <div
              ref={blurOverlayRef}
              style={{
                position: 'absolute', inset: 0, zIndex: 2,
                backdropFilter: 'blur(10px) brightness(1.06)',
                WebkitBackdropFilter: 'blur(10px) brightness(1.06)',
                background: 'rgba(255,255,255,0.38)',
                pointerEvents: 'none',
              }}
            />

            {/* Divider line — moves with the wipe */}
            <div
              ref={dividerRef}
              style={{
                position: 'absolute', top: 0, bottom: 0,
                left: '0%', width: 2, zIndex: 20,
                background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.2) 15%, rgba(0,0,0,0.15) 85%, transparent 100%)',
                pointerEvents: 'none',
                // Glow halo around the line
                boxShadow: '0 0 8px 2px rgba(255,255,255,0.7), 0 0 2px rgba(0,0,0,0.12)',
              }}
            />

            {/* After — revealed by clip-path wipe, sits on top */}
            <div
              ref={afterRef}
              style={{
                position: 'absolute', inset: 0, zIndex: 10,
                clipPath: 'inset(0 100% 0 0)',
              }}
            >
              <DashboardAfter />
            </div>

          </div>
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 28, gap: 10 }}>
          <Link href="/new" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 500, color: '#fff', background: '#0a0a0a', textDecoration: 'none', borderRadius: 100, padding: '10px 22px' }}>
            Start redesign
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6h7M7 3.5 9.5 6 7 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          {BILLING_ENABLED && (
            <Link href="/subscription" style={{ display: 'inline-flex', alignItems: 'center', fontSize: 14, fontWeight: 500, color: '#0a0a0a', textDecoration: 'none', border: '0.5px solid rgba(0,0,0,0.16)', borderRadius: 100, padding: '10px 22px' }}>
              View plans
            </Link>
          )}
        </div>

      </div>
    </section>
  )
}