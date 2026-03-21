/**
 * MockDashboardAfter — Railway canvas / architecture view.
 * Mimics Railway's service node canvas with floating service cards.
 */
export default function MockDashboardAfter() {
  return (
    <div
      className="w-full h-full flex flex-col overflow-hidden"
      style={{ background: '#0f0e17', fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 flex-shrink-0"
        style={{
          height: '42px',
          background: '#13111e',
          borderBottom: '1px solid #1e1c2e',
        }}
      >
        <div className="flex items-center gap-2">
          {/* Railway logo dot */}
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: '#7c3aed' }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="white">
              <circle cx="5" cy="5" r="3" />
            </svg>
          </div>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1" style={{ fontSize: '11px' }}>
            <span style={{ color: '#9ca3af' }}>acme-corp</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M4.5 3L7.5 6L4.5 9" stroke="#4b5563" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <span style={{ color: '#e5e7eb', fontWeight: 500 }}>production</span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 1 }}>
              <path d="M2.5 4L5 6.5L7.5 4" stroke="#6b7280" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>
        </div>

        {/* Tab nav */}
        <div className="flex items-center gap-0.5">
          {['Architecture', 'Observability', 'Logs', 'Settings', 'Share'].map((tab) => (
            <span
              key={tab}
              style={{
                fontSize: '10.5px',
                padding: '3px 8px',
                borderRadius: '6px',
                color: tab === 'Architecture' ? '#e5e7eb' : '#6b7280',
                background: tab === 'Architecture' ? '#1e1c2e' : 'transparent',
                fontWeight: tab === 'Architecture' ? 500 : 400,
                cursor: 'pointer',
              }}
            >
              {tab}
            </span>
          ))}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-full"
            style={{ background: '#7c3aed', border: '2px solid #5b21b6' }}
          />
        </div>
      </div>

      {/* Canvas toolbar */}
      <div
        className="flex items-center justify-between px-4 flex-shrink-0"
        style={{
          height: '36px',
          background: '#11101b',
          borderBottom: '1px solid #1a1826',
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md"
            style={{ background: '#1e1c2e', border: '1px solid #2d2a40', fontSize: '9.5px', color: '#a5b4fc' }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5h6M5 2l3 3-3 3" stroke="#a5b4fc" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <span>1 unapplied change</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            style={{
              fontSize: '10px',
              padding: '3px 10px',
              borderRadius: '6px',
              background: 'transparent',
              border: '1px solid #2d2a40',
              color: '#9ca3af',
              cursor: 'pointer',
            }}
          >
            Details
          </button>
          <button
            style={{
              fontSize: '10px',
              padding: '3px 10px',
              borderRadius: '6px',
              background: '#7c3aed',
              border: '1px solid #6d28d9',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Deploy
          </button>
          <span style={{ fontSize: '9px', color: '#6b7280', marginLeft: 2 }}>⌥↩</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button style={{ fontSize: '10px', padding: '3px 10px', borderRadius: '6px', background: 'transparent', border: '1px solid #2d2a40', color: '#9ca3af' }}>↺ Sync</button>
          <button style={{ fontSize: '10px', padding: '3px 10px', borderRadius: '6px', background: 'transparent', border: '1px solid #2d2a40', color: '#9ca3af' }}>+ Create</button>
        </div>
      </div>

      {/* Canvas area */}
      <div
        className="flex-1 relative overflow-hidden"
        style={{
          background: '#0d0c16',
          backgroundImage: `radial-gradient(circle, #1e1c2e 1px, transparent 1px)`,
          backgroundSize: '28px 28px',
        }}
      >
        {/* Left zoom controls */}
        <div
          className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col gap-1"
          style={{ zIndex: 10 }}
        >
          {['≡', '+', '−', '⤢'].map((icon, i) => (
            <div
              key={i}
              className="w-6 h-6 flex items-center justify-center rounded cursor-pointer"
              style={{
                background: '#13111e',
                border: '1px solid #1e1c2e',
                color: '#6b7280',
                fontSize: '11px',
              }}
            >
              {icon}
            </div>
          ))}
        </div>

        {/* Service cards on canvas */}

        {/* Backend service card */}
        <div
          className="absolute"
          style={{ top: '60px', left: '180px', width: '260px' }}
        >
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: '#13111e',
              border: '1px solid #2d2a40',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            <div className="flex items-center gap-3 px-4 py-3.5">
              {/* GitHub icon */}
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: '#1c1a2e', border: '1px solid #2d2a40' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#e5e7eb">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                </svg>
              </div>
              <div>
                <div className="text-white font-semibold" style={{ fontSize: '14px' }}>backend</div>
              </div>
            </div>

            <div
              style={{ height: '1px', background: '#1e1c2e', margin: '0 16px' }}
            />

            <div className="flex items-center gap-2.5 px-4 py-3">
              {/* Green check */}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="#10b981" strokeWidth="1.5"/>
                <path d="M5 8l2.5 2.5L11 5.5" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{ fontSize: '11.5px', color: '#9ca3af' }}>Just deployed via GitHub</span>
            </div>
          </div>

          {/* Connector line going down */}
          <div className="flex justify-center">
            <div style={{ width: '2px', height: '32px', background: 'linear-gradient(to bottom, #2d2a40, transparent)' }} />
          </div>
        </div>

        {/* Postgres service card */}
        <div
          className="absolute"
          style={{ top: '248px', left: '180px', width: '260px' }}
        >
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: '#13111e',
              border: '1px solid #2d2a40',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            <div className="flex items-center gap-3 px-4 py-3.5">
              {/* PG icon */}
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: '#1c2a3a', border: '1px solid #1e3a5f' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <ellipse cx="12" cy="5" rx="8" ry="3" fill="#3b82f6" opacity="0.8"/>
                  <path d="M4 5v14c0 1.657 3.582 3 8 3s8-1.343 8-3V5" stroke="#3b82f6" strokeWidth="1.5" opacity="0.8"/>
                  <path d="M4 12c0 1.657 3.582 3 8 3s8-1.343 8-3" stroke="#3b82f6" strokeWidth="1.5" opacity="0.6"/>
                </svg>
              </div>
              <div>
                <div className="text-white font-semibold" style={{ fontSize: '14px' }}>postgres</div>
              </div>
              {/* New badge */}
              <div
                className="ml-auto px-2 py-0.5 rounded-md"
                style={{ background: '#1e3a1e', border: '1px solid #166534', fontSize: '9px', color: '#6ee7b7', fontWeight: 500 }}
              >
                New
              </div>
            </div>
          </div>
        </div>

        {/* Redis service card — right side */}
        <div
          className="absolute"
          style={{ top: '140px', left: '500px', width: '220px' }}
        >
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: '#13111e',
              border: '1px solid #2d2a40',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: '#2a1c1c', border: '1px solid #5f1e1e' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 4C6 4 2 6.686 2 10s4 6 10 6 10-2.686 10-6-4-6-10-6z" fill="#ef4444" opacity="0.8"/>
                  <path d="M2 10v4c0 3.314 4 6 10 6s10-2.686 10-6v-4" stroke="#ef4444" strokeWidth="1.5" opacity="0.7"/>
                </svg>
              </div>
              <div>
                <div className="text-white font-semibold" style={{ fontSize: '14px' }}>redis</div>
                <div style={{ fontSize: '10px', color: '#6b7280' }}>In service</div>
              </div>
            </div>
            <div style={{ height: '1px', background: '#1e1c2e', margin: '0 16px' }} />
            <div className="flex items-center gap-2.5 px-4 py-2.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
              <span style={{ fontSize: '11px', color: '#6b7280' }}>Active · 99.9% uptime</span>
            </div>
          </div>
        </div>

        {/* Connection lines between cards (SVG) */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: 1 }}
        >
          {/* backend → redis */}
          <path
            d="M 440 115 C 470 115, 470 175, 500 175"
            stroke="#2d2a40"
            strokeWidth="1.5"
            fill="none"
            strokeDasharray="4 3"
          />
          {/* backend → postgres */}
          <path
            d="M 310 200 C 310 225, 310 240, 310 248"
            stroke="#2d2a40"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      </div>
    </div>
  )
}
