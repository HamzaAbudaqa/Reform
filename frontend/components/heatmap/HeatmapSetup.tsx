'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { apiUrl } from '@/lib/api'
import type { AutoInstallResult, HeatmapSite, VerifyResult } from '@/types/heatmap'
import { mapAutoInstall, mapSite, mapVerify } from '@/types/heatmap'
import AlmostDoneCard from './AlmostDoneCard'

interface Props {
  githubUserId: string
  projectId: string
  initialSite: HeatmapSite | null
  onSiteReady: (site: HeatmapSite) => void
  onVerified: (site: HeatmapSite) => void
}

// Reconstruct the snippet from the frontend's known API base. The backend
// also self-references in /h.js, but this guarantees the *displayed* snippet
// can never accidentally show a localhost URL even if env vars drift.
function buildSnippet(siteKey: string): string {
  return `<script async src="${apiUrl(`/api/heatmap/h.js?site=${siteKey}`)}"></script>`
}

// Phases of the onboarding flow.
//   url          — user hasn't entered/confirmed a site URL yet
//   choice       — site exists; offer auto-install vs. manual
//   installing   — auto-install POST is in flight
//   almost-done  — auto-install succeeded → show GitHub merge walkthrough
//   manual       — user picked manual install (existing 3-step flow)
type Phase = 'url' | 'choice' | 'installing' | 'almost-done' | 'manual'

// Map persisted site state → starting phase. This is what makes the flow
// feel durable: a refresh, a tab close, or a return-tomorrow all land in
// the same place the user left.
function phaseForSite(site: HeatmapSite | null): Phase {
  if (!site) return 'url'
  if (site.installStatus === 'awaiting_github_action' && site.installPrUrl) {
    return 'almost-done'
  }
  if (site.installStatus === 'manual_fallback' || site.installMode === 'manual') {
    return 'manual'
  }
  // 'tracking_live' shouldn't reach here — the parent gates on verifiedAt and
  // unmounts setup. If it does (race), keep the user on the choice card.
  return 'choice'
}

// Reconstruct an AutoInstallResult shape from persisted site state so the
// AlmostDoneCard can render after a refresh without re-running auto-install.
function resultFromSite(site: HeatmapSite): AutoInstallResult | null {
  if (!site.installPrUrl) return null
  return {
    success: true,
    prUrl: site.installPrUrl,
    prNumber: site.installPrNumber ?? 0,
    branchName: site.installBranchName ?? '',
    branchUrl: '',
    targetFile: site.installTargetFile ?? '',
    framework: site.installFramework ?? '',
    error: null,
    errorKind: null,
  }
}

