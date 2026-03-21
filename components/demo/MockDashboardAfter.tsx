/**
 * MockDashboardAfter — clean, polished Railway-style UI.
 * Fixes: consistent spacing, clear hierarchy, unified color system,
 * clean typography, consistent components throughout.
 */
export default function MockDashboardAfter() {
  return (
    <div className="w-full h-full bg-zinc-950 text-sm font-sans flex flex-col overflow-hidden">
      {/* Top nav — clean and minimal */}
      <div className="bg-zinc-900 px-5 h-11 flex items-center gap-4 border-b border-zinc-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-indigo-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[9px] font-bold">A</span>
          </div>
          <span className="text-zinc-100 font-medium text-xs">Acme</span>
        </div>

        <div className="h-4 w-px bg-zinc-700 mx-1" />

        <div className="flex items-center gap-0.5">
          {['Overview', 'Users', 'Reports', 'Settings'].map((item) => (
            <span
              key={item}
              className={`text-[11px] px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                item === 'Overview'
                  ? 'bg-zinc-800 text-zinc-100 font-medium'
                  : 'text-zinc-400 hover:text-zinc-300'
              }`}
            >
              {item}
            </span>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button className="text-[11px] px-3 py-1.5 rounded-md bg-indigo-500 hover:bg-indigo-400 text-white font-medium transition-colors">
            New user
          </button>
          <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] text-zinc-300 font-medium">
            J
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — clean and organized */}
        <div className="w-44 bg-zinc-900/40 border-r border-zinc-800/60 p-3 flex-shrink-0 overflow-y-auto">
          <div className="text-zinc-500 text-[9px] font-semibold uppercase tracking-widest mb-2 px-2">
            Navigation
          </div>
          {[
            { label: 'Overview', active: true },
            { label: 'Users', active: false },
            { label: 'Analytics', active: false },
            { label: 'Reports', active: false },
          ].map((item) => (
            <div
              key={item.label}
              className={`text-[11px] px-2 py-1.5 rounded-md mb-0.5 cursor-pointer flex items-center gap-2 transition-colors ${
                item.active
                  ? 'bg-zinc-800 text-zinc-100 font-medium'
                  : 'text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/40'
              }`}
            >
              {item.label}
            </div>
          ))}

          <div className="text-zinc-500 text-[9px] font-semibold uppercase tracking-widest mt-5 mb-2 px-2">
            System
          </div>
          {['Settings', 'Security', 'Help'].map((label) => (
            <div
              key={label}
              className="text-[11px] px-2 py-1.5 rounded-md mb-0.5 text-zinc-400 cursor-pointer hover:text-zinc-300 hover:bg-zinc-800/40 transition-colors"
            >
              {label}
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 p-5 overflow-auto">
          {/* Page header — clean */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="text-zinc-100 font-semibold text-sm">Overview</div>
              <div className="text-zinc-500 text-[10px] mt-0.5">Updated 2 minutes ago</div>
            </div>
            <button className="text-[11px] px-3 py-1.5 rounded-md border border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300 transition-colors">
              Export
            </button>
          </div>

          {/* Stats — consistent grid */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Total users', value: '2,847', change: '+12.5%', up: true },
              { label: 'Revenue', value: '$48k', change: '+8.2%', up: true },
              { label: 'Active sessions', value: '124', change: '-3.1%', up: false },
              { label: 'Conversion', value: '8.7%', change: '+1.4%', up: true },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-3"
              >
                <div className="text-zinc-500 text-[9px] font-medium mb-2">{stat.label}</div>
                <div className="text-zinc-100 font-semibold text-base leading-none">
                  {stat.value}
                </div>
                <div
                  className={`text-[9px] mt-1.5 font-medium ${stat.up ? 'text-emerald-400' : 'text-red-400'}`}
                >
                  {stat.change} vs last month
                </div>
              </div>
            ))}
          </div>

          {/* Table — clean */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-100 font-medium text-[11px]">Recent signups</span>
              <span className="text-indigo-400 text-[10px] cursor-pointer hover:text-indigo-300 transition-colors">
                View all
              </span>
            </div>
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-4 py-2.5 text-left text-zinc-500 font-medium">Name</th>
                  <th className="px-4 py-2.5 text-left text-zinc-500 font-medium">Email</th>
                  <th className="px-4 py-2.5 text-left text-zinc-500 font-medium">Status</th>
                  <th className="px-4 py-2.5 text-left text-zinc-500 font-medium">Joined</th>
                  <th className="px-4 py-2.5 text-left text-zinc-500 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Alice Johnson', 'alice@gmail.com', 'Active', 'Jan 14'],
                  ['Bob Smith', 'bob@company.com', 'Pending', 'Jan 13'],
                  ['Carol Williams', 'carol@example.org', 'Inactive', 'Jan 12'],
                  ['David Martinez', 'david@test.net', 'Active', 'Jan 11'],
                ].map(([name, email, status, date], i) => (
                  <tr key={i} className="border-b border-zinc-800/50 last:border-0">
                    <td className="px-4 py-2.5 text-zinc-200 font-medium">{name}</td>
                    <td className="px-4 py-2.5 text-zinc-500">{email}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${
                          status === 'Active'
                            ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50'
                            : status === 'Pending'
                              ? 'bg-amber-950/60 text-amber-400 border-amber-800/50'
                              : 'bg-zinc-800/60 text-zinc-500 border-zinc-700/50'
                        }`}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-500">{date}</td>
                    <td className="px-4 py-2.5">
                      <button className="text-zinc-400 hover:text-zinc-200 transition-colors mr-3 text-[10px]">
                        Edit
                      </button>
                      <button className="text-zinc-600 hover:text-red-400 transition-colors text-[10px]">
                        Remove
                      </button>
                    </td>
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
