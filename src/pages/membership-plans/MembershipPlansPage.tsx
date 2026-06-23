import { Fragment, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import type { MembershipPlanRecord } from '../../auth/types'
import { ActionMenu } from '../../components/ui/ActionMenu'
import { MembershipPlanForm } from '../../components/memberships/MembershipPlanForm'
import {
  archiveMembershipPlan,
  createMembershipPlan,
  fetchMembershipPlans,
  fetchPublicMembershipPlans,
  membershipPlanToFormValues,
  restoreMembershipPlan,
  softDeleteMembershipPlan,
  sortArchivedMembershipPlansOnly,
  sortCurrentMembershipPlans,
  sortMembershipPlans,
  updateMembershipPlan,
  type MembershipPlanFormValues,
} from '../../lib/membershipPlans'

const ROWS_PER_PAGE = 20

const statusFilterOptions = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
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

function formatPrice(value: string | number | null) {
  if (value === null || value === undefined) {
    return '-'
  }

  const parsed = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(parsed)) {
    return '-'
  }

  return `$${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parsed)}`
}

function formatDate(dateValue: string | null) {
  if (!dateValue) {
    return '-'
  }

  const parsed = new Date(dateValue)

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

function MembershipStatusBadge({
  status,
}: {
  status: MembershipPlanRecord['status']
}) {
  const toneMap: Record<MembershipPlanRecord['status'], { tone: 'success' | 'warning' | 'neutral' | 'danger'; label: string }> = {
    active: { tone: 'success', label: 'Active' },
    inactive: { tone: 'warning', label: 'Inactive' },
    archived: { tone: 'danger', label: 'Archived' },
  }

  const badge = toneMap[status]

  return <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
}

function MembershipPlanDetailPanel({
  membershipPlan,
  showNotes,
}: {
  membershipPlan: MembershipPlanRecord
  showNotes: boolean
}) {
  return (
    <div className="grid gap-4 rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-4 sm:p-5 lg:grid-cols-2">
      <div className="grid gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Description
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {membershipPlan.description?.trim()
              ? membershipPlan.description
              : 'No description provided.'}
          </p>
        </div>
        {showNotes ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Notes
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-200">
              {membershipPlan.notes?.trim() ? membershipPlan.notes : 'No notes provided.'}
            </p>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Created At
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {formatDate(membershipPlan.created_at)}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Updated At
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {formatDate(membershipPlan.updated_at)}
          </p>
        </div>
      </div>
    </div>
  )
}

function MembershipPlanTable({
  title,
  membershipPlans,
  accessLevel,
  expandedMembershipPlanId,
  onToggleExpanded,
  onStartEdit,
  onArchive,
  onRestore,
  onDelete,
  showArchiveActions = false,
  editingMembershipPlanId,
  editingMembershipPlan,
  editingError,
  editingSubmitting,
  onSubmitEdit,
  onCancelEdit,
  actionTargetId,
}: {
  title: string
  membershipPlans: MembershipPlanRecord[]
  accessLevel: 'management' | 'employee' | 'customer' | null
  expandedMembershipPlanId: string | null
  onToggleExpanded: (membershipPlanId: string) => void
  onStartEdit: (membershipPlan: MembershipPlanRecord) => void
  onArchive: (membershipPlan: MembershipPlanRecord) => void
  onRestore: (membershipPlan: MembershipPlanRecord) => void
  onDelete: (membershipPlan: MembershipPlanRecord) => void
  showArchiveActions?: boolean
  editingMembershipPlanId: string | null
  editingMembershipPlan: MembershipPlanRecord | null
  editingError: string | null
  editingSubmitting: boolean
  onSubmitEdit: (values: MembershipPlanFormValues) => Promise<void>
  onCancelEdit: () => void
  actionTargetId: string | null
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
            {membershipPlans.length} {membershipPlans.length === 1 ? 'plan' : 'plans'}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <FieldPill enabled={false}>{showArchiveActions ? 'Archived' : 'Current'}</FieldPill>
          <FieldPill enabled>20 rows per page</FieldPill>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-[1040px] w-full border-separate border-spacing-0">
          <thead>
            <tr className="text-left text-[0.7rem] uppercase tracking-[0.28em] text-slate-500">
              <th className="border-b border-white/10 px-4 py-3">Plan Name</th>
              <th className="border-b border-white/10 px-4 py-3">Plan Price</th>
              <th className="border-b border-white/10 px-4 py-3">Status</th>
              <th className="border-b border-white/10 px-4 py-3">Actions</th>
            </tr>
          </thead>

          <tbody>
            {membershipPlans.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-sm text-slate-400" colSpan={4}>
                  No membership plans found.
                </td>
              </tr>
            ) : (
              membershipPlans.map((membershipPlan) => {
                const isExpanded = expandedMembershipPlanId === membershipPlan.id
                const isEditing = editingMembershipPlanId === membershipPlan.id

                return (
                  <Fragment key={membershipPlan.id}>
                    <tr className="align-top">
                      <td className="border-b border-white/5 px-4 py-4">
                        <button
                          className="text-left text-sm font-semibold text-white transition hover:text-cyan-200"
                          onClick={() => onToggleExpanded(membershipPlan.id)}
                          type="button"
                        >
                          {membershipPlan.plan_name}
                        </button>
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {formatPrice(membershipPlan.plan_price)}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4">
                        <MembershipStatusBadge status={membershipPlan.status} />
                      </td>
                      <td className="border-b border-white/5 px-4 py-4">
                        {canManage ? (
                          <ActionMenu triggerLabel="Actions">
                            {!showArchiveActions ? (
                              <>
                                <button
                                  className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/5"
                                  onClick={() => onStartEdit(membershipPlan)}
                                  type="button"
                                >
                                  Edit
                                </button>
                                <button
                                  className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/5"
                                  onClick={() => onArchive(membershipPlan)}
                                  type="button"
                                >
                                  Archive
                                </button>
                                <button
                                  className="block w-full rounded-xl px-3 py-2 text-left text-sm text-rose-100 transition hover:bg-rose-500/10"
                                  onClick={() => onDelete(membershipPlan)}
                                  type="button"
                                >
                                  Delete
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  className="block w-full rounded-xl px-3 py-2 text-left text-sm text-emerald-100 transition hover:bg-emerald-500/10"
                                  onClick={() => onRestore(membershipPlan)}
                                  type="button"
                                >
                                  Restore
                                </button>
                                <button
                                  className="block w-full rounded-xl px-3 py-2 text-left text-sm text-rose-100 transition hover:bg-rose-500/10"
                                  onClick={() => onDelete(membershipPlan)}
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
                        <td className="border-b border-white/5 px-4 pb-5 pt-0" colSpan={4}>
                        <MembershipPlanDetailPanel
                          membershipPlan={membershipPlan}
                          showNotes={accessLevel === 'management' || accessLevel === 'employee'}
                        />
                        </td>
                      </tr>
                    ) : null}

                    {isEditing && editingMembershipPlan ? (
                      <tr>
                        <td className="border-b border-white/5 px-4 pb-5 pt-0" colSpan={4}>
                          <MembershipPlanForm
                            key={editingMembershipPlan.id}
                            description="Update the membership plan in Supabase. Changes save immediately."
                            error={editingError}
                            initialValues={membershipPlanToFormValues(editingMembershipPlan)}
                            isSubmitting={editingSubmitting}
                            onCancel={onCancelEdit}
                            onSubmit={onSubmitEdit}
                            submitLabel="Save changes"
                            title={`Edit ${editingMembershipPlan.plan_name}`}
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
          Saving membership plan changes.
        </div>
      ) : null}
    </section>
  )
}

export function MembershipPlansPage({
  pageVariant = 'internal',
}: {
  pageVariant?: 'public' | 'internal'
}) {
  const { status, accessLevel, authUser, employee, customer } = useAuth()
  const isPublicVariant = pageVariant === 'public'
  const isStaffViewer =
    pageVariant === 'internal' && (accessLevel === 'management' || accessLevel === 'employee')

  const [membershipPlans, setMembershipPlans] = useState<MembershipPlanRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [bannerMessage, setBannerMessage] = useState<string | null>(null)
  const [bannerTone, setBannerTone] = useState<'success' | 'error' | null>(null)
  const [createVisible, setCreateVisible] = useState(false)
  const [createRevision, setCreateRevision] = useState(0)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [editingMembershipPlanId, setEditingMembershipPlanId] = useState<string | null>(null)
  const [editingError, setEditingError] = useState<string | null>(null)
  const [editingSubmitting, setEditingSubmitting] = useState(false)
  const [expandedMembershipPlanId, setExpandedMembershipPlanId] = useState<string | null>(null)
  const [actionTargetId, setActionTargetId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilterOptions)[number]['value']>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [archivePage, setArchivePage] = useState(1)

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      setLoading(true)
      setPageError(null)

      try {
        const data = isStaffViewer
          ? await fetchMembershipPlans()
          : await fetchPublicMembershipPlans()

        if (!isMounted) {
          return
        }

        setMembershipPlans(data)
      } catch (error) {
        if (!isMounted) {
          return
        }

        const message =
          error instanceof Error ? error.message : 'Unable to load membership plans.'
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
  }, [isStaffViewer])

  if (status === 'loading') {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Membership Plans
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Loading membership plans</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">Checking portal access.</p>
      </section>
    )
  }

  if (status === 'ready' && (accessLevel === 'management' || accessLevel === 'employee')) {
    if (isPublicVariant) {
      return <Navigate replace to="/dashboard" />
    }
  }

  if (status === 'ready' && accessLevel === 'customer') {
    return <Navigate replace to="/access" />
  }

  if (status === 'setup' || status === 'inactive') {
    return <Navigate replace to="/access" />
  }

  const activeAccessLevel = isPublicVariant ? 'customer' : accessLevel
  const canManage = activeAccessLevel === 'management'
  const currentUser = currentUserLabel({
    accessLevel: activeAccessLevel,
    authEmail: authUser?.email,
    characterName: employee?.character_name ?? customer?.character_name ?? null,
  })
  const searchTerm = searchQuery.trim().toLowerCase()

  const currentMembershipPlans = sortCurrentMembershipPlans(membershipPlans).filter((plan) => {
    if (activeAccessLevel === 'customer' && plan.status !== 'active') {
      return false
    }

    return (
      plan.plan_name.toLowerCase().includes(searchTerm) &&
      (activeAccessLevel === 'customer'
        ? true
        : statusFilter === 'all'
          ? true
          : plan.status === statusFilter)
    )
  })

  const archivedMembershipPlans = sortArchivedMembershipPlansOnly(membershipPlans).filter(
    (plan) => plan.plan_name.toLowerCase().includes(searchTerm),
  )

  const currentTotalPages = Math.max(1, Math.ceil(currentMembershipPlans.length / ROWS_PER_PAGE))
  const currentDisplayPage = Math.min(currentPage, currentTotalPages)
  const pagedCurrentMembershipPlans = currentMembershipPlans.slice(
    (currentDisplayPage - 1) * ROWS_PER_PAGE,
    currentDisplayPage * ROWS_PER_PAGE,
  )

  const archiveTotalPages = Math.max(1, Math.ceil(archivedMembershipPlans.length / ROWS_PER_PAGE))
  const archiveDisplayPage = Math.min(archivePage, archiveTotalPages)
  const pagedArchivedMembershipPlans = archivedMembershipPlans.slice(
    (archiveDisplayPage - 1) * ROWS_PER_PAGE,
    archiveDisplayPage * ROWS_PER_PAGE,
  )

  const editingMembershipPlan =
    editingMembershipPlanId === null
      ? null
      : membershipPlans.find((plan) => plan.id === editingMembershipPlanId) ?? null

  function showBanner(message: string, tone: 'success' | 'error') {
    setBannerMessage(message)
    setBannerTone(tone)
  }

  function syncMembershipPlan(updatedMembershipPlan: MembershipPlanRecord) {
    setMembershipPlans((current) => {
      const nextPlans = current.some((plan) => plan.id === updatedMembershipPlan.id)
        ? current.map((plan) => (plan.id === updatedMembershipPlan.id ? updatedMembershipPlan : plan))
        : [updatedMembershipPlan, ...current]

      return sortMembershipPlans(nextPlans.filter((plan) => plan.deleted_at === null))
    })
  }

  function removeMembershipPlan(membershipPlanId: string) {
    setMembershipPlans((current) => current.filter((plan) => plan.id !== membershipPlanId))
  }

  function beginCreate() {
    setCreateVisible(true)
    setEditingMembershipPlanId(null)
    setEditingError(null)
    setBannerMessage(null)
    setCreateError(null)
    setCreateRevision((current) => current + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function beginEdit(membershipPlan: MembershipPlanRecord) {
    setEditingMembershipPlanId(membershipPlan.id)
    setCreateVisible(false)
    setCreateError(null)
    setEditingError(null)
    setBannerMessage(null)
    setExpandedMembershipPlanId(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingMembershipPlanId(null)
    setEditingError(null)
  }

  function cancelCreate() {
    setCreateVisible(false)
    setCreateError(null)
  }

  async function handleCreate(values: MembershipPlanFormValues) {
    setCreateSubmitting(true)
    setCreateError(null)
    setBannerMessage(null)

    try {
      const created = await createMembershipPlan(values)
      syncMembershipPlan(created)
      cancelCreate()
      setExpandedMembershipPlanId(created.id)
      showBanner(`Created membership plan ${created.plan_name}.`, 'success')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to create membership plan.'
      setCreateError(message)
      showBanner(message, 'error')
    } finally {
      setCreateSubmitting(false)
    }
  }

  async function handleEdit(values: MembershipPlanFormValues) {
    if (!editingMembershipPlanId) {
      return
    }

    setEditingSubmitting(true)
    setEditingError(null)
    setBannerMessage(null)

    try {
      const updated = await updateMembershipPlan(editingMembershipPlanId, values)
      syncMembershipPlan(updated)
      setEditingMembershipPlanId(null)
      setExpandedMembershipPlanId(updated.id)
      showBanner(`Updated membership plan ${updated.plan_name}.`, 'success')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to update membership plan.'
      setEditingError(message)
      showBanner(message, 'error')
    } finally {
      setEditingSubmitting(false)
    }
  }

  async function handleArchive(membershipPlan: MembershipPlanRecord) {
    setActionTargetId(membershipPlan.id)
    setBannerMessage(null)

    try {
      const updated = await archiveMembershipPlan(membershipPlan.id)
      syncMembershipPlan(updated)
      if (editingMembershipPlanId === membershipPlan.id) {
        cancelEdit()
      }
      showBanner(`Archived membership plan ${updated.plan_name}.`, 'success')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to archive membership plan.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  async function handleRestore(membershipPlan: MembershipPlanRecord) {
    const confirmed = window.confirm(
      `Restore ${membershipPlan.plan_name} back into the active membership plan list?`,
    )

    if (!confirmed) {
      return
    }

    setActionTargetId(membershipPlan.id)
    setBannerMessage(null)

    try {
      const updated = await restoreMembershipPlan(membershipPlan.id)
      syncMembershipPlan(updated)
      showBanner(`Restored membership plan ${updated.plan_name}.`, 'success')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to restore membership plan.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  async function handleDelete(membershipPlan: MembershipPlanRecord) {
    const confirmed = window.confirm(
      `Soft delete ${membershipPlan.plan_name}? This will remove the membership plan from all lists.`,
    )

    if (!confirmed) {
      return
    }

    setActionTargetId(membershipPlan.id)
    setBannerMessage(null)

    try {
      await softDeleteMembershipPlan(membershipPlan.id)
      removeMembershipPlan(membershipPlan.id)
      if (editingMembershipPlanId === membershipPlan.id) {
        cancelEdit()
      }
      if (expandedMembershipPlanId === membershipPlan.id) {
        setExpandedMembershipPlanId(null)
      }
      showBanner(`Deleted membership plan ${membershipPlan.plan_name}.`, 'success')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to delete membership plan.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  if (loading) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Membership Plans
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Loading membership plans</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Fetching membership plans from Supabase.
        </p>
      </section>
    )
  }

  if (pageError) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Membership Plans
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Unable to load membership plans</h1>
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
              Membership Plans
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Membership Control Center
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Membership plans are sourced from Supabase.{' '}
              {isStaffViewer
                ? `Current view is limited to ${accessLabel(activeAccessLevel)} access.`
                : 'Public catalog view.'}
            </p>
          </div>

          <div className="grid gap-3 sm:text-right">
            <FieldPill enabled={false}>{currentMembershipPlans.length} current</FieldPill>
            {isStaffViewer ? (
              canManage ? (
                <FieldPill enabled={false}>{archivedMembershipPlans.length} archived</FieldPill>
              ) : (
                <FieldPill enabled>Read only</FieldPill>
              )
            ) : (
              <FieldPill enabled>Public catalog</FieldPill>
            )}
            {isStaffViewer ? <FieldPill enabled>{currentUser}</FieldPill> : null}
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
          <MembershipPlanForm
            key={createRevision}
            description="Create a membership plan in Supabase. This does not use mock data or bottom-page forms."
            error={createError}
            isSubmitting={createSubmitting}
            onCancel={cancelCreate}
            onSubmit={handleCreate}
            submitLabel="Create Membership Plan"
            title="Create membership plan"
          />
        ) : (
          <div className="flex justify-end">
            <button
              className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              onClick={beginCreate}
              type="button"
            >
              Create Membership Plan
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

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Search by Plan Name
            </span>
            <input
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
              onChange={(event) => {
                setSearchQuery(event.target.value)
                setCurrentPage(1)
                setArchivePage(1)
              }}
              placeholder="Search membership plans"
              value={searchQuery}
            />
          </label>

          {isStaffViewer ? (
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
          ) : null}
        </div>
      </section>

      <MembershipPlanTable
        accessLevel={activeAccessLevel}
        actionTargetId={actionTargetId}
        editingError={editingError}
        editingMembershipPlan={editingMembershipPlan}
        editingMembershipPlanId={editingMembershipPlanId}
        editingSubmitting={editingSubmitting}
        expandedMembershipPlanId={expandedMembershipPlanId}
        onArchive={handleArchive}
        onCancelEdit={cancelEdit}
        onDelete={handleDelete}
        onRestore={handleRestore}
        onStartEdit={beginEdit}
        onSubmitEdit={handleEdit}
        onToggleExpanded={(membershipPlanId) =>
          setExpandedMembershipPlanId((current) => (current === membershipPlanId ? null : membershipPlanId))
        }
        membershipPlans={pagedCurrentMembershipPlans}
        showArchiveActions={false}
        title={isStaffViewer ? 'Current membership plans' : 'Active membership plans'}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          {currentMembershipPlans.length === 0
            ? !isStaffViewer
              ? 'No active membership plans are available.'
              : 'No current membership plans match the active filters.'
            : `Showing ${Math.min((currentDisplayPage - 1) * ROWS_PER_PAGE + 1, currentMembershipPlans.length)} to ${Math.min(currentDisplayPage * ROWS_PER_PAGE, currentMembershipPlans.length)} of ${currentMembershipPlans.length}.`}
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

      {canManage && archivedMembershipPlans.length > 0 ? (
        <>
          <MembershipPlanTable
            accessLevel="management"
            actionTargetId={actionTargetId}
            editingError={null}
            editingMembershipPlan={null}
            editingMembershipPlanId={null}
            editingSubmitting={false}
            expandedMembershipPlanId={expandedMembershipPlanId}
            onArchive={handleArchive}
            onCancelEdit={cancelEdit}
            onDelete={handleDelete}
            onRestore={handleRestore}
            onStartEdit={beginEdit}
            onSubmitEdit={handleEdit}
            onToggleExpanded={(membershipPlanId) =>
              setExpandedMembershipPlanId((current) => (current === membershipPlanId ? null : membershipPlanId))
            }
            membershipPlans={pagedArchivedMembershipPlans}
            showArchiveActions
            title="Archived membership plans"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-400">
              {archivedMembershipPlans.length === 0
                ? 'No archived membership plans available.'
                : `Showing ${Math.min((archiveDisplayPage - 1) * ROWS_PER_PAGE + 1, archivedMembershipPlans.length)} to ${Math.min(archiveDisplayPage * ROWS_PER_PAGE, archivedMembershipPlans.length)} of ${archivedMembershipPlans.length}.`}
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

      {actionTargetId ? (
        <div className="sr-only" aria-live="polite">
          Saving membership plan changes.
        </div>
      ) : null}
    </section>
  )
}
