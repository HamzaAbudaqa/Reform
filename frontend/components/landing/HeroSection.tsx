'use client'

import Link from 'next/link'
import MockDashboardBefore from '@/components/demo/MockDashboardBefore'
import MockDashboardAfter from '@/components/demo/MockDashboardAfter'

function HeroBrowserFrame({
  children,
  label,
  accent = false,
}: {
  children: React.ReactNode
  label: string
  accent?: boolean
}) {
  return (
    <div className="flex flex-col gap-2 flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: accent ? '#a855f7' : 'rgba(255,255,255,0.2)' }}
        />
        <span
          className="text-[10px] font-medium uppercase tracking-wider"
          style={{ color: 'rgba(255,255,255,0.35)' }}
        >
          {label}
        </span>
      </div>
      <div
        className="rounded-xl overflow-hidden flex flex-col shadow-2xl"
        style={{
          border: accent ? '1px solid rgba(168,85,247,0.3)' : '1px solid rgba(255,255,255,0.06)',
          boxShadow: accent ? '0 0 40px rgba(124,58,237,0.15)' : '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        <div
          className="border-b px-3 py-1.5 flex items-center gap-1.5"
          style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <div className="w-2 h-2 rounded-full bg-red-500/60" />
          <div className="w-2 h-2 rounded-full bg-amber-500/60" />
          <div className="w-2 h-2 rounded-full bg-emerald-500/60" />
          <div className="flex-1 mx-2">
            <div
              className="rounded text-[8px] px-2 py-0.5 text-center"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.2)' }}
            >
              acme-admin.vercel.app
            </div>
          </div>
        </div>
        <div className="overflow-hidden" style={{ height: '200px', background: '#0d0c16' }}>
          <div
            style={{
              width: '900px',
              height: '560px',
              transform: 'scale(0.4444)',
              transformOrigin: 'top left',
              pointerEvents: 'none',
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function HeroSection() {
  return (
    <section className="relative pt-28 pb-0 overflow-hidden">
      {/* Starry sky background */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Deep gradient sky */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(109,40,217,0.35) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 80% 10%, rgba(76,29,149,0.2) 0%, transparent 60%), #13111c',
          }}
        />

        {/* Stars */}
        {[
          [12, 8], [25, 15], [38, 5], [55, 20], [70, 9], [85, 17], [92, 6],
          [8, 30], [18, 40], [45, 25], [62, 35], [78, 28], [95, 42],
          [5, 55], [30, 60], [50, 48], [68, 58], [88, 52],
          [15, 72], [40, 78], [60, 70], [80, 75], [95, 68],
          [22, 88], [55, 85], [75, 90], [90, 82],
        ].map(([x, y], i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: i % 5 === 0 ? '2px' : '1px',
              height: i % 5 === 0 ? '2px' : '1px',
              background: `rgba(255,255,255,${0.2 + (i % 4) * 0.15})`,
            }}
          />
        ))}

        {/* Cloud/mountain silhouette at bottom using CSS shapes */}
        <div className="absolute bottom-0 left-0 right-0" style={{ height: '260px' }}>
          {/* Left mountain */}
          <div
            className="absolute bottom-0 left-0"
            style={{
              width: '45%',
              height: '200px',
              background: 'linear-gradient(to top right, rgba(60,30,100,0.5), transparent)',
              clipPath: 'polygon(0% 100%, 0% 40%, 30% 5%, 60% 40%, 100% 100%)',
            }}
          />
          {/* Right mountain */}
          <div
            className="absolute bottom-0 right-0"
            style={{
              width: '50%',
              height: '180px',
              background: 'linear-gradient(to top left, rgba(50,20,90,0.4), transparent)',
              clipPath: 'polygon(0% 100%, 30% 35%, 60% 60%, 80% 20%, 100% 50%, 100% 100%)',
            }}
          />
          {/* Fog/mist layer */}
          <div
            className="absolute bottom-0 left-0 right-0"
            style={{
              height: '80px',
              background: 'linear-gradient(to top, rgba(19,17,28,0.9), transparent)',
            }}
          />
        </div>

        {/* Purple nebula glow */}
        <div
          className="absolute"
          style={{
            top: '5%',
            left: '60%',
            width: '400px',
            height: '300px',
            background: 'radial-gradient(ellipse, rgba(139,92,246,0.12) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
        <div
          className="absolute"
          style={{
            top: '15%',
            left: '10%',
            width: '300px',
            height: '200px',
            background: 'radial-gradient(ellipse, rgba(109,40,217,0.08) 0%, transparent 70%)',
            filter: 'blur(30px)',
          }}
        />
      </div>

      <div className="max-w-5xl mx-auto px-6 relative text-center">
        {/* Headline */}
        <h1
          className="font-bold tracking-tight leading-[1.08] mb-6"
          style={{
            fontSize: 'clamp(48px, 7vw, 80px)',
            color: '#ffffff',
            textShadow: '0 0 80px rgba(139,92,246,0.3)',
          }}
        >
          Redesign frontends
          <br />
          <span style={{ color: 'rgba(255,255,255,0.75)' }}>peacefully.</span>
        </h1>

        <p
          className="mb-10 max-w-lg mx-auto leading-relaxed"
          style={{ fontSize: '18px', color: 'rgba(255,255,255,0.5)' }}
        >
          With the all-in-one{' '}
          <span
            style={{
              color: 'rgba(255,255,255,0.8)',
              textDecoration: 'underline',
              textDecorationStyle: 'wavy',
              textUnderlineOffset: '4px',
              textDecorationColor: 'rgba(139,92,246,0.5)',
            }}
          >
            AI-powered
          </span>{' '}
          UI refiner for developers.
        </p>

        {/* CTA buttons */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <Link
            href="/new"
            className="flex items-center gap-1.5 px-6 py-2.5 rounded-lg text-white font-semibold text-sm transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 0 30px rgba(124,58,237,0.35)' }}
          >
            Get Started →
          </Link>
        </div>

        {/* Feature tags */}
        <div className="flex items-center justify-center gap-6 mb-16">
          {['Analyze', 'Compare', 'Redesign', 'Export'].map((tag, i) => (
            <div key={tag} className="flex items-center gap-2">
              {i > 0 && (
                <div className="w-1 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
              )}
              <span
                className="text-xs font-medium"
                style={{ color: 'rgba(255,255,255,0.35)' }}
              >
                {tag}
              </span>
            </div>
          ))}
        </div>

        {/* Hero product preview */}
        <div className="relative" style={{ marginBottom: '-2px' }}>
          {/* Glow behind preview */}
          <div
            className="absolute -inset-8 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at 50% 80%, rgba(109,40,217,0.2) 0%, transparent 70%)',
            }}
          />

          <div
            className="relative rounded-t-2xl overflow-hidden"
            style={{
              border: '1px solid rgba(255,255,255,0.08)',
              borderBottom: 'none',
              background: 'rgba(255,255,255,0.03)',
              backdropFilter: 'blur(8px)',
            }}
          >
            {/* Panel title bar */}
            <div
              className="flex items-center gap-2 px-5 py-3 border-b"
              style={{ borderColor: 'rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/50" />
                <div className="w-3 h-3 rounded-full bg-amber-500/50" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/50" />
              </div>
              <div className="flex-1 flex justify-center">
                <span className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  refineui — transformation preview
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px #34d399' }} />
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>Complete</span>
              </div>
            </div>

            <div className="flex gap-4 p-5">
              <HeroBrowserFrame label="Before">
                <MockDashboardBefore />
              </HeroBrowserFrame>

              {/* Arrow divider */}
              <div className="flex flex-col items-center justify-center gap-2 px-1 flex-shrink-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{
                    background: 'rgba(124,58,237,0.15)',
                    border: '1px solid rgba(124,58,237,0.3)',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 7h8M8 4l3 3-3 3" stroke="#a855f7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div
                  className="text-[8px] font-semibold uppercase tracking-widest"
                  style={{ color: 'rgba(168,85,247,0.6)', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                >
                  Railway preset
                </div>
              </div>

              <HeroBrowserFrame label="After" accent>
                <MockDashboardAfter />
              </HeroBrowserFrame>
            </div>

            {/* Bottom stats bar */}
            <div
              className="px-5 py-3 border-t flex items-center justify-between"
              style={{ borderColor: 'rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center gap-5">
                {[
                  { label: 'Issues fixed', value: '7' },
                  { label: 'Quality score', value: '34 → 91' },
                  { label: 'Preset', value: 'Railway' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>{item.label}:</span>
                    <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>{item.value}</span>
                  </div>
                ))}
              </div>
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.15)' }}>Generated in 2.4s</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
