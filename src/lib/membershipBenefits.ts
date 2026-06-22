import type {
  MembershipBenefitRecord,
  MembershipPlanRecord,
  PriceItemRecord,
} from '../auth/types'
import { getSupabaseClient } from './supabase'

export const membershipBenefitSelect = `
  id,
  membership_plan_id,
  price_item_id,
  discount_percent,
  status,
  created_at,
  updated_at,
  archived_at,
  deleted_at,
  membership_plan:membership_plans(
    id,
    plan_name,
    plan_price,
    status,
    archived_at,
    deleted_at
  ),
  price_item:price_items(
    id,
    category,
    item_name,
    common_selling_price,
    status,
    archived_at,
    deleted_at
  )
`

export interface MembershipBenefitFormValues {
  membership_plan_id: string
  price_item_id: string
  discount_percent: string
  status: MembershipBenefitRecord['status']
}

interface MembershipBenefitMutationPayload {
  membership_plan_id: string
  price_item_id: string
  discount_percent: number
  status: MembershipBenefitRecord['status']
  archived_at: string | null
  deleted_at: string | null
}

function parseDiscountPercent(value: string) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    throw new Error('Discount Percent must be a valid number.')
  }

  if (parsed < 0 || parsed > 100) {
    throw new Error('Discount Percent must be between 0 and 100.')
  }

  return parsed
}

function sortByPlanAndItem(membershipBenefits: MembershipBenefitRecord[]) {
  return [...membershipBenefits].sort((first, second) => {
    const firstPlan = first.membership_plan?.plan_name ?? ''
    const secondPlan = second.membership_plan?.plan_name ?? ''

    const planComparison = firstPlan.localeCompare(secondPlan)
    if (planComparison !== 0) {
      return planComparison
    }

    const firstItem = first.price_item?.item_name ?? ''
    const secondItem = second.price_item?.item_name ?? ''

    const itemComparison = firstItem.localeCompare(secondItem)
    if (itemComparison !== 0) {
      return itemComparison
    }

    return Number(second.discount_percent) - Number(first.discount_percent)
  })
}

function sortArchivedBenefits(membershipBenefits: MembershipBenefitRecord[]) {
  return [...membershipBenefits].sort((first, second) => {
    const firstArchived = new Date(first.archived_at ?? first.updated_at).getTime()
    const secondArchived = new Date(second.archived_at ?? second.updated_at).getTime()

    if (secondArchived !== firstArchived) {
      return secondArchived - firstArchived
    }

    return sortByPlanAndItem([first, second])[0].id === first.id ? -1 : 1
  })
}

function isArchivedMembershipBenefit(membershipBenefit: MembershipBenefitRecord) {
  return membershipBenefit.archived_at !== null || membershipBenefit.status === 'archived'
}

function toPayload(values: MembershipBenefitFormValues): MembershipBenefitMutationPayload {
  const membershipPlanId = values.membership_plan_id.trim()
  const priceItemId = values.price_item_id.trim()

  if (!membershipPlanId) {
    throw new Error('Membership Plan is required.')
  }

  if (!priceItemId) {
    throw new Error('Price Item is required.')
  }

  return {
    membership_plan_id: membershipPlanId,
    price_item_id: priceItemId,
    discount_percent: parseDiscountPercent(values.discount_percent),
    status: values.status,
    archived_at: values.status === 'archived' ? new Date().toISOString() : null,
    deleted_at: null,
  }
}

export function createEmptyMembershipBenefitFormValues(): MembershipBenefitFormValues {
  return {
    membership_plan_id: '',
    price_item_id: '',
    discount_percent: '0',
    status: 'active',
  }
}

export function membershipBenefitToFormValues(
  membershipBenefit: MembershipBenefitRecord,
): MembershipBenefitFormValues {
  return {
    membership_plan_id: membershipBenefit.membership_plan_id,
    price_item_id: membershipBenefit.price_item_id,
    discount_percent: String(membershipBenefit.discount_percent),
    status: membershipBenefit.status,
  }
}

