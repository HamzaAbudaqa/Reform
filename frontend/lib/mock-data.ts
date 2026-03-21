import type { Improvement, StylePresetConfig, TransformResult } from '@/types'

export const STYLE_PRESETS: StylePresetConfig[] = [
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Clean, whitespace-heavy, zero distraction',
    badge: 'Clean',
  },
  {
    id: 'github',
    label: 'GitHub',
    description: 'Developer-focused clarity and structure',
    badge: 'Dev',
  },
  {
    id: 'railway',
    label: 'Railway',
    description: 'Premium dark UI with depth and polish',
    badge: 'Premium',
  },
]

export const MOCK_IMPROVEMENTS: Improvement[] = [
  {
    id: '1',
    label: 'Spacing normalized',
    description: 'Applied 8px grid system across all components',
    category: 'spacing',
    severity: 'high',
  },
  {
    id: '2',
    label: 'Typography hierarchy',
    description: 'Established consistent heading scale h1→h2→body',
    category: 'typography',
    severity: 'high',
  },
  {
    id: '3',
    label: 'Color system unified',
    description: 'Replaced 7 inconsistent grays with a single palette',
    category: 'color',
    severity: 'medium',
  },
  {
    id: '4',
    label: 'Card padding fixed',
    description: 'Standardized card padding to p-4 and p-6 variants only',
    category: 'spacing',
    severity: 'medium',
  },
  {
    id: '5',
    label: 'Visual hierarchy restored',
    description: 'Primary/secondary/tertiary content levels are now distinct',
    category: 'hierarchy',
    severity: 'high',
  },
  {
    id: '6',
    label: 'Border radius unified',
    description: 'Normalized to rounded-xl across all interactive elements',
    category: 'consistency',
    severity: 'low',
  },
  {
    id: '7',
    label: 'Button variants cleaned',
    description: 'Reduced from 5 ad-hoc styles to 3 clear variants',
    category: 'consistency',
    severity: 'medium',
  },
]

export const MOCK_TRANSFORM_RESULT: TransformResult = {
  improvements: MOCK_IMPROVEMENTS,
  issuesDetected: 9,
  issuesFixed: 7,
  score: {
    before: 34,
    after: 91,
  },
}
