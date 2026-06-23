import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase'
import { AuthContext } from './authContext'
import type {
  AccessLevel,
  AuthContextValue,
  AuthState,
  CustomerRecord,
  EmployeeRecord,
  PortalUserRecord,
  RankRecord,
} from './types'

import type { ReactNode } from 'react'

const AUTH_USER_SELECT = 'id,email,permission_level,is_active,employee_id,customer_id'
const EMPLOYEE_SELECT = `
  id,
  character_name,
  citizen_id,
  phone_number,
  discord_username,
  rank_id,
  division,
  hire_date,
  last_promotion_date,
  warnings,
  strike_1,
  strike_2,
  total_bills,
  status,
  created_at,
  updated_at,
  archived_at,
  deleted_at,
  rank:ranks(
    id,
    rank_name,
    display_order,
    description,
    responsibilities,
    can_tow_repair,
    can_customize_vehicle,
    can_upgrade_vehicle,
    can_sell_harness,
    can_train_mechanics,
    can_sell_membership,
    can_manage_employees,
    can_manage_ranks,
    can_manage_memberships,
    can_manage_prices,
    can_manage_service_providers,
    can_manage_outfit_guide,
    can_manage_store_collaborations,
    can_view_cost_price,
    hiring_status,
    created_at,
    updated_at,
    archived_at,
    deleted_at,
    is_active
  )
`
const CUSTOMER_SELECT = `
  id,
  character_name,
  citizen_id,
  phone_number,
  discord_username,
  notes,
  status,
  created_at,
  updated_at,
  archived_at,
  deleted_at
`
const PORTAL_USER_RETRY_ATTEMPTS = 8
const PORTAL_USER_RETRY_DELAY_MS = 250
const DISCORD_EMAIL_MISSING_ERROR = 'Discord did not provide an email. Contact management.'
const DISCORD_PORTAL_ROW_MISSING_ERROR =
  'Discord login succeeded, but portal access row was not created. Contact management.'

const defaultState: AuthState = {
  status: 'loading',
  session: null,
  authUser: null,
  portalUser: null,
  employee: null,
  customer: null,
  accessLevel: null,
  error: null,
}

function hasManagementRank(rank: RankRecord | null) {
  if (!rank) {
    return false
  }

  return rank.is_management_rank
}

function deriveAccessLevel(
  portalUser: PortalUserRecord,
  employee: EmployeeRecord | null,
): AccessLevel {
  if (
    portalUser.permission_level === 'admin' ||
    portalUser.permission_level === 'management' ||
    hasManagementRank(employee?.rank ?? null)
  ) {
    return 'management'
  }

  if (portalUser.permission_level === 'customer') {
    return 'customer'
  }

  return 'employee'
}

function waitForPortalUserRetry() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, PORTAL_USER_RETRY_DELAY_MS)
  })
}

function isDiscordOAuthUser(sessionUser: Session['user']) {
  const provider = sessionUser.app_metadata?.provider
  const identityProviders = sessionUser.identities?.map((identity) => identity.provider)

  return provider === 'discord' || identityProviders?.includes('discord') === true
}

