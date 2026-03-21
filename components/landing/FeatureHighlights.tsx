import { Shield, Layers, Code2, Palette } from 'lucide-react'

const FEATURES = [
  {
    icon: Shield,
    title: 'Refactor the UI, not the logic',
    description:
      'RefineUI upgrades how your app looks and feels without touching business logic, backend routes, or component behavior. Everything you built stays intact.',
    tags: ['Non-destructive', 'Presentation-layer only'],
  },
  {
    icon: Palette,
    title: 'Style presets that feel real',
    description:
      'Choose from Minimal, GitHub, or Railway presets — each one applies a coherent design system to your interface instead of generating something random.',
    tags: ['Minimal', 'GitHub', 'Railway'],
  },
  {
    icon: Layers,
    title: 'Before/after that proves value',
    description:
      'A side-by-side comparison makes the improvement immediately visible. No abstract AI output — just a clear diff between what was and what could be.',
    tags: ['Visual diff', 'Quality score'],
  },
  {
    icon: Code2,
    title: 'Export production-ready code',
    description:
      'The redesigned component can be exported as React + Tailwind CSS code, ready to drop into your codebase with minimal integration work.',
    tags: ['React', 'Tailwind CSS', 'TypeScript'],
  },
]

export default function FeatureHighlights() {
  return (
    <section className="py-24 border-t border-zinc-800/60">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="text-indigo-400 text-xs font-semibold uppercase tracking-widest mb-3">
            Features
          </div>
          <h2 className="text-3xl font-bold text-zinc-100 tracking-tight mb-4">
            Built for developers shipping fast
          </h2>
          <p className="text-zinc-500 text-base max-w-xl mx-auto leading-relaxed">
            Every feature is designed around the developer workflow — not a designer's.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon
            return (
              <div
                key={i}
                className="group rounded-2xl border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/80 hover:border-zinc-700 p-6 transition-all duration-200"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0 group-hover:border-indigo-500/40 group-hover:bg-indigo-500/10 transition-all">
                    <Icon
                      size={18}
                      className="text-zinc-400 group-hover:text-indigo-400 transition-colors"
                      strokeWidth={1.5}
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-zinc-100 font-semibold text-base mb-2">{feature.title}</h3>
                    <p className="text-zinc-500 text-sm leading-relaxed mb-4">
                      {feature.description}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {feature.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] font-medium text-zinc-500 bg-zinc-800/60 border border-zinc-700/60 rounded-md px-2 py-1"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* CTA row */}
        <div className="mt-16 rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 via-zinc-900/80 to-zinc-900/80 p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-zinc-100 font-bold text-xl mb-2">Ready to refine?</h3>
            <p className="text-zinc-500 text-sm">
              No account required. Drop a screenshot and see the result in under 3 seconds.
            </p>
          </div>
          <a
            href="#demo"
            className="flex-shrink-0 px-6 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-semibold text-sm transition-all shadow-glow-sm"
          >
            Try it now
          </a>
        </div>
      </div>
    </section>
  )
}
