import type { EmployeeRecord, ExEmployeeRecord, SeparationType } from '../auth/types'
import { exEmployeeSelect } from './exEmployees'
import { fetchEmployees } from './employees'
import {
  hasMeaningfulContent,
  isBlank,
  normalizeHeader,
  normalizeKey,
  parseCsvRows,
  resolveBoolean,
  resolveInteger,
  resolveNumericText,
  resolveRequiredDate,
} from './csvImport'
import { getSupabaseClient } from './supabase'

const REQUIRED_HEADERS = [
  'character_name',
  'citizen_id',
  'rank_name_snapshot',
  'hire_date',
  'leave_date',
  'separation_type',
] as const

const OPTIONAL_HEADERS = [
  'employee_citizen_id',
  'phone_number',
  'discord_username',
  'division',
  'last_promotion_date',
  'reason',
  'warnings',
  'strike_1',
  'strike_2',
  'total_bills',
] as const

const ALLOWED_HEADERS = new Set<string>([...REQUIRED_HEADERS, ...OPTIONAL_HEADERS])
const ALLOWED_SEPARATION_TYPES = new Set<SeparationType>(['fired', 'resigned'])

export interface ExEmployeeCsvParsedRow {
  lineNumber: number
  values: Record<string, string>
}

export interface ExEmployeeCsvParseResult {
  headers: string[]
  missingHeaders: string[]
  duplicateHeaders: string[]
  unknownHeaders: string[]
  rows: ExEmployeeCsvParsedRow[]
  totalRows: number
}

export interface ExEmployeeCsvPreviewRow {
  lineNumber: number
  values: Record<string, string>
  character_name: string
  citizen_id: string
  employee_citizen_id: string | null
  employee_id: string | null
  rank_name_snapshot: string
  hire_date: string
  leave_date: string
  separation_type: SeparationType
  phone_number: string | null
  discord_username: string | null
  division: string | null
  last_promotion_date: string | null
  reason: string | null
  warnings: number
  strike_1: boolean
  strike_2: boolean
  total_bills: string
  errors: string[]
  warningsList: string[]
  existingCitizenId: boolean
  duplicateCitizenIdInCsv: boolean
  importState: 'valid' | 'skipped' | 'error'
}

export interface ExEmployeeCsvPreviewResult {
  headers: string[]
  missingHeaders: string[]
  duplicateHeaders: string[]
  unknownHeaders: string[]
  totalRows: number
  validRows: number
  skippedRows: number
  rowsWithErrors: number
  duplicateCitizenIdsInCsv: string[]
  existingCitizenIds: string[]
  rows: ExEmployeeCsvPreviewRow[]
}

export interface ExEmployeeCsvImportError {
  lineNumber: number
  message: string
}

export interface ExEmployeeCsvImportResult {
  insertedCount: number
  skippedCount: number
  failedCount: number
  rowErrors: ExEmployeeCsvImportError[]
  insertedExEmployees: ExEmployeeRecord[]
}

function parseExEmployeeCsvText(csvText: string): ExEmployeeCsvParseResult {
  const parsedRows = parseCsvRows(csvText)
  const firstContentRowIndex = parsedRows.findIndex(hasMeaningfulContent)

  if (firstContentRowIndex === -1) {
    return {
      headers: [],
      missingHeaders: [...REQUIRED_HEADERS],
      duplicateHeaders: [],
      unknownHeaders: [],
      rows: [],
      totalRows: 0,
    }
  }

  const headerRow = parsedRows[firstContentRowIndex]?.cells ?? []
  const headers = headerRow.map((header) => normalizeHeader(header))
  const duplicateHeaders = Array.from(
    new Set(
      headers.filter((header, index) => header.length > 0 && headers.indexOf(header) !== index),
    ),
  )
  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(header))
  const unknownHeaders = headerRow
    .map((header) => header.trim())
    .filter((header) => header.length > 0)
    .filter((header) => !ALLOWED_HEADERS.has(normalizeHeader(header)))

  const rows: ExEmployeeCsvParsedRow[] = parsedRows
    .slice(firstContentRowIndex + 1)
    .filter(hasMeaningfulContent)
    .map((row, rowIndex) => {
      const values: Record<string, string> = {}

      headers.forEach((header, columnIndex) => {
        if (header.length === 0) {
          return
        }

        values[header] = row.cells[columnIndex]?.trim() ?? ''
      })

      return {
        lineNumber: firstContentRowIndex + rowIndex + 2,
        values,
      }
    })

  return {
    headers: headerRow.map((header) => header.trim()),
    missingHeaders,
    duplicateHeaders,
    unknownHeaders,
    rows,
    totalRows: rows.length,
  }
}

function normalizeLookupKey(value: string) {
  return normalizeKey(value)
}

