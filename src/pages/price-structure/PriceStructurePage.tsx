import { Fragment, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../../auth/useAuth'
import type { PriceItemRecord } from '../../auth/types'
import { ActionMenu } from '../../components/ui/ActionMenu'
import { PriceItemForm } from '../../components/prices/PriceItemForm'
import {
  archivePriceItem,
  createPriceItem,
  fetchPriceItems,
  priceItemToFormValues,
  restorePriceItem,
  softDeletePriceItem,
  sortArchivedPriceItemsOnly,
  sortCurrentPriceItems,
  sortPriceItems,
  updatePriceItem,
  type PriceItemFormValues,
} from '../../lib/priceItems'

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
  employeeName,
}: {
  accessLevel: string | null
  authEmail: string | undefined
  employeeName: string | null
}) {
  return employeeName ?? authEmail ?? accessLabel(accessLevel)
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

function PriceStatusBadge({ status }: { status: PriceItemRecord['status'] }) {
  const badgeMap: Record<PriceItemRecord['status'], { tone: 'success' | 'warning' | 'neutral' | 'danger'; label: string }> = {
    active: { tone: 'success', label: 'Active' },
    inactive: { tone: 'warning', label: 'Inactive' },
    archived: { tone: 'danger', label: 'Archived' },
  }

  const badge = badgeMap[status]

  return <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
}

function PriceItemDetailPanel({ priceItem }: { priceItem: PriceItemRecord }) {
  return (
    <div className="grid gap-4 rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-4 sm:p-5 lg:grid-cols-2">
      <div className="grid gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Category
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{priceItem.category}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Item Name
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{priceItem.item_name}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Item Cost
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{formatPrice(priceItem.item_cost)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Status
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            <PriceStatusBadge status={priceItem.status} />
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Common Selling Price
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {formatPrice(priceItem.common_selling_price)}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Government Selling Price
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {formatPrice(priceItem.government_selling_price)}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Archived At
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {priceItem.archived_at ? new Date(priceItem.archived_at).toLocaleString() : '-'}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Updated At
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {new Date(priceItem.updated_at).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  )
}

function PriceItemTable({
  title,
  priceItems,
  accessLevel,
  expandedPriceItemId,
  onToggleExpanded,
  onStartEdit,
  onArchive,
  onRestore,
  onDelete,
  showArchiveActions = false,
  editingPriceItemId,
  editingPriceItem,
  editingError,
  editingSubmitting,
  onSubmitEdit,
  onCancelEdit,
  actionTargetId,
}: {
  title: string
  priceItems: PriceItemRecord[]
  accessLevel: 'management' | 'employee' | 'customer'
  expandedPriceItemId: string | null
  onToggleExpanded: (priceItemId: string) => void
  onStartEdit: (priceItem: PriceItemRecord) => void
  onArchive: (priceItem: PriceItemRecord) => void
  onRestore: (priceItem: PriceItemRecord) => void
  onDelete: (priceItem: PriceItemRecord) => void
  showArchiveActions?: boolean
  editingPriceItemId: string | null
  editingPriceItem: PriceItemRecord | null
  editingError: string | null
  editingSubmitting: boolean
  onSubmitEdit: (values: PriceItemFormValues) => Promise<void>
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
            {priceItems.length} {priceItems.length === 1 ? 'item' : 'items'}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <FieldPill enabled={false}>{showArchiveActions ? 'Archived' : 'Current'}</FieldPill>
          <FieldPill enabled>{'20 rows per page'}</FieldPill>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-[1220px] w-full border-separate border-spacing-0">
          <thead>
            <tr className="text-left text-[0.7rem] uppercase tracking-[0.28em] text-slate-500">
              <th className="border-b border-white/10 px-4 py-3">Category</th>
              <th className="border-b border-white/10 px-4 py-3">Item Name</th>
              <th className="border-b border-white/10 px-4 py-3">Cost Price</th>
              <th className="border-b border-white/10 px-4 py-3">Common Selling Price</th>
              <th className="border-b border-white/10 px-4 py-3">Government Selling Price</th>
              <th className="border-b border-white/10 px-4 py-3">Status</th>
              <th className="border-b border-white/10 px-4 py-3">Actions</th>
            </tr>
          </thead>

          <tbody>
            {priceItems.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-sm text-slate-400" colSpan={7}>
                  No price items found.
                </td>
              </tr>
            ) : (
              priceItems.map((priceItem) => {
                const isExpanded = expandedPriceItemId === priceItem.id
                const isEditing = editingPriceItemId === priceItem.id

                return (
                  <Fragment key={priceItem.id}>
                    <tr className="align-top">
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {priceItem.category}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4">
                        <button
                          className="text-left text-sm font-semibold text-white transition hover:text-cyan-200"
                          onClick={() => onToggleExpanded(priceItem.id)}
                          type="button"
                        >
                          {priceItem.item_name}
                        </button>
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {formatPrice(priceItem.item_cost)}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {formatPrice(priceItem.common_selling_price)}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {formatPrice(priceItem.government_selling_price)}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4">
                        <PriceStatusBadge status={priceItem.status} />
                      </td>
                      <td className="border-b border-white/5 px-4 py-4">
                        {canManage ? (
                          <ActionMenu triggerLabel="Actions">
                              {!showArchiveActions ? (
                                <>
                                  <button
                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/5"
                                    onClick={() => onStartEdit(priceItem)}
                                    type="button"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/5"
                                    onClick={() => onArchive(priceItem)}
                                    type="button"
                                  >
                                    Archive
                                  </button>
                                  <button
                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-rose-100 transition hover:bg-rose-500/10"
                                    onClick={() => onDelete(priceItem)}
                                    type="button"
                                  >
                                    Delete
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-emerald-100 transition hover:bg-emerald-500/10"
                                    onClick={() => onRestore(priceItem)}
                                    type="button"
                                  >
                                    Restore
                                  </button>
                                  <button
                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-rose-100 transition hover:bg-rose-500/10"
                                    onClick={() => onDelete(priceItem)}
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
                          <PriceItemDetailPanel priceItem={priceItem} />
                        </td>
                      </tr>
                    ) : null}

                    {isEditing && editingPriceItem ? (
                      <tr>
                        <td className="border-b border-white/5 px-4 pb-5 pt-0" colSpan={7}>
                          <PriceItemForm
                            key={editingPriceItem.id}
                            description="Update the price item in Supabase. Changes save immediately."
                            error={editingError}
                            initialValues={priceItemToFormValues(editingPriceItem)}
                            isSubmitting={editingSubmitting}
                            onCancel={onCancelEdit}
                            onSubmit={onSubmitEdit}
                            submitLabel="Save changes"
                            title={`Edit ${editingPriceItem.item_name}`}
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
          Saving price changes.
        </div>
      ) : null}
    </section>
  )
}

export function PriceStructurePage() {
  const { accessLevel, authUser, employee } = useAuth()

  const [priceItems, setPriceItems] = useState<PriceItemRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [bannerMessage, setBannerMessage] = useState<string | null>(null)
  const [bannerTone, setBannerTone] = useState<'success' | 'error' | null>(null)
  const [createVisible, setCreateVisible] = useState(false)
  const [createRevision, setCreateRevision] = useState(0)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [editingPriceItemId, setEditingPriceItemId] = useState<string | null>(null)
  const [editingError, setEditingError] = useState<string | null>(null)
  const [editingSubmitting, setEditingSubmitting] = useState(false)
  const [expandedPriceItemId, setExpandedPriceItemId] = useState<string | null>(null)
  const [actionTargetId, setActionTargetId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilterOptions)[number]['value']>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [archivePage, setArchivePage] = useState(1)

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      setLoading(true)
      setPageError(null)

      try {
        const data = await fetchPriceItems()

        if (!isMounted) {
          return
        }

        setPriceItems(data)
      } catch (error) {
        if (!isMounted) {
          return
        }

        const message = error instanceof Error ? error.message : 'Unable to load price items.'
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
    employeeName: employee?.character_name ?? null,
  })

  const canManage = accessLevel === 'management'
  const searchTerm = searchQuery.trim().toLowerCase()

  const categories = Array.from(
    new Set(priceItems.map((priceItem) => priceItem.category.trim()).filter(Boolean)),
  ).sort((first, second) => first.localeCompare(second))

  const currentItems = sortCurrentPriceItems(priceItems).filter(
    (priceItem) =>
      priceItem.item_name.toLowerCase().includes(searchTerm) &&
      (categoryFilter === 'all' ? true : priceItem.category === categoryFilter) &&
      (statusFilter === 'all' ? true : priceItem.status === statusFilter),
  )

  const archivedItems = sortArchivedPriceItemsOnly(priceItems).filter(
    (priceItem) =>
      priceItem.item_name.toLowerCase().includes(searchTerm) &&
      (categoryFilter === 'all' ? true : priceItem.category === categoryFilter),
  )

  const currentTotalPages = Math.max(1, Math.ceil(currentItems.length / ROWS_PER_PAGE))
  const currentDisplayPage = Math.min(currentPage, currentTotalPages)
  const pagedCurrentItems = currentItems.slice(
    (currentDisplayPage - 1) * ROWS_PER_PAGE,
    currentDisplayPage * ROWS_PER_PAGE,
  )

  const archiveTotalPages = Math.max(1, Math.ceil(archivedItems.length / ROWS_PER_PAGE))
  const archiveDisplayPage = Math.min(archivePage, archiveTotalPages)
  const pagedArchivedItems = archivedItems.slice(
    (archiveDisplayPage - 1) * ROWS_PER_PAGE,
    archiveDisplayPage * ROWS_PER_PAGE,
  )

  const editingPriceItem =
    editingPriceItemId === null
      ? null
      : priceItems.find((priceItem) => priceItem.id === editingPriceItemId) ?? null

  function showBanner(message: string, tone: 'success' | 'error') {
    setBannerMessage(message)
    setBannerTone(tone)
  }

  function syncPriceItem(updatedPriceItem: PriceItemRecord) {
    setPriceItems((current) => {
      const nextItems = current.some((priceItem) => priceItem.id === updatedPriceItem.id)
        ? current.map((priceItem) =>
            priceItem.id === updatedPriceItem.id ? updatedPriceItem : priceItem,
          )
        : [updatedPriceItem, ...current]

      return sortPriceItems(nextItems.filter((priceItem) => priceItem.deleted_at === null))
    })
  }

  function removePriceItem(priceItemId: string) {
    setPriceItems((current) => current.filter((priceItem) => priceItem.id !== priceItemId))
  }

  function beginCreate() {
    setCreateVisible(true)
    setEditingPriceItemId(null)
    setEditingError(null)
    setBannerMessage(null)
    setCreateError(null)
    setCreateRevision((current) => current + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function beginEdit(priceItem: PriceItemRecord) {
    setEditingPriceItemId(priceItem.id)
    setCreateVisible(false)
    setCreateError(null)
    setEditingError(null)
    setBannerMessage(null)
    setExpandedPriceItemId(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingPriceItemId(null)
    setEditingError(null)
  }

  function cancelCreate() {
    setCreateVisible(false)
    setCreateError(null)
  }

  async function handleCreate(values: PriceItemFormValues) {
    setCreateSubmitting(true)
    setCreateError(null)
    setBannerMessage(null)

    try {
      const created = await createPriceItem(values)
      syncPriceItem(created)
      cancelCreate()
      setExpandedPriceItemId(created.id)
      showBanner(`Created price item ${created.item_name}.`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create price item.'
      setCreateError(message)
      showBanner(message, 'error')
    } finally {
      setCreateSubmitting(false)
    }
  }

  async function handleEdit(values: PriceItemFormValues) {
    if (!editingPriceItemId) {
      return
    }

    setEditingSubmitting(true)
    setEditingError(null)
    setBannerMessage(null)

    try {
      const updated = await updatePriceItem(editingPriceItemId, values)
      syncPriceItem(updated)
      setEditingPriceItemId(null)
      setExpandedPriceItemId(updated.id)
      showBanner(`Updated price item ${updated.item_name}.`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update price item.'
      setEditingError(message)
      showBanner(message, 'error')
    } finally {
      setEditingSubmitting(false)
    }
  }

  async function handleArchive(priceItem: PriceItemRecord) {
    setActionTargetId(priceItem.id)
    setBannerMessage(null)

    try {
      const updated = await archivePriceItem(priceItem.id)
      syncPriceItem(updated)
      if (editingPriceItemId === priceItem.id) {
        cancelEdit()
      }
      showBanner(`Archived price item ${updated.item_name}.`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to archive price item.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  async function handleRestore(priceItem: PriceItemRecord) {
    const confirmed = window.confirm(
      `Restore ${priceItem.item_name} back into the current price list?`,
    )

    if (!confirmed) {
      return
    }

    setActionTargetId(priceItem.id)
    setBannerMessage(null)

    try {
      const updated = await restorePriceItem(priceItem.id)
      syncPriceItem(updated)
      showBanner(`Restored price item ${updated.item_name}.`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to restore price item.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  async function handleDelete(priceItem: PriceItemRecord) {
    const confirmed = window.confirm(
      `Soft delete ${priceItem.item_name}? This will remove the price item from all lists.`,
    )

    if (!confirmed) {
      return
    }

    setActionTargetId(priceItem.id)
    setBannerMessage(null)

    try {
      await softDeletePriceItem(priceItem.id)
      removePriceItem(priceItem.id)
      if (editingPriceItemId === priceItem.id) {
        cancelEdit()
      }
      if (expandedPriceItemId === priceItem.id) {
        setExpandedPriceItemId(null)
      }
      showBanner(`Deleted price item ${priceItem.item_name}.`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete price item.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  if (loading) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Price Structure
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Loading price items</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Fetching price items from Supabase.
        </p>
      </section>
    )
  }

  if (pageError) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Price Structure
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Unable to load price items</h1>
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
              Price Structure
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Price Control Center
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Price items are sourced from Supabase. Current view is limited to{' '}
              {accessLevel === 'management' ? 'Management' : 'Employee'} access.
            </p>
          </div>

          <div className="grid gap-3 sm:text-right">
            <FieldPill enabled={false}>{currentItems.length} current</FieldPill>
            {canManage ? (
              <FieldPill enabled={false}>{archivedItems.length} archived</FieldPill>
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
          <PriceItemForm
            key={createRevision}
            description="Create a price item in Supabase. This does not use mock data or bottom-page forms."
            error={createError}
            isSubmitting={createSubmitting}
            onCancel={cancelCreate}
            onSubmit={handleCreate}
            submitLabel="Create Price Item"
            title="Create price item"
          />
        ) : (
          <div className="flex justify-end">
            <button
              className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              onClick={beginCreate}
              type="button"
            >
              Create Price Item
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
          <div className="text-sm text-slate-400">Showing page {currentDisplayPage} of {currentTotalPages}</div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Search by Item Name
            </span>
            <input
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
              onChange={(event) => {
                setSearchQuery(event.target.value)
                setCurrentPage(1)
                setArchivePage(1)
              }}
              placeholder="Search price items"
              value={searchQuery}
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Filter by Category
            </span>
            <select
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50"
              onChange={(event) => {
                setCategoryFilter(event.target.value)
                setCurrentPage(1)
                setArchivePage(1)
              }}
              value={categoryFilter}
            >
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
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

      <PriceItemTable
        accessLevel={accessLevel ?? 'employee'}
        actionTargetId={actionTargetId}
        editingError={editingError}
        editingPriceItem={editingPriceItem}
        editingPriceItemId={editingPriceItemId}
        editingSubmitting={editingSubmitting}
        expandedPriceItemId={expandedPriceItemId}
        onArchive={handleArchive}
        onCancelEdit={cancelEdit}
        onDelete={handleDelete}
        onRestore={handleRestore}
        onStartEdit={beginEdit}
        onSubmitEdit={handleEdit}
        onToggleExpanded={(priceItemId) =>
          setExpandedPriceItemId((current) => (current === priceItemId ? null : priceItemId))
        }
        priceItems={pagedCurrentItems}
        showArchiveActions={false}
        title="Current price items"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          {currentItems.length === 0
            ? 'No current price items match the active filters.'
            : `Showing ${Math.min((currentDisplayPage - 1) * ROWS_PER_PAGE + 1, currentItems.length)} to ${Math.min(currentDisplayPage * ROWS_PER_PAGE, currentItems.length)} of ${currentItems.length}.`}
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

      {canManage && archivedItems.length > 0 ? (
        <>
          <PriceItemTable
            accessLevel="management"
            actionTargetId={actionTargetId}
            editingError={null}
            editingPriceItem={null}
            editingPriceItemId={null}
            editingSubmitting={false}
            expandedPriceItemId={expandedPriceItemId}
            onArchive={handleArchive}
            onCancelEdit={cancelEdit}
            onDelete={handleDelete}
            onRestore={handleRestore}
            onStartEdit={beginEdit}
            onSubmitEdit={handleEdit}
            onToggleExpanded={(priceItemId) =>
              setExpandedPriceItemId((current) => (current === priceItemId ? null : priceItemId))
            }
            priceItems={pagedArchivedItems}
            showArchiveActions
            title="Archived price items"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-400">
              {archivedItems.length === 0
                ? 'No archived price items available.'
                : `Showing ${Math.min((archiveDisplayPage - 1) * ROWS_PER_PAGE + 1, archivedItems.length)} to ${Math.min(archiveDisplayPage * ROWS_PER_PAGE, archivedItems.length)} of ${archivedItems.length}.`}
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
          Saving price changes.
        </div>
      ) : null}
    </section>
  )
}
