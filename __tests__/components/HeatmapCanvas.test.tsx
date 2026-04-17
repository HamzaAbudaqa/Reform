import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import HeatmapCanvas from '@/components/heatmap/HeatmapCanvas'
import type { HeatmapBucket } from '@/types/heatmap'

describe('HeatmapCanvas', () => {
  const sampleBuckets: HeatmapBucket[] = [
    { x: 10, y: 10, count: 5 },
    { x: 25, y: 25, count: 12 },
    { x: 40, y: 30, count: 3 },
  ]

  it('renders a canvas element for compositing', () => {
    const { container } = render(
      <HeatmapCanvas screenshotUrl="" buckets={sampleBuckets} layer="click" />,
    )
    const canvas = container.querySelector('canvas')
    expect(canvas).not.toBeNull()
  })

  it('renders an img when a screenshot URL is provided', () => {
    const { container } = render(
      <HeatmapCanvas screenshotUrl="https://example.com/shot.png" buckets={sampleBuckets} layer="click" />,
    )
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img?.getAttribute('src')).toBe('https://example.com/shot.png')
  })

  it('shows the empty-state copy when no screenshot is provided', () => {
    const { getByText } = render(
      <HeatmapCanvas screenshotUrl="" buckets={[]} layer="click" />,
    )
    expect(getByText(/No screenshot yet/i)).toBeInTheDocument()
  })

  it('accepts all four layers without error', () => {
    for (const layer of ['click', 'move', 'scroll', 'rage'] as const) {
      const { container, unmount } = render(
        <HeatmapCanvas screenshotUrl="" buckets={sampleBuckets} layer={layer} />,
      )
      expect(container.querySelector('canvas')).not.toBeNull()
      unmount()
    }
  })

  it('renders with zero buckets (renders but draws nothing)', () => {
    const { container } = render(
      <HeatmapCanvas screenshotUrl="" buckets={[]} layer="click" />,
    )
    const canvas = container.querySelector('canvas')
    expect(canvas).not.toBeNull()
  })
})
