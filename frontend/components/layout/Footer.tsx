'use client'

import Link from 'next/link'
import { BILLING_ENABLED } from '@/lib/billing'

export default function Footer() {
  return (
    <footer style={{
      borderTop: '0.5px solid rgba(0,0,0,0.07)',
      background: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Geist", sans-serif',
    }}>
      <div style={{
        maxWidth: 1160, margin: '0 auto',
        padding: '32px 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap' as const, gap: 16,
      }}>

        {/* Left */}
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#0a0a0a', letterSpacing: '-0.03em', margin: '0 0 4px' }}>
            Reform
          </p>
          <p style={{ fontSize: 12, color: '#aaa', lineHeight: 1.7, maxWidth: 280, margin: 0 }}>
            Upgrade visual quality, preserve the logic, and ship cleaner interfaces with less churn.
          </p>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {BILLING_ENABLED && (
            <FooterLink href="/subscription">Pricing</FooterLink>
          )}
          <FooterLink href="/privacy">Privacy</FooterLink>
          <FooterLink href="/terms">Terms</FooterLink>
          <span style={{ fontSize: 12, color: '#ccc' }}>© 2026</span>
        </div>

      </div>
    </footer>
  )
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{ fontSize: 12, color: '#aaa', textDecoration: 'none' }}
      onMouseEnter={(e) => (e.currentTarget.style.color = '#0a0a0a')}
      onMouseLeave={(e) => (e.currentTarget.style.color = '#aaa')}
    >
      {children}
    </Link>
  )
}