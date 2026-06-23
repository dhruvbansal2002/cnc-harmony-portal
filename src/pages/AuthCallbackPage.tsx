import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase'

type CallbackState = 'loading' | 'ready' | 'error'
const CALLBACK_SESSION_RETRY_ATTEMPTS = 6
const CALLBACK_SESSION_RETRY_DELAY_MS = 250

function waitForCallbackSessionRetry() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, CALLBACK_SESSION_RETRY_DELAY_MS)
  })
}

export function AuthCallbackPage() {
  const { status, session, portalUser, accessLevel, refreshAuthState, error } = useAuth()
  const [callbackState, setCallbackState] = useState<CallbackState>('loading')
  const [callbackError, setCallbackError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function handleCallback() {
      if (!isSupabaseConfigured) {
        if (active) {
          setCallbackError('Supabase environment not configured.')
          setCallbackState('error')
        }
        return
      }

      try {
        const supabase = getSupabaseClient()
        const currentUrl = window.location.href
        const callbackUrl = new URL(currentUrl)
        const authCode = callbackUrl.searchParams.get('code')


        let callbackSession = null

        if (authCode) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
            authCode,
          )

          if (exchangeError) {
            throw exchangeError
          }
        }

        for (let attempt = 0; attempt < CALLBACK_SESSION_RETRY_ATTEMPTS; attempt += 1) {
          const { data } = await supabase.auth.getSession()
          callbackSession = data.session

          if (callbackSession) {
            break
          }

          if (attempt < CALLBACK_SESSION_RETRY_ATTEMPTS - 1) {
            await waitForCallbackSessionRetry()
          }
        }

        await refreshAuthState()

        if (!callbackSession && authCode) {
          if (active) {
            setCallbackError(
              'Discord login succeeded, but portal access row was not created. Contact management.',
            )
            setCallbackState('error')
          }
          return
        }

        if (active) {
          setCallbackState('ready')
        }
      } catch (caughtError) {
        if (active) {
          setCallbackError(
            caughtError instanceof Error ? caughtError.message : 'Discord sign-in failed.',
          )
          setCallbackState('error')
        }
      }
    }

    void handleCallback()

    return () => {
      active = false
    }
  }, [refreshAuthState])

  if (callbackState === 'error') {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-slate-100">
        <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-cyan-950/30 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/80">
            CNC Harmony
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Discord sign-in could not complete
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            {callbackError ?? error ?? 'Discord login succeeded, but portal access could not load.'}
          </p>
        </section>
      </main>
    )
  }

  if (callbackState === 'loading' || status === 'loading') {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-slate-100">
        <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-cyan-950/30 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/80">
            CNC Harmony
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Finalizing Discord login</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Checking Supabase session and portal authorization.
          </p>
        </section>
      </main>
    )
  }

  if (status === 'ready') {
    if (portalUser?.permission_level === 'management' || accessLevel === 'management') {
      return <Navigate replace to="/dashboard" />
    }

    if (portalUser?.permission_level === 'employee') {
      return portalUser.employee_id ? (
        <Navigate replace to="/dashboard" />
      ) : (
        <Navigate replace to="/access" />
      )
    }

    return <Navigate replace to="/access" />
  }

  if (status === 'setup' || status === 'inactive') {
    return <Navigate replace to="/access" />
  }

  if (!session) {
    return <Navigate replace to="/login" />
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-slate-100">
      <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-cyan-950/30 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/80">
          CNC Harmony
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Finalizing Discord login</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Checking Supabase session and portal authorization.
        </p>
      </section>
    </main>
  )
}

