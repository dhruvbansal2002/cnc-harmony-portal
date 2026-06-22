import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase'

export function SignupPage() {
  const { status, session, accessLevel, refreshAuthState } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  if (status === 'ready') {
    if (accessLevel === 'management' || accessLevel === 'employee') {
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
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Staff Account Signup</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` before creating a staff account.
          </p>
        </section>
      </main>
    )
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccessMessage(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    try {
      setLoading(true)
      const supabase = getSupabaseClient()
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      })

      if (signUpError) {
        setError(signUpError.message)
        return
      }

      if (data.session) {
        await refreshAuthState()
        return
      }

      setSuccessMessage(
        'Check your email to confirm your staff account. After login, verify using your Discord username or character name from the Employee Sheet.',
      )
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Signup failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-slate-100">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-cyan-950/30 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/80">
          CNC Harmony
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Staff Account Signup</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Create a staff account with email and password only. After signup, verify using your
          Discord username or character name from the Employee Sheet.
        </p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
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
              autoComplete="new-password"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
              disabled={loading}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Create a password"
              type="password"
              value={password}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Confirm Password</span>
            <input
              autoComplete="new-password"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
              disabled={loading}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm your password"
              type="password"
              value={confirmPassword}
            />
          </label>

          <p className="text-xs leading-5 text-slate-400">
            This creates a basic employee portal account only. Management access is not granted by
            signup.
          </p>

          {error ? (
            <p className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </p>
          ) : null}

          {successMessage ? (
            <p className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
              {successMessage}
            </p>
          ) : null}

          <button
            className="w-full rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            disabled={loading}
            type="submit"
          >
            {loading ? 'Creating account...' : 'Create Staff Account'}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between gap-3 text-sm">
          <Link className="text-slate-300 transition hover:text-cyan-100" to="/login">
            Back to Staff Login
          </Link>
          {session ? (
            <span className="text-xs text-slate-400">Session detected. Redirecting...</span>
          ) : null}
        </div>
      </section>
    </main>
  )
}
