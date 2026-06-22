import { useAuth } from '../../auth/useAuth'

interface ModulePlaceholderPageProps {
  moduleName: string
}

export function ModulePlaceholderPage({ moduleName }: ModulePlaceholderPageProps) {
  const { accessLevel, authUser, employee, customer, portalUser } = useAuth()

  const accessLabel =
    accessLevel === 'management'
      ? 'Management'
      : accessLevel === 'employee'
        ? 'Employee'
        : accessLevel === 'customer'
          ? 'Customer'
          : 'Unknown'

  const displayName =
    employee?.character_name ??
    customer?.character_name ??
    portalUser?.email ??
    authUser?.email ??
    'Current user'

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
            Placeholder
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {moduleName}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            This route is reserved in the portal shell. No CRUD or database loading is active
            here.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-right">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-slate-500">
            Access level
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-100">{accessLabel}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Module name
          </p>
          <p className="mt-2 text-sm font-medium text-slate-100">{moduleName}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Current user
          </p>
          <p className="mt-2 text-sm font-medium text-slate-100">{displayName}</p>
        </div>
      </div>
    </section>
  )
}
