import type { PriceItemRecord } from '../auth/types'
import { getSupabaseClient } from './supabase'

export const priceItemSelect = `
  id,
  category,
  item_name,
  item_cost,
  common_selling_price,
  government_selling_price,
  status,
  created_at,
  updated_at,
  archived_at,
  deleted_at
`

export const publicPriceItemSelect = `
  id,
  category,
  item_name,
  common_selling_price
`

export interface PriceItemFormValues {
  category: string
  item_name: string
  item_cost: string
  common_selling_price: string
  government_selling_price: string
  status: PriceItemRecord['status']
}

interface PriceItemMutationPayload {
  category: string
  item_name: string
  item_cost: number
  common_selling_price: number
  government_selling_price: number
  status: PriceItemRecord['status']
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

function sortByCategoryAndName(priceItems: PriceItemRecord[]) {
  return [...priceItems].sort((first, second) => {
    const categoryComparison = first.category.localeCompare(second.category)

    if (categoryComparison !== 0) {
      return categoryComparison
    }

    return first.item_name.localeCompare(second.item_name)
  })
}

function sortArchivedPriceItems(priceItems: PriceItemRecord[]) {
  return [...priceItems].sort((first, second) => {
    const firstArchived = new Date(first.archived_at ?? first.updated_at).getTime()
    const secondArchived = new Date(second.archived_at ?? second.updated_at).getTime()

    if (secondArchived !== firstArchived) {
      return secondArchived - firstArchived
    }

    const categoryComparison = first.category.localeCompare(second.category)

    if (categoryComparison !== 0) {
      return categoryComparison
    }

    return first.item_name.localeCompare(second.item_name)
  })
}

function toPayload(values: PriceItemFormValues): PriceItemMutationPayload {
  const category = values.category.trim()
  const itemName = values.item_name.trim()

  if (!category) {
    throw new Error('Category is required.')
  }

  if (!itemName) {
    throw new Error('Item Name is required.')
  }

  return {
    category,
    item_name: itemName,
    item_cost: parseNonNegativeMoney(values.item_cost, 'Item Cost'),
    common_selling_price: parseNonNegativeMoney(
      values.common_selling_price,
      'Common Selling Price',
    ),
    government_selling_price: parseNonNegativeMoney(
      values.government_selling_price,
      'Government Selling Price',
    ),
    status: values.status,
    archived_at: values.status === 'archived' ? new Date().toISOString() : null,
    deleted_at: null,
  }
}

export function createEmptyPriceItemFormValues(): PriceItemFormValues {
  return {
    category: '',
    item_name: '',
    item_cost: '0.00',
    common_selling_price: '0.00',
    government_selling_price: '0.00',
    status: 'active',
  }
}

export function priceItemToFormValues(priceItem: PriceItemRecord): PriceItemFormValues {
  return {
    category: priceItem.category,
    item_name: priceItem.item_name,
    item_cost: String(priceItem.item_cost),
    common_selling_price: String(priceItem.common_selling_price),
    government_selling_price: String(priceItem.government_selling_price),
    status: priceItem.status,
  }
}

export function sortPriceItems(priceItems: PriceItemRecord[]) {
  const current = priceItems.filter(
    (priceItem) => priceItem.archived_at === null && priceItem.status !== 'archived',
  )
  const archived = priceItems.filter(
    (priceItem) => priceItem.archived_at !== null || priceItem.status === 'archived',
  )

  return [...sortByCategoryAndName(current), ...sortArchivedPriceItems(archived)]
}

export function sortCurrentPriceItems(priceItems: PriceItemRecord[]) {
  return sortByCategoryAndName(
    priceItems.filter(
      (priceItem) => priceItem.archived_at === null && priceItem.status !== 'archived',
    ),
  )
}

export function sortArchivedPriceItemsOnly(priceItems: PriceItemRecord[]) {
  return sortArchivedPriceItems(
    priceItems.filter((priceItem) => priceItem.archived_at !== null || priceItem.status === 'archived'),
  )
}

function sortPublicPriceItems(priceItems: PriceItemRecord[]) {
  return sortByCategoryAndName(priceItems)
}

export async function fetchPriceItems() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('price_items')
    .select(priceItemSelect)
    .is('deleted_at', null)

  if (error) {
    throw error
  }

  return sortPriceItems((data ?? []) as PriceItemRecord[])
}

export async function fetchPublicPriceItems() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('price_items')
    .select(publicPriceItemSelect)
    .is('deleted_at', null)

  if (error) {
    throw error
  }

  return sortPublicPriceItems((data ?? []) as PriceItemRecord[])
}

export async function createPriceItem(values: PriceItemFormValues) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('price_items')
    .insert([toPayload(values)] as never[])
    .select(priceItemSelect)
    .single()

  if (error) {
    throw error
  }

  return data as PriceItemRecord
}

export async function updatePriceItem(priceItemId: string, values: PriceItemFormValues) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('price_items')
    .update(toPayload(values) as never)
    .eq('id', priceItemId)
    .select(priceItemSelect)
    .single()

  if (error) {
    throw error
  }

  return data as PriceItemRecord
}

export async function archivePriceItem(priceItemId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('price_items')
    .update({
      archived_at: new Date().toISOString(),
      status: 'archived',
    } as never)
    .eq('id', priceItemId)
    .select(priceItemSelect)
    .single()

  if (error) {
    throw error
  }

  return data as PriceItemRecord
}

export async function restorePriceItem(priceItemId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('price_items')
    .update({
      archived_at: null,
      status: 'active',
    } as never)
    .eq('id', priceItemId)
    .select(priceItemSelect)
    .single()

  if (error) {
    throw error
  }

  return data as PriceItemRecord
}

export async function softDeletePriceItem(priceItemId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('price_items')
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id', priceItemId)
    .select(priceItemSelect)
    .single()

  if (error) {
    throw error
  }

  return data as PriceItemRecord
}
