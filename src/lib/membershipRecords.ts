import type {
  MembershipRecordRecord,
  MembershipRecordStatus,
  MembershipPlanRecord,
  CustomerRecord,
  EmployeeRecord,
} from '../auth/types'
import { customerSelect } from './customers'
import { getSupabaseClient } from './supabase'

export const membershipRecordSelect = `
  id,
  customer_id,
  membership_plan_id,
  issued_by_employee_id,
  given_date,
  expiry_date,
  complimentary_items_given,
  status,
  notes,
  created_at,
  updated_at,
  archived_at,
  deleted_at,
  customer_character_name,
  customer_citizen_id,
  customer_phone_number,
  customer_discord_username,
  customer:customers(
    id,
    character_name,
    citizen_id,
    phone_number,
    discord_username,
    notes,
    status,
    created_at,
    updated_at,
    archived_at,
    deleted_at
  ),
  membership_plan:membership_plans(
    id,
    plan_name,
    plan_price,
    status,
    archived_at,
    deleted_at
  ),
  issued_by_employee:employees(
    id,
    character_name,
    citizen_id,
    phone_number,
    discord_username,
    status,
    created_at,
    updated_at,
    archived_at,
    deleted_at
  )
`

export type MembershipRecordCustomerMode = 'linked' | 'snapshot'

export interface MembershipRecordFormValues {
  customer_mode: MembershipRecordCustomerMode
  customer_id: string
  customer_character_name: string
  customer_citizen_id: string
  customer_phone_number: string
  customer_discord_username: string
  membership_plan_id: string
  issued_by_employee_id: string
  given_date: string
  expiry_date: string
  expiry_auto_28_days: boolean
  complimentary_items_given: boolean
  status: MembershipRecordStatus
  notes: string
}

interface MembershipRecordMutationPayload {
  customer_id: string | null
  membership_plan_id: string
  issued_by_employee_id: string | null
  given_date: string
  expiry_date: string | null
  complimentary_items_given: boolean
  status: MembershipRecordStatus
  notes: string | null
  archived_at: string | null
  deleted_at: string | null
  customer_character_name: string
  customer_citizen_id: string | null
  customer_phone_number: string | null
  customer_discord_username: string | null
}

function toIsoToday() {
  return new Date().toISOString().slice(0, 10)
}

function normalizeOptionalText(value: string) {
  return value.trim() ? value.trim() : null
}

function normalizeOptionalDate(value: string) {
  return value.trim() ? value.trim() : null
}

function normalizeOptionalCustomerText(value: string) {
  return value.trim() ? value.trim() : null
}

export function addDaysToIsoDate(dateValue: string, days: number) {
  if (!dateValue.trim()) {
    return ''
  }

  const parsed = new Date(`${dateValue.trim()}T00:00:00Z`)

  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  const next = new Date(parsed)
  next.setUTCDate(next.getUTCDate() + days)

  return next.toISOString().slice(0, 10)
}

export function isIsoDateExactlyDaysAfter(
  startDate: string,
  endDate: string,
  days: number,
) {
  if (!startDate.trim() || !endDate.trim()) {
    return false
  }

  return addDaysToIsoDate(startDate, days) === endDate.trim()
}

function isExpiredByDate(record: Pick<MembershipRecordRecord, 'expiry_date' | 'status'>) {
  const today = toIsoToday()

  return (
    record.status === 'expired' ||
    (record.expiry_date !== null && record.expiry_date.trim().length > 0 && record.expiry_date < today)
  )
}

export function isMembershipRecordExpired(record: MembershipRecordRecord) {
  return isExpiredByDate(record)
}

export function isMembershipRecordExpiredByDate(record: Pick<MembershipRecordRecord, 'expiry_date'>) {
  const today = toIsoToday()

  return record.expiry_date !== null && record.expiry_date.trim().length > 0 && record.expiry_date < today
}

export function isMembershipRecordCurrent(record: MembershipRecordRecord) {
  return record.archived_at === null && !isExpiredByDate(record)
}

