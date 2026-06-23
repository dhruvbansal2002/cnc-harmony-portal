import { Fragment, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../../auth/useAuth'
import type { ExEmployeeRecord } from '../../auth/types'
import { ExEmployeeCsvImport } from '../../components/ex-employees/ExEmployeeCsvImport'
import { ActionMenu } from '../../components/ui/ActionMenu'
import {
  fetchExEmployees,
  isRestoredExEmployee,
  restoreExEmployee,
  softDeleteExEmployee,
  sortExEmployees,
} from '../../lib/exEmployees'
import { importExEmployeeCsvRows } from '../../lib/exEmployeeCsvImport'

const ROWS_PER_PAGE = 20

const separationFilterOptions = [
  { value: 'all', label: 'All separation types' },
  { value: 'fired', label: 'Fired' },
  { value: 'resigned', label: 'Resigned' },
] as const

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

function daysInJob(hireDate: string | null, leaveDate: string | null) {
  if (!hireDate || !leaveDate) {
    return '-'
  }

  const hireParsed = new Date(`${hireDate}T00:00:00Z`)
  const leaveParsed = new Date(`${leaveDate}T00:00:00Z`)

  if (Number.isNaN(hireParsed.getTime()) || Number.isNaN(leaveParsed.getTime())) {
    return '-'
  }

  const hireUtc = Date.UTC(
    hireParsed.getUTCFullYear(),
    hireParsed.getUTCMonth(),
    hireParsed.getUTCDate(),
  )
  const leaveUtc = Date.UTC(
    leaveParsed.getUTCFullYear(),
    leaveParsed.getUTCMonth(),
    leaveParsed.getUTCDate(),
  )

  return `${Math.max(0, Math.floor((leaveUtc - hireUtc) / 86400000))} days`
}

function isManagementAccess(accessLevel: string | null) {
  return accessLevel === 'management'
}

function ExEmployeeDetailPanel({ exEmployee }: { exEmployee: ExEmployeeRecord }) {
  return (
    <div className="grid gap-4 rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-4 sm:p-5 lg:grid-cols-2">
      <div className="grid gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Character Name
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{exEmployee.character_name}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Citizen ID
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{exEmployee.citizen_id}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Phone Number
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {exEmployee.phone_number ?? '-'}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Discord Username
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {exEmployee.discord_username ?? '-'}
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Last Rank
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {exEmployee.rank_name_snapshot}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Division
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{exEmployee.division ?? '-'}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Hire Date
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{formatDate(exEmployee.hire_date)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Last Promotion Date
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {formatDate(exEmployee.last_promotion_date)}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Leave Date
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{formatDate(exEmployee.leave_date)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Separation Type
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {exEmployee.separation_type === 'fired' ? 'Fired' : 'Resigned'}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Reason
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {exEmployee.reason?.trim() ? exEmployee.reason : '-'}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Warnings
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-200">{exEmployee.warnings}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Strike 1
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-200">
              {exEmployee.strike_1 ? 'Yes' : 'No'}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Strike 2
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-200">
              {exEmployee.strike_2 ? 'Yes' : 'No'}
            </p>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Total Bills
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {formatNumber(exEmployee.total_bills)}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Days in Job
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {daysInJob(exEmployee.hire_date, exEmployee.leave_date)}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Restored At
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {formatDate(exEmployee.restored_at)}
          </p>
        </div>
      </div>
    </div>
  )
}

function ExEmployeeTable({
  title,
  exEmployees,
  accessLevel,
  expandedExEmployeeId,
  onToggleExpanded,
  onRestore,
  onDelete,
  showRestoreAction = false,
  actionTargetId,
}: {
  title: string
  exEmployees: ExEmployeeRecord[]
  accessLevel: 'management' | 'employee' | 'customer'
  expandedExEmployeeId: string | null
  onToggleExpanded: (exEmployeeId: string) => void
  onRestore: (exEmployee: ExEmployeeRecord) => void
  onDelete: (exEmployee: ExEmployeeRecord) => void
  showRestoreAction?: boolean
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
            {exEmployees.length} {exEmployees.length === 1 ? 'record' : 'records'}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <FieldPill enabled={false}>{showRestoreAction ? 'Restored' : 'Current'}</FieldPill>
          <FieldPill enabled>20 rows per page</FieldPill>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-[1280px] w-full border-separate border-spacing-0">
          <thead>
            <tr className="text-left text-[0.7rem] uppercase tracking-[0.28em] text-slate-500">
              <th className="border-b border-white/10 px-4 py-3">Character Name</th>
              <th className="border-b border-white/10 px-4 py-3">Citizen ID</th>
              <th className="border-b border-white/10 px-4 py-3">Phone Number</th>
              <th className="border-b border-white/10 px-4 py-3">Discord Username</th>
              <th className="border-b border-white/10 px-4 py-3">Last Rank</th>
              <th className="border-b border-white/10 px-4 py-3">Division</th>
              <th className="border-b border-white/10 px-4 py-3">Hire Date</th>
              <th className="border-b border-white/10 px-4 py-3">Leave Date</th>
              <th className="border-b border-white/10 px-4 py-3">Separation Type</th>
              <th className="border-b border-white/10 px-4 py-3">Reason</th>
              <th className="border-b border-white/10 px-4 py-3">Total Bills</th>
              <th className="border-b border-white/10 px-4 py-3">Days in Job</th>
              <th className="border-b border-white/10 px-4 py-3">Actions</th>
            </tr>
          </thead>

          <tbody>
            {exEmployees.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-sm text-slate-400" colSpan={13}>
                  No records found.
                </td>
              </tr>
            ) : (
              exEmployees.map((exEmployee) => {
                const isExpanded = expandedExEmployeeId === exEmployee.id

                return (
                  <Fragment key={exEmployee.id}>
                    <tr className="align-top">
                      <td className="border-b border-white/5 px-4 py-4">
                        <button
                          className="text-left text-sm font-semibold text-white transition hover:text-cyan-200"
                          onClick={() => onToggleExpanded(exEmployee.id)}
                          type="button"
                        >
                          {exEmployee.character_name}
                        </button>
                        <p className="mt-2 text-xs text-slate-500">
                          {exEmployee.restored_at ? 'Restored row' : exEmployee.rank_name_snapshot}
                        </p>
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {exEmployee.citizen_id}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {exEmployee.phone_number ?? '-'}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {exEmployee.discord_username ?? '-'}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {exEmployee.rank_name_snapshot}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {exEmployee.division ?? '-'}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {formatDate(exEmployee.hire_date)}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {formatDate(exEmployee.leave_date)}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4">
                        <StatusBadge
                          tone={exEmployee.separation_type === 'fired' ? 'danger' : 'warning'}
                        >
                          {exEmployee.separation_type}
                        </StatusBadge>
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {exEmployee.reason?.trim() ? exEmployee.reason : '-'}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {formatNumber(exEmployee.total_bills)}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {daysInJob(exEmployee.hire_date, exEmployee.leave_date)}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4">
                        {canManage ? (
                          <ActionMenu triggerLabel="Actions">
                              {!showRestoreAction ? (
                                <>
                                  <button
                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-emerald-100 transition hover:bg-emerald-500/10"
                                    onClick={() => onRestore(exEmployee)}
                                    type="button"
                                  >
                                    Restore Employee
                                  </button>
                                  <button
                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-rose-100 transition hover:bg-rose-500/10"
                                    onClick={() => onDelete(exEmployee)}
                                    type="button"
                                  >
                                    Delete
                                  </button>
                                </>
                              ) : (
                                <button
                                  className="block w-full rounded-xl px-3 py-2 text-left text-sm text-rose-100 transition hover:bg-rose-500/10"
                                  onClick={() => onDelete(exEmployee)}
                                  type="button"
                                >
                                  Delete
                                </button>
                              )}
                          </ActionMenu>
                        ) : (
                          <span className="text-sm text-slate-500">Read only</span>
                        )}
                      </td>
                    </tr>

                    {isExpanded ? (
                      <tr>
                        <td className="border-b border-white/5 px-4 pb-5 pt-0" colSpan={13}>
                          <ExEmployeeDetailPanel exEmployee={exEmployee} />
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
          Saving ex-employee changes.
        </div>
      ) : null}
    </section>
  )
}

export function ExEmployeeSheetPage() {
  const { accessLevel } = useAuth()
  const isManagement = accessLevel === 'management'

  const [exEmployees, setExEmployees] = useState<ExEmployeeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [bannerMessage, setBannerMessage] = useState<string | null>(null)
  const [bannerTone, setBannerTone] = useState<'success' | 'error' | 'warning' | null>(null)
  const [importVisible, setImportVisible] = useState(false)
  const [expandedExEmployeeId, setExpandedExEmployeeId] = useState<string | null>(null)
  const [actionTargetId, setActionTargetId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [separationFilter, setSeparationFilter] = useState<(typeof separationFilterOptions)[number]['value']>('all')
  const [rankFilter, setRankFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    let isMounted = true

    async function loadExEmployees() {
      setLoading(true)
      setPageError(null)

      try {
        const data = await fetchExEmployees()

        if (!isMounted) {
          return
        }

        setExEmployees(data)
      } catch (error) {
        if (!isMounted) {
          return
        }

        const message = error instanceof Error ? error.message : 'Unable to load ex-employees.'
        setPageError(message)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void loadExEmployees()

    return () => {
      isMounted = false
    }
  }, [])

  const currentUserLabel =
    accessLevel === 'management'
      ? 'Management access'
      : accessLevel === 'employee'
        ? 'Employee access'
        : 'Customer access'

  function showBanner(message: string, tone: 'success' | 'error' | 'warning') {
    setBannerMessage(message)
    setBannerTone(tone)
  }

  function syncExEmployee(updatedExEmployee: ExEmployeeRecord) {
    setExEmployees((current) => {
      const nextRecords = current.some((record) => record.id === updatedExEmployee.id)
        ? current.map((record) =>
            record.id === updatedExEmployee.id ? updatedExEmployee : record,
          )
        : [updatedExEmployee, ...current]

      return sortExEmployees(nextRecords.filter((record) => record.deleted_at === null))
    })
  }

  function removeExEmployee(exEmployeeId: string) {
    setExEmployees((current) => current.filter((record) => record.id !== exEmployeeId))
  }

  const existingCitizenIds = useMemo(
    () => exEmployees.map((exEmployee) => exEmployee.citizen_id),
    [exEmployees],
  )

  const searchTerm = searchQuery.trim().toLowerCase()

  const currentExEmployees = useMemo(
    () =>
      exEmployees.filter(
        (exEmployee) =>
          !isRestoredExEmployee(exEmployee) &&
          exEmployee.character_name.toLowerCase().includes(searchTerm) &&
          (separationFilter === 'all'
            ? true
            : exEmployee.separation_type === separationFilter) &&
          (rankFilter === 'all'
            ? true
            : exEmployee.rank_name_snapshot === rankFilter),
      ),
    [exEmployees, rankFilter, searchTerm, separationFilter],
  )

  const restoredExEmployees = useMemo(
    () =>
      exEmployees.filter(
        (exEmployee) =>
          isRestoredExEmployee(exEmployee) &&
          exEmployee.character_name.toLowerCase().includes(searchTerm) &&
          (separationFilter === 'all'
            ? true
            : exEmployee.separation_type === separationFilter) &&
          (rankFilter === 'all'
            ? true
            : exEmployee.rank_name_snapshot === rankFilter),
      ),
    [exEmployees, rankFilter, searchTerm, separationFilter],
  )

  const rankFilterOptions = useMemo(() => {
    const names = Array.from(
      new Set(exEmployees.map((exEmployee) => exEmployee.rank_name_snapshot).filter(Boolean)),
    ).sort((first, second) => first.localeCompare(second))

    return ['all', ...names]
  }, [exEmployees])

  const totalPages = Math.max(1, Math.ceil(currentExEmployees.length / ROWS_PER_PAGE))
  const displayPage = Math.min(currentPage, totalPages)
  const pagedExEmployees = currentExEmployees.slice(
    (displayPage - 1) * ROWS_PER_PAGE,
    displayPage * ROWS_PER_PAGE,
  )

  const showRestoredSection = isManagement && restoredExEmployees.length > 0

  async function handleCsvImport(
    rows: Parameters<typeof importExEmployeeCsvRows>[0],
  ) {
    setBannerMessage(null)

    const result = await importExEmployeeCsvRows(rows)

    result.insertedExEmployees.forEach((exEmployee) => {
      syncExEmployee(exEmployee)
    })

    if (result.insertedCount > 0) {
      setExpandedExEmployeeId(result.insertedExEmployees[0]?.id ?? null)
    }

    setImportVisible(false)

    showBanner(
      `Imported ${result.insertedCount} ex-employee${result.insertedCount === 1 ? '' : 's'}; ${result.skippedCount} skipped; ${result.failedCount} failed.`,
      result.failedCount > 0 ? 'warning' : 'success',
    )

    return result
  }

  if (loading) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Ex-Employee Sheet
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Loading ex-employees</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Fetching ex-employee records from Supabase.
        </p>
      </section>
    )
  }

  if (pageError) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Ex-Employee Sheet
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Unable to load ex-employees</h1>
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
              Ex-Employee Sheet
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Ex-Employee Control Center
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Ex-employee records are sourced from Supabase. Current view is limited to{' '}
              {currentUserLabel}.
            </p>
          </div>

          <div className="grid gap-3 sm:text-right">
            <FieldPill enabled={false}>{currentExEmployees.length} current</FieldPill>
            {isManagement ? (
              <FieldPill enabled={false}>{restoredExEmployees.length} restored</FieldPill>
            ) : (
              <FieldPill enabled>Read only</FieldPill>
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
              : bannerTone === 'warning'
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-100',
          ].join(' ')}
        >
          {bannerMessage}
        </div>
      ) : null}

      {isManagement ? (
        importVisible ? (
          <ExEmployeeCsvImport
            existingCitizenIds={existingCitizenIds}
            onClose={() => setImportVisible(false)}
            onConfirmImport={handleCsvImport}
          />
        ) : (
          <div className="flex justify-end">
            <button
              className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              onClick={() => {
                setImportVisible(true)
                setBannerMessage(null)
                setExpandedExEmployeeId(null)
              }}
              type="button"
            >
              Import CSV
            </button>
          </div>
        )
      ) : null}

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
            Showing page {displayPage} of {totalPages}
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
              placeholder="Search ex-employees"
              value={searchQuery}
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Filter by Separation Type
            </span>
            <select
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50"
              onChange={(event) => {
                setSeparationFilter(
                  event.target.value as (typeof separationFilterOptions)[number]['value'],
                )
                setCurrentPage(1)
              }}
              value={separationFilter}
            >
              {separationFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Filter by Last Rank
            </span>
            <select
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50"
              onChange={(event) => {
                setRankFilter(event.target.value)
                setCurrentPage(1)
              }}
              value={rankFilter}
            >
              {rankFilterOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'all' ? 'All ranks' : option}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <ExEmployeeTable
        accessLevel={accessLevel ?? 'employee'}
        actionTargetId={actionTargetId}
        exEmployees={pagedExEmployees}
        expandedExEmployeeId={expandedExEmployeeId}
        onDelete={async (exEmployee) => {
          const confirmed = window.confirm(
            `Soft delete ${exEmployee.character_name}? This will remove the record from the ex-employee sheet.`,
          )

          if (!confirmed) {
            return
          }

          setActionTargetId(exEmployee.id)
          setBannerMessage(null)

          try {
            await softDeleteExEmployee(exEmployee.id)
            removeExEmployee(exEmployee.id)
            if (expandedExEmployeeId === exEmployee.id) {
              setExpandedExEmployeeId(null)
            }
            showBanner(`Deleted ex-employee ${exEmployee.character_name}.`, 'success')
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Unable to delete ex-employee.'
            showBanner(message, 'error')
          } finally {
            setActionTargetId(null)
          }
        }}
        onRestore={async (exEmployee) => {
          const confirmed = window.confirm(
            `Restore ${exEmployee.character_name} back into the employee sheet?`,
          )

          if (!confirmed) {
            return
          }

          setActionTargetId(exEmployee.id)
          setBannerMessage(null)

          try {
            const result = await restoreExEmployee(exEmployee)
            syncExEmployee(result.exEmployee)
            showBanner(
              result.rankWarning
                ? `Restored ${exEmployee.character_name}. ${result.rankWarning}`
                : `Restored ${exEmployee.character_name}.`,
              result.rankWarning ? 'warning' : 'success',
            )
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Unable to restore ex-employee.'
            showBanner(message, 'error')
          } finally {
            setActionTargetId(null)
          }
        }}
        onToggleExpanded={(exEmployeeId) =>
          setExpandedExEmployeeId((current) => (current === exEmployeeId ? null : exEmployeeId))
        }
        showRestoreAction={false}
        title="Current ex-employees"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          {currentExEmployees.length === 0
            ? 'No current ex-employees match the active filters.'
            : `Showing ${Math.min((displayPage - 1) * ROWS_PER_PAGE + 1, currentExEmployees.length)} to ${Math.min(displayPage * ROWS_PER_PAGE, currentExEmployees.length)} of ${currentExEmployees.length}.`}
        </p>
        <div className="flex items-center gap-2">
          <button
            className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={displayPage <= 1}
            onClick={() => setCurrentPage((current) => Math.max(1, current - 1))}
            type="button"
          >
            Previous
          </button>
          <button
            className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={displayPage >= totalPages}
            onClick={() => setCurrentPage((current) => Math.min(totalPages, current + 1))}
            type="button"
          >
            Next
          </button>
        </div>
      </div>

      {showRestoredSection ? (
        <ExEmployeeTable
          accessLevel="management"
          actionTargetId={actionTargetId}
          exEmployees={restoredExEmployees}
          expandedExEmployeeId={expandedExEmployeeId}
          onDelete={async (exEmployee) => {
            const confirmed = window.confirm(
              `Soft delete restored record for ${exEmployee.character_name}?`,
            )

            if (!confirmed) {
              return
            }

            setActionTargetId(exEmployee.id)
            setBannerMessage(null)

            try {
              await softDeleteExEmployee(exEmployee.id)
              removeExEmployee(exEmployee.id)
              showBanner(`Deleted restored ex-employee ${exEmployee.character_name}.`, 'success')
            } catch (error) {
              const message =
                error instanceof Error ? error.message : 'Unable to delete restored record.'
              showBanner(message, 'error')
            } finally {
              setActionTargetId(null)
            }
          }}
          onRestore={async () => {
            // Restored rows are already restored; keep the action surface minimal.
          }}
          onToggleExpanded={(exEmployeeId) =>
            setExpandedExEmployeeId((current) => (current === exEmployeeId ? null : exEmployeeId))
          }
          showRestoreAction={true}
          title="Restored ex-employees"
        />
      ) : null}
    </section>
  )
}
