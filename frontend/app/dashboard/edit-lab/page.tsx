'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { apiUrl } from '@/lib/api'
import { getSelectedRepo } from '@/lib/selectedRepo'
import {
  ingestStitchUrls,
  StitchApiError,
  STITCH_MAX_URLS,
  type StitchDesign,
} from '@/lib/stitchApi'

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
  heading: string
  paragraph: string
  text: string
  classes?: string
  role?: string
  aria_label?: string
  element_id?: string
  source_file?: string | null
}

interface DocumentSize {
  width: number
  height: number
}

interface AvailablePage {
  name: string
  route: string
  path: string
}

interface LoadPayload {
  session_id: string
  screenshot: string
  sections: Section[]
  document_size: DocumentSize
  root_file: string | null
  root_code: string
  framework: string
  available_pages: AvailablePage[]
  current_page: string
  error?: string | null
}

interface NavigatePayload {
  session_id: string
  screenshot: string
  sections: Section[]
  document_size: DocumentSize
  current_page: string
  target_page_file: string | null
  session_expired?: boolean
  error?: string | null
}

interface RevertPayload {
  session_id: string
  screenshot: string
  sections: Section[]
  document_size: DocumentSize
  target_file: string | null
  session_expired?: boolean
  error?: string | null
}

interface ApplyPayload {
  session_id: string
  screenshot: string
  sections: Section[]
  document_size: DocumentSize
  updated_code: string
  summary: string
  target_file: string | null
  updated_section_id: string | null
  session_expired?: boolean
  error?: string | null
}

interface RepoState {
  url: string
  branch: string
}

interface SectionSnapshot {
  label: string
  heading: string
  screenshot: string
  rect: Rect
  documentSize: DocumentSize
}

interface EditSelection {
  kind: 'section' | 'rect'
  label: string
  heading: string
  paragraph: string
  text: string
  tag: string
  classes: string
  role: string
  aria_label: string
  rect: Rect
  source_file: string | null
  memberIds: string[]
}

function rectsIntersect(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  )
}

function hitTestSection(x: number, y: number, sections: Section[]): Section | null {
  const hits = sections.filter(
    (s) =>
      x >= s.rect.x &&
      x <= s.rect.x + s.rect.width &&
      y >= s.rect.y &&
      y <= s.rect.y + s.rect.height,
  )
  if (!hits.length) return null
  hits.sort((a, b) => a.rect.width * a.rect.height - b.rect.width * b.rect.height)
  return hits[0]
}

function sectionToSelection(s: Section): EditSelection {
  return {
    kind: 'section',
    label: s.label,
    heading: s.heading,
    paragraph: s.paragraph,
    text: s.text,
    tag: s.tag || '',
    classes: s.classes || '',
    role: s.role || '',
    aria_label: s.aria_label || '',
    rect: { ...s.rect },
    source_file: s.source_file || null,
    memberIds: [s.id],
  }
}

function buildRectSelection(
  rect: Rect,
  sections: Section[],
  rootFile: string | null,
): EditSelection {
  const included = sections.filter((s) => rectsIntersect(rect, s.rect))
  if (included.length === 0) {
    return {
      kind: 'rect',
      label: 'Custom region',
      heading: '',
      paragraph: '',
      text: '',
      tag: '',
      classes: '',
      role: '',
      aria_label: '',
      rect,
      source_file: rootFile,
      memberIds: [],
    }
  }
  // Always target a single section — even when the drag rect covers many.
  // Editing multiple sections at once produced whole-file rewrites because
  // the backend can only scope to one element. Pick the section with the
  // largest area: usually the outer container the user meant, not a nested
  // child. For multi-section drags this effectively snaps to the best fit.
  const primary = included.reduce(
    (best, s) =>
      s.rect.width * s.rect.height > best.rect.width * best.rect.height ? s : best,
    included[0],
  )
  const sel = sectionToSelection(primary)
  sel.kind = 'rect'
  return sel
}

const PROMPT_EXAMPLES = [
  'Make this section feel more modern',
  'Reduce clutter and simplify',
  'Improve spacing and hierarchy',
]

const HIGHLIGHT_MS = 3200

const LAB_PASSWORD = process.env.NEXT_PUBLIC_LAB_PASSWORD || 'reform2026'
const LAB_UNLOCK_KEY = 'reform_lab_unlocked'

