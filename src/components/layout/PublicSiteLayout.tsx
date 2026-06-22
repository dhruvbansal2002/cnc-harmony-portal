import { Link, NavLink, Outlet } from 'react-router-dom'
import logo from '../../assets/logo.png'
import { publicRouteDefinitions } from '../../routes/navigation'

export function PublicSiteLayout() {
  return (
    <div className="min-h-screen bg-[#04070a] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.08),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(255,255,255,0.05),_transparent_24%),linear-gradient(180deg,_rgba(9,12,16,1)_0%,_rgba(4,7,10,1)_100%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:52px_52px] opacity-35" />

      <div className="relative min-h-screen">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[#05070a]/80 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <img
                alt="Carbon N Chrome logo"
                className="h-10 w-10 shrink-0 rounded-2xl border border-white/10 bg-slate-950/70 object-contain p-1.5 shadow-[0_0_22px_rgba(249,115,22,0.10)] sm:h-11 sm:w-11"
                src={logo}
              />
              <div className="min-w-0">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.32em] text-slate-200/90">
                  CNC Harmony Portal
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Public catalog access without login
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {publicRouteDefinitions.map((item) => (
                <NavLink
                  key={item.path}
                  className={({ isActive }) =>
                    [
                      'rounded-2xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] transition',
                      isActive
                        ? 'border-orange-400/30 bg-[rgba(249,115,22,0.12)] text-orange-100'
                        : 'border-white/10 bg-white/5 text-slate-200 hover:border-orange-400/30 hover:bg-white/10',
                    ].join(' ')
                  }
                  to={item.path}
                >
                  {item.navLabel}
                </NavLink>
              ))}

              <Link
                className="relative z-20 rounded-2xl bg-[linear-gradient(180deg,rgba(249,115,22,0.96)_0%,rgba(194,65,12,0.92)_100%)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-950 transition hover:bg-[linear-gradient(180deg,rgba(251,146,60,0.98)_0%,rgba(249,115,22,0.96)_100%)]"
                to="/login"
              >
                Staff Login
              </Link>
            </div>
          </div>
        </header>

        <main className="relative px-4 py-4 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
