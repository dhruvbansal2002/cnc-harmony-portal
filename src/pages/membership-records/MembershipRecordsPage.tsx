import { Fragment, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../../auth/useAuth'
import type {
  CustomerRecord,
  EmployeeRecord,
  MembershipPlanRecord,
  MembershipRecordRecord,
  MembershipRecordStatus,
} from '../../auth/types'
import { MembershipRecordCsvImport } from '../../components/membership-records/MembershipRecordCsvImport'
import { ActionMenu } from '../../components/ui/ActionMenu'
import { MembershipRecordForm } from '../../components/membership-records/MembershipRecordForm'
import { fetchCustomers } from '../../lib/customers'
import { fetchEmployees } from '../../lib/employees'
import { fetchMembershipPlans } from '../../lib/membershipPlans'
import {
  archiveMembershipRecord,
  createMembershipRecord,
  fetchMembershipRecords,
  fetchMembershipRecordsForCustomer,
  getMembershipRecordCitizenId,
  getMembershipRecordDiscordUsername,
  getMembershipRecordDisplayName,
  getMembershipRecordPhoneNumber,
  membershipRecordEmployeeOptions,
  membershipRecordPlanOptions,
  membershipRecordToFormValues,
  markExpiredMembershipRecord,
  restoreMembershipRecord,
  softDeleteMembershipRecord,
  sortArchivedMembershipRecordsOnly,
  sortCurrentMembershipRecords,
  sortExpiredMembershipRecordsOnly,
  sortMembershipRecords,
  updateMembershipRecord,
  type MembershipRecordFormValues,
} from '../../lib/membershipRecords'
import { importMembershipRecordCsvRows } from '../../lib/membershipRecordCsvImport'

const ROWS_PER_PAGE = 20

const statusFilterOptions = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'archived', label: 'Archived' },
] as const

function accessLabel(accessLevel: string | null) {
  return accessLevel === 'management'
    ? 'Management'
    : accessLevel === 'employee'
      ? 'Employee'
      : accessLevel === 'customer'
        ? 'Customer'
        : 'Unknown'
}

function currentUserLabel({
  accessLevel,
  authEmail,
  characterName,
}: {
  accessLevel: string | null
  authEmail: string | undefined
  characterName: string | null
}) {
  return characterName ?? authEmail ?? accessLabel(accessLevel)
}

function formatDate(value: string | null) {
  if (!value) {
    return '-'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return '-'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed)
}

function formatDateTime(value: string | null) {
  if (!value) {
    return '-'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return '-'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed)
}

