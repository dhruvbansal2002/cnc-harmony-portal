import type { RankRecord } from '../auth/types'
import { getSupabaseClient } from './supabase'

export const rankSelect = `
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
  is_active,
  is_management_rank
`

export const operationalAbilityFields = [
  { key: 'can_tow_repair', label: 'Tow Repair' },
  { key: 'can_customize_vehicle', label: 'Vehicle Customization' },
  { key: 'can_upgrade_vehicle', label: 'Vehicle Upgrade' },
  { key: 'can_sell_harness', label: 'Harness Sales' },
  { key: 'can_train_mechanics', label: 'Mechanic Training' },
  { key: 'can_sell_membership', label: 'Membership Sales' },
] as const

export const portalCapabilityFields = [
  { key: 'can_manage_employees', label: 'Manage Employees' },
  { key: 'can_manage_ranks', label: 'Manage Ranks' },
  { key: 'can_manage_memberships', label: 'Manage Memberships' },
  { key: 'can_manage_prices', label: 'Manage Prices' },
  { key: 'can_manage_service_providers', label: 'Manage Service Providers' },
  { key: 'can_manage_outfit_guide', label: 'Manage Outfit Guide' },
  { key: 'can_manage_store_collaborations', label: 'Manage Store Collaborations' },
  { key: 'can_view_cost_price', label: 'View Cost Price' },
] as const

type RankBooleanField =
  | (typeof operationalAbilityFields)[number]['key']
  | (typeof portalCapabilityFields)[number]['key']

export interface RankFormValues {
  rank_name: string
  display_order: string
  description: string
  responsibilities: string
  hiring_status: RankRecord['hiring_status']
  is_active: boolean
  is_management_rank: boolean
  can_tow_repair: boolean
  can_customize_vehicle: boolean
  can_upgrade_vehicle: boolean
  can_sell_harness: boolean
  can_train_mechanics: boolean
  can_sell_membership: boolean
  can_manage_employees: boolean
  can_manage_ranks: boolean
  can_manage_memberships: boolean
  can_manage_prices: boolean
  can_manage_service_providers: boolean
  can_manage_outfit_guide: boolean
  can_manage_store_collaborations: boolean
  can_view_cost_price: boolean
}

interface RankMutationPayload {
  rank_name: string
  display_order: number
  description: string | null
  responsibilities: string | null
  hiring_status: RankRecord['hiring_status']
  is_active: boolean
  is_management_rank: boolean
  can_tow_repair: boolean
  can_customize_vehicle: boolean
  can_upgrade_vehicle: boolean
  can_sell_harness: boolean
  can_train_mechanics: boolean
  can_sell_membership: boolean
  can_manage_employees: boolean
  can_manage_ranks: boolean
  can_manage_memberships: boolean
  can_manage_prices: boolean
  can_manage_service_providers: boolean
  can_manage_outfit_guide: boolean
  can_manage_store_collaborations: boolean
  can_view_cost_price: boolean
}

const defaultFieldValues: Omit<
  RankFormValues,
  'rank_name' | 'display_order' | 'description' | 'responsibilities'
> = {
  hiring_status: 'closed',
  is_active: true,
  is_management_rank: false,
  can_tow_repair: false,
  can_customize_vehicle: false,
  can_upgrade_vehicle: false,
  can_sell_harness: false,
  can_train_mechanics: false,
  can_sell_membership: false,
  can_manage_employees: false,
  can_manage_ranks: false,
  can_manage_memberships: false,
  can_manage_prices: false,
  can_manage_service_providers: false,
  can_manage_outfit_guide: false,
  can_manage_store_collaborations: false,
  can_view_cost_price: false,
}

function sortByDisplayOrder(ranks: RankRecord[]) {
  return [...ranks].sort((first, second) => {
    if (second.display_order !== first.display_order) {
      return second.display_order - first.display_order
    }

    return first.rank_name.localeCompare(second.rank_name)
  })
}

