import { useAuth } from '../../auth/useAuth'
import logo from '../../assets/logo.png'

interface TopbarProps {
  onMenuToggle: () => void
}

export function Topbar({ onMenuToggle }: TopbarProps) {
  const { accessLevel, authUser, employee, customer, portalUser } = useAuth()

  const displayName =
    employee?.character_name ??
    customer?.character_name ??
    portalUser?.email ??
    authUser?.email ??
    'Current user'

  const accessLabel =
    accessLevel === 'management'
      ? 'Management'
      : accessLevel === 'employee'
        ? 'Employee'
        : accessLevel === 'customer'
          ? 'Customer'
          : 'Unknown'

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#05070a]/80 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex items-center gap-4">
        <button
          aria-label="Open navigation"
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm font-semibold text-slate-100 transition hover:border-orange-400/40 hover:bg-white/10 lg:hidden"
          onClick={onMenuToggle}
          type="button"
        >
          Menu
        </button>

        <img
          alt="Carbon N Chrome logo"
          className="hidden h-10 w-10 shrink-0 rounded-2xl border border-white/10 bg-slate-950/70 object-contain p-1.5 shadow-[0_0_18px_rgba(249,115,22,0.08)] sm:block"
          src={logo}
        />

        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold uppercase tracking-[0.32em] text-slate-200/90">
            CNC Harmony Portal
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>{displayName}</span>
            <span className="h-1 w-1 rounded-full bg-slate-600" />
            <span>{accessLabel}</span>
          </div>
        </div>

        <div className="hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right text-sm sm:block">
          <p className="font-medium text-slate-100">{displayName}</p>
          <p className="text-xs text-slate-400">{portalUser?.email ?? authUser?.email}</p>
        </div>
      </div>
    </header>
  )
}
