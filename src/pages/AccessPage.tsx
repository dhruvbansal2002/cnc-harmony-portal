import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { getSupabaseClient } from '../lib/supabase'

function AccessBody() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    status,
    error,
    portalUser,
    accessLevel,
    signOut,
    session,
    refreshAuthState,
  } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [loading, setLoading] = useState(false)
  const [verificationError, setVerificationError] = useState<string | null>(null)
  const routeState = location.state as
    | { portalAccessMessage?: string | null }
    | null
    | undefined
  const accessMessage = routeState?.portalAccessMessage ?? null

  const isEmployeeVerification =
    status === 'setup' &&
    portalUser?.permission_level === 'employee' &&
    portalUser.employee_id === null

  if (status === 'ready') {
    if (accessLevel === 'management' || accessLevel === 'employee') {
      return <Navigate replace to="/dashboard" />
    }

    return <Navigate replace to="/" />
  }

  if (!session) {
    return <Navigate replace to="/login" />
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setVerificationError(null)

    const normalizedIdentifier = identifier.trim()

    if (!normalizedIdentifier) {
      setVerificationError('Employee verification value is required.')
      return
    }

    try {
      setLoading(true)
      const supabase = getSupabaseClient()
      const { error: rpcError } = await supabase.rpc(
        'link_current_user_employee' as never,
        { p_identifier: normalizedIdentifier } as never,
      )

      if (rpcError) {
        setVerificationError(rpcError.message)
        return
      }

      await refreshAuthState()
      navigate('/dashboard', { replace: true })
    } catch (caughtError) {
      setVerificationError(
        caughtError instanceof Error ? caughtError.message : 'Employee verification failed.',
      )
    } finally {
      setLoading(false)
    }
  }

  if (isEmployeeVerification) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-slate-100">
        <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-cyan-950/30 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/80">
            CNC Harmony
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Employee Verification</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Enter the exact Discord username or in-city character name from the Employee Sheet to
            link this staff login to your active employee record.
          </p>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Discord username or character name</span>
              <input
                autoComplete="off"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
                disabled={loading}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="Enter your staff identifier"
                type="text"
                value={identifier}
              />
            </label>

            <p className="text-xs leading-5 text-slate-400">
              This must match your Employee Sheet record. We only check active employee records. If
              no match is found, contact management.
            </p>

            {accessMessage ? (
              <p className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                {accessMessage}
              </p>
            ) : null}

            {verificationError ? (
              <p className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                {verificationError}
              </p>
            ) : error ? (
              <p className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                disabled={loading}
                type="submit"
              >
                {loading ? 'Verifying...' : 'Verify and continue'}
              </button>
              <button
                className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-slate-900"
                onClick={() => void signOut()}
                type="button"
              >
                Sign out
              </button>
            </div>
          </form>
        </section>
      </main>
    )
  }

  const title = status === 'inactive' ? 'Account disabled' : 'Portal access not ready'
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

        {accessMessage ? (
          <p className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            {accessMessage}
          </p>
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

