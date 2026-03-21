import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn', () => {
  it('returns a single class name unchanged', () => {
    expect(cn('foo')).toBe('foo')
  })

  it('merges multiple class names', () => {
    expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz')
  })

  it('filters out falsy values', () => {
    expect(cn('foo', false, undefined, null, 'bar')).toBe('foo bar')
  })

  it('handles conditional classes with &&', () => {
    const active = true
    const inactive = false
    expect(cn('base', active && 'active', inactive && 'inactive')).toBe('base active')
  })

  it('resolves tailwind padding conflicts — last one wins', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('resolves tailwind text size conflicts', () => {
    expect(cn('text-sm', 'text-lg')).toBe('text-lg')
  })

  it('does not deduplicate non-conflicting classes', () => {
    const result = cn('flex', 'items-center', 'justify-between')
    expect(result).toBe('flex items-center justify-between')
  })

  it('handles array-style clsx inputs', () => {
    expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz')
  })

  it('handles object-style clsx inputs', () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz')
  })

  it('handles empty call', () => {
    expect(cn()).toBe('')
  })

  it('handles empty string input', () => {
    expect(cn('')).toBe('')
  })

  it('merges arbitrary value classes without conflict', () => {
    const result = cn('bg-[#0d1117]', 'text-[#f0f6fc]')
    expect(result).toContain('bg-[#0d1117]')
    expect(result).toContain('text-[#f0f6fc]')
  })
})
