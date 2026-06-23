import { Fragment, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../../auth/useAuth'
import type { EmployeeRecord, RankRecord } from '../../auth/types'
import { ActionMenu } from '../../components/ui/ActionMenu'
import { EmployeeCsvImport } from '../../components/employees/EmployeeCsvImport'
import { EmployeeForm } from '../../components/employees/EmployeeForm'
import { EmployeeTransferForm } from '../../components/employees/EmployeeTransferForm'
import {
  archiveEmployee,
  createEmptyEmployeeFormValues,
  createEmployee,
  employeeToFormValues,
  fetchEmployeeRanks,
  fetchEmployees,
  isArchivedEmployee,
  restoreEmployee,
  softDeleteEmployee,
  sortEmployees,
  type EmployeeFormValues,
  updateEmployee,
  updateEmployeeStatus,
} from '../../lib/employees'
import {
  createEmptyExEmployeeTransferValues,
  transferEmployeeToExEmployee,
  type ExEmployeeTransferValues,
} from '../../lib/exEmployees'
import {
  importEmployeeCsvRows,
  type EmployeeCsvImportResult,
} from '../../lib/employeeCsvImport'

const ROWS_PER_PAGE = 20

const statusFilterOptions = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'archived', label: 'Archived' },
] as const

function StatusBadge({
  status,
}: {
  status: EmployeeRecord['status']
}) {
  const toneClasses: Record<EmployeeRecord['status'], string> = {
    active: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
    inactive: 'border-white/10 bg-white/5 text-slate-200',
    on_leave: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
    archived: 'border-rose-500/30 bg-rose-500/10 text-rose-100',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.18em] ${toneClasses[status]}`}
    >
      {status === 'on_leave'
        ? 'On Leave'
        : status === 'archived'
          ? 'Archived'
          : status === 'inactive'
            ? 'Inactive'
            : 'Active'}
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

function formatDate(dateValue: string | null) {
  if (!dateValue) {
    return '-'
  }

  const parsed = new Date(`${dateValue}T00:00:00`)

  if (Number.isNaN(parsed.getTime())) {
    return '-'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed)
}

function formatNumber(value: string | number | null) {
  if (value === null || value === undefined) {
    return '-'
  }

  const parsed = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(parsed)) {
    return '-'
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parsed)
}

function daysInJob(hireDate: string | null) {
  if (!hireDate) {
    return '-'
  }

  const parsed = new Date(`${hireDate}T00:00:00Z`)

  if (Number.isNaN(parsed.getTime())) {
    return '-'
  }

  const now = new Date()
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const hireUtc = Date.UTC(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth(),
    parsed.getUTCDate(),
  )

  return `${Math.max(0, Math.floor((todayUtc - hireUtc) / 86400000))} days`
}

function isManagementAccess(accessLevel: string | null) {
  return accessLevel === 'management'
}

function RankDetailPanel({ employee }: { employee: EmployeeRecord }) {
  return (
    <div className="grid gap-4 rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-4 sm:p-5 lg:grid-cols-2">
      <div className="grid gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Character Name
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{employee.character_name}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Citizen ID
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{employee.citizen_id}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Phone Number
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {employee.phone_number ?? '-'}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Discord Username
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {employee.discord_username ?? '-'}
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Rank
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {employee.rank?.rank_name ?? 'Unassigned'}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Division
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{employee.division ?? '-'}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Hire Date
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{formatDate(employee.hire_date)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Last Promotion Date
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {formatDate(employee.last_promotion_date)}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Warnings
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-200">{employee.warnings}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Strike 1
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-200">
              {employee.strike_1 ? 'Yes' : 'No'}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Strike 2
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-200">
              {employee.strike_2 ? 'Yes' : 'No'}
            </p>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Total Bills
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {formatNumber(employee.total_bills)}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Days in Job
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{daysInJob(employee.hire_date)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Status
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            <StatusBadge status={employee.status} />
          </p>
        </div>
      </div>
    </div>
  )
}

function EmployeeTable({
  title,
  employees,
  rankLookup,
  accessLevel,
  expandedEmployeeId,
  onToggleExpanded,
  onStartEdit,
  onSetStatus,
  onArchive,
  onRestore,
  onDelete,
  onBeginTransfer,
  editingEmployeeId,
  editingEmployee,
  editingError,
  editingSubmitting,
  onSubmitEdit,
  onCancelEdit,
  transferEmployeeId,
  transferEmployee,
  transferError,
  transferSubmitting,
  onSubmitTransfer,
  onCancelTransfer,
  archiveSection = false,
  actionTargetId,
}: {
  title: string
  employees: EmployeeRecord[]
  rankLookup: Map<string, RankRecord>
  accessLevel: 'management' | 'employee' | 'customer'
  expandedEmployeeId: string | null
  onToggleExpanded: (employeeId: string) => void
  onStartEdit: (employee: EmployeeRecord) => void
  onSetStatus: (employee: EmployeeRecord, status: Exclude<EmployeeRecord['status'], 'archived'>) => void
  onArchive: (employee: EmployeeRecord) => void
  onRestore: (employee: EmployeeRecord) => void
  onDelete: (employee: EmployeeRecord) => void
  onBeginTransfer?: (employee: EmployeeRecord) => void
  editingEmployeeId: string | null
  editingEmployee: EmployeeRecord | null
  editingError: string | null
  editingSubmitting: boolean
  onSubmitEdit: (values: EmployeeFormValues) => Promise<void>
  onCancelEdit: () => void
  transferEmployeeId?: string | null
  transferEmployee?: EmployeeRecord | null
  transferError?: string | null
  transferSubmitting?: boolean
  onSubmitTransfer?: (values: ExEmployeeTransferValues) => Promise<void>
  onCancelTransfer?: () => void
  archiveSection?: boolean
  actionTargetId: string | null
}) {
  const canManage = isManagementAccess(accessLevel)

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
            {title}
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
            {employees.length} {employees.length === 1 ? 'employee' : 'employees'}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <FieldPill enabled={false}>{archiveSection ? 'Archived' : 'Current'}</FieldPill>
          <FieldPill enabled={true}>20 rows per page</FieldPill>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-[1360px] w-full border-separate border-spacing-0">
          <thead>
            <tr className="text-left text-[0.7rem] uppercase tracking-[0.28em] text-slate-500">
              <th className="border-b border-white/10 px-4 py-3">Character Name</th>
              <th className="border-b border-white/10 px-4 py-3">Citizen ID</th>
              <th className="border-b border-white/10 px-4 py-3">Phone Number</th>
              <th className="border-b border-white/10 px-4 py-3">Discord Username</th>
              <th className="border-b border-white/10 px-4 py-3">Division</th>
              <th className="border-b border-white/10 px-4 py-3">Hire Date</th>
              <th className="border-b border-white/10 px-4 py-3">Last Promotion Date</th>
              <th className="border-b border-white/10 px-4 py-3">Total Bills</th>
              <th className="border-b border-white/10 px-4 py-3">Days in Job</th>
              <th className="border-b border-white/10 px-4 py-3">Status</th>
              <th className="border-b border-white/10 px-4 py-3">Actions</th>
            </tr>
          </thead>

          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-sm text-slate-400" colSpan={11}>
                  No employees found.
                </td>
              </tr>
            ) : (
              employees.map((employee) => {
                const isExpanded = expandedEmployeeId === employee.id
                const isEditing = editingEmployeeId === employee.id
                const rankDisplay = employee.rank
                  ? `${employee.rank.rank_name}${
                      employee.rank.archived_at ? ' (Archived)' : ''
                    }`
                  : 'Unassigned'

                return (
                  <Fragment key={employee.id}>
                    <tr className="align-top">
                      <td className="border-b border-white/5 px-4 py-4">
                        <button
                          className="text-left text-sm font-semibold text-white transition hover:text-cyan-200"
                          onClick={() => onToggleExpanded(employee.id)}
                          type="button"
                        >
                          <div className="space-y-1">
                            <div>{employee.character_name}</div>
                            <div className="text-xs font-normal text-slate-500">
                              {rankDisplay}
                            </div>
                          </div>
                        </button>
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {employee.citizen_id}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {employee.phone_number ?? '-'}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {employee.discord_username ?? '-'}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {employee.division ?? '-'}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {formatDate(employee.hire_date)}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {formatDate(employee.last_promotion_date)}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {formatNumber(employee.total_bills)}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {daysInJob(employee.hire_date)}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4">
                        <StatusBadge status={employee.status} />
                      </td>
                      <td className="border-b border-white/5 px-4 py-4">
                        {canManage ? (
                          <ActionMenu triggerLabel="Actions">
                              {!archiveSection ? (
                                <>
                                  <button
                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/5"
                                    onClick={() => onStartEdit(employee)}
                                    type="button"
                                  >
                                    Edit
                                  </button>
                                  <div className="my-1 border-t border-white/10" />
                                  <button
                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                                    disabled={employee.status === 'active'}
                                    onClick={() => onSetStatus(employee, 'active')}
                                    type="button"
                                  >
                                    Set Active
                                  </button>
                                  <button
                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                                    disabled={employee.status === 'inactive'}
                                    onClick={() => onSetStatus(employee, 'inactive')}
                                    type="button"
                                  >
                                    Set Inactive
                                  </button>
                                  <button
                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                                    disabled={employee.status === 'on_leave'}
                                    onClick={() => onSetStatus(employee, 'on_leave')}
                                    type="button"
                                  >
                                    Set On Leave
                                  </button>
                                  <div className="my-1 border-t border-white/10" />
                                  <button
                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/5"
                                    onClick={() => onArchive(employee)}
                                    type="button"
                                  >
                                    Archive
                                  </button>
                                  <button
                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/5"
                                    onClick={() => onBeginTransfer?.(employee)}
                                    type="button"
                                  >
                                    Move to Ex Employee
                                  </button>
                                  <button
                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-rose-100 transition hover:bg-rose-500/10"
                                    onClick={() => onDelete(employee)}
                                    type="button"
                                  >
                                    Delete
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/5"
                                    onClick={() => onRestore(employee)}
                                    type="button"
                                  >
                                    Restore
                                  </button>
                                  <button
                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-rose-100 transition hover:bg-rose-500/10"
                                    onClick={() => onDelete(employee)}
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
                    </tr>

                    {isExpanded && !isEditing ? (
                      <tr>
                        <td className="border-b border-white/5 px-4 pb-5 pt-0" colSpan={11}>
                          <RankDetailPanel employee={employee} />
                        </td>
                      </tr>
                    ) : null}

                    {isEditing && editingEmployee ? (
                      <tr>
                        <td className="border-b border-white/5 px-4 pb-5 pt-0" colSpan={11}>
                          <EmployeeForm
                            key={editingEmployee.id}
                            description="Update the employee in Supabase. Changes save immediately."
                            error={editingError}
                            initialValues={employeeToFormValues(editingEmployee)}
                            isSubmitting={editingSubmitting}
                            onCancel={onCancelEdit}
                            onSubmit={onSubmitEdit}
                            rankOptions={Array.from(rankLookup.values())}
                            submitLabel="Save changes"
                            title={`Edit ${editingEmployee.character_name}`}
                            variant="inline"
                          />
                        </td>
                      </tr>
                    ) : null}

                    {!archiveSection &&
                    transferEmployeeId === employee.id &&
                    transferEmployee &&
                    canManage ? (
                      <tr>
                        <td className="border-b border-white/5 px-4 pb-5 pt-0" colSpan={11}>
                          <EmployeeTransferForm
                            description="Move this employee into the ex-employee sheet. The transfer creates the snapshot first and then soft-deletes the original employee."
                            error={transferError}
                            initialValues={createEmptyExEmployeeTransferValues()}
                            isSubmitting={transferSubmitting}
                            onCancel={onCancelTransfer ?? (() => undefined)}
                            onSubmit={onSubmitTransfer ?? (async () => undefined)}
                            submitLabel="Move to Ex Employee"
                            title={`Transfer ${transferEmployee.character_name}`}
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
          Saving employee changes.
        </div>
      ) : null}
    </section>
  )
}

export function EmployeeSheetPage() {
  const { accessLevel } = useAuth()
  const isManagement = accessLevel === 'management'

  const [employees, setEmployees] = useState<EmployeeRecord[]>([])
  const [rankOptions, setRankOptions] = useState<RankRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [bannerMessage, setBannerMessage] = useState<string | null>(null)
  const [bannerTone, setBannerTone] = useState<'success' | 'error' | null>(null)
  const [createVisible, setCreateVisible] = useState(false)
  const [importVisible, setImportVisible] = useState(false)
  const [createRevision, setCreateRevision] = useState(0)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null)
  const [editingError, setEditingError] = useState<string | null>(null)
  const [editingSubmitting, setEditingSubmitting] = useState(false)
  const [transferEmployeeId, setTransferEmployeeId] = useState<string | null>(null)
  const [transferError, setTransferError] = useState<string | null>(null)
  const [transferSubmitting, setTransferSubmitting] = useState(false)
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null)
  const [actionTargetId, setActionTargetId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [rankFilter, setRankFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilterOptions)[number]['value']>('all')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      setLoading(true)
      setPageError(null)

      try {
        const [employeeData, rankData] = await Promise.all([
          fetchEmployees(),
          fetchEmployeeRanks(),
        ])

        if (!isMounted) {
          return
        }

        setEmployees(employeeData)
        setRankOptions(rankData)
      } catch (error) {
        if (!isMounted) {
          return
        }

        const message = error instanceof Error ? error.message : 'Unable to load employees.'
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
  }, [])

  const rankLookup = useMemo(
    () => new Map(rankOptions.map((rank) => [rank.id, rank] as const)),
    [rankOptions],
  )

  const existingCitizenIds = useMemo(
    () => employees.map((employee) => employee.citizen_id),
    [employees],
  )

  const currentUserLabel =
    accessLevel === 'management'
      ? 'Management access'
      : accessLevel === 'employee'
        ? 'Employee access'
        : 'Customer access'

  function showBanner(message: string, tone: 'success' | 'error') {
    setBannerMessage(message)
    setBannerTone(tone)
  }

  function syncEmployee(updatedEmployee: EmployeeRecord) {
    setEmployees((current) => {
      const nextEmployees = current.some((employee) => employee.id === updatedEmployee.id)
        ? current.map((employee) =>
            employee.id === updatedEmployee.id ? updatedEmployee : employee,
          )
        : [updatedEmployee, ...current]

      return sortEmployees(nextEmployees.filter((employee) => employee.deleted_at === null))
    })
  }

  function removeEmployee(employeeId: string) {
    setEmployees((current) => current.filter((employee) => employee.id !== employeeId))
  }

  function beginCreate() {
    setCreateVisible(true)
    setImportVisible(false)
    setEditingEmployeeId(null)
    setTransferEmployeeId(null)
    setEditingError(null)
    setTransferError(null)
    setExpandedEmployeeId(null)
    setCreateError(null)
    setBannerMessage(null)
    setCreateRevision((current) => current + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function beginImport() {
    setImportVisible(true)
    setCreateVisible(false)
    setEditingEmployeeId(null)
    setTransferEmployeeId(null)
    setCreateError(null)
    setEditingError(null)
    setTransferError(null)
    setExpandedEmployeeId(null)
    setBannerMessage(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function beginEdit(employee: EmployeeRecord) {
    setEditingEmployeeId(employee.id)
    setCreateVisible(false)
    setImportVisible(false)
    setTransferEmployeeId(null)
    setCreateError(null)
    setEditingError(null)
    setTransferError(null)
    setExpandedEmployeeId(null)
    setBannerMessage(null)
  }

  function cancelEdit() {
    setEditingEmployeeId(null)
    setEditingError(null)
  }

  function beginTransfer(employee: EmployeeRecord) {
    setTransferEmployeeId(employee.id)
    setCreateVisible(false)
    setImportVisible(false)
    setEditingEmployeeId(null)
    setCreateError(null)
    setEditingError(null)
    setTransferError(null)
    setExpandedEmployeeId(null)
    setBannerMessage(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelTransfer() {
    setTransferEmployeeId(null)
    setTransferError(null)
  }

  function cancelImport() {
    setImportVisible(false)
  }

  async function handleCreate(values: EmployeeFormValues) {
    setCreateSubmitting(true)
    setCreateError(null)
    setBannerMessage(null)

    try {
      const created = await createEmployee(values)
      syncEmployee(created)
      setCreateVisible(false)
      setExpandedEmployeeId(created.id)
      showBanner(`Created employee ${created.character_name}.`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create employee.'
      setCreateError(message)
      showBanner(message, 'error')
    } finally {
      setCreateSubmitting(false)
    }
  }

  async function handleCsvImport(rows: Parameters<typeof importEmployeeCsvRows>[0]) {
    setBannerMessage(null)
    setCreateError(null)
    setEditingError(null)
    setTransferError(null)

    const result: EmployeeCsvImportResult = await importEmployeeCsvRows(rows)

    result.insertedEmployees.forEach((employee) => {
      syncEmployee(employee)
    })

    if (result.insertedCount > 0) {
      setExpandedEmployeeId(result.insertedEmployees[0]?.id ?? null)
    }

    const tone = result.failedCount > 0 ? 'error' : 'success'
    showBanner(
      `Imported ${result.insertedCount} employee${result.insertedCount === 1 ? '' : 's'}; ${result.skippedCount} skipped; ${result.failedCount} failed.`,
      tone,
    )

    return result
  }

  async function handleEdit(values: EmployeeFormValues) {
    if (!editingEmployeeId) {
      return
    }

    setEditingSubmitting(true)
    setEditingError(null)
    setBannerMessage(null)

    try {
      const updated = await updateEmployee(editingEmployeeId, values)
      syncEmployee(updated)
      setEditingEmployeeId(null)
      setExpandedEmployeeId(updated.id)
      showBanner(`Updated employee ${updated.character_name}.`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update employee.'
      setEditingError(message)
      showBanner(message, 'error')
    } finally {
      setEditingSubmitting(false)
    }
  }

  async function handleTransfer(values: ExEmployeeTransferValues) {
    if (!transferEmployee) {
      return
    }

    setTransferSubmitting(true)
    setTransferError(null)
    setBannerMessage(null)

    try {
      const result = await transferEmployeeToExEmployee(transferEmployee, values)
      removeEmployee(transferEmployee.id)
      cancelTransfer()
      setTransferEmployeeId(null)
      setExpandedEmployeeId(null)
      if (editingEmployeeId === transferEmployee.id) {
        cancelEdit()
      }
      showBanner(
        `Moved ${transferEmployee.character_name} to Ex-Employees using ${result.exEmployee.separation_type}.`,
        'success',
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to transfer employee to ex-employee.'
      setTransferError(message)
      showBanner(message, 'error')
    } finally {
      setTransferSubmitting(false)
    }
  }

  async function handleStatusChange(
    employee: EmployeeRecord,
    status: Exclude<EmployeeRecord['status'], 'archived'>,
  ) {
    setActionTargetId(employee.id)
    setBannerMessage(null)

    try {
      const updated = await updateEmployeeStatus(employee.id, status)
      syncEmployee(updated)
      showBanner(`Updated ${employee.character_name} to ${status}.`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update employee status.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  async function handleArchive(employee: EmployeeRecord) {
    setActionTargetId(employee.id)
    setBannerMessage(null)

    try {
      const updated = await archiveEmployee(employee.id)
      syncEmployee(updated)
      if (transferEmployeeId === employee.id) {
        cancelTransfer()
      }
      showBanner(`Archived employee ${updated.character_name}.`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to archive employee.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  async function handleRestore(employee: EmployeeRecord) {
    setActionTargetId(employee.id)
    setBannerMessage(null)

    try {
      const updated = await restoreEmployee(employee.id)
      syncEmployee(updated)
      if (transferEmployeeId === employee.id) {
        cancelTransfer()
      }
      showBanner(`Restored employee ${updated.character_name}.`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to restore employee.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  async function handleDelete(employee: EmployeeRecord) {
    const confirmed = window.confirm(
      `Soft delete ${employee.character_name}? This will hide the employee from all lists.`,
    )

    if (!confirmed) {
      return
    }

    setActionTargetId(employee.id)
    setBannerMessage(null)

    try {
      await softDeleteEmployee(employee.id)
      removeEmployee(employee.id)
      if (transferEmployeeId === employee.id) {
        cancelTransfer()
      }
      if (editingEmployeeId === employee.id) {
        cancelEdit()
      }
      if (expandedEmployeeId === employee.id) {
        setExpandedEmployeeId(null)
      }
      showBanner(`Deleted employee ${employee.character_name}.`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete employee.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  function handleMoveToExEmployee(employee: EmployeeRecord) {
    beginTransfer(employee)
  }

  const currentEmployees = useMemo(
    () =>
      employees.filter(
        (employee) =>
          !isArchivedEmployee(employee) &&
          employee.character_name.toLowerCase().includes(searchQuery.trim().toLowerCase()) &&
          (rankFilter === 'all'
            ? true
            : rankFilter === 'unassigned'
              ? !employee.rank_id
              : employee.rank_id === rankFilter) &&
          (statusFilter === 'all' ? true : employee.status === statusFilter),
      ),
    [employees, rankFilter, searchQuery, statusFilter],
  )

  const archivedEmployees = useMemo(
    () =>
      employees.filter(
        (employee) =>
          isArchivedEmployee(employee) &&
          employee.character_name.toLowerCase().includes(searchQuery.trim().toLowerCase()) &&
          (rankFilter === 'all'
            ? true
            : rankFilter === 'unassigned'
              ? !employee.rank_id
              : employee.rank_id === rankFilter) &&
          (statusFilter === 'all' ? true : employee.status === statusFilter),
      ),
    [employees, rankFilter, searchQuery, statusFilter],
  )

  const totalCurrentPages = Math.max(1, Math.ceil(currentEmployees.length / ROWS_PER_PAGE))
  const displayCurrentPage = Math.min(currentPage, totalCurrentPages)
  const currentPageEmployees = currentEmployees.slice(
    (displayCurrentPage - 1) * ROWS_PER_PAGE,
    displayCurrentPage * ROWS_PER_PAGE,
  )

  const editingEmployee = useMemo(
    () => employees.find((employee) => employee.id === editingEmployeeId) ?? null,
    [editingEmployeeId, employees],
  )

  const transferEmployee =
    transferEmployeeId === null
      ? null
      : employees.find((employee) => employee.id === transferEmployeeId) ?? null

  if (loading) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Employee Sheet
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Loading employees</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Fetching employee and rank records from Supabase.
        </p>
      </section>
    )
  }

  if (pageError) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Employee Sheet
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Unable to load employees</h1>
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

  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
              Employee Sheet
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Employee Control Center
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Employee records are sourced from Supabase. Current view is limited to{' '}
              {currentUserLabel}.
            </p>
          </div>

          <div className="grid gap-3 sm:text-right">
            <FieldPill enabled={false}>{currentEmployees.length} current</FieldPill>
            {isManagement ? (
              <FieldPill enabled={false}>{archivedEmployees.length} archived</FieldPill>
            ) : (
              <FieldPill enabled={true}>Read only</FieldPill>
            )}
          </div>
        </div>
      </div>

      {bannerMessage ? (
        <div
          className={[
            'rounded-2xl border px-4 py-3 text-sm',
            bannerTone === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-100',
          ].join(' ')}
        >
          {bannerMessage}
        </div>
      ) : null}

      {isManagement ? (
        <div className="space-y-4">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
                  Employee actions
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
                  Add or import employees
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                  Create a new employee record or import a CSV at the top of the page. Rank
                  selection and import validation come from the live Supabase data.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-slate-900"
                  onClick={beginImport}
                  type="button"
                >
                  Import CSV
                </button>
                <button
                  className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                  onClick={beginCreate}
                  type="button"
                >
                  Create Employee
                </button>
              </div>
            </div>
          </div>

          {createVisible ? (
            <EmployeeForm
              key={`create-${createRevision}`}
              description="Create a new employee record in Supabase. The form opens at the top of the page and saves immediately."
              error={createError}
              initialValues={createEmptyEmployeeFormValues()}
              isSubmitting={createSubmitting}
              onCancel={() => {
                setCreateVisible(false)
                setCreateError(null)
              }}
              onSubmit={handleCreate}
              rankOptions={rankOptions}
              submitLabel="Create employee"
              title="Create Employee"
              variant="panel"
            />
          ) : null}

          {importVisible ? (
            <EmployeeCsvImport
              existingCitizenIds={existingCitizenIds}
              onClose={cancelImport}
              onConfirmImport={handleCsvImport}
              rankOptions={rankOptions}
            />
          ) : null}
        </div>
      ) : (
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-sm leading-6 text-slate-300 shadow-2xl shadow-cyan-950/20 backdrop-blur">
          Employees have read-only access to the employee sheet. Customers are blocked by the
          route guard.
        </div>
      )}

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
            Showing page {displayCurrentPage} of {totalCurrentPages}
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Search by Character Name
            </span>
            <input
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
              onChange={(event) => {
                setSearchQuery(event.target.value)
                setCurrentPage(1)
              }}
              placeholder="Search employees"
              value={searchQuery}
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Filter by Rank
            </span>
            <select
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50"
              onChange={(event) => {
                setRankFilter(event.target.value)
                setCurrentPage(1)
              }}
              value={rankFilter}
            >
              <option value="all">All ranks</option>
              <option value="unassigned">Unassigned</option>
              {rankOptions.map((rank) => (
                <option key={rank.id} value={rank.id}>
                  {rank.rank_name}
                  {rank.archived_at ? ' (Archived)' : ''}
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
                setStatusFilter(event.target.value as (typeof statusFilterOptions)[number]['value'])
                setCurrentPage(1)
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
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
          <FieldPill enabled={true}>Search uses character name only</FieldPill>
          <FieldPill enabled={true}>Rank and status filters are live</FieldPill>
        </div>
      </section>

      <EmployeeTable
        accessLevel={accessLevel ?? 'employee'}
        actionTargetId={actionTargetId}
        archiveSection={false}
        editingEmployee={editingEmployee}
        editingEmployeeId={editingEmployeeId}
        editingError={editingError}
        editingSubmitting={editingSubmitting}
        employees={currentPageEmployees}
        expandedEmployeeId={expandedEmployeeId}
        onArchive={handleArchive}
        onCancelEdit={cancelEdit}
        onDelete={handleDelete}
        onBeginTransfer={handleMoveToExEmployee}
        onRestore={handleRestore}
        onSetStatus={handleStatusChange}
        onStartEdit={beginEdit}
        onSubmitEdit={handleEdit}
        onSubmitTransfer={handleTransfer}
        onCancelTransfer={cancelTransfer}
        transferEmployee={transferEmployee}
        transferEmployeeId={transferEmployeeId}
        transferError={transferError}
        transferSubmitting={transferSubmitting}
        onToggleExpanded={(employeeId) =>
          setExpandedEmployeeId((current) => (current === employeeId ? null : employeeId))
        }
        rankLookup={rankLookup}
        title="Current employees"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          {currentEmployees.length === 0
            ? 'No current employees match the active filters.'
            : `Showing ${Math.min((displayCurrentPage - 1) * ROWS_PER_PAGE + 1, currentEmployees.length)} to ${Math.min(displayCurrentPage * ROWS_PER_PAGE, currentEmployees.length)} of ${currentEmployees.length}.`}
        </p>
        <div className="flex items-center gap-2">
          <button
            className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={displayCurrentPage <= 1}
            onClick={() => setCurrentPage((current) => Math.max(1, current - 1))}
            type="button"
          >
            Previous
          </button>
          <button
            className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={displayCurrentPage >= totalCurrentPages}
            onClick={() => setCurrentPage((current) => Math.min(totalCurrentPages, current + 1))}
            type="button"
          >
            Next
          </button>
        </div>
      </div>

      {isManagement ? (
        <EmployeeTable
          accessLevel="management"
          actionTargetId={actionTargetId}
          archiveSection
          editingEmployee={null}
          editingEmployeeId={null}
          editingError={null}
          editingSubmitting={false}
          employees={archivedEmployees}
          expandedEmployeeId={expandedEmployeeId}
          onArchive={handleArchive}
          onCancelEdit={cancelEdit}
          onDelete={handleDelete}
          onBeginTransfer={handleMoveToExEmployee}
          onRestore={handleRestore}
          onSetStatus={handleStatusChange}
          onStartEdit={beginEdit}
          onSubmitEdit={handleEdit}
          onToggleExpanded={(employeeId) =>
            setExpandedEmployeeId((current) => (current === employeeId ? null : employeeId))
          }
          rankLookup={rankLookup}
          title="Archived employees"
        />
      ) : null}

      {actionTargetId ? (
        <div className="sr-only" aria-live="polite">
          Saving employee changes.
        </div>
      ) : null}
    </section>
  )
}