export function calculateMemberPrice(
  commonSellingPrice: string | number | null,
  discountPercent: string | number | null,
) {
  const commonPrice = Number(commonSellingPrice)
  const discount = Number(discountPercent)

  if (!Number.isFinite(commonPrice) || !Number.isFinite(discount)) {
    return null
  }

  const memberPrice = commonPrice - (commonPrice * discount) / 100
  return memberPrice < 0 ? 0 : memberPrice
}

export function sortMembershipBenefits(membershipBenefits: MembershipBenefitRecord[]) {
  const current = membershipBenefits.filter((benefit) => !isArchivedMembershipBenefit(benefit))
  const archived = membershipBenefits.filter((benefit) => isArchivedMembershipBenefit(benefit))

  return [...sortByPlanAndItem(current), ...sortArchivedBenefits(archived)]
}

export function sortCurrentMembershipBenefits(membershipBenefits: MembershipBenefitRecord[]) {
  return sortByPlanAndItem(
    membershipBenefits.filter((benefit) => !isArchivedMembershipBenefit(benefit)),
  )
}

export function sortArchivedMembershipBenefitsOnly(
  membershipBenefits: MembershipBenefitRecord[],
) {
  return sortArchivedBenefits(
    membershipBenefits.filter((benefit) => isArchivedMembershipBenefit(benefit)),
  )
}

export async function fetchMembershipBenefits() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('membership_benefits')
    .select(membershipBenefitSelect)
    .is('deleted_at', null)

  if (error) {
    throw error
  }

  return sortMembershipBenefits((data ?? []) as MembershipBenefitRecord[])
}

export async function fetchMembershipBenefitPlans() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('membership_plans')
    .select('id, plan_name, plan_price, status, archived_at, deleted_at')
    .is('deleted_at', null)

  if (error) {
    throw error
  }

  return (data ?? []) as MembershipPlanRecord[]
}

export async function fetchMembershipBenefitPriceItems() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('price_items')
    .select('id, category, item_name, common_selling_price, status, archived_at, deleted_at')
    .is('deleted_at', null)

  if (error) {
    throw error
  }

  return (data ?? []) as PriceItemRecord[]
}

export async function createMembershipBenefit(values: MembershipBenefitFormValues) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('membership_benefits')
    .insert([toPayload(values)] as never[])
    .select(membershipBenefitSelect)
    .single()

  if (error) {
    throw error
  }

  return data as MembershipBenefitRecord
}

export async function updateMembershipBenefit(
  membershipBenefitId: string,
  values: MembershipBenefitFormValues,
) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('membership_benefits')
    .update(toPayload(values) as never)
    .eq('id', membershipBenefitId)
    .select(membershipBenefitSelect)
    .single()

  if (error) {
    throw error
  }

  return data as MembershipBenefitRecord
}

export async function archiveMembershipBenefit(membershipBenefitId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('membership_benefits')
    .update({
      archived_at: new Date().toISOString(),
      status: 'archived',
    } as never)
    .eq('id', membershipBenefitId)
    .select(membershipBenefitSelect)
    .single()

  if (error) {
    throw error
  }

  return data as MembershipBenefitRecord
}

export async function restoreMembershipBenefit(membershipBenefitId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('membership_benefits')
    .update({
      archived_at: null,
      status: 'active',
    } as never)
    .eq('id', membershipBenefitId)
    .select(membershipBenefitSelect)
    .single()

  if (error) {
    throw error
  }

  return data as MembershipBenefitRecord
}

export async function softDeleteMembershipBenefit(membershipBenefitId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('membership_benefits')
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id', membershipBenefitId)
    .select(membershipBenefitSelect)
    .single()

  if (error) {
    throw error
  }

  return data as MembershipBenefitRecord
}
