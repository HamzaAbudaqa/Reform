'use client'

/**
 * Mock-GitHub animation tuned to match what the user actually sees on
 * github.com when they land on the PR Reform opened. Dark theme, real
 * UI chrome (top tabs, PR title bar with the orange "Open" pill, the
 * Conversation/Commits/Checks tabs, the status card with the two green
 * check-circles), and the canonical blue "Merge pull request" button
 * that flips to a purple "Merged" state when the cursor taps it.
 *
 * Pure CSS keyframes; no images. Loops indefinitely. Honors
 * `prefers-reduced-motion` (cursor + button freeze in their initial
 * state so the page is still readable).
 *
 * Why a faithful mock matters: the user's own screenshots showed the
 * actual GitHub UI in dark mode with the blue merge button. Showing a
 * stylised green-button mock made the instruction ambiguous —
 * "click the green button" doesn't help when the button on screen is
 * blue. Match the reality, or don't show an animation.
 */
export default function GithubMergeWalkthrough() {
  return (
    <div className="gh-frame relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-black/[0.07] shadow-sm">
      {/* Browser address bar */}
      <div className="gh-browser flex items-center gap-1.5 px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-red-400/70" />
        <span className="h-2 w-2 rounded-full bg-amber-400/80" />
        <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
        <span className="ml-3 truncate rounded-md px-2 py-[3px] text-[9.5px] gh-url">
          github.com/your-repo/pull/2
        </span>
      </div>

      {/* Top GitHub tab nav (Code · Issues · Pull requests …) */}
      <div className="gh-topnav flex items-center gap-4 px-3.5 py-1.5">
        <Tab label="Code" />
        <Tab label="Issues" />
        <Tab label="Pull requests" badge="1" active />
        <Tab label="Actions" muted />
        <Tab label="Projects" muted />
      </div>

      {/* PR title row */}
      <div className="px-4 pt-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-baseline gap-1.5">
            <span className="truncate text-[13px] font-semibold gh-text-primary">Add Reform tracking</span>
            <span className="text-[12px] gh-text-muted">#2</span>
          </div>
          <span className="flex-shrink-0 rounded-full px-2 py-[2px] text-[9px] font-medium gh-ready">
            ✓ Ready to merge
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] gh-text-secondary">
          <span className="rounded-full px-1.5 py-[1px] text-[9px] font-semibold gh-open">Open</span>
          <span>wants to merge into</span>
          <code className="mono rounded px-1 py-[1px] gh-chip">main</code>
          <span>from</span>
          <code className="mono rounded px-1 py-[1px] gh-chip">reform/install-tracking</code>
        </div>
      </div>

      {/* Tab strip under the title */}
      <div className="mt-3 flex items-center gap-4 border-b px-4 gh-tabstrip">
        <SubTab label="Conversation" badge="1" active />
        <SubTab label="Commits" badge="1" />
        <SubTab label="Checks" badge="1" />
        <SubTab label="Files changed" badge="1" />
      </div>

      {/* Status card + merge button */}
      <div className="px-4 pt-3">
        <div className="rounded-md border px-3 py-2 gh-statusbox">
          <div className="flex items-center gap-1.5">
            <CheckDot />
            <span className="text-[10px] font-medium gh-text-primary">All checks have passed</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <CheckDot />
            <span className="text-[10px] font-medium gh-text-primary">No conflicts with base branch</span>
          </div>
        </div>

        {/* Merge button row */}
        <div className="merge-row mt-2.5 inline-flex items-stretch overflow-hidden rounded-md">
          <button type="button" tabIndex={-1} className="merge-btn relative inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold text-white">
            <span className="merge-glow absolute -inset-1 rounded-md" aria-hidden />
            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <path d="M5 3.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zm0 2.122a2.25 2.25 0 1 0-1.5 0v5.256a2.251 2.251 0 1 0 1.5 0V5.372zM5 14.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zm6.75-1.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5zm0-2.25a2.25 2.25 0 1 1 0 4.5 2.25 2.25 0 0 1 0-4.5zM12.5 4.687V8.5a3.5 3.5 0 0 1-3.5 3.5H8a.75.75 0 0 1 0-1.5h1A2 2 0 0 0 11 8.5V4.687a2.25 2.25 0 1 1 1.5 0z"/>
            </svg>
            <span className="merge-label-default">Merge pull request</span>
            <span className="merge-label-merged">Merged</span>
          </button>
          <button type="button" tabIndex={-1} className="merge-btn-caret inline-flex items-center px-1.5 text-white">
            <svg width="8" height="8" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <path d="M4 6l4 4 4-4z" />
            </svg>
          </button>
        </div>
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

      <style jsx>{`
        /* GitHub dark-mode palette (Primer) */
        .gh-frame {
          background: #0d1117;
          color: #c9d1d9;
        }
        .gh-browser {
          background: #161b22;
          border-bottom: 1px solid #21262d;
        }
        .gh-url {
          background: #0d1117;
          color: #6e7681;
          border: 1px solid #21262d;
        }
        .gh-topnav {
          background: #010409;
          border-bottom: 1px solid #21262d;
        }
        .gh-text-primary { color: #f0f6fc; }
        .gh-text-secondary { color: #c9d1d9; }
        .gh-text-muted { color: #8b949e; }
        .gh-chip {
          background: #6e768133;
          color: #79c0ff;
        }
        .gh-open {
          background: #1f6feb;
          color: #ffffff;
        }
        .gh-ready {
          background: #1f6feb1f;
          color: #58a6ff;
          border: 1px solid #1f6feb55;
        }
        .gh-tabstrip {
          border-bottom-color: #30363d;
        }
        .gh-statusbox {
          background: #0d1117;
          border-color: #30363d;
        }

        /* Merge button — exact GitHub blue + purple "Merged" state */
        .merge-row { box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.04); }
        .merge-btn {
          background: #1f6feb;
          animation: mergeBg 5s ease-in-out infinite;
        }
        .merge-btn-caret {
          background: #1f6febdd;
          border-left: 1px solid rgba(255, 255, 255, 0.12);
          animation: mergeBgCaret 5s ease-in-out infinite;
        }
        .merge-glow {
          background: radial-gradient(circle at center, rgba(56, 139, 253, 0.6), transparent 70%);
          opacity: 0;
          animation: mergeGlow 5s ease-in-out infinite;
        }
        .merge-label-default {
          opacity: 1;
          animation: mergeLabelOut 5s ease-in-out infinite;
        }
        .merge-label-merged {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          animation: mergeLabelIn 5s ease-in-out infinite;
        }
        .cursor {
          left: 78%;
          top: 26%;
          filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45));
          animation: cursorPath 5s ease-in-out infinite;
          transform-origin: top left;
        }

        @keyframes cursorPath {
          0%   { left: 78%; top: 26%; transform: scale(1); }
          8%   { left: 78%; top: 26%; transform: scale(1); }
          42%  { left: 14%; top: 80%; transform: scale(1); }
          48%  { left: 14%; top: 80%; transform: scale(0.82); }
          54%  { left: 14%; top: 80%; transform: scale(1); }
          92%  { left: 14%; top: 80%; transform: scale(1); }
          100% { left: 78%; top: 26%; transform: scale(1); }
        }
        @keyframes mergeBg {
          0%, 46%   { background: #1f6feb; }
          50%, 92%  { background: #8957e5; }
          96%, 100% { background: #1f6feb; }
        }
        @keyframes mergeBgCaret {
          0%, 46%   { background: #1f6febdd; }
          50%, 92%  { background: #8957e5dd; }
          96%, 100% { background: #1f6febdd; }
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
        @keyframes mergeLabelIn {
          0%, 46%   { opacity: 0; }
          50%, 92%  { opacity: 1; }
          96%, 100% { opacity: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .cursor, .merge-btn, .merge-btn-caret, .merge-glow,
          .merge-label-default, .merge-label-merged {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  )
}

// ── Tiny inline sub-components for legibility ────────────────────────

function Tab({ label, badge, active, muted }: { label: string; badge?: string; active?: boolean; muted?: boolean }) {
  return (
    <span
      className="flex items-center gap-1.5 text-[10px]"
      style={{
        color: active ? '#f0f6fc' : muted ? '#6e7681' : '#c9d1d9',
        borderBottom: active ? '2px solid #f78166' : '2px solid transparent',
        paddingBottom: 4,
        marginBottom: -6,
      }}
    >
      <span>{label}</span>
      {badge && (
        <span
          className="rounded-full px-1.5 py-[1px] text-[8.5px]"
          style={{ background: '#21262d', color: '#c9d1d9' }}
        >
          {badge}
        </span>
      )}
    </span>
  )
}

function SubTab({ label, badge, active }: { label: string; badge?: string; active?: boolean }) {
  return (
    <span
      className="flex items-center gap-1.5 text-[10px] font-semibold"
      style={{
        color: active ? '#f0f6fc' : '#8b949e',
        borderBottom: active ? '2px solid #f78166' : '2px solid transparent',
        paddingBottom: 6,
        marginBottom: -1,
      }}
    >
      <span>{label}</span>
      {badge && (
        <span
          className="rounded-full px-1.5 py-[1px] text-[8.5px] font-normal"
          style={{ background: '#21262d', color: '#c9d1d9' }}
        >
          {badge}
        </span>
      )}
    </span>
  )
}

function CheckDot() {
  return (
    <span
      className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full"
      style={{ background: '#3fb950' }}
    >
      <svg width="8" height="8" viewBox="0 0 16 16" fill="none" stroke="#0d1117" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="3 8 6.5 11 13 5" />
      </svg>
    </span>
  )
}
