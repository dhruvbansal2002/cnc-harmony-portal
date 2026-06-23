import { Fragment, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { AuditLogRecord } from '../../auth/types'
import { useAuth } from '../../auth/useAuth'
import { fetchAuditLogs } from '../../lib/auditLogs'

const ROWS_PER_PAGE = 20

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

function shortId(value: string | null) {
  if (!value) {
    return '-'
  }

  return value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value
}

function formatJson(value: Record<string, unknown> | null) {
  if (!value) {
    return '-'
  }

  return JSON.stringify(value, null, 2)
}

function resolveActorLabel(log: AuditLogRecord) {
  if (!log.actor_user_id) {
    return 'System'
  }

  return log.actor_user?.email ?? log.actor_user_id
}

function resolveActorSummary(log: AuditLogRecord) {
  if (!log.actor_user_id) {
    return 'System'
  }

  const actor = log.actor_user

  if (!actor) {
    return log.actor_user_id
  }

  return [actor.email ?? actor.id, actor.permission_level].join(' | ')
}

function summarizeAuditLog(log: AuditLogRecord) {
  const action = log.action.replace(/_/g, ' ').trim()
  const tableName = log.table_name.replace(/_/g, ' ').trim()

  if (action.toLowerCase().includes('update')) {
    const oldData = log.old_data ?? {}
    const newData = log.new_data ?? {}
    const changedFields = Array.from(
      new Set([...Object.keys(oldData), ...Object.keys(newData)]),
    ).filter((key) => JSON.stringify(oldData[key]) !== JSON.stringify(newData[key]))

    if (changedFields.length > 0) {
      return `Updated ${tableName} (${changedFields.length} field${changedFields.length === 1 ? '' : 's'})`
    }

    return `Updated ${tableName}`
  }

  if (action.toLowerCase().includes('insert')) {
    return `Created ${tableName}`
  }

  if (action.toLowerCase().includes('delete')) {
    return `Deleted from ${tableName}`
  }

  return `${action} ${tableName}`.trim()
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

function DetailBlock({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">{label}</p>
      <div className="mt-2 text-sm leading-6 text-slate-200">{children}</div>
    </div>
  )
}

function JsonBlock({
  label,
  value,
}: {
  label: string
  value: Record<string, unknown> | null
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">{label}</p>
      <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-slate-200">
        {formatJson(value)}
      </pre>
    </div>
  )
}

function AuditLogDetailPanel({ log }: { log: AuditLogRecord }) {
  return (
    <div className="grid gap-4 rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-4 sm:p-5 lg:grid-cols-2">
      <div className="grid gap-4">
        <DetailBlock label="Actor user">{resolveActorSummary(log)}</DetailBlock>
        <DetailBlock label="Action">{log.action}</DetailBlock>
        <DetailBlock label="Table Name">{log.table_name}</DetailBlock>
        <DetailBlock label="Row ID">{log.row_id ?? '-'}</DetailBlock>
        <DetailBlock label="Created At">{formatDateTime(log.created_at)}</DetailBlock>
      </div>

      <div className="grid gap-4">
        <JsonBlock label="Old Data JSON" value={log.old_data} />
        <JsonBlock label="New Data JSON" value={log.new_data} />
      </div>
    </div>
  )
}

function AuditLogTable({
  logs,
  expandedLogId,
  onToggleExpanded,
}: {
  logs: AuditLogRecord[]
  expandedLogId: string | null
  onToggleExpanded: (logId: string) => void
}) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
            Audit Logs
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
            {logs.length} {logs.length === 1 ? 'log entry' : 'log entries'}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone="neutral">Newest first</StatusBadge>
          <StatusBadge tone="accent">Read only</StatusBadge>
          <StatusBadge tone="neutral">20 rows per page</StatusBadge>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-[1080px] w-full border-separate border-spacing-0">
          <thead>
            <tr className="text-left text-[0.7rem] uppercase tracking-[0.28em] text-slate-500">
              <th className="border-b border-white/10 px-4 py-3">Created At</th>
              <th className="border-b border-white/10 px-4 py-3">Actor</th>
              <th className="border-b border-white/10 px-4 py-3">Action</th>
              <th className="border-b border-white/10 px-4 py-3">Table Name</th>
              <th className="border-b border-white/10 px-4 py-3">Row ID</th>
              <th className="border-b border-white/10 px-4 py-3">Summary</th>
            </tr>
          </thead>

          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-sm text-slate-400" colSpan={6}>
                  No audit logs found.
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const isExpanded = expandedLogId === log.id

                return (
                  <Fragment key={log.id}>
                    <tr
                      className="cursor-pointer align-top transition hover:bg-white/5"
                      onClick={() => onToggleExpanded(log.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          onToggleExpanded(log.id)
                        }
                      }}
                    >
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {formatDateTime(log.created_at)}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4">
                        <div className="text-sm font-semibold text-white">{resolveActorLabel(log)}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {log.actor_user_id ? shortId(log.actor_user_id) : 'System'}
                        </div>
                      </td>
                      <td className="border-b border-white/5 px-4 py-4">
                        <StatusBadge tone="neutral">{log.action}</StatusBadge>
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {log.table_name}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {shortId(log.row_id)}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {summarizeAuditLog(log)}
                      </td>
                    </tr>

                    {isExpanded ? (
                      <tr>
                        <td className="border-b border-white/5 px-4 pb-5 pt-0" colSpan={6}>
                          <AuditLogDetailPanel log={log} />
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

export function AuditLogsPage() {
  const { accessLevel, authUser } = useAuth()
  const isManagement = accessLevel === 'management'

  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([])
  const [loading, setLoading] = useState(isManagement)
  const [pageError, setPageError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [tableFilter, setTableFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

  useEffect(() => {
    if (!isManagement) {
      return
    }

    let isMounted = true

    async function loadAuditLogs() {
      setLoading(true)
      setPageError(null)

      try {
        const logs = await fetchAuditLogs()

        if (!isMounted) {
          return
        }

        setAuditLogs(logs)
      } catch (error) {
        if (!isMounted) {
          return
        }

        const message = error instanceof Error ? error.message : 'Unable to load audit logs.'
        setPageError(message)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void loadAuditLogs()

    return () => {
      isMounted = false
    }
  }, [isManagement])

  const tableNameOptions = useMemo(
    () => ['all', ...new Set(auditLogs.map((log) => log.table_name).sort((first, second) => first.localeCompare(second)))],
    [auditLogs],
  )

  const actionOptions = useMemo(
    () => ['all', ...new Set(auditLogs.map((log) => log.action).sort((first, second) => first.localeCompare(second)))],
    [auditLogs],
  )

  const filteredLogs = useMemo(() => {
    const searchTerm = searchQuery.trim().toLowerCase()

    return auditLogs.filter((log) => {
      const matchesSearch =
        searchTerm.length === 0 ||
        log.table_name.toLowerCase().includes(searchTerm) ||
        log.action.toLowerCase().includes(searchTerm)
      const matchesTable = tableFilter === 'all' || log.table_name === tableFilter
      const matchesAction = actionFilter === 'all' || log.action === actionFilter

      return matchesSearch && matchesTable && matchesAction
    })
  }, [actionFilter, auditLogs, searchQuery, tableFilter])

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / ROWS_PER_PAGE))
  const displayPage = Math.min(currentPage, totalPages)
  const pagedLogs = filteredLogs.slice(
    (displayPage - 1) * ROWS_PER_PAGE,
    displayPage * ROWS_PER_PAGE,
  )

  if (!isManagement) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Audit Logs
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Access restricted</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Audit logs are available to management only.
        </p>
      </section>
    )
  }

  if (loading) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Audit Logs
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Loading audit logs</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Fetching the live audit trail from Supabase.
        </p>
      </section>
    )
  }

  if (pageError) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Audit Logs
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Unable to load audit logs</h1>
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
              Audit Logs
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Audit Trail
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Read-only audit records from Supabase. Actor rows resolve through `public.users`
              when available.
            </p>
          </div>

          <div className="grid gap-3 sm:text-right">
            <StatusBadge tone="neutral">{auditLogs.length} total logs</StatusBadge>
            <StatusBadge tone="accent">Management access</StatusBadge>
            <StatusBadge tone="neutral">{authUser?.email ?? 'Signed in user'}</StatusBadge>
          </div>
        </div>
      </div>

      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
              Filters
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
              Search and filter audit logs
            </h2>
          </div>
          <div className="text-sm text-slate-400">
            Showing page {displayPage} of {totalPages}
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Search by table or action
            </span>
            <input
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
              onChange={(event) => {
                setSearchQuery(event.target.value)
                setCurrentPage(1)
              }}
              placeholder="Search audit logs"
              value={searchQuery}
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Filter by table name
            </span>
            <select
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50"
              onChange={(event) => {
                setTableFilter(event.target.value)
                setCurrentPage(1)
              }}
              value={tableFilter}
            >
              {tableNameOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'all' ? 'All tables' : option}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Filter by action
            </span>
            <select
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50"
              onChange={(event) => {
                setActionFilter(event.target.value)
                setCurrentPage(1)
              }}
              value={actionFilter}
            >
              {actionOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'all' ? 'All actions' : option}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <AuditLogTable
        expandedLogId={expandedLogId}
        logs={pagedLogs}
        onToggleExpanded={(logId) =>
          setExpandedLogId((current) => (current === logId ? null : logId))
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          {filteredLogs.length === 0
            ? 'No audit logs match the active filters.'
            : `Showing ${Math.min((displayPage - 1) * ROWS_PER_PAGE + 1, filteredLogs.length)} to ${Math.min(displayPage * ROWS_PER_PAGE, filteredLogs.length)} of ${filteredLogs.length}.`}
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
    </section>
  )
}