function sortByCustomerAndDate(records: MembershipRecordRecord[]) {
  return [...records].sort((first, second) => {
    const firstName = first.customer_character_name ?? first.customer?.character_name ?? ''
    const secondName = second.customer_character_name ?? second.customer?.character_name ?? ''

    const nameComparison = firstName.localeCompare(secondName)
    if (nameComparison !== 0) {
      return nameComparison
    }

    const firstDate = new Date(first.given_date).getTime()
    const secondDate = new Date(second.given_date).getTime()

    if (secondDate !== firstDate) {
      return secondDate - firstDate
    }

    return new Date(second.updated_at).getTime() - new Date(first.updated_at).getTime()
  })
}

function sortArchivedRecords(records: MembershipRecordRecord[]) {
  return [...records].sort((first, second) => {
    const firstArchived = new Date(first.archived_at ?? first.updated_at).getTime()
    const secondArchived = new Date(second.archived_at ?? second.updated_at).getTime()

    if (secondArchived !== firstArchived) {
      return secondArchived - firstArchived
    }

    const firstName = first.customer_character_name ?? first.customer?.character_name ?? ''
    const secondName = second.customer_character_name ?? second.customer?.character_name ?? ''

    return firstName.localeCompare(secondName)
  })
}

function isArchivedRecord(record: MembershipRecordRecord) {
  return record.archived_at !== null || record.status === 'archived'
}

export async function ensureCustomerForMembershipSnapshot(input: {
  customer_lookup_citizen_id: string
  customer_citizen_id: string
  customer_character_name: string
  customer_phone_number: string
  customer_discord_username: string
}) {
  const supabase = getSupabaseClient()

  const lookupCitizenId = normalizeOptionalText(input.customer_lookup_citizen_id)
  const snapshotCitizenId = normalizeOptionalText(input.customer_citizen_id)
  const snapshotCharacterName = input.customer_character_name.trim()
  const snapshotPhoneNumber = normalizeOptionalCustomerText(input.customer_phone_number)
  const snapshotDiscordUsername = normalizeOptionalCustomerText(input.customer_discord_username)

  const candidateCitizenIds = [lookupCitizenId, snapshotCitizenId].filter(
    (value): value is string => Boolean(value),
  )

  for (const citizenId of candidateCitizenIds) {
    const { data: existingCustomer, error } = await supabase
      .from('customers')
      .select(customerSelect)
      .eq('citizen_id', citizenId)
      .maybeSingle()
    const existingCustomerRecord = existingCustomer as CustomerRecord | null

    if (error) {
      throw error
    }

    if (!existingCustomerRecord) {
      continue
    }

    const patch: Partial<Pick<CustomerRecord, 'character_name' | 'phone_number' | 'discord_username'>> = {}

    if (
      snapshotCharacterName &&
      (!existingCustomerRecord.character_name.trim() ||
        existingCustomerRecord.character_name.trim() === snapshotCharacterName)
    ) {
      patch.character_name = snapshotCharacterName
    }

    if (
      snapshotPhoneNumber &&
      (!existingCustomerRecord.phone_number ||
        existingCustomerRecord.phone_number.trim().length === 0 ||
        existingCustomerRecord.phone_number.trim() === snapshotPhoneNumber)
    ) {
      patch.phone_number = snapshotPhoneNumber
    }

    if (
      snapshotDiscordUsername &&
      (!existingCustomerRecord.discord_username ||
        existingCustomerRecord.discord_username.trim().length === 0 ||
        existingCustomerRecord.discord_username.trim() === snapshotDiscordUsername)
    ) {
      patch.discord_username = snapshotDiscordUsername
    }

    if (Object.keys(patch).length > 0) {
      const { error: updateError } = await supabase
        .from('customers')
        .update(patch as never)
        .eq('id', existingCustomerRecord.id)

      if (updateError) {
        throw updateError
      }
    }

    return existingCustomerRecord.id
  }

  if (!snapshotCitizenId) {
    return null
  }

  const { data: createdCustomer, error } = await supabase
    .from('customers')
    .insert([
      {
        character_name: snapshotCharacterName,
        citizen_id: snapshotCitizenId,
        phone_number: snapshotPhoneNumber,
        discord_username: snapshotDiscordUsername,
        notes: 'Created from membership record',
        status: 'active',
        archived_at: null,
        deleted_at: null,
      },
    ] as never[])
    .select(customerSelect)
    .single()

  if (error) {
    throw error
  }

  return (createdCustomer as CustomerRecord).id
}

