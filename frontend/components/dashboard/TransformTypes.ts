/** Shared types for the transformation results UI. */

export interface ChangeAnnotation {
  region: string
  change_type: string
  description: string
  ux_impact: string
}

export interface ScoreBreakdown {
  layout_structure: number
  visual_hierarchy: number
  spacing_consistency: number
  cta_clarity: number
  component_quality: number
  information_density: number
}

export interface PageIssue {
  area: string
  severity: 'high' | 'medium' | 'low' | string
  description: string
}

export interface TransformedPageData {
  page_path: string
  page_name: string
  route: string
  status: 'transformed' | 'weak' | 'high_quality' | 'skipped_overflow' | 'error'
  score: number
  breakdown?: ScoreBreakdown | null
  reasoning?: string
  issues?: PageIssue[]
  original_code?: string
  updated_code?: string
  diff_summary?: string
  change_annotations?: ChangeAnnotation[]
  change_summary?: string[]
  // Presigned S3 URL — pipeline uploads screenshots before returning so
  // the response stays small. Older cached state may still contain raw
  // base64; renderers detect by prefix.
  before_screenshot?: string
  after_screenshot?: string
  // S3 object keys for the screenshots above. Forwarded to /projects/save-run
  // so the backend can persist them without re-uploading.
  before_screenshot_key?: string
  after_screenshot_key?: string
  error?: string
  retries_used?: number
}

export interface MultiPageTransformResult {
  repo_name: string
  branch: string
  framework: string
  total_pages_found: number
  total_evaluated: number
  total_transformed: number
  total_skipped: number
  pages: TransformedPageData[]
  global_summary: string[]
  pipeline_errors?: string[]
}


/** Legacy single-file transform result (backward compat) */
export interface LegacyTransformResult {
  transformed_files: { path: string; original_code: string; updated_code: string; diff_summary: string }[]
  change_annotations: ChangeAnnotation[]
  change_summary: string[]
  before_screenshot: string
  after_screenshot: string
  preview_route: string
  preview_error?: string
}

/**
 * Adapt a legacy single-file result into the multi-page shape
 * so the new UI can render both old and new pipeline results.
 */
export function adaptLegacyResult(
  legacy: LegacyTransformResult,
  repoName: string,
  targetFile: string,
): MultiPageTransformResult {
  const tf = legacy.transformed_files[0]
  const pageName = targetFile
    .replace(/^.*\//, '')
    .replace(/\.(tsx|jsx|ts|js)$/, '')
    .replace(/^page$/, targetFile.split('/').slice(-2, -1)[0] || 'Home')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())

  const route = legacy.preview_route || '/'

  return {
    repo_name: repoName,
    branch: 'main',
    framework: 'app_router',
    total_pages_found: 1,
    total_evaluated: 1,
    total_transformed: 1,
    total_skipped: 0,
    pages: [{
      page_path: targetFile,
      page_name: pageName,
      route,
      status: 'transformed',
      score: 0,
      original_code: tf?.original_code || '',
      updated_code: tf?.updated_code || '',
      diff_summary: tf?.diff_summary || '',
      change_annotations: legacy.change_annotations,
      change_summary: legacy.change_summary,
      before_screenshot: legacy.before_screenshot,
      after_screenshot: legacy.after_screenshot,
    }],
    global_summary: legacy.change_summary,
  }
}
