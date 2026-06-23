import type { CustomerRecord } from '../auth/types'
import {
  hasMeaningfulContent,
  isBlank,
  normalizeHeader,
  normalizeKey,
  parseCsvRows,
} from './csvImport'
import { customerSelect } from './customers'
import { getSupabaseClient } from './supabase'

const REQUIRED_HEADERS = ['character_name', 'citizen_id'] as const
const OPTIONAL_HEADERS = ['phone_number', 'discord_username', 'notes', 'status'] as const

const ALLOWED_HEADERS = new Set<string>([...REQUIRED_HEADERS, ...OPTIONAL_HEADERS])
const ALLOWED_STATUSES = new Set<CustomerRecord['status']>(['active', 'inactive', 'archived'])

export interface CustomerCsvParsedRow {
  lineNumber: number
  values: Record<string, string>
}

export interface CustomerCsvParseResult {
  headers: string[]
  missingHeaders: string[]
  duplicateHeaders: string[]
  unknownHeaders: string[]
  rows: CustomerCsvParsedRow[]
  totalRows: number
}

export interface CustomerCsvPreviewRow {
  lineNumber: number
  values: Record<string, string>
  character_name: string
  citizen_id: string
  phone_number: string | null
  discord_username: string | null
  notes: string | null
  status: CustomerRecord['status']
  errors: string[]
  warningsList: string[]
  existingCitizenId: boolean
  duplicateCitizenIdInCsv: boolean
  importState: 'valid' | 'skipped' | 'error'
}

export interface CustomerCsvPreviewResult {
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
  rows: CustomerCsvPreviewRow[]
}

export interface CustomerCsvImportError {
  lineNumber: number
  message: string
}

export interface CustomerCsvImportResult {
  insertedCount: number
  skippedCount: number
  failedCount: number
  rowErrors: CustomerCsvImportError[]
  insertedCustomers: CustomerRecord[]
}

function parseCustomerCsvText(csvText: string): CustomerCsvParseResult {
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

  const rows: CustomerCsvParsedRow[] = parsedRows
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

function buildInsertPayload(row: CustomerCsvPreviewRow) {
  if (row.importState !== 'valid') {
    return null
  }

  return {
    character_name: row.character_name,
    citizen_id: row.citizen_id,
    phone_number: row.phone_number,
    discord_username: row.discord_username,
    notes: row.notes,
    status: row.status,
    archived_at: row.status === 'archived' ? new Date().toISOString() : null,
    deleted_at: null,
  }
}

export function evaluateCustomerCsvPreview(
  parsed: CustomerCsvParseResult,
  options: {
    existingCitizenIds: Iterable<string>
  },
): CustomerCsvPreviewResult {
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

    duplicateCitizenIdLookup.set(citizenId, (duplicateCitizenIdLookup.get(citizenId) ?? 0) + 1)

    if (!duplicateCitizenIdDisplay.has(citizenId)) {
      duplicateCitizenIdDisplay.set(citizenId, citizenIdRaw)
    }
  })

  const duplicateCitizenIdsInCsv = Array.from(duplicateCitizenIdLookup.entries())
    .filter(([, count]) => count > 1)
    .map(([citizenId]) => duplicateCitizenIdDisplay.get(citizenId) ?? citizenId)

  const rows = parsed.rows.map<CustomerCsvPreviewRow>((row) => {
    const errors: string[] = []
    const warningsList: string[] = []

    const characterName = row.values.character_name?.trim() ?? ''
    const citizenId = row.values.citizen_id?.trim() ?? ''
    const statusValue = (row.values.status ?? '').trim().toLowerCase()

    if (!characterName) {
      errors.push('Character Name is required.')
    }

    if (!citizenId) {
      errors.push('Citizen ID is required.')
    }

    if (citizenId && (duplicateCitizenIdLookup.get(normalizeLookupKey(citizenId)) ?? 0) > 1) {
      errors.push('Duplicate Citizen ID appears more than once in the CSV.')
    }

    const existingCitizenId = citizenId
      ? existingCitizenIdSet.has(normalizeLookupKey(citizenId))
      : false

    if (existingCitizenId) {
      warningsList.push('Citizen ID already exists in customers and will be skipped.')
    }

    let status: CustomerRecord['status'] = 'active'

    if (statusValue.length > 0) {
      if (ALLOWED_STATUSES.has(statusValue as CustomerRecord['status'])) {
        status = statusValue as CustomerRecord['status']
      } else {
        errors.push('Status must be active, inactive, or archived.')
      }
    }

    const importState: CustomerCsvPreviewRow['importState'] = errors.length > 0
      ? 'error'
      : existingCitizenId
        ? 'skipped'
        : 'valid'

    return {
      lineNumber: row.lineNumber,
      values: row.values,
      character_name: characterName,
      citizen_id: citizenId,
      phone_number: isBlank(row.values.phone_number) ? null : row.values.phone_number.trim(),
      discord_username: isBlank(row.values.discord_username)
        ? null
        : row.values.discord_username.trim(),
      notes: isBlank(row.values.notes) ? null : row.values.notes.trim(),
      status,
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

export async function importCustomerCsvRows(rows: CustomerCsvPreviewRow[]) {
  const supabase = getSupabaseClient()
  const insertedCustomers: CustomerRecord[] = []
  const rowErrors: CustomerCsvImportError[] = []
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

    const payload = buildInsertPayload(row)

    if (!payload) {
      skippedCount += 1
      continue
    }

    const { data, error } = await supabase
      .from('customers')
      .insert([payload] as never[])
      .select(customerSelect)
      .single()

    if (error) {
      failedCount += 1
      rowErrors.push({
        lineNumber: row.lineNumber,
        message: error.message || 'Unable to import customer row.',
      })
      continue
    }

    insertedCount += 1
    insertedCustomers.push(data as CustomerRecord)
  }

  return {
    insertedCount,
    skippedCount,
    failedCount,
    rowErrors,
    insertedCustomers,
  }
}

export function parseCustomerCsvForPreview(
  csvText: string,
  options: {
    existingCitizenIds: Iterable<string>
  },
) {
  const parsed = parseCustomerCsvText(csvText)
  return evaluateCustomerCsvPreview(parsed, options)
}
