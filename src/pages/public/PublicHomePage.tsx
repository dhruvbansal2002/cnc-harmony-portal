import { Link } from 'react-router-dom'
import logo from '../../assets/logo.png'
import { publicRouteDefinitions } from '../../routes/navigation'

const quickLinks = [
  ...publicRouteDefinitions,
  { path: '/login', navLabel: 'Staff Login' },
]

export function PublicHomePage() {
  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/30 backdrop-blur sm:p-8">
        <div className="flex flex-wrap items-center gap-4">
          <img
            alt="Carbon N Chrome logo"
            className="h-14 w-14 rounded-2xl border border-white/10 bg-slate-950/70 object-contain p-1.5 shadow-[0_0_22px_rgba(249,115,22,0.10)] sm:h-16 sm:w-16"
            src={logo}
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-200/90">
              CNC Harmony Route 68
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              CNC Harmony Route 68
            </h1>
          </div>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Public catalog and shop information for visitors. Staff can sign in through the login
          button when internal access is needed.
        </p>
      </div>

      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-4 shadow-2xl shadow-black/30 backdrop-blur sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-orange-100/80">
              Quick Links
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
              Public catalog pages
            </h2>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {quickLinks.map((item) => (
              <Link
              key={item.path}
              className="group rounded-[1.6rem] border border-white/10 bg-slate-950/70 p-4 transition hover:border-orange-400/30 hover:bg-slate-900"
              to={item.path}
            >
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">
                Quick Link
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-white transition group-hover:text-orange-100">
                  {item.navLabel}
                </h3>
                <span className="text-slate-500 transition group-hover:text-orange-200">-&gt;</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </section>
  )
}