function StatusBadge({
  tone,
  children,
}: {
  tone: 'success' | 'warning' | 'neutral' | 'danger'
  children: ReactNode
}) {
  const toneClasses: Record<typeof tone, string> = {
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
    neutral: 'border-white/10 bg-white/5 text-slate-200',
    danger: 'border-rose-500/30 bg-rose-500/10 text-rose-100',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.18em] ${toneClasses[tone]}`}
    >
      {children}
    </span>
  )
}

function FieldPill({
  enabled,
  children,
}: {
  enabled: boolean
  children: ReactNode
}) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.16em]',
        enabled
          ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100'
          : 'border-white/10 bg-white/5 text-slate-500',
      ].join(' ')}
    >
      {children}
    </span>
  )
}

function MembershipRecordStatusBadge({
  status,
}: {
  status: MembershipRecordStatus
}) {
  const toneMap: Record<MembershipRecordStatus, { tone: 'success' | 'warning' | 'neutral' | 'danger'; label: string }> = {
    active: { tone: 'success', label: 'Active' },
    expired: { tone: 'warning', label: 'Expired' },
    cancelled: { tone: 'neutral', label: 'Cancelled' },
    archived: { tone: 'danger', label: 'Archived' },
  }

  const badge = toneMap[status]
  return <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
}

function isMembershipRecordExpiredByDate(record: MembershipRecordRecord) {
  if (record.status !== 'active' || !record.expiry_date) {
    return false
  }

  return record.expiry_date < new Date().toISOString().slice(0, 10)
}

function CustomerStatusBadge({ status }: { status: CustomerRecord['status'] }) {
  const toneMap: Record<CustomerRecord['status'], { tone: 'success' | 'warning' | 'neutral' | 'danger'; label: string }> = {
    active: { tone: 'success', label: 'Active' },
    inactive: { tone: 'warning', label: 'Inactive' },
    archived: { tone: 'danger', label: 'Archived' },
  }

  const badge = toneMap[status]
  return <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
}

function boolLabel(value: boolean) {
  return value ? 'Yes' : 'No'
}

function CustomerIdentityBlock({
  customer,
  showNotes,
}: {
  customer: MembershipRecordRecord['customer']
  showNotes: boolean
}) {
  if (!customer) {
    return (
      <p className="text-sm text-slate-400">Linked customer profile not available.</p>
    )
  }

  return (
    <div className="grid gap-4 rounded-[1.5rem] border border-white/10 bg-slate-950/60 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
          Linked Customer Profile
        </p>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Character Name</p>
            <p className="mt-1 text-sm text-slate-200">{customer.character_name}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Citizen ID</p>
            <p className="mt-1 text-sm text-slate-200">{customer.citizen_id}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Phone Number</p>
            <p className="mt-1 text-sm text-slate-200">{customer.phone_number ?? '-'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Discord Username</p>
            <p className="mt-1 text-sm text-slate-200">{customer.discord_username ?? '-'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Status</p>
            <p className="mt-1 text-sm text-slate-200">
              <CustomerStatusBadge status={customer.status} />
            </p>
          </div>
          {showNotes ? (
            <div className="lg:col-span-2">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Notes</p>
              <p className="mt-1 text-sm text-slate-200">{customer.notes ?? '-'}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function MembershipRecordDetailPanel({
  record,
  showNotes,
}: {
  record: MembershipRecordRecord
  showNotes: boolean
}) {
  return (
    <div className="grid gap-4 rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-4 sm:p-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Customer Snapshot
            </p>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Character Name</p>
                <p className="mt-1 text-sm text-slate-200">
                  {record.customer_character_name ?? getMembershipRecordDisplayName(record)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Citizen ID</p>
                <p className="mt-1 text-sm text-slate-200">{getMembershipRecordCitizenId(record)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Phone Number</p>
                <p className="mt-1 text-sm text-slate-200">{getMembershipRecordPhoneNumber(record)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Discord Username</p>
                <p className="mt-1 text-sm text-slate-200">
                  {getMembershipRecordDiscordUsername(record)}
                </p>
              </div>
            </div>
          </div>

          <CustomerIdentityBlock customer={record.customer} showNotes={showNotes} />
        </div>

        <div className="grid gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Membership Plan
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-200">
              {record.membership_plan?.plan_name ?? 'Unknown plan'}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Issuing Employee
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-200">
              {record.issued_by_employee?.character_name ?? 'Unassigned'}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Given Date
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-200">{formatDate(record.given_date)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Expiry Date
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-200">
              {formatDate(record.expiry_date)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Complimentary Items Given
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-200">
              {boolLabel(record.complimentary_items_given)}
            </p>
          </div>
          {showNotes ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Notes
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-200">{record.notes ?? '-'}</p>
            </div>
          ) : null}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Status
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <MembershipRecordStatusBadge status={record.status} />
              {isMembershipRecordExpiredByDate(record) ? (
                <StatusBadge tone="warning">Expired</StatusBadge>
              ) : null}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Created At
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-200">
              {formatDateTime(record.created_at)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Updated At
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-200">
              {formatDateTime(record.updated_at)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function MembershipRecordTable({
  title,
  records,
  accessLevel,
  expandedRecordId,
  onToggleExpanded,
  onStartEdit,
  onArchive,
  onMarkExpired,
  onRestore,
  onDelete,
  showArchiveActions = false,
  editingRecordId,
  editingRecord,
  editingError,
  editingSubmitting,
  onSubmitEdit,
  onCancelEdit,
  actionTargetId,
  showActions,
  customerOptions,
  membershipPlans,
  employeeOptions,
}: {
  title: string
  records: MembershipRecordRecord[]
  accessLevel: 'management' | 'employee' | 'customer'
  expandedRecordId: string | null
  onToggleExpanded: (recordId: string) => void
  onStartEdit: (record: MembershipRecordRecord) => void
  onArchive: (record: MembershipRecordRecord) => void
  onMarkExpired?: (record: MembershipRecordRecord) => void
  onRestore: (record: MembershipRecordRecord) => void
  onDelete: (record: MembershipRecordRecord) => void
  showArchiveActions?: boolean
  editingRecordId: string | null
  editingRecord: MembershipRecordRecord | null
  editingError: string | null
  editingSubmitting: boolean
  onSubmitEdit: (values: MembershipRecordFormValues) => Promise<void>
  onCancelEdit: () => void
  actionTargetId: string | null
  showActions: boolean
  customerOptions: CustomerRecord[]
  membershipPlans: MembershipPlanRecord[]
  employeeOptions: EmployeeRecord[]
}) {
  const canManage = accessLevel === 'management'

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
            {title}
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
            {records.length} {records.length === 1 ? 'record' : 'records'}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <FieldPill enabled={false}>{showArchiveActions ? 'Archived' : 'Current'}</FieldPill>
          <FieldPill enabled>{'20 rows per page'}</FieldPill>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-[1320px] w-full border-separate border-spacing-0">
          <thead>
            <tr className="text-left text-[0.7rem] uppercase tracking-[0.28em] text-slate-500">
              <th className="border-b border-white/10 px-4 py-3">Customer Name</th>
              <th className="border-b border-white/10 px-4 py-3">Citizen ID</th>
              <th className="border-b border-white/10 px-4 py-3">Membership Plan</th>
              <th className="border-b border-white/10 px-4 py-3">Issued By</th>
              <th className="border-b border-white/10 px-4 py-3">Given Date</th>
              <th className="border-b border-white/10 px-4 py-3">Expiry Date</th>
              <th className="border-b border-white/10 px-4 py-3">Complimentary Items Given</th>
              <th className="border-b border-white/10 px-4 py-3">Status</th>
              {showActions ? <th className="border-b border-white/10 px-4 py-3">Actions</th> : null}
            </tr>
          </thead>

          <tbody>
            {records.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-sm text-slate-400" colSpan={showActions ? 9 : 8}>
                  No membership records found.
                </td>
              </tr>
            ) : (
              records.map((record) => {
                const isExpanded = expandedRecordId === record.id
                const isEditing = editingRecordId === record.id

                return (
                  <Fragment key={record.id}>
                    <tr className="align-top">
                      <td className="border-b border-white/5 px-4 py-4">
                        <button
                          className="text-left text-sm font-semibold text-white transition hover:text-cyan-200"
                          onClick={() => onToggleExpanded(record.id)}
                          type="button"
                        >
                          {getMembershipRecordDisplayName(record)}
                        </button>
                        <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-500">
                          {record.customer_id ? 'Linked profile' : 'Snapshot only'}
                        </p>
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {getMembershipRecordCitizenId(record)}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {record.membership_plan?.plan_name ?? 'Unknown plan'}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {record.issued_by_employee?.character_name ?? 'Unassigned'}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {formatDate(record.given_date)}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {formatDate(record.expiry_date)}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {boolLabel(record.complimentary_items_given)}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <MembershipRecordStatusBadge status={record.status} />
                          {isMembershipRecordExpiredByDate(record) ? (
                            <StatusBadge tone="warning">Expired</StatusBadge>
                          ) : null}
                        </div>
                      </td>
                      {showActions ? (
                        <td className="border-b border-white/5 px-4 py-4">
                          {canManage ? (
                            <ActionMenu triggerLabel="Actions">
                                {!showArchiveActions ? (
                                  <>
                                    <button
                                      className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/5"
                                      onClick={() => onStartEdit(record)}
                                      type="button"
                                    >
                                      Edit
                                    </button>
                                    {onMarkExpired && record.status !== 'expired' ? (
                                      <button
                                        className="block w-full rounded-xl px-3 py-2 text-left text-sm text-amber-100 transition hover:bg-amber-500/10"
                                        onClick={() => onMarkExpired(record)}
                                        type="button"
                                      >
                                        Mark Expired
                                      </button>
                                    ) : null}
                                    <button
                                      className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/5"
                                      onClick={() => onArchive(record)}
                                      type="button"
                                    >
                                      Archive
                                    </button>
                                    <button
                                      className="block w-full rounded-xl px-3 py-2 text-left text-sm text-rose-100 transition hover:bg-rose-500/10"
                                      onClick={() => onDelete(record)}
                                      type="button"
                                    >
                                      Delete
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      className="block w-full rounded-xl px-3 py-2 text-left text-sm text-emerald-100 transition hover:bg-emerald-500/10"
                                      onClick={() => onRestore(record)}
                                      type="button"
                                    >
                                      Restore
                                    </button>
                                    <button
                                      className="block w-full rounded-xl px-3 py-2 text-left text-sm text-rose-100 transition hover:bg-rose-500/10"
                                      onClick={() => onDelete(record)}
                                      type="button"
                                    >
                                      Delete
                                    </button>
                                  </>
                                )}
                          </ActionMenu>
                          ) : (
                            <span className="text-sm text-slate-500">Read only</span>
                          )}
                        </td>
                      ) : null}
                    </tr>

                    {isExpanded && !isEditing ? (
                      <tr>
                        <td className="border-b border-white/5 px-4 pb-5 pt-0" colSpan={showActions ? 9 : 8}>
                          <MembershipRecordDetailPanel record={record} showNotes={accessLevel !== 'customer'} />
                        </td>
                      </tr>
                    ) : null}

                    {isEditing && editingRecord ? (
                      <tr>
                        <td className="border-b border-white/5 px-4 pb-5 pt-0" colSpan={showActions ? 9 : 8}>
                          <MembershipRecordForm
                            key={editingRecord.id}
                            description="Update the membership record in Supabase. Changes save immediately."
                            error={editingError}
                            initialValues={membershipRecordToFormValues(editingRecord)}
                            isSubmitting={editingSubmitting}
                            customerOptions={customerOptions}
                            membershipPlans={membershipPlans}
                            employeeOptions={employeeOptions}
                            onCancel={onCancelEdit}
                            onSubmit={onSubmitEdit}
                            submitLabel="Save changes"
                            title="Edit membership record"
                            variant="inline"
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {canManage && actionTargetId ? (
        <div className="sr-only" aria-live="polite">
          Saving membership record changes.
        </div>
      ) : null}
    </section>
  )
}

export function MembershipRecordsPage() {
  const { accessLevel, authUser, employee, customer } = useAuth()

  const activeAccessLevel = accessLevel ?? 'customer'
  const [membershipRecords, setMembershipRecords] = useState<MembershipRecordRecord[]>([])
  const [customerOptions, setCustomerOptions] = useState<CustomerRecord[]>([])
  const [membershipPlanOptions, setMembershipPlanOptions] = useState<MembershipPlanRecord[]>([])
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [bannerMessage, setBannerMessage] = useState<string | null>(null)
  const [bannerTone, setBannerTone] = useState<'success' | 'error' | 'warning' | null>(null)
  const [createVisible, setCreateVisible] = useState(false)
  const [importVisible, setImportVisible] = useState(false)
  const [createRevision, setCreateRevision] = useState(0)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null)
  const [editingError, setEditingError] = useState<string | null>(null)
  const [editingSubmitting, setEditingSubmitting] = useState(false)
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null)
  const [actionTargetId, setActionTargetId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [membershipPlanFilter, setMembershipPlanFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilterOptions)[number]['value']>('all')
  const [issuedEmployeeFilter, setIssuedEmployeeFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [expiredPage, setExpiredPage] = useState(1)
  const [archivePage, setArchivePage] = useState(1)

  const showManagementControls = activeAccessLevel !== 'customer'
  const canManage = activeAccessLevel === 'management'

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      if (activeAccessLevel === 'customer') {
        if (!customer) {
          return
        }

        setLoading(true)
        setPageError(null)

        try {
          const data = await fetchMembershipRecordsForCustomer(customer.id, customer.citizen_id)

          if (!isMounted) {
            return
          }

          setMembershipRecords(data)
        } catch (error) {
          if (!isMounted) {
            return
          }

          const message =
            error instanceof Error ? error.message : 'Unable to load membership records.'
          setPageError(message)
        } finally {
          if (isMounted) {
            setLoading(false)
          }
        }

        return
      }

      setLoading(true)
      setPageError(null)

      try {
        const recordPromise = fetchMembershipRecords()
        const planPromise = fetchMembershipPlans()
        const employeePromise = fetchEmployees()
        const customerPromise = canManage ? fetchCustomers() : Promise.resolve([] as CustomerRecord[])

        const [recordData, planData, employeeData, customerData] = await Promise.all([
          recordPromise,
          planPromise,
          employeePromise,
          customerPromise,
        ])

        if (!isMounted) {
          return
        }

        setMembershipRecords(recordData)
        setMembershipPlanOptions(planData)
        setEmployeeOptions(employeeData)
        setCustomerOptions(customerData)
      } catch (error) {
        if (!isMounted) {
          return
        }

        const message =
          error instanceof Error ? error.message : 'Unable to load membership records.'
        setPageError(message)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void loadData()

    return () => {
      isMounted = false
    }
  }, [activeAccessLevel, canManage, customer])

  const currentUser = currentUserLabel({
    accessLevel: activeAccessLevel,
    authEmail: authUser?.email,
    characterName: employee?.character_name ?? customer?.character_name ?? null,
  })
  const searchTerm = searchQuery.trim().toLowerCase()
  const activeEmployeeOptions = membershipRecordEmployeeOptions(employeeOptions)
  const existingCompositeKeys = useMemo(
    () =>
      membershipRecords.map((record) =>
        [
          getMembershipRecordDisplayName(record).trim().toLowerCase(),
          record.membership_plan?.plan_name?.trim().toLowerCase() ?? '',
          record.given_date.trim().toLowerCase(),
        ].join('|'),
      ),
    [membershipRecords],
  )
  const activeMembershipRecords =
    activeAccessLevel === 'customer'
      ? sortCurrentMembershipRecords(membershipRecords)
      : sortCurrentMembershipRecords(membershipRecords).filter((record) => {
          const customerName = getMembershipRecordDisplayName(record).toLowerCase()
          return (
            customerName.includes(searchTerm) &&
            (membershipPlanFilter === 'all'
              ? true
              : record.membership_plan_id === membershipPlanFilter) &&
            (statusFilter === 'all' ? true : statusFilter === record.status) &&
            (issuedEmployeeFilter === 'all'
              ? true
              : record.issued_by_employee_id === issuedEmployeeFilter)
          )
        })

  const expiredMembershipRecords =
    activeAccessLevel === 'customer'
      ? []
      : sortExpiredMembershipRecordsOnly(membershipRecords).filter((record) => {
          const customerName = getMembershipRecordDisplayName(record).toLowerCase()
          return (
            customerName.includes(searchTerm) &&
            (membershipPlanFilter === 'all'
              ? true
              : record.membership_plan_id === membershipPlanFilter) &&
            (statusFilter === 'all' || statusFilter === 'expired') &&
            (issuedEmployeeFilter === 'all'
              ? true
              : record.issued_by_employee_id === issuedEmployeeFilter)
          )
        })

  const archivedMembershipRecords = sortArchivedMembershipRecordsOnly(membershipRecords).filter(
    (record) => getMembershipRecordDisplayName(record).toLowerCase().includes(searchTerm),
  )

  const activeTotalPages = Math.max(1, Math.ceil(activeMembershipRecords.length / ROWS_PER_PAGE))
  const activeDisplayPage = Math.min(currentPage, activeTotalPages)
  const pagedActiveMembershipRecords = activeMembershipRecords.slice(
    (activeDisplayPage - 1) * ROWS_PER_PAGE,
    activeDisplayPage * ROWS_PER_PAGE,
  )

  const expiredTotalPages = Math.max(1, Math.ceil(expiredMembershipRecords.length / ROWS_PER_PAGE))
  const expiredDisplayPage = Math.min(expiredPage, expiredTotalPages)
  const pagedExpiredMembershipRecords = expiredMembershipRecords.slice(
    (expiredDisplayPage - 1) * ROWS_PER_PAGE,
    expiredDisplayPage * ROWS_PER_PAGE,
  )

  const archiveTotalPages = Math.max(1, Math.ceil(archivedMembershipRecords.length / ROWS_PER_PAGE))
  const archiveDisplayPage = Math.min(archivePage, archiveTotalPages)
  const pagedArchivedMembershipRecords = archivedMembershipRecords.slice(
    (archiveDisplayPage - 1) * ROWS_PER_PAGE,
    archiveDisplayPage * ROWS_PER_PAGE,
  )

  const editingRecord =
    editingRecordId === null
      ? null
      : membershipRecords.find((record) => record.id === editingRecordId) ?? null

  function showBanner(message: string, tone: 'success' | 'error' | 'warning') {
    setBannerMessage(message)
    setBannerTone(tone)
  }

  function syncRecord(updatedRecord: MembershipRecordRecord) {
    setMembershipRecords((current) => {
      const nextRecords = current.some((record) => record.id === updatedRecord.id)
        ? current.map((record) => (record.id === updatedRecord.id ? updatedRecord : record))
        : [updatedRecord, ...current]

      return sortMembershipRecords(nextRecords.filter((record) => record.deleted_at === null))
    })
  }

  function removeRecord(recordId: string) {
    setMembershipRecords((current) => current.filter((record) => record.id !== recordId))
  }

  function beginCreate() {
    setCreateVisible(true)
    setImportVisible(false)
    setEditingRecordId(null)
    setCreateError(null)
    setEditingError(null)
    setBannerMessage(null)
    setCreateRevision((current) => current + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function beginImport() {
    setImportVisible(true)
    setCreateVisible(false)
    setEditingRecordId(null)
    setCreateError(null)
    setEditingError(null)
    setBannerMessage(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function beginEdit(record: MembershipRecordRecord) {
    setEditingRecordId(record.id)
    setCreateVisible(false)
    setImportVisible(false)
    setCreateError(null)
    setEditingError(null)
    setBannerMessage(null)
    setExpandedRecordId(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingRecordId(null)
    setEditingError(null)
  }

  function cancelCreate() {
    setCreateVisible(false)
    setCreateError(null)
  }

  function cancelImport() {
    setImportVisible(false)
  }

  async function handleCreate(values: MembershipRecordFormValues) {
    setCreateSubmitting(true)
    setCreateError(null)
    setBannerMessage(null)

    try {
      const created = await createMembershipRecord(values)
      syncRecord(created)
      cancelCreate()
      setExpandedRecordId(created.id)
      showBanner('Created membership record.', 'success')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to create membership record.'
      setCreateError(message)
      showBanner(message, 'error')
    } finally {
      setCreateSubmitting(false)
    }
  }

  async function handleCsvImport(
    rows: Parameters<typeof importMembershipRecordCsvRows>[0],
  ) {
    setBannerMessage(null)

    const result = await importMembershipRecordCsvRows(rows)

    result.insertedMembershipRecords.forEach((membershipRecord) => {
      syncRecord(membershipRecord)
    })

    if (result.insertedCount > 0) {
      setExpandedRecordId(result.insertedMembershipRecords[0]?.id ?? null)
    }

    setImportVisible(false)

    showBanner(
      `Imported ${result.insertedCount} membership record${result.insertedCount === 1 ? '' : 's'}; ${result.skippedCount} skipped; ${result.failedCount} failed.`,
      result.failedCount > 0 ? 'warning' : 'success',
    )

    return result
  }

  async function handleEdit(values: MembershipRecordFormValues) {
    if (!editingRecordId) {
      return
    }

    const currentLinkedCitizenId =
      editingRecord?.customer?.citizen_id ?? editingRecord?.customer_citizen_id ?? ''

    if (
      editingRecord?.customer_id &&
      values.customer_mode === 'linked' &&
      values.customer_id &&
      values.customer_id !== editingRecord.customer_id
    ) {
      const confirmed = window.confirm(
        'Change the linked customer for this membership record?',
      )

      if (!confirmed) {
        return
      }
    }

    if (
      editingRecord?.customer_id &&
      values.customer_mode === 'snapshot' &&
      values.customer_citizen_id.trim() &&
      currentLinkedCitizenId.trim() &&
      values.customer_citizen_id.trim() !== currentLinkedCitizenId.trim()
    ) {
      const confirmed = window.confirm(
        'This will link or create a different customer record. Continue?',
      )

      if (!confirmed) {
        return
      }
    }

    setEditingSubmitting(true)
    setEditingError(null)
    setBannerMessage(null)

    try {
      const updated = await updateMembershipRecord(editingRecordId, values)
      syncRecord(updated)
      setEditingRecordId(null)
      setExpandedRecordId(updated.id)
      showBanner('Updated membership record.', 'success')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to update membership record.'
      setEditingError(message)
      showBanner(message, 'error')
    } finally {
      setEditingSubmitting(false)
    }
  }

  async function handleArchive(record: MembershipRecordRecord) {
    setActionTargetId(record.id)
    setBannerMessage(null)

    try {
      const updated = await archiveMembershipRecord(record.id)
      syncRecord(updated)
      if (editingRecordId === record.id) {
        cancelEdit()
      }
      showBanner('Archived membership record.', 'success')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to archive membership record.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  async function handleMarkExpired(record: MembershipRecordRecord) {
    const confirmed = window.confirm('Mark this membership record as expired?')
    if (!confirmed) {
      return
    }

    setActionTargetId(record.id)
    setBannerMessage(null)

    try {
      const updated = await markExpiredMembershipRecord(record.id)
      syncRecord(updated)
      showBanner('Marked membership record as expired.', 'success')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to mark membership record as expired.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  async function handleRestore(record: MembershipRecordRecord) {
    const confirmed = window.confirm('Restore this membership record back to active status?')
    if (!confirmed) {
      return
    }

    setActionTargetId(record.id)
    setBannerMessage(null)

    try {
      const updated = await restoreMembershipRecord(record.id)
      syncRecord(updated)
      showBanner('Restored membership record.', 'success')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to restore membership record.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  async function handleDelete(record: MembershipRecordRecord) {
    const confirmed = window.confirm(
      'Soft delete this membership record? This will remove it from all lists.',
    )

    if (!confirmed) {
      return
    }

    setActionTargetId(record.id)
    setBannerMessage(null)

    try {
      await softDeleteMembershipRecord(record.id)
      removeRecord(record.id)
      if (editingRecordId === record.id) {
        cancelEdit()
      }
      if (expandedRecordId === record.id) {
        setExpandedRecordId(null)
      }
      showBanner('Deleted membership record.', 'success')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to delete membership record.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  if (activeAccessLevel === 'customer' && !customer) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Membership Records
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Customer profile not available
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          This portal account does not have a linked customer profile. Contact management to
          complete portal setup.
        </p>
      </section>
    )
  }

  if (loading) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Membership Records
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Loading membership records</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Fetching membership records from Supabase.
        </p>
      </section>
    )
  }

  if (pageError) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Membership Records
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Unable to load membership records
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">{pageError}</p>
        <button
          className="mt-6 rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          onClick={() => window.location.reload()}
          type="button"
        >
          Retry
        </button>
      </section>
    )
  }

  if (activeAccessLevel === 'customer') {
    return (
      <section className="space-y-6">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
                Membership Records
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Your Membership Records
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                You are viewing the membership records linked to {currentUser}. Only your own
                current membership records are shown here.
              </p>
            </div>
            <FieldPill enabled>{currentUser}</FieldPill>
          </div>
        </div>

        <MembershipRecordTable
          accessLevel="customer"
          actionTargetId={actionTargetId}
          editingError={editingError}
          editingRecord={editingRecord}
          editingRecordId={editingRecordId}
          editingSubmitting={editingSubmitting}
          expandedRecordId={expandedRecordId}
          customerOptions={customerOptions}
          employeeOptions={employeeOptions}
          membershipPlans={membershipPlanOptions}
          onArchive={handleArchive}
          onCancelEdit={cancelEdit}
          onDelete={handleDelete}
          onRestore={handleRestore}
          onStartEdit={beginEdit}
          onSubmitEdit={handleEdit}
          onToggleExpanded={(recordId) =>
            setExpandedRecordId((current) => (current === recordId ? null : recordId))
          }
          records={pagedActiveMembershipRecords}
          showActions={false}
          title="Current membership records"
        />
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
              Membership Records
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Membership Records Control Center
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Membership records are sourced from Supabase. Current view is limited to{' '}
              {accessLabel(activeAccessLevel)} access.
            </p>
          </div>

          <div className="grid gap-3 sm:text-right">
            <FieldPill enabled={false}>{activeMembershipRecords.length} active</FieldPill>
            <FieldPill enabled={false}>{expiredMembershipRecords.length} expired</FieldPill>
            {canManage ? (
              <FieldPill enabled={false}>{archivedMembershipRecords.length} archived</FieldPill>
            ) : (
              <FieldPill enabled>Read only</FieldPill>
            )}
            <FieldPill enabled>{currentUser}</FieldPill>
          </div>
        </div>
      </div>

      {bannerMessage ? (
        <div
          className={[
            'rounded-2xl border px-4 py-3 text-sm',
            bannerTone === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
              : bannerTone === 'warning'
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-100',
          ].join(' ')}
        >
          {bannerMessage}
        </div>
      ) : null}

      {canManage ? (
        <div className="space-y-4">
          <div className="flex flex-wrap justify-end gap-3">
            <button
              className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-slate-900"
              onClick={beginCreate}
              type="button"
            >
              Create Membership Record
            </button>
            <button
              className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              onClick={beginImport}
              type="button"
            >
              Import CSV
            </button>
          </div>

          {createVisible ? (
            <MembershipRecordForm
              key={createRevision}
              description="Create a membership record in Supabase. Use linked customer mode or snapshot-only buyer mode."
              error={createError}
              isSubmitting={createSubmitting}
              customerOptions={customerOptions}
              membershipPlans={membershipRecordPlanOptions(membershipPlanOptions)}
              employeeOptions={activeEmployeeOptions}
              onCancel={cancelCreate}
              onSubmit={handleCreate}
              submitLabel="Create Membership Record"
              title="Create membership record"
            />
          ) : null}

          {importVisible ? (
            <MembershipRecordCsvImport
              customers={customerOptions}
              employees={employeeOptions}
              existingCompositeKeys={existingCompositeKeys}
              membershipPlans={membershipPlanOptions}
              onClose={cancelImport}
              onConfirmImport={handleCsvImport}
            />
          ) : null}
        </div>
      ) : null}

      {showManagementControls ? (
        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
                Filters
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
                Search and filters
              </h2>
            </div>
            <div className="text-sm text-slate-400">
              Showing page {activeDisplayPage} of {activeTotalPages}
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Search by Customer Name
              </span>
              <input
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
                onChange={(event) => {
                  setSearchQuery(event.target.value)
                  setCurrentPage(1)
                  setExpiredPage(1)
                  setArchivePage(1)
                }}
                placeholder="Search membership records"
                value={searchQuery}
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Filter by Membership Plan
              </span>
              <select
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50"
                onChange={(event) => {
                  setMembershipPlanFilter(event.target.value)
                  setCurrentPage(1)
                  setExpiredPage(1)
                  setArchivePage(1)
                }}
                value={membershipPlanFilter}
              >
                <option value="all">All plans</option>
                {membershipPlanOptions.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.plan_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Filter by Status
              </span>
              <select
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50"
                onChange={(event) => {
                  setStatusFilter(
                    event.target.value as (typeof statusFilterOptions)[number]['value'],
                  )
                  setCurrentPage(1)
                  setExpiredPage(1)
                }}
                value={statusFilter}
              >
                {statusFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Filter by Issued Employee
              </span>
              <select
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50"
                onChange={(event) => {
                  setIssuedEmployeeFilter(event.target.value)
                  setCurrentPage(1)
                  setExpiredPage(1)
                }}
                value={issuedEmployeeFilter}
              >
                <option value="all">All employees</option>
                {employeeOptions.map((employeeOption) => (
                  <option key={employeeOption.id} value={employeeOption.id}>
                    {employeeOption.character_name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
      ) : null}

      <MembershipRecordTable
        accessLevel={activeAccessLevel as 'management' | 'employee'}
        actionTargetId={actionTargetId}
        editingError={editingError}
        editingRecord={editingRecord}
        editingRecordId={editingRecordId}
        editingSubmitting={editingSubmitting}
        expandedRecordId={expandedRecordId}
        customerOptions={customerOptions}
        employeeOptions={employeeOptions}
        membershipPlans={membershipPlanOptions}
        onArchive={handleArchive}
        onCancelEdit={cancelEdit}
        onDelete={handleDelete}
        onMarkExpired={handleMarkExpired}
        onRestore={handleRestore}
        onStartEdit={beginEdit}
        onSubmitEdit={handleEdit}
        onToggleExpanded={(recordId) =>
          setExpandedRecordId((current) => (current === recordId ? null : recordId))
        }
        records={pagedActiveMembershipRecords}
        showActions={canManage}
        showArchiveActions={false}
        title="Active membership records"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          {activeMembershipRecords.length === 0
            ? 'No active membership records match the active filters.'
            : `Showing ${Math.min((activeDisplayPage - 1) * ROWS_PER_PAGE + 1, activeMembershipRecords.length)} to ${Math.min(activeDisplayPage * ROWS_PER_PAGE, activeMembershipRecords.length)} of ${activeMembershipRecords.length}.`}
        </p>
        <div className="flex items-center gap-2">
          <button
            className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={activeDisplayPage <= 1}
            onClick={() => setCurrentPage((current) => Math.max(1, current - 1))}
            type="button"
          >
            Previous
          </button>
          <button
            className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={activeDisplayPage >= activeTotalPages}
            onClick={() => setCurrentPage((current) => Math.min(activeTotalPages, current + 1))}
            type="button"
          >
            Next
          </button>
        </div>
      </div>

      <MembershipRecordTable
        accessLevel={activeAccessLevel as 'management' | 'employee'}
        actionTargetId={actionTargetId}
        editingError={editingError}
        editingRecord={editingRecord}
        editingRecordId={editingRecordId}
        editingSubmitting={editingSubmitting}
        expandedRecordId={expandedRecordId}
        customerOptions={customerOptions}
        employeeOptions={employeeOptions}
        membershipPlans={membershipPlanOptions}
        onArchive={handleArchive}
        onCancelEdit={cancelEdit}
        onDelete={handleDelete}
        onMarkExpired={handleMarkExpired}
        onRestore={handleRestore}
        onStartEdit={beginEdit}
        onSubmitEdit={handleEdit}
        onToggleExpanded={(recordId) =>
          setExpandedRecordId((current) => (current === recordId ? null : recordId))
        }
        records={pagedExpiredMembershipRecords}
        showActions={canManage}
        showArchiveActions={false}
        title="Expired membership records"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          {expiredMembershipRecords.length === 0
            ? 'No expired membership records match the active filters.'
            : `Showing ${Math.min((expiredDisplayPage - 1) * ROWS_PER_PAGE + 1, expiredMembershipRecords.length)} to ${Math.min(expiredDisplayPage * ROWS_PER_PAGE, expiredMembershipRecords.length)} of ${expiredMembershipRecords.length}.`}
        </p>
        <div className="flex items-center gap-2">
          <button
            className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={expiredDisplayPage <= 1}
            onClick={() => setExpiredPage((current) => Math.max(1, current - 1))}
            type="button"
          >
            Previous
          </button>
          <button
            className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={expiredDisplayPage >= expiredTotalPages}
            onClick={() => setExpiredPage((current) => Math.min(expiredTotalPages, current + 1))}
            type="button"
          >
            Next
          </button>
        </div>
      </div>

      {canManage && archivedMembershipRecords.length > 0 ? (
        <>
          <MembershipRecordTable
            accessLevel="management"
            actionTargetId={actionTargetId}
            editingError={null}
            editingRecord={null}
            editingRecordId={null}
            editingSubmitting={false}
            expandedRecordId={expandedRecordId}
            customerOptions={customerOptions}
            employeeOptions={employeeOptions}
            membershipPlans={membershipPlanOptions}
            onArchive={handleArchive}
            onCancelEdit={cancelEdit}
            onDelete={handleDelete}
            onRestore={handleRestore}
            onStartEdit={beginEdit}
            onSubmitEdit={handleEdit}
            onToggleExpanded={(recordId) =>
              setExpandedRecordId((current) => (current === recordId ? null : recordId))
            }
            records={pagedArchivedMembershipRecords}
            showActions
            showArchiveActions
            title="Archived membership records"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-400">
              {archivedMembershipRecords.length === 0
                ? 'No archived membership records available.'
                : `Showing ${Math.min((archiveDisplayPage - 1) * ROWS_PER_PAGE + 1, archivedMembershipRecords.length)} to ${Math.min(archiveDisplayPage * ROWS_PER_PAGE, archivedMembershipRecords.length)} of ${archivedMembershipRecords.length}.`}
            </p>
            <div className="flex items-center gap-2">
              <button
                className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={archiveDisplayPage <= 1}
                onClick={() => setArchivePage((current) => Math.max(1, current - 1))}
                type="button"
              >
                Previous
              </button>
              <button
                className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={archiveDisplayPage >= archiveTotalPages}
                onClick={() => setArchivePage((current) => Math.min(archiveTotalPages, current + 1))}
                type="button"
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : null}

      {canManage ? (
        <div className="sr-only" aria-live="polite">
          Saving membership record changes.
        </div>
      ) : null}
    </section>
  )
}
