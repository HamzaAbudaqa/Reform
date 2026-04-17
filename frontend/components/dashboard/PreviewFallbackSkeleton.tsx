'use client'

/**
 * Visual fallback that renders *something* when live screenshots aren't
 * available yet. Stylized browser-chrome + structural skeleton — it never
 * shows error text. Used as the final link in the preview fallback chain
 * after real screenshots and cached screenshots.
 */
export default function PreviewFallbackSkeleton({
  pageName,
  route,
  changeSummary,
  variant = 'after',
}: {
  pageName: string
  route?: string
  changeSummary?: string[]
  variant?: 'before' | 'after'
}) {
  const accent = variant === 'after' ? '#0a0a0a' : 'rgba(0,0,0,0.35)'
  const bullets = (changeSummary ?? []).slice(0, 3)

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl"
      style={{
        background: variant === 'after'
          ? 'linear-gradient(180deg, #ffffff 0%, #fafafa 100%)'
          : 'linear-gradient(180deg, #f5f5f5 0%, #efefef 100%)',
        border: '1px solid rgba(0,0,0,0.06)',
        aspectRatio: '16 / 10',
      }}
    >
      {/* Browser chrome */}
      <div
        className="flex items-center gap-2 border-b px-3 py-2"
        style={{ background: 'rgba(0,0,0,0.02)', borderColor: 'rgba(0,0,0,0.06)' }}
      >
        <span className="h-2 w-2 rounded-full" style={{ background: 'rgba(0,0,0,0.12)' }} />
        <span className="h-2 w-2 rounded-full" style={{ background: 'rgba(0,0,0,0.12)' }} />
        <span className="h-2 w-2 rounded-full" style={{ background: 'rgba(0,0,0,0.12)' }} />
        <div
          className="ml-2 flex-1 truncate rounded-md px-2 py-0.5 font-mono text-[10px]"
          style={{ background: 'rgba(0,0,0,0.04)', color: 'rgba(0,0,0,0.4)' }}
        >
          {route ?? '/'}
        </div>
      </div>

      {/* Body — skeletal rep of the page */}
      <div className="flex h-[calc(100%-32px)] flex-col gap-3 px-6 py-5">
        <div
          className="h-3 w-24 rounded"
          style={{ background: variant === 'after' ? 'rgba(10,10,10,0.9)' : 'rgba(0,0,0,0.14)' }}
        />
        <div
          className="text-[clamp(18px,2.4vw,28px)] font-semibold leading-[1.1] tracking-[-0.02em]"
          style={{ color: accent }}
        >
          {pageName}
        </div>
        <div className="flex flex-col gap-1.5 pt-1">
          <div className="h-2 w-3/4 rounded" style={{ background: 'rgba(0,0,0,0.08)' }} />
          <div className="h-2 w-2/3 rounded" style={{ background: 'rgba(0,0,0,0.06)' }} />
          <div className="h-2 w-1/2 rounded" style={{ background: 'rgba(0,0,0,0.05)' }} />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-lg"
              style={{
                height: '52px',
                background: variant === 'after' ? 'rgba(10,10,10,0.04)' : 'rgba(0,0,0,0.03)',
                border: '1px solid rgba(0,0,0,0.05)',
              }}
            />
          ))}
        </div>

        {bullets.length > 0 && (
          <ul className="mt-auto space-y-1 pt-2">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-center gap-1.5 text-[10px]" style={{ color: 'rgba(0,0,0,0.4)' }}>
                <span className="h-1 w-1 rounded-full" style={{ background: accent }} />
                <span className="truncate">{b}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Corner pill — subtle, never negative */}
      <div
        className="absolute right-3 top-[42px] rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em]"
        style={{
          background: 'rgba(0,0,0,0.04)',
          border: '1px solid rgba(0,0,0,0.06)',
          color: 'rgba(0,0,0,0.4)',
        }}
      >
        {variant === 'after' ? 'Transformed' : 'Original'}
      </div>
    </div>
  )
}
