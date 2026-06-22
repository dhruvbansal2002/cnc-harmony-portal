import type { MembershipPlanRecord } from '../auth/types'
import { getSupabaseClient } from './supabase'

export const membershipPlanSelect = `
  id,
  plan_name,
  plan_price,
  description,
  notes,
  status,
  created_at,
  updated_at,
  archived_at,
  deleted_at
`

export const publicMembershipPlanSelect = `
  id,
  plan_name,
  plan_price,
  description,
  status,
  created_at,
  updated_at,
  archived_at,
  deleted_at
`

export interface MembershipPlanFormValues {
  plan_name: string
  plan_price: string
  description: string
  notes: string
  status: MembershipPlanRecord['status']
}

interface MembershipPlanMutationPayload {
  plan_name: string
  plan_price: number
  description: string | null
  notes: string | null
  status: MembershipPlanRecord['status']
  archived_at: string | null
  deleted_at: string | null
}

function parseNonNegativeMoney(value: string, fieldLabel: string) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldLabel} must be a valid number.`)
  }

  if (parsed < 0) {
    throw new Error(`${fieldLabel} cannot be negative.`)
  }

  return parsed
}

function normalizeOptionalText(value: string) {
  return value.trim() ? value.trim() : null
}

function sortByPriceAndName(membershipPlans: MembershipPlanRecord[]) {
  return [...membershipPlans].sort((first, second) => {
    const firstPrice = Number(first.plan_price)
    const secondPrice = Number(second.plan_price)

    if (secondPrice !== firstPrice) {
      return secondPrice - firstPrice
    }

    return first.plan_name.localeCompare(second.plan_name)
  })
}

function sortArchivedPlans(membershipPlans: MembershipPlanRecord[]) {
  return [...membershipPlans].sort((first, second) => {
    const firstArchived = new Date(first.archived_at ?? first.updated_at).getTime()
    const secondArchived = new Date(second.archived_at ?? second.updated_at).getTime()

    if (secondArchived !== firstArchived) {
      return secondArchived - firstArchived
    }

    return first.plan_name.localeCompare(second.plan_name)
  })
}

function isArchivedMembershipPlan(plan: MembershipPlanRecord) {
  return plan.archived_at !== null || plan.status === 'archived'
}

function toPayload(values: MembershipPlanFormValues): MembershipPlanMutationPayload {
  const planName = values.plan_name.trim()

  if (!planName) {
    throw new Error('Plan Name is required.')
  }

  return {
    plan_name: planName,
    plan_price: parseNonNegativeMoney(values.plan_price, 'Plan Price'),
    description: normalizeOptionalText(values.description),
    notes: normalizeOptionalText(values.notes),
    status: values.status,
    archived_at: values.status === 'archived' ? new Date().toISOString() : null,
    deleted_at: null,
  }
}

export function createEmptyMembershipPlanFormValues(): MembershipPlanFormValues {
  return {
    plan_name: '',
    plan_price: '0.00',
    description: '',
    notes: '',
    status: 'active',
  }
}

export function membershipPlanToFormValues(
  membershipPlan: MembershipPlanRecord,
): MembershipPlanFormValues {
  return {
    plan_name: membershipPlan.plan_name,
    plan_price: String(membershipPlan.plan_price),
    description: membershipPlan.description ?? '',
    notes: membershipPlan.notes ?? '',
    status: membershipPlan.status,
  }
}

export function sortMembershipPlans(membershipPlans: MembershipPlanRecord[]) {
  const current = membershipPlans.filter((plan) => !isArchivedMembershipPlan(plan))
  const archived = membershipPlans.filter((plan) => isArchivedMembershipPlan(plan))

  return [...sortByPriceAndName(current), ...sortArchivedPlans(archived)]
}

export function sortCurrentMembershipPlans(membershipPlans: MembershipPlanRecord[]) {
  return sortByPriceAndName(membershipPlans.filter((plan) => !isArchivedMembershipPlan(plan)))
}

export function sortArchivedMembershipPlansOnly(membershipPlans: MembershipPlanRecord[]) {
  return sortArchivedPlans(membershipPlans.filter((plan) => isArchivedMembershipPlan(plan)))
}

export async function fetchMembershipPlans() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('membership_plans')
    .select(membershipPlanSelect)
    .is('deleted_at', null)

  if (error) {
    throw error
  }

  return sortMembershipPlans((data ?? []) as MembershipPlanRecord[])
}

export async function fetchPublicMembershipPlans() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('membership_plans')
    .select(publicMembershipPlanSelect)
    .is('deleted_at', null)

  if (error) {
    throw error
  }

  return sortMembershipPlans((data ?? []) as MembershipPlanRecord[])
}

export async function createMembershipPlan(values: MembershipPlanFormValues) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('membership_plans')
    .insert([toPayload(values)] as never[])
    .select(membershipPlanSelect)
    .single()

  if (error) {
    throw error
  }

  return data as MembershipPlanRecord
}

export async function updateMembershipPlan(
  membershipPlanId: string,
  values: MembershipPlanFormValues,
) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('membership_plans')
    .update(toPayload(values) as never)
    .eq('id', membershipPlanId)
    .select(membershipPlanSelect)
    .single()

  if (error) {
    throw error
  }

  return data as MembershipPlanRecord
}

export async function archiveMembershipPlan(membershipPlanId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('membership_plans')
    .update({
      archived_at: new Date().toISOString(),
      status: 'archived',
    } as never)
    .eq('id', membershipPlanId)
    .select(membershipPlanSelect)
    .single()

  if (error) {
    throw error
  }

  return data as MembershipPlanRecord
}

export async function restoreMembershipPlan(membershipPlanId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('membership_plans')
    .update({
      archived_at: null,
      status: 'active',
    } as never)
    .eq('id', membershipPlanId)
    .select(membershipPlanSelect)
    .single()

  if (error) {
    throw error
  }

  return data as MembershipPlanRecord
}

export async function softDeleteMembershipPlan(membershipPlanId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('membership_plans')
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id', membershipPlanId)
    .select(membershipPlanSelect)
    .single()

  if (error) {
    throw error
  }

  return data as MembershipPlanRecord
}
