import type { ManagementTeamRecord, ProviderStatus } from '../auth/types'
import { getSupabaseClient } from './supabase'

export const providerStatusOptions = [
  'active',
  'inactive',
  'on_leave',
  'under_consideration',
  'archived',
] as const

export const managementTeamSelect = `
  id,
  display_name,
  company_name,
  management_role,
  phone_number,
  discord_username,
  responsibilities,
  provider_status,
  created_at,
  updated_at,
  archived_at,
  deleted_at
`

export interface ManagementProviderFormValues {
  display_name: string
  company_name: string
  management_role: string
  phone_number: string
  discord_username: string
  responsibilities: string
  provider_status: ProviderStatus
}

interface ManagementProviderMutationPayload {
  display_name: string
  company_name: string
  management_role: string
  phone_number: string | null
  discord_username: string | null
  responsibilities: string | null
  provider_status: ProviderStatus
  archived_at: string | null
  deleted_at: string | null
}

function normalizeOptionalText(value: string) {
  return value.trim() ? value.trim() : null
}

function providerStatusPriority(status: ProviderStatus) {
  switch (status) {
    case 'active':
      return 0
    case 'under_consideration':
      return 1
    case 'on_leave':
      return 2
    case 'inactive':
      return 3
    case 'archived':
      return 4
    default:
      return 5
  }
}

function sortByStatusAndName(providers: ManagementTeamRecord[]) {
  return [...providers].sort((first, second) => {
    const firstPriority = providerStatusPriority(first.provider_status)
    const secondPriority = providerStatusPriority(second.provider_status)

    if (firstPriority !== secondPriority) {
      return firstPriority - secondPriority
    }

    return first.display_name.localeCompare(second.display_name)
  })
}

function sortArchivedProviders(providers: ManagementTeamRecord[]) {
  return [...providers].sort((first, second) => {
    const firstArchived = new Date(first.archived_at ?? first.updated_at).getTime()
    const secondArchived = new Date(second.archived_at ?? second.updated_at).getTime()

    if (secondArchived !== firstArchived) {
      return secondArchived - firstArchived
    }

    return first.display_name.localeCompare(second.display_name)
  })
}

function toPayload(values: ManagementProviderFormValues): ManagementProviderMutationPayload {
  const displayName = values.display_name.trim()
  const companyName = values.company_name.trim()
  const managementRole = values.management_role.trim()

  if (!displayName) {
    throw new Error('Display Name is required.')
  }

  if (!companyName) {
    throw new Error('Company Name is required.')
  }

  if (!managementRole) {
    throw new Error('Management Role is required.')
  }

  return {
    display_name: displayName,
    company_name: companyName,
    management_role: managementRole,
    phone_number: normalizeOptionalText(values.phone_number),
    discord_username: normalizeOptionalText(values.discord_username),
    responsibilities: normalizeOptionalText(values.responsibilities),
    provider_status: values.provider_status,
    archived_at: values.provider_status === 'archived' ? new Date().toISOString() : null,
    deleted_at: null,
  }
}

export function createEmptyManagementProviderFormValues(): ManagementProviderFormValues {
  return {
    display_name: '',
    company_name: '',
    management_role: '',
    phone_number: '',
    discord_username: '',
    responsibilities: '',
    provider_status: 'active',
  }
}

export function managementProviderToFormValues(
  provider: ManagementTeamRecord,
): ManagementProviderFormValues {
  return {
    display_name: provider.display_name,
    company_name: provider.company_name,
    management_role: provider.management_role,
    phone_number: provider.phone_number ?? '',
    discord_username: provider.discord_username ?? '',
    responsibilities: provider.responsibilities ?? '',
    provider_status: provider.provider_status,
  }
}

export function isArchivedManagementProvider(provider: ManagementTeamRecord) {
  return provider.archived_at !== null || provider.provider_status === 'archived'
}

export function sortManagementProviders(providers: ManagementTeamRecord[]) {
  const current = providers.filter((provider) => !isArchivedManagementProvider(provider))
  const archived = providers.filter((provider) => isArchivedManagementProvider(provider))

  return [...sortByStatusAndName(current), ...sortArchivedProviders(archived)]
}

export async function fetchManagementProviders() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('management_team')
    .select(managementTeamSelect)
    .is('deleted_at', null)

  if (error) {
    throw error
  }

  return sortManagementProviders((data ?? []) as ManagementTeamRecord[])
}

export async function createManagementProvider(values: ManagementProviderFormValues) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('management_team')
    .insert([toPayload(values)] as never[])
    .select(managementTeamSelect)
    .single()

  if (error) {
    throw error
  }

  return data as ManagementTeamRecord
}

export async function updateManagementProvider(
  providerId: string,
  values: ManagementProviderFormValues,
) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('management_team')
    .update(toPayload(values) as never)
    .eq('id', providerId)
    .select(managementTeamSelect)
    .single()

  if (error) {
    throw error
  }

  return data as ManagementTeamRecord
}

export async function archiveManagementProvider(providerId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('management_team')
    .update({
      archived_at: new Date().toISOString(),
      provider_status: 'archived',
    } as never)
    .eq('id', providerId)
    .select(managementTeamSelect)
    .single()

  if (error) {
    throw error
  }

  return data as ManagementTeamRecord
}

export async function restoreManagementProvider(providerId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('management_team')
    .update({
      archived_at: null,
      provider_status: 'active',
    } as never)
    .eq('id', providerId)
    .select(managementTeamSelect)
    .single()

  if (error) {
    throw error
  }

  return data as ManagementTeamRecord
}

export async function softDeleteManagementProvider(providerId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('management_team')
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id', providerId)
    .select(managementTeamSelect)
    .single()

  if (error) {
    throw error
  }

  return data as ManagementTeamRecord
}
