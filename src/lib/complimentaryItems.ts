import type {
  MembershipComplimentaryItemRecord,
  MembershipPlanRecord,
  PriceItemRecord,
} from '../auth/types'
import { getSupabaseClient } from './supabase'

export const complimentaryItemSelect = `
  id,
  membership_plan_id,
  price_item_id,
  quantity,
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

export interface ComplimentaryItemFormValues {
  membership_plan_id: string
  price_item_id: string
  quantity: string
  status: MembershipComplimentaryItemRecord['status']
}

interface ComplimentaryItemMutationPayload {
  membership_plan_id: string
  price_item_id: string
  quantity: number
  status: MembershipComplimentaryItemRecord['status']
  archived_at: string | null
  deleted_at: string | null
}

function parseQuantity(value: string) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new Error('Quantity must be a valid integer.')
  }

  if (parsed <= 0) {
    throw new Error('Quantity must be a positive integer.')
  }

  return parsed
}

function sortByPlanAndItem(items: MembershipComplimentaryItemRecord[]) {
  return [...items].sort((first, second) => {
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

    return Number(second.quantity) - Number(first.quantity)
  })
}

function sortArchivedItems(items: MembershipComplimentaryItemRecord[]) {
  return [...items].sort((first, second) => {
    const firstArchived = new Date(first.archived_at ?? first.updated_at).getTime()
    const secondArchived = new Date(second.archived_at ?? second.updated_at).getTime()

    if (secondArchived !== firstArchived) {
      return secondArchived - firstArchived
    }

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

    return Number(second.quantity) - Number(first.quantity)
  })
}

function isArchivedItem(item: MembershipComplimentaryItemRecord) {
  return item.archived_at !== null || item.status === 'archived'
}

function toPayload(values: ComplimentaryItemFormValues): ComplimentaryItemMutationPayload {
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
    quantity: parseQuantity(values.quantity),
    status: values.status,
    archived_at: values.status === 'archived' ? new Date().toISOString() : null,
    deleted_at: null,
  }
}

export function createEmptyComplimentaryItemFormValues(): ComplimentaryItemFormValues {
  return {
    membership_plan_id: '',
    price_item_id: '',
    quantity: '1',
    status: 'active',
  }
}

export function complimentaryItemToFormValues(
  item: MembershipComplimentaryItemRecord,
): ComplimentaryItemFormValues {
  return {
    membership_plan_id: item.membership_plan_id,
    price_item_id: item.price_item_id,
    quantity: String(item.quantity),
    status: item.status,
  }
}

export function calculateTotalValue(
  commonSellingPrice: string | number | null,
  quantity: string | number | null,
) {
  const itemPrice = Number(commonSellingPrice)
  const itemQuantity = Number(quantity)

  if (!Number.isFinite(itemPrice) || !Number.isFinite(itemQuantity)) {
    return null
  }

  return itemPrice * itemQuantity
}

export function sortComplimentaryItems(items: MembershipComplimentaryItemRecord[]) {
  const current = items.filter((item) => !isArchivedItem(item))
  const archived = items.filter((item) => isArchivedItem(item))

  return [...sortByPlanAndItem(current), ...sortArchivedItems(archived)]
}

export function sortCurrentComplimentaryItems(items: MembershipComplimentaryItemRecord[]) {
  return sortByPlanAndItem(items.filter((item) => !isArchivedItem(item)))
}

export function sortArchivedComplimentaryItemsOnly(
  items: MembershipComplimentaryItemRecord[],
) {
  return sortArchivedItems(items.filter((item) => isArchivedItem(item)))
}

export async function fetchComplimentaryItems() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('membership_complimentary_items')
    .select(complimentaryItemSelect)
    .is('deleted_at', null)

  if (error) {
    throw error
  }

  return sortComplimentaryItems((data ?? []) as MembershipComplimentaryItemRecord[])
}

export async function fetchComplimentaryItemPlans() {
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

export async function fetchComplimentaryItemPriceItems() {
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

export async function createComplimentaryItem(values: ComplimentaryItemFormValues) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('membership_complimentary_items')
    .insert([toPayload(values)] as never[])
    .select(complimentaryItemSelect)
    .single()

  if (error) {
    throw error
  }

  return data as MembershipComplimentaryItemRecord
}

export async function updateComplimentaryItem(
  itemId: string,
  values: ComplimentaryItemFormValues,
) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('membership_complimentary_items')
    .update(toPayload(values) as never)
    .eq('id', itemId)
    .select(complimentaryItemSelect)
    .single()

  if (error) {
    throw error
  }

  return data as MembershipComplimentaryItemRecord
}

export async function archiveComplimentaryItem(itemId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('membership_complimentary_items')
    .update({
      archived_at: new Date().toISOString(),
      status: 'archived',
    } as never)
    .eq('id', itemId)
    .select(complimentaryItemSelect)
    .single()

  if (error) {
    throw error
  }

  return data as MembershipComplimentaryItemRecord
}

export async function restoreComplimentaryItem(itemId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('membership_complimentary_items')
    .update({
      archived_at: null,
      status: 'active',
    } as never)
    .eq('id', itemId)
    .select(complimentaryItemSelect)
    .single()

  if (error) {
    throw error
  }

  return data as MembershipComplimentaryItemRecord
}

export async function softDeleteComplimentaryItem(itemId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('membership_complimentary_items')
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id', itemId)
    .select(complimentaryItemSelect)
    .single()

  if (error) {
    throw error
  }

  return data as MembershipComplimentaryItemRecord
}
