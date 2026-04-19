'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { useSubscription } from '@/lib/useSubscription'

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  max: 'Team',
  enterprise: 'Enterprise',
}

export default function AccountPage() {
  const { data: session, status } = useSession()
  const { subscription, loading: subLoading } = useSubscription()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/signin?next=/account')
    }
  }, [status, router])

  if (status !== 'authenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div
          className="h-5 w-5 rounded-full"
          style={{
            border: '2px solid rgba(0,0,0,0.12)',
            borderTopColor: '#0a0a0a',
            animation: 'spin 0.9s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const planLabel = PLAN_LABELS[subscription.plan] || subscription.plan
  const scansPercent = subscription.scans_limit > 0
    ? Math.min(100, Math.round((subscription.scans_used / subscription.scans_limit) * 100))
    : 0
  const reposDisplay = subscription.repos_limit === -1
    ? `${subscription.repos_connected} / Unlimited`
    : `${subscription.repos_connected} / ${subscription.repos_limit}`

  return (
    <div className="min-h-screen flex flex-col bg-white text-neutral-900">
      <Navbar />

      <main className="flex-1 pt-24 sm:pt-28 pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="mb-10">
            <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-neutral-400 mb-2">
              Account
            </p>
            <h1 className="text-[clamp(28px,5vw,40px)] font-bold text-neutral-950" style={{ letterSpacing: '-0.03em' }}>
              Your profile
            </h1>
          </div>

          {/* GitHub Profile */}
          <Card>
            <CardLabel>Connected Account</CardLabel>
            <div className="flex items-center gap-4">
              {session.user?.image ? (
                <img
                  src={session.user.image}
                  alt=""
                  className="w-14 h-14 rounded-2xl border border-black/[0.07]"
                />
              ) : (
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold text-neutral-700"
                  style={{ background: 'rgba(0,0,0,0.06)' }}
                >
                  {session.user?.name?.[0]?.toUpperCase() || '?'}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-lg font-semibold text-neutral-950 truncate">
                  {session.user?.name || 'User'}
                </div>
                {session.githubUsername && (
                  <div className="text-sm text-neutral-500 truncate">
                    @{session.githubUsername}
                  </div>
                )}
                {session.user?.email && (
                  <div className="text-[13px] mt-0.5 text-neutral-400 truncate">
                    {session.user.email}
                  </div>
                )}
              </div>
              <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="rgba(0,0,0,0.45)">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                <span className="text-[12px] font-medium text-neutral-500">GitHub</span>
              </div>
            </div>
          </Card>

          {/* Plan & Usage */}
          <Card>
            <div className="flex items-center justify-between mb-5">
              <CardLabel>Current Plan</CardLabel>
              <span
                className="text-[11px] font-semibold px-2.5 py-1 rounded-lg"
                style={
                  subscription.plan === 'free'
                    ? { background: 'rgba(0,0,0,0.05)', color: '#525252', border: '1px solid rgba(0,0,0,0.08)' }
                    : { background: 'rgba(34,197,94,0.1)', color: '#15803d', border: '1px solid rgba(34,197,94,0.25)' }
                }
              >
                {planLabel}
              </span>
            </div>

            {!subLoading && (
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-[13px] mb-2">
                    <span className="text-neutral-700">UI Scans</span>
                    <span className="text-neutral-500">
                      {subscription.scans_used} / {subscription.scans_limit}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden bg-neutral-100">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${scansPercent}%`,
                        background: scansPercent >= 90 ? '#dc2626' : '#0a0a0a',
                      }}
                    />
                  </div>
                </div>

                <div className="flex justify-between text-[13px]">
                  <span className="text-neutral-700">Connected Repos</span>
                  <span className="text-neutral-500">{reposDisplay}</span>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <FeatureBadge label="PR Auto-fix" enabled={subscription.features.pr_autofix} />
                  <FeatureBadge label="Full Reports" enabled={subscription.features.full_report} />
                </div>
              </div>
            )}

            <div className="mt-6 pt-5 border-t border-black/[0.07] flex flex-wrap gap-3">
              <Link
                href="/subscription"
                className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-neutral-800"
              >
                {subscription.plan === 'free' ? 'Upgrade Plan' : 'View Plans'}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
            </div>
          </Card>

          {/* Quick Links */}
          <Card>
            <CardLabel>Quick Links</CardLabel>
            <div className="grid sm:grid-cols-2 gap-3">
              <QuickLink href="/dashboard" label="Dashboard" description="View your projects and analyses" />
              <QuickLink href="/settings" label="Settings" description="Manage your preferences" />
              <QuickLink href="/subscription" label="Plans & Pricing" description="Compare plans and upgrade" />
              <QuickLink href="/dashboard/discovery" label="New Analysis" description="Start analyzing a repository" />
            </div>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="mb-5 rounded-[24px] border border-black/[0.07] bg-white p-6 sm:p-8 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      {children}
    </section>
  )
}

function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mono text-[11px] mb-5 text-neutral-400 uppercase tracking-wider font-semibold">
      {children}
    </p>
  )
}

function FeatureBadge({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <span
      className="text-[11px] font-medium px-2.5 py-1 rounded-lg"
      style={
        enabled
          ? { background: 'rgba(34,197,94,0.1)', color: '#15803d', border: '1px solid rgba(34,197,94,0.25)' }
          : { background: 'rgba(0,0,0,0.04)', color: '#a3a3a3', border: '1px solid rgba(0,0,0,0.06)' }
      }
    >
      {enabled ? '\u2713' : '\u2014'} {label}
    </span>
  )
}

function QuickLink({ href, label, description }: { href: string; label: string; description: string }) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-black/[0.07] bg-white p-4 transition hover:border-black/[0.18] hover:shadow-md"
    >
      <div className="text-[13px] font-semibold text-neutral-950 mb-1">{label}</div>
      <div className="text-[12px] text-neutral-500">{description}</div>
    </Link>
  )
}
