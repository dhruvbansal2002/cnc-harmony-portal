import type { AuditLogRecord } from '../auth/types'
import { getSupabaseClient } from './supabase'

export const auditLogSelect = `
  id,
  actor_user_id,
  action,
  table_name,
  row_id,
  old_data,
  new_data,
  created_at,
  actor_user:users (
    id,
    email,
    permission_level,
    is_active,
    employee_id,
    customer_id
  )
`

export async function fetchAuditLogs() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('audit_logs')
    .select(auditLogSelect)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as AuditLogRecord[]
}
