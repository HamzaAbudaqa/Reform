import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ControlsPanel from '@/components/demo/ControlsPanel'
import { MOCK_TRANSFORM_RESULT, STYLE_PRESETS } from '@/lib/mock-data'
import type { TransformState, StylePreset } from '@/types'

const defaultProps = {
  state: 'empty' as TransformState,
  preset: 'railway' as StylePreset,
  onPresetChange: vi.fn(),
  onRefine: vi.fn(),
  onReset: vi.fn(),
}

describe('ControlsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── Section header ───────────────────────────────────────────────────────

  it('renders the Controls section label', () => {
    render(<ControlsPanel {...defaultProps} />)
    expect(screen.getByText('Controls')).toBeInTheDocument()
  })

  // ─── Style presets ────────────────────────────────────────────────────────

  describe('style preset buttons', () => {
    it('renders all three presets', () => {
      render(<ControlsPanel {...defaultProps} />)
      for (const preset of STYLE_PRESETS) {
        expect(screen.getByText(preset.label)).toBeInTheDocument()
      }
    })

    it('renders each preset description', () => {
      render(<ControlsPanel {...defaultProps} />)
      for (const preset of STYLE_PRESETS) {
        expect(screen.getByText(preset.description)).toBeInTheDocument()
      }
    })

    it('calls onPresetChange with "minimal" when Minimal clicked', async () => {
      const user = userEvent.setup()
      render(<ControlsPanel {...defaultProps} />)
      await user.click(screen.getByText('Minimal'))
      expect(defaultProps.onPresetChange).toHaveBeenCalledWith('minimal')
    })

    it('calls onPresetChange with "github" when GitHub clicked', async () => {
      const user = userEvent.setup()
      render(<ControlsPanel {...defaultProps} />)
      await user.click(screen.getByText('GitHub'))
      expect(defaultProps.onPresetChange).toHaveBeenCalledWith('github')
    })

    it('calls onPresetChange with "railway" when Railway clicked', async () => {
      const user = userEvent.setup()
      render(<ControlsPanel {...defaultProps} />)
      await user.click(screen.getByText('Railway'))
      expect(defaultProps.onPresetChange).toHaveBeenCalledWith('railway')
    })

    it('active preset has visible indicator dot', () => {
      // The active preset button contains an indicator dot div with bg-indigo-400
      render(<ControlsPanel {...defaultProps} preset="railway" />)
      // Railway button should be the "active" one — its button has the glow dot
      const railwayButton = screen.getByText('Railway').closest('button')
      expect(railwayButton?.innerHTML).toContain('bg-indigo-400')
    })

    it('inactive preset does not have indicator dot', () => {
      render(<ControlsPanel {...defaultProps} preset="railway" />)
      const minimalButton = screen.getByText('Minimal').closest('button')
      expect(minimalButton?.innerHTML).not.toContain('bg-indigo-400')
    })
  })

  // ─── Quality score — gated by complete state ──────────────────────────────

  describe('quality score visibility', () => {
    it('NOT visible in empty state', () => {
      render(<ControlsPanel {...defaultProps} state="empty" />)
      expect(screen.queryByText('Quality score')).not.toBeInTheDocument()
    })

    it('NOT visible in uploaded state', () => {
      render(<ControlsPanel {...defaultProps} state="uploaded" />)
      expect(screen.queryByText('Quality score')).not.toBeInTheDocument()
    })

    it('NOT visible in loading state', () => {
      render(<ControlsPanel {...defaultProps} state="loading" />)
      expect(screen.queryByText('Quality score')).not.toBeInTheDocument()
    })

    it('IS visible in complete state', () => {
      render(<ControlsPanel {...defaultProps} state="complete" />)
      expect(screen.getByText('Quality score')).toBeInTheDocument()
    })

    it('shows before score (34) in complete state', () => {
      render(<ControlsPanel {...defaultProps} state="complete" />)
      expect(screen.getByText(String(MOCK_TRANSFORM_RESULT.score.before))).toBeInTheDocument()
    })

    it('shows after score (91) in complete state', () => {
      render(<ControlsPanel {...defaultProps} state="complete" />)
      expect(screen.getByText(String(MOCK_TRANSFORM_RESULT.score.after))).toBeInTheDocument()
    })

    it('shows Before and After labels in score card', () => {
      render(<ControlsPanel {...defaultProps} state="complete" />)
      expect(screen.getByText('Before')).toBeInTheDocument()
      expect(screen.getByText('After')).toBeInTheDocument()
    })
  })

  // ─── Improvements list — gated by complete state ──────────────────────────

  describe('improvements list visibility', () => {
    it('NOT visible in empty state', () => {
      render(<ControlsPanel {...defaultProps} state="empty" />)
      expect(screen.queryByText(/issues fixed/)).not.toBeInTheDocument()
    })

    it('IS visible in complete state', () => {
      render(<ControlsPanel {...defaultProps} state="complete" />)
      expect(screen.getByText(/issues fixed/)).toBeInTheDocument()
    })

    it('shows correct issues fixed count', () => {
      render(<ControlsPanel {...defaultProps} state="complete" />)
      const { issuesFixed, issuesDetected } = MOCK_TRANSFORM_RESULT
      expect(
        screen.getByText(`${issuesFixed} of ${issuesDetected} issues fixed`)
      ).toBeInTheDocument()
    })

    it('renders first improvement label', () => {
      render(<ControlsPanel {...defaultProps} state="complete" />)
      expect(screen.getByText(MOCK_TRANSFORM_RESULT.improvements[0].label)).toBeInTheDocument()
    })

    it('renders at most 5 improvements (slice(0, 5))', () => {
      render(<ControlsPanel {...defaultProps} state="complete" />)
      // The 6th and 7th improvements should not appear
      const imp6 = MOCK_TRANSFORM_RESULT.improvements[5]
      const imp7 = MOCK_TRANSFORM_RESULT.improvements[6]
      expect(screen.queryByText(imp6.label)).not.toBeInTheDocument()
      expect(screen.queryByText(imp7.label)).not.toBeInTheDocument()
    })

    it('renders improvement category badges', () => {
      render(<ControlsPanel {...defaultProps} state="complete" />)
      // Multiple improvements may have the same category — use getAllByText
      const spacingBadges = screen.getAllByText('spacing')
      expect(spacingBadges.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ─── Refine / Regenerate button ───────────────────────────────────────────

  describe('refine button visibility', () => {
    it('NOT visible in empty state', () => {
      render(<ControlsPanel {...defaultProps} state="empty" />)
      expect(screen.queryByRole('button', { name: /Refine UI/i })).not.toBeInTheDocument()
    })

    it('NOT visible in loading state', () => {
      render(<ControlsPanel {...defaultProps} state="loading" />)
      expect(screen.queryByRole('button', { name: /Refine UI/i })).not.toBeInTheDocument()
    })

    it('IS visible in uploaded state with "Refine UI" label', () => {
      render(<ControlsPanel {...defaultProps} state="uploaded" />)
      expect(screen.getByRole('button', { name: /Refine UI/i })).toBeInTheDocument()
    })

    it('IS visible in complete state with "Regenerate" label', () => {
      render(<ControlsPanel {...defaultProps} state="complete" />)
      expect(screen.getByRole('button', { name: /Regenerate/i })).toBeInTheDocument()
    })

    it('clicking refine in uploaded state calls onRefine', async () => {
      const user = userEvent.setup()
      render(<ControlsPanel {...defaultProps} state="uploaded" />)
      await user.click(screen.getByRole('button', { name: /Refine UI/i }))
      expect(defaultProps.onRefine).toHaveBeenCalledTimes(1)
    })

    it('clicking Regenerate in complete state calls onRefine', async () => {
      const user = userEvent.setup()
      render(<ControlsPanel {...defaultProps} state="complete" />)
      await user.click(screen.getByRole('button', { name: /Regenerate/i }))
      expect(defaultProps.onRefine).toHaveBeenCalledTimes(1)
    })
  })

  // ─── Export / Download buttons — gated by complete ───────────────────────

  describe('export and download buttons', () => {
    it('NOT visible in empty state', () => {
      render(<ControlsPanel {...defaultProps} state="empty" />)
      expect(screen.queryByText('Export code')).not.toBeInTheDocument()
      expect(screen.queryByText('Save image')).not.toBeInTheDocument()
    })

    it('IS visible in complete state', () => {
      render(<ControlsPanel {...defaultProps} state="complete" />)
      expect(screen.getByText('Export code')).toBeInTheDocument()
      expect(screen.getByText('Save image')).toBeInTheDocument()
    })
  })

  // ─── Reset button ─────────────────────────────────────────────────────────

  describe('reset button', () => {
    it('NOT visible in empty state', () => {
      render(<ControlsPanel {...defaultProps} state="empty" />)
      expect(screen.queryByText('Start over')).not.toBeInTheDocument()
    })

    it('IS visible in uploaded state', () => {
      render(<ControlsPanel {...defaultProps} state="uploaded" />)
      expect(screen.getByText('Start over')).toBeInTheDocument()
    })

    it('IS visible in loading state', () => {
      render(<ControlsPanel {...defaultProps} state="loading" />)
      expect(screen.getByText('Start over')).toBeInTheDocument()
    })

    it('IS visible in complete state', () => {
      render(<ControlsPanel {...defaultProps} state="complete" />)
      expect(screen.getByText('Start over')).toBeInTheDocument()
    })

    it('clicking Start over calls onReset', async () => {
      const user = userEvent.setup()
      render(<ControlsPanel {...defaultProps} state="uploaded" />)
      await user.click(screen.getByText('Start over'))
      expect(defaultProps.onReset).toHaveBeenCalledTimes(1)
    })
  })
})
