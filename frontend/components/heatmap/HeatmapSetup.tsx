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

type Status = 'idle' | 'creating' | 'verifying' | 'error'

export default function HeatmapSetup({ githubUserId, projectId, initialSite, onSiteReady, onVerified }: Props) {
  const [domain, setDomain] = useState(initialSite?.domain ?? '')
  const [site, setSite] = useState<HeatmapSite | null>(initialSite)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null)
  const [copied, setCopied] = useState(false)

  async function createSite() {
    setStatus('creating')
    setError(null)
    try {
      const trimmed = domain.trim()
      if (!/^https?:\/\//i.test(trimmed)) {
        throw new Error('Domain must start with http:// or https://')
      }
      const res = await fetch(apiUrl('/api/heatmap/sites'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ github_user_id: githubUserId, project_id: projectId, domain: trimmed }),
      })
      if (!res.ok) throw new Error(await res.text() || `Request failed (${res.status})`)
      const next = mapSite(await res.json())
      setSite(next)
      onSiteReady(next)
      await verifyNow(next)
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Unknown error')
    }
  }

  async function verifyNow(target?: HeatmapSite) {
    const current = target ?? site
    if (!current) return
    setStatus('verifying')
    setError(null)
    try {
      const res = await fetch(apiUrl(`/api/heatmap/sites/${current.id}/verify`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ github_user_id: githubUserId }),
      })
      if (!res.ok) throw new Error(await res.text() || `Verify failed (${res.status})`)
      const vr = mapVerify(await res.json())
      setVerifyResult(vr)
      if (vr.snippetDetected) {
        onVerified(current)
      }
      setStatus('idle')
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Unknown error')
    }
  }

  async function copySnippet() {
    if (!site) return
    try {
      await navigator.clipboard.writeText(site.snippet)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard not available — ignore
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="mb-2 text-3xl font-bold text-neutral-950" style={{ letterSpacing: '-0.02em' }}>
          Heatmap tracking
        </h1>
        <p className="text-[13px] text-neutral-500">
          Paste your deployed site URL. We&apos;ll give you a one-line snippet to install and verify it&apos;s live.
        </p>
      </div>

      <section className="mb-4 rounded-[22px] border border-black/[0.07] bg-white p-6">
        <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
          Deployed site URL
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            value={domain}
            onChange={e => setDomain(e.target.value)}
            placeholder="https://www.mywebsite.com"
            disabled={status === 'creating'}
            className="flex-1 rounded-full border border-black/[0.08] bg-neutral-50 px-4 py-2.5 text-[13px] text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-black/[0.25] focus:bg-white disabled:opacity-50"
            onKeyDown={e => { if (e.key === 'Enter') createSite() }}
          />
          <button
            onClick={createSite}
            disabled={status === 'creating' || !domain.trim()}
            className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-5 py-2.5 text-[12px] font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
          >
            {status === 'creating' ? 'Creating…' : site ? 'Update' : 'Create site'}
          </button>
        </div>
        {error && (
          <div className="mt-3 text-[12px]" style={{ color: '#dc2626' }}>
            {error}
          </div>
        )}
      </section>

      {site && (
        <section className="mb-4 rounded-[22px] border border-black/[0.07] bg-white p-6">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
            Install snippet
          </div>
          <div
            className="mono mb-3 overflow-x-auto rounded-xl border border-black/[0.06] bg-neutral-50 p-3 text-[11.5px] leading-relaxed text-neutral-700"
          >
            {site.snippet}
          </div>
          <ol className="mb-4 space-y-1.5 text-[12px] text-neutral-600">
            <li>1. Paste the snippet inside <code className="mono text-neutral-950">&lt;head&gt;</code> of your site.</li>
            <li>2. Deploy.</li>
            <li>3. Come back and click <strong className="text-neutral-950">Verify installation</strong>.</li>
          </ol>
          <div className="flex items-center gap-2">
            <button
              onClick={copySnippet}
              className="rounded-full border border-black/[0.12] bg-white px-3 py-1.5 text-[11px] font-medium text-neutral-950 transition hover:bg-neutral-50"
            >
              {copied ? 'Copied' : 'Copy snippet'}
            </button>
            <button
              onClick={() => verifyNow()}
              disabled={status === 'verifying'}
              className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
            >
              {status === 'verifying' ? 'Verifying…' : 'Verify installation'}
            </button>
            <span className="ml-2 text-[11px] text-neutral-400">
              site_key: <span className="mono text-neutral-600">{site.siteKey.slice(0, 8)}…</span>
            </span>
          </div>
          {verifyResult && <VerifyStatus result={verifyResult} />}
        </section>
      )}

      <p className="text-center text-[11px] text-neutral-400">
        We don&apos;t track form values, cookies, localStorage, or any personal data.
        Events are aggregated into 50×50 heat buckets — raw events are never stored.
      </p>
    </div>
  )
}

function VerifyStatus({ result }: { result: VerifyResult }) {
  if (result.snippetDetected) {
    return (
      <div className="mt-3 text-[12px]" style={{ color: '#16a34a' }}>
        Snippet detected. Open your site in another tab and interact — the heatmap tab updates as events arrive.
      </div>
    )
  }
  if (!result.reachable) {
    return (
      <div className="mt-3 text-[12px]" style={{ color: '#dc2626' }}>
        Site not reachable{result.error ? ` — ${result.error}` : ''}. Double-check the URL and that it&apos;s publicly accessible.
      </div>
    )
  }
  return (
    <div className="mt-3 text-[12px]" style={{ color: '#b45309' }}>
      Site is live but the snippet wasn&apos;t found within 5s. Make sure the <code className="mono">&lt;script&gt;</code> tag is in <code className="mono">&lt;head&gt;</code> of the deployed build.
    </div>
  )
}
