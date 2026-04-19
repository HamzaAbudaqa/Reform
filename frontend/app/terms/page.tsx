import Link from 'next/link'
import Footer from '@/components/layout/Footer'

export const metadata = {
  title: 'Terms · Reform',
  description: 'The terms that apply when you use Reform.',
}

const LAST_UPDATED = 'April 19, 2026'

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-neutral-900">
      <Header />
      <main className="mx-auto w-full max-w-3xl px-6 py-16 flex-1">
        <div className="mb-10">
          <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400 font-semibold mb-2">
            Terms of Service
          </p>
          <h1 className="text-4xl font-bold text-neutral-950" style={{ letterSpacing: '-0.03em' }}>
            The deal between you and Reform
          </h1>
          <p className="mt-3 text-[13px] text-neutral-500">Last updated {LAST_UPDATED}</p>
        </div>

        <Section title="Plain-English summary">
          <p>
            Reform is a tool for analyzing and improving the UI of websites you own. By signing in
            you&apos;re saying: I have permission to do this on the repos and sites I connect, I
            understand the AI-generated code is suggestions (not guarantees), and I won&apos;t use
            Reform to attack other people&apos;s software. We&apos;ll make a best effort to keep
            the service running and your data safe — but software occasionally breaks and we
            can&apos;t promise zero downtime. If you don&apos;t like these terms, don&apos;t use
            Reform.
          </p>
        </Section>

        <Section title="Who can use Reform">
          <ul className="space-y-2 text-[14px] text-neutral-700 leading-relaxed">
            <li>· You must be at least 13 years old.</li>
            <li>
              · You must have permission to read, modify, and ship code from any repository you
              connect. If a repo belongs to your employer, that&apos;s their decision to make — not
              yours.
            </li>
            <li>
              · You must own or have authorization to install our heatmap script on any site you
              add.
            </li>
            <li>· You&apos;re responsible for keeping your sign-in credentials secure.</li>
          </ul>
        </Section>

        <Section title="What Reform actually does">
          <p>
            Reform reads code from repositories you authorize, generates suggestions and previews
            using AI, and (if you ask) opens a pull request on your behalf with the proposed
            changes. We also collect aggregated visitor behavior on sites where you install the
            tracker so we can show you heatmaps. Everything we do is initiated by you — Reform
            doesn&apos;t modify your code unless you explicitly approve a change.
          </p>
        </Section>

        <Section title="AI-generated code">
          <p>
            Suggestions and code transformations are produced by AI (Claude). We do our best to
            generate working, idiomatic code, but:
          </p>
          <ul className="mt-2 space-y-2 text-[14px] text-neutral-700 leading-relaxed">
            <li>· You should review every change before merging.</li>
            <li>· AI output may contain bugs, security issues, or non-optimal patterns.</li>
            <li>
              · You — not Reform — are responsible for what ends up in your repository and on your
              site.
            </li>
            <li>
              · Reform doesn&apos;t claim ownership over generated code; you own it the same way you
              own anything else committed to your repo.
            </li>
          </ul>
        </Section>

        <Section title="What you can't do">
          <ul className="space-y-2 text-[14px] text-neutral-700 leading-relaxed">
            <li>
              · Use Reform to attack, scrape, or reverse-engineer software you don&apos;t own.
            </li>
            <li>· Install the heatmap tracker on a site you don&apos;t control.</li>
            <li>· Try to get around rate limits, billing, or any usage caps.</li>
            <li>
              · Use Reform to generate or distribute illegal content, malware, or anything designed
              to harm others.
            </li>
            <li>· Resell Reform as your own product.</li>
          </ul>
        </Section>

        <Section title="Plans and billing">
          <ul className="space-y-2 text-[14px] text-neutral-700 leading-relaxed">
            <li>· The free tier exists and stays free for personal projects with reasonable usage.</li>
            <li>
              · Paid plans renew automatically on the same day each month until you cancel. You can
              cancel anytime from your account.
            </li>
            <li>
              · We don&apos;t pro-rate refunds for partial months, but if you&apos;re unhappy in the
              first 14 days of a paid plan, email us and we&apos;ll figure something out.
            </li>
            <li>
              · If your payment fails, we&apos;ll email you and pause paid features until it&apos;s
              resolved. We won&apos;t delete your account or your data.
            </li>
          </ul>
        </Section>

        <Section title="Service availability">
          <p>
            Reform is provided &quot;as is&quot;. We aim for high uptime, but we don&apos;t promise
            it. The service may occasionally be unavailable for maintenance, deploys, or because an
            external dependency (GitHub, Anthropic, Stripe, our hosting providers) is having a bad
            day. We&apos;re not liable for losses caused by downtime.
          </p>
        </Section>

        <Section title="Your content, your repos">
          <p>
            You keep full ownership of your code, your designs, and your repositories. By using
            Reform you&apos;re giving us permission to read those things solely to provide the
            service — we don&apos;t use your code to train AI models or share it with anyone outside
            the operational dependencies listed in our <Link href="/privacy" className="text-neutral-950 underline">Privacy Policy</Link>.
          </p>
        </Section>

        <Section title="Termination">
          <p>
            You can stop using Reform any time by signing out and (if you want) emailing us to
            delete your account. We can suspend or terminate accounts that violate these terms,
            attempt to abuse the service, or put other users at risk. If we do, we&apos;ll tell you
            why if it&apos;s safe to.
          </p>
        </Section>

        <Section title="Limitation of liability">
          <p>
            To the maximum extent allowed by law, Reform isn&apos;t responsible for indirect,
            incidental, or consequential damages arising from your use of the service. Our total
            liability for any claim related to Reform won&apos;t exceed what you paid us in the
            previous twelve months (or $50, whichever is greater).
          </p>
        </Section>

        <Section title="Changes to these terms">
          <p>
            If we change these terms in a material way, we&apos;ll bump the &quot;Last updated&quot;
            date and email account holders in advance. Continued use after a change means you accept
            the new version. If you don&apos;t, you can stop using Reform.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about these terms: <a className="text-neutral-950 underline" href="mailto:hamza.daqa@gmail.com">hamza.daqa@gmail.com</a>.
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
