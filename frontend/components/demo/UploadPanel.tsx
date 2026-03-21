'use client'

import { useRef } from 'react'
import { Upload, ImageIcon, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TransformState } from '@/types'

interface Props {
  state: TransformState
  onUpload: (file?: File) => void
  onRemove: () => void
  fileName?: string
}

const EXAMPLE_LABEL = 'dashboard_v2.png'

export default function UploadPanel({ state, onUpload, onRemove, fileName }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (state === 'empty' && e.dataTransfer.files[0]) {
      onUpload(e.dataTransfer.files[0])
    }
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="text-zinc-400 text-[11px] font-medium uppercase tracking-wider">Input</div>

      {/* Drop zone */}
      <div
        className={cn(
          'flex-1 rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer min-h-[120px]',
          state === 'empty'
            ? 'border-zinc-700 hover:border-indigo-500/60 hover:bg-indigo-500/5 bg-zinc-900/40'
            : 'border-zinc-800 bg-zinc-900/40'
        )}
        onClick={() => state === 'empty' && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => onUpload(e.target.files?.[0])}
        />

        {state === 'empty' ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 p-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
              <Upload size={18} className="text-zinc-400" />
            </div>
            <div>
              <p className="text-zinc-300 text-xs font-medium">Drop screenshot</p>
              <p className="text-zinc-600 text-[10px] mt-1">PNG, JPG, WebP, PDF</p>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-2 p-4 relative">
            <button
              onClick={(e) => { e.stopPropagation(); onRemove() }}
              className="absolute top-2 right-2 w-5 h-5 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 flex items-center justify-center transition-colors"
              title="Remove file"
            >
              <X size={11} className="text-zinc-400" />
            </button>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
              <ImageIcon size={15} className="text-indigo-400" />
            </div>
            <div className="text-center">
              <p className="text-zinc-300 text-[11px] font-medium truncate max-w-[140px]">{fileName ?? EXAMPLE_LABEL}</p>
              <p className="text-zinc-600 text-[10px] mt-0.5">Ready to refine</p>
            </div>
          </div>
        )}
      </div>

      {/* Try example button */}
      {state === 'empty' && (
        <button
          onClick={onUpload}
          className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-500 hover:text-indigo-400 transition-colors py-1.5 rounded-lg hover:bg-indigo-500/5 border border-transparent hover:border-indigo-500/20"
        >
          <Sparkles size={11} />
          Try example
        </button>
      )}

      {/* Supported formats */}
      <div className="text-zinc-700 text-[10px] leading-relaxed">
        Upload a screenshot of any UI — messy dashboard, outdated form, cluttered landing page.
      </div>
    </div>
  )
}
