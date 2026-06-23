import type {
  CustomerRecord,
  EmployeeRecord,
  MembershipPlanRecord,
  MembershipRecordRecord,
  MembershipRecordStatus,
} from '../auth/types'
import {
  hasMeaningfulContent,
  isBlank,
  normalizeHeader,
  normalizeKey,
  parseCsvRows,
  resolveBoolean,
  resolveDate,
  resolveRequiredDate,
} from './csvImport'
import { getSupabaseClient } from './supabase'
import {
  addDaysToIsoDate,
  ensureCustomerForMembershipSnapshot,
  membershipRecordSelect,
} from './membershipRecords'

const REQUIRED_HEADERS = ['customer_character_name', 'membership_plan', 'given_date'] as const
const OPTIONAL_HEADERS = [
  'customer_citizen_id',
  'customer_phone_number',
  'customer_discord_username',
  'customer_lookup_citizen_id',
  'issued_by_employee_citizen_id',
  'expiry_date',
  'complimentary_items_given',
  'status',
  'notes',
] as const

const ALLOWED_HEADERS = new Set<string>([...REQUIRED_HEADERS, ...OPTIONAL_HEADERS])
const ALLOWED_STATUSES = new Set<MembershipRecordStatus>([
  'active',
  'expired',
  'cancelled',
  'archived',
])

export interface MembershipRecordCsvParsedRow {
  lineNumber: number
  values: Record<string, string>
}

export interface MembershipRecordCsvParseResult {
  headers: string[]
  missingHeaders: string[]
  duplicateHeaders: string[]
  unknownHeaders: string[]
  rows: MembershipRecordCsvParsedRow[]
  totalRows: number
}

export interface MembershipRecordCsvPreviewRow {
  lineNumber: number
  values: Record<string, string>
  customer_character_name: string
  customer_citizen_id: string | null
  customer_phone_number: string | null
  customer_discord_username: string | null
  customer_lookup_citizen_id: string | null
  customer_id: string | null
  membership_plan: string
  membership_plan_id: string | null
  issued_by_employee_citizen_id: string | null
  issued_by_employee_id: string | null
  given_date: string
  expiry_date: string | null
  complimentary_items_given: boolean
  status: MembershipRecordStatus
  notes: string | null
  errors: string[]
  warningsList: string[]
  existingCompositeKey: boolean
  duplicateCompositeKeyInCsv: boolean
  importState: 'valid' | 'skipped' | 'error'
}

export interface MembershipRecordCsvPreviewResult {
  headers: string[]
  missingHeaders: string[]
  duplicateHeaders: string[]
  unknownHeaders: string[]
  totalRows: number
  validRows: number
  skippedRows: number
  rowsWithErrors: number
  duplicateCompositeKeysInCsv: string[]
  existingCompositeKeys: string[]
  rows: MembershipRecordCsvPreviewRow[]
}

export interface MembershipRecordCsvImportError {
  lineNumber: number
  message: string
}

export interface MembershipRecordCsvImportResult {
  insertedCount: number
  skippedCount: number
  failedCount: number
  rowErrors: MembershipRecordCsvImportError[]
  insertedMembershipRecords: MembershipRecordRecord[]
}

export interface MembershipRecordCsvLookups {
  customers: CustomerRecord[]
  employees: EmployeeRecord[]
  membershipPlans: MembershipPlanRecord[]
}

