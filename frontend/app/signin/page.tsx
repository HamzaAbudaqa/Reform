'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn, useSession } from 'next-auth/react'
import Image from 'next/image'

const DEFAULT_POST_LOGIN = '/dashboard/discovery'

function resolvePostLoginDestination(raw: string | null): string {
  if (!raw) return DEFAULT_POST_LOGIN
  let path = raw
  try {
    // Handle fully-qualified URLs (e.g. http://localhost:3000/new)
    const u = new URL(raw, 'http://localhost')
    path = u.pathname + u.search
  } catch {
    // raw is already a path
  }
  const bare = path.split('?')[0].replace(/\/$/, '')
  // Routes that don't render a usable page — bounce to discovery
  if (bare === '' || bare === '/signin' || bare === '/dashboard' || bare === '/new' || bare.startsWith('/new/')) {
    return DEFAULT_POST_LOGIN
  }
  return path
}

function SignInContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  const next = resolvePostLoginDestination(
    searchParams.get('next') || searchParams.get('callbackUrl')
  )

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(next)
    }
  }, [status, next, router])

  if (status === 'loading' || status === 'authenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-5 h-5 rounded-full animate-spin border border-black/20 border-t-black" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="flex flex-col items-center mb-10">
          <h1 className="text-[26px] font-semibold text-neutral-950 tracking-[-0.03em]">
            Reform
          </h1>
          <p className="text-[14px] text-neutral-500 mt-2 text-center leading-relaxed">
            Sign in to continue
          </p>
        </div>

        {/* Card */}
        <div className="rounded-[24px] border border-black/[0.07] bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
          <button
            onClick={() => signIn('github', { callbackUrl: next })}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-full text-sm font-medium bg-neutral-950 text-white hover:bg-neutral-800 transition"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            Continue with GitHub
          </button>

          <p className="text-[12px] text-neutral-400 text-center mt-4 leading-relaxed">
            We only request access to your repositories and profile.
          </p>
        </div>

        {/* Back */}
        <div className="flex justify-center mt-6">
          <button
            onClick={() => router.push('/')}
            className="text-[13px] text-neutral-500 hover:text-neutral-900 transition flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Go back
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-5 h-5 rounded-full animate-spin border border-black/20 border-t-black" />
      </div>
    }>
      <SignInContent />
    </Suspense>
  )
}
