import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../../auth/useAuth'
import type { OutfitGuideRecord } from '../../auth/types'
import { ActionMenu } from '../../components/ui/ActionMenu'
import { OutfitGuideForm } from '../../components/outfit-guide/OutfitGuideForm'
import {
  archiveOutfitGuideItem,
  createOutfitGuideItem,
  fetchOutfitGuideItems,
  outfitGuideToFormValues,
  restoreOutfitGuideItem,
  softDeleteOutfitGuideItem,
  sortArchivedOutfitGuideItemsOnly,
  sortCurrentOutfitGuideItems,
  sortOutfitGuideItems,
  updateOutfitGuideItem,
  type OutfitGuideFormValues,
} from '../../lib/outfitGuide'

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

function OutfitGuideStatusBadge({ status }: { status: OutfitGuideRecord['status'] }) {
  const badgeMap: Record<
    OutfitGuideRecord['status'],
    { tone: 'success' | 'warning' | 'neutral' | 'danger'; label: string }
  > = {
    active: { tone: 'success', label: 'Active' },
    inactive: { tone: 'warning', label: 'Inactive' },
    archived: { tone: 'danger', label: 'Archived' },
  }

  const badge = badgeMap[status]
  return <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
}

function GuideImagePreview({
  imageUrl,
  title,
  large = false,
}: {
  imageUrl: string | null
  title: string
  large?: boolean
}) {
  const [failed, setFailed] = useState(false)

  if (!imageUrl || failed) {
    return (
      <div
        className={[
          'flex items-center justify-center rounded-2xl border border-white/10 bg-slate-950/70 text-center text-xs uppercase tracking-[0.22em] text-slate-500',
          large ? 'min-h-64 px-6 py-10' : 'min-h-44 px-4 py-8',
        ].join(' ')}
      >
        No image preview
      </div>
    )
  }

  return (
    <img
      alt={title}
      className={[
        'w-full rounded-2xl border border-white/10 object-cover',
        large ? 'max-h-96 min-h-64' : 'max-h-52 min-h-44',
      ].join(' ')}
      onError={() => setFailed(true)}
      src={imageUrl}
    />
  )
}

