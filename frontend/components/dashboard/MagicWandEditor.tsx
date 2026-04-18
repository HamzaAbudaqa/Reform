'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { apiUrl } from '@/lib/api'

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

interface Section {
  id: string
  tag: string
  label: string
  rect: Rect
  heading?: string
  paragraph?: string
  text?: string
  classes?: string
  role?: string
  aria_label?: string
  element_id?: string
  source_file?: string | null
}

interface LoadResponse {
  session_id: string
  screenshot: string
  sections: Section[]
  document_size: { width: number; height: number }
  root_file: string | null
  root_code: string
  framework: string
  available_pages: { name: string; route: string; path: string }[]
  current_page: string
  error?: string | null
}

interface ApplyResponse {
  session_id: string
  screenshot: string
  sections: Section[]
  document_size: { width: number; height: number }
  updated_code: string
  summary: string
  target_file?: string | null
  updated_section_id?: string | null
  edit_id?: string | null
  session_expired?: boolean
  error?: string | null
  error_kind?: string | null
}

interface EditLogEntry {
  id: string
  summary: string
  prompt: string
  target_file?: string | null
}

function resolveImgSrc(raw: string) {
  return raw.startsWith('http://') || raw.startsWith('https://')
    ? raw
    : `data:image/png;base64,${raw}`
}

function rectsOverlap(a: Rect, b: Rect) {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  )
}

function overlapArea(a: Rect, b: Rect) {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const right = Math.min(a.x + a.width, b.x + b.width)
  const bottom = Math.min(a.y + a.height, b.y + b.height)
  if (right <= x || bottom <= y) return 0
  return (right - x) * (bottom - y)
}

