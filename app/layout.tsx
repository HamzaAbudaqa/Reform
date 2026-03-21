import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'RefineUI — Upgrade ugly frontends into polished UI',
  description:
    'AI-powered frontend refactoring tool. Upload a screenshot, get a production-ready redesign. Refactor the UI, not the logic.',
  keywords: ['UI refactor', 'frontend AI', 'design tool', 'developer tool'],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-zinc-950 text-zinc-100 antialiased font-sans">{children}</body>
    </html>
  )
}