function getAuthDebugPayload(options: {
  sessionUser: Session['user']
  portalUser: PortalUserRecord | null
  employee: EmployeeRecord | null
  status: AuthState['status']
}) {
  return {
    authUserId: options.sessionUser.id,
    provider: options.sessionUser.app_metadata?.provider ?? 'unknown',
    emailPresent: Boolean(options.sessionUser.email),
    permissionLevel: options.portalUser?.permission_level ?? null,
    portalUserEmployeeLink: options.portalUser?.employee_id ? 'linked' : 'missing',
    employeeLinkStatus: options.employee
      ? options.employee.status
      : options.portalUser?.employee_id
        ? 'missing_employee_row'
        : 'not_linked',
    routeDecision:
      options.status === 'setup'
        ? 'access'
        : options.status === 'inactive'
          ? 'access_or_signout'
          : options.portalUser?.permission_level === 'management' ||
              options.portalUser?.permission_level === 'admin'
            ? 'dashboard'
            : options.portalUser?.permission_level === 'employee'
              ? options.portalUser?.employee_id
                ? 'dashboard'
                : 'access'
              : options.portalUser?.permission_level === 'customer'
                ? 'blocked'
                : 'unknown',
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const isMountedRef = useRef(true)
  const [state, setState] = useState<AuthState>(
    isSupabaseConfigured
      ? defaultState
      : {
          ...defaultState,
          status: 'config_missing',
          error:
            'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before using the portal.',
        },
  )

  const syncFromSession = useCallback(async (session: Session | null) => {
    if (!isMountedRef.current) {
      return
    }

    if (!session?.user) {
      setState({
        ...defaultState,
        status: 'signed_out',
      })
      return
    }

    const supabase = getSupabaseClient()

    if (isDiscordOAuthUser(session.user) && !session.user.email) {
      setState({
        ...defaultState,
        status: 'setup',
        session,
        authUser: session.user,
        error: DISCORD_EMAIL_MISSING_ERROR,
      })
      return
    }

    setState((current) => ({
      ...current,
      status: 'loading',
      session,
      authUser: session.user,
      error: null,
    }))

    let portalUserData: PortalUserRecord | null = null
    let portalUserError: { message: string } | null = null

    for (let attempt = 0; attempt < PORTAL_USER_RETRY_ATTEMPTS; attempt += 1) {
      const { data, error } = await supabase
        .from('users')
        .select(AUTH_USER_SELECT)
        .eq('id', session.user.id)
        .maybeSingle()

      portalUserData = data as PortalUserRecord | null
      portalUserError = error

      if (!portalUserError && portalUserData) {
        break
      }

      if (portalUserError) {
        break
      }

      if (attempt < PORTAL_USER_RETRY_ATTEMPTS - 1) {
        await waitForPortalUserRetry()
      }
    }

    if (!isMountedRef.current) {
      return
    }

    if (portalUserError) {
      if (import.meta.env.DEV) {
        console.debug('[AuthProvider] portal user lookup failed', {
          authUserId: session.user.id,
          provider: session.user.app_metadata?.provider ?? 'unknown',
          error: portalUserError.message,
        })
      }

      setState({
        ...defaultState,
        status: 'signed_out',
        error: portalUserError.message,
      })
      return
    }

    if (!portalUserData) {
      if (import.meta.env.DEV) {
        console.debug('[AuthProvider] portal user missing after retry', {
          authUserId: session.user.id,
          provider: session.user.app_metadata?.provider ?? 'unknown',
          emailPresent: Boolean(session.user.email),
        })
      }

      setState({
        ...defaultState,
        status: 'setup',
        session,
        authUser: session.user,
        error: isDiscordOAuthUser(session.user)
          ? (session.user.email
            ? DISCORD_PORTAL_ROW_MISSING_ERROR
            : DISCORD_EMAIL_MISSING_ERROR)
          : null,
      })
      return
    }

    const portalUser = portalUserData as PortalUserRecord

    if (!portalUser.is_active) {
      setState({
        ...defaultState,
        status: 'inactive',
        session,
        authUser: session.user,
        portalUser,
        error: 'This portal account is inactive.',
      })
      return
    }

    const employeePromise = portalUser.employee_id
      ? supabase
          .from('employees')
          .select(EMPLOYEE_SELECT)
          .eq('id', portalUser.employee_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null })

    const customerPromise = portalUser.customer_id
      ? supabase
          .from('customers')
          .select(CUSTOMER_SELECT)
          .eq('id', portalUser.customer_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null })

    const [employeeResult, customerResult] = await Promise.all([
      employeePromise,
      customerPromise,
    ])

    if (!isMountedRef.current) {
      return
    }

    if (employeeResult.error) {
      setState({
        ...defaultState,
        status: 'setup',
        session,
        authUser: session.user,
        portalUser,
        error: employeeResult.error.message,
      })
      return
    }

    if (customerResult.error) {
      setState({
        ...defaultState,
        status: 'setup',
        session,
        authUser: session.user,
        portalUser,
        error: customerResult.error.message,
      })
      return
    }

    const employee = employeeResult.data as EmployeeRecord | null
    const customer = customerResult.data as CustomerRecord | null

    const employeeHasActiveLink =
      employee !== null &&
      employee.archived_at === null &&
      employee.deleted_at === null &&
      employee.status === 'active'

    if (
      portalUser.permission_level === 'employee' &&
      (!portalUser.employee_id || !employeeHasActiveLink)
    ) {
      if (import.meta.env.DEV) {
        console.debug(
          '[AuthProvider] employee verification required',
          getAuthDebugPayload({
            sessionUser: session.user,
            portalUser,
            employee,
            status: 'setup',
          }),
        )
      }

      setState({
        ...defaultState,
        status: 'setup',
        session,
        authUser: session.user,
        portalUser,
        error: null,
      })
      return
    }

    if (
      portalUser.permission_level === 'customer' &&
      (!customer || customer.archived_at !== null || customer.deleted_at !== null || customer.status !== 'active')
    ) {
      setState({
        ...defaultState,
        status: 'setup',
        session,
        authUser: session.user,
        portalUser,
        error: 'This portal user is missing the linked customer profile.',
      })
      return
    }

    const accessLevel = deriveAccessLevel(portalUser, employee)

    if (import.meta.env.DEV) {
      console.debug(
        '[AuthProvider] access resolved',
        getAuthDebugPayload({
          sessionUser: session.user,
          portalUser,
          employee,
          status: 'ready',
        }),
      )
    }

    setState({
      status: 'ready',
      session,
      authUser: session.user,
      portalUser,
      employee,
      customer,
      accessLevel,
      error: null,
    })
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return undefined
    }

    isMountedRef.current = true

    const supabase = getSupabaseClient()

    void supabase.auth.getSession().then(({ data }) => {
      void syncFromSession(data.session)
    })

    const { data: subscriptionData } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        void syncFromSession(session)
      },
    )

    return () => {
      isMountedRef.current = false
      subscriptionData.subscription.unsubscribe()
    }
  }, [syncFromSession])

  const signInWithPassword = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      throw new Error(
        'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before signing in.',
      )
    }

    const supabase = getSupabaseClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      throw error
    }
  }

  const signInWithDiscord = async () => {
    if (!isSupabaseConfigured) {
      throw new Error(
        'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before signing in.',
      )
    }

    const supabase = getSupabaseClient()
    const redirectTo = `${window.location.origin}/auth/callback`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo,
      },
    })

    if (error) {
      throw error
    }
  }

  const signOut = async () => {
    if (!isSupabaseConfigured) {
      return
    }

    const supabase = getSupabaseClient()
    await supabase.auth.signOut()
  }

  const refreshAuthState = async () => {
    if (!isSupabaseConfigured) {
      return
    }

    const supabase = getSupabaseClient()
    const { data } = await supabase.auth.getSession()
    await syncFromSession(data.session)
  }

  const value: AuthContextValue = {
    ...state,
    signInWithPassword,
    signInWithDiscord,
    signOut,
    refreshAuthState,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
