export type StylePreset = 'minimal' | 'github' | 'railway'

export type TransformState = 'empty' | 'uploaded' | 'loading' | 'complete'

export type ImprovementCategory =
  | 'spacing'
  | 'typography'
  | 'color'
  | 'hierarchy'
  | 'consistency'

export interface Improvement {
  id: string
  label: string
  description: string
  category: ImprovementCategory
  severity: 'low' | 'medium' | 'high'
}

export interface StylePresetConfig {
  id: StylePreset
  label: string
  description: string
  badge: string
}

export interface TransformResult {
  improvements: Improvement[]
  issuesDetected: number
  issuesFixed: number
  score: {
    before: number
    after: number
  }
}