function parseMembershipRecordCsvText(csvText: string): MembershipRecordCsvParseResult {
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

  const rows: MembershipRecordCsvParsedRow[] = parsedRows
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

function buildCustomerLookup(customers: CustomerRecord[]) {
  const lookup = new Map<string, CustomerRecord>()

  customers.forEach((customer) => {
    lookup.set(normalizeLookupKey(customer.citizen_id), customer)
  })

  return lookup
}

function buildEmployeeLookup(employees: EmployeeRecord[]) {
  const lookup = new Map<string, EmployeeRecord>()

  employees.forEach((employee) => {
    lookup.set(normalizeLookupKey(employee.citizen_id), employee)
  })

  return lookup
}

function buildMembershipPlanLookup(plans: MembershipPlanRecord[]) {
  const lookup = new Map<string, MembershipPlanRecord>()

  plans.forEach((plan) => {
    lookup.set(normalizeLookupKey(plan.plan_name), plan)
  })

  return lookup
}

function buildCompositeKey(record: {
  customer_character_name: string
  membership_plan: string
  given_date: string
}) {
  return [
    normalizeLookupKey(record.customer_character_name),
    normalizeLookupKey(record.membership_plan),
    normalizeLookupKey(record.given_date),
  ].join('|')
}

export function evaluateMembershipRecordCsvPreview(
  parsed: MembershipRecordCsvParseResult,
  options: {
    existingCompositeKeys: Iterable<string>
    lookups: MembershipRecordCsvLookups
  },
): MembershipRecordCsvPreviewResult {
  const customerLookup = buildCustomerLookup(options.lookups.customers)
  const employeeLookup = buildEmployeeLookup(options.lookups.employees)
  const membershipPlanLookup = buildMembershipPlanLookup(options.lookups.membershipPlans)
  const existingCompositeKeySet = new Set(
    Array.from(options.existingCompositeKeys, (value) => normalizeLookupKey(value)),
  )
  const duplicateCompositeKeyLookup = new Map<string, number>()
  const duplicateCompositeKeyDisplay = new Map<string, string>()

  parsed.rows.forEach((row) => {
    const customerName = row.values.customer_character_name?.trim() ?? ''
    const planName = row.values.membership_plan?.trim() ?? ''
    const givenDate = row.values.given_date?.trim() ?? ''
    const compositeKey = buildCompositeKey({
      customer_character_name: customerName,
      membership_plan: planName,
      given_date: givenDate,
    })

    if (!customerName || !planName || !givenDate) {
      return
    }

    duplicateCompositeKeyLookup.set(
      compositeKey,
      (duplicateCompositeKeyLookup.get(compositeKey) ?? 0) + 1,
    )

    if (!duplicateCompositeKeyDisplay.has(compositeKey)) {
      duplicateCompositeKeyDisplay.set(compositeKey, `${customerName} | ${planName} | ${givenDate}`)
    }
  })

  const duplicateCompositeKeysInCsv = Array.from(duplicateCompositeKeyLookup.entries())
    .filter(([, count]) => count > 1)
    .map(([key]) => duplicateCompositeKeyDisplay.get(key) ?? key)

  const rows = parsed.rows.map<MembershipRecordCsvPreviewRow>((row) => {
    const errors: string[] = []
    const warningsList: string[] = []

    const customerCharacterName = row.values.customer_character_name?.trim() ?? ''
    const membershipPlan = row.values.membership_plan?.trim() ?? ''
    const givenDateResolution = resolveRequiredDate(row.values.given_date ?? '', 'Given Date')
    const expiryDateResolution = resolveDate(row.values.expiry_date ?? '', null, 'Expiry Date')
    const complimentaryItemsGivenRaw = row.values.complimentary_items_given ?? ''
    const statusValue = (row.values.status ?? '').trim().toLowerCase()
    const customerLookupCitizenId = row.values.customer_lookup_citizen_id?.trim() ?? ''
    const issuedByEmployeeCitizenId = row.values.issued_by_employee_citizen_id?.trim() ?? ''

    if (!customerCharacterName) {
      errors.push('Customer Character Name is required.')
    }

    if (!membershipPlan) {
      errors.push('Membership Plan is required.')
    }

    if (!givenDateResolution.value) {
      errors.push(givenDateResolution.error ?? 'Given Date is required.')
    }

    if (expiryDateResolution.error) {
      errors.push(expiryDateResolution.error)
    }

    if (membershipPlan) {
      const matchedPlan = membershipPlanLookup.get(normalizeLookupKey(membershipPlan)) ?? null

      if (!matchedPlan) {
        errors.push(`Membership Plan "${membershipPlan}" was not found.`)
      }
    }

    let complimentaryItemsGiven = false

    try {
      complimentaryItemsGiven = resolveBoolean(complimentaryItemsGivenRaw)
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : 'Complimentary Items Given must be true/false, yes/no, or 1/0.',
      )
    }

    let status: MembershipRecordStatus = 'active'

    if (statusValue.length > 0) {
      if (ALLOWED_STATUSES.has(statusValue as MembershipRecordStatus)) {
        status = statusValue as MembershipRecordStatus
      } else {
        errors.push('Status must be active, expired, cancelled, or archived.')
      }
    }

    const customerSnapshotCitizenId = row.values.customer_citizen_id?.trim() ?? ''
    const matchedCustomer =
      customerLookupCitizenId.length > 0
        ? customerLookup.get(normalizeLookupKey(customerLookupCitizenId)) ?? null
        : null
    const matchedCustomerBySnapshot =
      !matchedCustomer && customerSnapshotCitizenId.length > 0
        ? customerLookup.get(normalizeLookupKey(customerSnapshotCitizenId)) ?? null
        : null
    const resolvedCustomer = matchedCustomer ?? matchedCustomerBySnapshot
    const matchedEmployee =
      issuedByEmployeeCitizenId.length > 0
        ? employeeLookup.get(normalizeLookupKey(issuedByEmployeeCitizenId)) ?? null
        : null

    if (customerLookupCitizenId.length > 0 && !matchedCustomer) {
      warningsList.push('Customer lookup citizen ID was not found; snapshot handling will be used.')
    }

    if (customerSnapshotCitizenId.length > 0 && !resolvedCustomer) {
      warningsList.push('Customer will be created from snapshot fields on import.')
    }

    if (issuedByEmployeeCitizenId.length > 0 && !matchedEmployee) {
      warningsList.push(
        'Issued-by employee citizen ID was not found; issued_by_employee_id will remain blank.',
      )
    }

    const customerId = resolvedCustomer?.id ?? null
    const customerCitizenId = customerSnapshotCitizenId || resolvedCustomer?.citizen_id || null
    const customerPhoneNumber =
      row.values.customer_phone_number?.trim() ||
      resolvedCustomer?.phone_number ||
      null
    const customerDiscordUsername =
      row.values.customer_discord_username?.trim() ||
      resolvedCustomer?.discord_username ||
      null

    const compositeKey = buildCompositeKey({
      customer_character_name: customerCharacterName,
      membership_plan: membershipPlan,
      given_date: givenDateResolution.value ?? row.values.given_date.trim(),
    })

    if (duplicateCompositeKeyLookup.get(compositeKey) && (duplicateCompositeKeyLookup.get(compositeKey) ?? 0) > 1) {
      errors.push('Duplicate membership record appears more than once in the CSV.')
    }

    const existingCompositeKey = existingCompositeKeySet.has(normalizeLookupKey(compositeKey))

    if (existingCompositeKey) {
      warningsList.push(
        'This membership record already exists in the database and will be skipped.',
      )
    }

    const membershipPlanId =
      membershipPlanLookup.get(normalizeLookupKey(membershipPlan))?.id ?? null
    const normalizedGivenDate = givenDateResolution.value ?? row.values.given_date.trim()
    const resolvedExpiryDate =
      expiryDateResolution.value ?? (addDaysToIsoDate(normalizedGivenDate, 28) || null)

    const importState: MembershipRecordCsvPreviewRow['importState'] = errors.length > 0
      ? 'error'
      : existingCompositeKey
        ? 'skipped'
        : 'valid'

    return {
      lineNumber: row.lineNumber,
      values: row.values,
      customer_character_name: customerCharacterName,
      customer_citizen_id: customerCitizenId,
      customer_phone_number: customerPhoneNumber,
      customer_discord_username: customerDiscordUsername,
      customer_lookup_citizen_id: customerLookupCitizenId.length > 0 ? customerLookupCitizenId : null,
      customer_id: customerId,
      membership_plan: membershipPlan,
      membership_plan_id: membershipPlanId,
      issued_by_employee_citizen_id:
        issuedByEmployeeCitizenId.length > 0 ? issuedByEmployeeCitizenId : null,
      issued_by_employee_id: matchedEmployee?.id ?? null,
      given_date: normalizedGivenDate,
      expiry_date: resolvedExpiryDate,
      complimentary_items_given: complimentaryItemsGiven,
      status,
      notes: isBlank(row.values.notes) ? null : row.values.notes.trim(),
      errors,
      warningsList,
      existingCompositeKey,
      duplicateCompositeKeyInCsv:
        duplicateCompositeKeyLookup.get(compositeKey) !== undefined &&
        (duplicateCompositeKeyLookup.get(compositeKey) ?? 0) > 1,
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
    duplicateCompositeKeysInCsv,
    existingCompositeKeys: rows
      .filter((row) => row.existingCompositeKey)
      .map((row) =>
        buildCompositeKey({
          customer_character_name: row.customer_character_name,
          membership_plan: row.membership_plan,
          given_date: row.given_date,
        }),
      ),
    rows,
  }
}

async function buildInsertPayload(row: MembershipRecordCsvPreviewRow) {
  if (row.importState !== 'valid') {
    return null
  }

  const customerId = await ensureCustomerForMembershipSnapshot({
    customer_lookup_citizen_id: row.customer_lookup_citizen_id ?? '',
    customer_citizen_id: row.customer_citizen_id ?? '',
    customer_character_name: row.customer_character_name,
    customer_phone_number: row.customer_phone_number ?? '',
    customer_discord_username: row.customer_discord_username ?? '',
  })

  return {
    customer_id: customerId,
    membership_plan_id: row.membership_plan_id,
    issued_by_employee_id: row.issued_by_employee_id,
    given_date: row.given_date,
    expiry_date: row.expiry_date,
    complimentary_items_given: row.complimentary_items_given,
    status: row.status,
    notes: row.notes,
    archived_at: row.status === 'archived' ? new Date().toISOString() : null,
    deleted_at: null,
    customer_character_name: row.customer_character_name,
    customer_citizen_id: row.customer_citizen_id,
    customer_phone_number: row.customer_phone_number,
    customer_discord_username: row.customer_discord_username,
  }
}

export async function importMembershipRecordCsvRows(
  rows: MembershipRecordCsvPreviewRow[],
) {
  const supabase = getSupabaseClient()
  const insertedMembershipRecords: MembershipRecordRecord[] = []
  const rowErrors: MembershipRecordCsvImportError[] = []
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

    const payload = await buildInsertPayload(row)

    if (!payload) {
      skippedCount += 1
      continue
    }

    const { data, error } = await supabase
      .from('membership_records')
      .insert([payload] as never[])
      .select(membershipRecordSelect)
      .single()

    if (error) {
      failedCount += 1
      rowErrors.push({
        lineNumber: row.lineNumber,
        message: error.message || 'Unable to import membership record row.',
      })
      continue
    }

    insertedCount += 1
    insertedMembershipRecords.push(data as MembershipRecordRecord)
  }

  return {
    insertedCount,
    skippedCount,
    failedCount,
    rowErrors,
    insertedMembershipRecords,
  }
}

export function parseMembershipRecordCsvForPreview(
  csvText: string,
  options: {
    existingCompositeKeys: Iterable<string>
    lookups: MembershipRecordCsvLookups
  },
) {
  const parsed = parseMembershipRecordCsvText(csvText)
  return evaluateMembershipRecordCsvPreview(parsed, options)
}
