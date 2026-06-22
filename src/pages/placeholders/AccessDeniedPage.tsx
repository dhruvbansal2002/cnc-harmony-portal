import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { getDefaultPath } from '../../routes/navigation'

interface AccessDeniedPageProps {
  moduleName: string
  requiredAudience: string
}

export function AccessDeniedPage({
  moduleName,
  requiredAudience,
}: AccessDeniedPageProps) {
  const { accessLevel, signOut } = useAuth()

  const accessLabel =
    accessLevel === 'management'
      ? 'Management'
      : accessLevel === 'employee'
        ? 'Employee'
        : accessLevel === 'customer'
          ? 'Customer'
          : 'Unknown'

  const homePath = accessLevel ? getDefaultPath() : '/login'

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
        Access restricted
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        {moduleName}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
        This route is available to {requiredAudience} only. Your current access level is{' '}
        {accessLabel}.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          to={homePath}
        >
          Back to portal
        </Link>
        <button
          className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-slate-900"
          onClick={() => void signOut()}
          type="button"
        >
          Sign out
        </button>
      </div>
    </section>
  )
}
