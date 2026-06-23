import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
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
        const deadline = Date.now() + CALLBACK_TIMEOUT_MS

        if (authCode) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(authCode)

          if (exchangeError && import.meta.env.DEV) {
            console.warn('[AuthCallbackPage] exchangeCodeForSession failed', exchangeError.message)
          }
        }

        let callbackSession = null
        while (Date.now() < deadline) {
          const { data } = await supabase.auth.getSession()
          callbackSession = data.session

          if (callbackSession) {
            break
          }

          await waitForCallbackRetry()
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

        void refreshAuthState().catch(() => {})

        const authUserId = callbackSession.user.id
        let portalUser: PortalUserRecord | null = null
        while (Date.now() < deadline) {
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

