'use client'

import Link from 'next/link'

export default function Navbar() {
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl border-b"
      style={{ background: 'rgba(19,17,28,0.85)', borderColor: 'rgba(255,255,255,0.05)' }}
    >
      <div className="max-w-7xl mx-auto px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group flex-shrink-0">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              boxShadow: '0 0 12px rgba(124,58,237,0.3)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
              <circle cx="7" cy="7" r="4" />
              <circle cx="7" cy="7" r="2" fill="rgba(255,255,255,0.4)" />
            </svg>
          </div>
          <span className="font-semibold text-white text-[15px] tracking-tight">Reform</span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-4">
          <Link
            href="#demo"
            className="text-sm px-4 py-1.5 rounded-md transition-all duration-200"
            style={{ color: 'rgba(255,255,255,0.45)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.9)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
          >
            Sign in
          </Link>
          <Link
            href="/new"
            className="text-sm px-5 py-2 rounded-lg text-white font-medium transition-all duration-200 hover:opacity-90"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              boxShadow: '0 0 20px rgba(124,58,237,0.25)',
            }}
          >
            Get Started →
          </Link>
        </div>
      </div>
    </nav>
  )
}
