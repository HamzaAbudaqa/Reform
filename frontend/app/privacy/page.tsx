import Link from 'next/link'
import Footer from '@/components/layout/Footer'

export const metadata = {
  title: 'Privacy · Reform',
  description: 'How Reform collects, uses, and protects your information.',
}

const LAST_UPDATED = 'April 19, 2026'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-neutral-900">
      <Header />
      <main className="mx-auto w-full max-w-3xl px-6 py-16 flex-1">
        <div className="mb-10">
          <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400 font-semibold mb-2">
            Privacy Policy
          </p>
          <h1 className="text-4xl font-bold text-neutral-950" style={{ letterSpacing: '-0.03em' }}>
            What we collect, why, and how we look after it
          </h1>
          <p className="mt-3 text-[13px] text-neutral-500">Last updated {LAST_UPDATED}</p>
        </div>

        <Section title="Plain-English summary">
          <p>
            Reform helps you analyze and improve the user interface of websites you own. To do that we
            look at code you give us access to, generate suggestions with AI, and (optionally) collect
            anonymized visitor behavior on sites where you install our tracking script. We don&apos;t
            sell your data, we don&apos;t track form values, we don&apos;t use cookies for analytics,
            and we don&apos;t store individual visitors&apos; identities.
          </p>
        </Section>

        <Section title="Information we collect">
          <Bullet title="Account information">
            When you sign in with GitHub, we store your GitHub user ID, username, email address, and
            avatar URL. That&apos;s it.
          </Bullet>
          <Bullet title="Repository contents you authorize">
            With your permission (granted via GitHub OAuth), Reform reads files from repositories you
            select. We use those files to detect your framework, generate previews, and produce
            suggested changes. We don&apos;t store every file forever — code is held only as long as
            we need it to run the analysis you requested.
          </Bullet>
          <Bullet title="Visit behavior on sites where you install the tracker">
            If you install the Reform heatmap script on a site you own, we collect aggregated
            behavioral signals from your visitors: where they click, where they move their cursor,
            how far they scroll, and which pages they view. We do <strong>not</strong> collect form
            values, text the visitor typed, cookies, localStorage contents, or any third-party data.
            Coordinates are stored as percentages of the page, never as exact pixels, and individual
            events are aggregated into 50×50 heat buckets — raw events are never stored.
          </Bullet>
          <Bullet title="Billing information (if you upgrade)">
            Payments are processed by Stripe. We never see or store your full card number. Stripe
            sends us back a customer ID, the plan you&apos;re on, and renewal status.
          </Bullet>
          <Bullet title="Operational logs">
            Standard server logs (IP address, request path, timestamp, user agent) are retained for
            up to 30 days for security and debugging. We don&apos;t use them for marketing.
          </Bullet>
        </Section>

        <Section title="How we use it">
          <ul className="space-y-2 text-[14px] text-neutral-700 leading-relaxed">
            <li>· To run the analyses, transformations, and previews you ask for.</li>
            <li>· To show you heatmaps, version comparisons, and AI recommendations for your sites.</li>
            <li>· To open pull requests on your behalf when you click &quot;Install tracking automatically&quot;.</li>
            <li>· To bill you (if you&apos;re on a paid plan) and to renew or cancel your subscription.</li>
            <li>· To debug failures and protect the service from abuse.</li>
          </ul>
        </Section>

        <Section title="Who we share it with">
          <Bullet title="Anthropic">
            We send code snippets and behavior summaries to Claude (Anthropic&apos;s API) to generate
            transformations and recommendations. Anthropic doesn&apos;t train on this data per our
            API contract.
          </Bullet>
          <Bullet title="GitHub">
            When you authorize the GitHub integration, requests to read your repos and open pull
            requests are made directly against the GitHub API on your behalf.
          </Bullet>
          <Bullet title="Stripe">
            For payments and subscription management.
          </Bullet>
          <Bullet title="Hosting providers">
            Vercel hosts the dashboard. Railway hosts the backend. AWS S3 stores screenshots and
            larger artifacts.
          </Bullet>
          <p className="mt-4 text-[14px] text-neutral-700 leading-relaxed">
            We don&apos;t sell, rent, or trade your data with anyone else.
          </p>
        </Section>

        <Section title="How long we keep it">
          <ul className="space-y-2 text-[14px] text-neutral-700 leading-relaxed">
            <li>· <strong>Account data:</strong> while your account is active.</li>
            <li>· <strong>Project &amp; transform history:</strong> while your account is active, or until you delete it.</li>
            <li>· <strong>Heatmap aggregates:</strong> while you keep the tracker installed and the site connected.</li>
            <li>· <strong>Server logs:</strong> 30 days.</li>
            <li>· <strong>Billing records:</strong> as long as required by law (typically 7 years).</li>
          </ul>
        </Section>

        <Section title="Your choices">
          <Bullet title="See or export your data">
            Email us (below) and we&apos;ll send you a copy of what we have for your account.
          </Bullet>
          <Bullet title="Delete your account">
            Email us with the address tied to your account and we&apos;ll delete everything within 30
            days, except records we&apos;re required to keep for billing or compliance.
          </Bullet>
          <Bullet title="Visitor opt-out (heatmaps)">
            Our tracker honors <code className="mono text-neutral-950">navigator.doNotTrack === &apos;1&apos;</code>.
            Visitors with Do Not Track enabled load the script but emit nothing.
          </Bullet>
        </Section>

        <Section title="Security">
          <p>
            All traffic is over HTTPS. Production secrets are stored in our hosting providers&apos;
            secure config. Database connections are TLS. We follow the principle of least privilege
            and we don&apos;t store your GitHub access token longer than the active session needs it.
            No system is perfectly secure — if you ever notice a vulnerability, please reach out at
            the address below.
          </p>
        </Section>

        <Section title="Children">
          <p>
            Reform is a developer tool and isn&apos;t directed at children under 13. We don&apos;t
            knowingly collect data from children.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            If we change anything material, we&apos;ll bump the &quot;Last updated&quot; date and (if
            you have an account) email you in advance. Continued use after a change means you accept
            the new version.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions, deletion requests, or anything else: <a className="text-neutral-950 underline" href="mailto:hamza.daqa@gmail.com">hamza.daqa@gmail.com</a>.
          </p>
        </Section>
      </main>
      <Footer />
    </div>
  )
}

function Header() {
  return (
    <header className="border-b border-black/[0.06]">
      <div className="mx-auto max-w-3xl px-6 py-5 flex items-center justify-between">
        <Link href="/" className="text-[20px] font-bold text-neutral-950" style={{ letterSpacing: '-0.04em' }}>
          Reform
        </Link>
        <Link href="/" className="text-[12px] text-neutral-500 hover:text-neutral-950 transition">
          ← Back home
        </Link>
      </div>
    </header>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-[16px] font-semibold text-neutral-950 mb-3">{title}</h2>
      <div className="text-[14px] text-neutral-700 leading-relaxed">{children}</div>
    </section>
  )
}

function Bullet({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="text-[14px] font-semibold text-neutral-900">{title}</p>
      <p className="text-[14px] text-neutral-700 leading-relaxed mt-0.5">{children}</p>
    </div>
  )
}
