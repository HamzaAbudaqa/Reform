'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { apiUrl } from '@/lib/api'
import { getSelectedRepo } from '@/lib/selectedRepo'
import { humanizeError, humanizeResponse } from '@/lib/humanizeError'
import type {
  MultiPageTransformResult,
  TransformedPageData,
} from '@/components/dashboard/TransformTypes'

/**
 * In-place preview for the heatmap page's "Apply staged changes" flow.
 *
 * Replaces the old router.push('/dashboard/transform') — opens on top of
 * the heatmap page so the user keeps the context they were working in.
 * Uses the currently-selected repo + its default branch; no repo picker
 * inside the modal because the heatmap page already scoped to a project.
 *
 * Lifecycle:
 *   mount → auto-kicks the pipeline by POSTing /transform-repo-v2 with
 *   user_intent built from the staged suggestions' transform_instruction
 *   strings. NDJSON stream — heartbeat lines keep the socket warm, the
 *   single `result` line is the real payload.
 *
 * Post-complete actions:
 *   • Magic wand: text prompt → /suggest-edit (single targeted edit) →
 *     /re-render (refresh after-screenshot) for the selected page.
 *   • Accept: /github/publish-approved-branch creates a PR off the
 *     repo's default branch and shows the branch URL.
 *   • Close: dismisses. Pipeline run persists server-side so reopening
 *     could pick up a completed run — not wired yet; small follow-up.
 */

export interface StagedSuggestion {
  id: string
  title: string
  transformInstruction: string
}

interface Props {
  stagedSuggestions: StagedSuggestion[]
  sourcePagePath: string
  githubUserId: string
  onClose: () => void
}

type Stage =
  | 'idle'
  | 'running'
  | 'complete'
  | 'error'

const STAGE_STEPS: { key: string; label: string }[] = [
  { key: 'start',        label: 'Reading repo' },
  { key: 'planning',     label: 'Planning changes' },
  { key: 'transforming', label: 'Transforming pages' },
  { key: 'rendering',    label: 'Rendering preview' },
]

// Map backend stage names (from _update_run_progress) onto STAGE_STEPS
// indices. Backend stages use snake_case / multiple words per phase; the
// modal only shows four coarse buckets. Unmapped stages leave the index
// alone rather than snapping backwards.
const BACKEND_STAGE_TO_INDEX: Record<string, number> = {
  ingesting: 0,
  cloning: 0,
  discovering_pages: 1,
  discovering: 1,
  evaluating: 1,
  scoring: 1,
  planning: 1,
  transforming: 2,
  rebuilding: 2,
  rendering: 3,
  uploading: 3,
  saving: 3,
  done: 3,
}

