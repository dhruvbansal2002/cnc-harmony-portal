import type { EmployeeRecord, ExEmployeeRecord } from '../auth/types'
import { getSupabaseClient } from './supabase'

export const exEmployeeSelect = `
  id,
  employee_id,
  character_name,
  citizen_id,
  phone_number,
  discord_username,
  rank_name_snapshot,
  division,
  hire_date,
  last_promotion_date,
  leave_date,
  separation_type,
  reason,
  warnings,
  strike_1,
  strike_2,
  total_bills,
  restored_at,
  created_at,
  updated_at,
  archived_at,
  deleted_at
`

export interface ExEmployeeTransferValues {
  separation_type: ExEmployeeRecord['separation_type']
  reason: string
  leave_date: string
}

export interface RestoreExEmployeeResult {
  exEmployee: ExEmployeeRecord
  employee: EmployeeRecord
  rankWarning: string | null
}

interface ExEmployeeMutationPayload {
  employee_id: string | null
  character_name: string
  citizen_id: string
  phone_number: string | null
  discord_username: string | null
  rank_name_snapshot: string
  division: string | null
  hire_date: string
  last_promotion_date: string | null
  leave_date: string
  separation_type: ExEmployeeRecord['separation_type']
  reason: string | null
  warnings: number
  strike_1: boolean
  strike_2: boolean
  total_bills: number
  restored_at: string | null
  archived_at: string | null
  deleted_at: string | null
}

function toIsoToday() {
  return new Date().toISOString().slice(0, 10)
}

function normalizeOptionalText(value: string) {
  return value.trim() ? value.trim() : null
}

function parseWarnings(value: string | number) {
  const parsed = typeof value === 'number' ? value : Number(value)

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error('Warnings must be a whole number greater than or equal to 0.')
  }

  return parsed
}

function parseTotalBills(value: string | number) {
  const parsed = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(parsed)) {
    throw new Error('Total Bills must be a valid number.')
  }

  return parsed
}

function buildTransferPayload(
  employee: EmployeeRecord,
  values: ExEmployeeTransferValues,
): ExEmployeeMutationPayload {
  if (!employee.character_name.trim()) {
    throw new Error('Character Name is required.')
  }

  if (!employee.citizen_id.trim()) {
    throw new Error('Citizen ID is required.')
  }

  if (!values.leave_date.trim()) {
    throw new Error('Leave Date is required.')
  }

  return {
    employee_id: employee.id,
    character_name: employee.character_name.trim(),
    citizen_id: employee.citizen_id.trim(),
    phone_number: normalizeOptionalText(employee.phone_number ?? ''),
    discord_username: normalizeOptionalText(employee.discord_username ?? ''),
    rank_name_snapshot: employee.rank?.rank_name ?? 'Unassigned',
    division: normalizeOptionalText(employee.division ?? ''),
    hire_date: employee.hire_date,
    last_promotion_date: employee.last_promotion_date,
    leave_date: values.leave_date,
    separation_type: values.separation_type,
    reason: normalizeOptionalText(values.reason),
    warnings: parseWarnings(employee.warnings),
    strike_1: employee.strike_1,
    strike_2: employee.strike_2,
    total_bills: parseTotalBills(employee.total_bills),
    restored_at: null,
    archived_at: null,
    deleted_at: null,
  }
}

function buildRestoredEmployeePayload(
  exEmployee: ExEmployeeRecord,
  rankId: string | null,
) {
  return {
    character_name: exEmployee.character_name,
    citizen_id: exEmployee.citizen_id,
    phone_number: exEmployee.phone_number,
    discord_username: exEmployee.discord_username,
    rank_id: rankId,
    division: exEmployee.division,
    hire_date: exEmployee.hire_date,
    last_promotion_date: exEmployee.last_promotion_date,
    warnings: exEmployee.warnings,
    strike_1: exEmployee.strike_1,
    strike_2: exEmployee.strike_2,
    total_bills: exEmployee.total_bills,
    status: 'active' as const,
    archived_at: null,
    deleted_at: null,
  }
}

export function createEmptyExEmployeeTransferValues(): ExEmployeeTransferValues {
  return {
    separation_type: 'resigned',
    reason: '',
    leave_date: toIsoToday(),
  }
}

function sortByLeaveDate(exEmployees: ExEmployeeRecord[]) {
  return [...exEmployees].sort((first, second) => {
    const firstLeave = first.leave_date ? new Date(first.leave_date).getTime() : 0
    const secondLeave = second.leave_date ? new Date(second.leave_date).getTime() : 0

    if (secondLeave !== firstLeave) {
      return secondLeave - firstLeave
    }

    return first.character_name.localeCompare(second.character_name)
  })
}

export function sortExEmployees(exEmployees: ExEmployeeRecord[]) {
  return sortByLeaveDate(exEmployees)
}

export function isRestoredExEmployee(exEmployee: ExEmployeeRecord) {
  return exEmployee.restored_at !== null
}

export async function fetchExEmployees() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('ex_employees')
    .select(exEmployeeSelect)
    .is('deleted_at', null)

  if (error) {
    throw error
  }

  return sortByLeaveDate((data ?? []) as ExEmployeeRecord[])
}

