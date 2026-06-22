import type { AccessLevel } from '../auth/types'
import { getSupabaseClient } from './supabase'

type CountFilter =
  | { method: 'eq'; column: string; value: string | number | boolean | null }
  | { method: 'is'; column: string; value: null }

async function countRows(tableName: string, filters: CountFilter[] = []) {
  const supabase = getSupabaseClient()
  let query = supabase.from(tableName).select('id', { head: true, count: 'exact' })

  for (const filter of filters) {
    if (filter.method === 'eq') {
      query = query.eq(filter.column, filter.value as never)
    } else {
      query = query.is(filter.column, filter.value)
    }
  }

  const { count, error } = await query

  if (error) {
    throw error
  }

  return count ?? 0
}

interface ParentPlanVisibilityRow {
  status: 'active' | 'inactive' | 'archived'
  archived_at: string | null
  deleted_at: string | null
}

interface ChildVisibilityRow {
  status: 'active' | 'inactive' | 'archived'
  archived_at: string | null
  deleted_at: string | null
  membership_plan: ParentPlanVisibilityRow | null
}

function isVisibleParentPlan(plan: ParentPlanVisibilityRow | null) {
  return Boolean(plan) && plan?.status === 'active' && plan.archived_at === null && plan.deleted_at === null
}

function isVisibleCustomerChildRow(row: ChildVisibilityRow) {
  return (
    row.status === 'active' &&
    row.archived_at === null &&
    row.deleted_at === null &&
    isVisibleParentPlan(row.membership_plan)
  )
}

export interface InternalDashboardMetrics {
  activeEmployeesCount: number
  exEmployeesCount: number
  activeRanksCount: number
  activeServiceProvidersCount: number
  activeCustomersCount: number
  activeMembershipPlansCount: number
  activeMembershipRecordsCount: number
  activePriceItemsCount: number
  activeStoreCollaborationsCount: number
  activeOutfitGuideItemsCount: number
}

export interface CustomerDashboardMetrics {
  activeMembershipPlansCount: number
  activeCustomerSafeBenefitsCount: number
  activeComplimentaryItemsCount: number
  ownActiveMembershipRecordsCount: number | null
}

export async function fetchInternalDashboardMetrics(): Promise<InternalDashboardMetrics> {
  const [
    activeEmployeesCount,
    exEmployeesCount,
    activeRanksCount,
    activeServiceProvidersCount,
    activeCustomersCount,
    activeMembershipPlansCount,
    activeMembershipRecordsCount,
    activePriceItemsCount,
    activeStoreCollaborationsCount,
    activeOutfitGuideItemsCount,
  ] = await Promise.all([
    countRows('employees', [
      { method: 'eq', column: 'status', value: 'active' },
      { method: 'is', column: 'archived_at', value: null },
      { method: 'is', column: 'deleted_at', value: null },
    ]),
    countRows('ex_employees', [
      { method: 'is', column: 'archived_at', value: null },
      { method: 'is', column: 'deleted_at', value: null },
      { method: 'is', column: 'restored_at', value: null },
    ]),
    countRows('ranks', [
      { method: 'eq', column: 'is_active', value: true },
      { method: 'is', column: 'archived_at', value: null },
      { method: 'is', column: 'deleted_at', value: null },
    ]),
    countRows('management_team', [
      { method: 'eq', column: 'provider_status', value: 'active' },
      { method: 'is', column: 'archived_at', value: null },
      { method: 'is', column: 'deleted_at', value: null },
    ]),
    countRows('customers', [
      { method: 'eq', column: 'status', value: 'active' },
      { method: 'is', column: 'archived_at', value: null },
      { method: 'is', column: 'deleted_at', value: null },
    ]),
    countRows('membership_plans', [
      { method: 'eq', column: 'status', value: 'active' },
      { method: 'is', column: 'archived_at', value: null },
      { method: 'is', column: 'deleted_at', value: null },
    ]),
    countRows('membership_records', [
      { method: 'eq', column: 'status', value: 'active' },
      { method: 'is', column: 'archived_at', value: null },
      { method: 'is', column: 'deleted_at', value: null },
    ]),
    countRows('price_items', [
      { method: 'eq', column: 'status', value: 'active' },
      { method: 'is', column: 'archived_at', value: null },
      { method: 'is', column: 'deleted_at', value: null },
    ]),
    countRows('store_collaborations', [
      { method: 'eq', column: 'status', value: 'active' },
      { method: 'is', column: 'archived_at', value: null },
      { method: 'is', column: 'deleted_at', value: null },
    ]),
    countRows('outfit_guide', [
      { method: 'eq', column: 'status', value: 'active' },
      { method: 'is', column: 'archived_at', value: null },
      { method: 'is', column: 'deleted_at', value: null },
    ]),
  ])

  return {
    activeEmployeesCount,
    exEmployeesCount,
    activeRanksCount,
    activeServiceProvidersCount,
    activeCustomersCount,
    activeMembershipPlansCount,
    activeMembershipRecordsCount,
    activePriceItemsCount,
    activeStoreCollaborationsCount,
    activeOutfitGuideItemsCount,
  }
}

export async function fetchCustomerDashboardMetrics(customerId: string | null) {
  const [
    activeMembershipPlansCount,
    customerSafeBenefitsRows,
    customerSafeComplimentaryRows,
    ownActiveMembershipRecordsCount,
  ] = await Promise.all([
    countRows('membership_plans', [
      { method: 'eq', column: 'status', value: 'active' },
      { method: 'is', column: 'archived_at', value: null },
      { method: 'is', column: 'deleted_at', value: null },
    ]),
    getSupabaseClient()
      .from('membership_benefits')
      .select(
        'status,archived_at,deleted_at,membership_plan:membership_plans(status,archived_at,deleted_at)',
      ),
    getSupabaseClient()
      .from('membership_complimentary_items')
      .select(
        'status,archived_at,deleted_at,membership_plan:membership_plans(status,archived_at,deleted_at)',
      ),
    customerId
      ? countRows('membership_records', [
          { method: 'eq', column: 'customer_id', value: customerId },
          { method: 'eq', column: 'status', value: 'active' },
          { method: 'is', column: 'archived_at', value: null },
          { method: 'is', column: 'deleted_at', value: null },
        ])
      : Promise.resolve(null),
  ])

  if (customerSafeBenefitsRows.error) {
    throw customerSafeBenefitsRows.error
  }

  if (customerSafeComplimentaryRows.error) {
    throw customerSafeComplimentaryRows.error
  }

  const activeCustomerSafeBenefitsCount = (customerSafeBenefitsRows.data ?? [])
    .filter((row) => isVisibleCustomerChildRow(row as ChildVisibilityRow)).length

  const activeComplimentaryItemsCount = (customerSafeComplimentaryRows.data ?? [])
    .filter((row) => isVisibleCustomerChildRow(row as ChildVisibilityRow)).length

  return {
    activeMembershipPlansCount,
    activeCustomerSafeBenefitsCount,
    activeComplimentaryItemsCount,
    ownActiveMembershipRecordsCount,
  }
}

export type DashboardAccessLevel = AccessLevel
