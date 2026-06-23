import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { useAuth } from '../auth/useAuth'
import type { EmployeeRecord, PortalUserRecord } from '../auth/types'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase'

type CallbackOutcome =
  | { kind: 'loading' }
  | { kind: 'login'; message: string }
  | { kind: 'access'; message: string | null }
  | { kind: 'dashboard' }
  | { kind: 'error'; message: string }

const CALLBACK_TIMEOUT_MS = 4000
const CALLBACK_SESSION_WAIT_MS = 7000
const CALLBACK_RETRY_DELAY_MS = 250
const AUTH_USER_SELECT = 'id,email,permission_level,is_active,employee_id,customer_id'
const EMPLOYEE_SELECT = 'id,status,archived_at,deleted_at'
const DISCORD_EMAIL_MISSING_ERROR = 'Discord did not provide an email. Contact management.'
const DISCORD_PORTAL_ROW_MISSING_ERROR =
  'Discord login succeeded, but portal access row was not created. Contact management.'
const DISCORD_SESSION_MISSING_ERROR =
  'Discord login did not complete. Please sign in again.'

function waitForCallbackRetry() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, CALLBACK_RETRY_DELAY_MS)
  })
}

async function waitForSessionFromAuthState(
  supabase: ReturnType<typeof getSupabaseClient>,
  timeoutMs: number,
): Promise<Session | null> {
  const deadline = Date.now() + timeoutMs

  const initialSession = await supabase.auth.getSession()
  if (initialSession.data.session) {
    return initialSession.data.session
  }

  return await new Promise((resolve) => {
    const subscription = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        subscription.data.subscription.unsubscribe()
        resolve(session)
      }
    })

    const poll = async () => {
      while (Date.now() < deadline) {
        const { data } = await supabase.auth.getSession()

        if (data.session) {
          subscription.data.subscription.unsubscribe()
          resolve(data.session)
          return
        }

        await waitForCallbackRetry()
      }

      subscription.data.subscription.unsubscribe()
      resolve(null)
    }

    void poll()
  })
}

export function AuthCallbackPage() {
  const { refreshAuthState } = useAuth()
  const [outcome, setOutcome] = useState<CallbackOutcome>({ kind: 'loading' })

  useEffect(() => {
    let active = true

    async function handleCallback() {
      if (!isSupabaseConfigured) {
        if (active) {
          setOutcome({
            kind: 'error',
            message: 'Supabase environment not configured.',
          })
        }
        return
      }

      try {
        const supabase = getSupabaseClient()
        const currentUrl = window.location.href
        const callbackUrl = new URL(currentUrl)
        const authCode = callbackUrl.searchParams.get('code')
        const hasOAuthCallbackPayload =
          callbackUrl.searchParams.has('code') ||
          callbackUrl.searchParams.has('error') ||
          callbackUrl.searchParams.has('access_token') ||
          callbackUrl.searchParams.has('refresh_token') ||
          callbackUrl.hash.includes('access_token') ||
          callbackUrl.hash.includes('refresh_token')

        if (authCode) {
          await waitForCallbackRetry()
        }

        let callbackSession = await waitForSessionFromAuthState(
          supabase,
          hasOAuthCallbackPayload ? CALLBACK_SESSION_WAIT_MS : CALLBACK_TIMEOUT_MS,
        )

        if (!callbackSession && authCode) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(authCode)

          if (exchangeError && import.meta.env.DEV) {
            console.warn('[AuthCallbackPage] exchangeCodeForSession failed', exchangeError.message)
          }

          callbackSession = await waitForSessionFromAuthState(supabase, CALLBACK_TIMEOUT_MS)
        }

        if (!callbackSession?.user) {
          if (active) {
            setOutcome({
              kind: 'login',
              message: authCode
                ? DISCORD_SESSION_MISSING_ERROR
                : 'Your staff session could not be restored. Sign in again.',
            })
          }
          return
        }

        await refreshAuthState()

        const authUserId = callbackSession.user.id
        let portalUser: PortalUserRecord | null = null
        const portalDeadline = Date.now() + CALLBACK_TIMEOUT_MS
        while (Date.now() < portalDeadline) {
          const { data, error } = await supabase
            .from('users')
            .select(AUTH_USER_SELECT)
            .eq('id', authUserId)
            .maybeSingle()

          if (error) {
            if (active) {
              setOutcome({
                kind: 'error',
                message: error.message,
              })
            }
            return
          }

          portalUser = data

          if (portalUser) {
            break
          }

          await waitForCallbackRetry()
        }

        if (!portalUser) {
          if (active) {
            setOutcome({
              kind: 'access',
              message: authCode
                ? DISCORD_PORTAL_ROW_MISSING_ERROR
                : DISCORD_EMAIL_MISSING_ERROR,
            })
          }
          return
        }

        const resolvedPortalUser = portalUser as PortalUserRecord

        if (!resolvedPortalUser.is_active) {
          if (active) {
            setOutcome({
              kind: 'access',
              message: 'This portal account is inactive. Contact management.',
            })
          }
          return
        }

        if (resolvedPortalUser.permission_level === 'customer') {
          if (active) {
            setOutcome({
              kind: 'access',
              message: 'This portal account is not approved for staff access. Contact management.',
            })
          }
          return
        }

        if (resolvedPortalUser.permission_level === 'employee') {
          if (!resolvedPortalUser.employee_id) {
            if (active) {
              setOutcome({
                kind: 'access',
                message: 'Employee verification is required before entering the portal.',
              })
            }
            return
          }

          const { data: employeeData, error: employeeError } = await supabase
            .from('employees')
            .select(EMPLOYEE_SELECT)
            .eq('id', resolvedPortalUser.employee_id)
            .maybeSingle()
          const employeeRecord = employeeData as
            | Pick<EmployeeRecord, 'status' | 'archived_at' | 'deleted_at'>
            | null

          if (employeeError) {
            if (active) {
              setOutcome({
                kind: 'access',
                message: employeeError.message,
              })
            }
            return
          }

          if (
            !employeeRecord ||
            employeeRecord.archived_at !== null ||
            employeeRecord.deleted_at !== null ||
            employeeRecord.status !== 'active'
          ) {
            if (active) {
              setOutcome({
                kind: 'access',
                message: 'Your linked employee record is not active. Contact management.',
              })
            }
            return
          }
        }

        if (active) {
          setOutcome({
            kind: 'dashboard',
          })
        }
      } catch (caughtError) {
        if (active) {
          setOutcome({
            kind: 'error',
            message: caughtError instanceof Error ? caughtError.message : 'Discord sign-in failed.',
          })
        }
      }
    }

    void handleCallback()

    return () => {
      active = false
    }
  }, [refreshAuthState])

  if (outcome.kind === 'dashboard') {
    return <Navigate replace to="/dashboard" />
  }

  if (outcome.kind === 'access') {
    return <Navigate replace to="/access" state={{ portalAccessMessage: outcome.message }} />
  }

  if (outcome.kind === 'login') {
    return <Navigate replace to="/login" state={{ portalAuthMessage: outcome.message }} />
  }

  if (outcome.kind === 'error') {
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
            {outcome.message}
          </p>
          <div className="mt-6">
            <Link
              className="inline-flex rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-slate-900"
              to="/login"
            >
              Back to Staff Login
            </Link>
          </div>
        </section>
      </main>
    )
  }

  if (outcome.kind === 'loading') {
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
}