export async function transferEmployeeToExEmployee(
  employee: EmployeeRecord,
  values: ExEmployeeTransferValues,
) {
  const supabase = getSupabaseClient()
  const payload = buildTransferPayload(employee, values)

  const { data: snapshotData, error: snapshotError } = await supabase
    .from('ex_employees')
    .insert([payload] as never[])
    .select(exEmployeeSelect)
    .single()

  if (snapshotError) {
    throw snapshotError
  }

  const snapshot = snapshotData as ExEmployeeRecord | null

  if (!snapshot) {
    throw new Error('Employee transfer failed because the ex-employee snapshot was not returned.')
  }

  const { data: archivedEmployeeData, error: employeeError } = await supabase
    .from('employees')
    .update({
      archived_at: new Date().toISOString(),
      deleted_at: new Date().toISOString(),
      status: 'archived',
    } as never)
    .eq('id', employee.id)
    .select('id')
    .maybeSingle()

  const archivedEmployee = archivedEmployeeData as { id: string } | null

  if (employeeError) {
    const rollback = await supabase
      .from('ex_employees')
      .delete()
      .eq('id', snapshot.id)

    const rollbackSuffix = rollback.error
      ? ` Rollback also failed: ${rollback.error.message}.`
      : ' Snapshot rollback succeeded.'

    throw new Error(
      `Employee transfer failed after creating the ex-employee snapshot: ${employeeError.message}.${rollbackSuffix}`,
    )
  }

  if (!archivedEmployee) {
    const rollback = await supabase
      .from('ex_employees')
      .delete()
      .eq('id', snapshot.id)

    const rollbackSuffix = rollback.error
      ? ` Rollback also failed: ${rollback.error.message}.`
      : ' Snapshot rollback succeeded.'

    throw new Error(
      `Employee transfer failed because the original employee record was not updated.${rollbackSuffix}`,
    )
  }

  return {
    exEmployee: snapshot as ExEmployeeRecord,
    archivedEmployee,
  }
}

export async function restoreExEmployee(exEmployee: ExEmployeeRecord): Promise<RestoreExEmployeeResult> {
  const supabase = getSupabaseClient()

  const { data: matchingRankData, error: rankError } = await supabase
    .from('ranks')
    .select('id, rank_name')
    .eq('rank_name', exEmployee.rank_name_snapshot)
    .is('deleted_at', null)
    .maybeSingle()

  if (rankError) {
    throw rankError
  }

  const matchingRank = matchingRankData as { id: string; rank_name: string } | null
  const restoredRankId = matchingRank?.id ?? null

  const existingEmployeeId = exEmployee.employee_id ?? crypto.randomUUID()

  const { data: existingEmployeeData } = await supabase
    .from('employees')
    .select('id')
    .eq('id', existingEmployeeId)
    .maybeSingle()

  const existingEmployee = existingEmployeeData as { id: string } | null

  let employeeResult: EmployeeRecord
  let createdEmployee = false

  if (existingEmployee) {
    const { data, error } = await supabase
      .from('employees')
      .update(
        buildRestoredEmployeePayload(exEmployee, restoredRankId) as never,
      )
      .eq('id', existingEmployee.id)
      .select(
        `
          id,
          character_name,
          citizen_id,
          phone_number,
          discord_username,
          rank_id,
          division,
          hire_date,
          last_promotion_date,
          warnings,
          strike_1,
          strike_2,
          total_bills,
          status,
          created_at,
          updated_at,
          archived_at,
          deleted_at
        `,
      )
      .single()

    if (error) {
      throw error
    }

    employeeResult = data as EmployeeRecord
  } else {
    createdEmployee = true
    const { data, error } = await supabase
      .from('employees')
      .insert([
        {
          id: existingEmployeeId,
          ...buildRestoredEmployeePayload(exEmployee, restoredRankId),
        },
      ] as never[])
      .select(
        `
          id,
          character_name,
          citizen_id,
          phone_number,
          discord_username,
          rank_id,
          division,
          hire_date,
          last_promotion_date,
          warnings,
          strike_1,
          strike_2,
          total_bills,
          status,
          created_at,
          updated_at,
          archived_at,
          deleted_at
        `,
      )
      .single()

    if (error) {
      throw error
    }

    employeeResult = data as EmployeeRecord
  }

  const { data: restoredExEmployeeData, error: restoreError } = await supabase
    .from('ex_employees')
    .update({ restored_at: new Date().toISOString() } as never)
    .eq('id', exEmployee.id)
    .select(exEmployeeSelect)
    .single()

  const restoredExEmployee = restoredExEmployeeData as ExEmployeeRecord | null

  if (restoreError) {
    if (createdEmployee) {
      await supabase.from('employees').delete().eq('id', existingEmployeeId)
    } else {
      await supabase
        .from('employees')
        .update(
          {
            archived_at: new Date().toISOString(),
            deleted_at: new Date().toISOString(),
            status: 'archived',
          } as never,
        )
        .eq('id', existingEmployeeId)
    }

    throw restoreError
  }

  if (!restoredExEmployee) {
    throw new Error('Ex-employee restoration did not return the updated snapshot.')
  }

  return {
    exEmployee: restoredExEmployee,
    employee: employeeResult,
    rankWarning: matchingRank ? null : `No rank matched snapshot "${exEmployee.rank_name_snapshot}".`,
  }
}

export async function softDeleteExEmployee(exEmployeeId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('ex_employees')
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id', exEmployeeId)
    .select(exEmployeeSelect)
    .single()

  if (error) {
    throw error
  }

  return data as ExEmployeeRecord
}
