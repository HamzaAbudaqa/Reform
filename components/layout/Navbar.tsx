'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Zap, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_LINKS = ['Features', 'Demo', 'Docs'] as const

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <nav
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-zinc-950/85 backdrop-blur-xl border-b border-zinc-800/80'
          : 'bg-transparent'
      )}
    >
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group flex-shrink-0">
          <div className="w-6 h-6 rounded bg-indigo-500 flex items-center justify-center transition-colors group-hover:bg-indigo-400">
            <Zap size={13} className="text-white" strokeWidth={2.5} />
          </div>
          <span className="font-semibold text-zinc-100 text-sm tracking-tight">RefineUI</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((item) => (
            <Link
              key={item}
              href={`#${item.toLowerCase()}`}
              className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors px-3 py-1.5 rounded-md hover:bg-zinc-800/50"
            >
              {item}
            </Link>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-2">
          <Link
            href="#demo"
            className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors px-3 py-1.5"
          >
            Sign in
          </Link>
          <Link
            href="#demo"
            className="text-sm px-3.5 py-1.5 rounded-md bg-indigo-500 hover:bg-indigo-400 text-white font-medium transition-colors shadow-glow-sm"
          >
            Try Demo
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-zinc-400 hover:text-zinc-100 transition-colors"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-zinc-950 border-b border-zinc-800 px-6 py-4 flex flex-col gap-2 animate-fade-in">
          {NAV_LINKS.map((item) => (
            <Link
              key={item}
              href={`#${item.toLowerCase()}`}
              className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors py-2"
              onClick={() => setMobileOpen(false)}
            >
              {item}
            </Link>
          ))}
          <Link
            href="#demo"
            className="text-sm px-4 py-2 rounded-md bg-indigo-500 text-white font-medium text-center mt-1"
            onClick={() => setMobileOpen(false)}
          >
            Try Demo
          </Link>
        </div>
      )}
    </nav>
  )
}