export default function MagicWandEditor({
  screenshot,
  pageName,
  route,
  repoUrl,
  branch,
  disabled = false,
  disabledReason,
  onScreenshotChange,
  overlayFiles,
}: {
  screenshot: string
  pageName: string
  route?: string
  repoUrl: string | null
  branch: string | null
  disabled?: boolean
  disabledReason?: string
  onScreenshotChange?: (next: string) => void
  /**
   * Optional map of repo-relative path -> file content. Sent to `/edit-lab/load`
   * so the session workspace renders the proposed (but unpublished) transform.
   * Lab edits then stack on top of that overlay.
   */
  overlayFiles?: Record<string, string> | null
}) {
  const { data: session } = useSession()
  const [editMode, setEditMode] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [documentSize, setDocumentSize] = useState<{ width: number; height: number } | null>(null)
  const [liveScreenshot, setLiveScreenshot] = useState<string>(screenshot)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const draggingRef = useRef(false)
  // Track the last screenshot we wrote locally, so the prop-sync useEffect
  // can distinguish "parent echoed our own update" from "external change".
  const lastWroteRef = useRef<string>(screenshot)
  const [selection, setSelection] = useState<Rect | null>(null)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  // Separate from draggingRef (which drives event logic). This state exists
  // solely so the prompt popover can wait until the pointer is released —
  // showing it mid-drag is distracting and blocks the selection preview.
  const [isDragging, setIsDragging] = useState(false)

  const [prompt, setPrompt] = useState('')
  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [showDisabledConfirm, setShowDisabledConfirm] = useState(false)
  // Stack of applied wand edits, oldest first. Each entry has the backend
  // edit_id so we can surgically revert any individual change via
  // /edit-lab/revert-edit (which cascades — dropping entry N also drops
  // all edits applied after it, since later edits may have built on it).
  const [edits, setEdits] = useState<EditLogEntry[]>([])
  const [revertingId, setRevertingId] = useState<string | null>(null)

  // Sync with the incoming prop only when it genuinely changes from outside
  // (e.g. the initial page load or a true external replacement). We ignore
  // echoes of our own onScreenshotChange writes so repeated wand edits
  // don't wipe the edit log. We deliberately do NOT reset `edits` here —
  // the session outlives any single screenshot update.
  useEffect(() => {
    if (screenshot === lastWroteRef.current) return
    setLiveScreenshot(screenshot)
    setSelection(null)
    setPrompt('')
    setApplyError(null)
    lastWroteRef.current = screenshot
  }, [screenshot])

  // Lazy-load the edit-lab session when entering edit mode for the first time
  const loadSession = useCallback(async () => {
    if (sessionId || loading || !repoUrl || !branch) return
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(apiUrl('/edit-lab/load'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          github_url: repoUrl,
          branch,
          access_token: session?.accessToken ?? null,
          overlay_files: overlayFiles && Object.keys(overlayFiles).length > 0 ? overlayFiles : null,
        }),
      })
      if (!res.ok) {
        const detail = await res.text()
        throw new Error(detail || `Load failed (${res.status})`)
      }
      const data = (await res.json()) as LoadResponse
      if (data.error) throw new Error(data.error)
      setSessionId(data.session_id)
      setSections(data.sections || [])
      setDocumentSize(data.document_size)
      if (data.screenshot) setLiveScreenshot(data.screenshot)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to start edit session')
    } finally {
      setLoading(false)
    }
  }, [sessionId, loading, repoUrl, branch, session?.accessToken, overlayFiles])

  // Map a pointer event to canvas-local coordinates in document-space
  const canvasCoordsFromEvent = useCallback((clientX: number, clientY: number) => {
    const img = imgRef.current
    if (!img || !documentSize) return null
    const rect = img.getBoundingClientRect()
    const xPct = (clientX - rect.left) / rect.width
    const yPct = (clientY - rect.top) / rect.height
    return {
      x: Math.max(0, Math.min(1, xPct)) * documentSize.width,
      y: Math.max(0, Math.min(1, yPct)) * documentSize.height,
    }
  }, [documentSize])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editMode || applying) return
    const pt = canvasCoordsFromEvent(e.clientX, e.clientY)
    if (!pt) return
    e.currentTarget.setPointerCapture(e.pointerId)
    draggingRef.current = true
    setIsDragging(true)
    setDragStart(pt)
    setSelection({ x: pt.x, y: pt.y, width: 0, height: 0 })
    setApplyError(null)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !dragStart) return
    const pt = canvasCoordsFromEvent(e.clientX, e.clientY)
    if (!pt) return
    setSelection({
      x: Math.min(dragStart.x, pt.x),
      y: Math.min(dragStart.y, pt.y),
      width: Math.abs(pt.x - dragStart.x),
      height: Math.abs(pt.y - dragStart.y),
    })
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    setIsDragging(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    // Drop micro-selections
    if (selection && (selection.width < 8 || selection.height < 8)) {
      setSelection(null)
    }
  }

  const bestMatchingSection = (rect: Rect): Section | null => {
    const overlapping = sections
      .filter(s => rectsOverlap(rect, s.rect))
      .map(s => ({ section: s, area: overlapArea(rect, s.rect) }))
      .sort((a, b) => b.area - a.area)
    return overlapping[0]?.section ?? null
  }

  const handleApply = async () => {
    if (!selection || !prompt.trim() || applying) return
    if (!sessionId) return
    const match = bestMatchingSection(selection)
    if (!match) {
      setApplyError('No element detected inside the selection — try drawing a tighter rect over a specific element.')
      return
    }
    setApplying(true)
    setApplyError(null)
    try {
      const res = await fetch(apiUrl('/edit-lab/apply'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          target_file: match.source_file ?? null,
          section_label: match.label,
          section_tag: match.tag,
          section_heading: match.heading ?? '',
          section_paragraph: match.paragraph ?? '',
          section_text: match.text ?? '',
          section_classes: match.classes ?? '',
          section_role: match.role ?? '',
          section_aria_label: match.aria_label ?? '',
          section_element_id: match.element_id ?? '',
          prompt: prompt.trim(),
        }),
      })
      if (!res.ok) {
        const detail = await res.text()
        throw new Error(detail || `Apply failed (${res.status})`)
      }
      const data = (await res.json()) as ApplyResponse
      if (data.session_expired) {
        setSessionId(null)
        throw new Error('Edit session expired — try again')
      }
      if (data.error) throw new Error(data.error)
      if (data.screenshot) {
        lastWroteRef.current = data.screenshot
        setLiveScreenshot(data.screenshot)
        onScreenshotChange?.(data.screenshot)
      }
      setSections(data.sections || sections)
      if (data.document_size) setDocumentSize(data.document_size)
      setSelection(null)
      const summary = (data.summary && data.summary.trim()) || `Applied: ${prompt.trim().slice(0, 80)}`
      // Backend returns edit_id; fall back to a local id only if it's missing.
      const id = (data.edit_id && data.edit_id.trim()) ||
        (typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `edit-${Date.now()}`)
      setEdits(prev => [...prev, { id, summary, prompt: prompt.trim(), target_file: data.target_file ?? null }])
      setPrompt('')
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : 'Failed to apply change')
    } finally {
      setApplying(false)
    }
  }

  const enterEditMode = async () => {
    setEditMode(true)
    await loadSession()
  }

  // Delete a specific wand edit from the log. The backend cascades: dropping
  // entry N also drops every edit applied after it, because later edits may
  // depend on earlier ones (e.g. tweaking a button that a prior edit added).
  // We keep this honest in the UI — see the confirm-with-count below.
  const handleDeleteEdit = async (editId: string) => {
    if (!sessionId || revertingId) return
    const idx = edits.findIndex(e => e.id === editId)
    if (idx < 0) return
    const droppedCount = edits.length - idx
    if (droppedCount > 1) {
      const ok = window.confirm(
        `Deleting this change will also undo the ${droppedCount - 1} edit${droppedCount - 1 === 1 ? '' : 's'} made after it. Continue?`,
      )
      if (!ok) return
    }
    setRevertingId(editId)
    setApplyError(null)
    try {
      const res = await fetch(apiUrl('/edit-lab/revert-edit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, edit_id: editId }),
      })
      if (!res.ok) {
        const detail = await res.text()
        throw new Error(detail || `Revert failed (${res.status})`)
      }
      const data = await res.json()
      if (data.session_expired) {
        setSessionId(null)
        throw new Error('Edit session expired — try again')
      }
      if (data.error) throw new Error(data.error)
      if (data.screenshot) {
        lastWroteRef.current = data.screenshot
        setLiveScreenshot(data.screenshot)
        onScreenshotChange?.(data.screenshot)
      }
      if (data.sections) setSections(data.sections)
      if (data.document_size) setDocumentSize(data.document_size)
      setEdits(prev => prev.slice(0, idx))
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : 'Revert failed')
    } finally {
      setRevertingId(null)
    }
  }

  const handleToggleEditMode = async () => {
    if (editMode) {
      setEditMode(false)
      setSelection(null)
      setPrompt('')
      setApplyError(null)
      return
    }
    if (disabled) {
      // Gated: ask the user to confirm they want to edit while the proposal
      // is still undecided. Accepting bypasses the gate for this session.
      setShowDisabledConfirm(true)
      return
    }
    await enterEditMode()
  }

  const selectionStyle = (() => {
    if (!selection || !documentSize) return null
    return {
      left: `${(selection.x / documentSize.width) * 100}%`,
      top: `${(selection.y / documentSize.height) * 100}%`,
      width: `${(selection.width / documentSize.width) * 100}%`,
      height: `${(selection.height / documentSize.height) * 100}%`,
    }
  })()

  return (
    <div className="relative">
      {/* Magic wand toggle button — always rendered; dimmed when gated.
          The button sits above an animated conic-gradient halo that rotates
          continuously (idle shimmer) and swells in edit mode. */}
      <div className="absolute top-3 right-3 z-20">
        <div
          aria-hidden
          className={`mw-halo ${editMode ? 'mw-halo--active' : 'mw-halo--idle'}`}
          style={{ opacity: disabled && !editMode ? 0.35 : 1 }}
        />
        <button
          type="button"
          onClick={handleToggleEditMode}
          title={
            disabled && !editMode
              ? disabledReason || 'Accept or keep the proposed changes first'
              : editMode
              ? 'Exit edit mode'
              : 'Edit with magic wand'
          }
          className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all"
          style={{
            background: editMode
              ? 'linear-gradient(135deg, #7c3aed, #5b21b6)'
              : 'rgba(255,255,255,0.92)',
            color: editMode ? '#ffffff' : 'rgba(0,0,0,0.75)',
            border: editMode ? 'none' : '1px solid rgba(0,0,0,0.1)',
            backdropFilter: 'blur(8px)',
            boxShadow: editMode
              ? '0 6px 20px rgba(124,58,237,0.35)'
              : '0 2px 8px rgba(0,0,0,0.08)',
            opacity: disabled && !editMode ? 0.5 : 1,
            cursor: 'pointer',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M15 9h.01M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5" />
          </svg>
          {editMode ? 'Exit edit mode' : 'Magic wand'}
        </button>
      </div>

      {/* The image itself — with optional drag-to-select overlay */}
      <div
        ref={containerRef}
        className="relative overflow-hidden select-none"
        style={{
          cursor: editMode && !applying ? 'crosshair' : 'default',
          touchAction: editMode ? 'none' : 'auto',
          background: '#fafafa',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={resolveImgSrc(liveScreenshot)}
          alt={`${pageName} — after`}
          className="block w-full h-auto"
          draggable={false}
        />

        {/* Selection rectangle overlay */}
        {editMode && selectionStyle && (
          <div
            className="absolute pointer-events-none"
            style={{
              ...selectionStyle,
              border: '1.5px solid #7c3aed',
              background: 'rgba(124,58,237,0.12)',
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.25)',
              borderRadius: 3,
            }}
          />
        )}

        {/* Edit-mode chrome overlays */}
        {editMode && (
          <div className="absolute top-3 left-3 z-10 pointer-events-none px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-[0.14em]"
               style={{ background: 'rgba(124,58,237,0.92)', color: '#fff', backdropFilter: 'blur(8px)' }}>
            Edit mode
          </div>
        )}

        {/* Loading overlay. Covers the full image (so it blocks interaction),
            but the spinner/text is pinned to the top so it's visible without
            scrolling on tall page screenshots. */}
        {loading && (
          <div
            className="absolute inset-0 z-30 flex items-start justify-center pt-6"
            style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(4px)' }}
          >
            <div
              className="sticky top-6 flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow"
              style={{ border: '1px solid rgba(0,0,0,0.08)' }}
            >
              <span
                className="w-3 h-3 rounded-full animate-spin"
                style={{ border: '2px solid rgba(0,0,0,0.15)', borderTopColor: '#7c3aed' }}
              />
              <span className="text-[11px] font-medium text-neutral-700">Starting edit session…</span>
            </div>
          </div>
        )}
      </div>

      {/* Prompt popover — appears only after the drag finishes, so the user
          can freely resize their selection without the textbox flashing in. */}
      {editMode && selection && !isDragging && documentSize && !loading && !loadError && (
        <div
          className="absolute z-30 w-[320px] max-w-[calc(100%-24px)] rounded-xl p-3 flex flex-col gap-2"
          style={{
            left: `${Math.min(
              ((selection.x + selection.width) / documentSize.width) * 100,
              95,
            )}%`,
            top: `${((selection.y + selection.height) / documentSize.height) * 100}%`,
            transform: 'translate(-50%, 12px)',
            background: '#ffffff',
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 12px 36px rgba(0,0,0,0.14)',
          }}
        >
          <input
            autoFocus
            type="text"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && prompt.trim() && !applying) handleApply()
              if (e.key === 'Escape') { setSelection(null); setPrompt('') }
            }}
            placeholder="Describe the change…"
            className="w-full px-3 py-2 rounded-lg text-[12px] outline-none"
            style={{ border: '1px solid rgba(0,0,0,0.1)', background: '#fafafa', color: '#0a0a0a', colorScheme: 'light' }}
          />
          {applyError && (
            <p className="text-[10.5px]" style={{ color: '#dc2626' }}>{applyError}</p>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={handleApply}
              disabled={applying || !prompt.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                color: '#ffffff',
                border: 'none',
                boxShadow: '0 4px 12px rgba(124,58,237,0.3)',
              }}
            >
              {applying ? (
                <>
                  <span className="w-3 h-3 rounded-full animate-spin" style={{ border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#ffffff' }} />
                  Applying…
                </>
              ) : (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M15 9h.01M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5" />
                  </svg>
                  Apply
                </>
              )}
            </button>
            <button
              onClick={() => { setSelection(null); setPrompt(''); setApplyError(null) }}
              disabled={applying}
              className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors hover:bg-neutral-50 disabled:opacity-40"
              style={{ color: 'rgba(0,0,0,0.6)', border: '1px solid rgba(0,0,0,0.1)', background: '#ffffff' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loadError && (
        <div className="mt-2 px-3 py-2 rounded-lg text-[11px]" style={{ background: 'rgba(239,68,68,0.06)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.2)' }}>
          {loadError}
        </div>
      )}

      {/* Confirm popover when the wand is clicked while gated. Sits just
          below the wand button and mirrors its Siri halo styling so the
          relationship reads visually — you clicked the glowing button,
          this is the card it opened. */}
      {showDisabledConfirm && (
        <div
          role="dialog"
          className="mw-confirm absolute top-14 right-3 z-30 w-[320px] rounded-2xl overflow-hidden"
          style={{
            background: '#ffffff',
            border: '1px solid rgba(124,58,237,0.18)',
            boxShadow:
              '0 24px 60px rgba(124,58,237,0.18), 0 4px 16px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)',
          }}
        >
          {/* Gradient accent strip — ties the card to the wand's purple/pink/blue halo. */}
          <div
            aria-hidden
            style={{
              height: 3,
              background: 'linear-gradient(90deg, #7c3aed, #ec4899, #3b82f6, #7c3aed)',
              backgroundSize: '200% 100%',
              animation: 'mwConfirmShimmer 4s linear infinite',
            }}
          />

          <div className="p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="relative flex-shrink-0">
                <div
                  aria-hidden
                  className="mw-confirm-halo"
                />
                <div
                  className="relative w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                    boxShadow: '0 6px 16px rgba(124,58,237,0.35)',
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M15 9h.01M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5" />
                  </svg>
                </div>
              </div>
              <div className="min-w-0 pt-0.5">
                <div className="text-[13.5px] font-semibold leading-tight text-neutral-950">
                  Edit before deciding?
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] mt-1" style={{ color: 'rgba(124,58,237,0.75)' }}>
                  Layering on the proposal
                </div>
              </div>
            </div>

            <p className="text-[12px] leading-relaxed mb-4" style={{ color: 'rgba(0,0,0,0.62)' }}>
              Your edits will stack on top of the proposed transform. Nothing is saved to your repo until you <span className="font-semibold" style={{ color: 'rgba(0,0,0,0.8)' }}>publish</span> — use the toolbar above when you&apos;re done.
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={async () => { setShowDisabledConfirm(false); await enterEditMode() }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                  color: '#ffffff',
                  border: 'none',
                  boxShadow: '0 6px 16px rgba(124,58,237,0.35)',
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M15 9h.01M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5" />
                </svg>
                Edit anyway
              </button>
              <button
                onClick={() => setShowDisabledConfirm(false)}
                className="px-3 py-2 rounded-xl text-[12px] font-medium transition-colors hover:bg-neutral-50"
                style={{ color: 'rgba(0,0,0,0.62)', border: '1px solid rgba(0,0,0,0.1)', background: '#ffffff' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit log — fixed to the right edge of the viewport while edit mode
          is on so stacked wand changes stay reviewable. Deleting an entry
          cascades: everything applied after it also reverts. */}
      {editMode && (
        <div
          className="fixed z-40 hidden lg:flex flex-col"
          style={{
            right: 20,
            top: 140,
            width: 280,
            maxHeight: 'calc(100vh - 180px)',
            background: 'rgba(255,255,255,0.96)',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 16,
            boxShadow: '0 12px 40px rgba(0,0,0,0.08), 0 0 0 1px rgba(124,58,237,0.06)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <div className="mw-log-dot" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'rgba(0,0,0,0.6)' }}>
              Wand changes
            </span>
            <span className="ml-auto text-[10.5px] font-mono tabular-nums" style={{ color: 'rgba(0,0,0,0.35)' }}>
              {edits.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1.5">
            {edits.length === 0 ? (
              <p className="text-[11px] leading-relaxed px-3 py-6 text-center" style={{ color: 'rgba(0,0,0,0.4)' }}>
                Drag a region on the preview and describe the change. Applied edits will appear here.
              </p>
            ) : (
              edits.map((entry, i) => {
                const isReverting = revertingId === entry.id
                return (
                  <div
                    key={entry.id}
                    className="group flex items-start gap-2 px-2.5 py-2 rounded-lg transition-colors hover:bg-neutral-50"
                    style={{ border: '1px solid transparent' }}
                  >
                    <div
                      className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 text-[9.5px] font-mono font-semibold"
                      style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed' }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11.5px] font-medium text-neutral-800 leading-snug truncate" title={entry.summary}>
                        {entry.summary}
                      </div>
                      <div className="text-[10.5px] leading-snug mt-0.5 line-clamp-2" style={{ color: 'rgba(0,0,0,0.5)' }} title={entry.prompt}>
                        {entry.prompt}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteEdit(entry.id)}
                      disabled={!!revertingId}
                      title="Delete this change"
                      className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100 focus:opacity-100"
                      style={{
                        color: '#dc2626',
                        background: 'rgba(239,68,68,0.06)',
                        border: '1px solid rgba(239,68,68,0.15)',
                      }}
                    >
                      {isReverting ? (
                        <span className="w-2.5 h-2.5 rounded-full animate-spin" style={{ border: '1.5px solid rgba(239,68,68,0.25)', borderTopColor: '#dc2626' }} />
                      ) : (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                        </svg>
                      )}
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        /* ----- Siri-style halo on the wand button ----- */
        .mw-halo {
          position: absolute;
          inset: -6px;
          border-radius: 9999px;
          pointer-events: none;
          filter: blur(10px);
          background: conic-gradient(
            from 0deg,
            #7c3aed,
            #ec4899,
            #3b82f6,
            #22d3ee,
            #a855f7,
            #7c3aed
          );
          transition: opacity 240ms ease;
        }
        .mw-halo--idle {
          opacity: 0.55;
          animation: mwSpin 6s linear infinite, mwBreathe 3.6s ease-in-out infinite;
        }
        .mw-halo--active {
          opacity: 0.9;
          inset: -9px;
          filter: blur(14px);
          animation: mwSpin 3.2s linear infinite, mwBreatheStrong 2.2s ease-in-out infinite;
        }
        @keyframes mwSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes mwBreathe {
          0%, 100% { filter: blur(10px) brightness(1); }
          50%      { filter: blur(13px) brightness(1.15); }
        }
        @keyframes mwBreatheStrong {
          0%, 100% { filter: blur(14px) brightness(1.1); }
          50%      { filter: blur(18px) brightness(1.35); }
        }

        /* ----- Log panel header pulse dot ----- */
        .mw-log-dot {
          width: 8px;
          height: 8px;
          border-radius: 9999px;
          background: conic-gradient(from 0deg, #7c3aed, #ec4899, #3b82f6, #7c3aed);
          animation: mwSpin 4s linear infinite, mwBreathe 2.4s ease-in-out infinite;
          box-shadow: 0 0 10px rgba(124, 58, 237, 0.55);
        }

        /* ----- Confirm popover: top gradient strip + icon halo ----- */
        @keyframes mwConfirmShimmer {
          0%   { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        .mw-confirm-halo {
          position: absolute;
          inset: -4px;
          border-radius: 14px;
          pointer-events: none;
          filter: blur(8px);
          opacity: 0.55;
          background: conic-gradient(from 0deg, #7c3aed, #ec4899, #3b82f6, #a855f7, #7c3aed);
          animation: mwSpin 5s linear infinite;
        }
      `}</style>
    </div>
  )
}