async function buildPayload(values: MembershipRecordFormValues): Promise<MembershipRecordMutationPayload> {
  const customerMode = values.customer_mode
  const customerId = values.customer_id.trim()
  const membershipPlanId = values.membership_plan_id.trim()
  const issuedByEmployeeId = values.issued_by_employee_id.trim()
  const customerCharacterName = values.customer_character_name.trim()

  if (!membershipPlanId) {
    throw new Error('Membership Plan is required.')
  }

  if (!customerCharacterName) {
    throw new Error('Customer Character Name is required.')
  }

  if (customerMode === 'linked' && !customerId) {
    throw new Error('Existing Customer is required when Customer Mode is linked.')
  }

  if (customerMode === 'snapshot' && !customerCharacterName) {
    throw new Error('Customer Character Name is required for snapshot-only buyers.')
  }

  const resolvedCustomerId =
    customerMode === 'linked'
      ? customerId
      : await ensureCustomerForMembershipSnapshot({
          customer_lookup_citizen_id: '',
          customer_citizen_id: values.customer_citizen_id,
          customer_character_name: values.customer_character_name,
          customer_phone_number: values.customer_phone_number,
          customer_discord_username: values.customer_discord_username,
        })

  return {
    customer_id: resolvedCustomerId,
    membership_plan_id: membershipPlanId,
    issued_by_employee_id: issuedByEmployeeId || null,
    given_date: values.given_date.trim() || toIsoToday(),
    expiry_date:
      values.expiry_auto_28_days && (values.given_date.trim() || toIsoToday())
        ? addDaysToIsoDate(values.given_date.trim() || toIsoToday(), 28)
        : normalizeOptionalDate(values.expiry_date),
    complimentary_items_given: values.complimentary_items_given,
    status: values.status,
    notes: normalizeOptionalText(values.notes),
    archived_at: values.status === 'archived' ? new Date().toISOString() : null,
    deleted_at: null,
    customer_character_name: customerCharacterName,
    customer_citizen_id: normalizeOptionalText(values.customer_citizen_id),
    customer_phone_number: normalizeOptionalText(values.customer_phone_number),
    customer_discord_username: normalizeOptionalText(values.customer_discord_username),
  }
}

export function createEmptyMembershipRecordFormValues(): MembershipRecordFormValues {
  const today = toIsoToday()

  return {
    customer_mode: 'snapshot',
    customer_id: '',
    customer_character_name: '',
    customer_citizen_id: '',
    customer_phone_number: '',
    customer_discord_username: '',
    membership_plan_id: '',
    issued_by_employee_id: '',
    given_date: today,
    expiry_date: addDaysToIsoDate(today, 28),
    expiry_auto_28_days: true,
    complimentary_items_given: false,
    status: 'active',
    notes: '',
  }
}

export function membershipRecordToFormValues(
  membershipRecord: MembershipRecordRecord,
): MembershipRecordFormValues {
  return {
    customer_mode: membershipRecord.customer_id ? 'linked' : 'snapshot',
    customer_id: membershipRecord.customer_id ?? '',
    customer_character_name:
      membershipRecord.customer_character_name ?? membershipRecord.customer?.character_name ?? '',
    customer_citizen_id:
      membershipRecord.customer_citizen_id ?? membershipRecord.customer?.citizen_id ?? '',
    customer_phone_number:
      membershipRecord.customer_phone_number ?? membershipRecord.customer?.phone_number ?? '',
    customer_discord_username:
      membershipRecord.customer_discord_username ?? membershipRecord.customer?.discord_username ?? '',
    membership_plan_id: membershipRecord.membership_plan_id,
    issued_by_employee_id: membershipRecord.issued_by_employee_id ?? '',
    given_date: membershipRecord.given_date,
    expiry_date: membershipRecord.expiry_date ?? '',
    expiry_auto_28_days:
      membershipRecord.expiry_date !== null &&
      isIsoDateExactlyDaysAfter(membershipRecord.given_date, membershipRecord.expiry_date, 28),
    complimentary_items_given: membershipRecord.complimentary_items_given,
    status: membershipRecord.status,
    notes: membershipRecord.notes ?? '',
  }
}