function OutfitGuideDetailPanel({ item }: { item: OutfitGuideRecord }) {
  return (
    <div className="grid gap-4 rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-4 sm:p-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Title
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-200">{item.title}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Category
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-200">{item.category ?? '-'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Description
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">
              {item.description ?? '-'}
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Image URL
            </p>
            <p className="mt-2 break-all text-sm leading-6 text-slate-200">
              {item.image_url ?? '-'}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Large Preview
            </p>
            <div className="mt-2">
              <GuideImagePreview imageUrl={item.image_url} title={item.title} large />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Created At
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-200">{formatDateTime(item.created_at)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Updated At
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-200">{formatDateTime(item.updated_at)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function OutfitGuideCardGrid({
  title,
  items,
  accessLevel,
  expandedItemId,
  onToggleExpanded,
  onStartEdit,
  onArchive,
  onRestore,
  onDelete,
  showArchiveActions = false,
  editingItemId,
  editingItem,
  editingError,
  editingSubmitting,
  onSubmitEdit,
  onCancelEdit,
  actionTargetId,
  showActions,
}: {
  title: string
  items: OutfitGuideRecord[]
  accessLevel: 'management' | 'employee'
  expandedItemId: string | null
  onToggleExpanded: (itemId: string) => void
  onStartEdit: (item: OutfitGuideRecord) => void
  onArchive: (item: OutfitGuideRecord) => void
  onRestore: (item: OutfitGuideRecord) => void
  onDelete: (item: OutfitGuideRecord) => void
  showArchiveActions?: boolean
  editingItemId: string | null
  editingItem: OutfitGuideRecord | null
  editingError: string | null
  editingSubmitting: boolean
  onSubmitEdit: (values: OutfitGuideFormValues) => Promise<void>
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
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <FieldPill enabled={false}>{showArchiveActions ? 'Archived' : 'Current'}</FieldPill>
          <FieldPill enabled>{'20 rows per page'}</FieldPill>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.length === 0 ? (
          <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-6 text-sm text-slate-400 md:col-span-2 xl:col-span-3">
            No outfit guide items found.
          </div>
        ) : (
          items.map((item) => {
            const isExpanded = expandedItemId === item.id
            const isEditing = editingItemId === item.id

            return (
              <article
                key={item.id}
                className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/70 shadow-lg shadow-black/20"
              >
                <div className="p-4 sm:p-5">
                  <div className="relative">
                    <GuideImagePreview imageUrl={item.image_url} title={item.title} />

                    {showActions ? (
                      <div className="absolute right-3 top-3">
                        {canManage ? (
                          <ActionMenu triggerLabel="Actions">
                              {!showArchiveActions ? (
                                <>
                                  <button
                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/5"
                                    onClick={() => onStartEdit(item)}
                                    type="button"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/5"
                                    onClick={() => onArchive(item)}
                                    type="button"
                                  >
                                    Archive
                                  </button>
                                  <button
                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-rose-100 transition hover:bg-rose-500/10"
                                    onClick={() => onDelete(item)}
                                    type="button"
                                  >
                                    Delete
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-emerald-100 transition hover:bg-emerald-500/10"
                                    onClick={() => onRestore(item)}
                                    type="button"
                                  >
                                    Restore
                                  </button>
                                  <button
                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-rose-100 transition hover:bg-rose-500/10"
                                    onClick={() => onDelete(item)}
                                    type="button"
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                          </ActionMenu>
                        ) : (
                          <span className="rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Read only
                          </span>
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 flex items-start justify-between gap-3">
                    <button
                      className="text-left text-base font-semibold leading-6 text-white transition hover:text-cyan-200"
                      onClick={() => onToggleExpanded(item.id)}
                      type="button"
                    >
                      {item.title}
                    </button>
                    <OutfitGuideStatusBadge status={item.status} />
                  </div>

                  <p className="mt-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                    {item.category ?? 'Uncategorized'}
                  </p>

                  {item.description ? (
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-300">
                      {item.description}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm leading-6 text-slate-500">No description provided.</p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <FieldPill enabled={item.image_url !== null}>Image Preview</FieldPill>
                    <FieldPill enabled>{showArchiveActions ? 'Archive view' : 'Current view'}</FieldPill>
                  </div>

                  {isExpanded && !isEditing ? (
                    <div className="mt-4">
                      <OutfitGuideDetailPanel item={item} />
                    </div>
                  ) : null}

                  {isEditing && editingItem ? (
                    <div className="mt-4">
                      <OutfitGuideForm
                        key={editingItem.id}
                        description="Update the outfit guide entry in Supabase. Changes save immediately."
                        error={editingError}
                        initialValues={outfitGuideToFormValues(editingItem)}
                        isSubmitting={editingSubmitting}
                        onCancel={onCancelEdit}
                        onSubmit={onSubmitEdit}
                        submitLabel="Save changes"
                        title={`Edit ${editingItem.title}`}
                        variant="inline"
                      />
                    </div>
                  ) : null}
                </div>
              </article>
            )
          })
        )}
      </div>

      {canManage && actionTargetId ? (
        <div className="sr-only" aria-live="polite">
          Saving outfit guide changes.
        </div>
      ) : null}
    </section>
  )
}

export function OutfitGuidePage() {
  const { accessLevel, authUser, employee } = useAuth()

  const activeAccessLevel = accessLevel ?? 'customer'
  const [outfitGuideItems, setOutfitGuideItems] = useState<OutfitGuideRecord[]>([])
  const [loading, setLoading] = useState(activeAccessLevel !== 'customer')
  const [pageError, setPageError] = useState<string | null>(null)
  const [bannerMessage, setBannerMessage] = useState<string | null>(null)
  const [bannerTone, setBannerTone] = useState<'success' | 'error' | null>(null)
  const [createVisible, setCreateVisible] = useState(false)
  const [createRevision, setCreateRevision] = useState(0)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingError, setEditingError] = useState<string | null>(null)
  const [editingSubmitting, setEditingSubmitting] = useState(false)
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
  const [expandedArchivedItemId, setExpandedArchivedItemId] = useState<string | null>(null)
  const [actionTargetId, setActionTargetId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
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
        const data = await fetchOutfitGuideItems()

        if (!isMounted) {
          return
        }

        setOutfitGuideItems(data)
      } catch (error) {
        if (!isMounted) {
          return
        }

        const message = error instanceof Error ? error.message : 'Unable to load outfit guide.'
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
  const categories = Array.from(
    new Set(
      outfitGuideItems
        .map((record) => record.category?.trim() ?? '')
        .filter((value) => value.length > 0),
    ),
  ).sort((first, second) => first.localeCompare(second))
  const hasUnspecifiedCategory = outfitGuideItems.some((record) => !record.category?.trim())

  const categoryOptions = [
    { value: 'all', label: 'All categories' },
    ...categories.map((category) => ({ value: category, label: category })),
    ...(hasUnspecifiedCategory ? [{ value: '__unspecified__', label: 'Unspecified' }] : []),
  ] as const

  const currentOutfitGuideItems = sortCurrentOutfitGuideItems(outfitGuideItems).filter((record) => {
    const matchesCategory =
      categoryFilter === 'all'
        ? true
        : categoryFilter === '__unspecified__'
          ? !record.category?.trim()
          : record.category?.trim() === categoryFilter

    return (
      record.title.toLowerCase().includes(searchTerm) &&
      matchesCategory &&
      (statusFilter === 'all' ? true : record.status === statusFilter)
    )
  })

  const archivedOutfitGuideItems = sortArchivedOutfitGuideItemsOnly(outfitGuideItems).filter(
    (record) => {
      const matchesCategory =
        categoryFilter === 'all'
          ? true
          : categoryFilter === '__unspecified__'
            ? !record.category?.trim()
            : record.category?.trim() === categoryFilter

      return record.title.toLowerCase().includes(searchTerm) && matchesCategory
    },
  )

  const currentTotalPages = Math.max(1, Math.ceil(currentOutfitGuideItems.length / ROWS_PER_PAGE))
  const currentDisplayPage = Math.min(currentPage, currentTotalPages)
  const pagedCurrentOutfitGuideItems = currentOutfitGuideItems.slice(
    (currentDisplayPage - 1) * ROWS_PER_PAGE,
    currentDisplayPage * ROWS_PER_PAGE,
  )

  const archiveTotalPages = Math.max(1, Math.ceil(archivedOutfitGuideItems.length / ROWS_PER_PAGE))
  const archiveDisplayPage = Math.min(archivePage, archiveTotalPages)
  const pagedArchivedOutfitGuideItems = archivedOutfitGuideItems.slice(
    (archiveDisplayPage - 1) * ROWS_PER_PAGE,
    archiveDisplayPage * ROWS_PER_PAGE,
  )

  const editingItem =
    editingItemId === null
      ? null
      : outfitGuideItems.find((record) => record.id === editingItemId) ?? null

  function showBanner(message: string, tone: 'success' | 'error') {
    setBannerMessage(message)
    setBannerTone(tone)
  }

  function syncItem(updatedItem: OutfitGuideRecord) {
    setOutfitGuideItems((current) => {
      const nextItems = current.some((record) => record.id === updatedItem.id)
        ? current.map((record) => (record.id === updatedItem.id ? updatedItem : record))
        : [updatedItem, ...current]

      return sortOutfitGuideItems(nextItems.filter((record) => record.deleted_at === null))
    })
  }

  function removeItem(itemId: string) {
    setOutfitGuideItems((current) => current.filter((record) => record.id !== itemId))
  }

  function beginCreate() {
    setCreateVisible(true)
    setEditingItemId(null)
    setCreateError(null)
    setEditingError(null)
    setBannerMessage(null)
    setCreateRevision((current) => current + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function beginEdit(record: OutfitGuideRecord) {
    setEditingItemId(record.id)
    setCreateVisible(false)
    setCreateError(null)
    setEditingError(null)
    setBannerMessage(null)
    setExpandedItemId(null)
    setExpandedArchivedItemId(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingItemId(null)
    setEditingError(null)
  }

  function cancelCreate() {
    setCreateVisible(false)
    setCreateError(null)
  }

  async function handleCreate(values: OutfitGuideFormValues) {
    setCreateSubmitting(true)
    setCreateError(null)
    setBannerMessage(null)

    try {
      const created = await createOutfitGuideItem(values)
      syncItem(created)
      cancelCreate()
      setExpandedItemId(created.id)
      showBanner(`Created outfit guide item ${created.title}.`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create outfit guide item.'
      setCreateError(message)
      showBanner(message, 'error')
    } finally {
      setCreateSubmitting(false)
    }
  }

  async function handleEdit(values: OutfitGuideFormValues) {
    if (!editingItemId) {
      return
    }

    setEditingSubmitting(true)
    setEditingError(null)
    setBannerMessage(null)

    try {
      const updated = await updateOutfitGuideItem(editingItemId, values)
      syncItem(updated)
      setEditingItemId(null)
      setExpandedItemId(updated.id)
      showBanner(`Updated outfit guide item ${updated.title}.`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update outfit guide item.'
      setEditingError(message)
      showBanner(message, 'error')
    } finally {
      setEditingSubmitting(false)
    }
  }

  async function handleArchive(record: OutfitGuideRecord) {
    setActionTargetId(record.id)
    setBannerMessage(null)

    try {
      const updated = await archiveOutfitGuideItem(record.id)
      syncItem(updated)
      if (editingItemId === record.id) {
        cancelEdit()
      }
      setExpandedItemId(null)
      setExpandedArchivedItemId(updated.id)
      showBanner(`Archived outfit guide item ${updated.title}.`, 'success')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to archive outfit guide item.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  async function handleRestore(record: OutfitGuideRecord) {
    const confirmed = window.confirm(`Restore ${record.title} back into the current guide?`)

    if (!confirmed) {
      return
    }

    setActionTargetId(record.id)
    setBannerMessage(null)

    try {
      const updated = await restoreOutfitGuideItem(record.id)
      syncItem(updated)
      setExpandedArchivedItemId(null)
      setExpandedItemId(updated.id)
      showBanner(`Restored outfit guide item ${updated.title}.`, 'success')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to restore outfit guide item.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  async function handleDelete(record: OutfitGuideRecord) {
    const confirmed = window.confirm(
      `Soft delete ${record.title}? This will remove the item from all lists.`,
    )

    if (!confirmed) {
      return
    }

    setActionTargetId(record.id)
    setBannerMessage(null)

    try {
      await softDeleteOutfitGuideItem(record.id)
      removeItem(record.id)
      if (editingItemId === record.id) {
        cancelEdit()
      }
      if (expandedItemId === record.id) {
        setExpandedItemId(null)
      }
      if (expandedArchivedItemId === record.id) {
        setExpandedArchivedItemId(null)
      }
      showBanner(`Deleted outfit guide item ${record.title}.`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete outfit guide item.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  if (activeAccessLevel === 'customer') {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Outfit Guide
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Outfit guide unavailable</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          This module is restricted to internal portal access.
        </p>
      </section>
    )
  }

  if (loading) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Outfit Guide
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Loading outfit guide</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Fetching outfit guide entries from Supabase.
        </p>
      </section>
    )
  }

  if (pageError) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Outfit Guide
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Unable to load outfit guide
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
              Outfit Guide
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Outfit Guide Control Center
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Outfit guide entries are sourced from Supabase and displayed as a visual reference.
              Current view is limited to {accessLabel(activeAccessLevel)} access.
            </p>
          </div>

          <div className="grid gap-3 sm:text-right">
            <FieldPill enabled={false}>{currentOutfitGuideItems.length} current</FieldPill>
            {canManage ? (
              <FieldPill enabled={false}>{archivedOutfitGuideItems.length} archived</FieldPill>
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
          <OutfitGuideForm
            key={createRevision}
            description="Create an outfit guide entry in Supabase. Image URL is optional and previews safely."
            error={createError}
            isSubmitting={createSubmitting}
            onCancel={cancelCreate}
            onSubmit={handleCreate}
            submitLabel="Create Outfit Guide Item"
            title="Create outfit guide item"
          />
        ) : (
          <div className="flex justify-end">
            <button
              className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              onClick={beginCreate}
              type="button"
            >
              Create Outfit Guide Item
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
              Search by Title
            </span>
            <input
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
              onChange={(event) => {
                setSearchQuery(event.target.value)
                setCurrentPage(1)
                setArchivePage(1)
              }}
              placeholder="Search outfit guide"
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
              {categoryOptions.map((option) => (
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

      <OutfitGuideCardGrid
        accessLevel={canManage ? 'management' : 'employee'}
        actionTargetId={actionTargetId}
        editingError={editingError}
        editingItem={editingItem}
        editingItemId={editingItemId}
        editingSubmitting={editingSubmitting}
        expandedItemId={expandedItemId}
        onArchive={handleArchive}
        onCancelEdit={cancelEdit}
        onDelete={handleDelete}
        onRestore={handleRestore}
        onStartEdit={beginEdit}
        onSubmitEdit={handleEdit}
        onToggleExpanded={(itemId) =>
          setExpandedItemId((current) => (current === itemId ? null : itemId))
        }
        items={pagedCurrentOutfitGuideItems}
        showActions={canManage}
        showArchiveActions={false}
        title="Current outfit guide items"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          {currentOutfitGuideItems.length === 0
            ? 'No current outfit guide items match the active filters.'
            : `Showing ${Math.min((currentDisplayPage - 1) * ROWS_PER_PAGE + 1, currentOutfitGuideItems.length)} to ${Math.min(currentDisplayPage * ROWS_PER_PAGE, currentOutfitGuideItems.length)} of ${currentOutfitGuideItems.length}.`}
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

      {canManage && archivedOutfitGuideItems.length > 0 ? (
        <>
          <OutfitGuideCardGrid
            accessLevel="management"
            actionTargetId={actionTargetId}
            editingError={null}
            editingItem={null}
            editingItemId={null}
            editingSubmitting={false}
            expandedItemId={expandedArchivedItemId}
            onArchive={handleArchive}
            onCancelEdit={cancelEdit}
            onDelete={handleDelete}
            onRestore={handleRestore}
            onStartEdit={beginEdit}
            onSubmitEdit={handleEdit}
            onToggleExpanded={(itemId) =>
              setExpandedArchivedItemId((current) => (current === itemId ? null : itemId))
            }
            items={pagedArchivedOutfitGuideItems}
            showActions
            showArchiveActions
            title="Archived outfit guide items"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-400">
              {archivedOutfitGuideItems.length === 0
                ? 'No archived outfit guide items available.'
                : `Showing ${Math.min((archiveDisplayPage - 1) * ROWS_PER_PAGE + 1, archivedOutfitGuideItems.length)} to ${Math.min(archiveDisplayPage * ROWS_PER_PAGE, archivedOutfitGuideItems.length)} of ${archivedOutfitGuideItems.length}.`}
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
          Saving outfit guide changes.
        </div>
      ) : null}
    </section>
  )
}
