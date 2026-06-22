import type { EmployeeRecord, RankRecord } from '../auth/types'
import { employeeSelect } from './employees'
import { getSupabaseClient } from './supabase'

const REQUIRED_HEADERS = ['character_name', 'citizen_id'] as const
const OPTIONAL_HEADERS = [
  'phone_number',
  'discord_username',
  'rank',
  'rank_name',
  'division',
  'hire_date',
  'last_promotion_date',
  'warnings',
  'strike_1',
  'strike_2',
  'total_bills',
  'status',
] as const

const ALLOWED_HEADERS = new Set<string>([...REQUIRED_HEADERS, ...OPTIONAL_HEADERS])
const ALLOWED_STATUSES = new Set<EmployeeRecord['status']>([
  'active',
  'inactive',
  'on_leave',
  'archived',
])

type CsvRow = {
  cells: string[]
}

export interface EmployeeCsvParsedRow {
  lineNumber: number
  values: Record<string, string>
}

export interface EmployeeCsvParseResult {
  headers: string[]
  missingHeaders: string[]
  duplicateHeaders: string[]
  unknownHeaders: string[]
  rows: EmployeeCsvParsedRow[]
  totalRows: number
}

export interface EmployeeCsvPreviewRow {
  lineNumber: number
  values: Record<string, string>
  character_name: string
  citizen_id: string
  phone_number: string | null
  discord_username: string | null
  rank_id: string | null
  rank_label: string | null
  division: string | null
  hire_date: string
  last_promotion_date: string | null
  warnings: number
  strike_1: boolean
  strike_2: boolean
  total_bills: string
  status: EmployeeRecord['status']
  errors: string[]
  warningsList: string[]
  existingCitizenId: boolean
  duplicateCitizenIdInCsv: boolean
  importState: 'valid' | 'skipped' | 'error'
}

export interface EmployeeCsvPreviewResult {
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
  rows: EmployeeCsvPreviewRow[]
}

export interface EmployeeCsvImportError {
  lineNumber: number
  message: string
}

export interface EmployeeCsvImportResult {
  insertedCount: number
  skippedCount: number
  failedCount: number
  rowErrors: EmployeeCsvImportError[]
  insertedEmployees: EmployeeRecord[]
}

function normalizeHeader(header: string) {
  return header.replace(/^\uFEFF/, '').trim().toLowerCase()
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase()
}

function isBlank(value: string | null | undefined) {
  return !value || value.trim().length === 0
}

function parseCsvRows(csvText: string): CsvRow[] {
  const rows: CsvRow[] = []
  let currentCell = ''
  let currentRow: string[] = []
  let inQuotes = false

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index]
    const nextCharacter = csvText[index + 1]

    if (inQuotes) {
      if (character === '"') {
        if (nextCharacter === '"') {
          currentCell += '"'
          index += 1
        } else {
          inQuotes = false
        }
      } else {
        currentCell += character
      }

      continue
    }

    if (character === '"') {
      inQuotes = true
      continue
    }

    if (character === ',') {
      currentRow.push(currentCell)
      currentCell = ''
      continue
    }

    if (character === '\r') {
      continue
    }

    if (character === '\n') {
      currentRow.push(currentCell)
      rows.push({ cells: currentRow })
      currentRow = []
      currentCell = ''
      continue
    }

    currentCell += character
  }

  currentRow.push(currentCell)
  rows.push({ cells: currentRow })

  return rows
}

function hasMeaningfulContent(row: CsvRow) {
  return row.cells.some((cell) => cell.trim().length > 0)
}

