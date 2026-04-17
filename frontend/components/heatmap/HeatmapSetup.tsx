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
        <h1 className="text-3xl font-bold text-white mb-2" style={{ letterSpacing: '-0.02em' }}>
          Heatmap tracking
        </h1>
        <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Paste your deployed site URL. We&apos;ll give you a one-line snippet to install and verify it&apos;s live.
        </p>
      </div>

      <section
        className="rounded-2xl p-6 mb-4"
        style={{
          background: 'rgba(8,10,18,0.6)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <label className="text-[11px] uppercase tracking-wider mb-2 block" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Deployed site URL
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            value={domain}
            onChange={e => setDomain(e.target.value)}
            placeholder="https://my-app.vercel.app"
            disabled={status === 'creating'}
            className="flex-1 px-3 py-2.5 text-[13px] rounded-xl outline-none"
            style={{
              background: 'rgba(0,0,0,0.25)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#ffffff',
            }}
            onKeyDown={e => { if (e.key === 'Enter') createSite() }}
          />
          <button
            onClick={createSite}
            disabled={status === 'creating' || !domain.trim()}
            className="px-4 py-2.5 rounded-xl text-[12px] font-medium transition-colors disabled:opacity-50"
            style={{
              background: 'linear-gradient(180deg, rgba(124,140,255,0.25), rgba(124,140,255,0.12))',
              border: '1px solid rgba(124,140,255,0.45)',
              color: '#ffffff',
            }}
          >
            {status === 'creating' ? 'Creating…' : site ? 'Update' : 'Create site'}
          </button>
        </div>
        {error && (
          <div className="mt-3 text-[12px]" style={{ color: '#ef4444' }}>
            {error}
          </div>
        )}
      </section>

      {site && (
        <section
          className="rounded-2xl p-6 mb-4"
          style={{
            background: 'rgba(8,10,18,0.6)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Install snippet
          </div>
          <div
            className="mono text-[11.5px] leading-relaxed p-3 rounded-xl mb-3 overflow-x-auto"
            style={{
              background: 'rgba(0,0,0,0.45)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: 'rgba(170,180,255,0.9)',
            }}
          >
            {site.snippet}
          </div>
          <ol className="text-[12px] space-y-1.5 mb-4" style={{ color: 'rgba(255,255,255,0.7)' }}>
            <li>1. Paste the snippet inside <code className="mono" style={{ color: '#aab4ff' }}>&lt;head&gt;</code> of your site.</li>
            <li>2. Deploy.</li>
            <li>3. Come back and click <strong style={{ color: '#ffffff' }}>Verify installation</strong>.</li>
          </ol>
          <div className="flex items-center gap-2">
            <button
              onClick={copySnippet}
              className="px-3 py-1.5 rounded-lg text-[11px] font-medium"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.8)',
              }}
            >
              {copied ? 'Copied' : 'Copy snippet'}
            </button>
            <button
              onClick={() => verifyNow()}
              disabled={status === 'verifying'}
              className="px-3 py-1.5 rounded-lg text-[11px] font-medium disabled:opacity-50"
              style={{
                background: 'linear-gradient(180deg, rgba(124,140,255,0.25), rgba(124,140,255,0.12))',
                border: '1px solid rgba(124,140,255,0.45)',
                color: '#ffffff',
              }}
            >
              {status === 'verifying' ? 'Verifying…' : 'Verify installation'}
            </button>
            <span className="text-[11px] ml-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
              site_key: <span className="mono" style={{ color: 'rgba(170,180,255,0.8)' }}>{site.siteKey.slice(0, 8)}…</span>
            </span>
          </div>
          {verifyResult && <VerifyStatus result={verifyResult} />}
        </section>
      )}

      <p className="text-[11px] text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
        We don&apos;t track form values, cookies, localStorage, or any personal data.
        Events are aggregated into 50×50 heat buckets — raw events are never stored.
      </p>
    </div>
  )
}

function VerifyStatus({ result }: { result: VerifyResult }) {
  if (result.snippetDetected) {
    return (
      <div className="mt-3 text-[12px]" style={{ color: '#22c55e' }}>
        Snippet detected. Open your site in another tab and interact — the heatmap tab updates as events arrive.
      </div>
    )
  }
  if (!result.reachable) {
    return (
      <div className="mt-3 text-[12px]" style={{ color: '#ef4444' }}>
        Site not reachable{result.error ? ` — ${result.error}` : ''}. Double-check the URL and that it&apos;s publicly accessible.
      </div>
    )
  }
  return (
    <div className="mt-3 text-[12px]" style={{ color: '#f59e0b' }}>
      Site is live but the snippet wasn&apos;t found within 5s. Make sure the <code className="mono">&lt;script&gt;</code> tag is in <code className="mono">&lt;head&gt;</code> of the deployed build.
    </div>
  )
}
