import { Fragment, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../../auth/useAuth'
import type { StoreCollaborationRecord } from '../../auth/types'
import { ActionMenu } from '../../components/ui/ActionMenu'
import { StoreCollaborationForm } from '../../components/store-collaborations/StoreCollaborationForm'
import {
  archiveStoreCollaboration,
  createStoreCollaboration,
  fetchStoreCollaborations,
  restoreStoreCollaboration,
  softDeleteStoreCollaboration,
  sortArchivedStoreCollaborationsOnly,
  sortCurrentStoreCollaborations,
  sortStoreCollaborations,
  storeCollaborationToFormValues,
  updateStoreCollaboration,
  type StoreCollaborationFormValues,
} from '../../lib/storeCollaborations'

const ROWS_PER_PAGE = 20

const statusFilterOptions = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
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
  employeeName,
}: {
  accessLevel: string | null
  authEmail: string | undefined
  employeeName: string | null
}) {
  return employeeName ?? authEmail ?? accessLabel(accessLevel)
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

function StoreCollaborationStatusBadge({ status }: { status: StoreCollaborationRecord['status'] }) {
  const badgeMap: Record<
    StoreCollaborationRecord['status'],
    { tone: 'success' | 'warning' | 'neutral' | 'danger'; label: string }
  > = {
    active: { tone: 'success', label: 'Active' },
    inactive: { tone: 'warning', label: 'Inactive' },
    archived: { tone: 'danger', label: 'Archived' },
  }

  const badge = badgeMap[status]
  return <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
}

function StoreCollaborationDetailPanel({
  collaboration,
}: {
  collaboration: StoreCollaborationRecord
}) {
  return (
    <div className="grid gap-4 rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-4 sm:p-5 lg:grid-cols-2">
      <div className="grid gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Store Name
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{collaboration.store_name}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Contact Name
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {collaboration.contact_name ?? '-'}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Phone Number
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {collaboration.phone_number ?? '-'}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Discord Username
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {collaboration.discord_username ?? '-'}
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Collaboration Type
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {collaboration.collaboration_type ?? '-'}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Notes
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{collaboration.notes ?? '-'}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Status
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            <StoreCollaborationStatusBadge status={collaboration.status} />
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Created At
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {formatDateTime(collaboration.created_at)}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Updated At
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {formatDateTime(collaboration.updated_at)}
          </p>
        </div>
      </div>
    </div>
  )
}

function StoreCollaborationTable({
  title,
  records,
  accessLevel,
  expandedRecordId,
  onToggleExpanded,
  onStartEdit,
  onArchive,
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
}: {
  title: string
  records: StoreCollaborationRecord[]
  accessLevel: 'management' | 'employee'
  expandedRecordId: string | null
  onToggleExpanded: (recordId: string) => void
  onStartEdit: (record: StoreCollaborationRecord) => void
  onArchive: (record: StoreCollaborationRecord) => void
  onRestore: (record: StoreCollaborationRecord) => void
  onDelete: (record: StoreCollaborationRecord) => void
  showArchiveActions?: boolean
  editingRecordId: string | null
  editingRecord: StoreCollaborationRecord | null
  editingError: string | null
  editingSubmitting: boolean
  onSubmitEdit: (values: StoreCollaborationFormValues) => Promise<void>
  onCancelEdit: () => void
  actionTargetId: string | null
  showActions: boolean
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
        <table className="min-w-[1200px] w-full border-separate border-spacing-0">
          <thead>
            <tr className="text-left text-[0.7rem] uppercase tracking-[0.28em] text-slate-500">
              <th className="border-b border-white/10 px-4 py-3">Store Name</th>
              <th className="border-b border-white/10 px-4 py-3">Contact Name</th>
              <th className="border-b border-white/10 px-4 py-3">Phone Number</th>
              <th className="border-b border-white/10 px-4 py-3">Discord Username</th>
              <th className="border-b border-white/10 px-4 py-3">Collaboration Type</th>
              <th className="border-b border-white/10 px-4 py-3">Status</th>
              {showActions ? <th className="border-b border-white/10 px-4 py-3">Actions</th> : null}
            </tr>
          </thead>

          <tbody>
            {records.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-sm text-slate-400" colSpan={showActions ? 7 : 6}>
                  No collaborations found.
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
                          {record.store_name}
                        </button>
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {record.contact_name ?? '-'}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {record.phone_number ?? '-'}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {record.discord_username ?? '-'}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {record.collaboration_type ?? '-'}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4">
                        <StoreCollaborationStatusBadge status={record.status} />
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
                        <td className="border-b border-white/5 px-4 pb-5 pt-0" colSpan={showActions ? 7 : 6}>
                          <StoreCollaborationDetailPanel collaboration={record} />
                        </td>
                      </tr>
                    ) : null}

                    {isEditing && editingRecord ? (
                      <tr>
                        <td className="border-b border-white/5 px-4 pb-5 pt-0" colSpan={showActions ? 7 : 6}>
                          <StoreCollaborationForm
                            key={editingRecord.id}
                            description="Update the store collaboration in Supabase. Changes save immediately."
                            error={editingError}
                            initialValues={storeCollaborationToFormValues(editingRecord)}
                            isSubmitting={editingSubmitting}
                            onCancel={onCancelEdit}
                            onSubmit={onSubmitEdit}
                            submitLabel="Save changes"
                            title={`Edit ${editingRecord.store_name}`}
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
          Saving collaboration changes.
        </div>
      ) : null}
    </section>
  )
}

