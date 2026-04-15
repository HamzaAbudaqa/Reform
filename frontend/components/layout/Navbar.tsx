'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import AccountMenu from '@/components/layout/AccountMenu'
import { BILLING_ENABLED } from '@/lib/billing'

export default function Navbar() {
  const { data: session, status } = useSession()
  const pathname = usePathname()

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
      background: 'rgba(255,255,255,0.85)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '0.5px solid rgba(0,0,0,0.07)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Geist", sans-serif',
    }}>
      <div style={{
        maxWidth: 1160, margin: '0 auto',
        padding: '0 40px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>

        {/* Logo */}
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#0a0a0a', letterSpacing: '-0.04em' }}>
            Reform
          </span>
        </Link>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {BILLING_ENABLED && (
            <NavLink href="/subscription">Pricing</NavLink>
          )}

          <Link href="/new" style={{
            fontSize: 13, fontWeight: 500, color: '#fff',
            background: '#0a0a0a', textDecoration: 'none',
            borderRadius: 100, padding: '7px 18px',
            display: 'inline-flex', alignItems: 'center',
          }}>
            Get Started
          </Link>

          {status === 'loading' ? (
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#f0f0f0' }} />
          ) : session?.user ? (
            <AccountMenu />
          ) : (
            <NavLink href={`/signin?next=${encodeURIComponent(pathname)}`}>
              Sign In
            </NavLink>
          )}
        </div>

      </div>
    </nav>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{ fontSize: 13, color: '#6b6b6b', textDecoration: 'none', padding: '6px 12px', borderRadius: 8 }}
      onMouseEnter={(e) => (e.currentTarget.style.color = '#0a0a0a')}
      onMouseLeave={(e) => (e.currentTarget.style.color = '#6b6b6b')}
    >
      {children}
    </Link>
  )
}