export default function TransformPreviewModal({
  stagedSuggestions,
  sourcePagePath,
  githubUserId,
  onClose,
}: Props) {
  const { data: session } = useSession()
  const [stage, setStage] = useState<Stage>('idle')
  const [currentStep, setCurrentStep] = useState<number>(0)
  const [result, setResult] = useState<MultiPageTransformResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishUrl, setPublishUrl] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const repo = useMemo(() => getSelectedRepo(), [])
  const repoFullName = useMemo(() => deriveFullName(repo?.url ?? ''), [repo])

  const kickedOffRef = useRef(false)

  const startPipeline = useCallback(async () => {
    if (!repo || !repoFullName) {
      setStage('error')
      setError('Pick a repo in Project Discovery first.')
      return
    }
    const accessToken = (session as { accessToken?: string } | null)?.accessToken
    if (!accessToken || !githubUserId) {
      setStage('error')
      setError('Sign in with GitHub to transform this repo.')
      return
    }

    setStage('running')
    setCurrentStep(0)
    setError(null)

    const userIntent = suggestionsToIntent(stagedSuggestions)
    const controller = new AbortController()
    abortRef.current = controller

    try {
      // mode MUST be "stable" | "explore" — the route validates via
      // Query(pattern="^(stable|explore)$") and 422s anything else.
      // stable = deterministic, cache-friendly; the right default for a
      // one-shot apply-staged-changes flow.
      const res = await fetch(apiUrl(`/transform-repo-v2?mode=stable`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          github_url: `https://github.com/${repoFullName}`,
          branch: repo.branch || 'main',
          access_token: accessToken,
          design_intelligence: null,
          user_intent: userIntent,
          max_pages: 50,
          github_user_id: githubUserId,
          ux_lab_findings: null,
        }),
        signal: controller.signal,
      })
      if (!res.ok) {
        throw new Error(await humanizeResponse(res, "Couldn't start the transform."))
      }
      if (!res.body) throw new Error('Transform returned no stream body')

      // NDJSON reader. The backend now emits three message types that
      // matter here:
      //   heartbeat — keep socket warm, nothing to do
      //   stage     — {stage: "transforming", percent: 50}, drives the UI
      //   result    — final payload, terminates the loop
      //   error     — throws
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finalResult: MultiPageTransformResult | null = null

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let newlineIdx = buffer.indexOf('\n')
        while (newlineIdx !== -1) {
          const line = buffer.slice(0, newlineIdx).trim()
          buffer = buffer.slice(newlineIdx + 1)
          newlineIdx = buffer.indexOf('\n')
          if (!line) continue
          let msg: {
            type: string
            data?: MultiPageTransformResult
            detail?: string
            stage?: string
            percent?: number
          }
          try {
            msg = JSON.parse(line)
          } catch {
            continue
          }
          if (msg.type === 'heartbeat') continue
          if (msg.type === 'stage' && msg.stage) {
            const mapped = BACKEND_STAGE_TO_INDEX[msg.stage.toLowerCase()]
            if (typeof mapped === 'number') {
              // Clamp to monotonic-forward so a late "ingesting" event
              // (e.g., a resumed run re-emitting from earlier) doesn't
              // snap the UI backwards.
              setCurrentStep(prev => Math.max(prev, mapped))
            }
            continue
          }
          if (msg.type === 'error') throw new Error(msg.detail || 'Transform failed')
          if (msg.type === 'result' && msg.data) finalResult = msg.data
        }
      }

      if (!finalResult) throw new Error('Stream ended without a result')
      setResult(finalResult)
      const firstTransformed = finalResult.pages.find(p => p.status === 'transformed')
      setSelectedPath(firstTransformed?.page_path ?? finalResult.pages[0]?.page_path ?? null)
      setStage('complete')
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return
      setError(humanizeError(e, "We couldn't transform the repo right now."))
      setStage('error')
    } finally {
      abortRef.current = null
    }
  }, [repo, repoFullName, session, githubUserId, stagedSuggestions])

  // Auto-start once on mount.
  useEffect(() => {
    if (kickedOffRef.current) return
    kickedOffRef.current = true
    void startPipeline()
    return () => { abortRef.current?.abort() }
  }, [startPipeline])

  // Lock background scroll while the modal is open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const selectedPage = useMemo(
    () => result?.pages.find(p => p.page_path === selectedPath) ?? null,
    [result, selectedPath],
  )

  const onPageEdit = useCallback(
    (nextPage: TransformedPageData) => {
      if (!result) return
      setResult({
        ...result,
        pages: result.pages.map(p => (p.page_path === nextPage.page_path ? nextPage : p)),
      })
    },
    [result],
  )

  const onAccept = useCallback(async () => {
    if (!result || !repoFullName || !repo) return
    const accessToken = (session as { accessToken?: string } | null)?.accessToken
    if (!accessToken) {
      setError('Sign in with GitHub to publish.')
      return
    }
    setPublishing(true)
    setError(null)
    try {
      const [owner, name] = repoFullName.split('/')
      const res = await fetch(apiUrl('/github/publish-approved-branch'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner,
          repo: name,
          base_branch: repo.branch || 'main',
          create_new_branch: true,
          approved_files: result.pages
            .filter(p => p.status === 'transformed' && p.updated_code)
            .map(p => ({ path: p.page_path, content: p.updated_code })),
          transform_summary: {
            pages_transformed: result.pages.filter(p => p.status === 'transformed').map(p => p.page_path),
            summary_text: result.global_summary?.[0] || null,
          },
          access_token: accessToken,
          github_user_id: githubUserId,
        }),
      })
      if (!res.ok) throw new Error(await humanizeResponse(res, "Couldn't publish the branch."))
      const data = await res.json() as { branch_url?: string; branch_name?: string }
      setPublishUrl(data.branch_url || null)
    } catch (e) {
      setError(humanizeError(e, "We couldn't open a branch for you."))
    } finally {
      setPublishing(false)
    }
  }, [result, repo, repoFullName, session, githubUserId])

  // Close on Escape — standard modal affordance, and a safety net if the
  // Close button ever gets obscured by weird zoom / scroll conditions.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Preview changes"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/40 p-4 backdrop-blur-sm"
    >
      {/* max-h instead of a fixed h — the card sizes to its content
         (error / complete) but never exceeds the viewport. flex-col +
         min-h-0 on the body keeps the header/footer pinned while only
         the middle scrolls. */}
      <div className="relative flex max-h-[92vh] w-[min(96vw,1200px)] flex-col overflow-hidden rounded-[22px] border border-black/[0.08] bg-white shadow-2xl">
        {/* Always-visible X in the top-right corner — survives scroll and
           never depends on the header's layout fitting. The text "Close"
           button stays in the header for discoverability. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-neutral-700 shadow-sm ring-1 ring-black/[0.08] transition hover:bg-neutral-50 hover:text-neutral-950"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <header className="flex flex-none items-start justify-between gap-4 border-b border-black/[0.06] px-6 py-4 pr-14">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
              Preview changes
            </p>
            <h2 className="mt-1 text-[17px] font-semibold text-neutral-950">
              {stagedSuggestions.length} change{stagedSuggestions.length === 1 ? '' : 's'} staged from{' '}
              <span className="font-mono text-[14px]">{sourcePagePath}</span>
            </h2>
            {repoFullName && (
              <p className="mt-0.5 text-[11.5px] text-neutral-500">
                {repoFullName} · {repo?.branch || 'main'}
              </p>
            )}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {stage === 'running' && <RunningState currentStep={currentStep} />}
          {stage === 'error' && (
            <ErrorState
              message={error || 'Something went wrong.'}
              onRetry={() => { kickedOffRef.current = false; void startPipeline() }}
            />
          )}
          {stage === 'complete' && result && (
            <CompleteState
              result={result}
              selectedPath={selectedPath}
              onSelectPath={setSelectedPath}
              selectedPage={selectedPage}
              repoFullName={repoFullName}
              branch={repo?.branch || 'main'}
              accessToken={(session as { accessToken?: string } | null)?.accessToken ?? ''}
              onPageEdit={onPageEdit}
            />
          )}
        </div>

        {stage === 'complete' && result && (
          <footer className="flex flex-none flex-col gap-3 border-t border-black/[0.06] bg-neutral-50/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[12px] text-neutral-500">
              {result.total_transformed} page{result.total_transformed === 1 ? '' : 's'} transformed
              {result.total_skipped > 0 && `, ${result.total_skipped} skipped`}
            </div>
            <div className="flex items-center gap-2">
              {publishUrl ? (
                <a
                  href={publishUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-[12.5px] font-semibold text-white transition hover:bg-emerald-500"
                >
                  Open pull request ↗
                </a>
              ) : (
                <>
                  <button
                    onClick={onClose}
                    className="rounded-full border border-black/[0.12] bg-white px-4 py-2 text-[12.5px] font-medium text-neutral-700 transition hover:bg-neutral-50"
                  >
                    Not yet
                  </button>
                  <button
                    onClick={onAccept}
                    disabled={publishing}
                    className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-5 py-2 text-[12.5px] font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50"
                  >
                    {publishing ? 'Opening branch…' : 'Accept — open GitHub PR'}
                  </button>
                </>
              )}
            </div>
          </footer>
        )}

        {error && stage === 'complete' && (
          <div className="flex-none border-t border-amber-200 bg-amber-50 px-6 py-2 text-[11.5px] text-amber-800">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}

// ── States ────────────────────────────────────────────────────────────

function RunningState({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 px-6 py-10">
      <div className="flex flex-col gap-2.5">
        {STAGE_STEPS.map((s, i) => {
          const done = i < currentStep
          const active = i === currentStep
          return (
            <div key={s.key} className="flex items-center gap-3">
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${
                  done ? 'bg-emerald-500 text-white'
                  : active ? 'bg-neutral-950 text-white'
                  : 'bg-neutral-200 text-neutral-500'
                }`}
                aria-hidden
              >
                {done ? '✓' : active ? <Dots /> : i + 1}
              </span>
              <span className={`text-[13.5px] ${active ? 'font-semibold text-neutral-950' : done ? 'text-neutral-600' : 'text-neutral-400'}`}>
                {s.label}
              </span>
            </div>
          )
        })}
      </div>
      <p className="max-w-md text-center text-[12px] text-neutral-500">
        This usually takes 1–3 minutes. We&apos;ll show before/after previews when ready —
        you can keep this tab open or come back later.
      </p>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
      <p className="text-[14px] font-semibold text-neutral-950">We hit a problem.</p>
      <p className="max-w-md text-[12.5px] text-neutral-600">{message}</p>
      <button
        onClick={onRetry}
        className="mt-1 rounded-full border border-black/[0.12] bg-white px-4 py-2 text-[12.5px] font-semibold text-neutral-950 transition hover:bg-neutral-50"
      >
        Try again
      </button>
    </div>
  )
}

function CompleteState({
  result,
  selectedPath,
  onSelectPath,
  selectedPage,
  repoFullName,
  branch,
  accessToken,
  onPageEdit,
}: {
  result: MultiPageTransformResult
  selectedPath: string | null
  onSelectPath: (p: string) => void
  selectedPage: TransformedPageData | null
  repoFullName: string
  branch: string
  accessToken: string
  onPageEdit: (next: TransformedPageData) => void
}) {
  return (
    <div className="grid h-full grid-cols-1 gap-0 lg:grid-cols-[220px_1fr]">
      <aside className="border-b border-black/[0.06] lg:border-b-0 lg:border-r">
        <p className="px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
          Pages ({result.pages.length})
        </p>
        <div className="flex flex-col">
          {result.pages.map(p => {
            const isSelected = p.page_path === selectedPath
            return (
              <button
                key={p.page_path}
                onClick={() => onSelectPath(p.page_path)}
                className={`flex items-center justify-between gap-2 border-l-2 px-4 py-2.5 text-left text-[12px] transition ${
                  isSelected
                    ? 'border-neutral-950 bg-neutral-50 font-semibold text-neutral-950'
                    : 'border-transparent text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <span className="truncate font-mono text-[11.5px]">{p.page_path}</span>
                <StatusDot status={p.status} />
              </button>
            )
          })}
        </div>
      </aside>
      <main className="flex min-h-0 flex-col overflow-y-auto p-5">
        {selectedPage ? (
          <PagePreview
            page={selectedPage}
            repoFullName={repoFullName}
            branch={branch}
            accessToken={accessToken}
            onPageEdit={onPageEdit}
          />
        ) : (
          <div className="m-auto text-[12px] text-neutral-500">Pick a page to preview.</div>
        )}
      </main>
    </div>
  )
}

function PagePreview({
  page,
  repoFullName,
  branch,
  accessToken,
  onPageEdit,
}: {
  page: TransformedPageData
  repoFullName: string
  branch: string
  accessToken: string
  onPageEdit: (next: TransformedPageData) => void
}) {
  const [prompt, setPrompt] = useState('')
  const [tweaking, setTweaking] = useState(false)
  const [tweakError, setTweakError] = useState<string | null>(null)

  const submitTweak = useCallback(async () => {
    const text = prompt.trim()
    if (!text || tweaking) return
    setTweaking(true)
    setTweakError(null)
    try {
      const currentCode = page.updated_code || page.original_code || ''
      const editRes = await fetch(apiUrl('/suggest-edit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestion: text,
          current_code: currentCode,
          analysis_context: null,
        }),
      })
      if (!editRes.ok) throw new Error(await humanizeResponse(editRes, "Couldn't apply that tweak."))
      const edit = await editRes.json() as { revised_code?: string; summary?: string }
      if (!edit.revised_code) throw new Error('No revised code returned.')

      // Kick re-render in the background so the user sees the fresh
      // screenshot without another click. Non-fatal if it fails — the
      // code is still updated locally.
      let beforeScreenshot = page.before_screenshot
      let afterScreenshot = page.after_screenshot
      try {
        const renderRes = await fetch(apiUrl('/re-render'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repo_clone_url: `https://github.com/${repoFullName}.git`,
            branch,
            target_file: page.page_path,
            updated_code: edit.revised_code,
            access_token: accessToken || '',
          }),
        })
        if (renderRes.ok) {
          const rd = await renderRes.json() as { before_screenshot?: string; after_screenshot?: string }
          beforeScreenshot = rd.before_screenshot ?? beforeScreenshot
          afterScreenshot = rd.after_screenshot ?? afterScreenshot
        }
      } catch {
        /* non-fatal */
      }

      onPageEdit({
        ...page,
        updated_code: edit.revised_code,
        before_screenshot: beforeScreenshot,
        after_screenshot: afterScreenshot,
        diff_summary: edit.summary || page.diff_summary,
      })
      setPrompt('')
    } catch (e) {
      setTweakError(humanizeError(e, "Couldn't apply that tweak."))
    } finally {
      setTweaking(false)
    }
  }, [prompt, tweaking, page, repoFullName, branch, accessToken, onPageEdit])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-neutral-950">{page.page_path}</h3>
          {page.diff_summary && (
            <p className="mt-0.5 text-[12px] text-neutral-600">{page.diff_summary}</p>
          )}
        </div>
        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10.5px] font-medium text-neutral-700">
          {page.status}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Frame label="Before" src={page.before_screenshot || ''} />
        <Frame label="After"  src={page.after_screenshot  || ''} />
      </div>

      {(page.change_summary?.length ?? 0) > 0 && (
        <section>
          <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
            What changed
          </p>
          <ul className="flex flex-col gap-1">
            {page.change_summary!.map((line, i) => (
              <li key={i} className="flex gap-2 text-[12.5px] text-neutral-700">
                <span className="mt-[7px] h-1 w-1 flex-none rounded-full bg-emerald-500" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-black/[0.07] bg-neutral-50/80 p-3">
        <div className="flex items-center gap-1.5">
          <WandIcon />
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
            Magic wand — ask for a tweak
          </p>
        </div>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="e.g. make the header text larger, move the CTA to the top right, use a warmer accent color…"
          rows={2}
          className="mt-2 w-full resize-none rounded-lg border border-black/[0.1] bg-white px-3 py-2 text-[12.5px] text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] text-neutral-500">
            Applies only to this page. You can chain multiple tweaks.
          </span>
          <button
            onClick={submitTweak}
            disabled={!prompt.trim() || tweaking}
            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-950 px-4 py-1.5 text-[12px] font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50"
          >
            {tweaking ? 'Thinking…' : 'Apply tweak'}
          </button>
        </div>
        {tweakError && (
          <p className="mt-2 text-[11.5px] text-amber-700">{tweakError}</p>
        )}
      </section>
    </div>
  )
}

// ── Small bits ─────────────────────────────────────────────────────────

function Frame({ label, src }: { label: string; src: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
        <span className={label === 'Before' ? 'h-1.5 w-1.5 rounded-full bg-neutral-400'
          : 'h-1.5 w-1.5 rounded-full bg-emerald-500'} />
        {label}
      </div>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`${label} screenshot`}
          className="w-full rounded-lg border border-black/[0.06]"
        />
      ) : (
        <div className="flex aspect-[3/2] items-center justify-center rounded-lg border border-dashed border-black/[0.1] bg-white text-[11.5px] text-neutral-400">
          No screenshot
        </div>
      )}
    </div>
  )
}

