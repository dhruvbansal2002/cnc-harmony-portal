import { Fragment, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../../auth/useAuth'
import { ActionMenu } from '../../components/ui/ActionMenu'
import {
  archiveRank,
  createEmptyRankFormValues,
  createRank,
  fetchRanks,
  getEnabledFieldLabels,
  operationalAbilityFields,
  portalCapabilityFields,
  rankToFormValues,
  sortRanks,
  softDeleteRank,
  restoreRank,
  updateRank,
  type RankFormValues,
} from '../../lib/ranks'
import type { RankRecord } from '../../auth/types'
import { RankForm } from '../../components/ranks/RankForm'

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

function FieldPill({
  enabled,
  children,
}: {
  enabled: boolean
  children: string
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

function CapabilityList({
  rank,
  fields,
}: {
  rank: RankRecord
  fields: readonly (
    | (typeof operationalAbilityFields)[number]
    | (typeof portalCapabilityFields)[number]
  )[]
}) {
  const enabledLabels = getEnabledFieldLabels(rank, fields)

  if (enabledLabels.length === 0) {
    return <span className="text-sm text-slate-500">None</span>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {enabledLabels.slice(0, 3).map((label) => (
        <FieldPill key={label} enabled>
          {label}
        </FieldPill>
      ))}
      {enabledLabels.length > 3 ? (
        <FieldPill enabled>{`+${enabledLabels.length - 3}`}</FieldPill>
      ) : null}
    </div>
  )
}

function RankDetailPanel({ rank }: { rank: RankRecord }) {
  const operationalEnabled = operationalAbilityFields.filter((field) => rank[field.key])
  const portalEnabled = portalCapabilityFields.filter((field) => rank[field.key])

  return (
    <div className="grid gap-4 rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-4 sm:p-5 lg:grid-cols-2">
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Description
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {rank.description?.trim() ? rank.description : 'No description provided.'}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Responsibilities
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {rank.responsibilities?.trim()
              ? rank.responsibilities
              : 'No responsibilities provided.'}
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Operational permissions
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {operationalAbilityFields.map((field) => (
              <StatusBadge
                key={field.key}
                tone={rank[field.key] ? 'accent' : 'neutral'}
              >
                {field.label}
              </StatusBadge>
            ))}
          </div>
          <p className="mt-3 text-sm text-slate-400">
            Enabled: {operationalEnabled.length} of {operationalAbilityFields.length}
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Portal permissions / management capabilities
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {portalCapabilityFields.map((field) => (
              <StatusBadge
                key={field.key}
                tone={rank[field.key] ? 'accent' : 'neutral'}
              >
                {field.label}
              </StatusBadge>
            ))}
          </div>
          <p className="mt-3 text-sm text-slate-400">
            Enabled: {portalEnabled.length} of {portalCapabilityFields.length}
          </p>
        </div>
      </div>
    </div>
  )
}

function RankTable({
  title,
  ranks,
  accessLevel,
  expandedRankId,
  onToggleExpanded,
  onStartEdit,
  onArchive,
  onRestore,
  onDelete,
  showArchiveActions = false,
  editingRankId,
  editingRank,
  editingError,
  editingSubmitting,
  onSubmitEdit,
  onCancelEdit,
}: {
  title: string
  ranks: RankRecord[]
  accessLevel: 'management' | 'employee' | 'customer'
  expandedRankId: string | null
  onToggleExpanded: (rankId: string) => void
  onStartEdit: (rank: RankRecord) => void
  onArchive: (rank: RankRecord) => void
  onRestore: (rank: RankRecord) => void
  onDelete: (rank: RankRecord) => void
  showArchiveActions?: boolean
  editingRankId: string | null
  editingRank: RankRecord | null
  editingError: string | null
  editingSubmitting: boolean
  onSubmitEdit: (values: RankFormValues) => Promise<void>
  onCancelEdit: () => void
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
            {ranks.length} {ranks.length === 1 ? 'rank' : 'ranks'}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone="neutral">Sorted by display order</StatusBadge>
          <StatusBadge tone={showArchiveActions ? 'warning' : 'success'}>
            {showArchiveActions ? 'Archived' : 'Current'}
          </StatusBadge>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-[980px] w-full border-separate border-spacing-0">
          <thead>
            <tr className="text-left text-[0.7rem] uppercase tracking-[0.28em] text-slate-500">
              <th className="border-b border-white/10 px-4 py-3">Rank Name</th>
              <th className="border-b border-white/10 px-4 py-3">Hiring Status</th>
              <th className="border-b border-white/10 px-4 py-3">Management Rank</th>
              <th className="border-b border-white/10 px-4 py-3">
                Operational Abilities
              </th>
              <th className="border-b border-white/10 px-4 py-3">Actions</th>
            </tr>
          </thead>

          <tbody>
            {ranks.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-10 text-sm text-slate-400"
                  colSpan={5}
                >
                  No ranks found.
                </td>
              </tr>
            ) : (
              ranks.map((rank) => {
                const isExpanded = expandedRankId === rank.id
                const isEditing = editingRankId === rank.id
                const operationalEnabled = getEnabledFieldLabels(
                  rank,
                  operationalAbilityFields,
                )

                return (
                  <Fragment key={rank.id}>
                    <tr className="align-top">
                      <td className="border-b border-white/5 px-4 py-4">
                        <button
                          className="text-left text-sm font-semibold text-white transition hover:text-cyan-200"
                          onClick={() => onToggleExpanded(rank.id)}
                          type="button"
                        >
                          <div className="flex items-center gap-3">
                            <span>{rank.rank_name}</span>
                            <StatusBadge
                              tone={rank.archived_at ? 'warning' : rank.is_active ? 'success' : 'neutral'}
                            >
                              {rank.archived_at
                                ? 'Archived'
                                : rank.is_active
                                  ? 'Active'
                                  : 'Inactive'}
                            </StatusBadge>
                          </div>
                        </button>
                        <p className="mt-2 text-xs text-slate-500">
                          Display order {rank.display_order}
                        </p>
                      </td>
                      <td className="border-b border-white/5 px-4 py-4">
                        <StatusBadge tone={rank.hiring_status === 'open' ? 'success' : 'neutral'}>
                          {rank.hiring_status === 'open' ? 'Open' : 'Closed'}
                        </StatusBadge>
                      </td>
                      <td className="border-b border-white/5 px-4 py-4">
                        <StatusBadge tone={rank.is_management_rank ? 'accent' : 'neutral'}>
                          {rank.is_management_rank ? 'Yes' : 'No'}
                        </StatusBadge>
                      </td>
                      <td className="border-b border-white/5 px-4 py-4">
                        <CapabilityList rank={rank} fields={operationalAbilityFields} />
                        <p className="mt-2 text-xs text-slate-500">
                          {operationalEnabled.length} enabled
                        </p>
                      </td>
                      <td className="border-b border-white/5 px-4 py-4">
                        {canManage ? (
                          <ActionMenu triggerLabel="Actions">
                            {!showArchiveActions ? (
                              <>
                                <button
                                  className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/5"
                                  onClick={() => onStartEdit(rank)}
                                  type="button"
                                >
                                  Edit
                                </button>
                                <button
                                  className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/5"
                                  onClick={() => onArchive(rank)}
                                  type="button"
                                >
                                  Archive
                                </button>
                                <button
                                  className="block w-full rounded-xl px-3 py-2 text-left text-sm text-rose-100 transition hover:bg-rose-500/10"
                                  onClick={() => onDelete(rank)}
                                  type="button"
                                >
                                  Delete
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/5"
                                  onClick={() => onRestore(rank)}
                                  type="button"
                                >
                                  Restore
                                </button>
                                <button
                                  className="block w-full rounded-xl px-3 py-2 text-left text-sm text-rose-100 transition hover:bg-rose-500/10"
                                  onClick={() => onDelete(rank)}
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
                        <td className="border-b border-white/5 px-4 pb-5 pt-0" colSpan={5}>
                          <RankDetailPanel rank={rank} />
                        </td>
                      </tr>
                    ) : null}

                    {isEditing && editingRank ? (
                      <tr>
                        <td className="border-b border-white/5 px-4 pb-5 pt-0" colSpan={5}>
                          <RankForm
                            key={editingRank.id}
                            description="Update the rank and save the changes back to Supabase."
                            error={editingError}
                            initialValues={rankToFormValues(editingRank)}
                            isSubmitting={editingSubmitting}
                            onCancel={onCancelEdit}
                            onSubmit={onSubmitEdit}
                            submitLabel="Save changes"
                            title={`Edit ${editingRank.rank_name}`}
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
    </section>
  )
}

export function RankManagementPage() {
  const { accessLevel } = useAuth()
  const isManagement = accessLevel === 'management'

  const [ranks, setRanks] = useState<RankRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [bannerMessage, setBannerMessage] = useState<string | null>(null)
  const [bannerTone, setBannerTone] = useState<'success' | 'error' | null>(null)
  const [createVisible, setCreateVisible] = useState(false)
  const [createRevision, setCreateRevision] = useState(0)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [editingRankId, setEditingRankId] = useState<string | null>(null)
  const [editingError, setEditingError] = useState<string | null>(null)
  const [editingSubmitting, setEditingSubmitting] = useState(false)
  const [expandedRankId, setExpandedRankId] = useState<string | null>(null)
  const [actionTargetId, setActionTargetId] = useState<string | null>(null)

  const editingRank = useMemo(
    () => ranks.find((rank) => rank.id === editingRankId) ?? null,
    [editingRankId, ranks],
  )

  const activeRanks = useMemo(
    () =>
      sortRanks(
        ranks.filter((rank) => rank.archived_at === null && rank.deleted_at === null),
      ),
    [ranks],
  )

  const archivedRanks = useMemo(
    () =>
      sortRanks(
        ranks.filter((rank) => rank.archived_at !== null && rank.deleted_at === null),
      ),
    [ranks],
  )

  useEffect(() => {
    let isMounted = true

    async function loadRanks() {
      setLoading(true)
      setPageError(null)

      try {
        const data = await fetchRanks()

        if (!isMounted) {
          return
        }

        setRanks(data)
      } catch (error) {
        if (!isMounted) {
          return
        }

        const message = error instanceof Error ? error.message : 'Unable to load ranks.'
        setPageError(message)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void loadRanks()

    return () => {
      isMounted = false
    }
  }, [])

  function showBanner(message: string, tone: 'success' | 'error') {
    setBannerMessage(message)
    setBannerTone(tone)
  }

  function syncRank(updatedRank: RankRecord) {
    setRanks((current) => {
      const nextRanks = current.some((rank) => rank.id === updatedRank.id)
        ? current.map((rank) => (rank.id === updatedRank.id ? updatedRank : rank))
        : [updatedRank, ...current]

      return sortRanks(nextRanks.filter((rank) => rank.deleted_at === null))
    })
  }

  function removeRank(rankId: string) {
    setRanks((current) => current.filter((rank) => rank.id !== rankId))
  }

  function beginCreate() {
    setCreateVisible(true)
    setEditingRankId(null)
    setEditingError(null)
    setExpandedRankId(null)
    setCreateError(null)
    setBannerMessage(null)
    setCreateRevision((current) => current + 1)
  }

  function beginEdit(rank: RankRecord) {
    setEditingRankId(rank.id)
    setCreateVisible(false)
    setCreateError(null)
    setEditingError(null)
    setExpandedRankId(null)
    setBannerMessage(null)
  }

  function cancelEdit() {
    setEditingRankId(null)
    setEditingError(null)
  }

  async function handleCreate(values: RankFormValues) {
    setCreateSubmitting(true)
    setCreateError(null)
    setBannerMessage(null)

    try {
      const created = await createRank(values)
      syncRank(created)
      setCreateVisible(false)
      setExpandedRankId(created.id)
      showBanner(`Created rank ${created.rank_name}.`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create rank.'
      setCreateError(message)
      showBanner(message, 'error')
    } finally {
      setCreateSubmitting(false)
    }
  }

  async function handleEdit(values: RankFormValues) {
    if (!editingRankId) {
      return
    }

    setEditingSubmitting(true)
    setEditingError(null)
    setBannerMessage(null)

    try {
      const updated = await updateRank(editingRankId, values)
      syncRank(updated)
      setEditingRankId(null)
      showBanner(`Updated rank ${updated.rank_name}.`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update rank.'
      setEditingError(message)
      showBanner(message, 'error')
    } finally {
      setEditingSubmitting(false)
    }
  }

  async function handleArchive(rank: RankRecord) {
    setActionTargetId(rank.id)
    setBannerMessage(null)

    try {
      const updated = await archiveRank(rank.id)
      syncRank(updated)
      showBanner(`Archived rank ${updated.rank_name}.`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to archive rank.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  async function handleRestore(rank: RankRecord) {
    setActionTargetId(rank.id)
    setBannerMessage(null)

    try {
      const updated = await restoreRank(rank.id)
      syncRank(updated)
      showBanner(`Restored rank ${updated.rank_name}.`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to restore rank.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  async function handleDelete(rank: RankRecord) {
    const confirmed = window.confirm(
      `Soft delete ${rank.rank_name}? This will hide the rank from all lists.`,
    )

    if (!confirmed) {
      return
    }

    setActionTargetId(rank.id)
    setBannerMessage(null)

    try {
      await softDeleteRank(rank.id)
      removeRank(rank.id)
      if (editingRankId === rank.id) {
        cancelEdit()
      }
      if (expandedRankId === rank.id) {
        setExpandedRankId(null)
      }
      showBanner(`Deleted rank ${rank.rank_name}.`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete rank.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  const currentUserLabel =
    accessLevel === 'management'
      ? 'Management access'
      : accessLevel === 'employee'
        ? 'Employee access'
        : 'Customer access'

  if (loading) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Rank Management
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Loading ranks</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Fetching rank records from Supabase.
        </p>
      </section>
    )
  }

  if (pageError) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Rank Management
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Unable to load ranks</h1>
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
              Rank Management
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Rank Control Center
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Manage `public.ranks` directly from Supabase. Current view is limited to{' '}
              {currentUserLabel}.
            </p>
          </div>

          <div className="grid gap-3 sm:text-right">
            <StatusBadge tone="neutral">{activeRanks.length} current ranks</StatusBadge>
            {isManagement ? (
              <StatusBadge tone="warning">{archivedRanks.length} archived ranks</StatusBadge>
            ) : (
              <StatusBadge tone="accent">Read only</StatusBadge>
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
          {createVisible ? (
            <RankForm
              key={`create-${createRevision}`}
              description="Create a new rank in Supabase. The form opens at the top of the page and saves immediately."
              error={createError}
              initialValues={createEmptyRankFormValues()}
              isSubmitting={createSubmitting}
              onCancel={() => {
                setCreateVisible(false)
                setCreateError(null)
              }}
              onSubmit={handleCreate}
              submitLabel="Create rank"
              title="Create Rank"
              variant="panel"
            />
          ) : (
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
                    Create Rank
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
                    Add a new rank
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                    Open the create form at the top of the page. No mock data or local-only
                    state is used.
                  </p>
                </div>
                <button
                  className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                  onClick={beginCreate}
                  type="button"
                >
                  Create Rank
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-sm leading-6 text-slate-300 shadow-2xl shadow-cyan-950/20 backdrop-blur">
          Employees have read-only access to rank data. Customers are blocked by the route
          guard.
        </div>
      )}

      <RankTable
        accessLevel={accessLevel ?? 'employee'}
        editingError={editingError}
        editingRank={editingRank}
        editingRankId={editingRankId}
        editingSubmitting={editingSubmitting}
        expandedRankId={expandedRankId}
        onArchive={handleArchive}
        onCancelEdit={cancelEdit}
        onDelete={handleDelete}
        onRestore={handleRestore}
        onStartEdit={beginEdit}
        onSubmitEdit={handleEdit}
        onToggleExpanded={(rankId) =>
          setExpandedRankId((current) => (current === rankId ? null : rankId))
        }
        ranks={activeRanks}
        showArchiveActions={false}
        title="Current ranks"
      />

      {isManagement ? (
        <RankTable
          accessLevel="management"
          editingError={null}
          editingRank={null}
          editingRankId={null}
          editingSubmitting={false}
          expandedRankId={expandedRankId}
          onArchive={handleArchive}
          onCancelEdit={cancelEdit}
          onDelete={handleDelete}
          onRestore={handleRestore}
          onStartEdit={beginEdit}
          onSubmitEdit={handleEdit}
          onToggleExpanded={(rankId) =>
            setExpandedRankId((current) => (current === rankId ? null : rankId))
          }
          ranks={archivedRanks}
          showArchiveActions
          title="Archived ranks"
        />
      ) : null}

      {actionTargetId ? (
        <div className="sr-only" aria-live="polite">
          Saving rank changes.
        </div>
      ) : null}
    </section>
  )
}
