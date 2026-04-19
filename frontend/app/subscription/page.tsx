'use client'

import { useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { apiUrl } from '@/lib/api'
import { useSubscription } from '@/lib/useSubscription'
import { parseResponseError } from '@/components/dashboard/GateError'
import { BILLING_ENABLED } from '@/lib/billing'

interface Plan {
  name: string
  price: string
  period: string
  description: string
  features: string[]
  cta: string
  highlighted?: boolean
  badge?: string
  stripe_price_id?: string
}

const STRIPE_PRO_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID
const STRIPE_MAX_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_MAX_PRICE_ID

if (!STRIPE_PRO_PRICE_ID) console.error('Missing env: NEXT_PUBLIC_STRIPE_PRO_PRICE_ID')
if (!STRIPE_MAX_PRICE_ID) console.error('Missing env: NEXT_PUBLIC_STRIPE_MAX_PRICE_ID')

const plans: Plan[] = [
  {
    name: 'Free',
    price: '$0',
    period: '',
    description: 'Get started and see what Reform can do for your frontend.',
    features: [
      '1 connected repo',
      '3 UI scans per month',
      'Basic UX scoring',
      'Single-page analysis',
      'Community support',
    ],
    cta: 'Get Started',
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/month',
    description: 'For developers who ship fast and want every page polished.',
    features: [
      'Up to 5 repos',
      '50 UI scans per month',
      'Auto-generated PR fixes',
      'Multi-page analysis & reports',
      'UX scoring with insights',
      'Shareable improvement reports',
      'Priority email support',
    ],
    cta: 'Upgrade to Pro',
    highlighted: true,
    badge: 'Most Popular',
    stripe_price_id: STRIPE_PRO_PRICE_ID,
  },
  {
    name: 'Team',
    price: '$99',
    period: '/month',
    description: 'Built for teams that care about design quality at scale.',
    features: [
      'Unlimited repos',
      'Unlimited UI scans',
      'CI/CD pipeline integration',
      'Shared team workspace',
      'Improvement history tracking',
      'Auto-generated PR fixes',
      'Role-based access controls',
      'Dedicated support channel',
    ],
    cta: 'Start Team Plan',
    stripe_price_id: STRIPE_MAX_PRICE_ID,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'Tailored for organizations with advanced requirements.',
    features: [
      'Everything in Team',
      'Competitor UI monitoring',
      'Custom analysis rules',
      'SSO & advanced security',
      'Dedicated account manager',
      'Priority support & SLA',
      'Custom onboarding & training',
    ],
    cta: 'Contact Sales',
  },
]

function PlanCard({ plan, onCheckout, loading, currentPlan }: { plan: Plan; onCheckout: (priceId: string) => void; loading: boolean; currentPlan: string }) {
  const planNameMap: Record<string, string> = { 'Free': 'free', 'Pro': 'pro', 'Team': 'max', 'Enterprise': 'enterprise' }
  const isCurrentPlan = planNameMap[plan.name] === currentPlan
  const isHighlighted = plan.highlighted

  return (
    <div
      className={`relative flex flex-col rounded-[24px] p-6 sm:p-7 bg-white transition ${
        isHighlighted ? 'border-neutral-950 shadow-[0_8px_28px_rgba(0,0,0,0.06)]' : 'border-black/[0.07]'
      }`}
      style={{ borderWidth: 1, borderStyle: 'solid' }}
    >
      {plan.badge && (
        <div className="absolute -top-3 left-6 rounded-full bg-neutral-950 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
          {plan.badge}
        </div>
      )}

      <div className="mb-6">
        <p className="mono text-[11px] mb-3 uppercase tracking-wider font-semibold text-neutral-400">
          {plan.name}
        </p>
        <div className="flex items-end gap-1 mb-3">
          <span
            className="font-bold text-neutral-950"
            style={{
              fontSize: plan.price === 'Custom' ? '30px' : '42px',
              letterSpacing: '-0.04em',
              lineHeight: 1,
            }}
          >
            {plan.price}
          </span>
          {plan.period && (
            <span className="text-neutral-400 text-[14px]">{plan.period}</span>
          )}
        </div>
        <p className="text-[13.5px] leading-relaxed text-neutral-600">
          {plan.description}
        </p>
      </div>

      <div className="mb-6 border-t border-black/[0.06] pt-5">
        <ul className="flex flex-col gap-3">
          {plan.features.map((feature, index) => (
            <li key={feature} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              <div>
                <span className="text-[13px] leading-snug text-neutral-700">{feature}</span>
                {index === 0 && (
                  <p className="mono text-[10px] mt-0.5 text-neutral-400">included in plan baseline</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        disabled={loading || isCurrentPlan}
        onClick={() => {
          if (plan.stripe_price_id && !isCurrentPlan) {
            onCheckout(plan.stripe_price_id)
          } else if (!plan.stripe_price_id && plan.cta === 'Contact Sales') {
            window.location.href = 'mailto:hamza.daqa@gmail.com?subject=Reform%20Enterprise'
          }
        }}
        className={
          isCurrentPlan
            ? 'mt-auto w-full rounded-full border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-semibold text-emerald-700 cursor-default'
            : isHighlighted
              ? 'mt-auto w-full rounded-full bg-neutral-950 px-4 py-3 text-[13px] font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50'
              : 'mt-auto w-full rounded-full border border-black/[0.12] bg-white px-4 py-3 text-[13px] font-semibold text-neutral-950 transition hover:bg-neutral-50 disabled:opacity-50'
        }
      >
        {isCurrentPlan ? 'Current Plan' : loading ? 'Redirecting…' : plan.cta}
      </button>
    </div>
  )
}

export default function SubscriptionPage() {
  const { data: session, status } = useSession()
  const { subscription } = useSubscription()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Note: this page used to hard-redirect to /dashboard whenever
  // BILLING_ENABLED was false, which broke every "View Plans" link in
  // the dashboard. Now we always render the plans so users can see what
  // tiers exist; the checkout buttons themselves surface a friendly
  // "billing isn't enabled yet" message when the env flag is off.

  async function startCheckout(priceId: string) {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(apiUrl('/billing/create-checkout-session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price_id: priceId,
          github_user_id: session!.githubId,
        }),
      })

      if (!res.ok) {
        const { message } = await parseResponseError(res)
        throw new Error(message)
      }

      const { checkout_url } = await res.json()
      window.location.href = checkout_url
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  async function handleCheckout(priceId: string) {
    if (status === 'loading') return

    if (!BILLING_ENABLED) {
      setError("Billing isn't enabled yet — paid plans are coming soon. Until then, you can keep using the free tier.")
      return
    }

    if (!priceId) {
      console.error('Checkout blocked: price ID is undefined. Check NEXT_PUBLIC_STRIPE_PRO_PRICE_ID and NEXT_PUBLIC_STRIPE_MAX_PRICE_ID env variables.')
      setError('Unable to start checkout — pricing configuration is missing.')
      return
    }

    if (!session?.githubId) {
      router.push(`/signin?next=${encodeURIComponent(`/subscription?resume=${priceId}`)}`)
      return
    }

    startCheckout(priceId)
  }

  // After sign-in redirect, auto-resume checkout
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const resumePrice = searchParams?.get('resume')
  const hasResumed = useRef(false)
  if (resumePrice && session?.githubId && !hasResumed.current) {
    hasResumed.current = true
    startCheckout(resumePrice)
  }

  return (
    <div className="min-h-screen flex flex-col bg-white text-neutral-900">
      <Navbar />

      <main className="flex-1 pt-24 sm:pt-28 pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {/* Hero */}
          <header className="mb-12 lg:mb-16 grid lg:grid-cols-[1fr_auto] gap-8 items-end">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-neutral-400 mb-3">
                Pricing
              </p>
              <h1
                className="text-[clamp(36px,6vw,60px)] font-bold text-neutral-950 leading-[1.05]"
                style={{ letterSpacing: '-0.03em' }}
              >
                Choose the plan that matches your redesign pace.
              </h1>
              <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-neutral-600">
                Start free, then scale up when you need more scans, more repositories, and deeper
                collaboration. Every plan keeps the same core promise: better frontend quality
                without rewriting your product.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 lg:max-w-md">
              <InfoCard label="Included">
                Competitor analysis, UX scoring, and frontend transformation workflows.
              </InfoCard>
              <InfoCard label="Deployment style">
                Built for developers who want a faster path from critique to polish.
              </InfoCard>
            </div>
          </header>

          {/* Error banner */}
          {error && (
            <div
              className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* Plan grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {plans.map((plan) => (
              <PlanCard
                key={plan.name}
                plan={plan}
                onCheckout={handleCheckout}
                loading={loading}
                currentPlan={subscription.plan}
              />
            ))}
          </div>

          {/* Footer note */}
          <div className="mt-10 flex flex-col gap-4 rounded-[24px] border border-black/[0.07] bg-neutral-50 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-neutral-400 mb-1.5">
                Security and access
              </p>
              <p className="text-[13px] text-neutral-600 leading-relaxed">
                All plans include HTTPS encryption and secure GitHub OAuth. You can cancel anytime.
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-full border border-black/[0.12] bg-white px-4 py-2 text-[12.5px] font-medium text-neutral-950 transition hover:bg-neutral-50"
            >
              Back to home
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

function InfoCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-black/[0.07] bg-neutral-50 p-4">
      <p className="mono text-[10.5px] mb-1.5 uppercase tracking-wider font-semibold text-neutral-400">
        {label}
      </p>
      <p className="text-[12.5px] leading-relaxed text-neutral-700">{children}</p>
    </div>
  )
}
