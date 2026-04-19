'use client'

import { useState } from 'react'
import { apiUrl } from '@/lib/api'
import type { HeatmapSite, VerifyResult } from '@/types/heatmap'
import { mapSite, mapVerify } from '@/types/heatmap'

interface Props {
  githubUserId: string
  projectId: string
  initialSite: HeatmapSite | null
  onSiteReady: (site: HeatmapSite) => void
  onVerified: (site: HeatmapSite) => void
}

type Status = 'idle' | 'creating' | 'checking' | 'error'

// Whatever URL the backend baked into site.snippet may be wrong: if
// API_BASE_URL isn't set in prod, it falls back to localhost:8000 and the
// user copies a snippet that works on no real site. The frontend always
// knows the live backend (via NEXT_PUBLIC_API_URL), so reconstruct the
// snippet here. The served h.js separately self-references its own host
// for the COLLECT_URL — see api_base_from_request on the backend.
function buildSnippet(siteKey: string): string {
  return `<script async src="${apiUrl(`/api/heatmap/h.js?site=${siteKey}`)}"></script>`
}

export default function HeatmapSetup({
  githubUserId,
  projectId,
  initialSite,
  onSiteReady,
  onVerified,
}: Props) {
  const [domain, setDomain] = useState(initialSite?.domain ?? '')
  const [site, setSite] = useState<HeatmapSite | null>(initialSite)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [editingUrl, setEditingUrl] = useState(!initialSite)

  async function saveSite() {
    setStatus('creating')
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
      // URL changed — any prior verification result no longer applies.
      setVerifyResult(null)
      onSiteReady(next)
      setStatus('idle')
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Something went wrong')
    }
  }

  async function checkInstallation() {
    if (!site) return
    setStatus('checking')
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
      setStatus('idle')
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Something went wrong')
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

  const codeShown = site && !editingUrl
  const installed = !!verifyResult?.snippetDetected

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold text-neutral-950" style={{ letterSpacing: '-0.02em' }}>
          Set up tracking
        </h1>
        <p className="text-[14px] text-neutral-500">
          Add a small piece of code to your site. Reform will start tracking visitor activity automatically.
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
                disabled={status === 'creating'}
                onKeyDown={e => {
                  if (e.key === 'Enter' && domain.trim()) saveSite()
                }}
                className="flex-1 rounded-full border border-black/[0.08] bg-neutral-50 px-4 py-2.5 text-[13px] text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-black/[0.25] focus:bg-white disabled:opacity-50"
              />
              <button
                onClick={saveSite}
                disabled={status === 'creating' || !domain.trim()}
                className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-5 py-2.5 text-[12px] font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
              >
                {status === 'creating' ? 'Saving…' : 'Continue'}
              </button>
            </div>
            <p className="mt-2 text-[11.5px] text-neutral-400">
              The full URL of your live site, including https://
            </p>
            {error && status === 'error' && (
              <p className="mt-2 text-[12px] text-red-600">{error}</p>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-[13px] text-neutral-700">{site.domain}</span>
            <button
              onClick={() => {
                setEditingUrl(true)
                setVerifyResult(null)
              }}
              className="flex-shrink-0 text-[11.5px] font-medium text-neutral-500 transition hover:text-neutral-950"
            >
              Change
            </button>
          </div>
        )}
      </Step>

      {/* Step 2 — Add the tracking code */}
      {codeShown && (
        <Step n={2} title="Add the tracking code" done={installed}>
          <div className="mb-3 overflow-x-auto rounded-xl border border-black/[0.06] bg-neutral-50 p-3.5">
            <code className="mono whitespace-pre-wrap break-all text-[11.5px] leading-relaxed text-neutral-700">
              {buildSnippet(site!.siteKey)}
            </code>
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-2.5">
            <button
              onClick={copyCode}
              className="rounded-full border border-black/[0.12] bg-white px-3.5 py-1.5 text-[11.5px] font-medium text-neutral-950 transition hover:bg-neutral-50"
            >
              {copied ? 'Copied ✓' : 'Copy code'}
            </button>
            <span className="text-[11.5px] text-neutral-500">Add it to your site, then publish.</span>
          </div>
          <PasteHelp />
        </Step>
      )}

      {/* Step 3 — Check installation */}
      {codeShown && (
        <Step n={3} title="Check installation" done={installed} muted={!verifyResult && !installed}>
          <p className="mb-3 text-[13px] text-neutral-600">
            Once your site is live with the code, click below and we&apos;ll confirm tracking is working.
          </p>
          <button
            onClick={checkInstallation}
            disabled={status === 'checking'}
            className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-5 py-2.5 text-[12.5px] font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60"
          >
            {status === 'checking' ? 'Checking…' : verifyResult ? 'Check again' : 'Check installation'}
          </button>
          {verifyResult && <CheckResult result={verifyResult} />}
          {error && status === 'error' && site && !verifyResult && (
            <p className="mt-3 text-[12px] text-red-600">{error}</p>
          )}
        </Step>
      )}

      <p className="mt-6 text-center text-[11px] text-neutral-400">
        We don&apos;t track form values, cookies, localStorage, or any personal data. Events are
        aggregated into 50×50 heat buckets — raw events are never stored.
      </p>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────

function Step({
  n,
  title,
  done,
  muted,
  children,
}: {
  n: number
  title: string
  done: boolean
  muted?: boolean
  children: React.ReactNode
}) {
  return (
    <section
      className={`mb-3 rounded-[22px] border bg-white p-6 transition ${
        done ? 'border-emerald-200/70' : 'border-black/[0.07]'
      } ${muted ? 'opacity-90' : ''}`}
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
          <li>
            <strong className="text-neutral-950">Vercel / Next.js</strong> — your root{' '}
            <code className="mono">app/layout.tsx</code> (inside the <code className="mono">&lt;head&gt;</code>)
          </li>
          <li>
            <strong className="text-neutral-950">Webflow</strong> — Project Settings → Custom Code → Head Code
          </li>
          <li>
            <strong className="text-neutral-950">Shopify</strong> — Online Store → Themes → Edit Code →{' '}
            <code className="mono">theme.liquid</code>
          </li>
          <li>
            <strong className="text-neutral-950">Framer</strong> — Site Settings → Custom Code → Head
          </li>
          <li>
            <strong className="text-neutral-950">Squarespace / Wix</strong> — Settings → Advanced → Custom Code (header)
          </li>
          <li>
            <strong className="text-neutral-950">Plain HTML</strong> — anywhere inside the{' '}
            <code className="mono">&lt;head&gt;</code> of your pages
          </li>
        </ul>
        <p className="mt-3 text-[11.5px] text-neutral-500">
          You only need to add it once — Reform tracks every page on your site automatically.
        </p>
      </div>
    </details>
  )
}

function CheckResult({ result }: { result: VerifyResult }) {
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
