'use client'

import { useState, useEffect } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'

const STEPS = [
  { num: '01', text: 'Connect or paste a repo URL' },
  { num: '02', text: 'Analyze competitors and design cues' },
  { num: '03', text: 'Generate a refined frontend direction' },
]

const PROCESS_NOTES = [
  'Reform scans the repo structure before making visual recommendations.',
  'Competitor analysis shapes the aesthetic direction, not your product logic.',
  'The workflow stays frontend-only, so routes, handlers, and backend flow remain untouched.',
]

interface GithubRepo {
  id: number
  full_name: string
  name: string
  private: boolean
  language: string | null
  updated_at: string
  default_branch: string
}

function GitHubIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3.5 7h7M8 4.5 10.5 7 8 9.5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 3v8M3 7h8" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  )
}

function CheckDot() {
  return <div className="h-1.5 w-1.5 rounded-full bg-neutral-900" />
}

export default function NewPage() {
  const { data: session, status } = useSession()
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'main' | 'github'>('main')
  const [repos, setRepos] = useState<GithubRepo[]>([])
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [creatingRepo, setCreatingRepo] = useState(false)
  const [createdRepo, setCreatedRepo] = useState<string | null>(null)
  const [newRepoName, setNewRepoName] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)

  useEffect(() => {
    if (view === 'github' && session?.accessToken && repos.length === 0) {
      setLoadingRepos(true)
      fetch('https://api.github.com/user/repos?sort=updated&per_page=20', {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      })
        .then((r) => r.json())
        .then((data) => {
          setRepos(Array.isArray(data) ? data : [])
          setLoadingRepos(false)
        })
        .catch(() => setLoadingRepos(false))
    }
  }, [view, session, repos.length])

  async function handleCreateRepo() {
    if (!session?.accessToken || !newRepoName.trim()) return
    setCreatingRepo(true)
    const name = `reform-${newRepoName.trim().toLowerCase().replace(/\s+/g, '-')}`
    const res = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        description: 'Refactored with Reform — polished frontend, same logic.',
        private: false,
        auto_init: true,
      }),
    })
    const data = await res.json()
    setCreatingRepo(false)
    if (data.html_url) setCreatedRepo(data.html_url)
  }

  const filteredRepos = repos.filter((r) =>
    r.full_name.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-white text-neutral-950">
      <header className="sticky top-0 z-20 border-b border-black/[0.06] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#0a0a0a', letterSpacing: '-0.04em' }}>
            Reform
          </span>
        </Link>


          {status === 'loading' ? null : session ? (
            <div className="flex items-center gap-2.5">
              <div className="hidden items-center gap-2 rounded-full border border-black/[0.06] bg-neutral-50 px-3 py-2 sm:flex">
                {session.user?.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={session.user.image} alt="" className="h-5 w-5 rounded-full" />
                )}
                <span className="text-[11px] text-neutral-500">
                  {session.user?.name ?? session.user?.email}
                </span>
              </div>
              <button
                onClick={() => signOut()}
                className="rounded-full border border-black/[0.08] px-4 py-2 text-[12px] font-medium text-neutral-700 transition hover:bg-neutral-50"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn('github')}
              className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50"
            >
              <GitHubIcon size={14} />
              Sign in with GitHub
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-24 pt-10 sm:px-6 sm:pt-14 lg:pt-16">
        <div className="grid gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <section>
            <div className="mb-6 inline-flex items-center rounded-full border border-black/[0.06] bg-neutral-50 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-neutral-500">
              New project
            </div>

            <h1 className="max-w-2xl text-[clamp(38px,5vw,64px)] font-semibold leading-[1.02] tracking-[-0.055em] text-neutral-950">
              Start from the repo.
              <br />
              <span className="text-neutral-300">Refine the interface.</span>
            </h1>

            <p className="mt-6 max-w-xl text-[16px] leading-8 text-neutral-500">
              Connect a GitHub repository or create a new one. Reform uses it as the starting point for a frontend-only polish pass with clearer hierarchy, tighter spacing, and a more consistent visual system.
            </p>

            {view === 'main' ? (
              <div className="mt-12 space-y-3">
                <button
                  className="w-full rounded-[22px] border border-black/[0.07] bg-white p-5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition hover:bg-neutral-50"
                  onClick={() => setView('github')}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-black/[0.06] bg-neutral-50 text-neutral-700">
                        <GitHubIcon size={17} />
                      </div>
                      <div>
                        <div className="text-[15px] font-medium text-neutral-950">GitHub repository</div>
                        <div className="mt-1 text-[12px] text-neutral-400">
                          {session ? `Signed in as ${session.user?.name ?? 'you'}` : 'Use any public GitHub repo'}
                        </div>
                      </div>
                    </div>
                    <div className="text-neutral-300">
                      <ArrowRightIcon />
                    </div>
                  </div>
                </button>

                {!showCreateForm ? (
                  <button
                    className="w-full rounded-[22px] border border-black/[0.07] bg-white p-5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition hover:bg-neutral-50"
                    onClick={() => (session ? setShowCreateForm(true) : signIn('github'))}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-black/[0.06] bg-neutral-50 text-neutral-700">
                          <PlusIcon />
                        </div>
                        <div>
                          <div className="text-[15px] font-medium text-neutral-950">Create new project</div>
                          <div className="mt-1 text-[12px] text-neutral-400">
                            {session ? 'Create a Reform-ready repository from this workspace' : 'Sign in with GitHub to create'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                ) : createdRepo ? (
                  <div className="rounded-[22px] border border-black/[0.07] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                    <div className="mb-2 text-[14px] font-medium text-neutral-950">Repository created</div>
                    <a
                      href={createdRepo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[13px] text-neutral-500 underline underline-offset-4"
                    >
                      {createdRepo}
                    </a>
                  </div>
                ) : (
                  <div className="rounded-[22px] border border-black/[0.07] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                    <div className="flex items-center gap-3 border-b border-black/[0.06] pb-3">
                      <span className="font-mono text-[12px] text-neutral-400">reform-</span>
                      <input
                        autoFocus
                        type="text"
                        placeholder="project-name"
                        value={newRepoName}
                        onChange={(e) => setNewRepoName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateRepo()}
                        className="w-full bg-transparent text-sm text-neutral-950 outline-none placeholder:text-neutral-300"
                      />
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                      <button
                        onClick={handleCreateRepo}
                        disabled={!newRepoName.trim() || creatingRepo}
                        className="rounded-full bg-neutral-950 px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {creatingRepo ? 'Creating...' : 'Create'}
                      </button>
                      <button
                        onClick={() => setShowCreateForm(false)}
                        className="text-[12px] text-neutral-500 transition hover:text-neutral-800"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-12">
                <div className="overflow-hidden rounded-[24px] border border-black/[0.07] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.03)]">
                  <div className="border-b border-black/[0.06] px-6 py-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h2 className="text-[17px] font-medium tracking-[-0.02em] text-neutral-950">Choose a repository</h2>
                        <p className="mt-1 text-[12px] text-neutral-400">
                          Browse an existing repo or paste a GitHub URL.
                        </p>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.06] bg-neutral-50 px-3 py-1.5">
                        <CheckDot />
                        <span className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                          {session ? 'Connected' : 'Public only'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="border-b border-black/[0.06] px-6 py-4">
                    <div className="flex items-center gap-3 rounded-full border border-black/[0.07] bg-neutral-50 px-4 py-3">
                      <GitHubIcon size={15} color="rgba(23,23,23,0.45)" />
                      <input
                        autoFocus
                        type="text"
                        placeholder={session ? 'Search your repositories...' : 'github.com/owner/repository'}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full bg-transparent text-sm text-neutral-950 outline-none placeholder:text-neutral-300"
                      />
                    </div>
                  </div>

                  <div className="max-h-[440px] overflow-y-auto">
                    {!session && (
                      <div className="space-y-5 p-6">
                        <button
                          onClick={() => signIn('github')}
                          className="flex w-full items-center justify-center gap-2 rounded-full border border-black/[0.08] px-4 py-3 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50"
                        >
                          <GitHubIcon size={14} />
                          Sign in to browse your repos
                        </button>

                        <div className="flex items-center gap-3">
                          <div className="h-px flex-1 bg-black/[0.06]" />
                          <span className="text-[10px] uppercase tracking-[0.16em] text-neutral-400">or</span>
                          <div className="h-px flex-1 bg-black/[0.06]" />
                        </div>

                        <Link
                          href={`/dashboard?repo=${encodeURIComponent(query || 'https://github.com/vercel/next.js')}`}
                          className="flex w-full items-center justify-center gap-2 rounded-full bg-neutral-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
                        >
                          Analyze this repo
                          <ArrowRightIcon />
                        </Link>
                      </div>
                    )}

                    {session && loadingRepos && (
                      <div className="flex items-center justify-center py-14 text-sm text-neutral-400">
                        Loading your repositories...
                      </div>
                    )}

                    {session && !loadingRepos && filteredRepos.map((repo, index) => (
                      <Link
                        key={repo.id}
                        href={`/dashboard?repo=${encodeURIComponent(`https://github.com/${repo.full_name}`)}&branch=${encodeURIComponent(repo.default_branch || 'main')}`}
                        className="flex items-center justify-between gap-4 px-6 py-4 transition hover:bg-neutral-50"
                        style={{ borderBottom: index < filteredRepos.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}
                      >
                        <div className="flex min-w-0 items-center gap-3.5">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/[0.06] bg-neutral-50 text-neutral-700">
                            <GitHubIcon size={15} />
                          </div>
                          <div className="min-w-0">
                            <span className="block truncate text-[14px] font-medium text-neutral-950">{repo.full_name}</span>
                            <div className="mt-1 flex items-center gap-2 text-[11px] text-neutral-400">
                              {repo.language && <span>{repo.language}</span>}
                              {repo.private && <span>Private</span>}
                            </div>
                          </div>
                        </div>
                        <div className="text-neutral-300">
                          <ArrowRightIcon />
                        </div>
                      </Link>
                    ))}

                    {session && !loadingRepos && (
                      <div className="border-t border-black/[0.06]">
                        {!showCreateForm ? (
                          <button
                            onClick={() => setShowCreateForm(true)}
                            className="flex w-full items-center gap-4 px-6 py-4 text-left transition hover:bg-neutral-50"
                          >
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/[0.06] bg-neutral-50 text-neutral-700">
                              <PlusIcon />
                            </div>
                            <div>
                              <div className="text-[14px] font-medium text-neutral-950">Create new repo</div>
                              <div className="mt-1 text-[11px] text-neutral-400">New Reform-ready repository</div>
                            </div>
                          </button>
                        ) : createdRepo ? (
                          <div className="p-6">
                            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-black/[0.06] bg-neutral-50 px-3 py-1.5 text-[11px] text-neutral-700">
                              <CheckDot />
                              Created
                            </div>
                            <a
                              href={createdRepo}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-[13px] text-neutral-500 underline underline-offset-4"
                            >
                              {createdRepo}
                            </a>
                          </div>
                        ) : (
                          <div className="p-6">
                            <div className="flex items-center gap-3 border-b border-black/[0.06] pb-3">
                              <span className="font-mono text-[12px] text-neutral-400">reform-</span>
                              <input
                                autoFocus
                                type="text"
                                placeholder="my-project"
                                value={newRepoName}
                                onChange={(e) => setNewRepoName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateRepo()}
                                className="w-full bg-transparent text-sm text-neutral-950 outline-none placeholder:text-neutral-300"
                              />
                            </div>
                            <div className="mt-4 flex items-center gap-3">
                              <button
                                onClick={handleCreateRepo}
                                disabled={!newRepoName.trim() || creatingRepo}
                                className="rounded-full bg-neutral-950 px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {creatingRepo ? 'Creating...' : 'Create'}
                              </button>
                              <button
                                onClick={() => setShowCreateForm(false)}
                                className="text-[12px] text-neutral-500 transition hover:text-neutral-800"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setView('main')
                    setQuery('')
                  }}
                  className="mt-5 text-[12px] text-neutral-500 transition hover:text-neutral-800"
                >
                  ← Back
                </button>
              </div>
            )}
          </section>

          <aside className="lg:pt-10">
            <div className="sticky top-[96px] overflow-hidden rounded-[24px] border border-black/[0.07] bg-neutral-50">
              <div className="border-b border-black/[0.06] px-6 py-5">
                <div className="text-[12px] uppercase tracking-[0.14em] text-neutral-500">How it works</div>
              </div>

              <div className="px-6 py-6">
                <div className="space-y-6">
                  {STEPS.map((step, index) => (
                    <div key={step.num} className="flex gap-4">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-black/[0.06] bg-white font-mono text-[11px] text-neutral-500">
                        {step.num}
                      </div>
                      <div>
                        <p className="pt-1 text-[14px] leading-6 text-neutral-700">{step.text}</p>
                        {index < STEPS.length - 1 && <div className="mt-4 h-6 w-px bg-black/[0.06]" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-black/[0.06] px-6 py-6">
                <div className="mb-4 text-[12px] uppercase tracking-[0.14em] text-neutral-500">What to know</div>
                <div className="space-y-4">
                  {PROCESS_NOTES.map((note) => (
                    <p key={note} className="text-[13px] leading-6 text-neutral-500">
                      {note}
                    </p>
                  ))}
                </div>
              </div>

              <div className="border-t border-black/[0.06] px-6 py-6">
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
                  <div>
                    <div className="mb-2 text-[12px] uppercase tracking-[0.14em] text-neutral-500">Outcome</div>
                    <p className="text-[13px] leading-6 text-neutral-500">
                      Better UI signal before any code transformation starts. The intake flow frames the repo, design intent, and next steps in one place.
                    </p>
                  </div>
                  <div>
                    <div className="mb-2 text-[12px] uppercase tracking-[0.14em] text-neutral-500">Constraint</div>
                    <p className="text-[13px] leading-6 text-neutral-500">
                      Frontend redesign only. This stage improves visual quality and structure, not product flows.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}
