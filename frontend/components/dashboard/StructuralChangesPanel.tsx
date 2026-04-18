'use client'

import type { ChangeAnnotation } from './TransformTypes'

type TypeMeta = {
  label: string
  dot: string
  bg: string
  text: string
  border: string
  gradient: string
}

const TYPE_META: Record<string, TypeMeta> = {
  flow: {
    label: 'Flow',
    dot: '#ec4899',
    bg: 'rgba(236,72,153,0.08)',
    text: '#be185d',
    border: 'rgba(236,72,153,0.25)',
    gradient: 'linear-gradient(135deg, rgba(236,72,153,0.06), rgba(236,72,153,0.015))',
  },
  layout: {
    label: 'Layout',
    dot: '#3b82f6',
    bg: 'rgba(59,130,246,0.08)',
    text: '#1d4ed8',
    border: 'rgba(59,130,246,0.25)',
    gradient: 'linear-gradient(135deg, rgba(59,130,246,0.06), rgba(59,130,246,0.015))',
  },
  spacing: {
    label: 'Spacing',
    dot: '#22c55e',
    bg: 'rgba(34,197,94,0.08)',
    text: '#15803d',
    border: 'rgba(34,197,94,0.25)',
    gradient: 'linear-gradient(135deg, rgba(34,197,94,0.06), rgba(34,197,94,0.015))',
  },
  component: {
    label: 'Component',
    dot: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    text: '#b45309',
    border: 'rgba(245,158,11,0.28)',
    gradient: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(245,158,11,0.015))',
  },
  visual: {
    label: 'Visual',
    dot: '#6b7280',
    bg: 'rgba(107,114,128,0.08)',
    text: '#374151',
    border: 'rgba(107,114,128,0.22)',
    gradient: 'linear-gradient(135deg, rgba(107,114,128,0.06), rgba(107,114,128,0.015))',
  },
  other: {
    label: 'Other',
    dot: '#6b7280',
    bg: 'rgba(107,114,128,0.08)',
    text: '#374151',
    border: 'rgba(107,114,128,0.22)',
    gradient: 'linear-gradient(135deg, rgba(107,114,128,0.06), rgba(107,114,128,0.015))',
  },
}

const TYPE_ORDER = ['flow', 'layout', 'spacing', 'component', 'visual']

export default function StructuralChangesPanel({
  annotations,
  changeSummary,
}: {
  annotations: ChangeAnnotation[]
  changeSummary: string[]
}) {
  if (!annotations.length && !changeSummary.length) return null

  const grouped = TYPE_ORDER
    .map(type => ({ type, items: annotations.filter(a => a.change_type === type) }))
    .filter(g => g.items.length > 0)
  const knownTypes = new Set(TYPE_ORDER)
  const extras = annotations.filter(a => !knownTypes.has(a.change_type))
  if (extras.length > 0) grouped.push({ type: 'other', items: extras })

  const tags = [...new Set(annotations.map(a => a.change_type).filter(Boolean))]

  return (
    <div className="space-y-5 mt-6">
      {/* Improvement tags — now with a leading dot and tighter pill */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map(tag => {
            const meta = TYPE_META[tag] || TYPE_META.visual
            return (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] pl-2 pr-3 py-1 rounded-full"
                style={{ background: meta.bg, color: meta.text, border: `1px solid ${meta.border}` }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.dot }} />
                {meta.label}
              </span>
            )
          })}
        </div>
      )}

      {/* High-level summary bullets — wrapped in a soft green card so the
          list reads as a unified "here's what got better" moment rather
          than four floating checks on white. */}
      {changeSummary.length > 0 && (
        <div
          className="rounded-2xl px-5 py-4"
          style={{
            background: 'linear-gradient(135deg, rgba(34,197,94,0.04), rgba(34,197,94,0.01))',
            border: '1px solid rgba(34,197,94,0.14)',
          }}
        >
          <ul className="space-y-2.5">
            {changeSummary.slice(0, 5).map((item, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 text-[12.5px] leading-relaxed"
                style={{ color: 'rgba(0,0,0,0.74)' }}
              >
                <span
                  className="flex-shrink-0 mt-[3px] w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(34,197,94,0.16)', border: '1px solid rgba(34,197,94,0.28)' }}
                >
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Detailed changes — per-category card grid. Each card gets a tinted
          gradient header (matching the change type), an item count, and
          compact region/description rows. */}
      {grouped.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'rgba(0,0,0,0.45)' }}>
              Detailed Changes
            </h4>
            <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.08)' }} />
            <span className="text-[10.5px] font-mono tabular-nums" style={{ color: 'rgba(0,0,0,0.32)' }}>
              {annotations.length} {annotations.length === 1 ? 'change' : 'changes'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {grouped.map(group => {
              const meta = TYPE_META[group.type] || TYPE_META.other
              return (
                <div
                  key={group.type}
                  className="rounded-2xl overflow-hidden flex flex-col"
                  style={{
                    background: meta.gradient,
                    border: `1px solid ${meta.border}`,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                  }}
                >
                  <div
                    className="flex items-center gap-2 px-4 py-2.5"
                    style={{ borderBottom: `1px solid ${meta.border}` }}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: meta.dot, boxShadow: `0 0 10px ${meta.dot}66` }}
                    />
                    <span
                      className="text-[10.5px] font-bold uppercase tracking-[0.14em]"
                      style={{ color: meta.text }}
                    >
                      {meta.label}
                    </span>
                    <span
                      className="ml-auto text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded-md"
                      style={{ color: meta.text, background: meta.bg }}
                    >
                      {group.items.length}
                    </span>
                  </div>

                  <div className="px-4 py-3 flex-1 space-y-3">
                    {group.items.map((ann, i) => (
                      <div key={i} className="space-y-0.5">
                        <p
                          className="text-[12.5px] font-semibold leading-snug"
                          style={{ color: 'rgba(0,0,0,0.82)' }}
                        >
                          {ann.region}
                        </p>
                        <p
                          className="text-[11.5px] leading-relaxed"
                          style={{ color: 'rgba(0,0,0,0.52)' }}
                        >
                          {ann.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
