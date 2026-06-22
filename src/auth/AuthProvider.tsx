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

    setState((current) => ({
      ...current,
      status: 'loading',
      session,
      authUser: session.user,
      error: null,
    }))

    const { data: portalUserData, error: portalUserError } = await supabase
      .from('users')
      .select(AUTH_USER_SELECT)
      .eq('id', session.user.id)
      .maybeSingle()

    if (!isMountedRef.current) {
      return
    }

    if (portalUserError) {
      setState({
        ...defaultState,
        status: 'signed_out',
        error: portalUserError.message,
      })
      return
    }

    if (!portalUserData) {
      setState({
        ...defaultState,
        status: 'setup',
        session,
        authUser: session.user,
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

    if (portalUser.permission_level === 'employee' && !employee) {
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

    if (portalUser.permission_level === 'customer' && !customer) {
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
    signOut,
    refreshAuthState,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
