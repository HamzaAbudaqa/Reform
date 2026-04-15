'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { BILLING_ENABLED } from '@/lib/billing'

gsap.registerPlugin(ScrollTrigger)

const NAV_HEIGHT = 60
const SCROLL_DISTANCE = 3200
const FONT = '-apple-system, BlinkMacSystemFont, "Geist", sans-serif'

const S1 = 0.0
const S2 = 0.22
const S3 = 0.48
const S4 = 0.78

/* ─── Dashboard: Before ───────────────────────────────────────────────────────
   Same data, but with deliberate inconsistencies that feel realistic:
   mixed border radii, inconsistent type scale, uneven spacing, poor hierarchy
   ─────────────────────────────────────────────────────────────────────────── */
function DashboardBefore() {
  return (
    <div style={{ width: '100%', height: '100%', background: '#f8f8f8', fontFamily: FONT, overflow: 'hidden', fontSize: 11 }}>
      {/* Nav — too tall, inconsistent weight */}
      <div style={{ background: '#fff', padding: '0 20px', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #e5e7eb' }}>
        <div style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
          <span style={{ color: '#111', fontWeight: 800, fontSize: 15, letterSpacing: 0 }}>ACME</span>
          {['Dashboard', 'Analytics', 'Users', 'Settings', 'Support'].map((l, i) => (
            <span key={l} style={{ color: i === 0 ? '#2563eb' : '#9ca3af', fontSize: 12, fontWeight: i === 0 ? 600 : 400, borderBottom: i === 0 ? '2px solid #2563eb' : 'none', paddingBottom: i === 0 ? 2 : 0 }}>{l}</span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ background: '#2563eb', color: '#fff', fontSize: 10, padding: '5px 12px', borderRadius: 4, fontWeight: 600 }}>Upgrade Plan</div>
          <div style={{ width: 30, height: 30, borderRadius: 6, background: '#e5e7eb', border: '1px solid #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>AK</span>
          </div>
        </div>
      </div>

      {/* Page title — buried */}
      <div style={{ padding: '10px 20px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>Dashboard Overview</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ border: '1px solid #d1d5db', borderRadius: 4, padding: '4px 10px', fontSize: 10, color: '#6b7280' }}>Export CSV</div>
          <div style={{ border: '1px solid #d1d5db', borderRadius: 4, padding: '4px 10px', fontSize: 10, color: '#6b7280', background: '#f9fafb' }}>Last 30 days ▾</div>
        </div>
      </div>

      {/* Stats row — inconsistent sizes, radii, and color logic */}
      <div style={{ display: 'flex', gap: 8, padding: '0 20px', marginBottom: 10 }}>
        {[
          { label: 'Total Revenue', val: '$24,521', change: '+12%', changeColor: '#16a34a', bg: '#fff', radius: 8, border: '1px solid #e5e7eb' },
          { label: 'ACTIVE USERS', val: '1,204', change: '+48', changeColor: '#2563eb', bg: '#eff6ff', radius: 3, border: '1px solid #bfdbfe' },
          { label: 'Conversion', val: '3.2%', change: '↑ 0.4%', changeColor: '#16a34a', bg: '#fff', radius: 12, border: '2px solid #e5e7eb' },
          { label: 'bounce rate', val: '42%', change: '▼ 3pts', changeColor: '#dc2626', bg: '#fef2f2', radius: 3, border: '1px solid #fecaca' },
        ].map((s) => (
          <div key={s.label} style={{ flex: 1, background: s.bg, border: s.border, borderRadius: s.radius, padding: '10px 12px' }}>
            <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 5, letterSpacing: '0.05em' }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111', lineHeight: 1, marginBottom: 4 }}>{s.val}</div>
            <div style={{ fontSize: 10, color: s.changeColor, fontWeight: 500 }}>{s.change} vs last month</div>
          </div>
        ))}
      </div>

      {/* Two col — unbalanced proportions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.9fr 1fr', gap: 8, padding: '0 20px', marginBottom: 10 }}>
        {/* Chart */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '10px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#111', marginBottom: 2 }}>Monthly Revenue Overview</div>
              <div style={{ fontSize: 9, color: '#9ca3af' }}>Jan 2025 – Dec 2025</div>
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              {['1W','1M','3M','1Y'].map(p => (
                <span key={p} style={{ fontSize: 8, padding: '3px 6px', background: p === '1M' ? '#2563eb' : '#f3f4f6', color: p === '1M' ? '#fff' : '#6b7280', borderRadius: 3, fontWeight: p === '1M' ? 600 : 400 }}>{p}</span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 64 }}>
            {[38,52,45,68,55,72,48,63,58,77,65,82].map((h,i) => (
              <div key={i} style={{ flex: 1, height: `${h}%`, background: i === 11 ? '#2563eb' : '#dbeafe', borderRadius: '2px 2px 0 0' }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map(m => (
              <span key={m} style={{ fontSize: 7, color: '#9ca3af' }}>{m}</span>
            ))}
          </div>
        </div>

        {/* Activity — different visual language */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em'}}>RECENT ACTIVITY</div>
          {[
            { text: 'New signup: john@acme.com', time: '2m', color: '#16a34a' },
            { text: 'Payment failed — retry needed', time: '5m', color: '#dc2626' },
            { text: 'Report exported by Alice', time: '12m', color: '#2563eb' },
            { text: 'User upgraded to Pro plan', time: '1h', color: '#d97706' },
            { text: 'API rate limit reached', time: '2h', color: '#dc2626' },
          ].map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 7, paddingBottom: 7, borderBottom: i < 4 ? '1px solid #f3f4f6' : 'none' }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: a.color, marginTop: 3, flexShrink: 0 }} />
              <span style={{ fontSize: 9.5, color: '#374151', flex: 1, lineHeight: 1.4 }}>{a.text}</span>
              <span style={{ fontSize: 8, color: '#9ca3af', whiteSpace: 'nowrap' }}>{a.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Table — sharp corners, heavy header */}
      <div style={{ margin: '0 20px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ background: '#f9fafb', padding: '7px 12px', borderBottom: '1px solid #e5e7eb', display: 'flex' }}>
          {['Customer', 'Email', 'Plan', 'MRR', 'Status', 'Action'].map((h, i) => (
            <span key={h} style={{ fontSize: 9, fontWeight: 700, color: '#374151', flex: i === 1 ? 2 : 1, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</span>
          ))}
        </div>
        {[
          ['Alice Chen', 'alice@corp.com', 'Enterprise', '$1,200', 'Active'],
          ['Bob Smith', 'bob@startup.io', 'Pro', '$49', 'Trialing'],
          ['Carol W.', 'carol@co.com', 'Free', '$0', 'Inactive'],
        ].map((row, i) => (
          <div key={i} style={{ display: 'flex', padding: '7px 12px', borderBottom: i < 2 ? '1px solid #f3f4f6' : 'none', alignItems: 'center', background: i % 2 === 1 ? '#fafafa' : '#fff' }}>
            {row.map((cell, j) => (
              <span key={j} style={{ fontSize: 9.5, color: j === 4 ? (cell === 'Active' ? '#16a34a' : cell === 'Trialing' ? '#d97706' : '#9ca3af') : '#374151', flex: j === 1 ? 2 : 1 }}>{cell}</span>
            ))}
            <span style={{ flex: 1, fontSize: 9, color: '#2563eb', cursor: 'pointer' }}>Manage →</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Dashboard: After ────────────────────────────────────────────────────────
   Same data, fully cleaned up to match Reform's design language
   ─────────────────────────────────────────────────────────────────────────── */
function DashboardAfter() {
  return (
    <div style={{ width: '100%', height: '100%', background: '#ffffff', fontFamily: FONT, overflow: 'hidden' }}>
      {/* Clean nav */}
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

      {/* Page title */}
      <div style={{ padding: '10px 24px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#0a0a0a', letterSpacing: '-0.02em' }}>Overview</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {['Export', 'Last 30 days ▾'].map(l => (
            <div key={l} style={{ border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 100, padding: '4px 10px', fontSize: 9.5, color: '#888' }}>{l}</div>
          ))}
        </div>
      </div>

      {/* Stats — uniform grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, padding: '0 24px', marginBottom: 8 }}>
        {[
          { label: 'Revenue', val: '$24,521', change: '+12% vs last month' },
          { label: 'Active users', val: '1,204', change: '+48 this week' },
          { label: 'Conversion', val: '3.2%', change: 'Up from 2.8%' },
          { label: 'Bounce rate', val: '42%', change: 'Down 3 pts' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fafafa', border: '0.5px solid rgba(0,0,0,0.07)', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 9, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{s.label}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#0a0a0a', letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 3 }}>{s.val}</div>
            <div style={{ fontSize: 9, color: '#bbb' }}>{s.change}</div>
          </div>
        ))}
      </div>

      {/* Two col */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.9fr 1fr', gap: 6, padding: '0 24px', marginBottom: 8 }}>
        <div style={{ background: '#fafafa', border: '0.5px solid rgba(0,0,0,0.07)', borderRadius: 10, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#0a0a0a', letterSpacing: '-0.02em' }}>Monthly Revenue</span>
            <div style={{ display: 'flex', gap: 3 }}>
              {['1W','1M','3M','1Y'].map(p => (
                <span key={p} style={{ fontSize: 8, padding: '2px 6px', background: p === '1M' ? '#0a0a0a' : 'transparent', color: p === '1M' ? '#fff' : '#bbb', borderRadius: 100, border: p !== '1M' ? '0.5px solid rgba(0,0,0,0.1)' : 'none' }}>{p}</span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 62 }}>
            {[38,52,45,68,55,72,48,63,58,77,65,82].map((h,i) => (
              <div key={i} style={{ flex: 1, height: `${h}%`, background: i === 11 ? '#0a0a0a' : 'rgba(0,0,0,0.07)', borderRadius: '3px 3px 0 0' }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map(m => (
              <span key={m} style={{ fontSize: 7, color: '#ccc' }}>{m}</span>
            ))}
          </div>
        </div>

        <div style={{ background: '#fafafa', border: '0.5px solid rgba(0,0,0,0.07)', borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#0a0a0a', letterSpacing: '-0.01em', marginBottom: 10 }}>Recent activity</div>
          {[
            { text: 'New signup: john@acme.com', time: '2m', dot: '#34c759' },
            { text: 'Payment failed — retry', time: '5m', dot: '#ff3b30' },
            { text: 'Report exported by Alice', time: '12m', dot: '#007aff' },
            { text: 'User upgraded to Pro', time: '1h', dot: '#ff9500' },
            { text: 'API rate limit reached', time: '2h', dot: '#ff3b30' },
          ].map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: a.dot, flexShrink: 0 }} />
              <span style={{ fontSize: 9, color: '#555', flex: 1, lineHeight: 1.4 }}>{a.text}</span>
              <span style={{ fontSize: 8, color: '#ccc' }}>{a.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ margin: '0 24px', background: '#fafafa', border: '0.5px solid rgba(0,0,0,0.07)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '7px 12px', borderBottom: '0.5px solid rgba(0,0,0,0.07)', display: 'flex' }}>
          {['Customer','Email','Plan','MRR','Status',''].map((h, i) => (
            <span key={i} style={{ fontSize: 8, fontWeight: 500, color: '#bbb', flex: i === 1 ? 2 : 1, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</span>
          ))}
        </div>
        {[
          ['Alice Chen', 'alice@corp.com', 'Enterprise', '$1,200', 'Active'],
          ['Bob Smith', 'bob@startup.io', 'Pro', '$49', 'Trialing'],
          ['Carol W.', 'carol@co.com', 'Free', '$0', 'Inactive'],
        ].map((row, i) => (
          <div key={i} style={{ display: 'flex', padding: '7px 12px', borderBottom: i < 2 ? '0.5px solid rgba(0,0,0,0.05)' : 'none', alignItems: 'center' }}>
            {row.map((cell, j) => (
              <span key={j} style={{ fontSize: 9.5, color: j === 4 ? (cell === 'Active' ? '#16a34a' : cell === 'Trialing' ? '#d97706' : '#aaa') : '#555', flex: j === 1 ? 2 : 1 }}>{cell}</span>
            ))}
            <span style={{ flex: 1, fontSize: 9, color: '#bbb', cursor: 'pointer' }}>Manage →</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Issue annotation overlay ────────────────────────────────────────────────
   Positions calibrated to DashboardBefore layout:
   Nav: 0–13% | Title bar: 13–21% | Stats: 21–38% | Two-col: 39–70% | Table: 71–95%
   ─────────────────────────────────────────────────────────────────────────── */
function IssueOverlay({ ref: highlightRef }: { ref: React.Ref<HTMLDivElement> }) {
  return (
    <div ref={highlightRef} style={{ position: 'absolute', inset: 0, zIndex: 8, opacity: 0, pointerEvents: 'none' }}>
      {/* Stats row — inconsistent border radii / sizing */}
      <Annotation
        top="21%" left="3%" width="94%" height="16%"
        color="rgba(239,68,68,0.55)" label="inconsistent card styles"
        labelTop="19%" labelLeft="3%"
      />
      {/* Chart vs activity — mismatched visual language */}
      <Annotation
        top="39%" left="3%" width="57%" height="30%"
        color="rgba(234,179,8,0.55)" label="weak visual hierarchy"
        labelTop="37%" labelLeft="3%"
      />
      {/* Table header — over-styled, doesn't match cards */}
      <Annotation
        top="71%" left="3%" width="94%" height="24%"
        color="rgba(59,130,246,0.55)" label="misaligned grid & spacing"
        labelTop="69%" labelLeft="3%"
      />
    </div>
  )
}

function Annotation({ top, left, width, height, color, label, labelTop, labelLeft }: {
  top: string; left: string; width: string; height: string
  color: string; label: string; labelTop: string; labelLeft: string
}) {
  const borderColor = color
  const textColor = color.replace('0.55', '1')
  return (
    <>
      <div style={{ position: 'absolute', top, left, width, height, border: `1.5px dashed ${borderColor}`, borderRadius: 6, boxSizing: 'border-box' }} />
      <div style={{
        position: 'absolute', top: labelTop, left: labelLeft,
        fontSize: 8.5, fontFamily: 'monospace', color: textColor.replace('rgba','rgb').replace(',1)','0.9)'),
        background: 'rgba(255,255,255,0.96)', padding: '2px 7px', borderRadius: 4,
        whiteSpace: 'nowrap', border: `0.5px solid ${color}`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
        transform: 'translateY(-100%)',
      }}>
        {label}
      </div>
    </>
  )
}

/* ─── Browser Frame ───────────────────────────────────────────────────────── */
function BrowserFrame({
  screenRef, afterRef, dividerRef, highlightRef,
}: {
  screenRef: React.Ref<HTMLDivElement>
  afterRef: React.Ref<HTMLDivElement>
  dividerRef: React.Ref<HTMLDivElement>
  highlightRef: React.Ref<HTMLDivElement>
}) {
  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', border: '0.5px solid rgba(0,0,0,0.1)', background: '#fff' }}>
      {/* Chrome */}
      <div style={{ height: 38, background: '#f5f5f5', borderBottom: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', padding: '0 14px', gap: 8 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
        </div>
        <div style={{ flex: 1, maxWidth: 320, margin: '0 auto', background: '#ebebeb', borderRadius: 6, height: 22, display: 'flex', alignItems: 'center', padding: '0 10px' }}>
          <span style={{ fontSize: 10, color: '#bbb', fontFamily: 'monospace' }}>app.acme.com/dashboard</span>
        </div>
      </div>

      {/* Screen */}
      <div ref={screenRef} style={{ position: 'relative', aspectRatio: '16/9', overflow: 'hidden' }}>
        {/* Before */}
        <div style={{ position: 'absolute', inset: 0 }}>
          <DashboardBefore />
        </div>
        {/* After — clip reveal */}
        <div ref={afterRef} style={{ position: 'absolute', inset: 0, clipPath: 'inset(0 100% 0 0)' }}>
          <DashboardAfter />
        </div>
        {/* Sweep line */}
        <div ref={dividerRef} style={{ position: 'absolute', top: 0, bottom: 0, left: '0%', width: '1.5px', background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.18) 20%, rgba(0,0,0,0.12) 80%, transparent)', zIndex: 10, opacity: 0 }} />
        {/* Annotations */}
        <IssueOverlay ref={highlightRef} />
      </div>
    </div>
  )
}

/* ─── Scene text ──────────────────────────────────────────────────────────── */
function SceneText({ stepRef, headRef, subRef }: { stepRef: React.Ref<HTMLDivElement>; headRef: React.Ref<HTMLDivElement>; subRef: React.Ref<HTMLDivElement> }) {
  return (
    <div ref={stepRef} style={{ position: 'absolute', left: 0, right: 0, top: 'clamp(20px, 5vh, 56px)', display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 20, opacity: 0 }}>
      <div style={{ textAlign: 'center', fontFamily: FONT }}>
        <div ref={subRef} style={{ fontSize: 10.5, color: '#aaa', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }} />
        <div ref={headRef} style={{ fontSize: 'clamp(24px, 3.2vw, 38px)', fontWeight: 600, letterSpacing: '-0.03em', color: '#0a0a0a' }} />
      </div>
    </div>
  )
}

/* ─── Main export ─────────────────────────────────────────────────────────── */
export default function ProductHero() {
  const sectionRef = useRef<HTMLElement>(null)
  const heroTextRef = useRef<HTMLDivElement>(null)
  const frameWrapRef = useRef<HTMLDivElement>(null)
  const screenRef = useRef<HTMLDivElement>(null)
  const afterRef = useRef<HTMLDivElement>(null)
  const dividerRef = useRef<HTMLDivElement>(null)
  const highlightRef = useRef<HTMLDivElement>(null)
  const stageGlowRef = useRef<HTMLDivElement>(null)

  const step1Ref = useRef<HTMLDivElement>(null); const head1Ref = useRef<HTMLDivElement>(null); const sub1Ref = useRef<HTMLDivElement>(null)
  const step2Ref = useRef<HTMLDivElement>(null); const head2Ref = useRef<HTMLDivElement>(null); const sub2Ref = useRef<HTMLDivElement>(null)
  const step3Ref = useRef<HTMLDivElement>(null); const head3Ref = useRef<HTMLDivElement>(null); const sub3Ref = useRef<HTMLDivElement>(null)
  const step4Ref = useRef<HTMLDivElement>(null); const head4Ref = useRef<HTMLDivElement>(null); const sub4Ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (head1Ref.current) head1Ref.current.textContent = 'Analyze your existing UI'
    if (sub1Ref.current) sub1Ref.current.textContent = 'Step 1 — Analyze'
    if (head2Ref.current) head2Ref.current.textContent = 'Detect layout and hierarchy issues'
    if (sub2Ref.current) sub2Ref.current.textContent = 'Step 2 — Detect'
    if (head3Ref.current) head3Ref.current.textContent = 'Generate a cleaner interface'
    if (sub3Ref.current) sub3Ref.current.textContent = 'Step 3 — Transform'
    if (head4Ref.current) head4Ref.current.textContent = 'Ship better UI with confidence'
    if (sub4Ref.current) sub4Ref.current.textContent = 'Step 4 — Ship'
  }, [])

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: `+=${SCROLL_DISTANCE}`,
          pin: true,
          scrub: 0.8,
          anticipatePin: 1,
        },
      })

      // S1 — hero exits, frame rises in
      const s1dur = S2 - S1
      tl.to(heroTextRef.current, { y: -50, opacity: 0, duration: s1dur * 0.4, ease: 'power2.in' }, S1)
      tl.fromTo(step1Ref.current, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: s1dur * 0.25, ease: 'power2.out' }, S1 + s1dur * 0.35)
      tl.to(step1Ref.current, { y: -10, opacity: 0, duration: s1dur * 0.2, ease: 'power2.in' }, S1 + s1dur * 0.8)
      tl.fromTo(frameWrapRef.current, { y: 24, scale: 0.96, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: s1dur, ease: 'power2.out' }, S1)

      // S2 — issue highlights fade in
      const s2dur = S3 - S2
      tl.to(highlightRef.current, { opacity: 1, duration: s2dur * 0.3, ease: 'power2.out' }, S2 + s2dur * 0.1)
      tl.fromTo(step2Ref.current, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: s2dur * 0.2, ease: 'power2.out' }, S2 + s2dur * 0.1)
      tl.to(highlightRef.current, { opacity: 0, duration: s2dur * 0.2, ease: 'power2.in' }, S2 + s2dur * 0.72)
      tl.to(step2Ref.current, { y: -10, opacity: 0, duration: s2dur * 0.15, ease: 'power2.in' }, S2 + s2dur * 0.78)

      // S3 — sweep reveal after
      const s3dur = S4 - S3
      tl.fromTo(step3Ref.current, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: s3dur * 0.15, ease: 'power2.out' }, S3 + s3dur * 0.05)
      const revealStart = S3 + s3dur * 0.2
      const revealDur = s3dur * 0.6
      tl.fromTo(afterRef.current, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: revealDur, ease: 'power2.inOut' }, revealStart)
      tl.fromTo(dividerRef.current, { left: '0%', opacity: 1 }, { left: '100%', opacity: 0.2, duration: revealDur, ease: 'power2.inOut' }, revealStart)
      tl.to(step3Ref.current, { y: -10, opacity: 0, duration: s3dur * 0.12, ease: 'power2.in' }, S3 + s3dur * 0.85)

      // S4 — window expands + stage glow lifts it
      const s4dur = 1.0 - S4
      tl.to(frameWrapRef.current, { scale: 1.12, y: -24, duration: s4dur * 0.7, ease: 'power3.out' }, S4)
      tl.to(stageGlowRef.current, { opacity: 1, duration: s4dur * 0.6, ease: 'power2.out' }, S4)
      tl.fromTo(step4Ref.current, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: s4dur * 0.3, ease: 'power2.out' }, S4 + s4dur * 0.1)
    }, sectionRef)

    requestAnimationFrame(() => ScrollTrigger.refresh())
    document.fonts?.ready.then(() => ScrollTrigger.refresh())
    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} style={{ height: '100vh', overflow: 'hidden', background: '#ffffff', fontFamily: FONT }}>
      <div style={{ position: 'relative', height: `calc(100vh - ${NAV_HEIGHT}px)`, marginTop: NAV_HEIGHT, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start' }}>

        {/* Hero text */}
        <div ref={heroTextRef} style={{ textAlign: 'center', padding: '24px 24px 0', flexShrink: 0 }}>
          <h1 style={{ fontSize: 'clamp(30px, 4.8vw, 58px)', fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1.05, color: '#0a0a0a', margin: '0 0 14px' }}>
            Upgrade the interface.
            <br />
            <span style={{ color: 'rgba(10,10,10,0.28)' }}>Keep the behavior.</span>
          </h1>
          <p style={{ fontSize: 'clamp(14px, 1.4vw, 16px)', color: '#6b6b6b', lineHeight: 1.65, margin: '0 auto 20px', maxWidth: 500 }}>
            Reform turns inconsistent frontend surfaces into clear, production-grade UI while preserving the logic your team depends on.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Link href="/new" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 500, color: '#fff', background: '#0a0a0a', textDecoration: 'none', borderRadius: 100, padding: '10px 22px' }}>
              Start a Redesign
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6h7M7 3.5 9.5 6 7 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Link>
            {BILLING_ENABLED && (
              <Link href="/subscription" style={{ display: 'inline-flex', alignItems: 'center', fontSize: 14, fontWeight: 500, color: '#0a0a0a', textDecoration: 'none', border: '0.5px solid rgba(0,0,0,0.16)', borderRadius: 100, padding: '10px 22px' }}>
                View plans
              </Link>
            )}
          </div>
        </div>

        {/* Frame + stage glow container */}
        <div style={{ position: 'relative', width: '100%', maxWidth: 'min(860px, 90vw)', margin: '20px auto 0', padding: '0 20px', flexShrink: 0 }}>
          {/* Stage glow — renders behind the frame, animates in on S4 */}
          <div ref={stageGlowRef} style={{
            position: 'absolute',
            inset: '-10% -8%',
            background: 'radial-gradient(ellipse 70% 60% at 50% 60%, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.04) 50%, transparent 75%)',
            filter: 'blur(28px)',
            borderRadius: 40,
            zIndex: 0,
            opacity: 0,
            pointerEvents: 'none',
          }} />

          {/* Frame itself */}
          <div ref={frameWrapRef} style={{ position: 'relative', zIndex: 1, opacity: 0 }}>
            <BrowserFrame
              screenRef={screenRef}
              afterRef={afterRef}
              dividerRef={dividerRef}
              highlightRef={highlightRef}
            />
          </div>
        </div>

        {/* Scene overlays */}
        <SceneText stepRef={step1Ref} headRef={head1Ref} subRef={sub1Ref} />
        <SceneText stepRef={step2Ref} headRef={head2Ref} subRef={sub2Ref} />
        <SceneText stepRef={step3Ref} headRef={head3Ref} subRef={sub3Ref} />
        <SceneText stepRef={step4Ref} headRef={head4Ref} subRef={sub4Ref} />
      </div>

      {/* Bottom fade */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100, background: 'linear-gradient(to bottom, transparent, #ffffff)', pointerEvents: 'none', zIndex: 20 }} />
    </section>
  )
}