function toPayload(values: RankFormValues): RankMutationPayload {
  const parsedDisplayOrder = Number.parseInt(values.display_order, 10)

  if (Number.isNaN(parsedDisplayOrder)) {
    throw new Error('Display Order must be a whole number.')
  }

  return {
    rank_name: values.rank_name.trim(),
    display_order: parsedDisplayOrder,
    description: values.description.trim() ? values.description.trim() : null,
    responsibilities: values.responsibilities.trim()
      ? values.responsibilities.trim()
      : null,
    hiring_status: values.hiring_status,
    is_active: values.is_active,
    is_management_rank: values.is_management_rank,
    can_tow_repair: values.can_tow_repair,
    can_customize_vehicle: values.can_customize_vehicle,
    can_upgrade_vehicle: values.can_upgrade_vehicle,
    can_sell_harness: values.can_sell_harness,
    can_train_mechanics: values.can_train_mechanics,
    can_sell_membership: values.can_sell_membership,
    can_manage_employees: values.can_manage_employees,
    can_manage_ranks: values.can_manage_ranks,
    can_manage_memberships: values.can_manage_memberships,
    can_manage_prices: values.can_manage_prices,
    can_manage_service_providers: values.can_manage_service_providers,
    can_manage_outfit_guide: values.can_manage_outfit_guide,
    can_manage_store_collaborations: values.can_manage_store_collaborations,
    can_view_cost_price: values.can_view_cost_price,
  }
}

export function createEmptyRankFormValues(): RankFormValues {
  return {
    rank_name: '',
    display_order: '0',
    description: '',
    responsibilities: '',
    ...defaultFieldValues,
  }
}

export function rankToFormValues(rank: RankRecord): RankFormValues {
  return {
    rank_name: rank.rank_name,
    display_order: String(rank.display_order),
    description: rank.description ?? '',
    responsibilities: rank.responsibilities ?? '',
    hiring_status: rank.hiring_status,
    is_active: rank.is_active,
    is_management_rank: rank.is_management_rank,
    can_tow_repair: rank.can_tow_repair,
    can_customize_vehicle: rank.can_customize_vehicle,
    can_upgrade_vehicle: rank.can_upgrade_vehicle,
    can_sell_harness: rank.can_sell_harness,
    can_train_mechanics: rank.can_train_mechanics,
    can_sell_membership: rank.can_sell_membership,
    can_manage_employees: rank.can_manage_employees,
    can_manage_ranks: rank.can_manage_ranks,
    can_manage_memberships: rank.can_manage_memberships,
    can_manage_prices: rank.can_manage_prices,
    can_manage_service_providers: rank.can_manage_service_providers,
    can_manage_outfit_guide: rank.can_manage_outfit_guide,
    can_manage_store_collaborations: rank.can_manage_store_collaborations,
    can_view_cost_price: rank.can_view_cost_price,
  }
}

export function sortRanks(ranks: RankRecord[]) {
  return sortByDisplayOrder(ranks)
}

export async function fetchRanks() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('ranks')
    .select(rankSelect)
    .is('deleted_at', null)

  if (error) {
    throw error
  }

  return sortByDisplayOrder((data ?? []) as RankRecord[])
}

export async function createRank(values: RankFormValues) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('ranks')
    .insert([toPayload(values)] as never[])
    .select(rankSelect)
    .single()

  if (error) {
    throw error
  }

  return data as RankRecord
}

export async function updateRank(rankId: string, values: RankFormValues) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('ranks')
    .update(toPayload(values) as never)
    .eq('id', rankId)
    .select(rankSelect)
    .single()

  if (error) {
    throw error
  }

  return data as RankRecord
}

export async function archiveRank(rankId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('ranks')
    .update({ archived_at: new Date().toISOString() } as never)
    .eq('id', rankId)
    .select(rankSelect)
    .single()

  if (error) {
    throw error
  }

  return data as RankRecord
}

export async function restoreRank(rankId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('ranks')
    .update({ archived_at: null } as never)
    .eq('id', rankId)
    .select(rankSelect)
    .single()

  if (error) {
    throw error
  }

  return data as RankRecord
}

export async function softDeleteRank(rankId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('ranks')
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id', rankId)
    .select(rankSelect)
    .single()

  if (error) {
    throw error
  }

  return data as RankRecord
}

export function getEnabledFieldLabels(
  rank: RankRecord,
  fields: readonly { key: RankBooleanField; label: string }[],
) {
  return fields
    .filter((field) => rank[field.key])
    .map((field) => field.label)
}
