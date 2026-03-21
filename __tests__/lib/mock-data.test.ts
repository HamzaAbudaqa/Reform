import { describe, it, expect } from 'vitest'
import { STYLE_PRESETS, MOCK_IMPROVEMENTS, MOCK_TRANSFORM_RESULT } from '@/lib/mock-data'
import type { StylePreset, ImprovementCategory } from '@/types'

describe('STYLE_PRESETS', () => {
  it('contains exactly three presets', () => {
    expect(STYLE_PRESETS).toHaveLength(3)
  })

  it('has minimal preset', () => {
    const minimal = STYLE_PRESETS.find((p) => p.id === 'minimal')
    expect(minimal).toBeDefined()
    expect(minimal?.label).toBe('Minimal')
    expect(minimal?.badge).toBe('Clean')
  })

  it('has github preset', () => {
    const github = STYLE_PRESETS.find((p) => p.id === 'github')
    expect(github).toBeDefined()
    expect(github?.label).toBe('GitHub')
    expect(github?.badge).toBe('Dev')
  })

  it('has railway preset', () => {
    const railway = STYLE_PRESETS.find((p) => p.id === 'railway')
    expect(railway).toBeDefined()
    expect(railway?.label).toBe('Railway')
    expect(railway?.badge).toBe('Premium')
  })

  it('all preset ids are valid StylePreset literals', () => {
    const validIds: StylePreset[] = ['minimal', 'github', 'railway']
    for (const preset of STYLE_PRESETS) {
      expect(validIds).toContain(preset.id)
    }
  })

  it('all presets have non-empty description', () => {
    for (const preset of STYLE_PRESETS) {
      expect(preset.description.length).toBeGreaterThan(0)
    }
  })
})

describe('MOCK_IMPROVEMENTS', () => {
  it('contains exactly seven improvements', () => {
    expect(MOCK_IMPROVEMENTS).toHaveLength(7)
  })

  it('all improvements have required fields', () => {
    for (const imp of MOCK_IMPROVEMENTS) {
      expect(imp.id).toBeTruthy()
      expect(imp.label).toBeTruthy()
      expect(imp.description).toBeTruthy()
      expect(imp.category).toBeTruthy()
      expect(imp.severity).toBeTruthy()
    }
  })

  it('all improvement ids are unique', () => {
    const ids = MOCK_IMPROVEMENTS.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all improvement categories are valid', () => {
    const validCategories: ImprovementCategory[] = [
      'spacing', 'typography', 'color', 'hierarchy', 'consistency',
    ]
    for (const imp of MOCK_IMPROVEMENTS) {
      expect(validCategories).toContain(imp.category)
    }
  })

  it('all improvement severities are valid', () => {
    for (const imp of MOCK_IMPROVEMENTS) {
      expect(['low', 'medium', 'high']).toContain(imp.severity)
    }
  })

  it('contains improvements from multiple categories', () => {
    const categories = new Set(MOCK_IMPROVEMENTS.map((i) => i.category))
    expect(categories.size).toBeGreaterThan(2)
  })
})

describe('MOCK_TRANSFORM_RESULT', () => {
  it('has issues detected count', () => {
    expect(MOCK_TRANSFORM_RESULT.issuesDetected).toBeGreaterThan(0)
  })

  it('has issues fixed count', () => {
    expect(MOCK_TRANSFORM_RESULT.issuesFixed).toBeGreaterThan(0)
  })

  it('issues fixed is less than or equal to issues detected', () => {
    expect(MOCK_TRANSFORM_RESULT.issuesFixed).toBeLessThanOrEqual(
      MOCK_TRANSFORM_RESULT.issuesDetected
    )
  })

  it('score.before is a positive number', () => {
    expect(MOCK_TRANSFORM_RESULT.score.before).toBeGreaterThan(0)
  })

  it('score.after is a positive number', () => {
    expect(MOCK_TRANSFORM_RESULT.score.after).toBeGreaterThan(0)
  })

  it('score.after is greater than score.before', () => {
    expect(MOCK_TRANSFORM_RESULT.score.after).toBeGreaterThan(
      MOCK_TRANSFORM_RESULT.score.before
    )
  })

  it('improvements list matches MOCK_IMPROVEMENTS', () => {
    expect(MOCK_TRANSFORM_RESULT.improvements).toBe(MOCK_IMPROVEMENTS)
  })

  it('score.before is 34', () => {
    expect(MOCK_TRANSFORM_RESULT.score.before).toBe(34)
  })

  it('score.after is 91', () => {
    expect(MOCK_TRANSFORM_RESULT.score.after).toBe(91)
  })
})
