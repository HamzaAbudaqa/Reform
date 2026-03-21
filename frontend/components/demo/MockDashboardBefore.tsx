/**
 * MockDashboardBefore — realistic but unpolished.
 * Looks like a real SaaS admin panel built without a design system:
 * light mode, generic blue accents, inconsistent spacing/radius/type.
 */
export default function MockDashboardBefore() {
  return (
    <div className="w-full h-full text-sm font-sans flex flex-col overflow-hidden" style={{ background: '#f3f4f6', fontFamily: 'system-ui, sans-serif' }}>

      {/* Top nav */}
      <div className="flex items-center px-5 gap-6 flex-shrink-0" style={{ height: '52px', background: '#1e40af', borderBottom: '3px solid #1d4ed8' }}>
        <span className="text-white font-bold text-base tracking-tight">ProjectHub</span>
        <div className="flex items-center gap-5 text-blue-200 text-xs">
          {['Dashboard', 'Projects', 'Team', 'Reports', 'Settings'].map((item, i) => (
            <span key={item} className="cursor-pointer" style={{ color: i === 0 ? '#ffffff' : '#93c5fd', borderBottom: i === 0 ? '2px solid white' : 'none', paddingBottom: '2px' }}>
              {item}
            </span>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-blue-200 text-xs">🔔</span>
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-full bg-blue-300 flex items-center justify-center text-blue-900 text-[10px] font-bold">JD</div>
            <span className="text-blue-100 text-xs">John D. ▾</span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <div className="flex-shrink-0 flex flex-col" style={{ width: '190px', background: '#ffffff', borderRight: '1px solid #e5e7eb' }}>
          <div className="px-3 py-3">
            <div className="text-[9px] font-semibold uppercase tracking-wider mb-2 px-2" style={{ color: '#9ca3af' }}>Main</div>
            {[
              { label: '📊  Dashboard', active: true },
              { label: '📁  Projects', active: false },
              { label: '✅  Tasks', active: false },
              { label: '👥  Team', active: false },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center px-2 py-2 rounded mb-0.5 text-xs cursor-pointer"
                style={{
                  background: item.active ? '#eff6ff' : 'transparent',
                  color: item.active ? '#1d4ed8' : '#6b7280',
                  fontWeight: item.active ? 600 : 400,
                  borderLeft: item.active ? '3px solid #1d4ed8' : '3px solid transparent',
                }}
              >
                {item.label}
              </div>
            ))}

            <div className="text-[9px] font-semibold uppercase tracking-wider mt-4 mb-2 px-2" style={{ color: '#9ca3af' }}>Reports</div>
            {['📈  Analytics', '📋  Invoices', '📉  Expenses'].map((label) => (
              <div key={label} className="flex items-center px-2 py-2 rounded mb-0.5 text-xs cursor-pointer" style={{ color: '#6b7280', borderLeft: '3px solid transparent' }}>
                {label}
              </div>
            ))}
          </div>

          <div className="mt-auto p-3 border-t" style={{ borderColor: '#f3f4f6' }}>
            <div className="text-[10px] text-center py-1 px-2 rounded" style={{ background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047' }}>
              ⚠ Free plan — 3/5 projects
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-auto p-5">

          {/* Page header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="font-bold text-gray-800" style={{ fontSize: '20px' }}>Dashboard</h1>
              <p className="text-gray-400 text-xs mt-0.5">Monday, January 15, 2024 · Welcome back John!</p>
            </div>
            <div className="flex gap-2">
              <button className="text-xs px-3 py-1.5 rounded" style={{ background: '#ffffff', border: '1px solid #d1d5db', color: '#374151' }}>
                Export CSV
              </button>
              <button className="text-xs px-3 py-1.5 rounded font-medium" style={{ background: '#1d4ed8', color: 'white' }}>
                + New Project
              </button>
            </div>
          </div>

          {/* Stat cards — inconsistent sizes */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            <div className="p-4 rounded-lg" style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
              <div className="text-xs text-gray-400 mb-1">TOTAL PROJECTS</div>
              <div className="font-bold text-gray-800" style={{ fontSize: '26px' }}>24</div>
              <div className="text-xs mt-1" style={{ color: '#16a34a' }}>↑ 4 this month</div>
            </div>
            <div className="p-3 rounded" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <div className="text-[10px] text-blue-500 font-semibold mb-1">Active Tasks</div>
              <div className="font-extrabold text-blue-700" style={{ fontSize: '28px' }}>138</div>
              <div className="text-[10px] text-blue-400 mt-1">across all projects</div>
            </div>
            <div className="p-4 rounded-2xl" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <div className="text-xs text-gray-500 mb-2">Team Members</div>
              <div className="font-bold" style={{ fontSize: '22px', color: '#15803d' }}>12</div>
            </div>
            <div className="p-4 rounded-lg" style={{ background: '#ffffff', border: '2px solid #f59e0b' }}>
              <div className="text-xs font-bold text-yellow-600 mb-1">⚠ OVERDUE</div>
              <div className="font-bold text-red-500" style={{ fontSize: '26px' }}>7</div>
              <div className="text-xs text-gray-400 mt-1">tasks past due date</div>
            </div>
          </div>

          {/* Projects table */}
          <div className="rounded-lg overflow-hidden mb-4" style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #f3f4f6', background: '#f9fafb' }}>
              <span className="font-semibold text-gray-700 text-sm">Recent Projects</span>
              <a className="text-xs" style={{ color: '#1d4ed8' }}>View all →</a>
            </div>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #f3f4f6', background: '#f9fafb' }}>
                  {['Project Name', 'Status', 'Progress', 'Due Date', 'Team'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9ca3af' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'Website Redesign', status: 'In Progress', pct: 68, due: 'Jan 30', team: 'Design' },
                  { name: 'Mobile App v2', status: 'On Hold', pct: 32, due: 'Feb 15', team: 'Dev' },
                  { name: 'API Integration', status: 'Completed', pct: 100, due: 'Jan 10', team: 'Backend' },
                  { name: 'Marketing Campaign', status: 'Overdue', pct: 45, due: 'Jan 08', team: 'Marketing' },
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f9fafb', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td className="px-4 py-3 text-xs font-medium" style={{ color: '#111827' }}>{row.name}</td>
                    <td className="px-4 py-3">
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-medium" style={{
                        background: row.status === 'Completed' ? '#dcfce7' : row.status === 'In Progress' ? '#dbeafe' : row.status === 'Overdue' ? '#fee2e2' : '#f3f4f6',
                        color: row.status === 'Completed' ? '#166534' : row.status === 'In Progress' ? '#1d4ed8' : row.status === 'Overdue' ? '#dc2626' : '#6b7280',
                      }}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 rounded-full h-1.5" style={{ background: '#e5e7eb' }}>
                          <div className="h-1.5 rounded-full" style={{ width: `${row.pct}%`, background: row.status === 'Overdue' ? '#ef4444' : '#1d4ed8' }} />
                        </div>
                        <span className="text-[10px]" style={{ color: '#9ca3af' }}>{row.pct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[11px]" style={{ color: row.status === 'Overdue' ? '#ef4444' : '#6b7280' }}>{row.due}</td>
                    <td className="px-4 py-3 text-[10px]" style={{ color: '#6b7280' }}>{row.team}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
