import { Upload, Sliders, Sparkles } from 'lucide-react'

const STEPS = [
  {
    number: '01',
    icon: Upload,
    title: 'Upload your UI',
    description:
      'Drop in a screenshot of any interface — dashboard, form, settings page. Messy, outdated, or inconsistent. RefineUI handles it.',
    detail: 'Supports PNG, JPG, WebP',
  },
  {
    number: '02',
    icon: Sliders,
    title: 'AI analyzes the interface',
    description:
      'RefineUI scans the layout, detects spacing issues, identifies poor hierarchy, and maps component structure before generating anything.',
    detail: 'Powered by TinyFish',
  },
  {
    number: '03',
    icon: Sparkles,
    title: 'Get a polished redesign',
    description:
      'Receive a production-ready redesign that preserves your layout intent but applies consistent spacing, typography, and component styling.',
    detail: 'React + Tailwind export',
  },
]

export default function HowItWorks() {
  return (
    <section id="features" className="py-24 border-t border-zinc-800/60">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="text-indigo-400 text-xs font-semibold uppercase tracking-widest mb-3">
            How it works
          </div>
          <h2 className="text-3xl font-bold text-zinc-100 tracking-tight mb-4">
            Three steps to a better interface
          </h2>
          <p className="text-zinc-500 text-base max-w-xl mx-auto leading-relaxed">
            No design system required. No Figma handoff. Just a screenshot and a style choice.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connector line */}
          <div className="hidden md:block absolute top-8 left-[calc(33.33%+16px)] right-[calc(33.33%+16px)] h-px bg-gradient-to-r from-zinc-800 via-indigo-500/30 to-zinc-800" />

          {STEPS.map((step, i) => {
            const Icon = step.icon
            return (
              <div key={i} className="flex flex-col gap-5 relative">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-lg relative z-10">
                      <Icon size={20} className="text-indigo-400" strokeWidth={1.5} />
                    </div>
                    <span className="text-zinc-700 text-[10px] font-mono font-semibold">
                      {step.number}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-zinc-100 font-semibold text-base mb-2">{step.title}</h3>
                    <p className="text-zinc-500 text-sm leading-relaxed">{step.description}</p>
                    <div className="mt-3 inline-flex items-center gap-1.5 text-[10px] text-zinc-600 bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1">
                      {step.detail}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
