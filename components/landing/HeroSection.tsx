import Link from 'next/link'
import { ArrowRight, Github } from 'lucide-react'
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
          className={`w-1.5 h-1.5 rounded-full ${accent ? 'bg-emerald-400' : 'bg-zinc-600'}`}
        />
        <span className="text-zinc-500 text-[10px] font-medium uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div
        className={`rounded-xl border overflow-hidden flex flex-col shadow-2xl ${
          accent
            ? 'border-indigo-500/30 shadow-glow-indigo'
            : 'border-zinc-800'
        }`}
      >
        <div className="bg-zinc-900 border-b border-zinc-800 px-3 py-1.5 flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500/60" />
          <div className="w-2 h-2 rounded-full bg-amber-500/60" />
          <div className="w-2 h-2 rounded-full bg-emerald-500/60" />
          <div className="flex-1 mx-2">
            <div className="bg-zinc-800 rounded text-[8px] text-zinc-600 px-2 py-0.5 text-center">
              acme-admin.vercel.app
            </div>
          </div>
        </div>
        <div className="overflow-hidden bg-zinc-900" style={{ height: '200px' }}>
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
    <section className="relative pt-32 pb-24 overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl" />
        <div className="absolute top-20 right-1/4 w-[300px] h-[300px] bg-violet-500/5 rounded-full blur-3xl" />
        {/* Grid lines */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-6 relative">
        {/* Badge */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 hover:border-zinc-700 transition-colors cursor-default">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Now with Railway-style presets
            <span className="text-zinc-600">→</span>
          </div>
        </div>

        {/* Headline */}
        <div className="text-center max-w-4xl mx-auto mb-8">
          <h1 className="text-5xl md:text-6xl font-bold text-zinc-100 tracking-tight leading-[1.1] mb-5">
            Upgrade ugly frontends{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent">
              into polished UI.
            </span>
          </h1>
          <p className="text-zinc-400 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">
            Upload a screenshot, choose a style preset, and get a production-ready redesign
            instantly. Refactor the UI, not the logic.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex items-center justify-center gap-3 mb-16">
          <Link
            href="#demo"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-semibold text-sm transition-all shadow-glow-sm hover:shadow-glow-indigo group"
          >
            Try Demo
            <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link
            href="#"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-medium text-sm border border-zinc-800 hover:border-zinc-700 transition-all"
          >
            <Github size={14} />
            GitHub
          </Link>
        </div>

        {/* Hero visual — before/after */}
        <div className="relative max-w-5xl mx-auto">
          {/* Outer glow */}
          <div className="absolute -inset-4 bg-gradient-to-b from-indigo-500/10 via-transparent to-transparent rounded-2xl blur-2xl pointer-events-none" />

          <div className="relative rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 backdrop-blur-sm shadow-2xl">
            {/* Panel title bar */}
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-amber-500/60" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
              </div>
              <div className="flex-1 flex justify-center">
                <span className="text-zinc-600 text-xs font-mono">refineui — transformation preview</span>
              </div>
            </div>

            <div className="flex gap-4 items-stretch">
              <HeroBrowserFrame label="Before">
                <MockDashboardBefore />
              </HeroBrowserFrame>

              {/* Arrow divider */}
              <div className="flex flex-col items-center justify-center gap-2 px-2 flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
                  <ArrowRight size={14} className="text-indigo-400" />
                </div>
                <div className="text-indigo-400 text-[9px] font-semibold uppercase tracking-widest [writing-mode:vertical-rl] rotate-180">
                  Railway preset
                </div>
              </div>

              <HeroBrowserFrame label="After" accent>
                <MockDashboardAfter />
              </HeroBrowserFrame>
            </div>

            {/* Bottom bar */}
            <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {[
                  { label: 'Issues fixed', value: '7' },
                  { label: 'Quality score', value: '34 → 91' },
                  { label: 'Preset', value: 'Railway' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    <span className="text-zinc-600 text-[10px]">{item.label}:</span>
                    <span className="text-zinc-300 text-[10px] font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
              <span className="text-zinc-700 text-[10px]">Generated in 2.4s</span>
            </div>
          </div>
        </div>

        {/* Social proof */}
        <div className="flex justify-center mt-10">
          <div className="flex items-center gap-6 divide-x divide-zinc-800">
            {[
              { value: '10k+', label: 'transformations' },
              { value: '3', label: 'style presets' },
              { value: '<3s', label: 'avg response' },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center px-6 first:pl-0 last:pr-0">
                <span className="text-zinc-100 font-semibold text-lg">{stat.value}</span>
                <span className="text-zinc-600 text-xs">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
