import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { DiscordAuthButton } from '../components/auth/DiscordAuthButton'
import { useAuth } from '../auth/useAuth'
import { isSupabaseConfigured } from '../lib/supabase'

export function LoginPage() {
  const {
    status,
    session,
    portalUser,
    signInWithPassword,
    signInWithDiscord,
    accessLevel,
  } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === 'ready') {
    if (accessLevel === 'management' || accessLevel === 'employee') {
      if (portalUser?.permission_level === 'employee' && !portalUser.employee_id) {
        return <Navigate replace to="/access" />
      }

      return <Navigate replace to="/dashboard" />
    }

    return <Navigate replace to="/access" />
  }

  if (status === 'setup' || status === 'inactive') {
    return <Navigate replace to="/access" />
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-slate-100">
        <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-cyan-950/30 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/80">
            CNC Harmony
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Supabase environment not configured
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`
            before signing in.
          </p>
        </section>
      </main>
    )
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    try {
      setLoading(true)
      await signInWithPassword(email.trim(), password)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Sign in failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleDiscordLogin = async () => {
    setError(null)

    try {
      setLoading(true)
      await signInWithDiscord()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Discord sign in failed.',
      )
      setLoading(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-slate-100">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-cyan-950/30 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/80">
          CNC Harmony
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Staff Login</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Use Discord for direct staff sign-in, or use your staff email and password below.
          Discord username or character name is asked only after login if verification is needed.
        </p>

        <div className="mt-8 space-y-3">
          <DiscordAuthButton loading={loading} onClick={handleDiscordLogin} />

          <p className="text-center text-xs leading-5 text-slate-400">
            Discord OAuth is for staff access only.
          </p>
        </div>

        <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
          <span className="h-px flex-1 bg-white/10" />
          <span>Or</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Staff Email</span>
            <input
              autoComplete="email"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
              disabled={loading}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="staff@example.com"
              type="email"
              value={email}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Password</span>
            <input
              autoComplete="current-password"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
              disabled={loading}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
              type="password"
              value={password}
            />
          </label>

          {error ? (
            <p className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </p>
          ) : null}

          <button
            className="w-full rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            disabled={loading}
            type="submit"
          >
            {loading ? 'Signing in...' : 'Sign in with Email'}
          </button>
        </form>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-slate-400">New staff account?</span>
          <Link
            className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-2 font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-slate-900"
            to="/signup"
          >
            Create Staff Account
          </Link>
        </div>

        {session ? (
          <p className="mt-4 text-xs text-slate-400">
            Session already loaded. Redirecting to portal.
          </p>
        ) : null}
      </section>
    </main>
  )
}
