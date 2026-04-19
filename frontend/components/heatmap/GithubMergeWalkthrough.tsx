'use client'

/**
 * Looping mock-GitHub animation that teaches a non-technical user the one
 * action they need to take after Reform opens a PR for them: find the
 * green "Merge pull request" button and click it.
 *
 * Pure CSS keyframes — no images, no JS animation libs. The whole scene
 * is one styled component with an absolutely-positioned cursor that moves
 * from the upper-right toward the merge button, taps it, and the button
 * transitions from green → purple "Merged" before the cycle repeats.
 *
 * Designed to be:
 *   • subtle (no jarring pops)
 *   • premium (matches the rest of the dashboard's neutral palette)
 *   • instructional (the only thing that pulses is the button to click)
 */
export default function GithubMergeWalkthrough() {
  return (
    <div className="walkthrough relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-black/[0.07] bg-white shadow-sm">
      {/* Mock browser chrome */}
      <div className="absolute inset-x-0 top-0 flex items-center gap-1.5 border-b border-black/[0.05] bg-neutral-50/90 px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-red-300/70" />
        <span className="h-2 w-2 rounded-full bg-amber-300/80" />
        <span className="h-2 w-2 rounded-full bg-emerald-300/80" />
        <span className="ml-3 truncate rounded-md bg-white px-2 py-[3px] text-[9.5px] text-neutral-400 ring-1 ring-black/[0.04]">
          github.com/your-repo/pull/…
        </span>
      </div>

      {/* PR content */}
      <div className="absolute inset-x-0 bottom-0 top-[28px] px-4 pt-3 pb-4">
        {/* Title row */}
        <div className="flex items-baseline gap-2">
          <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-wider text-emerald-700">
            Open
          </span>
          <span className="truncate text-[11px] font-semibold text-neutral-800">
            Add Reform tracking
          </span>
        </div>
        <div className="mt-1 text-[9px] text-neutral-400">
          <span className="rounded bg-neutral-100 px-1 py-0.5 mono">reform/install-tracking</span>
          {' wants to merge into '}
          <span className="rounded bg-neutral-100 px-1 py-0.5 mono">main</span>
        </div>

        {/* Checks row */}
        <div className="mt-3 flex items-center gap-2 rounded-md border border-emerald-200/60 bg-emerald-50/60 px-2.5 py-1.5">
          <span className="flex h-3 w-3 items-center justify-center rounded-full bg-emerald-500 text-[7.5px] text-white">✓</span>
          <span className="text-[9.5px] text-emerald-800">All checks passed · 1 file changed</span>
        </div>

        {/* The button */}
        <div className="merge-wrap absolute" style={{ left: '5%', top: '64%' }}>
          <span className="merge-glow absolute -inset-2 rounded-md" aria-hidden />
          <button
            type="button"
            tabIndex={-1}
            className="merge-btn relative inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[10px] font-semibold text-white"
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <path d="M5 3.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zm0 2.122a2.25 2.25 0 1 0-1.5 0v5.256a2.251 2.251 0 1 0 1.5 0V5.372zM5 14.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zm6.75-1.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5zm0-2.25a2.25 2.25 0 1 1 0 4.5 2.25 2.25 0 0 1 0-4.5zM12.5 4.687V8.5a3.5 3.5 0 0 1-3.5 3.5H8a.75.75 0 0 1 0-1.5h1A2 2 0 0 0 11 8.5V4.687a2.25 2.25 0 1 1 1.5 0z"/>
            </svg>
            <span className="merge-label">Merge pull request</span>
            <span className="merged-label">Merged</span>
          </button>
        </div>

        {/* Animated cursor */}
        <div className="cursor absolute pointer-events-none" aria-hidden>
          <svg width="14" height="17" viewBox="0 0 12 15" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M1 1L11 7L6.5 8L4 13L1 1Z"
              fill="white"
              stroke="#0a0a0a"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      <style jsx>{`
        .merge-btn {
          background: #16a34a;
          box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.18);
          animation: mergeBg 5s ease-in-out infinite;
        }
        .merge-glow {
          background: radial-gradient(circle at center, rgba(34, 197, 94, 0.55), transparent 70%);
          opacity: 0;
          animation: mergeGlow 5s ease-in-out infinite;
        }
        .merge-label {
          opacity: 1;
          animation: mergeLabelOut 5s ease-in-out infinite;
        }
        .merged-label {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          animation: mergedLabelIn 5s ease-in-out infinite;
        }
        .cursor {
          left: 78%;
          top: 22%;
          filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.18));
          animation: cursorPath 5s ease-in-out infinite;
          transform-origin: top left;
        }

        @keyframes cursorPath {
          0%   { left: 78%; top: 22%; transform: scale(1); }
          8%   { left: 78%; top: 22%; transform: scale(1); }
          42%  { left: 13%; top: 63%; transform: scale(1); }
          48%  { left: 13%; top: 63%; transform: scale(0.82); }
          54%  { left: 13%; top: 63%; transform: scale(1); }
          92%  { left: 13%; top: 63%; transform: scale(1); }
          100% { left: 78%; top: 22%; transform: scale(1); }
        }
        @keyframes mergeBg {
          0%, 46%   { background: #16a34a; }
          50%, 92%  { background: #6f42c1; }
          96%, 100% { background: #16a34a; }
        }
        @keyframes mergeGlow {
          0%, 22%   { opacity: 0; transform: scale(0.92); }
          32%       { opacity: 0.85; transform: scale(1.18); }
          46%       { opacity: 0; transform: scale(1.35); }
          100%      { opacity: 0; transform: scale(0.92); }
        }
        @keyframes mergeLabelOut {
          0%, 46%   { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        @keyframes mergedLabelIn {
          0%, 46%   { opacity: 0; }
          50%, 92%  { opacity: 1; }
          96%, 100% { opacity: 0; }
        }

        /* Respect users who've turned reduced-motion on. The instructional
           value of the animation is low if it's distracting them. */
        @media (prefers-reduced-motion: reduce) {
          .cursor, .merge-btn, .merge-glow, .merge-label, .merged-label {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  )
}