export default function HeatmapSetup({
  githubUserId,
  projectId,
  initialSite,
  onSiteReady,
  onVerified,
}: Props) {
  const { data: session } = useSession()
  const accessToken = session?.accessToken ?? ''

  const [domain, setDomain] = useState(initialSite?.domain ?? '')
  const [site, setSite] = useState<HeatmapSite | null>(initialSite)
  const [phase, setPhase] = useState<Phase>(phaseForSite(initialSite))
  // True when we landed on `almost-done` because the persisted site already
  // had a PR — vs. just having created one. AlmostDoneCard uses this to skip
  // the "click Open GitHub first" gate and start polling immediately.
  const [resumedAlmostDone, setResumedAlmostDone] = useState(
    () => phaseForSite(initialSite) === 'almost-done',
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [installResult, setInstallResult] = useState<AutoInstallResult | null>(
    () => (initialSite ? resultFromSite(initialSite) : null),
  )
  // Surface the *prior* failure (if any) so the user gets context on resume.
  const [installError, setInstallError] = useState<string | null>(
    () => (initialSite?.installStatus === 'failed' ? initialSite.installError : null),
  )
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [editingUrl, setEditingUrl] = useState(!initialSite)

  // ── URL step ─────────────────────────────────────────────────────────

  async function saveSite() {
    setBusy(true)
    setError(null)
    try {
      const trimmed = domain.trim()
      if (!/^https?:\/\//i.test(trimmed)) {
        throw new Error('Please include https:// at the start of your URL.')
      }
      const res = await fetch(apiUrl('/api/heatmap/sites'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          github_user_id: githubUserId,
          project_id: projectId,
          domain: trimmed,
        }),
      })
      if (!res.ok) throw new Error((await res.text()) || `We couldn't save your site (${res.status}).`)
      const next = mapSite(await res.json())
      setSite(next)
      setEditingUrl(false)
      setVerifyResult(null)
      // POST /sites is idempotent — if the user re-entered the same URL we
      // get back the existing site with whatever install state it had. Honor
      // that so we restore the right phase instead of starting over.
      const restoredResult = resultFromSite(next)
      setInstallResult(restoredResult)
      setInstallError(next.installStatus === 'failed' ? next.installError : null)
      onSiteReady(next)
      const restoredPhase = phaseForSite(next)
      setResumedAlmostDone(restoredPhase === 'almost-done')
      setPhase(restoredPhase)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  // ── Auto-install path ────────────────────────────────────────────────

  async function startAutoInstall() {
    if (!site) return
    if (!accessToken) {
      setInstallError(
        "We couldn't find your GitHub session. Try signing out and back in, then try again — or install manually.",
      )
      return
    }
    setPhase('installing')
    setInstallError(null)
    try {
      const res = await fetch(apiUrl(`/api/heatmap/sites/${site.id}/auto-install`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          github_user_id: githubUserId,
          access_token: accessToken,
        }),
      })
      if (!res.ok) {
        const text = (await res.text()) || `Auto-install failed (${res.status}).`
        throw new Error(text)
      }
      const result = mapAutoInstall(await res.json())
      setInstallResult(result)

      if (result.success) {
        // "already_installed" is also success — the Almost Done card will
        // poll and likely flip to verified within a few seconds.
        setResumedAlmostDone(false)
        setPhase('almost-done')
      } else {
        // Friendly message + drop into manual flow so the user is never stuck.
        setInstallError(result.error || "We couldn't add tracking automatically.")
        setPhase('choice')
      }
    } catch (e) {
      setInstallError(e instanceof Error ? e.message : 'Something went wrong')
      setPhase('choice')
    }
  }

  // ── Install-mode persistence ─────────────────────────────────────────

  // Fire-and-forget: record the install path so a refresh resumes here.
  // We intentionally don't await — the optimistic UI shouldn't block on
  // a background bookkeeping write. If it fails, the user just sees a
  // slightly stale state on next refresh, never a broken flow.
  async function persistMode(mode: 'manual' | 'automatic' | 'not_started') {
    if (!site) return
    try {
      const res = await fetch(apiUrl(`/api/heatmap/sites/${site.id}/install-mode`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ github_user_id: githubUserId, mode }),
      })
      if (res.ok) {
        const next = mapSite(await res.json())
        setSite(next)
      }
    } catch {
      /* non-fatal */
    }
  }

  function chooseManual() {
    setPhase('manual')
    setError(null)
    void persistMode('manual')
  }

  function backToChoice() {
    setPhase('choice')
    setVerifyResult(null)
    setError(null)
    void persistMode('not_started')
  }

  // ── Manual install path ──────────────────────────────────────────────

  async function checkInstallation() {
    if (!site) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(apiUrl(`/api/heatmap/sites/${site.id}/verify`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ github_user_id: githubUserId }),
      })
      if (!res.ok) throw new Error((await res.text()) || `We couldn't reach your site right now (${res.status}).`)
      const vr = mapVerify(await res.json())
      setVerifyResult(vr)
      if (vr.snippetDetected) onVerified(site)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  async function copyCode() {
    if (!site) return
    try {
      await navigator.clipboard.writeText(buildSnippet(site.siteKey))
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard unavailable — silently noop */
    }
  }

  // ── Render ───────────────────────────────────────────────────────────

  // Phase: almost-done → render the dedicated card with the merge animation
  // and auto-polling. Header + privacy footer stay for context.
  if (site && phase === 'almost-done' && installResult?.success) {
    return (
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 text-center">
          <h1 className="mb-2 text-3xl font-bold text-neutral-950" style={{ letterSpacing: '-0.02em' }}>
            Set up tracking
          </h1>
          <p className="text-[14px] text-neutral-500">{site.domain}</p>
        </header>
        <AlmostDoneCard
          site={site}
          prUrl={installResult.prUrl}
          targetFile={installResult.targetFile}
          framework={installResult.framework}
          githubUserId={githubUserId}
          onVerified={onVerified}
          resumed={resumedAlmostDone}
        />
        <PrivacyFooter />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold text-neutral-950" style={{ letterSpacing: '-0.02em' }}>
          Set up tracking
        </h1>
        <p className="text-[14px] text-neutral-500">
          We&apos;ll add a small piece of code to your site so Reform can show you visitor
          heatmaps and behavior insights.
        </p>
      </header>

      {/* Step 1 — Your website URL */}
      <Step n={1} title="Your website URL" done={!!site && !editingUrl}>
        {!site || editingUrl ? (
          <div>
            <div className="flex gap-2">
              <input
                type="url"
                value={domain}
                onChange={e => setDomain(e.target.value)}
                placeholder="https://www.mywebsite.com"
                disabled={busy}
                onKeyDown={e => {
                  if (e.key === 'Enter' && domain.trim()) saveSite()
                }}
                className="flex-1 rounded-full border border-black/[0.08] bg-neutral-50 px-4 py-2.5 text-[13px] text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-black/[0.25] focus:bg-white disabled:opacity-50"
              />
              <button
                onClick={saveSite}
                disabled={busy || !domain.trim()}
                className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-5 py-2.5 text-[12px] font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
              >
                {busy ? 'Saving…' : 'Continue'}
              </button>
            </div>
            <p className="mt-2 text-[11.5px] text-neutral-400">
              The full URL of your live site, including https://
            </p>
            {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-[13px] text-neutral-700">{site.domain}</span>
            <button
              onClick={() => {
                setEditingUrl(true)
                setVerifyResult(null)
                setInstallResult(null)
                setInstallError(null)
                setResumedAlmostDone(false)
                setPhase('url')
              }}
              className="flex-shrink-0 text-[11.5px] font-medium text-neutral-500 transition hover:text-neutral-950"
            >
              Change
            </button>
          </div>
        )}
      </Step>

      {/* Step 2 — Install path */}
      {site && !editingUrl && phase === 'choice' && (
        <ChoiceCard
          onAuto={startAutoInstall}
          onManual={chooseManual}
          installError={installError}
          hasGithubAuth={!!accessToken}
        />
      )}

      {site && !editingUrl && phase === 'installing' && <InstallingCard domain={site.domain} />}

      {site && !editingUrl && phase === 'manual' && (
        <ManualInstall
          snippet={buildSnippet(site.siteKey)}
          onCopy={copyCode}
          copied={copied}
          checking={busy}
          onCheck={checkInstallation}
          verifyResult={verifyResult}
          onBack={backToChoice}
          error={error}
        />
      )}

      <PrivacyFooter />
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────

function Step({
  n,
  title,
  done,
  children,
}: {
  n: number
  title: string
  done: boolean
  children: React.ReactNode
}) {
  return (
    <section
      className={`mb-3 rounded-[22px] border bg-white p-6 transition ${
        done ? 'border-emerald-200/70' : 'border-black/[0.07]'
      }`}
    >
      <div className="mb-4 flex items-center gap-3">
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold transition ${
            done ? 'bg-emerald-500 text-white' : 'bg-neutral-100 text-neutral-700'
          }`}
        >
          {done ? '✓' : n}
        </div>
        <h2 className="text-[15px] font-semibold text-neutral-950">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function ChoiceCard({
  onAuto,
  onManual,
  installError,
  hasGithubAuth,
}: {
  onAuto: () => void
  onManual: () => void
  installError: string | null
  hasGithubAuth: boolean
}) {
  return (
    <section className="mb-3 rounded-[22px] border border-black/[0.07] bg-white p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-[12px] font-semibold text-neutral-700">
          2
        </div>
        <h2 className="text-[15px] font-semibold text-neutral-950">Add tracking to your site</h2>
      </div>

      {installError && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-[12px] text-amber-900">
          <p className="mb-0.5 font-semibold">Auto-install didn&apos;t work this time</p>
          <p className="text-amber-800">{installError}</p>
        </div>
      )}

      <button
        onClick={onAuto}
        disabled={!hasGithubAuth}
        className="group mb-3 flex w-full items-center gap-4 rounded-2xl border border-black/[0.08] bg-white p-4 text-left transition hover:border-black/[0.18] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
      >
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-neutral-950 text-white">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9.5 2L11 7H17L12.5 10.5L14 16L9.5 12.5L5 16L6.5 10.5L2 7H8L9.5 2Z" />
          </svg>
        </div>
        <div className="flex-1">
          <div className="text-[14px] font-semibold text-neutral-950">Install tracking automatically</div>
          <div className="mt-0.5 text-[12px] text-neutral-500">
            We&apos;ll add the code to your site for you and open a GitHub change you can review.
          </div>
        </div>
        <svg className="text-neutral-300 transition group-hover:text-neutral-700" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      <button
        onClick={onManual}
        className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-medium text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-950"
      >
        I&apos;ll do it myself
      </button>

      {!hasGithubAuth && (
        <p className="mt-3 text-center text-[11px] text-amber-600">
          Sign in with GitHub to use auto-install, or pick the manual option.
        </p>
      )}
    </section>
  )
}

function InstallingCard({ domain }: { domain: string }) {
  return (
    <section className="mb-3 rounded-[22px] border border-black/[0.07] bg-white p-7 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
        <span
          className="h-5 w-5 rounded-full border-[2.5px] border-neutral-200 border-t-neutral-900"
          style={{ animation: 'hmSpin 0.85s linear infinite' }}
        />
      </div>
      <h2 className="text-[16px] font-semibold text-neutral-950">Setting things up…</h2>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] text-neutral-500">
        Reading your site, finding the right place to add tracking, and preparing a change for{' '}
        <span className="text-neutral-700">{domain}</span>. This usually takes 10–20 seconds.
      </p>
      <style jsx>{`
        @keyframes hmSpin { to { transform: rotate(360deg); } }
      `}</style>
    </section>
  )
}

function ManualInstall({
  snippet,
  onCopy,
  copied,
  checking,
  onCheck,
  verifyResult,
  onBack,
  error,
}: {
  snippet: string
  onCopy: () => void
  copied: boolean
  checking: boolean
  onCheck: () => void
  verifyResult: VerifyResult | null
  onBack: () => void
  error: string | null
}) {
  const installed = verifyResult?.snippetDetected ?? false
  return (
    <>
      {/* Step 2 — Add the code yourself */}
      <section
        className={`mb-3 rounded-[22px] border bg-white p-6 transition ${
          installed ? 'border-emerald-200/70' : 'border-black/[0.07]'
        }`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold transition ${
                installed ? 'bg-emerald-500 text-white' : 'bg-neutral-100 text-neutral-700'
              }`}
            >
              {installed ? '✓' : '2'}
            </div>
            <h2 className="text-[15px] font-semibold text-neutral-950">Add tracking yourself</h2>
          </div>
          <button
            onClick={onBack}
            className="text-[11.5px] font-medium text-neutral-500 transition hover:text-neutral-950"
          >
            ← Back
          </button>
        </div>

        <div className="mb-3 overflow-x-auto rounded-xl border border-black/[0.06] bg-neutral-50 p-3.5">
          <code className="mono whitespace-pre-wrap break-all text-[11.5px] leading-relaxed text-neutral-700">
            {snippet}
          </code>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <button
            onClick={onCopy}
            className="rounded-full border border-black/[0.12] bg-white px-3.5 py-1.5 text-[11.5px] font-medium text-neutral-950 transition hover:bg-neutral-50"
          >
            {copied ? 'Copied ✓' : 'Copy code'}
          </button>
          <span className="text-[11.5px] text-neutral-500">Paste it into your site, then publish.</span>
        </div>
        <PasteHelp />
      </section>

      {/* Step 3 — Check installation */}
      <section
        className={`mb-3 rounded-[22px] border bg-white p-6 transition ${
          installed ? 'border-emerald-200/70' : 'border-black/[0.07]'
        }`}
      >
        <div className="mb-4 flex items-center gap-3">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold transition ${
              installed ? 'bg-emerald-500 text-white' : 'bg-neutral-100 text-neutral-700'
            }`}
          >
            {installed ? '✓' : '3'}
          </div>
          <h2 className="text-[15px] font-semibold text-neutral-950">Check installation</h2>
        </div>
        <p className="mb-3 text-[13px] text-neutral-600">
          Once your site is live with the code, click below and we&apos;ll confirm tracking is working.
        </p>
        <button
          onClick={onCheck}
          disabled={checking}
          className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-5 py-2.5 text-[12.5px] font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60"
        >
          {checking ? 'Checking…' : verifyResult ? 'Check again' : 'Check installation'}
        </button>
        {verifyResult && <CheckResultBlock result={verifyResult} />}
        {error && !verifyResult && <p className="mt-3 text-[12px] text-red-600">{error}</p>}
      </section>
    </>
  )
}

function PasteHelp() {
  return (
    <details className="group rounded-xl border border-black/[0.06] bg-white open:bg-neutral-50/60">
      <summary className="cursor-pointer list-none px-3.5 py-2.5 text-[12px] font-medium text-neutral-700 transition hover:text-neutral-950">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block transition group-open:rotate-90">›</span>
          Where do I paste this code?
        </span>
      </summary>
      <div className="px-3.5 pb-3.5 pt-1 text-[12px] text-neutral-600">
        <ul className="space-y-1.5">
          <li><strong className="text-neutral-950">Webflow</strong> — Project Settings → Custom Code → Head Code</li>
          <li><strong className="text-neutral-950">Shopify</strong> — Online Store → Themes → Edit Code → <code className="mono">theme.liquid</code></li>
          <li><strong className="text-neutral-950">Framer</strong> — Site Settings → Custom Code → Head</li>
          <li><strong className="text-neutral-950">WordPress</strong> — Appearance → Theme File Editor → <code className="mono">header.php</code> (or use a header-script plugin)</li>
          <li><strong className="text-neutral-950">Squarespace / Wix</strong> — Settings → Advanced → Custom Code (header)</li>
          <li><strong className="text-neutral-950">Plain HTML</strong> — anywhere inside the <code className="mono">&lt;head&gt;</code> of your pages</li>
        </ul>
        <p className="mt-3 text-[11.5px] text-neutral-500">
          You only need to add it once — Reform tracks every page on your site automatically.
        </p>
      </div>
    </details>
  )
}

function CheckResultBlock({ result }: { result: VerifyResult }) {
  if (result.snippetDetected) {
    return (
      <div className="mt-4 rounded-xl border border-emerald-200/70 bg-emerald-50 p-4">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[11px] text-white">
            ✓
          </div>
          <div>
            <p className="text-[13.5px] font-semibold text-emerald-950">Tracking is live!</p>
            <p className="mt-0.5 text-[12px] text-emerald-800">
              Reform is now collecting visitor behavior on your site. Once enough activity comes in,
              you&apos;ll see heatmaps and suggestions here.
            </p>
          </div>
        </div>
      </div>
    )
  }
  if (!result.reachable) {
    return (
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-[13px] font-semibold text-amber-900">We couldn&apos;t reach your site.</p>
        <p className="mt-1 text-[12px] text-amber-800">
          Double-check the URL above and make sure your site is publicly accessible — not behind a
          login or a password.
        </p>
      </div>
    )
  }
  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-[13px] font-semibold text-amber-900">
        We couldn&apos;t find Reform on your site yet.
      </p>
      <p className="mt-1 text-[12px] text-amber-800">Make sure you:</p>
      <ul className="ml-1 mt-1 list-inside list-disc space-y-0.5 text-[12px] text-amber-800">
        <li>added the tracking code from step 2</li>
        <li>published your site (a preview deployment isn&apos;t enough)</li>
      </ul>
      <p className="mt-2 text-[12px] text-amber-800">
        Then click <strong>Check installation</strong> again.
      </p>
    </div>
  )
}

function PrivacyFooter() {
  return (
    <p className="mt-6 text-center text-[11px] text-neutral-400">
      We don&apos;t track form values, cookies, localStorage, or any personal data. Events are
      aggregated into 50×50 heat buckets — raw events are never stored.
    </p>
  )
}
