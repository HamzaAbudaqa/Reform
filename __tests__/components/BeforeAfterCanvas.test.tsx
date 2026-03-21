import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import BeforeAfterCanvas from '@/components/demo/BeforeAfterCanvas'

describe('BeforeAfterCanvas', () => {
  // ─── Empty state ─────────────────────────────────────────────────────────

  describe('state: empty', () => {
    it('renders the empty state message', () => {
      render(<BeforeAfterCanvas state="empty" preset="railway" />)
      expect(screen.getByText('No screenshot uploaded')).toBeInTheDocument()
    })

    it('renders the upload instruction text', () => {
      render(<BeforeAfterCanvas state="empty" preset="railway" />)
      expect(screen.getByText(/Upload a UI screenshot/i)).toBeInTheDocument()
    })

    it('does NOT render "Before" label', () => {
      render(<BeforeAfterCanvas state="empty" preset="railway" />)
      expect(screen.queryByText('Before')).not.toBeInTheDocument()
    })

    it('does NOT render "After" label', () => {
      render(<BeforeAfterCanvas state="empty" preset="railway" />)
      expect(screen.queryByText('After')).not.toBeInTheDocument()
    })
  })

  // ─── Uploaded state ───────────────────────────────────────────────────────

  describe('state: uploaded', () => {
    it('renders the "Before" label', () => {
      render(<BeforeAfterCanvas state="uploaded" preset="railway" />)
      expect(screen.getByText('Before')).toBeInTheDocument()
    })

    it('renders "Ready to refine" status', () => {
      render(<BeforeAfterCanvas state="uploaded" preset="railway" />)
      expect(screen.getByText('Ready to refine')).toBeInTheDocument()
    })

    it('does NOT render "After" label', () => {
      render(<BeforeAfterCanvas state="uploaded" preset="railway" />)
      expect(screen.queryByText('After')).not.toBeInTheDocument()
    })

    it('renders the mock dashboard URL bar', () => {
      render(<BeforeAfterCanvas state="uploaded" preset="railway" />)
      expect(screen.getByText('acme-admin.vercel.app')).toBeInTheDocument()
    })
  })

  // ─── Loading state ────────────────────────────────────────────────────────

  describe('state: loading', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('renders the "Before" label', () => {
      render(<BeforeAfterCanvas state="loading" preset="railway" />)
      expect(screen.getByText('Before')).toBeInTheDocument()
    })

    it('renders the "Analyzing..." indicator', () => {
      render(<BeforeAfterCanvas state="loading" preset="railway" />)
      expect(screen.getByText('Analyzing...')).toBeInTheDocument()
    })

    it('renders the first loading step text initially', () => {
      render(<BeforeAfterCanvas state="loading" preset="railway" />)
      expect(screen.getByText('Analyzing layout structure...')).toBeInTheDocument()
    })

    it('renders the progress percentage', () => {
      render(<BeforeAfterCanvas state="loading" preset="railway" />)
      expect(screen.getByText('0%')).toBeInTheDocument()
    })

    it('does NOT render "No screenshot uploaded"', () => {
      render(<BeforeAfterCanvas state="loading" preset="railway" />)
      expect(screen.queryByText('No screenshot uploaded')).not.toBeInTheDocument()
    })

    it('does NOT render "After" panel', () => {
      render(<BeforeAfterCanvas state="loading" preset="railway" />)
      expect(screen.queryByText('After')).not.toBeInTheDocument()
    })
  })

  // ─── Complete state ───────────────────────────────────────────────────────

  describe('state: complete', () => {
    it('renders the "Before" label', () => {
      render(<BeforeAfterCanvas state="complete" preset="railway" />)
      // may appear multiple times (Before + After headers)
      const labels = screen.getAllByText('Before')
      expect(labels.length).toBeGreaterThanOrEqual(1)
    })

    it('renders the "After" label', () => {
      render(<BeforeAfterCanvas state="complete" preset="railway" />)
      const labels = screen.getAllByText('After')
      expect(labels.length).toBeGreaterThanOrEqual(1)
    })

    it('renders "Original" badge on Before panel', () => {
      render(<BeforeAfterCanvas state="complete" preset="railway" />)
      expect(screen.getByText('Original')).toBeInTheDocument()
    })

    it('renders preset name in After panel badge for railway', () => {
      render(<BeforeAfterCanvas state="complete" preset="railway" />)
      expect(screen.getByText('Railway preset')).toBeInTheDocument()
    })

    it('renders preset name in After panel badge for minimal', () => {
      render(<BeforeAfterCanvas state="complete" preset="minimal" />)
      expect(screen.getByText('Minimal preset')).toBeInTheDocument()
    })

    it('renders preset name in After panel badge for github', () => {
      render(<BeforeAfterCanvas state="complete" preset="github" />)
      expect(screen.getByText('Github preset')).toBeInTheDocument()
    })

    it('renders the divider arrow between panels', () => {
      render(<BeforeAfterCanvas state="complete" preset="railway" />)
      expect(screen.getByText('→')).toBeInTheDocument()
    })

    it('does NOT render "No screenshot uploaded"', () => {
      render(<BeforeAfterCanvas state="complete" preset="railway" />)
      expect(screen.queryByText('No screenshot uploaded')).not.toBeInTheDocument()
    })
  })

  // ─── Preset badge capitalization ──────────────────────────────────────────

  it('capitalizes preset label correctly in badge', () => {
    const { rerender } = render(<BeforeAfterCanvas state="complete" preset="minimal" />)
    expect(screen.getByText('Minimal preset')).toBeInTheDocument()

    rerender(<BeforeAfterCanvas state="complete" preset="github" />)
    expect(screen.getByText('Github preset')).toBeInTheDocument()

    rerender(<BeforeAfterCanvas state="complete" preset="railway" />)
    expect(screen.getByText('Railway preset')).toBeInTheDocument()
  })
})
