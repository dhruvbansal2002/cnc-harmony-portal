import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

function AccessBody() {
  const { status, error, portalUser, signOut, session } = useAuth()

  if (status === 'ready') {
    return <Navigate replace to="/" />
  }

  if (!session) {
    return <Navigate replace to="/login" />
  }

  const title =
    status === 'inactive' ? 'Account disabled' : 'Portal access not ready'
  const body =
    status === 'inactive'
      ? 'Your portal account is inactive. Contact management to restore access.'
      : 'Your Supabase Auth session exists, but there is no matching portal authorization record yet.'

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-slate-100">
      <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-cyan-950/30 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/80">
          CNC Harmony
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">{body}</p>

        {portalUser ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300">
            <p className="font-medium text-slate-100">Portal user record found</p>
            <p className="mt-2 font-mono text-xs text-slate-400">{portalUser.email}</p>
          </div>
        ) : null}

        {error ? (
          <p className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            {error}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            onClick={() => void signOut()}
            type="button"
          >
            Sign out
          </button>
        </div>
      </section>
    </main>
  )
}

export function AccessPage() {
  return <AccessBody />
}
