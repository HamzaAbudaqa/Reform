import Link from 'next/link'
import { Zap } from 'lucide-react'

const LINKS = {
  Product: ['Features', 'Demo', 'Changelog', 'Roadmap'],
  Developers: ['Docs', 'API Reference', 'GitHub', 'Status'],
  Company: ['About', 'Blog', 'Careers', 'Contact'],
}

export default function Footer() {
  return (
    <footer className="border-t border-zinc-800/60 bg-zinc-950">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded bg-indigo-500 flex items-center justify-center">
                <Zap size={13} className="text-white" strokeWidth={2.5} />
              </div>
              <span className="font-semibold text-zinc-100 text-sm">RefineUI</span>
            </div>
            <p className="text-zinc-500 text-sm leading-relaxed max-w-[200px]">
              Refactor the UI, not the logic.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([group, items]) => (
            <div key={group}>
              <div className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-4">
                {group}
              </div>
              <ul className="space-y-2.5">
                {items.map((item) => (
                  <li key={item}>
                    <Link
                      href="#"
                      className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
                    >
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-zinc-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-zinc-600 text-xs">© 2024 RefineUI. All rights reserved.</p>
          <div className="flex items-center gap-6">
            {['Privacy', 'Terms', 'Security'].map((item) => (
              <Link
                key={item}
                href="#"
                className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
              >
                {item}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
