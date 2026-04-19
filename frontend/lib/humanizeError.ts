/**
 * Central error humanizer for the dashboard.
 *
 * The contract: anything thrown or returned from a fetch goes through
 * `humanizeError()` before it's shown to the user. The result is a short,
 * human, non-developer sentence.
 *
 * Two use modes:
 *   1) `humanizeError(err)` — handed an Error / string / unknown after a
 *      fetch failed. Returns the friendliest possible message.
 *   2) `humanizeResponse(res)` — handed a non-OK Response. Reads the
 *      backend's `{detail, kind}` JSON body if available (the backend
 *      already humanizes via `app/services/error_messages.py`), else
 *      falls back to a status-based default.
 *
 * Always returns a string — never throws, never empty.
 */

const STATUS_DEFAULTS: Record<number, string> = {
  400: 'Some of the information looks off. Please try again.',
  401: 'Please sign in to continue.',
  403: "You don't have permission to do that.",
  404: "We couldn't find what you were looking for.",
  408: 'That took longer than expected. Please try again.',
  409: 'That looks like a duplicate. Please refresh and try again.',
  413: 'That file or request is too large.',
  422: 'Some of the information looks off. Please try again.',
  429: "You're moving fast — please wait a moment and try again.",
  500: 'Something went wrong on our end. Please try again.',
  502: 'We had trouble talking to one of our services. Please try again.',
  503: "We're having trouble reaching one of our services. Please try again in a moment.",
  504: 'That took longer than expected. Please try again.',
}

const GENERIC = 'Something went wrong. Please try again.'

/** Friendly fallback per network/transport failure mode. */
function fromTransport(err: unknown): string | null {
  if (err instanceof TypeError) {
    const msg = err.message?.toLowerCase() ?? ''
    if (msg.includes('failed to fetch') || msg.includes('network')) {
      return "We couldn't reach the server. Check your connection and try again."
    }
  }
  if (err instanceof DOMException && err.name === 'AbortError') {
    return 'Request was canceled. Try again when you’re ready.'
  }
  return null
}

/** Strip dev-jargon / stack-trace markers from a candidate message. */
function looksLikeDevNoise(text: string): boolean {
  const t = text.toLowerCase()
  if (t.length > 200) return true
  return (
    t.includes('traceback')
    || t.includes('exception')
    || t.includes('<class')
    || t.includes('sqlalchemy')
    || t.includes('psycopg')
    || t.includes('asyncpg')
    || t.includes('playwright._impl')
    || t.includes('httpx._')
    || t.startsWith('error:')
    || /^\w+error\b/i.test(t)         // "ValueError: …", "RuntimeError: …"
  )
}

export function humanizeError(err: unknown, fallback?: string): string {
  if (err == null) return fallback ?? GENERIC

  const transport = fromTransport(err)
  if (transport) return transport

  if (typeof err === 'string') {
    if (!err.trim()) return fallback ?? GENERIC
    return looksLikeDevNoise(err) ? (fallback ?? GENERIC) : err
  }

  if (err instanceof Error) {
    const msg = err.message?.trim() ?? ''
    if (!msg) return fallback ?? GENERIC
    return looksLikeDevNoise(msg) ? (fallback ?? GENERIC) : msg
  }

  // Object with a detail/error/message field (matches our backend shape).
  if (typeof err === 'object') {
    const o = err as Record<string, unknown>
    for (const key of ['detail', 'error', 'message']) {
      const v = o[key]
      if (typeof v === 'string' && v.trim()) {
        return looksLikeDevNoise(v) ? (fallback ?? GENERIC) : v
      }
    }
  }

  return fallback ?? GENERIC
}

/**
 * Humanize a non-OK Response. Tries the backend body first, then a
 * status default, then a generic fallback. Safe to call without
 * awaiting `.text()`/`.json()` yourself.
 */
export async function humanizeResponse(
  res: Response,
  fallback?: string,
): Promise<string> {
  // Try the JSON body — our backend's error envelope is `{detail, kind}`.
  try {
    const ct = res.headers.get('content-type') ?? ''
    if (ct.includes('application/json')) {
      const body = await res.clone().json() as Record<string, unknown>
      const detail = body?.detail
      if (typeof detail === 'string' && detail.trim() && !looksLikeDevNoise(detail)) {
        return detail
      }
    } else {
      const text = (await res.clone().text()).trim()
      if (text && !looksLikeDevNoise(text)) return text
    }
  } catch {
    /* ignore — fall through to status defaults */
  }
  return STATUS_DEFAULTS[res.status] ?? fallback ?? GENERIC
}

/**
 * Convenience: do a fetch and either return the parsed JSON or throw a
 * humanized Error. Use this in components that don't need to inspect the
 * Response themselves.
 */
export async function fetchOrThrow<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit,
  fallback?: string,
): Promise<T> {
  let res: Response
  try {
    res = await fetch(input, init)
  } catch (err) {
    throw new Error(humanizeError(err, fallback))
  }
  if (!res.ok) {
    throw new Error(await humanizeResponse(res, fallback))
  }
  return res.json() as Promise<T>
}