function StatusDot({ status }: { status: TransformedPageData['status'] }) {
  const tone =
    status === 'transformed' ? 'bg-emerald-500'
    : status === 'error' ? 'bg-red-500'
    : status === 'high_quality' ? 'bg-neutral-300'
    : 'bg-amber-500'
  return <span className={`h-1.5 w-1.5 rounded-full ${tone}`} aria-hidden />
}

function Dots() {
  return (
    <span className="flex gap-0.5" aria-hidden>
      <span className="h-1 w-1 rounded-full bg-white/70 animate-pulse" />
      <span className="h-1 w-1 rounded-full bg-white/70 animate-pulse [animation-delay:150ms]" />
      <span className="h-1 w-1 rounded-full bg-white/70 animate-pulse [animation-delay:300ms]" />
    </span>
  )
}

function WandIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 4V2" />
      <path d="M15 16v-2" />
      <path d="M8 9h2" />
      <path d="M20 9h2" />
      <path d="M17.8 11.8 19 13" />
      <path d="M15 9h0" />
      <path d="M17.8 6.2 19 5" />
      <path d="m3 21 9-9" />
      <path d="M12.2 6.2 11 5" />
    </svg>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────

function deriveFullName(url: string): string {
  // Accepts https://github.com/<owner>/<name>[.git][/]
  const m = url.match(/github\.com[/:]([^/]+)\/([^/.?#]+)(?:\.git)?/)
  return m ? `${m[1]}/${m[2]}` : ''
}

function suggestionsToIntent(suggestions: StagedSuggestion[]): string {
  if (!suggestions.length) return ''
  const lines = suggestions.map((s, i) => `${i + 1}. ${s.transformInstruction}`)
  return `Apply the following user-experience improvements:\n${lines.join('\n')}`
}
