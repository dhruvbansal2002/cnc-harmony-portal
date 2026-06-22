import type { CustomerRecord } from '../auth/types'
import { getSupabaseClient } from './supabase'

export const customerSelect = `
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

export interface CustomerFormValues {
  character_name: string
  citizen_id: string
  phone_number: string
  discord_username: string
  notes: string
  status: CustomerRecord['status']
}

interface CustomerMutationPayload {
  character_name: string
  citizen_id: string
  phone_number: string | null
  discord_username: string | null
  notes: string | null
  status: CustomerRecord['status']
  archived_at: string | null
  deleted_at: string | null
}

function normalizeOptionalText(value: string) {
  return value.trim() ? value.trim() : null
}

function sortByCharacterName(customers: CustomerRecord[]) {
  return [...customers].sort((first, second) =>
    first.character_name.localeCompare(second.character_name),
  )
}

function sortArchivedCustomers(customers: CustomerRecord[]) {
  return [...customers].sort((first, second) => {
    const firstArchived = new Date(first.archived_at ?? first.updated_at).getTime()
    const secondArchived = new Date(second.archived_at ?? second.updated_at).getTime()

    if (secondArchived !== firstArchived) {
      return secondArchived - firstArchived
    }

    return first.character_name.localeCompare(second.character_name)
  })
}

function isArchivedCustomer(customer: CustomerRecord) {
  return customer.archived_at !== null || customer.status === 'archived'
}

function toPayload(values: CustomerFormValues): CustomerMutationPayload {
  const characterName = values.character_name.trim()
  const citizenId = values.citizen_id.trim()

  if (!characterName) {
    throw new Error('Character Name is required.')
  }

  if (!citizenId) {
    throw new Error('Citizen ID is required.')
  }

  return {
    character_name: characterName,
    citizen_id: citizenId,
    phone_number: normalizeOptionalText(values.phone_number),
    discord_username: normalizeOptionalText(values.discord_username),
    notes: normalizeOptionalText(values.notes),
    status: values.status,
    archived_at: values.status === 'archived' ? new Date().toISOString() : null,
    deleted_at: null,
  }
}

export function createEmptyCustomerFormValues(): CustomerFormValues {
  return {
    character_name: '',
    citizen_id: '',
    phone_number: '',
    discord_username: '',
    notes: '',
    status: 'active',
  }
}

export function customerToFormValues(customer: CustomerRecord): CustomerFormValues {
  return {
    character_name: customer.character_name,
    citizen_id: customer.citizen_id,
    phone_number: customer.phone_number ?? '',
    discord_username: customer.discord_username ?? '',
    notes: customer.notes ?? '',
    status: customer.status,
  }
}

export function sortCustomers(customers: CustomerRecord[]) {
  const current = customers.filter((customer) => !isArchivedCustomer(customer))
  const archived = customers.filter((customer) => isArchivedCustomer(customer))

  return [...sortByCharacterName(current), ...sortArchivedCustomers(archived)]
}

export function sortCurrentCustomers(customers: CustomerRecord[]) {
  return sortByCharacterName(customers.filter((customer) => !isArchivedCustomer(customer)))
}

export function sortArchivedCustomersOnly(customers: CustomerRecord[]) {
  return sortArchivedCustomers(customers.filter((customer) => isArchivedCustomer(customer)))
}

export async function fetchCustomers() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.from('customers').select(customerSelect).is('deleted_at', null)

  if (error) {
    throw error
  }

  return sortCustomers((data ?? []) as CustomerRecord[])
}

export async function createCustomer(values: CustomerFormValues) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('customers')
    .insert([toPayload(values)] as never[])
    .select(customerSelect)
    .single()

  if (error) {
    throw error
  }

  return data as CustomerRecord
}

export async function updateCustomer(customerId: string, values: CustomerFormValues) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('customers')
    .update(toPayload(values) as never)
    .eq('id', customerId)
    .select(customerSelect)
    .single()

  if (error) {
    throw error
  }

  return data as CustomerRecord
}

export async function archiveCustomer(customerId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('customers')
    .update({
      archived_at: new Date().toISOString(),
      status: 'archived',
    } as never)
    .eq('id', customerId)
    .select(customerSelect)
    .single()

  if (error) {
    throw error
  }

  return data as CustomerRecord
}

export async function restoreCustomer(customerId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('customers')
    .update({
      archived_at: null,
      status: 'active',
    } as never)
    .eq('id', customerId)
    .select(customerSelect)
    .single()

  if (error) {
    throw error
  }

  return data as CustomerRecord
}

export async function softDeleteCustomer(customerId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('customers')
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id', customerId)
    .select(customerSelect)
    .single()

  if (error) {
    throw error
  }

  return data as CustomerRecord
}

