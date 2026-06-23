import { Fragment, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../../auth/useAuth'
import type { EmployeeRecord, ManagementTeamRecord, ProviderStatus } from '../../auth/types'
import { ActionMenu } from '../../components/ui/ActionMenu'
import { ServiceProviderForm } from '../../components/management/ServiceProviderForm'
import {
  archiveManagementProvider,
  createManagementProvider,
  fetchManagementProviders,
  isArchivedManagementProvider,
  managementProviderToFormValues,
  softDeleteManagementProvider,
  sortManagementProviders,
  restoreManagementProvider,
  updateManagementProvider,
  type ManagementProviderFormValues,
} from '../../lib/managementTeam'
import { fetchEmployees, sortEmployees } from '../../lib/employees'

const ROWS_PER_PAGE = 20

const providerStatusFilterOptions = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'under_consideration', label: 'Under Consideration' },
  { value: 'archived', label: 'Archived' },
] as const

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
  employee,
  portalEmail,
  customer,
}: {
  accessLevel: string | null
  authEmail: string | undefined
  employee: EmployeeRecord | null
  portalEmail: string | undefined
  customer: { character_name: string } | null
}) {
  return (
    employee?.character_name ??
    customer?.character_name ??
    portalEmail ??
    authEmail ??
    accessLabel(accessLevel)
  )
}