function resolveDate(value: string, fallback: string | null, fieldLabel: string) {
  const trimmed = value.trim()

  if (trimmed.length === 0) {
    return {
      value: fallback,
      error: null,
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return {
      value: null,
      error: `${fieldLabel} must use YYYY-MM-DD.`,
    }
  }

  const parsed = new Date(`${trimmed}T00:00:00Z`)

  if (Number.isNaN(parsed.getTime())) {
    return {
      value: null,
      error: `${fieldLabel} is not a valid date.`,
    }
  }

  const roundTripped = parsed.toISOString().slice(0, 10)

  if (roundTripped !== trimmed) {
    return {
      value: null,
      error: `${fieldLabel} is not a valid calendar date.`,
    }
  }

  return {
    value: trimmed,
    error: null,
  }
}

function resolveBoolean(value: string) {
  const trimmed = value.trim().toLowerCase()

  if (trimmed.length === 0) {
    return false
  }

  if (['true', 'yes', '1'].includes(trimmed)) {
    return true
  }

  if (['false', 'no', '0'].includes(trimmed)) {
    return false
  }

  throw new Error('Boolean values must use true/false, yes/no, or 1/0.')
}

function resolveInteger(value: string, fieldLabel: string, fallback = 0) {
  const trimmed = value.trim()

  if (trimmed.length === 0) {
    return fallback
  }

  const parsed = Number(trimmed)

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${fieldLabel} must be a whole number greater than or equal to 0.`)
  }

  return parsed
}

function resolveNumericText(value: string, fieldLabel: string, fallback = '0') {
  const trimmed = value.trim()

  if (trimmed.length === 0) {
    return fallback
  }

  const parsed = Number(trimmed)

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldLabel} must be a number greater than or equal to 0.`)
  }

  return trimmed
}

