import type { GenericStatus, StoreCollaborationRecord } from '../auth/types'
import { getSupabaseClient } from './supabase'

export const storeCollaborationSelect = `
  id,
  store_name,
  contact_name,
  phone_number,
  discord_username,
  collaboration_type,
  notes,
  status,
  created_at,
  updated_at,
  archived_at,
  deleted_at
`

export interface StoreCollaborationFormValues {
  store_name: string
  contact_name: string
  phone_number: string
  discord_username: string
  collaboration_type: string
  notes: string
  status: GenericStatus
}

interface StoreCollaborationMutationPayload {
  store_name: string
  contact_name: string | null
  phone_number: string | null
  discord_username: string | null
  collaboration_type: string | null
  notes: string | null
  status: GenericStatus
  archived_at: string | null
  deleted_at: string | null
}

function normalizeOptionalText(value: string) {
  return value.trim() ? value.trim() : null
}

function isArchivedStoreCollaboration(record: StoreCollaborationRecord) {
  return record.archived_at !== null || record.status === 'archived'
}

function statusPriority(status: GenericStatus) {
  switch (status) {
    case 'active':
      return 0
    case 'inactive':
      return 1
    case 'archived':
      return 2
    default:
      return 3
  }
}

function sortByStatusAndName(records: StoreCollaborationRecord[]) {
  return [...records].sort((first, second) => {
    const firstPriority = statusPriority(first.status)
    const secondPriority = statusPriority(second.status)

    if (firstPriority !== secondPriority) {
      return firstPriority - secondPriority
    }

    return first.store_name.localeCompare(second.store_name)
  })
}

function sortArchivedStoreCollaborations(records: StoreCollaborationRecord[]) {
  return [...records].sort((first, second) => {
    const firstArchived = new Date(first.archived_at ?? first.updated_at).getTime()
    const secondArchived = new Date(second.archived_at ?? second.updated_at).getTime()

    if (secondArchived !== firstArchived) {
      return secondArchived - firstArchived
    }

    return first.store_name.localeCompare(second.store_name)
  })
}

function toPayload(values: StoreCollaborationFormValues): StoreCollaborationMutationPayload {
  const storeName = values.store_name.trim()

  if (!storeName) {
    throw new Error('Store Name is required.')
  }

  return {
    store_name: storeName,
    contact_name: normalizeOptionalText(values.contact_name),
    phone_number: normalizeOptionalText(values.phone_number),
    discord_username: normalizeOptionalText(values.discord_username),
    collaboration_type: normalizeOptionalText(values.collaboration_type),
    notes: normalizeOptionalText(values.notes),
    status: values.status,
    archived_at: values.status === 'archived' ? new Date().toISOString() : null,
    deleted_at: null,
  }
}

export function createEmptyStoreCollaborationFormValues(): StoreCollaborationFormValues {
  return {
    store_name: '',
    contact_name: '',
    phone_number: '',
    discord_username: '',
    collaboration_type: '',
    notes: '',
    status: 'active',
  }
}

export function storeCollaborationToFormValues(
  collaboration: StoreCollaborationRecord,
): StoreCollaborationFormValues {
  return {
    store_name: collaboration.store_name,
    contact_name: collaboration.contact_name ?? '',
    phone_number: collaboration.phone_number ?? '',
    discord_username: collaboration.discord_username ?? '',
    collaboration_type: collaboration.collaboration_type ?? '',
    notes: collaboration.notes ?? '',
    status: collaboration.status,
  }
}

export function isStoreCollaborationArchived(collaboration: StoreCollaborationRecord) {
  return isArchivedStoreCollaboration(collaboration)
}

export function sortStoreCollaborations(records: StoreCollaborationRecord[]) {
  const current = records.filter((record) => !isArchivedStoreCollaboration(record))
  const archived = records.filter((record) => isArchivedStoreCollaboration(record))

  return [...sortByStatusAndName(current), ...sortArchivedStoreCollaborations(archived)]
}

export function sortCurrentStoreCollaborations(records: StoreCollaborationRecord[]) {
  return sortByStatusAndName(records.filter((record) => !isArchivedStoreCollaboration(record)))
}

export function sortArchivedStoreCollaborationsOnly(records: StoreCollaborationRecord[]) {
  return sortArchivedStoreCollaborations(
    records.filter((record) => isArchivedStoreCollaboration(record)),
  )
}

export async function fetchStoreCollaborations() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('store_collaborations')
    .select(storeCollaborationSelect)
    .is('deleted_at', null)

  if (error) {
    throw error
  }

  return sortStoreCollaborations((data ?? []) as StoreCollaborationRecord[])
}

export async function createStoreCollaboration(values: StoreCollaborationFormValues) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('store_collaborations')
    .insert([toPayload(values)] as never[])
    .select(storeCollaborationSelect)
    .single()

  if (error) {
    throw error
  }

  return data as StoreCollaborationRecord
}

export async function updateStoreCollaboration(
  collaborationId: string,
  values: StoreCollaborationFormValues,
) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('store_collaborations')
    .update(toPayload(values) as never)
    .eq('id', collaborationId)
    .select(storeCollaborationSelect)
    .single()

  if (error) {
    throw error
  }

  return data as StoreCollaborationRecord
}

export async function archiveStoreCollaboration(collaborationId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('store_collaborations')
    .update({
      archived_at: new Date().toISOString(),
      status: 'archived',
    } as never)
    .eq('id', collaborationId)
    .select(storeCollaborationSelect)
    .single()

  if (error) {
    throw error
  }

  return data as StoreCollaborationRecord
}

export async function restoreStoreCollaboration(collaborationId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('store_collaborations')
    .update({
      archived_at: null,
      status: 'active',
    } as never)
    .eq('id', collaborationId)
    .select(storeCollaborationSelect)
    .single()

  if (error) {
    throw error
  }

  return data as StoreCollaborationRecord
}

export async function softDeleteStoreCollaboration(collaborationId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('store_collaborations')
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id', collaborationId)
    .select(storeCollaborationSelect)
    .single()

  if (error) {
    throw error
  }

  return data as StoreCollaborationRecord
}