export function sortMembershipRecords(records: MembershipRecordRecord[]) {
  const current = records.filter((record) => isMembershipRecordCurrent(record))
  const expired = records.filter(
    (record) => record.archived_at === null && isExpiredByDate(record),
  )
  const archived = records.filter((record) => isArchivedRecord(record))

  return [
    ...sortByCustomerAndDate(current),
    ...sortByCustomerAndDate(expired),
    ...sortArchivedRecords(archived),
  ]
}

export function sortCurrentMembershipRecords(records: MembershipRecordRecord[]) {
  return sortByCustomerAndDate(records.filter((record) => isMembershipRecordCurrent(record)))
}

export function sortExpiredMembershipRecordsOnly(records: MembershipRecordRecord[]) {
  return sortByCustomerAndDate(
    records.filter((record) => record.archived_at === null && isExpiredByDate(record)),
  )
}

export function sortArchivedMembershipRecordsOnly(records: MembershipRecordRecord[]) {
  return sortArchivedRecords(records.filter((record) => isArchivedRecord(record)))
}

export function getMembershipRecordDisplayName(record: MembershipRecordRecord) {
  return record.customer_character_name ?? record.customer?.character_name ?? 'Unknown customer'
}

export function getMembershipRecordCitizenId(record: MembershipRecordRecord) {
  return record.customer_citizen_id ?? record.customer?.citizen_id ?? '-'
}

export function getMembershipRecordPhoneNumber(record: MembershipRecordRecord) {
  return record.customer_phone_number ?? record.customer?.phone_number ?? '-'
}

export function getMembershipRecordDiscordUsername(record: MembershipRecordRecord) {
  return record.customer_discord_username ?? record.customer?.discord_username ?? '-'
}

export async function fetchMembershipRecords() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('membership_records')
    .select(membershipRecordSelect)
    .is('deleted_at', null)

  if (error) {
    throw error
  }

  return sortMembershipRecords((data ?? []) as MembershipRecordRecord[])
}

export async function fetchMembershipRecordsForCustomer(
  customerId: string,
  customerCitizenId: string,
) {
  const supabase = getSupabaseClient()
  const conditions = customerCitizenId
    ? `customer_id.eq.${customerId},customer_citizen_id.eq.${customerCitizenId}`
    : `customer_id.eq.${customerId}`

  const { data, error } = await supabase
    .from('membership_records')
    .select(membershipRecordSelect)
    .is('deleted_at', null)
    .is('archived_at', null)
    .or(conditions)

  if (error) {
    throw error
  }

  return sortCurrentMembershipRecords((data ?? []) as MembershipRecordRecord[])
}

export async function fetchMembershipRecordHistory(options: {
  customerId: string | null
  customerCitizenId: string | null
}) {
  const supabase = getSupabaseClient()
  const customerId = options.customerId?.trim() ?? ''
  const customerCitizenId = options.customerCitizenId?.trim() ?? ''

  const query = supabase
    .from('membership_records')
    .select(membershipRecordSelect)
    .is('deleted_at', null)
    .is('archived_at', null)
    .in('status', ['active', 'expired', 'cancelled'])

  if (customerId) {
    const { data, error } = await query.eq('customer_id', customerId)

    if (error) {
      throw error
    }

    return sortMembershipRecordHistory((data ?? []) as MembershipRecordRecord[])
  }

  if (customerCitizenId) {
    const { data, error } = await query.eq('customer_citizen_id', customerCitizenId)

    if (error) {
      throw error
    }

    return sortMembershipRecordHistory((data ?? []) as MembershipRecordRecord[])
  }

  return []
}

