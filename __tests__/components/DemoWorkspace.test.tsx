import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DemoWorkspace from '@/components/demo/DemoWorkspace'

describe('DemoWorkspace', () => {
  // ─── Initial render ───────────────────────────────────────────────────────

  it('renders the section header', () => {
    render(<DemoWorkspace />)
    expect(screen.getByText('See it in action')).toBeInTheDocument()
  })

  it('renders the Live demo badge', () => {
    render(<DemoWorkspace />)
    expect(screen.getByText('Live demo')).toBeInTheDocument()
  })

  it('renders the workspace title bar', () => {
    render(<DemoWorkspace />)
    expect(screen.getByText('refineui — workspace')).toBeInTheDocument()
  })

  it('starts in empty state — shows "Waiting for input" status', () => {
    render(<DemoWorkspace />)
    expect(screen.getByText('Waiting for input')).toBeInTheDocument()
  })

  it('starts with railway preset (no custom badge visible yet)', () => {
    render(<DemoWorkspace />)
    // railway preset is the initial active preset in ControlsPanel
    const railwayButton = screen.getByText('Railway').closest('button')
    expect(railwayButton?.innerHTML).toContain('bg-indigo-400')
  })

  it('renders UploadPanel with empty state', () => {
    render(<DemoWorkspace />)
    expect(screen.getByText('Drop screenshot')).toBeInTheDocument()
  })

  it('renders ControlsPanel with preset buttons', () => {
    render(<DemoWorkspace />)
    expect(screen.getByText('Minimal')).toBeInTheDocument()
    expect(screen.getByText('GitHub')).toBeInTheDocument()
    expect(screen.getByText('Railway')).toBeInTheDocument()
  })

  it('renders demo footnote', () => {
    render(<DemoWorkspace />)
    expect(screen.getByText(/Demo uses a sample dashboard/)).toBeInTheDocument()
  })

  // ─── State machine: empty → uploaded ─────────────────────────────────────

  describe('transition: empty → uploaded', () => {
    it('clicking "Try example" transitions to uploaded state', async () => {
      const user = userEvent.setup()
      render(<DemoWorkspace />)
      await user.click(screen.getByText('Try example'))
      // "Ready to refine" appears in both the status bar and BeforeAfterCanvas
      const readyTexts = screen.getAllByText('Ready to refine')
      expect(readyTexts.length).toBeGreaterThanOrEqual(1)
    })

    it('after upload, status dot changes to "Ready to refine"', async () => {
      const user = userEvent.setup()
      render(<DemoWorkspace />)
      await user.click(screen.getByText('Try example'))
      expect(screen.queryByText('Waiting for input')).not.toBeInTheDocument()
      const readyTexts = screen.getAllByText('Ready to refine')
      expect(readyTexts.length).toBeGreaterThanOrEqual(1)
    })

    it('after upload, "Refine UI" button appears in the center canvas', async () => {
      const user = userEvent.setup()
      render(<DemoWorkspace />)
      await user.click(screen.getByText('Try example'))
      // Two "Refine UI" texts: one in canvas, one in ControlsPanel
      const buttons = screen.getAllByText('Refine UI')
      expect(buttons.length).toBeGreaterThanOrEqual(1)
    })

    it('after upload, "Try example" disappears', async () => {
      const user = userEvent.setup()
      render(<DemoWorkspace />)
      await user.click(screen.getByText('Try example'))
      expect(screen.queryByText('Try example')).not.toBeInTheDocument()
    })

    it('"Start over" appears after upload', async () => {
      const user = userEvent.setup()
      render(<DemoWorkspace />)
      await user.click(screen.getByText('Try example'))
      expect(screen.getByText('Start over')).toBeInTheDocument()
    })
  })

  // ─── State machine: uploaded → loading ───────────────────────────────────

  describe('transition: uploaded → loading', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('clicking "Refine UI" button in canvas transitions to loading', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<DemoWorkspace />)
      // Get to uploaded state
      fireEvent.click(screen.getByText('Try example'))
      // Click the canvas Refine UI button (first one)
      const refineButtons = screen.getAllByText('Refine UI')
      fireEvent.click(refineButtons[0])
      expect(screen.getByText('Processing...')).toBeInTheDocument()
    })

    it('shows "Analyzing..." in the canvas during loading', () => {
      render(<DemoWorkspace />)
      fireEvent.click(screen.getByText('Try example'))
      const refineButtons = screen.getAllByText('Refine UI')
      fireEvent.click(refineButtons[0])
      expect(screen.getByText('Analyzing...')).toBeInTheDocument()
    })
  })

  // ─── State machine: loading → complete (after 2800ms) ────────────────────

  describe('transition: loading → complete (timer)', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('after 2800ms transitions to complete state', () => {
      render(<DemoWorkspace />)
      fireEvent.click(screen.getByText('Try example'))
      const refineButtons = screen.getAllByText('Refine UI')
      fireEvent.click(refineButtons[0])

      // Advance past the 2800ms timeout
      act(() => {
        vi.advanceTimersByTime(2800)
      })

      expect(screen.getByText('Transformation complete')).toBeInTheDocument()
    })

    it('before 2800ms does NOT show complete state', () => {
      render(<DemoWorkspace />)
      fireEvent.click(screen.getByText('Try example'))
      const refineButtons = screen.getAllByText('Refine UI')
      fireEvent.click(refineButtons[0])

      act(() => {
        vi.advanceTimersByTime(1000) // only 1 second
      })

      expect(screen.queryByText('Transformation complete')).not.toBeInTheDocument()
      expect(screen.getByText('Processing...')).toBeInTheDocument()
    })

    it('in complete state, quality score is visible', () => {
      render(<DemoWorkspace />)
      fireEvent.click(screen.getByText('Try example'))
      const refineButtons = screen.getAllByText('Refine UI')
      fireEvent.click(refineButtons[0])

      act(() => {
        vi.advanceTimersByTime(2800)
      })

      expect(screen.getByText('Quality score')).toBeInTheDocument()
    })

    it('in complete state, Regenerate button is visible', () => {
      render(<DemoWorkspace />)
      fireEvent.click(screen.getByText('Try example'))
      const refineButtons = screen.getAllByText('Refine UI')
      fireEvent.click(refineButtons[0])

      act(() => {
        vi.advanceTimersByTime(2800)
      })

      expect(screen.getByText('Regenerate')).toBeInTheDocument()
    })
  })

  // ─── Reset behavior ───────────────────────────────────────────────────────

  describe('reset', () => {
    it('clicking Start over resets to empty state', async () => {
      const user = userEvent.setup()
      render(<DemoWorkspace />)
      await user.click(screen.getByText('Try example'))
      // Now in uploaded state, Start over visible
      await user.click(screen.getByText('Start over'))
      expect(screen.getByText('Waiting for input')).toBeInTheDocument()
    })

    it('after reset, "Try example" reappears', async () => {
      const user = userEvent.setup()
      render(<DemoWorkspace />)
      await user.click(screen.getByText('Try example'))
      await user.click(screen.getByText('Start over'))
      expect(screen.getByText('Try example')).toBeInTheDocument()
    })

    it('after reset, Start over disappears', async () => {
      const user = userEvent.setup()
      render(<DemoWorkspace />)
      await user.click(screen.getByText('Try example'))
      await user.click(screen.getByText('Start over'))
      expect(screen.queryByText('Start over')).not.toBeInTheDocument()
    })
  })

  // ─── Preset synchronization ───────────────────────────────────────────────

  describe('preset state sync', () => {
    it('changing preset in ControlsPanel updates active indicator', async () => {
      const user = userEvent.setup()
      render(<DemoWorkspace />)
      // Switch to Minimal
      await user.click(screen.getByText('Minimal'))
      const minimalButton = screen.getByText('Minimal').closest('button')
      expect(minimalButton?.innerHTML).toContain('bg-indigo-400')
    })

    it('previously active preset loses its indicator after change', async () => {
      const user = userEvent.setup()
      render(<DemoWorkspace />)
      // Railway is active by default; switch to Minimal
      await user.click(screen.getByText('Minimal'))
      const railwayButton = screen.getByText('Railway').closest('button')
      expect(railwayButton?.innerHTML).not.toContain('bg-indigo-400')
    })
  })
})