export function StoreCollaborationsPage() {
  const { accessLevel, authUser, employee } = useAuth()

  const activeAccessLevel = accessLevel ?? 'customer'
  const [storeCollaborations, setStoreCollaborations] = useState<StoreCollaborationRecord[]>([])
  const [loading, setLoading] = useState(activeAccessLevel !== 'customer')
  const [pageError, setPageError] = useState<string | null>(null)
  const [bannerMessage, setBannerMessage] = useState<string | null>(null)
  const [bannerTone, setBannerTone] = useState<'success' | 'error' | null>(null)
  const [createVisible, setCreateVisible] = useState(false)
  const [createRevision, setCreateRevision] = useState(0)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null)
  const [editingError, setEditingError] = useState<string | null>(null)
  const [editingSubmitting, setEditingSubmitting] = useState(false)
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null)
  const [expandedArchivedRecordId, setExpandedArchivedRecordId] = useState<string | null>(null)
  const [actionTargetId, setActionTargetId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [collaborationTypeFilter, setCollaborationTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] =
    useState<(typeof statusFilterOptions)[number]['value']>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [archivePage, setArchivePage] = useState(1)

  useEffect(() => {
    if (activeAccessLevel === 'customer') {
      return
    }

    let isMounted = true

    async function loadData() {
      setLoading(true)
      setPageError(null)

      try {
        const data = await fetchStoreCollaborations()

        if (!isMounted) {
          return
        }

        setStoreCollaborations(data)
      } catch (error) {
        if (!isMounted) {
          return
        }

        const message =
          error instanceof Error ? error.message : 'Unable to load store collaborations.'
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
  }, [activeAccessLevel])

  const canManage = activeAccessLevel === 'management'
  const currentUser = currentUserLabel({
    accessLevel: activeAccessLevel,
    authEmail: authUser?.email,
    employeeName: employee?.character_name ?? null,
  })
  const searchTerm = searchQuery.trim().toLowerCase()
  const collaborationTypes = Array.from(
    new Set(
      storeCollaborations
        .map((record) => record.collaboration_type?.trim() ?? '')
        .filter((value) => value.length > 0),
    ),
  ).sort((first, second) => first.localeCompare(second))
  const hasUnspecifiedType = storeCollaborations.some(
    (record) => !record.collaboration_type?.trim(),
  )

  const collaborationTypeOptions = [
    { value: 'all', label: 'All types' },
    ...collaborationTypes.map((type) => ({ value: type, label: type })),
    ...(hasUnspecifiedType ? [{ value: '__unspecified__', label: 'Unspecified' }] : []),
  ] as const

  const currentStoreCollaborations = sortCurrentStoreCollaborations(storeCollaborations).filter(
    (record) =>
      record.store_name.toLowerCase().includes(searchTerm) &&
      (collaborationTypeFilter === 'all'
        ? true
        : collaborationTypeFilter === '__unspecified__'
          ? !record.collaboration_type?.trim()
          : record.collaboration_type?.trim() === collaborationTypeFilter) &&
      (statusFilter === 'all' ? true : record.status === statusFilter),
  )

  const archivedStoreCollaborations = sortArchivedStoreCollaborationsOnly(storeCollaborations).filter(
    (record) =>
      record.store_name.toLowerCase().includes(searchTerm) &&
      (collaborationTypeFilter === 'all'
        ? true
        : collaborationTypeFilter === '__unspecified__'
          ? !record.collaboration_type?.trim()
          : record.collaboration_type?.trim() === collaborationTypeFilter),
  )

  const currentTotalPages = Math.max(1, Math.ceil(currentStoreCollaborations.length / ROWS_PER_PAGE))
  const currentDisplayPage = Math.min(currentPage, currentTotalPages)
  const pagedCurrentStoreCollaborations = currentStoreCollaborations.slice(
    (currentDisplayPage - 1) * ROWS_PER_PAGE,
    currentDisplayPage * ROWS_PER_PAGE,
  )

  const archiveTotalPages = Math.max(1, Math.ceil(archivedStoreCollaborations.length / ROWS_PER_PAGE))
  const archiveDisplayPage = Math.min(archivePage, archiveTotalPages)
  const pagedArchivedStoreCollaborations = archivedStoreCollaborations.slice(
    (archiveDisplayPage - 1) * ROWS_PER_PAGE,
    archiveDisplayPage * ROWS_PER_PAGE,
  )

  const editingRecord =
    editingRecordId === null
      ? null
      : storeCollaborations.find((record) => record.id === editingRecordId) ?? null

  function showBanner(message: string, tone: 'success' | 'error') {
    setBannerMessage(message)
    setBannerTone(tone)
  }

  function syncRecord(updatedRecord: StoreCollaborationRecord) {
    setStoreCollaborations((current) => {
      const nextRecords = current.some((record) => record.id === updatedRecord.id)
        ? current.map((record) => (record.id === updatedRecord.id ? updatedRecord : record))
        : [updatedRecord, ...current]

      return sortStoreCollaborations(nextRecords.filter((record) => record.deleted_at === null))
    })
  }

  function removeRecord(recordId: string) {
    setStoreCollaborations((current) => current.filter((record) => record.id !== recordId))
  }

  function beginCreate() {
    setCreateVisible(true)
    setEditingRecordId(null)
    setCreateError(null)
    setEditingError(null)
    setBannerMessage(null)
    setCreateRevision((current) => current + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function beginEdit(record: StoreCollaborationRecord) {
    setEditingRecordId(record.id)
    setCreateVisible(false)
    setCreateError(null)
    setEditingError(null)
    setBannerMessage(null)
    setExpandedRecordId(null)
    setExpandedArchivedRecordId(null)
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

  async function handleCreate(values: StoreCollaborationFormValues) {
    setCreateSubmitting(true)
    setCreateError(null)
    setBannerMessage(null)

    try {
      const created = await createStoreCollaboration(values)
      syncRecord(created)
      cancelCreate()
      setExpandedRecordId(created.id)
      showBanner(`Created store collaboration ${created.store_name}.`, 'success')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to create store collaboration.'
      setCreateError(message)
      showBanner(message, 'error')
    } finally {
      setCreateSubmitting(false)
    }
  }

  async function handleEdit(values: StoreCollaborationFormValues) {
    if (!editingRecordId) {
      return
    }

    setEditingSubmitting(true)
    setEditingError(null)
    setBannerMessage(null)

    try {
      const updated = await updateStoreCollaboration(editingRecordId, values)
      syncRecord(updated)
      setEditingRecordId(null)
      setExpandedRecordId(updated.id)
      showBanner(`Updated store collaboration ${updated.store_name}.`, 'success')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to update store collaboration.'
      setEditingError(message)
      showBanner(message, 'error')
    } finally {
      setEditingSubmitting(false)
    }
  }

  async function handleArchive(record: StoreCollaborationRecord) {
    setActionTargetId(record.id)
    setBannerMessage(null)

    try {
      const updated = await archiveStoreCollaboration(record.id)
      syncRecord(updated)
      if (editingRecordId === record.id) {
        cancelEdit()
      }
      setExpandedRecordId(null)
      setExpandedArchivedRecordId(updated.id)
      showBanner(`Archived store collaboration ${updated.store_name}.`, 'success')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to archive store collaboration.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  async function handleRestore(record: StoreCollaborationRecord) {
    const confirmed = window.confirm(
      `Restore ${record.store_name} back into the active collaboration list?`,
    )

    if (!confirmed) {
      return
    }

    setActionTargetId(record.id)
    setBannerMessage(null)

    try {
      const updated = await restoreStoreCollaboration(record.id)
      syncRecord(updated)
      setExpandedArchivedRecordId(null)
      setExpandedRecordId(updated.id)
      showBanner(`Restored store collaboration ${updated.store_name}.`, 'success')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to restore store collaboration.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  async function handleDelete(record: StoreCollaborationRecord) {
    const confirmed = window.confirm(
      `Soft delete ${record.store_name}? This will remove the collaboration from all lists.`,
    )

    if (!confirmed) {
      return
    }

    setActionTargetId(record.id)
    setBannerMessage(null)

    try {
      await softDeleteStoreCollaboration(record.id)
      removeRecord(record.id)
      if (editingRecordId === record.id) {
        cancelEdit()
      }
      if (expandedRecordId === record.id) {
        setExpandedRecordId(null)
      }
      if (expandedArchivedRecordId === record.id) {
        setExpandedArchivedRecordId(null)
      }
      showBanner(`Deleted store collaboration ${record.store_name}.`, 'success')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to delete store collaboration.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  if (loading) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Store Collaborations
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Loading store collaborations
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Fetching store collaborations from Supabase.
        </p>
      </section>
    )
  }

  if (pageError) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Store Collaborations
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Unable to load store collaborations
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

  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
              Store Collaborations
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Store Collaboration Control Center
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Store collaborations are sourced from Supabase. Current view is limited to{' '}
              {accessLabel(activeAccessLevel)} access.
            </p>
          </div>

          <div className="grid gap-3 sm:text-right">
            <FieldPill enabled={false}>{currentStoreCollaborations.length} current</FieldPill>
            {canManage ? (
              <FieldPill enabled={false}>{archivedStoreCollaborations.length} archived</FieldPill>
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
              : 'border-rose-500/30 bg-rose-500/10 text-rose-100',
          ].join(' ')}
        >
          {bannerMessage}
        </div>
      ) : null}

      {canManage ? (
        createVisible ? (
          <StoreCollaborationForm
            key={createRevision}
            description="Create a store collaboration in Supabase. This uses live portal data and no bottom-page forms."
            error={createError}
            isSubmitting={createSubmitting}
            onCancel={cancelCreate}
            onSubmit={handleCreate}
            submitLabel="Create Collaboration"
            title="Create store collaboration"
          />
        ) : (
          <div className="flex justify-end">
            <button
              className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              onClick={beginCreate}
              type="button"
            >
              Create Collaboration
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
            Showing page {currentDisplayPage} of {currentTotalPages}
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Search by Store Name
            </span>
            <input
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
              onChange={(event) => {
                setSearchQuery(event.target.value)
                setCurrentPage(1)
                setArchivePage(1)
              }}
              placeholder="Search collaborations"
              value={searchQuery}
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Filter by Collaboration Type
            </span>
            <select
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50"
              onChange={(event) => {
                setCollaborationTypeFilter(event.target.value)
                setCurrentPage(1)
                setArchivePage(1)
              }}
              value={collaborationTypeFilter}
            >
              {collaborationTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
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
      </section>

      <StoreCollaborationTable
        accessLevel={canManage ? 'management' : 'employee'}
        actionTargetId={actionTargetId}
        editingError={editingError}
        editingRecord={editingRecord}
        editingRecordId={editingRecordId}
        editingSubmitting={editingSubmitting}
        expandedRecordId={expandedRecordId}
        onArchive={handleArchive}
        onCancelEdit={cancelEdit}
        onDelete={handleDelete}
        onRestore={handleRestore}
        onStartEdit={beginEdit}
        onSubmitEdit={handleEdit}
        onToggleExpanded={(recordId) =>
          setExpandedRecordId((current) => (current === recordId ? null : recordId))
        }
        records={pagedCurrentStoreCollaborations}
        showActions={canManage}
        showArchiveActions={false}
        title="Current collaborations"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          {currentStoreCollaborations.length === 0
            ? 'No current collaborations match the active filters.'
            : `Showing ${Math.min((currentDisplayPage - 1) * ROWS_PER_PAGE + 1, currentStoreCollaborations.length)} to ${Math.min(currentDisplayPage * ROWS_PER_PAGE, currentStoreCollaborations.length)} of ${currentStoreCollaborations.length}.`}
        </p>
        <div className="flex items-center gap-2">
          <button
            className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={currentDisplayPage <= 1}
            onClick={() => setCurrentPage((current) => Math.max(1, current - 1))}
            type="button"
          >
            Previous
          </button>
          <button
            className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={currentDisplayPage >= currentTotalPages}
            onClick={() => setCurrentPage((current) => Math.min(currentTotalPages, current + 1))}
            type="button"
          >
            Next
          </button>
        </div>
      </div>

      {canManage && archivedStoreCollaborations.length > 0 ? (
        <>
          <StoreCollaborationTable
            accessLevel="management"
            actionTargetId={actionTargetId}
            editingError={null}
            editingRecord={null}
            editingRecordId={null}
            editingSubmitting={false}
            expandedRecordId={expandedArchivedRecordId}
            onArchive={handleArchive}
            onCancelEdit={cancelEdit}
            onDelete={handleDelete}
            onRestore={handleRestore}
            onStartEdit={beginEdit}
            onSubmitEdit={handleEdit}
            onToggleExpanded={(recordId) =>
              setExpandedArchivedRecordId((current) => (current === recordId ? null : recordId))
            }
            records={pagedArchivedStoreCollaborations}
            showActions
            showArchiveActions
            title="Archived collaborations"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-400">
              {archivedStoreCollaborations.length === 0
                ? 'No archived collaborations available.'
                : `Showing ${Math.min((archiveDisplayPage - 1) * ROWS_PER_PAGE + 1, archivedStoreCollaborations.length)} to ${Math.min(archiveDisplayPage * ROWS_PER_PAGE, archivedStoreCollaborations.length)} of ${archivedStoreCollaborations.length}.`}
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
          Saving collaboration changes.
        </div>
      ) : null}
    </section>
  )
}