export default function EditLabPage() {
  const { data: session } = useSession()
  const [labUnlocked, setLabUnlocked] = useState(false)
  const [labUnlockChecked, setLabUnlockChecked] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (localStorage.getItem(LAB_UNLOCK_KEY) === 'true') {
        setLabUnlocked(true)
      }
    } catch {
      /* storage disabled */
    }
    setLabUnlockChecked(true)
  }, [])

  const [repoState, setRepoState] = useState<RepoState | null>(null)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<LoadPayload | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [selection, setSelection] = useState<EditSelection | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [promptText, setPromptText] = useState('')
  const [navigating, setNavigating] = useState(false)
  const [pageMenuOpen, setPageMenuOpen] = useState(false)
  const [customPath, setCustomPath] = useState('')
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)
  const [justUpdatedId, setJustUpdatedId] = useState<string | null>(null)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [lastEdit, setLastEdit] = useState<{
    summary: string
    before: SectionSnapshot
    afterRect: Rect
    afterDocumentSize: DocumentSize
    afterScreenshot: string
    newSectionId: string | null
    pending: boolean
  } | null>(null)
  const [reverting, setReverting] = useState(false)
  const [acceptedFiles, setAcceptedFiles] = useState<string[]>([])
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<{ branch_name: string; branch_url: string; files_changed: string[] } | null>(null)

  const [stitchOpen, setStitchOpen] = useState(false)
  const [stitchInput, setStitchInput] = useState('')
  const [stitchStatus, setStitchStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [stitchDesigns, setStitchDesigns] = useState<StitchDesign[]>([])
  const [stitchError, setStitchError] = useState<string | null>(null)

  const githubUserId = (session as unknown as { githubId?: string } | null)?.githubId || ''

  const canvasRef = useRef<HTMLDivElement | null>(null)
  const [canvasWidth, setCanvasWidth] = useState(1)
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const accessToken = (session as unknown as { accessToken?: string } | null)?.accessToken || ''

  useEffect(() => {
    if (typeof window === 'undefined') return
    const selected = getSelectedRepo()
    if (!selected) {
      setRepoState(null)
      return
    }
    // Prefer a branch captured by a completed transform run if present —
    // it can be more specific than the persisted default branch.
    let branch = selected.branch
    const tRaw = sessionStorage.getItem('refineui_transform')
    if (tRaw) {
      try {
        const parsed = JSON.parse(tRaw)
        if (parsed?.branch) branch = parsed.branch
      } catch {
        /* ignore */
      }
    }
    setRepoState({ url: selected.url, branch })
  }, [])

  const runLoad = useCallback(
    async (opts?: { silent?: boolean }): Promise<LoadPayload | null> => {
      if (!repoState) return null
      if (!opts?.silent) {
        setLoading(true)
        setError(null)
        setSelection(null)
        setHoveredId(null)
      }
      try {
        const res = await fetch(apiUrl('/edit-lab/load'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            github_url: repoState.url,
            branch: repoState.branch,
            access_token: accessToken,
          }),
        })
        if (!res.ok) throw new Error(`Load failed (${res.status})`)
        const data: LoadPayload = await res.json()
        if (data.error) throw new Error(data.error)
        setPayload(data)
        setSessionId(data.session_id || null)
        return data
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load preview'
        if (!opts?.silent) setError(msg)
        return null
      } finally {
        if (!opts?.silent) setLoading(false)
      }
    },
    [repoState, accessToken],
  )

  useEffect(() => {
    if (repoState && !payload && !loading && !error) runLoad()
  }, [repoState, payload, loading, error, runLoad])

  const runNavigate = useCallback(
    async (route: string) => {
      if (!sessionId) return
      const target = route.trim() || '/'
      setNavigating(true)
      setError(null)
      setSelection(null)
      setHoveredId(null)
      try {
        const res = await fetch(apiUrl('/edit-lab/navigate'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, page_path: target }),
        })
        if (!res.ok) throw new Error(`Navigate failed (${res.status})`)
        const data: NavigatePayload = await res.json()
        if (data.session_expired) {
          const reloaded = await runLoad({ silent: true })
          if (!reloaded?.session_id) throw new Error('Session expired and reload failed.')
          const retry = await fetch(apiUrl('/edit-lab/navigate'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: reloaded.session_id, page_path: target }),
          })
          if (!retry.ok) throw new Error(`Navigate failed (${retry.status})`)
          const retryData: NavigatePayload = await retry.json()
          if (retryData.error) throw new Error(retryData.error)
          setPayload((prev) =>
            prev
              ? {
                  ...prev,
                  screenshot: retryData.screenshot || prev.screenshot,
                  sections: retryData.sections || [],
                  document_size: retryData.document_size || prev.document_size,
                  current_page: retryData.current_page || target,
                }
              : prev,
          )
          setSessionId(retryData.session_id)
          return
        }
        if (data.error) throw new Error(data.error)
        setPayload((prev) =>
          prev
            ? {
                ...prev,
                screenshot: data.screenshot || prev.screenshot,
                sections: data.sections || [],
                document_size: data.document_size || prev.document_size,
                current_page: data.current_page || target,
              }
            : prev,
        )
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to navigate'
        setToast({ kind: 'err', msg })
      } finally {
        setNavigating(false)
        setPageMenuOpen(false)
      }
    },
    [sessionId, runLoad],
  )

  useEffect(() => {
    const update = () => {
      if (canvasRef.current) setCanvasWidth(canvasRef.current.clientWidth)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [payload])

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!pageMenuOpen) return
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (target && target.closest('[data-edit-lab-page-menu]')) return
      setPageMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [pageMenuOpen])

  const scale = payload && payload.document_size.width > 0
    ? canvasWidth / payload.document_size.width
    : 1

  const triggerHighlight = useCallback((sectionId: string | null) => {
    if (!sectionId) return
    setJustUpdatedId(sectionId)
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    highlightTimerRef.current = setTimeout(() => setJustUpdatedId(null), HIGHLIGHT_MS)
  }, [])

  const performApply = useCallback(
    async (activeSessionId: string): Promise<ApplyPayload | null> => {
      if (!payload || !selection || !repoState) return null
      const targetFile = selection.source_file || payload.root_file
      if (!targetFile) {
        setToast({ kind: 'err', msg: 'Could not locate a source file for this selection.' })
        return null
      }
      const res = await fetch(apiUrl('/edit-lab/apply'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: activeSessionId,
          target_file: targetFile,
          section_label: selection.label,
          section_heading: selection.heading,
          section_paragraph: selection.paragraph,
          section_text: selection.text,
          section_tag: selection.tag,
          section_classes: selection.classes,
          section_role: selection.role,
          section_aria_label: selection.aria_label,
          prompt: promptText.trim(),
        }),
      })
      if (!res.ok) throw new Error(`Apply failed (${res.status})`)
      return (await res.json()) as ApplyPayload
    },
    [payload, selection, repoState, promptText],
  )

  const handleApply = useCallback(async () => {
    if (!payload || !selection || !repoState || !promptText.trim()) return

    const beforeSnapshot: SectionSnapshot = {
      label: selection.label,
      heading: selection.heading,
      screenshot: payload.screenshot,
      rect: { ...selection.rect },
      documentSize: { ...payload.document_size },
    }

    setApplying(true)
    setToast(null)
    setLastEdit(null)

    try {
      let active = sessionId
      if (!active) {
        const loaded = await runLoad({ silent: true })
        active = loaded?.session_id || null
        if (!active) throw new Error('Could not establish an Edit Lab session.')
      }

      let data = await performApply(active)
      if (data && data.session_expired) {
        const reloaded = await runLoad({ silent: true })
        if (!reloaded?.session_id) throw new Error('Session expired and reload failed.')
        data = await performApply(reloaded.session_id)
      }
      if (!data) throw new Error('Apply returned no data.')
      if (data.error) throw new Error(data.error)

      const newSectionId = data.updated_section_id || null
      const newSection = newSectionId
        ? data.sections.find((s) => s.id === newSectionId) || null
        : null
      const afterRect = newSection ? newSection.rect : beforeSnapshot.rect

      setPayload((prev) =>
        prev
          ? {
              ...prev,
              session_id: data!.session_id || prev.session_id,
              screenshot: data!.screenshot || prev.screenshot,
              sections: data!.sections?.length ? data!.sections : prev.sections,
              document_size: data!.document_size || prev.document_size,
            }
          : prev,
      )
      setSessionId(data.session_id || active)
      setPromptText('')
      setSelection(null)
      triggerHighlight(newSectionId)
      setLastEdit({
        summary: data.summary || `Updated ${beforeSnapshot.label}`,
        before: beforeSnapshot,
        afterRect,
        afterDocumentSize: data.document_size,
        afterScreenshot: data.screenshot,
        newSectionId,
        pending: true,
      })
      // No toast — the Accept/Reject card is the primary confirmation.
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to apply change'
      setToast({ kind: 'err', msg })
    } finally {
      setApplying(false)
    }
  }, [
    payload,
    selection,
    repoState,
    promptText,
    sessionId,
    performApply,
    runLoad,
    triggerHighlight,
  ])

  const handleAcceptEdit = useCallback(async () => {
    setLastEdit((prev) => (prev ? { ...prev, pending: false } : prev))
    // Track the accepted file locally so the Publish button still works
    // even if the backend session got GC'd between apply and accept —
    // the actual edit already landed on disk during apply, so all we
    // need to remember locally is "yes, include this file on publish".
    const acceptedTarget =
      lastEdit?.before?.label
        ? payload?.sections.find((s) => s.label === lastEdit.before.label)?.source_file
          || payload?.root_file
          || null
        : payload?.root_file || null
    if (acceptedTarget) {
      setAcceptedFiles((prev) => (prev.includes(acceptedTarget) ? prev : [...prev, acceptedTarget]))
    }
    if (sessionId) {
      try {
        const res = await fetch(apiUrl('/edit-lab/accept'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
        })
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data.accepted_files) && data.accepted_files.length > 0) {
            setAcceptedFiles(data.accepted_files)
          }
          // If data.session_expired is true, we silently keep our local
          // acceptedFiles list — no need to scare the user.
        }
      } catch {
        /* non-blocking — accept still succeeded locally */
      }
    }
    // Fade the accepted card out after a moment so the right panel returns
    // to its neutral empty state and the user can start a new selection.
    setTimeout(() => setLastEdit(null), 1800)
  }, [sessionId, lastEdit, payload])

  const handlePublish = useCallback(async () => {
    if (!sessionId || !acceptedFiles.length) return
    const token = (session as unknown as { accessToken?: string } | null)?.accessToken
    if (!token) {
      setToast({ kind: 'err', msg: 'Sign in with GitHub to publish changes.' })
      return
    }
    setPublishing(true)
    setPublishResult(null)
    try {
      const res = await fetch(apiUrl('/edit-lab/publish'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          access_token: token,
          github_user_id: githubUserId,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || `Publish failed (${res.status})`)
      }
      setPublishResult({
        branch_name: data.branch_name,
        branch_url: data.branch_url,
        files_changed: data.files_changed || [],
      })
      setToast({ kind: 'ok', msg: `Published to ${data.branch_name}` })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to publish'
      setToast({ kind: 'err', msg })
    } finally {
      setPublishing(false)
    }
  }, [sessionId, acceptedFiles, session, githubUserId])

  const handleRejectEdit = useCallback(async () => {
    if (!sessionId) {
      // No session to talk to — just drop the pending card. Nothing else to do.
      setLastEdit(null)
      setSelection(null)
      setJustUpdatedId(null)
      return
    }
    setReverting(true)
    try {
      const res = await fetch(apiUrl('/edit-lab/revert'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      })
      if (!res.ok) throw new Error(`Revert failed (${res.status})`)
      const data: RevertPayload = await res.json()
      if (data.session_expired) {
        // Session reaped between apply and reject — drop the pending card
        // and quietly reload the preview to re-create a fresh workspace.
        setLastEdit(null)
        setSelection(null)
        setJustUpdatedId(null)
        setToast({ kind: 'err', msg: 'Session expired — reloading preview…' })
        await runLoad({ silent: true })
        return
      }
      if (data.error) throw new Error(data.error)
      setPayload((prev) =>
        prev
          ? {
              ...prev,
              screenshot: data.screenshot || prev.screenshot,
              sections: data.sections || [],
              document_size: data.document_size || prev.document_size,
            }
          : prev,
      )
      setLastEdit(null)
      setSelection(null)
      setJustUpdatedId(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to revert change'
      setToast({ kind: 'err', msg })
    } finally {
      setReverting(false)
    }
  }, [sessionId, runLoad])

  const parsedStitchUrls = useMemo(() => {
    return stitchInput
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  }, [stitchInput])

  const stitchValidationError = useMemo(() => {
    if (parsedStitchUrls.length === 0) return null
    if (parsedStitchUrls.length > STITCH_MAX_URLS) {
      return `Up to ${STITCH_MAX_URLS} URLs per batch.`
    }
    const bad = parsedStitchUrls.find((u) => {
      try {
        const parsed = new URL(u)
        return parsed.protocol !== 'https:' && parsed.protocol !== 'http:'
      } catch {
        return true
      }
    })
    if (bad) return `Not a valid URL: ${bad.length > 48 ? `${bad.slice(0, 48)}…` : bad}`
    return null
  }, [parsedStitchUrls])

  const handleIngestStitch = useCallback(async () => {
    if (parsedStitchUrls.length === 0 || stitchValidationError) return
    setStitchStatus('loading')
    setStitchError(null)
    try {
      const data = await ingestStitchUrls(parsedStitchUrls)
      setStitchDesigns(data.designs)
      const succeeded = data.designs.filter((d) => !d.error)
      if (succeeded.length === 0) {
        const firstErr = data.designs.find((d) => d.error)?.error
        setStitchError(firstErr || 'All URLs failed to process.')
        setStitchStatus('error')
        return
      }
      setStitchStatus('success')
    } catch (e) {
      let msg: string
      if (e instanceof StitchApiError) {
        msg =
          e.status === 503
            ? 'Stitch ingestion is currently unavailable.'
            : e.message
      } else if (e instanceof Error) {
        msg = e.message || 'Could not reach the Stitch service.'
      } else {
        msg = 'Unknown error ingesting references.'
      }
      setStitchError(msg)
      setStitchStatus('error')
    }
  }, [parsedStitchUrls, stitchValidationError])

  const handleClearStitch = useCallback(() => {
    setStitchStatus('idle')
    setStitchDesigns([])
    setStitchError(null)
    setStitchInput('')
  }, [])

  const onCanvasPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (applying || navigating || loading || !payload) return
      if (e.button !== 0) return
      const rect = e.currentTarget.getBoundingClientRect()
      const x = (e.clientX - rect.left) / (scale || 1)
      const y = (e.clientY - rect.top) / (scale || 1)
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      setDragStart({ x, y })
      setDragCurrent({ x, y })
      setIsDragging(false)
    },
    [applying, navigating, loading, payload, scale],
  )

  const onCanvasPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragStart) return
      const rect = e.currentTarget.getBoundingClientRect()
      const x = (e.clientX - rect.left) / (scale || 1)
      const y = (e.clientY - rect.top) / (scale || 1)
      setDragCurrent({ x, y })
      if (!isDragging) {
        const dx = (x - dragStart.x) * scale
        const dy = (y - dragStart.y) * scale
        if (Math.sqrt(dx * dx + dy * dy) > 5) setIsDragging(true)
      }
    },
    [dragStart, isDragging, scale],
  )

  const onCanvasPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragStart || !dragCurrent || !payload) {
        setDragStart(null)
        setDragCurrent(null)
        setIsDragging(false)
        return
      }
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }

      if (isDragging) {
        const x = Math.min(dragStart.x, dragCurrent.x)
        const y = Math.min(dragStart.y, dragCurrent.y)
        const width = Math.abs(dragCurrent.x - dragStart.x)
        const height = Math.abs(dragCurrent.y - dragStart.y)
        if (width * scale > 8 && height * scale > 8) {
          setSelection(buildRectSelection({ x, y, width, height }, payload.sections, payload.root_file))
        }
      } else {
        const hit = hitTestSection(dragStart.x, dragStart.y, payload.sections)
        if (hit) {
          setSelection(sectionToSelection(hit))
        } else {
          setSelection(null)
        }
      }

      setDragStart(null)
      setDragCurrent(null)
      setIsDragging(false)
    },
    [dragStart, dragCurrent, isDragging, payload, scale],
  )

  const onCanvasPointerCancel = useCallback(() => {
    setDragStart(null)
    setDragCurrent(null)
    setIsDragging(false)
  }, [])

  const dragRectPx = useMemo(() => {
    if (!dragStart || !dragCurrent || !isDragging) return null
    const x = Math.min(dragStart.x, dragCurrent.x)
    const y = Math.min(dragStart.y, dragCurrent.y)
    const width = Math.abs(dragCurrent.x - dragStart.x)
    const height = Math.abs(dragCurrent.y - dragStart.y)
    return {
      left: x * scale,
      top: y * scale,
      width: width * scale,
      height: height * scale,
    }
  }, [dragStart, dragCurrent, isDragging, scale])

  // Gate the full Lab behind a password. Attendees who don't know it see a
  // "coming soon" teaser; the page still exists so they can read the feature
  // description. Unlock persists via localStorage so we only ask once.
  if (!labUnlockChecked) {
    return null
  }
  if (!labUnlocked) {
    return (
      <LabComingSoon
        onUnlock={() => {
          try {
            localStorage.setItem(LAB_UNLOCK_KEY, 'true')
          } catch {
            /* ignore */
          }
          setLabUnlocked(true)
        }}
      />
    )
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
      <style>{`
        @keyframes editLabPulse {
          0%   { box-shadow: 0 0 0 0 rgba(34,197,94,0.55); border-color: rgba(34,197,94,0.9); }
          60%  { box-shadow: 0 0 0 14px rgba(34,197,94,0.12); border-color: rgba(34,197,94,0.7); }
          100% { box-shadow: 0 0 0 6px rgba(34,197,94,0.08); border-color: rgba(34,197,94,0.55); }
        }
      `}</style>

      <div className="mb-6">
        <div className="text-[11px] mono uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
          The Lab
        </div>
        <h1 className="text-[28px] font-semibold text-white mt-1" style={{ letterSpacing: '-0.02em' }}>
          Select a section. Describe the change.
        </h1>
        <p className="text-[13px] mt-1.5 max-w-[620px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
          The Lab loads the current website from your repo. Click or drag to select any region, write a short prompt, and Reform applies the change to that part of your source — the dev server stays warm, so repeat edits are fast.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">
        <div
          className="rounded-2xl overflow-hidden relative"
          style={{
            background: 'rgba(6,8,13,0.55)',
            border: '1px solid rgba(255,255,255,0.06)',
            minHeight: 520,
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-2.5 border-b gap-3"
            style={{ borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}
          >
            <div className="flex items-center gap-2 text-[11px] mono min-w-0" style={{ color: 'rgba(255,255,255,0.4)' }}>
              <div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: payload && !loading ? '#22c55e' : 'rgba(255,255,255,0.2)' }}
              />
              <span className="truncate">
                {repoState?.url ? repoState.url.replace('https://github.com/', '') : 'no repo connected'}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
              <div className="relative" data-edit-lab-page-menu>
                <button
                  onClick={() => setPageMenuOpen((v) => !v)}
                  disabled={!payload || loading || navigating}
                  className="flex items-center gap-1 px-1.5 py-[2px] rounded transition-colors disabled:opacity-40"
                  style={{
                    background: pageMenuOpen ? 'rgba(124,140,255,0.1)' : 'transparent',
                    color: 'rgba(255,255,255,0.55)',
                  }}
                  title="Switch page"
                >
                  <span>{payload?.current_page || '/'}</span>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {pageMenuOpen && (
                  <div
                    className="absolute top-full left-0 mt-1.5 rounded-lg overflow-hidden min-w-[220px] max-h-[320px] z-[400000]"
                    style={{
                      background: 'rgba(6,8,13,0.96)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      backdropFilter: 'blur(14px)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    }}
                  >
                    <div className="max-h-[240px] overflow-y-auto">
                      {(payload?.available_pages || []).length === 0 && (
                        <div className="px-3 py-2 text-[10px] mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          No pages discovered
                        </div>
                      )}
                      {(payload?.available_pages || []).map((p) => {
                        const isCurrent = p.route === payload?.current_page
                        return (
                          <button
                            key={p.route}
                            onClick={() => runNavigate(p.route)}
                            className="w-full text-left px-3 py-2 flex items-center justify-between gap-3 transition-colors"
                            style={{
                              background: isCurrent ? 'rgba(124,140,255,0.1)' : 'transparent',
                              color: isCurrent ? 'white' : 'rgba(255,255,255,0.7)',
                            }}
                            onMouseEnter={(e) => {
                              if (!isCurrent) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                            }}
                            onMouseLeave={(e) => {
                              if (!isCurrent) e.currentTarget.style.background = 'transparent'
                            }}
                          >
                            <span className="text-[12px] font-medium truncate">{p.name}</span>
                            <span className="text-[10px] mono flex-shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }}>
                              {p.route}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    <div className="border-t px-3 py-2 flex items-center gap-2" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                      <input
                        type="text"
                        value={customPath}
                        onChange={(e) => setCustomPath(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && customPath.trim()) {
                            runNavigate(customPath.trim())
                            setCustomPath('')
                          }
                        }}
                        placeholder="/custom/path"
                        className="flex-1 bg-transparent outline-none text-[11px] mono"
                        style={{ color: 'white' }}
                      />
                      <button
                        onClick={() => {
                          if (customPath.trim()) {
                            runNavigate(customPath.trim())
                            setCustomPath('')
                          }
                        }}
                        disabled={!customPath.trim()}
                        className="text-[10px] px-2 py-[3px] rounded disabled:opacity-30"
                        style={{
                          background: 'rgba(124,140,255,0.12)',
                          border: '1px solid rgba(124,140,255,0.2)',
                          color: 'white',
                        }}
                      >
                        Go
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {payload?.framework && payload.framework !== 'unknown' && (
                <span className="px-1.5 py-[2px] rounded flex-shrink-0" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  {payload.framework}
                </span>
              )}
              {sessionId && !loading && (
                <span
                  className="px-1.5 py-[2px] rounded flex-shrink-0 flex items-center gap-1"
                  style={{ background: 'rgba(34,197,94,0.08)', color: 'rgba(134,239,172,0.9)' }}
                  title="Dev server is warm — edits reuse it"
                >
                  <span className="w-1 h-1 rounded-full" style={{ background: '#22c55e' }} />
                  warm
                </span>
              )}
            </div>
            <button
              onClick={() => runLoad()}
              disabled={loading || !repoState}
              className="text-[11px] px-2.5 py-1 rounded-lg transition-colors disabled:opacity-40 flex-shrink-0"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.55)',
              }}
            >
              {loading ? 'Loading…' : 'Reload preview'}
            </button>
            {acceptedFiles.length > 0 && (
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="text-[11px] px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-40 flex-shrink-0"
                style={{
                  background: 'rgba(34,197,94,0.12)',
                  border: '1px solid rgba(34,197,94,0.3)',
                  color: 'rgba(187,247,208,0.95)',
                }}
                title={`Publish ${acceptedFiles.length} accepted ${acceptedFiles.length === 1 ? 'file' : 'files'} to a new GitHub branch`}
              >
                {publishing ? (
                  <>
                    <div
                      className="w-3 h-3 rounded-full animate-spin"
                      style={{
                        border: '1.5px solid rgba(187,247,208,0.25)',
                        borderTopColor: 'rgba(187,247,208,0.95)',
                      }}
                    />
                    Publishing…
                  </>
                ) : (
                  <>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Publish to GitHub · {acceptedFiles.length}
                  </>
                )}
              </button>
            )}
          </div>

          {publishResult && (
            <div
              className="flex items-center justify-between gap-3 px-4 py-2"
              style={{
                background: 'rgba(34,197,94,0.06)',
                borderBottom: '1px solid rgba(34,197,94,0.18)',
              }}
            >
              <div className="flex items-center gap-2 min-w-0 text-[11px]">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#22c55e' }} />
                <span style={{ color: 'rgba(187,247,208,0.9)' }}>Published</span>
                <span className="mono truncate" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  {publishResult.branch_name}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
                <span className="mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {publishResult.files_changed.length} file{publishResult.files_changed.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href={publishResult.branch_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] px-2.5 py-1 rounded-md"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.75)',
                  }}
                >
                  View branch →
                </a>
                <button
                  onClick={() => setPublishResult(null)}
                  className="text-[11px]"
                  style={{ color: 'rgba(255,255,255,0.35)' }}
                  aria-label="Dismiss"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {payload && payload.available_pages && payload.available_pages.length > 1 && (
            <div
              className="flex items-center gap-1 px-3 py-2 overflow-x-auto"
              style={{
                background: 'rgba(255,255,255,0.015)',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <span
                className="text-[10px] mono uppercase tracking-wider pr-2 flex-shrink-0"
                style={{ color: 'rgba(255,255,255,0.3)' }}
              >
                Pages
              </span>
              {payload.available_pages.map((p) => {
                const isCurrent = p.route === payload.current_page
                return (
                  <button
                    key={p.route}
                    onClick={() => !navigating && !applying && runNavigate(p.route)}
                    disabled={navigating || applying || isCurrent}
                    className="text-[11px] px-2.5 py-1 rounded-md whitespace-nowrap transition-colors flex-shrink-0"
                    style={{
                      background: isCurrent ? 'rgba(124,140,255,0.14)' : 'transparent',
                      color: isCurrent ? 'white' : 'rgba(255,255,255,0.5)',
                      border: isCurrent
                        ? '1px solid rgba(170,180,255,0.25)'
                        : '1px solid rgba(255,255,255,0.06)',
                      cursor: isCurrent ? 'default' : navigating || applying ? 'not-allowed' : 'pointer',
                    }}
                    title={p.path || p.route}
                  >
                    {p.name}
                    <span className="mono ml-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      {p.route}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          <div ref={canvasRef} className="relative w-full" style={{ minHeight: 500 }}>
            {!repoState && !loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                <div className="text-[13px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  No repository connected yet.
                </div>
                <Link
                  href="/dashboard/discovery"
                  className="text-[11px] px-3 py-1.5 rounded-lg"
                  style={{
                    background: 'rgba(124,140,255,0.12)',
                    border: '1px solid rgba(124,140,255,0.2)',
                    color: 'rgba(255,255,255,0.8)',
                  }}
                >
                  Go to Project Discovery
                </Link>
              </div>
            )}

            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                <div
                  className="w-6 h-6 rounded-full animate-spin"
                  style={{ border: '2px solid rgba(124,140,255,0.15)', borderTopColor: '#7c8cff' }}
                />
                <div className="text-[12px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Cloning repo and booting the dev server…
                </div>
                <div className="text-[10px] mono max-w-[320px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  First load takes 60–120s. After this, edits reuse the warm dev server and take ~10s each.
                </div>
              </div>
            )}

            {error && !loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6">
                <div className="text-[13px] text-center max-w-[380px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  {error}
                </div>
                <button
                  onClick={() => runLoad()}
                  className="text-[11px] px-3 py-1.5 rounded-lg"
                  style={{
                    background: 'rgba(124,140,255,0.12)',
                    border: '1px solid rgba(124,140,255,0.2)',
                    color: 'rgba(255,255,255,0.8)',
                  }}
                >
                  Try again
                </button>
              </div>
            )}

            {payload && payload.screenshot && !loading && (
              <div
                className="relative w-full select-none"
                style={{
                  height: payload.document_size.height * scale,
                  cursor: applying || navigating ? 'default' : 'crosshair',
                  touchAction: 'none',
                }}
                onPointerDown={onCanvasPointerDown}
                onPointerMove={onCanvasPointerMove}
                onPointerUp={onCanvasPointerUp}
                onPointerCancel={onCanvasPointerCancel}
              >
                <img
                  src={`data:image/png;base64,${payload.screenshot}`}
                  alt="Current website preview"
                  className="w-full block"
                  style={{ display: 'block', pointerEvents: 'none', userSelect: 'none' }}
                  draggable={false}
                />
                {payload.sections.map((sec) => {
                  const isMember = selection?.memberIds.includes(sec.id) ?? false
                  const isHovered = hoveredId === sec.id && !isDragging
                  const isJustUpdated = justUpdatedId === sec.id
                  const area = Math.max(1, sec.rect.width * sec.rect.height)
                  const z = 100000 - Math.round(area / 1000)
                  return (
                    <div
                      key={sec.id}
                      onPointerEnter={() => !isDragging && setHoveredId(sec.id)}
                      onPointerLeave={() =>
                        setHoveredId((prev) => (prev === sec.id ? null : prev))
                      }
                      className="absolute transition-[border,background] duration-100 pointer-events-none"
                      style={{
                        left: sec.rect.x * scale,
                        top: sec.rect.y * scale,
                        width: sec.rect.width * scale,
                        height: sec.rect.height * scale,
                        zIndex: isJustUpdated ? 250000 : z,
                        border: isJustUpdated
                          ? '2px solid rgba(34,197,94,0.9)'
                          : isMember
                            ? '1.5px solid rgba(124,140,255,0.7)'
                            : isHovered
                              ? '1px solid rgba(124,140,255,0.4)'
                              : '1px solid transparent',
                        background: isJustUpdated
                          ? 'rgba(34,197,94,0.08)'
                          : isMember
                            ? 'rgba(124,140,255,0.05)'
                            : isHovered
                              ? 'rgba(124,140,255,0.025)'
                              : 'transparent',
                        animation: isJustUpdated ? 'editLabPulse 2.8s ease-out' : undefined,
                      }}
                    >
                      {(isHovered || isJustUpdated) && !isMember && (
                        <div
                          className="absolute left-0 px-2 py-[3px] rounded-md text-[10px] mono whitespace-nowrap pointer-events-none flex items-center gap-1"
                          style={{
                            top: sec.rect.y * scale > 22 ? -22 : 4,
                            background: isJustUpdated ? '#22c55e' : 'rgba(6,8,13,0.92)',
                            color: isJustUpdated ? 'white' : 'rgba(255,255,255,0.78)',
                            border: isJustUpdated ? 'none' : '1px solid rgba(255,255,255,0.08)',
                            backdropFilter: 'blur(8px)',
                          }}
                        >
                          {isJustUpdated && <span>✓</span>}
                          {sec.label}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Active selection outline (click or rect) */}
                {selection && !isDragging && (
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      left: selection.rect.x * scale,
                      top: selection.rect.y * scale,
                      width: selection.rect.width * scale,
                      height: selection.rect.height * scale,
                      border: '2px solid #7c8cff',
                      background: 'rgba(124,140,255,0.06)',
                      boxShadow: '0 0 0 4px rgba(124,140,255,0.12)',
                      zIndex: 260000,
                    }}
                  >
                    <div
                      className="absolute left-0 px-2 py-[3px] rounded-md text-[10px] mono whitespace-nowrap flex items-center gap-1"
                      style={{
                        top: selection.rect.y * scale > 22 ? -22 : 4,
                        background: '#7c8cff',
                        color: 'white',
                      }}
                    >
                      {selection.label}
                    </div>
                  </div>
                )}

                {/* Live drag rectangle */}
                {dragRectPx && (
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      left: dragRectPx.left,
                      top: dragRectPx.top,
                      width: dragRectPx.width,
                      height: dragRectPx.height,
                      border: '1.5px dashed rgba(124,140,255,0.75)',
                      background: 'rgba(124,140,255,0.06)',
                      zIndex: 270000,
                    }}
                  />
                )}

                {payload.sections.length === 0 && (
                  <div
                    className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-[10px] mono"
                    style={{
                      background: 'rgba(6,8,13,0.82)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.45)',
                    }}
                  >
                    No sections detected on this page
                  </div>
                )}

                {navigating && !applying && (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                      background: 'rgba(5,7,12,0.68)',
                      backdropFilter: 'blur(4px)',
                      zIndex: 300000,
                    }}
                  >
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div
                        className="w-6 h-6 rounded-full animate-spin"
                        style={{ border: '2px solid rgba(124,140,255,0.15)', borderTopColor: '#7c8cff' }}
                      />
                      <div className="text-[12px]" style={{ color: 'rgba(255,255,255,0.65)' }}>
                        Loading {payload?.current_page || 'page'}…
                      </div>
                      <div className="text-[10px] mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        Reusing warm dev server
                      </div>
                    </div>
                  </div>
                )}

                {applying && (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                      background: 'rgba(5,7,12,0.72)',
                      backdropFilter: 'blur(4px)',
                      zIndex: 300000,
                    }}
                  >
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div
                        className="w-6 h-6 rounded-full animate-spin"
                        style={{ border: '2px solid rgba(124,140,255,0.15)', borderTopColor: '#7c8cff' }}
                      />
                      <div className="text-[12px]" style={{ color: 'rgba(255,255,255,0.65)' }}>
                        Applying change to {selection?.label || 'selection'}…
                      </div>
                      <div className="text-[10px] mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        Hot-reloading the warm dev server — ~10s
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div
          className="rounded-2xl p-5 flex flex-col gap-4 h-fit lg:sticky lg:top-[100px]"
          style={{
            background: 'rgba(6,8,13,0.55)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {!selection && !lastEdit && (
            <div className="py-8 flex flex-col items-center gap-3 text-center">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: 'rgba(124,140,255,0.08)',
                  border: '1px solid rgba(124,140,255,0.15)',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c8cff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
              </div>
              <div className="text-[13px] font-medium text-white">Click or drag to select</div>
              <div className="text-[11px] max-w-[260px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Click any section, or drag a rectangle across multiple. The dev server stays warm between edits.
              </div>
            </div>
          )}

          {!selection && lastEdit && (
            <LastEditCard
              lastEdit={lastEdit}
              onDismiss={() => setLastEdit(null)}
              onAccept={handleAcceptEdit}
              onReject={handleRejectEdit}
              reverting={reverting}
            />
          )}

          {selection && (
            <>
              <div>
                <div className="flex items-center justify-between">
                  <div className="text-[10px] mono uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    <span>Editing</span>
                  </div>
                  <button
                    onClick={() => {
                      setSelection(null)
                      setPromptText('')
                    }}
                    disabled={applying}
                    className="text-[10px] disabled:opacity-40"
                    style={{ color: 'rgba(255,255,255,0.3)' }}
                  >
                    clear
                  </button>
                </div>
                <div className="text-[15px] font-semibold text-white mt-1">{selection.label}</div>
                {selection.heading && (
                  <div className="text-[11px] mt-1 line-clamp-2" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    “{selection.heading}”
                  </div>
                )}
                {selection.kind === 'rect' && selection.memberIds.length === 0 && (
                  <div className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    Custom region — Reform will interpret this area by visible content and edit the page root file.
                  </div>
                )}
                {selection.source_file && (
                  <div
                    className="text-[10px] mono mt-2 truncate px-2 py-1 rounded"
                    style={{
                      color: 'rgba(255,255,255,0.45)',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.05)',
                    }}
                    title={selection.source_file}
                  >
                    {selection.source_file}
                  </div>
                )}
              </div>

              <div>
                <div
                  className="text-[10px] mono uppercase tracking-wider mb-1.5"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                >
                  Describe the change
                </div>
                <textarea
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder="Make this section feel more modern…"
                  rows={4}
                  disabled={applying}
                  className="w-full rounded-lg px-3 py-2.5 text-[13px] resize-none outline-none disabled:opacity-50"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'white',
                  }}
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {PROMPT_EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => setPromptText(ex)}
                      disabled={applying}
                      className="text-[10px] px-2 py-1 rounded-md transition-colors disabled:opacity-40"
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        color: 'rgba(255,255,255,0.5)',
                      }}
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleApply}
                disabled={applying || !promptText.trim()}
                className="w-full py-2.5 rounded-xl text-[12px] font-medium transition-all disabled:cursor-not-allowed"
                style={{
                  background:
                    applying || !promptText.trim()
                      ? 'rgba(124,140,255,0.08)'
                      : 'rgba(124,140,255,0.18)',
                  border: '1px solid rgba(170,180,255,0.22)',
                  color: applying || !promptText.trim() ? 'rgba(255,255,255,0.35)' : 'white',
                }}
              >
                {applying ? 'Applying…' : 'Apply change'}
              </button>

              {lastEdit && (
                <LastEditCard
                  lastEdit={lastEdit}
                  onDismiss={() => setLastEdit(null)}
                  onAccept={handleAcceptEdit}
                  onReject={handleRejectEdit}
                  reverting={reverting}
                  compact
                />
              )}
            </>
          )}

          <StitchReferencesPanel
            open={stitchOpen}
            onToggle={() => setStitchOpen((v) => !v)}
            input={stitchInput}
            onInputChange={setStitchInput}
            parsedUrls={parsedStitchUrls}
            validationError={stitchValidationError}
            status={stitchStatus}
            designs={stitchDesigns}
            errorMessage={stitchError}
            onIngest={handleIngestStitch}
            onClear={handleClearStitch}
          />

          {toast && (
            <div
              className="rounded-lg px-3 py-2 text-[11px]"
              style={{
                background: toast.kind === 'ok' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${toast.kind === 'ok' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.22)'}`,
                color: toast.kind === 'ok' ? 'rgba(187,247,208,0.9)' : 'rgba(254,202,202,0.9)',
              }}
            >
              {toast.msg}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function LastEditCard({
  lastEdit,
  onDismiss,
  onAccept,
  onReject,
  reverting,
  compact = false,
}: {
  lastEdit: {
    summary: string
    before: SectionSnapshot
    afterRect: Rect
    afterDocumentSize: DocumentSize
    afterScreenshot: string
    newSectionId: string | null
    pending: boolean
  }
  onDismiss: () => void
  onAccept: () => void
  onReject: () => void
  reverting: boolean
  compact?: boolean
}) {
  const pending = lastEdit.pending
  const accentBg = pending ? 'rgba(124,140,255,0.05)' : 'rgba(34,197,94,0.04)'
  const accentBorder = pending ? 'rgba(124,140,255,0.22)' : 'rgba(34,197,94,0.18)'
  const statusDot = pending ? '#7c8cff' : '#22c55e'
  const statusLabelColor = pending ? 'rgba(170,180,255,0.9)' : 'rgba(134,239,172,0.9)'

  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-3"
      style={{
        background: accentBg,
        border: `1px solid ${accentBorder}`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: statusDot }} />
          <div className="text-[10px] mono uppercase tracking-wider" style={{ color: statusLabelColor }}>
            {pending ? `Review ${lastEdit.before.label}` : `Accepted ${lastEdit.before.label}`}
          </div>
        </div>
        {!pending && (
          <button
            onClick={onDismiss}
            className="text-[10px]"
            style={{ color: 'rgba(255,255,255,0.3)' }}
            aria-label="Dismiss"
          >
            ×
          </button>
        )}
      </div>
      <div className="text-[12px] font-medium text-white line-clamp-2">{lastEdit.summary}</div>

      {!compact && (
        <div className="grid grid-cols-2 gap-2">
          <SectionCrop
            label="Before"
            screenshot={lastEdit.before.screenshot}
            rect={lastEdit.before.rect}
            documentSize={lastEdit.before.documentSize}
          />
          <SectionCrop
            label="After"
            screenshot={lastEdit.afterScreenshot}
            rect={lastEdit.afterRect}
            documentSize={lastEdit.afterDocumentSize}
          />
        </div>
      )}

      {pending && (
        <div className="flex items-center gap-2">
          <button
            onClick={onAccept}
            disabled={reverting}
            className="flex-1 py-2 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-40"
            style={{
              background: 'rgba(34,197,94,0.15)',
              border: '1px solid rgba(34,197,94,0.35)',
              color: 'rgba(187,247,208,0.95)',
            }}
          >
            ✓ Accept
          </button>
          <button
            onClick={onReject}
            disabled={reverting}
            className="flex-1 py-2 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: 'rgba(254,202,202,0.95)',
            }}
          >
            {reverting ? (
              <>
                <div
                  className="w-3 h-3 rounded-full animate-spin"
                  style={{ border: '1.5px solid rgba(254,202,202,0.25)', borderTopColor: 'rgba(254,202,202,0.95)' }}
                />
                Reverting…
              </>
            ) : (
              <>✕ Reject</>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

function StitchReferencesPanel({
  open,
  onToggle,
  input,
  onInputChange,
  parsedUrls,
  validationError,
  status,
  designs,
  errorMessage,
  onIngest,
  onClear,
}: {
  open: boolean
  onToggle: () => void
  input: string
  onInputChange: (value: string) => void
  parsedUrls: string[]
  validationError: string | null
  status: 'idle' | 'loading' | 'success' | 'error'
  designs: StitchDesign[]
  errorMessage: string | null
  onIngest: () => void
  onClear: () => void
}) {
  const succeeded = designs.filter((d) => !d.error)
  const failed = designs.filter((d) => d.error)
  const urlCount = parsedUrls.length
  const urlNoun = urlCount === 1 ? 'reference' : 'references'

  const ingestDisabled =
    status === 'loading' || urlCount === 0 || !!validationError

  let buttonLabel: string
  if (status === 'loading') {
    buttonLabel = `Ingesting ${urlCount} ${urlNoun}…`
  } else if (status === 'error') {
    buttonLabel = 'Retry'
  } else if (urlCount === 0) {
    buttonLabel = 'Ingest references'
  } else {
    buttonLabel = `Ingest ${urlCount} ${urlNoun}`
  }

  return (
    <div
      className="mt-1 pt-4"
      style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <div
            className="text-[10px] mono uppercase tracking-wider"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            Stitch references
          </div>
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
            optional
          </span>
          {status === 'success' && succeeded.length > 0 && (
            <span
              className="text-[10px] px-1.5 py-[1px] rounded-full"
              style={{
                background: 'rgba(34,197,94,0.15)',
                color: 'rgba(187,247,208,0.9)',
                border: '1px solid rgba(34,197,94,0.22)',
              }}
            >
              {succeeded.length}
            </span>
          )}
        </div>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 120ms' }}
        >
          <path d="M2 4l3 3 3-3" />
        </svg>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-2.5">
          <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Paste up to {STITCH_MAX_URLS} Google Stitch share URLs, one per line. Reform will
            capture each as a design reference.
          </div>

          <textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="https://stitch.withgoogle.com/…"
            rows={3}
            disabled={status === 'loading'}
            spellCheck={false}
            className="w-full rounded-lg px-3 py-2.5 text-[12px] resize-none outline-none disabled:opacity-50"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'white',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          />

          {validationError && (
            <div className="text-[10px]" style={{ color: 'rgba(254,202,202,0.85)' }}>
              {validationError}
            </div>
          )}

          <button
            onClick={onIngest}
            disabled={ingestDisabled}
            className="w-full py-2 rounded-lg text-[12px] font-medium transition-all disabled:cursor-not-allowed"
            style={{
              background: ingestDisabled
                ? 'rgba(124,140,255,0.08)'
                : 'rgba(124,140,255,0.18)',
              border: '1px solid rgba(170,180,255,0.22)',
              color: ingestDisabled ? 'rgba(255,255,255,0.35)' : 'white',
            }}
          >
            {buttonLabel}
          </button>

          {status === 'loading' && (
            <div
              className="text-[10px] flex items-center gap-1.5"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              <div
                className="w-2.5 h-2.5 rounded-full animate-spin flex-shrink-0"
                style={{
                  border: '1.5px solid rgba(124,140,255,0.2)',
                  borderTopColor: '#7c8cff',
                }}
              />
              Capturing screenshots and extracting design tokens. Up to ~30s per URL.
            </div>
          )}

          {status === 'success' && succeeded.length > 0 && (
            <div
              className="rounded-lg p-3 flex flex-col gap-2.5"
              style={{
                background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.22)',
              }}
            >
              <div className="flex items-center gap-2">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="rgba(187,247,208,0.95)"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 6.5l2.5 2.5L10 3.5" />
                </svg>
                <div
                  className="text-[11px]"
                  style={{ color: 'rgba(187,247,208,0.95)' }}
                >
                  {succeeded.length} Stitch {succeeded.length === 1 ? 'reference' : 'references'} ingested
                  {failed.length > 0 && (
                    <span style={{ color: 'rgba(254,202,202,0.85)' }}>
                      {' · '}
                      {failed.length} failed
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {succeeded.slice(0, STITCH_MAX_URLS).map((d, i) =>
                  d.screenshot_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={`${d.url}-${i}`}
                      src={d.screenshot_url}
                      alt={d.summary || 'Stitch reference'}
                      title={d.summary || d.url}
                      className="rounded-md object-cover flex-shrink-0"
                      style={{
                        width: 54,
                        height: 54,
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    />
                  ) : (
                    <div
                      key={`${d.url}-${i}`}
                      title={d.url}
                      className="rounded-md flex-shrink-0 text-[9px] flex items-center justify-center px-1 text-center"
                      style={{
                        width: 54,
                        height: 54,
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: 'rgba(255,255,255,0.4)',
                      }}
                    >
                      no preview
                    </div>
                  ),
                )}
              </div>
              <button
                onClick={onClear}
                className="text-[10px] self-start underline-offset-2 hover:underline"
                style={{ color: 'rgba(187,247,208,0.7)' }}
              >
                Clear references
              </button>
            </div>
          )}

          {status === 'error' && errorMessage && (
            <div
              className="rounded-lg p-3 text-[11px] flex flex-col gap-0.5"
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.22)',
                color: 'rgba(254,202,202,0.95)',
              }}
            >
              <div className="font-medium">Couldn&rsquo;t ingest references</div>
              <div style={{ color: 'rgba(254,202,202,0.7)' }}>{errorMessage}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SectionCrop({
  label,
  screenshot,
  rect,
  documentSize,
}: {
  label: string
  screenshot: string
  rect: Rect
  documentSize: DocumentSize
}) {
  const displayWidth = 160
  const widthScale = displayWidth / Math.max(rect.width, 1)
  const displayHeight = Math.min(180, Math.max(60, rect.height * widthScale))
  // If the section is very tall, cap height and let it crop from the top.
  const scale = Math.min(widthScale, displayHeight / Math.max(rect.height, 1))
  const effectiveScale = Math.min(widthScale, scale)

  return (
    <div className="flex flex-col gap-1">
      <div className="text-[9px] mono uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
        {label}
      </div>
      <div
        className="rounded-md overflow-hidden"
        style={{
          width: displayWidth,
          height: displayHeight,
          border: '1px solid rgba(255,255,255,0.08)',
          background: '#0a0d14',
          backgroundImage: `url(data:image/png;base64,${screenshot})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: `${documentSize.width * effectiveScale}px ${documentSize.height * effectiveScale}px`,
          backgroundPosition: `${-rect.x * effectiveScale}px ${-rect.y * effectiveScale}px`,
        }}
      />
    </div>
  )
}

function LabComingSoon({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (password.trim() === LAB_PASSWORD) {
      setError(false)
      onUnlock()
    } else {
      setError(true)
      setShake(true)
      setTimeout(() => setShake(false), 400)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }

  const inputBorder = error ? '#ef4444' : inputFocused ? '#7c3aed' : 'rgba(0,0,0,0.10)'
  const inputShadow = error
    ? '0 0 0 3px rgba(239,68,68,0.12)'
    : inputFocused
    ? '0 0 0 3px rgba(124,58,237,0.14)'
    : 'inset 0 1px 0 rgba(0,0,0,0.02)'

  const canSubmit = password.trim().length > 0

  return (
    <div className="relative">
      <style>{`
        @keyframes labGateShake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        @keyframes labHaloDrift {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: 1; }
          50%      { transform: translate3d(0, -6px, 0) scale(1.02); opacity: 0.92; }
        }
      `}</style>

      {/* Ambient violet halo at the top — subtle premium signal */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0"
        style={{
          height: 460,
          background:
            'radial-gradient(ellipse 70% 60% at 50% 0%, rgba(124,58,237,0.10) 0%, rgba(124,58,237,0.04) 36%, transparent 72%)',
          animation: 'labHaloDrift 12s ease-in-out infinite',
        }}
      />

      <div className="relative max-w-[760px] mx-auto px-5 sm:px-8 pt-12 sm:pt-16 pb-24">
        {/* ── Hero ───────────────────────────────────────────────────── */}
        <div className="text-center mb-14 sm:mb-16">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-6"
            style={{
              background: 'rgba(124,58,237,0.06)',
              border: '1px solid rgba(124,58,237,0.18)',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full status-dot-pulse"
              style={{ background: '#7c3aed', boxShadow: '0 0 10px rgba(124,58,237,0.55)' }}
            />
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: '#6d28d9' }}
            >
              The Lab · Private Preview
            </span>
          </div>

          <h1
            className="text-balance font-bold"
            style={{
              color: '#0a0a0a',
              fontSize: 'clamp(38px, 6vw, 56px)',
              lineHeight: 1.04,
              letterSpacing: '-0.035em',
            }}
          >
            Edit your live UI
            <br />
            <span style={{ color: 'rgba(10,10,10,0.34)' }}>by talking to it.</span>
          </h1>

          <p
            className="mt-6 text-balance mx-auto"
            style={{
              color: 'rgba(10,10,10,0.55)',
              fontSize: 16,
              lineHeight: 1.7,
              maxWidth: 520,
            }}
          >
            Pick a section. Describe the change in plain English. Reform rewrites that
            slice of your source against a warm dev server — every edit lands in seconds.
          </p>
        </div>

        {/* ── Flow card ──────────────────────────────────────────────── */}
        <div
          className="rounded-2xl mb-10 overflow-hidden"
          style={{
            background: '#ffffff',
            border: '1px solid rgba(0,0,0,0.07)',
            boxShadow:
              '0 1px 0 rgba(255,255,255,0.6) inset, 0 24px 60px -28px rgba(124,58,237,0.18), 0 8px 24px -16px rgba(0,0,0,0.08)',
          }}
        >
          <div
            className="flex items-center justify-between px-6 sm:px-7 py-4"
            style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
          >
            <div
              className="text-[10px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: 'rgba(10,10,10,0.42)' }}
            >
              How The Lab works
            </div>
            <div
              className="text-[10px] mono uppercase tracking-[0.14em]"
              style={{ color: 'rgba(10,10,10,0.28)' }}
            >
              live preview · ~10s round-trip
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3">
            <LabFlowStep
              step="01"
              title="Select"
              body="Click any section — navbar, hero, pricing card, a single button — or drag a rectangle across multiple elements."
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h6v6H4z" />
                  <path d="M14 14h6v6h-6z" />
                  <path d="M10 10l4 4" />
                </svg>
              }
            />
            <LabFlowStep
              step="02"
              title="Describe"
              body="Plain-English prompts — &ldquo;tighten the spacing&rdquo;, &ldquo;use a bigger heading&rdquo;, &ldquo;simplify this&rdquo;. No CSS required."
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              }
            />
            <LabFlowStep
              step="03"
              title="Ship"
              body="Reform rewrites the source, renders the result, and pushes the diff to a new GitHub branch when you accept."
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="M13 5l7 7-7 7" />
                </svg>
              }
              isLast
            />
          </div>
        </div>

        {/* ── Access code ────────────────────────────────────────────── */}
        <div
          className="rounded-2xl px-6 sm:px-8 py-7 sm:py-8"
          style={{
            background: 'linear-gradient(180deg, #fbfaff 0%, #ffffff 100%)',
            border: '1px solid rgba(124,58,237,0.18)',
            boxShadow:
              '0 1px 0 rgba(255,255,255,0.65) inset, 0 16px 50px -22px rgba(124,58,237,0.22), 0 4px 16px -10px rgba(0,0,0,0.06)',
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
            <div>
              <div
                className="text-[10px] font-semibold uppercase tracking-[0.16em] mb-2"
                style={{ color: '#7c3aed' }}
              >
                Early access
              </div>
              <h2
                className="font-semibold"
                style={{
                  color: '#0a0a0a',
                  fontSize: 22,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                }}
              >
                Have an access code?
              </h2>
              <p
                className="mt-1.5 text-[13px]"
                style={{ color: 'rgba(10,10,10,0.5)', lineHeight: 1.6, maxWidth: 460 }}
              >
                The Lab is gated during the hackathon. Enter your code to unlock it on
                this device — public access opens shortly after the event.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            style={{ animation: shake ? 'labGateShake 0.4s ease-in-out' : undefined }}
          >
            <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
              <input
                ref={inputRef}
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (error) setError(false)
                }}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder="Enter access code"
                spellCheck={false}
                autoComplete="off"
                aria-label="Access code"
                aria-invalid={error || undefined}
                className="flex-1 h-12 rounded-xl px-4 text-[14px] outline-none transition-all duration-200"
                style={{
                  color: '#0a0a0a',
                  background: '#ffffff',
                  border: `1px solid ${inputBorder}`,
                  boxShadow: inputShadow,
                  letterSpacing: '0.04em',
                }}
              />
              <button
                type="submit"
                disabled={!canSubmit}
                className="h-12 px-6 rounded-xl text-[13px] font-semibold transition-all duration-200 disabled:cursor-not-allowed active:scale-[0.97] inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                style={{
                  background: canSubmit
                    ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 55%, #6d28d9 100%)'
                    : 'rgba(0,0,0,0.04)',
                  color: canSubmit ? '#ffffff' : 'rgba(0,0,0,0.30)',
                  border: `1px solid ${canSubmit ? 'rgba(124,58,237,0.55)' : 'rgba(0,0,0,0.06)'}`,
                  boxShadow: canSubmit
                    ? '0 10px 28px -10px rgba(124,58,237,0.55), inset 0 1px 0 rgba(255,255,255,0.18)'
                    : 'none',
                  letterSpacing: '-0.005em',
                }}
              >
                Unlock The Lab
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path
                    d="M3 7h8M8 4l3 3-3 3"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>

            <div
              className="mt-3 flex items-center justify-between text-[11px] gap-3"
              style={{ minHeight: 18 }}
            >
              <div role="status" aria-live="polite">
                {error ? (
                  <span style={{ color: '#dc2626' }}>
                    That code doesn&rsquo;t match. Double-check or reach out for access.
                  </span>
                ) : (
                  <span style={{ color: 'rgba(10,10,10,0.4)' }}>
                    Unlock persists on this browser.
                  </span>
                )}
              </div>
              <a
                href="mailto:hamza.daqa@gmail.com?subject=Reform%20Lab%20access"
                className="font-medium"
                style={{ color: '#7c3aed' }}
              >
                Request a code →
              </a>
            </div>
          </form>
        </div>

        {/* Footnote */}
        <div
          className="mt-8 text-center text-[11px]"
          style={{ color: 'rgba(10,10,10,0.35)' }}
        >
          Part of Reform · Free for hackathon attendees · Public launch follows the event
        </div>
      </div>
    </div>
  )
}

function LabFlowStep({
  step,
  title,
  body,
  icon,
  isLast = false,
}: {
  step: string
  title: string
  body: string
  icon: React.ReactNode
  isLast?: boolean
}) {
  return (
    <div
      className="px-6 sm:px-7 py-6 sm:py-7 flex flex-col gap-3 relative"
      style={{
        // Vertical separators between steps on desktop, horizontal on mobile.
        // Use a single border so it never doubles up between adjacent cells.
        borderRight: !isLast ? '1px solid rgba(0,0,0,0.05)' : undefined,
      }}
    >
      <div className="flex items-center justify-between">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{
            color: '#7c3aed',
            background: 'rgba(124,58,237,0.07)',
            border: '1px solid rgba(124,58,237,0.16)',
          }}
        >
          {icon}
        </div>
        <span
          className="mono text-[10px] font-semibold tracking-[0.12em]"
          style={{ color: 'rgba(10,10,10,0.28)' }}
        >
          {step}
        </span>
      </div>
      <div
        className="text-[14px] font-semibold"
        style={{ color: '#0a0a0a', letterSpacing: '-0.012em' }}
      >
        {title}
      </div>
      <p
        className="text-[12.5px]"
        style={{ color: 'rgba(10,10,10,0.55)', lineHeight: 1.6 }}
      >
        {body}
      </p>
    </div>
  )
}