function buildEmployeeLookup(employees: EmployeeRecord[]) {
  const lookup = new Map<string, EmployeeRecord>()

  employees.forEach((employee) => {
    lookup.set(normalizeLookupKey(employee.citizen_id), employee)
  })

  return lookup
}

export function evaluateExEmployeeCsvPreview(
  parsed: ExEmployeeCsvParseResult,
  options: {
    existingCitizenIds: Iterable<string>
    employeeLookup: Map<string, EmployeeRecord>
  },
): ExEmployeeCsvPreviewResult {
  const existingCitizenIdSet = new Set(
    Array.from(options.existingCitizenIds, (value) => normalizeLookupKey(value)),
  )
  const duplicateCitizenIdLookup = new Map<string, number>()
  const duplicateCitizenIdDisplay = new Map<string, string>()

  parsed.rows.forEach((row) => {
    const citizenIdRaw = row.values.citizen_id?.trim() ?? ''
    const citizenId = normalizeLookupKey(citizenIdRaw)

    if (!citizenId) {
      return
    }

    duplicateCitizenIdLookup.set(
      citizenId,
      (duplicateCitizenIdLookup.get(citizenId) ?? 0) + 1,
    )

    if (!duplicateCitizenIdDisplay.has(citizenId)) {
      duplicateCitizenIdDisplay.set(citizenId, citizenIdRaw)
    }
  })

  const duplicateCitizenIdsInCsv = Array.from(duplicateCitizenIdLookup.entries())
    .filter(([, count]) => count > 1)
    .map(([citizenId]) => duplicateCitizenIdDisplay.get(citizenId) ?? citizenId)

  const rows = parsed.rows.map<ExEmployeeCsvPreviewRow>((row) => {
    const errors: string[] = []
    const warningsList: string[] = []

    const characterName = row.values.character_name?.trim() ?? ''
    const citizenId = row.values.citizen_id?.trim() ?? ''
    const rankNameSnapshot = row.values.rank_name_snapshot?.trim() ?? ''
    const separationType = (row.values.separation_type?.trim().toLowerCase() ?? '') as SeparationType
    const employeeCitizenId = row.values.employee_citizen_id?.trim() ?? ''

    if (!characterName) {
      errors.push('Character name is required.')
    }

    if (!citizenId) {
      errors.push('Citizen ID is required.')
    }

    if (!rankNameSnapshot) {
      errors.push('Rank snapshot is required.')
    }

    const hireDateResolution = resolveRequiredDate(row.values.hire_date ?? '', 'Hire Date')
    if (hireDateResolution.error) {
      errors.push(hireDateResolution.error)
    }

    const leaveDateResolution = resolveRequiredDate(row.values.leave_date ?? '', 'Leave Date')
    if (leaveDateResolution.error) {
      errors.push(leaveDateResolution.error)
    }

    if (!ALLOWED_SEPARATION_TYPES.has(separationType)) {
      errors.push('Separation Type must be fired or resigned.')
    }

    if (citizenId && (duplicateCitizenIdLookup.get(normalizeLookupKey(citizenId)) ?? 0) > 1) {
      errors.push('Duplicate Citizen ID appears more than once in the CSV.')
    }

    const existingCitizenId = citizenId
      ? existingCitizenIdSet.has(normalizeLookupKey(citizenId))
      : false

    if (existingCitizenId) {
      warningsList.push('Citizen ID already exists in ex-employees and will be skipped.')
    }

    const employeeLookup = options.employeeLookup
    const matchedEmployee =
      employeeCitizenId.length > 0
        ? employeeLookup.get(normalizeLookupKey(employeeCitizenId)) ?? null
        : null

    if (employeeCitizenId.length > 0 && !matchedEmployee) {
      warningsList.push('Employee citizen ID was not found; employee link will remain blank.')
    }

    let warnings = 0
    let totalBills = '0'
    let strike1 = false
    let strike2 = false

    try {
      warnings = resolveInteger(row.values.warnings ?? '', 'Warnings')
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Warnings must be a whole number.')
    }

    try {
      totalBills = resolveNumericText(row.values.total_bills ?? '', 'Total Bills')
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Total Bills must be a valid number.')
    }

    try {
      strike1 = resolveBoolean(row.values.strike_1 ?? '')
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Strike 1 must be true/false, yes/no, or 1/0.')
    }

    try {
      strike2 = resolveBoolean(row.values.strike_2 ?? '')
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Strike 2 must be true/false, yes/no, or 1/0.')
    }

    const importState: ExEmployeeCsvPreviewRow['importState'] = errors.length > 0
      ? 'error'
      : existingCitizenId
        ? 'skipped'
        : 'valid'

    return {
      lineNumber: row.lineNumber,
      values: row.values,
      character_name: characterName,
      citizen_id: citizenId,
      employee_citizen_id: employeeCitizenId.length > 0 ? employeeCitizenId : null,
      employee_id: matchedEmployee?.id ?? null,
      rank_name_snapshot: rankNameSnapshot,
      hire_date: hireDateResolution.value ?? row.values.hire_date.trim(),
      leave_date: leaveDateResolution.value ?? row.values.leave_date.trim(),
      separation_type: separationType || 'resigned',
      phone_number: isBlank(row.values.phone_number) ? null : row.values.phone_number.trim(),
      discord_username: isBlank(row.values.discord_username)
        ? null
        : row.values.discord_username.trim(),
      division: isBlank(row.values.division) ? null : row.values.division.trim(),
      last_promotion_date: isBlank(row.values.last_promotion_date)
        ? null
        : row.values.last_promotion_date.trim(),
      reason: isBlank(row.values.reason) ? null : row.values.reason.trim(),
      warnings,
      strike_1: strike1,
      strike_2: strike2,
      total_bills: totalBills,
      errors,
      warningsList,
      existingCitizenId,
      duplicateCitizenIdInCsv:
        citizenId.length > 0 && (duplicateCitizenIdLookup.get(normalizeLookupKey(citizenId)) ?? 0) > 1,
      importState,
    }
  })

  return {
    headers: parsed.headers,
    missingHeaders: parsed.missingHeaders,
    duplicateHeaders: parsed.duplicateHeaders,
    unknownHeaders: parsed.unknownHeaders,
    totalRows: parsed.totalRows,
    validRows: rows.filter((row) => row.importState === 'valid').length,
    skippedRows: rows.filter((row) => row.importState === 'skipped').length,
    rowsWithErrors: rows.filter((row) => row.importState === 'error').length,
    duplicateCitizenIdsInCsv,
    existingCitizenIds: rows
      .filter((row) => row.existingCitizenId)
      .map((row) => row.citizen_id),
    rows,
  }
}

