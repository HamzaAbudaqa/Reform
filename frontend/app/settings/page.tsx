'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { useSubscription } from '@/lib/useSubscription'
import { apiUrl } from '@/lib/api'
import { BILLING_ENABLED } from '@/lib/billing'

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const { subscription, isFree } = useSubscription()
  const router = useRouter()
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/signin?next=/settings')
    }
  }, [status, router])

  async function openBillingPortal() {
    if (!session?.githubId) return
    setPortalLoading(true)
    try {
      const res = await fetch(apiUrl('/billing/create-portal-session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ github_user_id: session.githubId }),
      })
      if (!res.ok) throw new Error()
      const { portal_url } = await res.json()
      window.location.href = portal_url
    } catch {
      router.push('/subscription')
    } finally {
      setPortalLoading(false)
    }
  }

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

  return (
    <div className="min-h-screen flex flex-col bg-white text-neutral-900">
      <Navbar />

      <main className="flex-1 pt-24 sm:pt-28 pb-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="mb-10">
            <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-neutral-400 mb-2">
              Settings
            </p>
            <h1 className="text-[clamp(28px,5vw,40px)] font-bold text-neutral-950" style={{ letterSpacing: '-0.03em' }}>
              Preferences
            </h1>
          </div>

          {/* Subscription & Billing */}
          {BILLING_ENABLED && (
            <SettingsSection title="Subscription & Billing">
              <SettingsRow
                label="Current Plan"
                value={
                  <span
                    className="text-[12px] font-semibold px-2.5 py-1 rounded-lg"
                    style={
                      isFree
                        ? { background: 'rgba(0,0,0,0.05)', color: '#525252', border: '1px solid rgba(0,0,0,0.08)' }
                        : { background: 'rgba(34,197,94,0.1)', color: '#15803d', border: '1px solid rgba(34,197,94,0.25)' }
                    }
                  >
                    {subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)}
                  </span>
                }
                action={
                  <button
                    onClick={() => router.push('/subscription')}
                    className="text-[12px] font-medium text-neutral-500 transition hover:text-neutral-950"
                  >
                    {isFree ? 'Upgrade' : 'Change plan'}
                  </button>
                }
              />
              {!isFree && (
                <SettingsRow
                  label="Billing"
                  value={
                    <span className="text-[13px] text-neutral-500">Managed via Stripe</span>
                  }
                  action={
                    <button
                      onClick={openBillingPortal}
                      disabled={portalLoading}
                      className="text-[12px] font-medium text-neutral-500 transition hover:text-neutral-950 disabled:opacity-50"
                    >
                      {portalLoading ? 'Opening…' : 'Manage'}
                    </button>
                  }
                />
              )}
              {subscription.current_period_end && (
                <SettingsRow
                  label="Next billing date"
                  value={
                    <span className="text-[13px] text-neutral-500">
                      {new Date(subscription.current_period_end).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  }
                />
              )}
            </SettingsSection>
          )}

          {/* Connected Account */}
          <SettingsSection title="Connected Account">
            <SettingsRow
              label="GitHub"
              value={
                <div className="flex items-center gap-2">
                  {session.user?.image && (
                    <img
                      src={session.user.image}
                      alt=""
                      className="w-5 h-5 rounded-full border border-black/[0.08]"
                    />
                  )}
                  <span className="text-[13px] text-neutral-700">
                    {session.githubUsername ? `@${session.githubUsername}` : session.user?.name || 'Connected'}
                  </span>
                </div>
              }
            />
            {session.user?.email && (
              <SettingsRow
                label="Email"
                value={
                  <span className="text-[13px] text-neutral-500">
                    {session.user.email}
                  </span>
                }
              />
            )}
          </SettingsSection>

          {/* Session */}
          <SettingsSection title="Session">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[13px] font-medium text-neutral-900">Sign out</div>
                <div className="text-[12px] mt-0.5 text-neutral-500">
                  End your current session on this device.
                </div>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="rounded-full px-4 py-2 text-[12px] font-medium transition"
                style={{
                  color: '#dc2626',
                  background: 'rgba(220,38,38,0.06)',
                  border: '1px solid rgba(220,38,38,0.18)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(220,38,38,0.12)'
                  e.currentTarget.style.borderColor = 'rgba(220,38,38,0.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(220,38,38,0.06)'
                  e.currentTarget.style.borderColor = 'rgba(220,38,38,0.18)'
                }}
              >
                Sign Out
              </button>
            </div>
          </SettingsSection>
        </div>
      </main>

      <Footer />
    </div>
  )
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5 rounded-[24px] border border-black/[0.07] bg-white p-6 sm:p-8 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <p className="mono text-[11px] mb-5 text-neutral-400 uppercase tracking-wider font-semibold">
        {title}
      </p>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function SettingsRow({ label, value, action }: { label: string; value: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="text-[13px] font-medium text-neutral-700">{label}</div>
      <div className="flex items-center gap-4">
        {value}
        {action}
      </div>
    </div>
  )
}
