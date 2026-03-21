import '@testing-library/jest-dom'
import { vi } from 'vitest'
import React from 'react'

// Mock Next.js navigation (used by Navbar and other layout components)
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

// Mock next/link — render as a plain anchor for test assertions
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) =>
    React.createElement('a', { href, ...props }, children),
}))

// Mock next/font (used in layout.tsx)
vi.mock('next/font/google', () => ({
  Inter: () => ({ className: 'mock-inter-font', variable: '--font-inter' }),
}))

// Silence act() warnings from animated timers in tests that don't need them
// (Tests that use fake timers handle this explicitly)
const originalError = console.error
beforeEach(() => {
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('act(')) return
    originalError(...args)
  }
})
afterEach(() => {
  console.error = originalError
})