function StatusBadge({
  tone,
  children,
}: {
  tone: 'success' | 'warning' | 'neutral' | 'accent' | 'danger'
  children: ReactNode
}) {
  const toneClasses: Record<typeof tone, string> = {
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
    neutral: 'border-white/10 bg-white/5 text-slate-200',
    accent: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100',
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

function EmployeeStatusBadge({ status }: { status: EmployeeRecord['status'] }) {
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

function ProviderStatusBadge({ status }: { status: ProviderStatus }) {
  const toneClasses: Record<ProviderStatus, { tone: 'success' | 'warning' | 'neutral' | 'accent' | 'danger'; label: string }> = {
    active: { tone: 'success', label: 'Active' },
    inactive: { tone: 'neutral', label: 'Inactive' },
    on_leave: { tone: 'warning', label: 'On Leave' },
    under_consideration: { tone: 'accent', label: 'Under Consideration' },
    archived: { tone: 'danger', label: 'Archived' },
  }

  const statusBadge = toneClasses[status]

  return <StatusBadge tone={statusBadge.tone}>{statusBadge.label}</StatusBadge>
}

function ManagementEmployeeDetailPanel({ employee }: { employee: EmployeeRecord }) {
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
      </div>

      <div className="grid gap-4">
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
            Status
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            <EmployeeStatusBadge status={employee.status} />
          </p>
        </div>
      </div>
    </div>
  )
}

function ProviderDetailPanel({ provider }: { provider: ManagementTeamRecord }) {
  return (
    <div className="grid gap-4 rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-4 sm:p-5 lg:grid-cols-2">
      <div className="grid gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Display Name
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{provider.display_name}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Company Name
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{provider.company_name}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Role
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{provider.management_role}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Phone Number
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {provider.phone_number ?? '-'}
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Discord Username
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {provider.discord_username ?? '-'}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Responsibilities
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {provider.responsibilities?.trim() ? provider.responsibilities : '-'}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Provider Status
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            <ProviderStatusBadge status={provider.provider_status} />
          </p>
        </div>
      </div>
    </div>
  )
}

function ManagementEmployeeTable({
  title,
  employees,
  accessLevel,
  expandedEmployeeId,
  onToggleExpanded,
}: {
  title: string
  employees: EmployeeRecord[]
  accessLevel: 'management' | 'employee' | 'customer'
  expandedEmployeeId: string | null
  onToggleExpanded: (employeeId: string) => void
}) {
  const canView = accessLevel === 'management' || accessLevel === 'employee'

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
            {title}
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
            {employees.length} {employees.length === 1 ? 'record' : 'records'}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <FieldPill enabled={true}>Read only</FieldPill>
          <FieldPill enabled={true}>20 rows per page</FieldPill>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-[1000px] w-full border-separate border-spacing-0">
          <thead>
            <tr className="text-left text-[0.7rem] uppercase tracking-[0.28em] text-slate-500">
              <th className="border-b border-white/10 px-4 py-3">Character Name</th>
              <th className="border-b border-white/10 px-4 py-3">Rank</th>
              <th className="border-b border-white/10 px-4 py-3">Division</th>
              <th className="border-b border-white/10 px-4 py-3">Phone Number</th>
              <th className="border-b border-white/10 px-4 py-3">Discord Username</th>
              <th className="border-b border-white/10 px-4 py-3">Status</th>
            </tr>
          </thead>

          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-sm text-slate-400" colSpan={6}>
                  No management employees found.
                </td>
              </tr>
            ) : (
              employees.map((employee) => {
                const isExpanded = expandedEmployeeId === employee.id

                return (
                  <Fragment key={employee.id}>
                    <tr className="align-top">
                      <td className="border-b border-white/5 px-4 py-4">
                        {canView ? (
                          <button
                            className="text-left text-sm font-semibold text-white transition hover:text-cyan-200"
                            onClick={() => onToggleExpanded(employee.id)}
                            type="button"
                          >
                            {employee.character_name}
                          </button>
                        ) : (
                          <span className="text-sm font-semibold text-white">
                            {employee.character_name}
                          </span>
                        )}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {employee.rank?.rank_name ?? 'Unassigned'}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {employee.division ?? '-'}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {employee.phone_number ?? '-'}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {employee.discord_username ?? '-'}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4">
                        <EmployeeStatusBadge status={employee.status} />
                      </td>
                    </tr>

                    {isExpanded ? (
                      <tr>
                        <td className="border-b border-white/5 px-4 pb-5 pt-0" colSpan={6}>
                          <ManagementEmployeeDetailPanel employee={employee} />
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
    </section>
  )
}

function ProviderTable({
  title,
  providers,
  accessLevel,
  expandedProviderId,
  onToggleExpanded,
  onStartEdit,
  onArchive,
  onRestore,
  onDelete,
  showArchiveActions = false,
  editingProviderId,
  editingProvider,
  editingError,
  editingSubmitting,
  onSubmitEdit,
  onCancelEdit,
  actionTargetId,
}: {
  title: string
  providers: ManagementTeamRecord[]
  accessLevel: 'management' | 'employee' | 'customer'
  expandedProviderId: string | null
  onToggleExpanded: (providerId: string) => void
  onStartEdit: (provider: ManagementTeamRecord) => void
  onArchive: (provider: ManagementTeamRecord) => void
  onRestore: (provider: ManagementTeamRecord) => void
  onDelete: (provider: ManagementTeamRecord) => void
  showArchiveActions?: boolean
  editingProviderId: string | null
  editingProvider: ManagementTeamRecord | null
  editingError: string | null
  editingSubmitting: boolean
  onSubmitEdit: (values: ManagementProviderFormValues) => Promise<void>
  onCancelEdit: () => void
  actionTargetId: string | null
}) {
  const canManage = accessLevel === 'management'
  const canView = accessLevel === 'management' || accessLevel === 'employee'

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
            {title}
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
            {providers.length} {providers.length === 1 ? 'provider' : 'providers'}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <FieldPill enabled={false}>{showArchiveActions ? 'Archived' : 'Current'}</FieldPill>
          <FieldPill enabled={true}>20 rows per page</FieldPill>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-[1240px] w-full border-separate border-spacing-0">
          <thead>
            <tr className="text-left text-[0.7rem] uppercase tracking-[0.28em] text-slate-500">
              <th className="border-b border-white/10 px-4 py-3">Display Name</th>
              <th className="border-b border-white/10 px-4 py-3">Company Name</th>
              <th className="border-b border-white/10 px-4 py-3">Role</th>
              <th className="border-b border-white/10 px-4 py-3">Phone Number</th>
              <th className="border-b border-white/10 px-4 py-3">Discord Username</th>
              <th className="border-b border-white/10 px-4 py-3">Provider Status</th>
              <th className="border-b border-white/10 px-4 py-3">Actions</th>
            </tr>
          </thead>

          <tbody>
            {providers.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-sm text-slate-400" colSpan={7}>
                  No providers found.
                </td>
              </tr>
            ) : (
              providers.map((provider) => {
                const isExpanded = expandedProviderId === provider.id
                const isEditing = editingProviderId === provider.id

                return (
                  <Fragment key={provider.id}>
                    <tr className="align-top">
                      <td className="border-b border-white/5 px-4 py-4">
                        {canView ? (
                          <button
                            className="text-left text-sm font-semibold text-white transition hover:text-cyan-200"
                            onClick={() => onToggleExpanded(provider.id)}
                            type="button"
                          >
                            {provider.display_name}
                          </button>
                        ) : (
                          <span className="text-sm font-semibold text-white">
                            {provider.display_name}
                          </span>
                        )}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {provider.company_name}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {provider.management_role}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {provider.phone_number ?? '-'}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {provider.discord_username ?? '-'}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4">
                        <ProviderStatusBadge status={provider.provider_status} />
                      </td>
                      <td className="border-b border-white/5 px-4 py-4">
                        {canManage ? (
                          <ActionMenu triggerLabel="Actions">
                              {!showArchiveActions ? (
                                <>
                                  <button
                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/5"
                                    onClick={() => onStartEdit(provider)}
                                    type="button"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/5"
                                    onClick={() => onArchive(provider)}
                                    type="button"
                                  >
                                    Archive
                                  </button>
                                  <button
                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-rose-100 transition hover:bg-rose-500/10"
                                    onClick={() => onDelete(provider)}
                                    type="button"
                                  >
                                    Delete
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-emerald-100 transition hover:bg-emerald-500/10"
                                    onClick={() => onRestore(provider)}
                                    type="button"
                                  >
                                    Restore
                                  </button>
                                  <button
                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-rose-100 transition hover:bg-rose-500/10"
                                    onClick={() => onDelete(provider)}
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
                        <td className="border-b border-white/5 px-4 pb-5 pt-0" colSpan={7}>
                          <ProviderDetailPanel provider={provider} />
                        </td>
                      </tr>
                    ) : null}

                    {isEditing && editingProvider ? (
                      <tr>
                        <td className="border-b border-white/5 px-4 pb-5 pt-0" colSpan={7}>
                          <ServiceProviderForm
                            key={editingProvider.id}
                            description="Update the provider in Supabase. Changes save immediately."
                            error={editingError}
                            initialValues={managementProviderToFormValues(editingProvider)}
                            isSubmitting={editingSubmitting}
                            onCancel={onCancelEdit}
                            onSubmit={onSubmitEdit}
                            submitLabel="Save changes"
                            title={`Edit ${editingProvider.display_name}`}
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
          Saving provider changes.
        </div>
      ) : null}
    </section>
  )
}

export function ManagementProvidersPage() {
  const { accessLevel, authUser, employee, customer, portalUser } = useAuth()

  const [employees, setEmployees] = useState<EmployeeRecord[]>([])
  const [providers, setProviders] = useState<ManagementTeamRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [bannerMessage, setBannerMessage] = useState<string | null>(null)
  const [bannerTone, setBannerTone] = useState<'success' | 'error' | null>(null)
  const [createVisible, setCreateVisible] = useState(false)
  const [createRevision, setCreateRevision] = useState(0)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null)
  const [editingError, setEditingError] = useState<string | null>(null)
  const [editingSubmitting, setEditingSubmitting] = useState(false)
  const [expandedManagementEmployeeId, setExpandedManagementEmployeeId] = useState<string | null>(null)
  const [expandedProviderId, setExpandedProviderId] = useState<string | null>(null)
  const [expandedArchivedProviderId, setExpandedArchivedProviderId] = useState<string | null>(null)
  const [managementSearch, setManagementSearch] = useState('')
  const [providerSearch, setProviderSearch] = useState('')
  const [providerStatusFilter, setProviderStatusFilter] =
    useState<(typeof providerStatusFilterOptions)[number]['value']>('all')
  const [managementPage, setManagementPage] = useState(1)
  const [providerPage, setProviderPage] = useState(1)
  const [archivedProviderPage, setArchivedProviderPage] = useState(1)
  const [actionTargetId, setActionTargetId] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      setLoading(true)
      setPageError(null)

      try {
        const [employeeData, providerData] = await Promise.all([
          fetchEmployees(),
          fetchManagementProviders(),
        ])

        if (!isMounted) {
          return
        }

        setEmployees(employeeData)
        setProviders(providerData)
      } catch (error) {
        if (!isMounted) {
          return
        }

        const message = error instanceof Error ? error.message : 'Unable to load management data.'
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

  const currentUser = currentUserLabel({
    accessLevel,
    authEmail: authUser?.email,
    employee,
    portalEmail: portalUser?.email,
    customer,
  })

  const currentManagementEmployees = sortEmployees(
    employees.filter(
      (record) =>
        record.deleted_at === null &&
        record.archived_at === null &&
        record.status !== 'archived' &&
        record.rank?.is_management_rank === true &&
        record.character_name.toLowerCase().includes(managementSearch.trim().toLowerCase()),
    ),
  )

  const sortedProviders = sortManagementProviders(providers.filter((record) => record.deleted_at === null))
  const currentProviders = sortedProviders.filter(
    (provider) =>
      !isArchivedManagementProvider(provider) &&
      provider.display_name.toLowerCase().includes(providerSearch.trim().toLowerCase()) &&
      (providerStatusFilter === 'all' ? true : provider.provider_status === providerStatusFilter),
  )
  const archivedProviders = sortedProviders.filter(
    (provider) =>
      isArchivedManagementProvider(provider) &&
      provider.display_name.toLowerCase().includes(providerSearch.trim().toLowerCase()),
  )

  const managementTotalPages = Math.max(1, Math.ceil(currentManagementEmployees.length / ROWS_PER_PAGE))
  const managementDisplayPage = Math.min(managementPage, managementTotalPages)
  const managementPageEmployees = currentManagementEmployees.slice(
    (managementDisplayPage - 1) * ROWS_PER_PAGE,
    managementDisplayPage * ROWS_PER_PAGE,
  )

  const providerTotalPages = Math.max(1, Math.ceil(currentProviders.length / ROWS_PER_PAGE))
  const providerDisplayPage = Math.min(providerPage, providerTotalPages)
  const providerPageRecords = currentProviders.slice(
    (providerDisplayPage - 1) * ROWS_PER_PAGE,
    providerDisplayPage * ROWS_PER_PAGE,
  )

  const archivedProviderTotalPages = Math.max(1, Math.ceil(archivedProviders.length / ROWS_PER_PAGE))
  const archivedProviderDisplayPage = Math.min(archivedProviderPage, archivedProviderTotalPages)
  const archivedProviderPageRecords = archivedProviders.slice(
    (archivedProviderDisplayPage - 1) * ROWS_PER_PAGE,
    archivedProviderDisplayPage * ROWS_PER_PAGE,
  )

  const editingProvider =
    editingProviderId === null
      ? null
      : providers.find((provider) => provider.id === editingProviderId) ?? null

  const canManage = accessLevel === 'management'

  function showBanner(message: string, tone: 'success' | 'error') {
    setBannerMessage(message)
    setBannerTone(tone)
  }

  function syncProvider(updatedProvider: ManagementTeamRecord) {
    setProviders((current) => {
      const nextProviders = current.some((provider) => provider.id === updatedProvider.id)
        ? current.map((provider) =>
            provider.id === updatedProvider.id ? updatedProvider : provider,
          )
        : [updatedProvider, ...current]

      return sortManagementProviders(nextProviders.filter((provider) => provider.deleted_at === null))
    })
  }

  function removeProvider(providerId: string) {
    setProviders((current) => current.filter((provider) => provider.id !== providerId))
  }

  function beginCreate() {
    setCreateVisible(true)
    setEditingProviderId(null)
    setEditingError(null)
    setBannerMessage(null)
    setCreateError(null)
    setCreateRevision((current) => current + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function beginEdit(provider: ManagementTeamRecord) {
    setEditingProviderId(provider.id)
    setCreateVisible(false)
    setCreateError(null)
    setEditingError(null)
    setBannerMessage(null)
    setExpandedProviderId(null)
    setExpandedArchivedProviderId(null)
  }

  function cancelEdit() {
    setEditingProviderId(null)
    setEditingError(null)
  }

  function cancelCreate() {
    setCreateVisible(false)
    setCreateError(null)
  }

  async function handleCreate(values: ManagementProviderFormValues) {
    setCreateSubmitting(true)
    setCreateError(null)
    setBannerMessage(null)

    try {
      const created = await createManagementProvider(values)
      syncProvider(created)
      cancelCreate()
      showBanner(`Created service provider ${created.display_name}.`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create provider.'
      setCreateError(message)
      showBanner(message, 'error')
    } finally {
      setCreateSubmitting(false)
    }
  }

  async function handleEdit(values: ManagementProviderFormValues) {
    if (!editingProviderId) {
      return
    }

    setEditingSubmitting(true)
    setEditingError(null)
    setBannerMessage(null)

    try {
      const updated = await updateManagementProvider(editingProviderId, values)
      syncProvider(updated)
      setEditingProviderId(null)
      showBanner(`Updated service provider ${updated.display_name}.`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update provider.'
      setEditingError(message)
      showBanner(message, 'error')
    } finally {
      setEditingSubmitting(false)
    }
  }

  async function handleArchive(provider: ManagementTeamRecord) {
    setActionTargetId(provider.id)
    setBannerMessage(null)

    try {
      const updated = await archiveManagementProvider(provider.id)
      syncProvider(updated)
      if (editingProviderId === provider.id) {
        cancelEdit()
      }
      showBanner(`Archived provider ${updated.display_name}.`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to archive provider.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  async function handleRestore(provider: ManagementTeamRecord) {
    const confirmed = window.confirm(
      `Restore ${provider.display_name} back into the active service provider list?`,
    )

    if (!confirmed) {
      return
    }

    setActionTargetId(provider.id)
    setBannerMessage(null)

    try {
      const updated = await restoreManagementProvider(provider.id)
      syncProvider(updated)
      showBanner(`Restored provider ${updated.display_name}.`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to restore provider.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  async function handleDelete(provider: ManagementTeamRecord) {
    const confirmed = window.confirm(
      `Soft delete ${provider.display_name}? This will remove the provider from all lists.`,
    )

    if (!confirmed) {
      return
    }

    setActionTargetId(provider.id)
    setBannerMessage(null)

    try {
      await softDeleteManagementProvider(provider.id)
      removeProvider(provider.id)
      if (editingProviderId === provider.id) {
        cancelEdit()
      }
      if (expandedProviderId === provider.id) {
        setExpandedProviderId(null)
      }
      if (expandedArchivedProviderId === provider.id) {
        setExpandedArchivedProviderId(null)
      }
      showBanner(`Deleted provider ${provider.display_name}.`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete provider.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  if (loading) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Management / Providers
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Loading management data</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Fetching in-house management and service providers from Supabase.
        </p>
      </section>
    )
  }

  if (pageError) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Management / Providers
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Unable to load management data</h1>
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
              Management / Providers
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Management / Service Providers
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              In-house management is derived from employee records with management ranks.
              Service providers are maintained separately in Supabase. Current view is limited
              to {accessLevel === 'management' ? 'Management' : 'Employee'} access.
            </p>
          </div>

          <div className="grid gap-3 sm:text-right">
            <FieldPill enabled={false}>{currentManagementEmployees.length} in-house</FieldPill>
            <FieldPill enabled={false}>{currentProviders.length} providers</FieldPill>
            <FieldPill enabled={false}>{archivedProviders.length} archived</FieldPill>
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
              : 'border-rose-500/30 bg-rose-500/10 text-rose-100',
          ].join(' ')}
        >
          {bannerMessage}
        </div>
      ) : null}

      {canManage ? (
        createVisible ? (
          <ServiceProviderForm
            key={createRevision}
            description="Create a service provider record in Supabase. This does not touch in-house management records."
            error={createError}
            isSubmitting={createSubmitting}
            onCancel={cancelCreate}
            onSubmit={handleCreate}
            submitLabel="Create Provider"
            title="Create service provider"
          />
        ) : (
          <div className="flex justify-end">
            <button
              className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              onClick={beginCreate}
              type="button"
            >
              Create Provider
            </button>
          </div>
        )
      ) : null}

      <section className="space-y-4">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
                In-House Management
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
                Read-only management employees
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <FieldPill enabled={true}>Search by character name</FieldPill>
              <FieldPill enabled={true}>Read only</FieldPill>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Search by Character Name
              </span>
              <input
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
                onChange={(event) => {
                  setManagementSearch(event.target.value)
                  setManagementPage(1)
                }}
                placeholder="Search management employees"
                value={managementSearch}
              />
            </label>
          </div>
        </div>

        <ManagementEmployeeTable
          accessLevel={accessLevel ?? 'employee'}
          employees={managementPageEmployees}
          expandedEmployeeId={expandedManagementEmployeeId}
          onToggleExpanded={(employeeId) =>
            setExpandedManagementEmployeeId((current) => (current === employeeId ? null : employeeId))
          }
          title="Current management employees"
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-400">
            {currentManagementEmployees.length === 0
              ? 'No in-house management employees match the current search.'
              : `Showing ${Math.min((managementDisplayPage - 1) * ROWS_PER_PAGE + 1, currentManagementEmployees.length)} to ${Math.min(managementDisplayPage * ROWS_PER_PAGE, currentManagementEmployees.length)} of ${currentManagementEmployees.length}.`}
          </p>
          <div className="flex items-center gap-2">
            <button
              className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={managementDisplayPage <= 1}
              onClick={() => setManagementPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              Previous
            </button>
            <button
              className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={managementDisplayPage >= managementTotalPages}
              onClick={() => setManagementPage((current) => Math.min(managementTotalPages, current + 1))}
              type="button"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
                Service Providers
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
                External management records
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <FieldPill enabled={true}>Search by display name</FieldPill>
              <FieldPill enabled={true}>Filter by provider status</FieldPill>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Search by Display Name
              </span>
              <input
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
                onChange={(event) => {
                  setProviderSearch(event.target.value)
                  setProviderPage(1)
                  setArchivedProviderPage(1)
                }}
                placeholder="Search providers"
                value={providerSearch}
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Filter by Provider Status
              </span>
              <select
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50"
                onChange={(event) => {
                  setProviderStatusFilter(
                    event.target.value as (typeof providerStatusFilterOptions)[number]['value'],
                  )
                  setProviderPage(1)
                }}
                value={providerStatusFilter}
              >
                {providerStatusFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <ProviderTable
          accessLevel={accessLevel ?? 'employee'}
          actionTargetId={actionTargetId}
          editingError={editingError}
          editingProvider={editingProvider}
          editingProviderId={editingProviderId}
          editingSubmitting={editingSubmitting}
          onArchive={handleArchive}
          onCancelEdit={cancelEdit}
          onDelete={handleDelete}
          onRestore={handleRestore}
          onStartEdit={beginEdit}
          onSubmitEdit={handleEdit}
          onToggleExpanded={(providerId) =>
            setExpandedProviderId((current) => (current === providerId ? null : providerId))
          }
          providers={providerPageRecords}
          showArchiveActions={false}
          title="Current providers"
          expandedProviderId={expandedProviderId}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-400">
            {currentProviders.length === 0
              ? 'No providers match the active filters.'
              : `Showing ${Math.min((providerDisplayPage - 1) * ROWS_PER_PAGE + 1, currentProviders.length)} to ${Math.min(providerDisplayPage * ROWS_PER_PAGE, currentProviders.length)} of ${currentProviders.length}.`}
          </p>
          <div className="flex items-center gap-2">
            <button
              className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={providerDisplayPage <= 1}
              onClick={() => setProviderPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              Previous
            </button>
            <button
              className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={providerDisplayPage >= providerTotalPages}
              onClick={() => setProviderPage((current) => Math.min(providerTotalPages, current + 1))}
              type="button"
            >
              Next
            </button>
          </div>
        </div>

        {canManage && archivedProviders.length > 0 ? (
          <>
            <ProviderTable
              accessLevel="management"
              actionTargetId={actionTargetId}
              editingError={null}
              editingProvider={null}
              editingProviderId={null}
              editingSubmitting={false}
              onArchive={handleArchive}
              onCancelEdit={cancelEdit}
              onDelete={handleDelete}
              onRestore={handleRestore}
              onStartEdit={beginEdit}
              onSubmitEdit={handleEdit}
              onToggleExpanded={(providerId) =>
                setExpandedArchivedProviderId((current) =>
                  current === providerId ? null : providerId,
                )
              }
              providers={archivedProviderPageRecords}
              showArchiveActions
              title="Archived providers"
              expandedProviderId={expandedArchivedProviderId}
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-400">
                {archivedProviders.length === 0
                  ? 'No archived providers available.'
                  : `Showing ${Math.min((archivedProviderDisplayPage - 1) * ROWS_PER_PAGE + 1, archivedProviders.length)} to ${Math.min(archivedProviderDisplayPage * ROWS_PER_PAGE, archivedProviders.length)} of ${archivedProviders.length}.`}
              </p>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={archivedProviderDisplayPage <= 1}
                  onClick={() => setArchivedProviderPage((current) => Math.max(1, current - 1))}
                  type="button"
                >
                  Previous
                </button>
                <button
                  className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={archivedProviderDisplayPage >= archivedProviderTotalPages}
                  onClick={() =>
                    setArchivedProviderPage((current) => Math.min(archivedProviderTotalPages, current + 1))
                  }
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        ) : null}
      </section>

      {actionTargetId ? (
        <div className="sr-only" aria-live="polite">
          Saving provider changes.
        </div>
      ) : null}
    </section>
  )
}
