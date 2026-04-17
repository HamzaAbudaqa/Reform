'use client'

import { useEffect, useRef } from 'react'
import type { HeatmapBucket, HeatmapLayer } from '@/types/heatmap'
import { HEATMAP_GRID } from '@/types/heatmap'

interface Props {
  screenshotUrl: string
  buckets: HeatmapBucket[]
  layer: HeatmapLayer
  /** Aspect ratio hint when we don't yet know the image dims. */
  fallbackAspect?: number
}

const LAYER_BLEND: Record<HeatmapLayer, GlobalCompositeOperation> = {
  click: 'source-over',
  move: 'source-over',
  scroll: 'source-over',
  rage: 'source-over',
}

/**
 * Offscreen canvas compositor: lays a gaussian heat gradient over the
 * screenshot. Handles all four layers via the same code path; only the
 * colour ramp differs. `buckets` are 50×50 grid counts.
 */
export default function HeatmapCanvas({ screenshotUrl, buckets, layer, fallbackAspect = 0.5625 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    draw(canvas, buckets, layer)
  }, [buckets, layer])

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(8,10,18,0.6)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {screenshotUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={screenshotUrl}
          alt="Page screenshot"
          className="block w-full h-auto"
          onLoad={(e) => {
            const img = e.currentTarget
            if (!canvasRef.current) return
            // Match the canvas to the rendered image size on this layout.
            canvasRef.current.width = img.naturalWidth
            canvasRef.current.height = img.naturalHeight
            draw(canvasRef.current, buckets, layer)
          }}
        />
      ) : (
        <div
          className="w-full flex items-center justify-center"
          style={{ aspectRatio: String(1 / fallbackAspect), color: 'rgba(255,255,255,0.28)' }}
        >
          No screenshot yet
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ mixBlendMode: 'screen', opacity: 0.72 }}
      />
    </div>
  )
}

// ── Rendering ───────────────────────────────────────────────────────────

function draw(canvas: HTMLCanvasElement, buckets: HeatmapBucket[], layer: HeatmapLayer) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (buckets.length === 0) return

  const w = canvas.width
  const h = canvas.height
  // Peak intensity is used to normalise the colour ramp so sparse pages still
  // show something. Scroll is special — it's 1D so we render it as horizontal
  // bands instead of blobs.
  const peak = buckets.reduce((m, b) => (b.count > m ? b.count : m), 1)
  if (layer === 'scroll') {
    drawScrollBands(ctx, w, h, buckets, peak)
    return
  }

  // Gaussian blob size — roughly one grid cell's worth of radius.
  const cellW = w / HEATMAP_GRID
  const cellH = h / HEATMAP_GRID
  const sigma = Math.max(cellW, cellH) * 1.4

  // Render into an intensity buffer (floats 0..1) first, then colour-map it.
  // We draw radial gradients directly — the browser compositor handles the
  // gaussian falloff via a radial gradient from opaque-white at the centre
  // to transparent-white at r≈3σ. That's close enough to a true gaussian for
  // visual heatmaps without needing pixel-level math.
  ctx.save()
  ctx.globalCompositeOperation = LAYER_BLEND[layer]
  for (const b of buckets) {
    const cx = (b.x + 0.5) * cellW
    const cy = (b.y + 0.5) * cellH
    const intensity = b.count / peak
    if (intensity <= 0) continue
    const r = sigma * 3 * (0.6 + 0.4 * intensity)
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    const color = layerColour(layer, intensity)
    grad.addColorStop(0, color.core)
    grad.addColorStop(0.4, color.mid)
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawScrollBands(ctx: CanvasRenderingContext2D, w: number, h: number, buckets: HeatmapBucket[], peak: number) {
  const rows = new Array<number>(HEATMAP_GRID).fill(0)
  for (const b of buckets) {
    if (b.y >= 0 && b.y < HEATMAP_GRID) rows[b.y] += b.count
  }
  const rowPeak = rows.reduce((m, v) => (v > m ? v : m), peak)
  const rowH = h / HEATMAP_GRID
  ctx.save()
  for (let y = 0; y < HEATMAP_GRID; y++) {
    const intensity = rows[y] / rowPeak
    if (intensity <= 0) continue
    ctx.fillStyle = heatRamp(intensity * 0.8)
    ctx.fillRect(0, y * rowH, w, rowH + 1)
  }
  ctx.restore()
}

function layerColour(layer: HeatmapLayer, intensity: number): { core: string; mid: string } {
  if (layer === 'rage') {
    return {
      core: `rgba(255, 80, 200, ${0.9 * intensity})`,
      mid: `rgba(220, 40, 160, ${0.55 * intensity})`,
    }
  }
  return {
    core: heatRamp(intensity),
    mid: heatRamp(intensity * 0.55),
  }
}

/**
 * Classic heatmap ramp: transparent → blue → cyan → yellow → red.
 * `t` in [0, 1].
 */
function heatRamp(t: number): string {
  const clamped = Math.max(0, Math.min(1, t))
  if (clamped < 0.15) return `rgba(0, 0, 0, 0)`
  if (clamped < 0.4) {
    const k = (clamped - 0.15) / 0.25
    return rgba(30 + k * 0, 60 + k * 180, 220, 0.55 * clamped + 0.1)
  }
  if (clamped < 0.6) {
    const k = (clamped - 0.4) / 0.2
    return rgba(30 + k * 190, 240 - k * 60, 220 - k * 180, 0.75)
  }
  if (clamped < 0.85) {
    const k = (clamped - 0.6) / 0.25
    return rgba(220 + k * 30, 180 - k * 140, 40, 0.85)
  }
  return rgba(250, 40, 40, 0.9)
}

function rgba(r: number, g: number, b: number, a: number): string {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a.toFixed(2)})`
}
