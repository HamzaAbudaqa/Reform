'use client'

import { useState } from 'react'
import { Github, Sparkles, X, GitBranch } from 'lucide-react'
import type { TransformState } from '@/types'

interface Props {
  state: TransformState
  repoUrl: string
  onRepoUrl: (url: string) => void
  onSubmit: () => void
  onRemove: () => void
}

const EXAMPLE_REPO = 'https://github.com/vercel/next.js'

function hasInput(url: string) {
  return url.replace('https://github.com/', '').trim().length > 0
}

export default function RepoInputPanel({ state, repoUrl, onRepoUrl, onSubmit, onRemove }: Props) {
  const [focused, setFocused] = useState(false)

  const repoName = repoUrl.replace('https://github.com/', '')

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && hasInput(repoUrl)) onSubmit()
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div
        className="text-[11px] font-medium uppercase tracking-wider"
        style={{ color: 'rgba(255,255,255,0.25)' }}
      >
        Input
      </div>

      {state === 'empty' ? (
        <>
          {/* URL input */}
          <div
            className="rounded-xl transition-all duration-200"
            style={{
              border: focused
                ? '1px solid rgba(168,85,247,0.5)'
                : '1px solid rgba(255,255,255,0.08)',
              background: focused ? 'rgba(124,58,237,0.05)' : 'rgba(255,255,255,0.02)',
            }}
          >
            <div className="flex items-center gap-2 px-3 pt-3 pb-1">
              <Github size={13} style={{ color: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>github.com/</span>
            </div>
            <input
              type="text"
              placeholder="owner/repository"
              value={repoUrl.replace('https://github.com/', '')}
              onChange={(e) => onRepoUrl('https://github.com/' + e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent text-xs px-3 pb-3 outline-none"
              style={{ color: 'rgba(255,255,255,0.8)', caretColor: '#a855f7' }}
            />
          </div>

          {/* Analyze button */}
          <button
            onClick={onSubmit}
            disabled={!hasInput(repoUrl)}
            className="w-full py-2 rounded-xl text-xs font-semibold transition-all text-white"
            style={
              hasInput(repoUrl)
                ? { background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 0 16px rgba(124,58,237,0.3)', cursor: 'pointer' }
                : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.2)', cursor: 'not-allowed' }
            }
          >
            Analyze repo
          </button>

          {/* Try example */}
          <button
            onClick={() => { onRepoUrl(EXAMPLE_REPO) }}
            className="flex items-center justify-center gap-1.5 text-[11px] py-1.5 rounded-lg transition-all"
            style={{ color: 'rgba(255,255,255,0.25)', border: '1px solid transparent' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#a855f7'
              e.currentTarget.style.background = 'rgba(124,58,237,0.05)'
              e.currentTarget.style.borderColor = 'rgba(124,58,237,0.2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.25)'
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'transparent'
            }}
          >
            <Sparkles size={11} />
            Try example
          </button>

          <div className="text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.18)' }}>
            Paste a public GitHub repo URL. RefineUI will scan the frontend and suggest a redesign.
          </div>
        </>
      ) : (
        /* Submitted state */
        <div
          className="flex-1 rounded-xl p-4 flex flex-col gap-3 relative"
          style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}
        >
          <button
            onClick={onRemove}
            className="absolute top-2 right-2 w-5 h-5 rounded-md flex items-center justify-center transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
            title="Remove repo"
          >
            <X size={11} />
          </button>

          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.25)' }}
            >
              <Github size={13} style={{ color: '#a855f7' }} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>{repoName}</p>
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>GitHub repository</p>
            </div>
          </div>

          <div
            className="flex items-center gap-1.5 text-[10px] rounded-md px-2 py-1.5"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.3)' }}
          >
            <GitBranch size={10} style={{ color: 'rgba(255,255,255,0.2)' }} />
            main branch
          </div>

          <div className="text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Ready to refine. Choose a style preset and click Refine UI.
          </div>
        </div>
      )}
    </div>
  )
}
