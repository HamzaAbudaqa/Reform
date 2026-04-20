'use client'

import { useEffect, useRef, useState } from 'react'
import { apiUrl } from '@/lib/api'
import { humanizeResponse } from '@/lib/humanizeError'
import type { EventSummary, HeatmapSite, VerifyResult } from '@/types/heatmap'
import { mapEventSummary, mapVerify } from '@/types/heatmap'
import GithubMergeWalkthrough from './GithubMergeWalkthrough'

interface Props {
  site: HeatmapSite
  prUrl: string
  targetFile: string
  framework: string
  githubUserId: string
  onVerified: (site: HeatmapSite) => void
  /** Skip the "click Open GitHub first" gate — used when restoring a
   *  refreshed session that previously already opened the PR. */
  resumed?: boolean
}

const POLL_INTERVAL_MS = 6_000
const SUCCESS_HOLD_MS = 3_500   // celebrate for 3.5s before continuing

type WaitState = 'idle' | 'waiting' | 'success'

function relTime(ms: number): string {
  if (ms < 1000) return 'just now'
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  return `${m}m ago`
}

export default function AlmostDoneCard({
  site,
  prUrl,
  targetFile,
  framework,
  githubUserId,
  onVerified,
  resumed = false,
}: Props) {
  const [waitState, setWaitState] = useState<WaitState>(resumed ? 'waiting' : 'idle')
  const [openedGithub, setOpenedGithub] = useState(resumed)
  const [lastResult, setLastResult] = useState<VerifyResult | null>(null)
  const [eventSummary, setEventSummary] = useState<EventSummary | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  // True while a verify request is in flight. Drives button disabled state
  // + "Checking…" copy so the user gets immediate feedback when they click
  // "Check now" instead of wondering if the click registered.
  const [isChecking, setIsChecking] = useState(false)

  // Refs for values that shouldn't re-trigger the polling effect on every
  // parent re-render. The parent passes fresh `onVerified` + `site` refs
  // each render; putting them in useEffect deps was restarting the poll
  // loop constantly — Playwright-backed verify calls that take 5-25s would
  // get abandoned before ever resolving.
  const onVerifiedRef = useRef(onVerified)
  useEffect(() => { onVerifiedRef.current = onVerified }, [onVerified])
  const siteIdRef = useRef(site.id)
  useEffect(() => { siteIdRef.current = site.id }, [site.id])
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<number | null>(null)
  const cancelledRef = useRef(false)

  // Tick once a second so the "last checked Xs ago" / "waited Nm" labels
  // stay fresh without burning a render per ms.
  useEffect(() => {
    if (waitState !== 'waiting') return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [waitState])

  // One verify round trip. Shared by the poll loop and the manual Check
  // now button. Returns true if the snippet was detected (poll should stop).
  async function runVerify(): Promise<boolean> {
    if (cancelledRef.current) return false
    // Cancel any prior in-flight request — manual clicks should feel
    // instant, not stack behind a 25s Playwright call.
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setIsChecking(true)
    try {
      const res = await fetch(apiUrl(`/api/heatmap/sites/${siteIdRef.current}/verify`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ github_user_id: githubUserId }),
        signal: ctrl.signal,
      })
      if (!res.ok) throw new Error(await humanizeResponse(res, "We couldn't reach your site."))
      const result = mapVerify(await res.json())
      if (cancelledRef.current || ctrl.signal.aborted) return false
      setLastResult(result)
      setLastCheckedAt(Date.now())
      setAttempts(a => a + 1)
      if (result.snippetDetected) {
        setWaitState('success')
        try {
          const sumRes = await fetch(apiUrl(
            `/api/heatmap/sites/${siteIdRef.current}/event-summary?github_user_id=${encodeURIComponent(githubUserId)}`
          ))
          if (sumRes.ok && !cancelledRef.current) {
            setEventSummary(mapEventSummary(await sumRes.json()))
          }
        } catch { /* non-fatal */ }
        window.setTimeout(() => onVerifiedRef.current(site), SUCCESS_HOLD_MS)
        return true
      }
      return false
    } catch (err) {
      // AbortError is an expected control-flow signal — we cancelled on
      // purpose when a manual click pre-empted the poll. Don't count it as
      // a failed attempt, don't bump the retry UI.
      if ((err as { name?: string })?.name === 'AbortError') return false
      // Soft-fail still counts as an attempt so the user sees activity.
      setLastCheckedAt(Date.now())
      setAttempts(a => a + 1)
      return false
    } finally {
      if (abortRef.current === ctrl) {
        abortRef.current = null
        setIsChecking(false)
      }
    }
  }

  // Auto-poll once the user has clicked Open GitHub (or when we resumed
  // mid-flow from a persisted state). Before that, polling burns Playwright
  // calls + log noise for nothing.
  //
  // Deps are intentionally `[openedGithub]` only — we don't want the poll
  // loop to reset when the parent passes new `onVerified` / `site` refs
  // between renders (see ref-ping pattern above).
  useEffect(() => {
    if (!openedGithub) return
    cancelledRef.current = false
    setWaitState(s => (s === 'success' ? s : 'waiting'))

    async function loop() {
      while (!cancelledRef.current) {
        const done = await runVerify()
        if (done || cancelledRef.current) return
        await new Promise<void>(resolve => {
          timerRef.current = window.setTimeout(() => resolve(), POLL_INTERVAL_MS)
        })
      }
    }
    void loop()

    return () => {
      cancelledRef.current = true
      abortRef.current?.abort()
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openedGithub])

  async function handleCheckNow() {
    // Fire an immediate check and short-circuit the poll's sleep — the
    // current `await setTimeout` resolves as soon as we clearTimeout below.
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    await runVerify()
  }

  function handleOpenGithub() {
    setOpenedGithub(true)
    if (prUrl) window.open(prUrl, '_blank', 'noopener,noreferrer')
  }

  // ── Success state ─────────────────────────────────────────────────

  if (waitState === 'success') {
    return <SuccessCard summary={eventSummary} />
  }

  // ── Active "almost done" state ────────────────────────────────────

  return (
    <div className="rounded-[22px] border border-black/[0.07] bg-white p-7">
      <header className="mb-5 text-center">
        <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
          Almost done
        </p>
        <h2 className="text-[20px] font-semibold text-neutral-950" style={{ letterSpacing: '-0.01em' }}>
          {resumed ? 'Pick up where you left off' : 'Finish setup on GitHub'}
        </h2>
        <p className="mx-auto mt-1.5 max-w-md text-[13px] text-neutral-500">
          {resumed
            ? 'We already added tracking to your site. One click on GitHub and Reform will start collecting visitor data.'
            : 'We added tracking to your site for you. One last step on GitHub and Reform will start collecting visitor data.'}
        </p>
      </header>

      <div className="mb-5">
        <GithubMergeWalkthrough />
      </div>

      <ol className="mx-auto mb-5 max-w-md space-y-2.5 text-[13px] text-neutral-700">
        <Step n={1} active={!openedGithub}>
          Click <strong className="text-neutral-950">Open GitHub</strong> below
        </Step>
        <Step n={2} active={openedGithub}>
          On GitHub, click the blue <strong className="text-neutral-950">Merge</strong> button
        </Step>
        <Step n={3} active={false}>
          Come back here — we&apos;ll handle the rest
        </Step>
      </ol>

      {/* What you'll see on GitHub — beginner-friendly preview */}
      <div className="mx-auto mb-5 max-w-md rounded-xl border border-black/[0.06] bg-neutral-50 p-3.5">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
          What you&apos;ll see on GitHub
        </p>
        <ul className="space-y-1 text-[12px] text-neutral-600">
          <li>· A page with the change Reform prepared for you</li>
          <li>· A blue button labelled <strong className="text-neutral-900">Merge pull request</strong> near the bottom</li>
          <li>· Click it once, then come straight back here</li>
        </ul>
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          onClick={handleOpenGithub}
          className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-6 py-3 text-[13px] font-semibold text-white transition hover:bg-neutral-800"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.4 3-.405 1.02.005 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
          </svg>
          {openedGithub ? 'Open GitHub again' : 'Open GitHub'}
        </button>

        {openedGithub && waitState === 'waiting' && (
          <WaitingState
            site={site}
            attempts={attempts}
            lastCheckedAt={lastCheckedAt}
            now={now}
            lastResult={lastResult}
            isChecking={isChecking}
            onCheckNow={handleCheckNow}
          />
        )}

        {!openedGithub && (
          <p className="text-[11px] text-neutral-400">
            Opens in a new tab — this page will update automatically when you&apos;re done.
          </p>
        )}
      </div>

      {/* Tertiary detail behind a disclosure so it doesn't intimidate */}
      <details className="mx-auto mt-5 max-w-md text-[11.5px]">
        <summary className="cursor-pointer text-neutral-400 transition hover:text-neutral-700">
          What changed in your repo?
        </summary>
        <div className="mt-2 rounded-lg bg-neutral-50 p-3 text-neutral-600">
          <p>
            We added one line to <code className="mono text-neutral-950">{targetFile}</code> so
            Reform can load on every page of your site.
          </p>
          <p className="mt-1.5">Detected framework: {framework}.</p>
        </div>
      </details>

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────

function WaitingState({
  site,
  attempts,
  lastCheckedAt,
  now,
  lastResult,
  isChecking,
  onCheckNow,
}: {
  site: HeatmapSite
  attempts: number
  lastCheckedAt: number | null
  now: number
  lastResult: VerifyResult | null
  isChecking: boolean
  onCheckNow: () => void
}) {
  const elapsedSinceCheck = lastCheckedAt ? now - lastCheckedAt : null
  // Tiered hint copy — calm at first, more actionable as attempts pile up.
  let hint: string
  if (attempts <= 1) {
    hint = "We're checking for tracking automatically. You don't need to do anything else."
  } else if (attempts < 6) {
    hint = "Your host may still be redeploying — this usually takes 1-3 minutes."
  } else {
    hint = "Still no luck. Open your site below to check it loaded, or try Check now."
  }

  // Surface the actual verify error if the backend gave us a useful one
  // (the 5s timeout one was useless, but with the new fallback we can now
  // distinguish "tag not present" from "tag present but didn't run").
  const verifyHint = lastResult && !lastResult.snippetDetected && lastResult.error
    ? lastResult.error
    : null

  return (
    <div className="flex w-full flex-col items-center gap-2.5">
      <div className="flex items-center gap-2 text-[12.5px] font-medium text-neutral-700">
        <span
          className="h-3 w-3 rounded-full border-2 border-neutral-300 border-t-neutral-700"
          style={{ animation: 'spin 0.9s linear infinite' }}
        />
        <span>Checking your site for tracking…</span>
      </div>
      <p className="max-w-md text-center text-[11.5px] text-neutral-500">{hint}</p>

      {verifyHint && attempts >= 2 && (
        <p className="max-w-md text-center text-[11px] text-amber-700">{verifyHint}</p>
      )}

      <div className="mt-1 flex items-center gap-2">
        <button
          onClick={onCheckNow}
          disabled={isChecking}
          className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.12] bg-white px-3.5 py-1.5 text-[11.5px] font-medium text-neutral-950 transition hover:bg-neutral-50 disabled:cursor-wait disabled:opacity-60"
        >
          {isChecking && (
            <span
              className="h-2.5 w-2.5 rounded-full border-2 border-neutral-300 border-t-neutral-700"
              style={{ animation: 'spin 0.9s linear infinite' }}
            />
          )}
          {isChecking ? 'Checking…' : 'Check now'}
        </button>
        <a
          href={site.domain}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-black/[0.08] bg-white px-3.5 py-1.5 text-[11.5px] font-medium text-neutral-600 transition hover:text-neutral-950"
        >
          Open my site ↗
        </a>
      </div>

      <p className="text-[10.5px] text-neutral-400">
        {attempts === 0
          ? 'Starting check…'
          : `Checked ${attempts}× · last check ${elapsedSinceCheck != null ? relTime(elapsedSinceCheck) : 'just now'}`}
      </p>
    </div>
  )
}

function Step({ n, active, children }: { n: number; active: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10.5px] font-semibold transition ${
          active ? 'bg-neutral-950 text-white' : 'bg-neutral-100 text-neutral-500'
        }`}
      >
        {n}
      </span>
      <span className={active ? 'text-neutral-900' : 'text-neutral-500'}>{children}</span>
    </li>
  )
}

// ── Success card — proof-of-life moment before transitioning ────────

function SuccessCard({ summary }: { summary: EventSummary | null }) {
  return (
    <div className="rounded-[22px] border border-emerald-200/70 bg-emerald-50 p-7 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h2 className="text-[18px] font-semibold text-emerald-950">Tracking is live</h2>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] text-emerald-800">
        Reform is now collecting visitor behavior on your site.
      </p>

      {summary?.hasEvents && (
        <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-[11.5px] font-medium text-emerald-900">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span>
            First visitor activity received
            {summary.latestBrowserLabel && <> from {summary.latestBrowserLabel}</>}
            {!summary.latestBrowserLabel && summary.latestViewportClass && (
              <> from {summary.latestViewportClass}</>
            )}
          </span>
        </div>
      )}

      <p className="mt-4 text-[11.5px] text-emerald-700">Loading your dashboard…</p>
    </div>
  )
}
