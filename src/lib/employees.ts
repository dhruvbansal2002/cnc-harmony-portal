import type { EmployeeRecord, RankRecord } from '../auth/types'
import { getSupabaseClient } from './supabase'
import { rankSelect } from './ranks'

export const employeeStatusOptions = ['active', 'inactive', 'on_leave', 'archived'] as const

export const employeeSelect = `
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
  deleted_at,
  rank:ranks(${rankSelect})
`

export interface EmployeeFormValues {
  character_name: string
  citizen_id: string
  phone_number: string
  discord_username: string
  rank_id: string
  division: string
  hire_date: string
  last_promotion_date: string
  warnings: string
  strike_1: boolean
  strike_2: boolean
  total_bills: string
  status: EmployeeRecord['status']
}

interface EmployeeMutationPayload {
  character_name: string
  citizen_id: string
  phone_number: string | null
  discord_username: string | null
  rank_id: string
  division: string | null
  hire_date: string
  last_promotion_date: string | null
  warnings: number
  strike_1: boolean
  strike_2: boolean
  total_bills: number
  status: EmployeeRecord['status']
  archived_at: string | null
}

function toIsoToday() {
  return new Date().toISOString().slice(0, 10)
}

function normalizeOptionalText(value: string) {
  return value.trim() ? value.trim() : null
}

function parseWarnings(value: string) {
  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error('Warnings must be a whole number greater than or equal to 0.')
  }

  return parsed
}

function parseTotalBills(value: string) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    throw new Error('Total Bills must be a valid number.')
  }

  return parsed
}

function toPayload(values: EmployeeFormValues): EmployeeMutationPayload {
  if (!values.character_name.trim()) {
    throw new Error('Character Name is required.')
  }

  if (!values.citizen_id.trim()) {
    throw new Error('Citizen ID is required.')
  }

  if (!values.rank_id.trim()) {
    throw new Error('Rank is required.')
  }

  if (!values.hire_date.trim()) {
    throw new Error('Hire Date is required.')
  }

  return {
    character_name: values.character_name.trim(),
    citizen_id: values.citizen_id.trim(),
    phone_number: normalizeOptionalText(values.phone_number),
    discord_username: normalizeOptionalText(values.discord_username),
    rank_id: values.rank_id.trim(),
    division: normalizeOptionalText(values.division),
    hire_date: values.hire_date,
    last_promotion_date: normalizeOptionalText(values.last_promotion_date),
    warnings: parseWarnings(values.warnings),
    strike_1: values.strike_1,
    strike_2: values.strike_2,
    total_bills: parseTotalBills(values.total_bills),
    status: values.status,
    archived_at: values.status === 'archived' ? new Date().toISOString() : null,
  }
}

export function createEmptyEmployeeFormValues(): EmployeeFormValues {
  return {
    character_name: '',
    citizen_id: '',
    phone_number: '',
    discord_username: '',
    rank_id: '',
    division: '',
    hire_date: toIsoToday(),
    last_promotion_date: '',
    warnings: '0',
    strike_1: false,
    strike_2: false,
    total_bills: '0.00',
    status: 'active',
  }
}

export function employeeToFormValues(employee: EmployeeRecord): EmployeeFormValues {
  return {
    character_name: employee.character_name,
    citizen_id: employee.citizen_id,
    phone_number: employee.phone_number ?? '',
    discord_username: employee.discord_username ?? '',
    rank_id: employee.rank_id ?? '',
    division: employee.division ?? '',
    hire_date: employee.hire_date,
    last_promotion_date: employee.last_promotion_date ?? '',
    warnings: String(employee.warnings),
    strike_1: employee.strike_1,
    strike_2: employee.strike_2,
    total_bills: String(employee.total_bills),
    status: employee.status,
  }
}

function statusPriority(status: EmployeeRecord['status']) {
  switch (status) {
    case 'active':
      return 0
    case 'on_leave':
      return 1
    case 'inactive':
      return 2
    case 'archived':
      return 3
    default:
      return 4
  }
}

export function isArchivedEmployee(employee: EmployeeRecord) {
  return employee.archived_at !== null || employee.status === 'archived'
}

export function sortEmployees(employees: EmployeeRecord[]) {
  return [...employees].sort((first, second) => {
    const firstArchived = isArchivedEmployee(first)
    const secondArchived = isArchivedEmployee(second)

    if (firstArchived !== secondArchived) {
      return Number(firstArchived) - Number(secondArchived)
    }

    if (firstArchived && secondArchived) {
      const archivedComparison =
        new Date(second.archived_at ?? second.updated_at).getTime() -
        new Date(first.archived_at ?? first.updated_at).getTime()

      if (archivedComparison !== 0) {
        return archivedComparison
      }
    } else {
      const firstRankOrder = first.rank?.display_order ?? -1
      const secondRankOrder = second.rank?.display_order ?? -1

      if (secondRankOrder !== firstRankOrder) {
        return secondRankOrder - firstRankOrder
      }

      const statusComparison =
        statusPriority(first.status) - statusPriority(second.status)

      if (statusComparison !== 0) {
        return statusComparison
      }
    }

    return first.character_name.localeCompare(second.character_name)
  })
}

export async function fetchEmployees() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('employees')
    .select(employeeSelect)
    .is('deleted_at', null)

  if (error) {
    throw error
  }

  return sortEmployees((data ?? []) as EmployeeRecord[])
}

export async function fetchEmployeeRanks() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('ranks')
    .select(rankSelect)
    .is('deleted_at', null)

  if (error) {
    throw error
  }

  return (data ?? []) as RankRecord[]
}

export async function createEmployee(values: EmployeeFormValues) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('employees')
    .insert([toPayload(values)] as never[])
    .select(employeeSelect)
    .single()

  if (error) {
    throw error
  }

  return data as EmployeeRecord
}

export async function updateEmployee(employeeId: string, values: EmployeeFormValues) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('employees')
    .update(toPayload(values) as never)
    .eq('id', employeeId)
    .select(employeeSelect)
    .single()

  if (error) {
    throw error
  }

  return data as EmployeeRecord
}

export async function updateEmployeeStatus(
  employeeId: string,
  status: Exclude<EmployeeRecord['status'], 'archived'>,
) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('employees')
    .update({ status, archived_at: null } as never)
    .eq('id', employeeId)
    .select(employeeSelect)
    .single()

  if (error) {
    throw error
  }

  return data as EmployeeRecord
}

export async function archiveEmployee(employeeId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('employees')
    .update({ archived_at: new Date().toISOString(), status: 'archived' } as never)
    .eq('id', employeeId)
    .select(employeeSelect)
    .single()

  if (error) {
    throw error
  }

  return data as EmployeeRecord
}

export async function restoreEmployee(employeeId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('employees')
    .update({ archived_at: null, status: 'active' } as never)
    .eq('id', employeeId)
    .select(employeeSelect)
    .single()

  if (error) {
    throw error
  }

  return data as EmployeeRecord
}

export async function softDeleteEmployee(employeeId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('employees')
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id', employeeId)
    .select(employeeSelect)
    .single()

  if (error) {
    throw error
  }

  return data as EmployeeRecord
}

