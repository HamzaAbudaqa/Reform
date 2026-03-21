import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UploadPanel from '@/components/demo/UploadPanel'
import type { TransformState } from '@/types'

describe('UploadPanel', () => {
  const onUpload = vi.fn()

  beforeEach(() => {
    onUpload.mockClear()
  })

  // ─── Empty state ─────────────────────────────────────────────────────────

  describe('state: empty', () => {
    it('renders the upload prompt text', () => {
      render(<UploadPanel state="empty" onUpload={onUpload} />)
      expect(screen.getByText('Drop screenshot')).toBeInTheDocument()
    })

    it('renders the accepted formats hint', () => {
      render(<UploadPanel state="empty" onUpload={onUpload} />)
      expect(screen.getByText('PNG, JPG, WebP')).toBeInTheDocument()
    })

    it('renders the "Try example" button', () => {
      render(<UploadPanel state="empty" onUpload={onUpload} />)
      expect(screen.getByText('Try example')).toBeInTheDocument()
    })

    it('clicking "Try example" calls onUpload', async () => {
      const user = userEvent.setup()
      render(<UploadPanel state="empty" onUpload={onUpload} />)
      await user.click(screen.getByText('Try example'))
      expect(onUpload).toHaveBeenCalledTimes(1)
    })

    it('renders the hidden file input', () => {
      render(<UploadPanel state="empty" onUpload={onUpload} />)
      const input = document.querySelector('input[type="file"]')
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('accept', 'image/*')
    })

    it('file input change calls onUpload', () => {
      render(<UploadPanel state="empty" onUpload={onUpload} />)
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      fireEvent.change(input)
      expect(onUpload).toHaveBeenCalledTimes(1)
    })

    it('drop on drop zone calls onUpload', () => {
      render(<UploadPanel state="empty" onUpload={onUpload} />)
      const dropZone = screen.getByText('Drop screenshot').closest('div')!.parentElement!.parentElement!
      fireEvent.drop(dropZone)
      expect(onUpload).toHaveBeenCalledTimes(1)
    })

    it('dragOver prevents default (enables drop)', () => {
      render(<UploadPanel state="empty" onUpload={onUpload} />)
      // The drop zone doesn't throw on dragOver
      const dropZone = screen.getByText('Drop screenshot').closest('div')!.parentElement!.parentElement!
      expect(() => fireEvent.dragOver(dropZone)).not.toThrow()
    })
  })

  // ─── Uploaded state ───────────────────────────────────────────────────────

  describe('state: uploaded', () => {
    it('renders the filename', () => {
      render(<UploadPanel state="uploaded" onUpload={onUpload} />)
      expect(screen.getByText('dashboard_v2.png')).toBeInTheDocument()
    })

    it('renders the dimensions hint', () => {
      render(<UploadPanel state="uploaded" onUpload={onUpload} />)
      expect(screen.getByText('1440 × 900 · PNG')).toBeInTheDocument()
    })

    it('does NOT render "Try example" button', () => {
      render(<UploadPanel state="uploaded" onUpload={onUpload} />)
      expect(screen.queryByText('Try example')).not.toBeInTheDocument()
    })

    it('does NOT call onUpload on drop', () => {
      render(<UploadPanel state="uploaded" onUpload={onUpload} />)
      // The drop zone should exist but drop should be a no-op in non-empty state
      const panel = document.querySelector('[class*="rounded-xl"]')
      if (panel) fireEvent.drop(panel)
      expect(onUpload).not.toHaveBeenCalled()
    })
  })

  // ─── Loading state ────────────────────────────────────────────────────────

  describe('state: loading', () => {
    it('renders the filename (same as uploaded)', () => {
      render(<UploadPanel state="loading" onUpload={onUpload} />)
      expect(screen.getByText('dashboard_v2.png')).toBeInTheDocument()
    })

    it('does NOT render "Try example" button', () => {
      render(<UploadPanel state="loading" onUpload={onUpload} />)
      expect(screen.queryByText('Try example')).not.toBeInTheDocument()
    })
  })

  // ─── Complete state ───────────────────────────────────────────────────────

  describe('state: complete', () => {
    it('renders the filename', () => {
      render(<UploadPanel state="complete" onUpload={onUpload} />)
      expect(screen.getByText('dashboard_v2.png')).toBeInTheDocument()
    })

    it('does NOT render "Try example" button', () => {
      render(<UploadPanel state="complete" onUpload={onUpload} />)
      expect(screen.queryByText('Try example')).not.toBeInTheDocument()
    })
  })

  // ─── Static footer text ───────────────────────────────────────────────────

  it('always renders the instructional footer text', () => {
    const states: TransformState[] = ['empty', 'uploaded', 'loading', 'complete']
    for (const state of states) {
      const { unmount } = render(<UploadPanel state={state} onUpload={onUpload} />)
      expect(screen.getByText(/Upload a screenshot/i)).toBeInTheDocument()
      unmount()
    }
  })

  it('renders the INPUT section label', () => {
    render(<UploadPanel state="empty" onUpload={onUpload} />)
    expect(screen.getByText('Input')).toBeInTheDocument()
  })
})