export function parseEmployeeCsvText(csvText: string): EmployeeCsvParseResult {
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
    .filter((header) => {
      const normalized = normalizeHeader(header)

      return !ALLOWED_HEADERS.has(normalized)
    })

  const rows: EmployeeCsvParsedRow[] = parsedRows
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

function buildRankLookup(ranks: RankRecord[]) {
  const lookup = new Map<string, RankRecord[]>()

  ranks.forEach((rank) => {
    const key = normalizeKey(rank.rank_name)
    const existing = lookup.get(key) ?? []
    existing.push(rank)
    lookup.set(key, existing)
  })

  return lookup
}

function resolveRank(
  rawValue: string,
  rankLookup: Map<string, RankRecord[]>,
  allowBlankRank: boolean,
) {
  const trimmed = rawValue.trim()

  if (trimmed.length === 0) {
    if (allowBlankRank) {
      return {
        rankId: null,
        warning: 'Rank left blank because allow blank rank is enabled.',
        error: null,
      }
    }

    return {
      rankId: null,
      warning: null,
      error: 'Rank is required unless allow blank rank is enabled.',
    }
  }

  const matches = rankLookup.get(normalizeKey(trimmed)) ?? []

  if (matches.length === 1) {
    return {
      rankId: matches[0].id,
      warning: null,
      error: null,
    }
  }

  if (matches.length > 1) {
    return {
      rankId: null,
      warning: null,
      error: `Multiple rank records matched "${trimmed}". Contact management.`,
    }
  }

  if (allowBlankRank) {
    return {
      rankId: null,
      warning: `Rank "${trimmed}" was not found; the row will import without a rank.`,
      error: null,
    }
  }

  return {
    rankId: null,
    warning: null,
    error: `Rank "${trimmed}" was not found.`,
  }
}

export function evaluateEmployeeCsvPreview(
  parsed: EmployeeCsvParseResult,
  options: {
    rankOptions: RankRecord[]
    existingCitizenIds: Iterable<string>
    allowBlankRank: boolean
  },
): EmployeeCsvPreviewResult {
  const rankLookup = buildRankLookup(options.rankOptions)
  const existingCitizenIdSet = new Set(
    Array.from(options.existingCitizenIds, (value) => normalizeKey(value)),
  )
  const duplicateCitizenIdLookup = new Map<string, number>()
  const duplicateCitizenIdDisplay = new Map<string, string>()

  parsed.rows.forEach((row) => {
    const citizenIdRaw = row.values.citizen_id?.trim() ?? ''
    const citizenId = normalizeKey(citizenIdRaw)

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

  const rows = parsed.rows.map<EmployeeCsvPreviewRow>((row) => {
    const errors: string[] = []
    const warningsList: string[] = []

    const characterName = row.values.character_name?.trim() ?? ''
    const citizenId = row.values.citizen_id?.trim() ?? ''

    if (!characterName) {
      errors.push('Character name is required.')
    }

    if (!citizenId) {
      errors.push('Citizen ID is required.')
    }

    if ((citizenId && (duplicateCitizenIdLookup.get(normalizeKey(citizenId)) ?? 0) > 1)) {
      errors.push('Duplicate Citizen ID appears more than once in the CSV.')
    }

    const existingCitizenId = citizenId
      ? existingCitizenIdSet.has(normalizeKey(citizenId))
      : false

    if (existingCitizenId) {
      warningsList.push('Citizen ID already exists in the database and will be skipped.')
    }

    let rankLabel: string | null = null

    const rankValue = row.values.rank?.trim() || row.values.rank_name?.trim() || ''
    const rankResolution = resolveRank(rankValue, rankLookup, options.allowBlankRank)

    if (rankValue.length > 0) {
      rankLabel = rankValue
    }

    if (rankResolution.warning) {
      warningsList.push(rankResolution.warning)
    }

    if (rankResolution.error) {
      errors.push(rankResolution.error)
    }

    const hireDateResolution = resolveDate(
      row.values.hire_date ?? '',
      new Date().toISOString().slice(0, 10),
      'Hire Date',
    )

    if (hireDateResolution.error) {
      errors.push(hireDateResolution.error)
    }

    const promotionDateResolution = resolveDate(
      row.values.last_promotion_date ?? '',
      null,
      'Last Promotion Date',
    )

    if (promotionDateResolution.error) {
      errors.push(promotionDateResolution.error)
    }

    let warnings = 0
    let totalBills = '0'
    let strike1 = false
    let strike2 = false
    let status: EmployeeRecord['status'] = 'active'

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

    const statusValue = (row.values.status ?? '').trim().toLowerCase()

    if (statusValue.length > 0) {
      if (ALLOWED_STATUSES.has(statusValue as EmployeeRecord['status'])) {
        status = statusValue as EmployeeRecord['status']
      } else {
        errors.push('Status must be active, inactive, on_leave, or archived.')
      }
    }

    const hireDate = hireDateResolution.value ?? new Date().toISOString().slice(0, 10)
    const lastPromotionDate = promotionDateResolution.value

    const importState: EmployeeCsvPreviewRow['importState'] = errors.length > 0
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
      rank_id: rankResolution.rankId,
      rank_label: rankLabel,
      division: isBlank(row.values.division) ? null : row.values.division.trim(),
      hire_date: hireDate,
      last_promotion_date: lastPromotionDate,
      warnings,
      strike_1: strike1,
      strike_2: strike2,
      total_bills: totalBills,
      status,
      errors,
      warningsList,
      existingCitizenId,
      duplicateCitizenIdInCsv:
        citizenId.length > 0 && (duplicateCitizenIdLookup.get(normalizeKey(citizenId)) ?? 0) > 1,
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

function buildInsertPayload(row: EmployeeCsvPreviewRow) {
  if (row.importState !== 'valid') {
    return null
  }

  return {
    character_name: row.character_name,
    citizen_id: row.citizen_id,
    phone_number: row.phone_number,
    discord_username: row.discord_username,
    rank_id: row.rank_id,
    division: row.division,
    hire_date: row.hire_date,
    last_promotion_date: row.last_promotion_date,
    warnings: row.warnings,
    strike_1: row.strike_1,
    strike_2: row.strike_2,
    total_bills: row.total_bills,
    status: row.status,
    archived_at: row.status === 'archived' ? new Date().toISOString() : null,
  }
}

export async function importEmployeeCsvRows(rows: EmployeeCsvPreviewRow[]) {
  const supabase = getSupabaseClient()
  const insertedEmployees: EmployeeRecord[] = []
  const rowErrors: EmployeeCsvImportError[] = []
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
      .from('employees')
      .insert([payload] as never[])
      .select(employeeSelect)
      .single()

    if (error) {
      failedCount += 1
      rowErrors.push({
        lineNumber: row.lineNumber,
        message: error.message || 'Unable to import employee row.',
      })
      continue
    }

    insertedCount += 1
    insertedEmployees.push(data as EmployeeRecord)
  }

  return {
    insertedCount,
    skippedCount,
    failedCount,
    rowErrors,
    insertedEmployees,
  }
}