export function sortMembershipRecordHistory(records: MembershipRecordRecord[]) {
  return [...records].sort((first, second) => {
    const firstDate = new Date(second.given_date).getTime()
    const secondDate = new Date(first.given_date).getTime()

    if (firstDate !== secondDate) {
      return firstDate - secondDate
    }

    return new Date(second.updated_at).getTime() - new Date(first.updated_at).getTime()
  })
}

export async function createMembershipRecord(values: MembershipRecordFormValues) {
  const supabase = getSupabaseClient()
  const payload = await buildPayload(values)
  const { data, error } = await supabase
    .from('membership_records')
    .insert([payload] as never[])
    .select(membershipRecordSelect)
    .single()

  if (error) {
    throw error
  }

  return data as MembershipRecordRecord
}

export async function updateMembershipRecord(
  membershipRecordId: string,
  values: MembershipRecordFormValues,
) {
  const supabase = getSupabaseClient()
  const payload = await buildPayload(values)
  const { data, error } = await supabase
    .from('membership_records')
    .update(payload as never)
    .eq('id', membershipRecordId)
    .select(membershipRecordSelect)
    .single()

  if (error) {
    throw error
  }

  return data as MembershipRecordRecord
}

export async function archiveMembershipRecord(membershipRecordId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('membership_records')
    .update({
      archived_at: new Date().toISOString(),
      status: 'archived',
    } as never)
    .eq('id', membershipRecordId)
    .select(membershipRecordSelect)
    .single()

  if (error) {
    throw error
  }

  return data as MembershipRecordRecord
}

export async function markExpiredMembershipRecord(membershipRecordId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('membership_records')
    .update({
      status: 'expired',
    } as never)
    .eq('id', membershipRecordId)
    .select(membershipRecordSelect)
    .single()

  if (error) {
    throw error
  }

  return data as MembershipRecordRecord
}

export async function restoreMembershipRecord(membershipRecordId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('membership_records')
    .update({
      archived_at: null,
      status: 'active',
    } as never)
    .eq('id', membershipRecordId)
    .select(membershipRecordSelect)
    .single()

  if (error) {
    throw error
  }

  return data as MembershipRecordRecord
}

export async function softDeleteMembershipRecord(membershipRecordId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('membership_records')
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id', membershipRecordId)
    .select(membershipRecordSelect)
    .single()

  if (error) {
    throw error
  }

  return data as MembershipRecordRecord
}

export function isMembershipRecordArchived(record: MembershipRecordRecord) {
  return isArchivedRecord(record)
}

export function membershipRecordToCustomerSnapshot(
  customer: CustomerRecord,
): Pick<
  MembershipRecordFormValues,
  | 'customer_id'
  | 'customer_character_name'
  | 'customer_citizen_id'
  | 'customer_phone_number'
  | 'customer_discord_username'
> {
  return {
    customer_id: customer.id,
    customer_character_name: customer.character_name,
    customer_citizen_id: customer.citizen_id,
    customer_phone_number: customer.phone_number ?? '',
    customer_discord_username: customer.discord_username ?? '',
  }
}

export function membershipRecordCustomerOptions(
  customers: CustomerRecord[],
  selectedCustomerId: string,
) {
  const selectedCustomer =
    customers.find((customer) => customer.id === selectedCustomerId) ?? null

  if (!selectedCustomer) {
    return customers
  }

  return customers.some((customer) => customer.id === selectedCustomer.id)
    ? customers
    : [selectedCustomer, ...customers]
}

export function membershipRecordEmployeeOptions(employees: EmployeeRecord[]) {
  return employees.filter(
    (employee) =>
      employee.status === 'active' && employee.archived_at === null && employee.deleted_at === null,
  )
}

export function membershipRecordPlanOptions(plans: MembershipPlanRecord[]) {
  return plans.filter((plan) => plan.deleted_at === null)
}
