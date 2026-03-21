/**
 * MockDashboardBefore — intentionally poor UI design.
 * Issues baked in: inconsistent spacing, mixed capitalization, random border-radii,
 * different card heights/styles, no color system, poor hierarchy.
 */
export default function MockDashboardBefore() {
  return (
    <div className="w-full h-full bg-[#1a1b2e] text-sm font-sans flex flex-col overflow-hidden">
      {/* Top nav — cramped, mismatched */}
      <div className="bg-[#252741] px-4 py-3 flex items-center gap-5 border-b border-[#373865] flex-shrink-0">
        <span className="text-white font-black text-xl tracking-tight">ACME Admin</span>
        <div className="flex items-center gap-5 ml-2">
          <span className="text-[#aab0d0] text-[11px] uppercase tracking-widest cursor-pointer">Dashboard</span>
          <span className="text-[#aab0d0] text-[11px] uppercase tracking-widest cursor-pointer">Users</span>
          <span className="text-[#aab0d0] text-xs cursor-pointer">REPORTS</span>
          <span className="text-[#aab0d0] text-[10px] cursor-pointer">settings</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button className="bg-green-500 text-white text-[10px] px-2.5 py-1 rounded font-medium">
            + New User
          </button>
          <button className="bg-blue-600 text-white text-[10px] px-2 py-1 font-medium">
            Export
          </button>
          <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold ml-1">
            AD
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — cramped, inconsistent */}
        <div className="w-48 bg-[#1e2035] border-r border-[#373865] p-2 pt-3 flex-shrink-0 overflow-y-auto">
          <div className="text-[#6b7280] text-[9px] uppercase tracking-widest mb-1.5 px-2 font-bold">
            MAIN MENU
          </div>
          <div className="text-white bg-blue-700 px-2 py-1.5 rounded text-[11px] mb-0.5 cursor-pointer">
            📊 Dashboard
          </div>
          <div className="text-[#aab0d0] px-2 py-1 text-[11px] cursor-pointer hover:bg-white/5">
            All Users
          </div>
          <div className="text-[#aab0d0] px-2 py-1.5 text-[11px] cursor-pointer hover:bg-white/5">
            ➕ Add New User
          </div>
          <div className="text-[#aab0d0] px-2 py-1 text-xs cursor-pointer hover:bg-white/5">
            Export Data
          </div>

          <div className="text-[#6b7280] text-[9px] uppercase tracking-widest mt-4 mb-1 px-2 font-bold">
            REPORTS
          </div>
          <div className="text-[#aab0d0] px-2 py-1 text-[11px] cursor-pointer hover:bg-white/5">
            Monthly Report
          </div>
          <div className="text-[#aab0d0] px-2 py-1 text-xs cursor-pointer hover:bg-white/5">
            Weekly Report
          </div>
          <div className="text-[#aab0d0] px-2 py-1.5 text-[11px] cursor-pointer hover:bg-white/5">
            Custom report
          </div>

          <div className="text-[#6b7280] text-[9px] uppercase tracking-widest mt-4 mb-1 px-2 font-bold">
            SYSTEM
          </div>
          <div className="text-[#aab0d0] px-2 py-1 text-xs cursor-pointer hover:bg-white/5">
            Security
          </div>
          <div className="text-[#aab0d0] px-2 py-1 text-[11px] cursor-pointer hover:bg-white/5">
            Profile Settings
          </div>
          <div className="text-[#aab0d0] px-2 py-1.5 text-xs cursor-pointer hover:bg-white/5">
            Help & Docs
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 p-5 overflow-auto bg-[#1a1b2e]">
          {/* Page header — jumbled */}
          <div className="mb-1">
            <span className="text-white text-2xl font-black">DASHBOARD</span>
          </div>
          <div className="text-[#7b80a0] text-[10px] mb-5">
            Last updated: Jan 15, 2024 at 3:45 PM &nbsp;|&nbsp; Welcome back, Admin User!
          </div>

          {/* Stats — inconsistent sizes and styles */}
          <div className="flex gap-3 mb-5 items-start">
            <div className="bg-blue-900 rounded p-3 w-[100px]">
              <div className="text-[#8fa0c0] text-[9px] mb-1">Total Users</div>
              <div className="text-white font-bold text-xl leading-none">2,847</div>
              <div className="text-green-400 text-[9px] mt-1">↑ 12.5% this month</div>
            </div>

            <div className="bg-[#2d2d4e] rounded-2xl p-4 w-[130px]">
              <div className="text-gray-400 text-[9px] font-semibold uppercase tracking-wide">
                REVENUE
              </div>
              <div className="text-yellow-400 font-black text-3xl leading-none mt-1">$48k</div>
              <div className="text-gray-400 text-[9px] mt-1">vs last month</div>
            </div>

            <div className="bg-gray-700 rounded p-2 w-[90px]">
              <div className="text-gray-300 text-[9px] mb-1">Active Sessions</div>
              <div className="text-white font-bold text-lg leading-none">124</div>
            </div>

            <div className="bg-[#1e3a2f] border border-green-800 rounded-3xl p-4 flex-1">
              <div className="text-gray-300 text-[10px]">Conversion Rate</div>
              <div className="text-green-400 font-bold text-2xl mt-1">8.7%</div>
              <div className="text-green-600 text-[9px]">Industry avg is 3.2%</div>
            </div>
          </div>

          {/* Table — poor formatting */}
          <div className="bg-[#252741] rounded overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-600 flex justify-between items-center">
              <span className="text-white font-bold text-sm">Recent Signups</span>
              <button className="text-[10px] text-blue-400 underline">View all users →</button>
            </div>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-gray-500 border-b border-gray-700">
                  <th className="px-4 py-2 text-left font-semibold">NAME</th>
                  <th className="px-4 py-2 text-left font-semibold">EMAIL</th>
                  <th className="px-4 py-2 text-left font-semibold">Status</th>
                  <th className="px-4 py-2 text-left font-semibold">Joined</th>
                  <th className="px-4 py-2 text-left font-semibold">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Alice Johnson', 'alice@gmail.com', 'ACTIVE', 'Jan 14'],
                  ['bob.smith', 'bob.smith@company.com', 'Pending', 'Jan 13'],
                  ['Carol Williams', 'carol@example.org', 'inactive', 'Jan 12'],
                  ['david_m', 'david@test.net', 'ACTIVE', 'Jan 11'],
                ].map(([name, email, status, date], i) => (
                  <tr
                    key={i}
                    className={`border-b border-gray-700/40 ${i % 2 === 1 ? 'bg-[#1e1f35]' : ''}`}
                  >
                    <td className="px-4 py-2.5 text-white">{name}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-[10px]">{email}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                          status === 'ACTIVE'
                            ? 'bg-green-900 text-green-300'
                            : status === 'Pending'
                              ? 'bg-yellow-900 text-yellow-300'
                              : 'bg-red-900 text-red-400'
                        }`}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-[10px]">{date}</td>
                    <td className="px-4 py-2.5">
                      <button className="text-blue-400 text-[9px] underline mr-2">Edit</button>
                      <button className="text-red-500 text-[9px] underline">Del</button>
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
