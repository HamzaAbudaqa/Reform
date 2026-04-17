'use client'

import type { HeatmapDevice, HeatmapLayer } from '@/types/heatmap'

interface Props {
  layer: HeatmapLayer
  device: HeatmapDevice
  days: number
  onLayerChange: (l: HeatmapLayer) => void
  onDeviceChange: (d: HeatmapDevice) => void
  onDaysChange: (d: number) => void
}

const LAYERS: { id: HeatmapLayer; label: string; swatch: string }[] = [
  { id: 'click', label: 'Click', swatch: 'linear-gradient(90deg,#3b82f6,#f59e0b,#ef4444)' },
  { id: 'move', label: 'Move', swatch: 'linear-gradient(90deg,#6366f1,#22d3ee,#f59e0b)' },
  { id: 'scroll', label: 'Scroll', swatch: 'linear-gradient(180deg,#4c4c9c,#1a1a2e)' },
  { id: 'rage', label: 'Rage', swatch: 'linear-gradient(90deg,#db2777,#f472b6)' },
]

const DEVICES: { id: HeatmapDevice; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'desktop', label: 'Desktop' },
  { id: 'tablet', label: 'Tablet' },
  { id: 'mobile', label: 'Mobile' },
]

const DAY_RANGES: { days: number; label: string }[] = [
  { days: 1, label: '24h' },
  { days: 7, label: '7d' },
  { days: 30, label: '30d' },
  { days: 90, label: '90d' },
]

export default function HeatmapControls({ layer, device, days, onLayerChange, onDeviceChange, onDaysChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px]">
      <Group label="Layer">
        {LAYERS.map(l => (
          <button
            key={l.id}
            onClick={() => onLayerChange(l.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors"
            style={{
              background: layer === l.id ? 'rgba(124,140,255,0.18)' : 'rgba(255,255,255,0.03)',
              border: '1px solid ' + (layer === l.id ? 'rgba(124,140,255,0.45)' : 'rgba(255,255,255,0.06)'),
              color: layer === l.id ? '#ffffff' : 'rgba(255,255,255,0.6)',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 18,
                height: 8,
                borderRadius: 4,
                background: l.swatch,
                opacity: layer === l.id ? 1 : 0.6,
              }}
            />
            {l.label}
          </button>
        ))}
      </Group>
      <Divider />
      <Group label="Device">
        {DEVICES.map(d => (
          <Chip key={d.id} active={device === d.id} onClick={() => onDeviceChange(d.id)}>
            {d.label}
          </Chip>
        ))}
      </Group>
      <Divider />
      <Group label="Range">
        {DAY_RANGES.map(d => (
          <Chip key={d.days} active={days === d.days} onClick={() => onDaysChange(d.days)}>
            {d.label}
          </Chip>
        ))}
      </Group>
    </div>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  )
}

function Chip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 rounded-lg transition-colors"
      style={{
        background: active ? 'rgba(124,140,255,0.18)' : 'rgba(255,255,255,0.03)',
        border: '1px solid ' + (active ? 'rgba(124,140,255,0.45)' : 'rgba(255,255,255,0.06)'),
        color: active ? '#ffffff' : 'rgba(255,255,255,0.6)',
      }}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)' }} />
}
