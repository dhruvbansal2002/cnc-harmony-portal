import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import type {
  MembershipComplimentaryItemRecord,
  MembershipPlanRecord,
  PriceItemRecord,
} from '../../auth/types'
import { ComplimentaryItemForm } from '../../components/complimentary-items/ComplimentaryItemForm'
import { CarouselDeck } from '../../components/ui/CarouselDeck'
import { ActionMenu } from '../../components/ui/ActionMenu'
import {
  archiveComplimentaryItem,
  calculateTotalValue,
  complimentaryItemToFormValues,
  createComplimentaryItem,
  fetchComplimentaryItemPlans,
  fetchComplimentaryItemPriceItems,
  fetchComplimentaryItems,
  restoreComplimentaryItem,
  softDeleteComplimentaryItem,
  sortArchivedComplimentaryItemsOnly,
  sortComplimentaryItems,
  sortCurrentComplimentaryItems,
  updateComplimentaryItem,
  type ComplimentaryItemFormValues,
} from '../../lib/complimentaryItems'
import { isVisibleComplimentaryItem, type MembershipAudience } from '../../lib/membershipVisibility'

const ROWS_PER_PAGE = 20

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

function formatMoney(value: string | number | null) {
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

function ComplimentaryItemDetailPanel({
  item,
}: {
  item: MembershipComplimentaryItemRecord
}) {
  const totalValue = calculateTotalValue(
    item.price_item?.common_selling_price ?? null,
    item.quantity,
  )

  return (
    <div className="grid gap-4 rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-4 sm:p-5 lg:grid-cols-2">
      <div className="grid gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Membership Plan
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {item.membership_plan?.plan_name ?? 'Unknown plan'}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Complimentary Item
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {item.price_item?.item_name ?? 'Unknown item'}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Quantity
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{item.quantity}</p>
        </div>
      </div>

      <div className="grid gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Category
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {item.price_item?.category ?? '-'}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Item Selling Price
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {formatMoney(item.price_item?.common_selling_price ?? null)}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Total Value
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{formatMoney(totalValue)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Created At
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{formatDate(item.created_at)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Updated At
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{formatDate(item.updated_at)}</p>
        </div>
      </div>
    </div>
  )
}

interface ComplimentaryItemPlanCard {
  plan: MembershipPlanRecord
  items: MembershipComplimentaryItemRecord[]
}

function sortMembershipPlansForDisplay(plans: MembershipPlanRecord[]) {
  return [...plans].sort((first, second) => {
    const firstName = first.plan_name ?? ''
    const secondName = second.plan_name ?? ''
    const comparison = firstName.localeCompare(secondName)

    if (comparison !== 0) {
      return comparison
    }

    return first.id.localeCompare(second.id)
  })
}

function buildComplimentaryItemPlanCards({
  plans,
  items,
}: {
  plans: MembershipPlanRecord[]
  items: MembershipComplimentaryItemRecord[]
}) {
  const groupedItems = new Map<string, MembershipComplimentaryItemRecord[]>()

  for (const item of items) {
    const planItems = groupedItems.get(item.membership_plan_id) ?? []
    planItems.push(item)
    groupedItems.set(item.membership_plan_id, planItems)
  }

  return sortMembershipPlansForDisplay(plans)
    .map((plan) => ({
      plan,
      items: sortComplimentaryItems(groupedItems.get(plan.id) ?? []),
    }))
    .filter((card) => card.items.length > 0)
}

function ComplimentaryItemTable({
  title,
  items,
  accessLevel,
  membershipPlans,
  priceItems,
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
  showParentPlanStatus,
}: {
  title: string
  items: ComplimentaryItemPlanCard[]
  accessLevel: 'management' | 'employee' | 'customer' | null
  membershipPlans: MembershipPlanRecord[]
  priceItems: PriceItemRecord[]
  expandedItemId: string | null
  onToggleExpanded: (itemId: string) => void
  onStartEdit: (item: MembershipComplimentaryItemRecord) => void
  onArchive: (item: MembershipComplimentaryItemRecord) => void
  onRestore: (item: MembershipComplimentaryItemRecord) => void
  onDelete: (item: MembershipComplimentaryItemRecord) => void
  showArchiveActions?: boolean
  editingItemId: string | null
  editingItem: MembershipComplimentaryItemRecord | null
  editingError: string | null
  editingSubmitting: boolean
  onSubmitEdit: (values: ComplimentaryItemFormValues) => Promise<void>
  onCancelEdit: () => void
  actionTargetId: string | null
  showActions: boolean
  showParentPlanStatus: boolean
}) {
  const canManage = accessLevel === 'management'

  return (
    <CarouselDeck
      title={title}
      countLabel="plan cards"
      items={items}
      controlsPlacement="overlay"
      controlStyle="icon"
      wrapAround
      cardClassName="snap-center shrink-0 basis-[96%] sm:basis-[94%] md:basis-[92%] lg:basis-[90%] xl:basis-[88%] 2xl:basis-[86%]"
      themeTone={showArchiveActions ? 'emerald' : 'cyan'}
      emptyState={canManage ? 'No complimentary items configured yet.' : 'No complimentary items available.'}
      getKey={(card) => card.plan.id}
      childrenBelow={
        canManage && actionTargetId ? (
          <div className="sr-only" aria-live="polite">
            Saving complimentary item changes.
          </div>
        ) : null
      }
      renderItem={({ plan, items: planItems }, _index, isActive) => {
        const totalComplimentaryValue = planItems.reduce(
          (runningTotal, item) =>
            runningTotal +
            Number(
              calculateTotalValue(item.price_item?.common_selling_price ?? null, item.quantity) ??
                0,
            ),
          0,
        )
        const shouldScroll = planItems.length > 6

        return (
          <article
            className={[
              'flex h-full min-h-[24rem] flex-col overflow-hidden rounded-[2rem] border p-4 shadow-2xl backdrop-blur sm:p-5 lg:min-h-[22rem]',
              isActive
                ? 'border-cyan-300/30 bg-gradient-to-br from-slate-950 via-slate-950/90 to-cyan-950/35 shadow-cyan-950/30'
                : 'border-white/10 bg-gradient-to-br from-slate-950/95 via-slate-950/80 to-slate-900/50 shadow-black/20',
            ].join(' ')}
            data-testid="membership-plan-card"
          >
            <div className="grid flex-1 gap-5 xl:grid-cols-[minmax(19rem,0.38fr)_minmax(0,1fr)] xl:items-stretch">
              <aside className="flex h-full flex-col justify-between rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-4 sm:p-5 xl:min-h-[22rem]">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/70">
                    Membership Plan
                  </p>
                  <h3 className="mt-2 break-words text-2xl font-semibold tracking-tight text-white">
                    {plan.plan_name}
                  </h3>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <FieldPill enabled>{formatMoney(plan.plan_price ?? null)}</FieldPill>
                    <FieldPill enabled={false}>{planItems.length} items</FieldPill>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-3">
                    <p className="text-[0.68rem] uppercase tracking-[0.24em] text-slate-500">
                      Total Complimentary Value
                    </p>
                    <p className="mt-2 text-lg font-semibold tracking-tight text-white">
                      {formatMoney(totalComplimentaryValue)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-3">
                    <p className="text-[0.68rem] uppercase tracking-[0.24em] text-slate-500">
                      Status
                    </p>
                    <div className="mt-2">
                      <StatusBadge
                        tone={
                          plan.status === 'active'
                            ? 'success'
                            : plan.status === 'archived'
                              ? 'danger'
                              : 'warning'
                        }
                      >
                        {plan.status}
                      </StatusBadge>
                    </div>
                    {showParentPlanStatus ? (
                      <p className="mt-2 text-[0.72rem] font-medium uppercase tracking-[0.16em] text-slate-400">
                        Parent plan status: {plan.status}
                      </p>
                    ) : null}
                  </div>
                </div>
              </aside>

              <section className="flex min-h-0 flex-col rounded-[1.75rem] border border-white/10 bg-slate-950/45 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                      Complimentary Items
                    </p>
                    <p className="mt-2 text-sm text-slate-300">
                      {showParentPlanStatus
                        ? 'Parent plan status is shown for staff and management.'
                        : 'Items are presented as a read-only catalog.'}
                    </p>
                  </div>
                  <FieldPill enabled={false}>{planItems.length} items</FieldPill>
                </div>

                {planItems.length === 0 ? (
                  <div className="mt-4 flex min-h-0 flex-1 items-center justify-center rounded-[1.5rem] border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-slate-400">
                    {canManage ? 'No complimentary items configured for this plan.' : 'No complimentary items available.'}
                  </div>
                ) : (
                  <div
                    className={[
                      'mt-4 grid gap-4',
                      shouldScroll ? 'xl:max-h-[28rem] xl:overflow-y-auto xl:pr-2' : '',
                    ].join(' ')}
                  >
                    {planItems.map((item) => {
                      const isExpanded = expandedItemId === item.id
                      const isEditing = editingItemId === item.id
                      const totalValue = calculateTotalValue(
                        item.price_item?.common_selling_price ?? null,
                        item.quantity,
                      )

                      return (
                        <div
                          key={item.id}
                          className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 shadow-lg shadow-black/10 sm:p-5"
                          data-testid="membership-complimentary-item-row"
                        >
                          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(6rem,0.55fr)_minmax(7rem,0.6fr)_minmax(7rem,0.6fr)_auto] lg:items-center">
                            <div className="min-w-0">
                              <button
                                className="text-left text-base font-semibold leading-6 text-white transition hover:text-cyan-200"
                                onClick={() => onToggleExpanded(item.id)}
                                type="button"
                                data-testid="complimentary-item-name"
                              >
                                {item.price_item?.item_name ?? 'Unknown item'}
                              </button>
                              <p className="mt-1 text-sm leading-6 text-slate-400">
                                Category {item.price_item?.category ?? '-'}
                              </p>
                            </div>
                            <div className="min-w-0 lg:text-right">
                              <p className="text-[0.68rem] uppercase tracking-[0.24em] text-slate-500">
                                Quantity
                              </p>
                              <p className="mt-1 text-sm font-medium text-slate-100">{item.quantity}</p>
                            </div>
                            <div className="min-w-0 lg:text-right">
                              <p className="text-[0.68rem] uppercase tracking-[0.24em] text-slate-500">
                                Unit Value
                              </p>
                              <p className="mt-1 text-sm font-medium text-slate-100" data-testid="complimentary-item-value">
                                {formatMoney(item.price_item?.common_selling_price ?? null)}
                              </p>
                            </div>
                            <div className="min-w-0 lg:text-right">
                              <p className="text-[0.68rem] uppercase tracking-[0.24em] text-slate-500">
                                Total Value
                              </p>
                              <p className="mt-1 text-sm font-medium text-slate-100" data-testid="complimentary-total-value">
                                {formatMoney(totalValue)}
                              </p>
                            </div>
                            {showActions ? (
                              <div className="flex items-start justify-end">
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
                                  <span className="text-sm text-slate-500">Read only</span>
                                )}
                              </div>
                            ) : null}
                          </div>

                          {isExpanded && !isEditing ? (
                            <div className="mt-4">
                              <ComplimentaryItemDetailPanel item={item} />
                            </div>
                          ) : null}

                          {isEditing && editingItem ? (
                            <div className="mt-4">
                              <ComplimentaryItemForm
                                key={editingItem.id}
                                description="Update the complimentary item in Supabase. Changes save immediately."
                                error={editingError}
                                initialValues={complimentaryItemToFormValues(editingItem)}
                                isSubmitting={editingSubmitting}
                                membershipPlans={membershipPlans}
                                onCancel={onCancelEdit}
                                onSubmit={onSubmitEdit}
                                priceItems={priceItems}
                                submitLabel="Save changes"
                                title="Edit complimentary item"
                                variant="inline"
                              />
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            </div>
          </article>
        )
      }}
    />
  )
}

export function ComplimentaryItemsPage({
  pageVariant = 'internal',
}: {
  pageVariant?: 'public' | 'internal'
}) {
  const { status, accessLevel, authUser, employee, customer } = useAuth()
  const isPublicVariant = pageVariant === 'public'
  const isStaffViewer =
    pageVariant === 'internal' && (accessLevel === 'management' || accessLevel === 'employee')

  const [complimentaryItems, setComplimentaryItems] = useState<MembershipComplimentaryItemRecord[]>(
    [],
  )
  const [membershipPlans, setMembershipPlans] = useState<MembershipPlanRecord[]>([])
  const [priceItems, setPriceItems] = useState<PriceItemRecord[]>([])
  const [loading, setLoading] = useState(true)
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
  const [actionTargetId, setActionTargetId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [archivePage, setArchivePage] = useState(1)

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      setLoading(true)
      setPageError(null)

      try {
        const [itemData, planData, priceItemData] = await Promise.all([
          fetchComplimentaryItems(),
          fetchComplimentaryItemPlans(),
          fetchComplimentaryItemPriceItems(),
        ])

        if (!isMounted) {
          return
        }

        setComplimentaryItems(itemData)
        setMembershipPlans(planData)
        setPriceItems(priceItemData)
      } catch (error) {
        if (!isMounted) {
          return
        }

        const message =
          error instanceof Error ? error.message : 'Unable to load complimentary items.'
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

  if (status === 'loading') {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Complimentary Items
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Loading complimentary items</h1>
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
  const audience: MembershipAudience = isPublicVariant
    ? 'public'
    : activeAccessLevel === 'management'
      ? 'management'
      : 'employee'
  const currentUser = currentUserLabel({
    accessLevel: activeAccessLevel,
    authEmail: authUser?.email,
    characterName: employee?.character_name ?? customer?.character_name ?? null,
  })

  const visibleComplimentaryItems = complimentaryItems.filter((item) =>
    isVisibleComplimentaryItem(item, audience),
  )

  const currentComplimentaryItems = sortCurrentComplimentaryItems(visibleComplimentaryItems)

  const archivedComplimentaryItems = sortArchivedComplimentaryItemsOnly(visibleComplimentaryItems)

  const currentComplimentaryPlanCards = buildComplimentaryItemPlanCards({
    plans: membershipPlans,
    items: currentComplimentaryItems,
  })
  const archivedComplimentaryPlanCards = buildComplimentaryItemPlanCards({
    plans: membershipPlans,
    items: archivedComplimentaryItems,
  })

  const currentTotalPages = Math.max(1, Math.ceil(currentComplimentaryPlanCards.length / ROWS_PER_PAGE))
  const currentDisplayPage = Math.min(currentPage, currentTotalPages)
  const pagedCurrentComplimentaryPlanCards = currentComplimentaryPlanCards.slice(
    (currentDisplayPage - 1) * ROWS_PER_PAGE,
    currentDisplayPage * ROWS_PER_PAGE,
  )
  const archiveTotalPages = Math.max(1, Math.ceil(archivedComplimentaryPlanCards.length / ROWS_PER_PAGE))
  const archiveDisplayPage = Math.min(archivePage, archiveTotalPages)
  const pagedArchivedComplimentaryPlanCards = archivedComplimentaryPlanCards.slice(
    (archiveDisplayPage - 1) * ROWS_PER_PAGE,
    archiveDisplayPage * ROWS_PER_PAGE,
  )

  const editingItem =
    editingItemId === null
      ? null
      : complimentaryItems.find((item) => item.id === editingItemId) ?? null

  function showBanner(message: string, tone: 'success' | 'error') {
    setBannerMessage(message)
    setBannerTone(tone)
  }

  function syncItem(updatedItem: MembershipComplimentaryItemRecord) {
    setComplimentaryItems((current) => {
      const nextItems = current.some((item) => item.id === updatedItem.id)
        ? current.map((item) => (item.id === updatedItem.id ? updatedItem : item))
        : [updatedItem, ...current]

      return sortComplimentaryItems(nextItems.filter((item) => item.deleted_at === null))
    })
  }

  function removeItem(itemId: string) {
    setComplimentaryItems((current) => current.filter((item) => item.id !== itemId))
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

  function beginEdit(item: MembershipComplimentaryItemRecord) {
    setEditingItemId(item.id)
    setCreateVisible(false)
    setCreateError(null)
    setEditingError(null)
    setBannerMessage(null)
    setExpandedItemId(null)
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

  async function handleCreate(values: ComplimentaryItemFormValues) {
    setCreateSubmitting(true)
    setCreateError(null)
    setBannerMessage(null)

    try {
      const created = await createComplimentaryItem(values)
      syncItem(created)
      cancelCreate()
      setExpandedItemId(created.id)
      showBanner('Created complimentary item.', 'success')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to create complimentary item.'
      setCreateError(message)
      showBanner(message, 'error')
    } finally {
      setCreateSubmitting(false)
    }
  }

  async function handleEdit(values: ComplimentaryItemFormValues) {
    if (!editingItemId) {
      return
    }

    setEditingSubmitting(true)
    setEditingError(null)
    setBannerMessage(null)

    try {
      const updated = await updateComplimentaryItem(editingItemId, values)
      syncItem(updated)
      setEditingItemId(null)
      setExpandedItemId(updated.id)
      showBanner('Updated complimentary item.', 'success')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to update complimentary item.'
      setEditingError(message)
      showBanner(message, 'error')
    } finally {
      setEditingSubmitting(false)
    }
  }

  async function handleArchive(item: MembershipComplimentaryItemRecord) {
    setActionTargetId(item.id)
    setBannerMessage(null)

    try {
      const updated = await archiveComplimentaryItem(item.id)
      syncItem(updated)
      if (editingItemId === item.id) {
        cancelEdit()
      }
      showBanner('Archived complimentary item.', 'success')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to archive complimentary item.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  async function handleRestore(item: MembershipComplimentaryItemRecord) {
    setActionTargetId(item.id)
    setBannerMessage(null)

    try {
      const updated = await restoreComplimentaryItem(item.id)
      syncItem(updated)
      showBanner('Restored complimentary item.', 'success')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to restore complimentary item.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  async function handleDelete(item: MembershipComplimentaryItemRecord) {
    const confirmed = window.confirm(
      'Soft delete this complimentary item? This will remove it from all lists.',
    )

    if (!confirmed) {
      return
    }

    setActionTargetId(item.id)
    setBannerMessage(null)

    try {
      await softDeleteComplimentaryItem(item.id)
      removeItem(item.id)
      if (editingItemId === item.id) {
        cancelEdit()
      }
      if (expandedItemId === item.id) {
        setExpandedItemId(null)
      }
      showBanner('Deleted complimentary item.', 'success')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to delete complimentary item.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  if (loading) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Complimentary Items
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Loading complimentary items
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Fetching complimentary items from Supabase.
        </p>
      </section>
    )
  }

  if (pageError) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Complimentary Items
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Unable to load complimentary items
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
              Complimentary Items
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Complimentary Items Control Center
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Complimentary item rows are sourced from Supabase and calculated in the UI.{' '}
              {isStaffViewer
                ? `Current view is limited to ${accessLabel(activeAccessLevel)} access.`
                : 'Public catalog view.'}
            </p>
          </div>

          <div className="grid gap-3 sm:text-right">
            <FieldPill enabled={false}>{currentComplimentaryPlanCards.length} current</FieldPill>
            {isStaffViewer ? (
              canManage ? (
                <FieldPill enabled={false}>{archivedComplimentaryPlanCards.length} archived</FieldPill>
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
          <ComplimentaryItemForm
            key={createRevision}
            description="Create a complimentary item in Supabase. The database enforces unique plan + price item combinations."
            error={createError}
            isSubmitting={createSubmitting}
            membershipPlans={membershipPlans}
            onCancel={cancelCreate}
            onSubmit={handleCreate}
            priceItems={priceItems}
            submitLabel="Create Complimentary Item"
            title="Create complimentary item"
          />
        ) : (
          <div className="flex justify-end">
            <button
              className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              onClick={beginCreate}
              type="button"
            >
              Create Complimentary Item
            </button>
          </div>
        )
      ) : null}

      <ComplimentaryItemTable
        accessLevel={activeAccessLevel}
        actionTargetId={actionTargetId}
        editingItem={editingItem}
        editingItemId={editingItemId}
        editingError={editingError}
        editingSubmitting={editingSubmitting}
        membershipPlans={membershipPlans}
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
        items={pagedCurrentComplimentaryPlanCards}
        priceItems={priceItems}
        showActions={canManage}
        showArchiveActions={false}
        showParentPlanStatus={isStaffViewer}
        title={
          isStaffViewer ? 'Current complimentary items' : 'Active complimentary items'
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          {currentComplimentaryPlanCards.length === 0
            ? !isStaffViewer
              ? 'No active complimentary items are available.'
              : 'No current complimentary items are available.'
            : `Showing ${Math.min((currentDisplayPage - 1) * ROWS_PER_PAGE + 1, currentComplimentaryPlanCards.length)} to ${Math.min(currentDisplayPage * ROWS_PER_PAGE, currentComplimentaryPlanCards.length)} of ${currentComplimentaryPlanCards.length}.`}
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

      {canManage && archivedComplimentaryPlanCards.length > 0 ? (
        <>
          <ComplimentaryItemTable
            accessLevel="management"
            actionTargetId={actionTargetId}
            editingItem={null}
            editingItemId={null}
            editingError={null}
            editingSubmitting={false}
            membershipPlans={membershipPlans}
            expandedItemId={expandedItemId}
            onArchive={handleArchive}
            onCancelEdit={cancelEdit}
            onDelete={handleDelete}
            onRestore={handleRestore}
            onStartEdit={beginEdit}
            onSubmitEdit={handleEdit}
            priceItems={priceItems}
            onToggleExpanded={(itemId) =>
              setExpandedItemId((current) => (current === itemId ? null : itemId))
            }
            items={pagedArchivedComplimentaryPlanCards}
            showActions
            showArchiveActions
            showParentPlanStatus
            title="Archived complimentary items"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-400">
              {archivedComplimentaryPlanCards.length === 0
                ? 'No archived complimentary items available.'
                : `Showing ${Math.min((archiveDisplayPage - 1) * ROWS_PER_PAGE + 1, archivedComplimentaryPlanCards.length)} to ${Math.min(archiveDisplayPage * ROWS_PER_PAGE, archivedComplimentaryPlanCards.length)} of ${archivedComplimentaryPlanCards.length}.`}
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
          Saving complimentary item changes.
        </div>
      ) : null}
    </section>
  )
}
