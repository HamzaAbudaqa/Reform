'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { label: 'Product', href: '#features' },
  { label: 'Developers', href: '#' },
  { label: 'Enterprise', href: '#' },
  { label: 'Company', href: '#' },
  { label: 'Pricing', href: '#' },
] as const

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
          ? 'backdrop-blur-xl border-b'
          : 'bg-transparent'
      )}
      style={scrolled ? { background: 'rgba(19,17,28,0.85)', borderColor: 'rgba(255,255,255,0.06)' } : {}}
    >
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group flex-shrink-0">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity group-hover:opacity-80"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
              <circle cx="7" cy="7" r="4" />
              <circle cx="7" cy="7" r="2" fill="rgba(255,255,255,0.4)" />
            </svg>
          </div>
          <span className="font-semibold text-white text-sm tracking-tight">Reform</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-0.5">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="text-sm transition-colors px-3 py-1.5 rounded-md"
              style={{ color: 'rgba(255,255,255,0.55)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.9)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-2">
          <Link
            href="#demo"
            className="text-sm px-3.5 py-1.5 rounded-md transition-colors"
            style={{ color: 'rgba(255,255,255,0.55)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.9)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
          >
            Sign in
          </Link>
          <Link
            href="/new"
            className="text-sm px-4 py-1.5 rounded-lg text-white font-medium transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
          >
            Get Started →
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden transition-colors"
          style={{ color: 'rgba(255,255,255,0.55)' }}
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          className="md:hidden border-b px-6 py-4 flex flex-col gap-2"
          style={{ background: '#13111c', borderColor: 'rgba(255,255,255,0.06)' }}
        >
          {NAV_LINKS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="text-sm py-2 transition-colors"
              style={{ color: 'rgba(255,255,255,0.55)' }}
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="#demo"
            className="text-sm px-4 py-2 rounded-lg text-white font-medium text-center mt-1"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
            onClick={() => setMobileOpen(false)}
          >
            Get Started →
          </Link>
        </div>
      )}
    </nav>
  )
}