function buildInsertPayload(row: ExEmployeeCsvPreviewRow) {
  if (row.importState !== 'valid') {
    return null
  }

  return {
    employee_id: row.employee_id,
    character_name: row.character_name,
    citizen_id: row.citizen_id,
    phone_number: row.phone_number,
    discord_username: row.discord_username,
    rank_name_snapshot: row.rank_name_snapshot,
    division: row.division,
    hire_date: row.hire_date,
    last_promotion_date: row.last_promotion_date,
    leave_date: row.leave_date,
    separation_type: row.separation_type,
    reason: row.reason,
    warnings: row.warnings,
    strike_1: row.strike_1,
    strike_2: row.strike_2,
    total_bills: row.total_bills,
    restored_at: null,
    archived_at: null,
    deleted_at: null,
  }
}

export async function importExEmployeeCsvRows(rows: ExEmployeeCsvPreviewRow[]) {
  const supabase = getSupabaseClient()
  const employees = await fetchEmployees()
  const employeeLookup = buildEmployeeLookup(employees)

  const insertedExEmployees: ExEmployeeRecord[] = []
  const rowErrors: ExEmployeeCsvImportError[] = []
  let insertedCount = 0
  let skippedCount = 0
  let failedCount = 0

  for (const row of rows) {
    if (row.importState === 'error') {
      failedCount += 1
      row.errors.forEach((message) => {
        rowErrors.push({
          lineNumber: row.lineNumber,
          message,
        })
      })
      continue
    }

    if (row.importState === 'skipped') {
      skippedCount += 1
      continue
    }

    const matchedEmployee = row.employee_citizen_id
      ? employeeLookup.get(normalizeLookupKey(row.employee_citizen_id))
      : null

    const payload = buildInsertPayload({
      ...row,
      employee_id: matchedEmployee?.id ?? null,
    })

    if (!payload) {
      skippedCount += 1
      continue
    }

    const { data, error } = await supabase
      .from('ex_employees')
      .insert([payload] as never[])
      .select(exEmployeeSelect)
      .single()

    if (error) {
      failedCount += 1
      rowErrors.push({
        lineNumber: row.lineNumber,
        message: error.message || 'Unable to import ex-employee row.',
      })
      continue
    }

    insertedCount += 1
    insertedExEmployees.push(data as ExEmployeeRecord)
  }

  return {
    insertedCount,
    skippedCount,
    failedCount,
    rowErrors,
    insertedExEmployees,
  }
}

export function parseExEmployeeCsvForPreview(
  csvText: string,
  options: {
    existingCitizenIds: Iterable<string>
    employeeLookup: Map<string, EmployeeRecord>
  },
) {
  const parsed = parseExEmployeeCsvText(csvText)
  return evaluateExEmployeeCsvPreview(parsed, options)
}
