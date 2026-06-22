import { getSupabaseClient } from './supabase'

export type AnnouncementAudience = 'public' | 'employee' | 'management' | 'all'
export type AnnouncementStatus = 'active' | 'inactive' | 'archived'

export interface AnnouncementRecord {
  id: string
  title: string
  body: string
  audience: AnnouncementAudience
  status: AnnouncementStatus
  created_at: string
  updated_at: string
  archived_at: string | null
  deleted_at: string | null
}

export interface AnnouncementFormValues {
  title: string
  body: string
  audience: AnnouncementAudience
  status: AnnouncementStatus
}

const announcementSelect = `
  id,
  title,
  body,
  audience,
  status,
  created_at,
  updated_at,
  archived_at,
  deleted_at
`

function normalizeOptionalText(value: string) {
  return value.trim()
}

function toPayload(values: AnnouncementFormValues) {
  const title = values.title.trim()
  const body = values.body.trim()

  if (!title) {
    throw new Error('Title is required.')
  }

  if (!body) {
    throw new Error('Body is required.')
  }

  return {
    title,
    body,
    audience: values.audience,
    status: values.status,
    archived_at: values.status === 'archived' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
    deleted_at: null,
  }
}

export function createEmptyAnnouncementFormValues(): AnnouncementFormValues {
  return {
    title: '',
    body: '',
    audience: 'public',
    status: 'active',
  }
}

export function announcementToFormValues(record: AnnouncementRecord): AnnouncementFormValues {
  return {
    title: record.title,
    body: normalizeOptionalText(record.body),
    audience: record.audience,
    status: record.status,
  }
}

export function sortAnnouncements(records: AnnouncementRecord[]) {
  return [...records].sort((first, second) => {
    const firstCreated = new Date(first.created_at).getTime()
    const secondCreated = new Date(second.created_at).getTime()

    if (secondCreated !== firstCreated) {
      return secondCreated - firstCreated
    }

    return first.title.localeCompare(second.title)
  })
}

export async function fetchAnnouncements() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('announcements')
    .select(announcementSelect)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return sortAnnouncements((data ?? []) as AnnouncementRecord[])
}

export async function createAnnouncement(values: AnnouncementFormValues) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('announcements')
    .insert([toPayload(values)] as never[])
    .select(announcementSelect)
    .single()

  if (error) {
    throw error
  }

  return data as AnnouncementRecord
}

export async function updateAnnouncement(
  announcementId: string,
  values: AnnouncementFormValues,
) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('announcements')
    .update(toPayload(values) as never)
    .eq('id', announcementId)
    .select(announcementSelect)
    .single()

  if (error) {
    throw error
  }

  return data as AnnouncementRecord
}

export async function archiveAnnouncement(announcementId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('announcements')
    .update({
      archived_at: new Date().toISOString(),
      status: 'archived',
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', announcementId)
    .select(announcementSelect)
    .single()

  if (error) {
    throw error
  }

  return data as AnnouncementRecord
}

export async function restoreAnnouncement(announcementId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('announcements')
    .update({
      archived_at: null,
      status: 'active',
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', announcementId)
    .select(announcementSelect)
    .single()

  if (error) {
    throw error
  }

  return data as AnnouncementRecord
}

export async function softDeleteAnnouncement(announcementId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('announcements')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', announcementId)
    .select(announcementSelect)
    .single()

  if (error) {
    throw error
  }

  return data as AnnouncementRecord
}
