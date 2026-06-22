import type { GenericStatus, OutfitGuideRecord } from '../auth/types'
import { getSupabaseClient } from './supabase'

export const outfitGuideSelect = `
  id,
  title,
  category,
  description,
  image_url,
  status,
  created_at,
  updated_at,
  archived_at,
  deleted_at
`

export interface OutfitGuideFormValues {
  title: string
  category: string
  description: string
  image_url: string
  status: GenericStatus
}

interface OutfitGuideMutationPayload {
  title: string
  category: string | null
  description: string | null
  image_url: string | null
  status: GenericStatus
  archived_at: string | null
  deleted_at: string | null
}

function normalizeOptionalText(value: string) {
  return value.trim() ? value.trim() : null
}

function isArchivedOutfitGuideItem(record: OutfitGuideRecord) {
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

function sortByStatusAndTitle(records: OutfitGuideRecord[]) {
  return [...records].sort((first, second) => {
    const statusComparison = statusPriority(first.status) - statusPriority(second.status)
    if (statusComparison !== 0) {
      return statusComparison
    }

    return first.title.localeCompare(second.title)
  })
}

function sortArchivedOutfitGuideItems(records: OutfitGuideRecord[]) {
  return [...records].sort((first, second) => {
    const firstArchived = new Date(first.archived_at ?? first.updated_at).getTime()
    const secondArchived = new Date(second.archived_at ?? second.updated_at).getTime()

    if (secondArchived !== firstArchived) {
      return secondArchived - firstArchived
    }

    return first.title.localeCompare(second.title)
  })
}

function toPayload(values: OutfitGuideFormValues): OutfitGuideMutationPayload {
  const title = values.title.trim()

  if (!title) {
    throw new Error('Title is required.')
  }

  return {
    title,
    category: normalizeOptionalText(values.category),
    description: normalizeOptionalText(values.description),
    image_url: normalizeOptionalText(values.image_url),
    status: values.status,
    archived_at: values.status === 'archived' ? new Date().toISOString() : null,
    deleted_at: null,
  }
}

export function createEmptyOutfitGuideFormValues(): OutfitGuideFormValues {
  return {
    title: '',
    category: '',
    description: '',
    image_url: '',
    status: 'active',
  }
}

export function outfitGuideToFormValues(record: OutfitGuideRecord): OutfitGuideFormValues {
  return {
    title: record.title,
    category: record.category ?? '',
    description: record.description ?? '',
    image_url: record.image_url ?? '',
    status: record.status,
  }
}

export function isOutfitGuideArchived(record: OutfitGuideRecord) {
  return isArchivedOutfitGuideItem(record)
}

export function sortOutfitGuideItems(records: OutfitGuideRecord[]) {
  const current = records.filter((record) => !isArchivedOutfitGuideItem(record))
  const archived = records.filter((record) => isArchivedOutfitGuideItem(record))

  return [...sortByStatusAndTitle(current), ...sortArchivedOutfitGuideItems(archived)]
}

export function sortCurrentOutfitGuideItems(records: OutfitGuideRecord[]) {
  return sortByStatusAndTitle(records.filter((record) => !isArchivedOutfitGuideItem(record)))
}

export function sortArchivedOutfitGuideItemsOnly(records: OutfitGuideRecord[]) {
  return sortArchivedOutfitGuideItems(records.filter((record) => isArchivedOutfitGuideItem(record)))
}

export async function fetchOutfitGuideItems() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('outfit_guide')
    .select(outfitGuideSelect)
    .is('deleted_at', null)

  if (error) {
    throw error
  }

  return sortOutfitGuideItems((data ?? []) as OutfitGuideRecord[])
}

export async function createOutfitGuideItem(values: OutfitGuideFormValues) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('outfit_guide')
    .insert([toPayload(values)] as never[])
    .select(outfitGuideSelect)
    .single()

  if (error) {
    throw error
  }

  return data as OutfitGuideRecord
}

export async function updateOutfitGuideItem(itemId: string, values: OutfitGuideFormValues) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('outfit_guide')
    .update(toPayload(values) as never)
    .eq('id', itemId)
    .select(outfitGuideSelect)
    .single()

  if (error) {
    throw error
  }

  return data as OutfitGuideRecord
}

export async function archiveOutfitGuideItem(itemId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('outfit_guide')
    .update({
      archived_at: new Date().toISOString(),
      status: 'archived',
    } as never)
    .eq('id', itemId)
    .select(outfitGuideSelect)
    .single()

  if (error) {
    throw error
  }

  return data as OutfitGuideRecord
}

export async function restoreOutfitGuideItem(itemId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('outfit_guide')
    .update({
      archived_at: null,
      status: 'active',
    } as never)
    .eq('id', itemId)
    .select(outfitGuideSelect)
    .single()

  if (error) {
    throw error
  }

  return data as OutfitGuideRecord
}

export async function softDeleteOutfitGuideItem(itemId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('outfit_guide')
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id', itemId)
    .select(outfitGuideSelect)
    .single()

  if (error) {
    throw error
  }

  return data as OutfitGuideRecord
}
