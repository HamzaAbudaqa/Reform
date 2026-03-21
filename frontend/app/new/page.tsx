'use client'

import { useState, useEffect } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import Link from 'next/link'
import DemoWorkspace from '@/components/demo/DemoWorkspace'

const SUGGESTIONS = [
  'Refine a Next.js dashboard to Railway style',
  'Apply minimal preset to my admin panel',
]

interface GithubRepo {
  id: number
  full_name: string
  name: string
  private: boolean
  language: string | null
  updated_at: string
}

function GitHubIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  )
}

export default function NewPage() {
  const { data: session, status } = useSession()
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'main' | 'github' | 'creating' | 'workspace'>('main')
  const [selectedRepo, setSelectedRepo] = useState('')
  const [repos, setRepos] = useState<GithubRepo[]>([])
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [creatingRepo, setCreatingRepo] = useState(false)
  const [createdRepo, setCreatedRepo] = useState<string | null>(null)
  const [newRepoName, setNewRepoName] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)

  // Fetch user's repos when they open the GitHub view
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

  // Create a new repo in the user's GitHub account
  async function handleCreateRepo() {
    if (!session?.accessToken || !newRepoName.trim()) return
    setCreatingRepo(true)
    const name = `refineui-${newRepoName.trim().toLowerCase().replace(/\s+/g, '-')}`
    const res = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        description: 'Refactored with RefineUI — polished frontend, same logic.',
        private: false,
        auto_init: true,
      }),
    })
    const data = await res.json()
    setCreatingRepo(false)
    if (data.html_url) {
      setCreatedRepo(data.html_url)
    }
  }

  const filteredRepos = repos.filter((r) =>
    r.full_name.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: '#0d0c16',
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-3">
          <Link href="/">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="white">
                <circle cx="6" cy="6" r="3.5" />
                <circle cx="6" cy="6" r="1.5" fill="rgba(255,255,255,0.4)" />
              </svg>
            </div>
          </Link>
          <div className="flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
            <span>/</span>
            <span className="text-white font-medium">New project</span>
          </div>
        </div>

        {/* Auth button */}
        {status === 'loading' ? null : session ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {session.user?.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={session.user.image} alt="" className="w-6 h-6 rounded-full" />
              )}
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                {session.user?.name ?? session.user?.email}
              </span>
            </div>
            <button
              onClick={() => signOut()}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            onClick={() => signIn('github')}
            className="flex items-center gap-2 text-sm px-4 py-1.5 rounded-lg font-medium transition-opacity hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
          >
            <GitHubIcon size={14} />
            Sign in with GitHub
          </button>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-6">

        {/* ── Workspace view ── */}
        {view === 'workspace' ? (
          <div className="w-full max-w-[1280px]">
            <DemoWorkspace initialRepoUrl={selectedRepo} />
            <div className="flex justify-center mt-4">
              <button
                onClick={() => { setView('main'); setQuery(''); setSelectedRepo('') }}
                className="text-xs transition-colors"
                style={{ color: 'rgba(255,255,255,0.25)' }}
              >
                ← Back to project selection
              </button>
            </div>
          </div>

        ) : view === 'github' ? (
          <div className="w-full max-w-lg">
            <div className="text-center mb-8">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <GitHubIcon size={26} color="rgba(255,255,255,0.7)" />
              </div>
              <h2 className="text-white font-semibold text-xl mb-1">
                {session ? 'Your Repositories' : 'GitHub Repository'}
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '13px' }}>
                {session ? 'Select a repo to refine' : 'Paste any public GitHub URL'}
              </p>
            </div>

            <div
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}
            >
              <input
                autoFocus
                type="text"
                placeholder={session ? 'Search your repos...' : 'github.com/owner/repository'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-transparent px-4 py-3 text-sm outline-none"
                style={{ color: 'rgba(255,255,255,0.8)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
              />

              <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                {/* Not logged in: show sign-in prompt */}
                {!session && (
                  <div className="px-4 py-4">
                    <button
                      onClick={() => signIn('github')}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
                      style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
                    >
                      <GitHubIcon size={14} />
                      Sign in to see your repos
                    </button>
                    <div className="relative my-3">
                      <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-2 text-[10px]" style={{ color: 'rgba(255,255,255,0.2)', background: '#13111c' }}>or paste a public URL</span>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedRepo(query || 'https://github.com/vercel/next.js')
                        setView('workspace')
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium"
                      style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: 'white' }}
                    >
                      Refine →
                    </button>
                  </div>
                )}

                {/* Logged in: show repos */}
                {session && loadingRepos && (
                  <div className="flex items-center justify-center py-8" style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
                    Loading your repos...
                  </div>
                )}

                {session && !loadingRepos && filteredRepos.map((repo) => (
                  <div
                    key={repo.id}
                    className="flex items-center justify-between px-4 py-3 cursor-pointer transition-colors"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onClick={() => {
                      setSelectedRepo(`https://github.com/${repo.full_name}`)
                      setView('workspace')
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <GitHubIcon size={14} color="rgba(255,255,255,0.35)" />
                      <div className="min-w-0">
                        <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }} className="truncate block">
                          {repo.full_name}
                        </span>
                        {repo.language && (
                          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>{repo.language}</span>
                        )}
                      </div>
                    </div>
                    {repo.private && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}>
                        Private
                      </span>
                    )}
                  </div>
                ))}

                {/* Create new repo (logged in only) */}
                {session && !loadingRepos && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    {!showCreateForm ? (
                      <button
                        onClick={() => setShowCreateForm(true)}
                        className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left"
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(124,58,237,0.08)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div
                          className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                          style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.3)' }}
                        >
                          <span style={{ color: '#a855f7', fontSize: '14px', lineHeight: 1 }}>+</span>
                        </div>
                        <span style={{ fontSize: '13px', color: 'rgba(168,85,247,0.8)' }}>
                          Create new repo in your account
                        </span>
                      </button>
                    ) : createdRepo ? (
                      <div className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <circle cx="8" cy="8" r="7" stroke="#34d399" strokeWidth="1.5"/>
                            <path d="M5 8l2.5 2.5L11 5.5" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span style={{ fontSize: '13px', color: '#34d399' }}>Repo created!</span>
                        </div>
                        <a
                          href={createdRepo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs underline"
                          style={{ color: 'rgba(255,255,255,0.4)' }}
                        >
                          {createdRepo}
                        </a>
                      </div>
                    ) : (
                      <div className="px-4 py-3 flex items-center gap-2">
                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>
                          refineui-
                        </span>
                        <input
                          autoFocus
                          type="text"
                          placeholder="my-project"
                          value={newRepoName}
                          onChange={(e) => setNewRepoName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleCreateRepo()}
                          className="flex-1 bg-transparent outline-none text-sm"
                          style={{ color: 'rgba(255,255,255,0.8)', borderBottom: '1px solid rgba(255,255,255,0.15)' }}
                        />
                        <button
                          onClick={handleCreateRepo}
                          disabled={!newRepoName.trim() || creatingRepo}
                          className="px-3 py-1 rounded-lg text-xs font-medium text-white transition-opacity"
                          style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', opacity: creatingRepo ? 0.6 : 1 }}
                        >
                          {creatingRepo ? 'Creating...' : 'Create'}
                        </button>
                        <button
                          onClick={() => setShowCreateForm(false)}
                          style={{ color: 'rgba(255,255,255,0.2)', fontSize: '18px', lineHeight: 1 }}
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => { setView('main'); setQuery('') }}
              className="mt-4 text-xs transition-colors mx-auto block"
              style={{ color: 'rgba(255,255,255,0.25)' }}
            >
              ← Back
            </button>
          </div>

        ) : (
          /* ── Main command palette ── */
          <div className="w-full max-w-lg">
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(13,12,22,0.95)',
                boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
              }}
            >
              {/* Search input */}
              <input
                autoFocus
                type="text"
                placeholder="What would you like to refine?"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-transparent px-5 py-4 text-sm outline-none"
                style={{
                  color: 'rgba(255,255,255,0.85)',
                  fontSize: '14px',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                }}
              />

              {/* AI suggestions */}
              {!query && (
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '8px 0' }}>
                  {SUGGESTIONS.map((s) => (
                    <div
                      key={s}
                      className="flex items-center gap-3 px-5 py-2.5 cursor-pointer"
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(124,58,237,0.08)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="1.5">
                        <path d="M12 3l1.912 5.813a2 2 0 001.272 1.272L21 12l-5.816 1.916a2 2 0 00-1.272 1.272L12 21l-1.912-5.812a2 2 0 00-1.272-1.272L3 12l5.816-1.915a2 2 0 001.272-1.272L12 3z"/>
                      </svg>
                      <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>{s}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Options */}
              <div style={{ padding: '8px 0' }}>
                {/* GitHub Repository */}
                <div
                  className="flex items-center justify-between px-5 py-3 cursor-pointer"
                  onClick={() => setView('github')}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div className="flex items-center gap-3">
                    <div style={{ color: 'rgba(255,255,255,0.4)', width: 20, display: 'flex', justifyContent: 'center' }}>
                      <GitHubIcon size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>GitHub Repository</div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>
                        {session ? `Signed in as ${session.user?.name ?? 'you'}` : 'Refine any public GitHub repo'}
                      </div>
                    </div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M5.5 3.5L9 7l-3.5 3.5" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                </div>

                {/* Create new project */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '8px', paddingTop: '8px' }}>
                  {!showCreateForm ? (
                    <div
                      className="flex items-center justify-between px-5 py-3 cursor-pointer"
                      onClick={() => session ? setShowCreateForm(true) : signIn('github')}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div className="flex items-center gap-3">
                        <div style={{ color: 'rgba(255,255,255,0.4)', width: 20, display: 'flex', justifyContent: 'center' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M12 4v16M4 12h16" strokeLinecap="round"/>
                          </svg>
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>Create new project</div>
                          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>
                            {session ? 'Automatically creates a repo in your GitHub account' : 'Sign in with GitHub to create a new repo'}
                          </div>
                        </div>
                      </div>
                      {!session && (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M5.5 3.5L9 7l-3.5 3.5" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" strokeLinecap="round"/>
                        </svg>
                      )}
                    </div>
                  ) : createdRepo ? (
                    <div className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <circle cx="8" cy="8" r="7" stroke="#34d399" strokeWidth="1.5"/>
                          <path d="M5 8l2.5 2.5L11 5.5" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span style={{ fontSize: '13px', color: '#34d399' }}>Repo created!</span>
                      </div>
                      <a href={createdRepo} target="_blank" rel="noopener noreferrer" className="text-xs underline" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {createdRepo}
                      </a>
                    </div>
                  ) : (
                    <div className="px-5 py-3 flex items-center gap-3">
                      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)', whiteSpace: 'nowrap' }}>refineui-</span>
                      <input
                        autoFocus
                        type="text"
                        placeholder="project-name"
                        value={newRepoName}
                        onChange={(e) => setNewRepoName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateRepo()}
                        className="flex-1 bg-transparent outline-none text-sm"
                        style={{ color: 'rgba(255,255,255,0.8)', borderBottom: '1px solid rgba(255,255,255,0.15)' }}
                      />
                      <button
                        onClick={handleCreateRepo}
                        disabled={!newRepoName.trim() || creatingRepo}
                        className="px-3 py-1 rounded-lg text-xs font-medium text-white"
                        style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', opacity: creatingRepo ? 0.6 : 1 }}
                      >
                        {creatingRepo ? 'Creating...' : 'Create'}
                      </button>
                      <button onClick={() => setShowCreateForm(false)} style={{ color: 'rgba(255,255,255,0.2)', fontSize: '18px', lineHeight: 1 }}>×</button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <p className="text-center mt-5 text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>
              Works with any public GitHub repository · No account required
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
