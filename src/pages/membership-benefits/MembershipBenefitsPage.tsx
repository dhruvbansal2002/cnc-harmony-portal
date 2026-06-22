import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import type { MembershipBenefitRecord, MembershipPlanRecord, PriceItemRecord } from '../../auth/types'
import { MembershipBenefitForm } from '../../components/memberships/MembershipBenefitForm'
import { CarouselDeck } from '../../components/ui/CarouselDeck'
import { ActionMenu } from '../../components/ui/ActionMenu'
import {
  archiveMembershipBenefit,
  calculateMemberPrice,
  createMembershipBenefit,
  fetchMembershipBenefitPlans,
  fetchMembershipBenefitPriceItems,
  fetchMembershipBenefits,
  membershipBenefitToFormValues,
  restoreMembershipBenefit,
  softDeleteMembershipBenefit,
  sortArchivedMembershipBenefitsOnly,
  sortCurrentMembershipBenefits,
  sortMembershipBenefits,
  updateMembershipBenefit,
  type MembershipBenefitFormValues,
} from '../../lib/membershipBenefits'
import { isVisibleMembershipBenefit, type MembershipAudience } from '../../lib/membershipVisibility'

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

function BenefitDetailPanel({
  benefit,
}: {
  benefit: MembershipBenefitRecord
}) {
  const memberPrice = calculateMemberPrice(
    benefit.price_item?.common_selling_price ?? null,
    benefit.discount_percent,
  )

  return (
    <div className="grid gap-4 rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-4 sm:p-5 lg:grid-cols-2">
      <div className="grid gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Membership Plan
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {benefit.membership_plan?.plan_name ?? 'Unknown plan'}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Price Item
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {benefit.price_item?.item_name ?? 'Unknown item'}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Discount Percent
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {`${Number(benefit.discount_percent).toFixed(2)}%`}
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Member Price
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{formatPrice(memberPrice)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Created At
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{formatDate(benefit.created_at)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Updated At
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{formatDate(benefit.updated_at)}</p>
        </div>
      </div>
    </div>
  )
}

interface MembershipBenefitPlanCard {
  plan: MembershipPlanRecord
  benefits: MembershipBenefitRecord[]
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

function buildMembershipBenefitPlanCards({
  plans,
  benefits,
  includeEmptyPlans,
}: {
  plans: MembershipPlanRecord[]
  benefits: MembershipBenefitRecord[]
  includeEmptyPlans: boolean
}) {
  const groupedBenefits = new Map<string, MembershipBenefitRecord[]>()

  for (const benefit of benefits) {
    const planBenefits = groupedBenefits.get(benefit.membership_plan_id) ?? []
    planBenefits.push(benefit)
    groupedBenefits.set(benefit.membership_plan_id, planBenefits)
  }

  return sortMembershipPlansForDisplay(plans)
    .map((plan) => ({
      plan,
      benefits: sortMembershipBenefits(groupedBenefits.get(plan.id) ?? []),
    }))
    .filter((card) => (includeEmptyPlans ? true : card.benefits.length > 0))
}

function MembershipBenefitCardDeck({
  title,
  cards,
  accessLevel,
  membershipPlans,
  priceItems,
  expandedBenefitId,
  onToggleExpanded,
  onStartEdit,
  onArchive,
  onRestore,
  onDelete,
  showArchiveActions = false,
  editingBenefitId,
  editingBenefit,
  editingError,
  editingSubmitting,
  onSubmitEdit,
  onCancelEdit,
  actionTargetId,
  showActions,
  showParentPlanStatus,
}: {
  title: string
  cards: MembershipBenefitPlanCard[]
  accessLevel: 'management' | 'employee' | 'customer' | null
  membershipPlans: MembershipPlanRecord[]
  priceItems: PriceItemRecord[]
  expandedBenefitId: string | null
  onToggleExpanded: (benefitId: string) => void
  onStartEdit: (benefit: MembershipBenefitRecord) => void
  onArchive: (benefit: MembershipBenefitRecord) => void
  onRestore: (benefit: MembershipBenefitRecord) => void
  onDelete: (benefit: MembershipBenefitRecord) => void
  showArchiveActions?: boolean
  editingBenefitId: string | null
  editingBenefit: MembershipBenefitRecord | null
  editingError: string | null
  editingSubmitting: boolean
  onSubmitEdit: (values: MembershipBenefitFormValues) => Promise<void>
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
      items={cards}
      controlsPlacement="overlay"
      controlStyle="icon"
      cardClassName="snap-center shrink-0 basis-[96%] sm:basis-[94%] md:basis-[92%] lg:basis-[90%] xl:basis-[88%] 2xl:basis-[86%]"
      wrapAround
      themeTone={showArchiveActions ? 'emerald' : 'cyan'}
      emptyState={canManage ? 'No benefits configured yet.' : 'No benefits available.'}
      getKey={(card) => card.plan.id}
      childrenBelow={
        canManage && actionTargetId ? (
          <div className="sr-only" aria-live="polite">
            Saving membership benefit changes.
          </div>
        ) : null
      }
      renderItem={({ plan, benefits }, _index, isActive) => (
        <article
          className={[
            'flex h-full min-h-[24rem] flex-col overflow-hidden rounded-[2rem] border p-4 shadow-2xl backdrop-blur sm:p-5 lg:min-h-[22rem]',
            isActive
              ? 'border-cyan-300/30 bg-gradient-to-br from-slate-950 via-slate-950/90 to-cyan-950/35 shadow-cyan-950/30'
              : 'border-white/10 bg-gradient-to-br from-slate-950/95 via-slate-950/80 to-slate-900/50 shadow-black/20',
          ].join(' ')}
          data-testid="membership-plan-card"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/70">
                Membership Plan
              </p>
              <h3 className="mt-2 break-words text-xl font-semibold tracking-tight text-white">
                {plan.plan_name}
              </h3>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <FieldPill enabled>{formatPrice(plan.plan_price ?? null)}</FieldPill>
                <FieldPill enabled={false}>{benefits.length} benefits</FieldPill>
              </div>
            </div>
            <div className="flex flex-col items-start gap-2 text-right">
              <StatusBadge
                tone={plan.status === 'active' ? 'success' : plan.status === 'archived' ? 'danger' : 'warning'}
              >
                {plan.status}
              </StatusBadge>
              {showParentPlanStatus ? (
                <span className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-slate-400">
                  Parent plan status: {plan.status}
                </span>
              ) : null}
            </div>
          </div>

          {benefits.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-slate-400">
              {canManage ? 'No benefits configured for this plan.' : 'No benefits available.'}
            </div>
          ) : (
            <div className="mt-4 grid gap-3 xl:max-h-[28rem] xl:grid-cols-2 xl:overflow-y-auto xl:pr-2">
              {benefits.map((benefit) => {
                const isExpanded = expandedBenefitId === benefit.id
                const isEditing = editingBenefitId === benefit.id
                const memberPrice = calculateMemberPrice(
                  benefit.price_item?.common_selling_price ?? null,
                  benefit.discount_percent,
                )

                return (
                  <div
                    key={benefit.id}
                    className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4"
                    data-testid="membership-benefit-row"
                  >
                      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_repeat(3,minmax(0,0.95fr))_auto]">
                      <div className="min-w-0">
                        <button
                          className="text-left text-sm font-semibold text-white transition hover:text-cyan-200"
                          onClick={() => onToggleExpanded(benefit.id)}
                          type="button"
                          data-testid="benefit-item-name"
                        >
                          {benefit.price_item?.item_name ?? 'Unknown item'}
                        </button>
                        <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-500">
                          Category {benefit.price_item?.category ?? '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[0.68rem] uppercase tracking-[0.24em] text-slate-500">
                          Original Common Price
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-100" data-testid="benefit-original-price">
                          {formatPrice(benefit.price_item?.common_selling_price ?? null)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[0.68rem] uppercase tracking-[0.24em] text-slate-500">
                          Discount Percent
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-100" data-testid="benefit-discount">
                          {`${Number(benefit.discount_percent).toFixed(2)}%`}
                        </p>
                      </div>
                      <div>
                        <p className="text-[0.68rem] uppercase tracking-[0.24em] text-slate-500">
                          Final Member Price
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-100" data-testid="benefit-member-price">
                          {formatPrice(memberPrice)}
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
                                      onClick={() => onStartEdit(benefit)}
                                      type="button"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/5"
                                      onClick={() => onArchive(benefit)}
                                      type="button"
                                    >
                                      Archive
                                    </button>
                                    <button
                                      className="block w-full rounded-xl px-3 py-2 text-left text-sm text-rose-100 transition hover:bg-rose-500/10"
                                      onClick={() => onDelete(benefit)}
                                      type="button"
                                    >
                                      Delete
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      className="block w-full rounded-xl px-3 py-2 text-left text-sm text-emerald-100 transition hover:bg-emerald-500/10"
                                      onClick={() => onRestore(benefit)}
                                      type="button"
                                    >
                                      Restore
                                    </button>
                                    <button
                                      className="block w-full rounded-xl px-3 py-2 text-left text-sm text-rose-100 transition hover:bg-rose-500/10"
                                      onClick={() => onDelete(benefit)}
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
                            <BenefitDetailPanel benefit={benefit} />
                          </div>
                        ) : null}

                    {isEditing && editingBenefit ? (
                      <div className="mt-4">
                        <MembershipBenefitForm
                          key={editingBenefit.id}
                          description="Update the membership benefit in Supabase. Changes save immediately."
                          error={editingError}
                          initialValues={membershipBenefitToFormValues(editingBenefit)}
                          isSubmitting={editingSubmitting}
                          membershipPlans={membershipPlans}
                          onCancel={onCancelEdit}
                          onSubmit={onSubmitEdit}
                          priceItems={priceItems}
                          submitLabel="Save changes"
                          title="Edit benefit"
                          variant="inline"
                        />
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </article>
      )}
    />
  )
}

export function MembershipBenefitsPage({
  pageVariant = 'internal',
}: {
  pageVariant?: 'public' | 'internal'
}) {
  const { status, accessLevel, authUser, employee, customer } = useAuth()
  const isPublicVariant = pageVariant === 'public'
  const isStaffViewer =
    pageVariant === 'internal' && (accessLevel === 'management' || accessLevel === 'employee')

  const [membershipBenefits, setMembershipBenefits] = useState<MembershipBenefitRecord[]>([])
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
  const [editingBenefitId, setEditingBenefitId] = useState<string | null>(null)
  const [editingError, setEditingError] = useState<string | null>(null)
  const [editingSubmitting, setEditingSubmitting] = useState(false)
  const [expandedBenefitId, setExpandedBenefitId] = useState<string | null>(null)
  const [actionTargetId, setActionTargetId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [archivePage, setArchivePage] = useState(1)

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      setLoading(true)
      setPageError(null)

      try {
        const [benefitData, planData, priceItemData] = await Promise.all([
          fetchMembershipBenefits(),
          fetchMembershipBenefitPlans(),
          fetchMembershipBenefitPriceItems(),
        ])

        if (!isMounted) {
          return
        }

        setMembershipBenefits(benefitData)
        setMembershipPlans(planData)
        setPriceItems(priceItemData)
      } catch (error) {
        if (!isMounted) {
          return
        }

        const message =
          error instanceof Error ? error.message : 'Unable to load membership benefits.'
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
          Membership Benefits
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Loading membership benefits</h1>
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

  const visibleMembershipBenefits = membershipBenefits.filter((benefit) =>
    isVisibleMembershipBenefit(benefit, audience),
  )

  const currentMembershipBenefits = sortCurrentMembershipBenefits(visibleMembershipBenefits)

  const archivedMembershipBenefits = sortArchivedMembershipBenefitsOnly(visibleMembershipBenefits)

  const currentBenefitPlanCards = buildMembershipBenefitPlanCards({
    plans: membershipPlans,
    benefits: currentMembershipBenefits,
    includeEmptyPlans: canManage,
  })
  const archivedBenefitPlanCards = buildMembershipBenefitPlanCards({
    plans: membershipPlans,
    benefits: archivedMembershipBenefits,
    includeEmptyPlans: false,
  })

  const currentTotalPages = Math.max(1, Math.ceil(currentBenefitPlanCards.length / ROWS_PER_PAGE))
  const currentDisplayPage = Math.min(currentPage, currentTotalPages)
  const pagedCurrentMembershipBenefits = currentBenefitPlanCards.slice(
    (currentDisplayPage - 1) * ROWS_PER_PAGE,
    currentDisplayPage * ROWS_PER_PAGE,
  )

  const archiveTotalPages = Math.max(1, Math.ceil(archivedBenefitPlanCards.length / ROWS_PER_PAGE))
  const archiveDisplayPage = Math.min(archivePage, archiveTotalPages)
  const pagedArchivedMembershipBenefits = archivedBenefitPlanCards.slice(
    (archiveDisplayPage - 1) * ROWS_PER_PAGE,
    archiveDisplayPage * ROWS_PER_PAGE,
  )

  const editingBenefit =
    editingBenefitId === null
      ? null
      : membershipBenefits.find((benefit) => benefit.id === editingBenefitId) ?? null

  const planOptions = membershipPlans
  const priceItemOptions = priceItems

  function showBanner(message: string, tone: 'success' | 'error') {
    setBannerMessage(message)
    setBannerTone(tone)
  }

  function syncBenefit(updatedBenefit: MembershipBenefitRecord) {
    setMembershipBenefits((current) => {
      const nextBenefits = current.some((benefit) => benefit.id === updatedBenefit.id)
        ? current.map((benefit) =>
            benefit.id === updatedBenefit.id ? updatedBenefit : benefit,
          )
        : [updatedBenefit, ...current]

      return sortMembershipBenefits(nextBenefits.filter((benefit) => benefit.deleted_at === null))
    })
  }

  function removeBenefit(benefitId: string) {
    setMembershipBenefits((current) => current.filter((benefit) => benefit.id !== benefitId))
  }

  function beginCreate() {
    setCreateVisible(true)
    setEditingBenefitId(null)
    setEditingError(null)
    setBannerMessage(null)
    setCreateError(null)
    setCreateRevision((current) => current + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function beginEdit(benefit: MembershipBenefitRecord) {
    setEditingBenefitId(benefit.id)
    setCreateVisible(false)
    setCreateError(null)
    setEditingError(null)
    setBannerMessage(null)
    setExpandedBenefitId(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingBenefitId(null)
    setEditingError(null)
  }

  function cancelCreate() {
    setCreateVisible(false)
    setCreateError(null)
  }

  async function handleCreate(values: MembershipBenefitFormValues) {
    setCreateSubmitting(true)
    setCreateError(null)
    setBannerMessage(null)

    try {
      const created = await createMembershipBenefit(values)
      syncBenefit(created)
      cancelCreate()
      setExpandedBenefitId(created.id)
      showBanner('Created membership benefit.', 'success')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to create membership benefit.'
      setCreateError(message)
      showBanner(message, 'error')
    } finally {
      setCreateSubmitting(false)
    }
  }

  async function handleEdit(values: MembershipBenefitFormValues) {
    if (!editingBenefitId) {
      return
    }

    setEditingSubmitting(true)
    setEditingError(null)
    setBannerMessage(null)

    try {
      const updated = await updateMembershipBenefit(editingBenefitId, values)
      syncBenefit(updated)
      setEditingBenefitId(null)
      setExpandedBenefitId(updated.id)
      showBanner('Updated membership benefit.', 'success')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to update membership benefit.'
      setEditingError(message)
      showBanner(message, 'error')
    } finally {
      setEditingSubmitting(false)
    }
  }

  async function handleArchive(benefit: MembershipBenefitRecord) {
    setActionTargetId(benefit.id)
    setBannerMessage(null)

    try {
      const updated = await archiveMembershipBenefit(benefit.id)
      syncBenefit(updated)
      if (editingBenefitId === benefit.id) {
        cancelEdit()
      }
      showBanner('Archived membership benefit.', 'success')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to archive membership benefit.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  async function handleRestore(benefit: MembershipBenefitRecord) {
    const confirmed = window.confirm('Restore this membership benefit back to active status?')

    if (!confirmed) {
      return
    }

    setActionTargetId(benefit.id)
    setBannerMessage(null)

    try {
      const updated = await restoreMembershipBenefit(benefit.id)
      syncBenefit(updated)
      showBanner('Restored membership benefit.', 'success')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to restore membership benefit.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  async function handleDelete(benefit: MembershipBenefitRecord) {
    const confirmed = window.confirm(
      'Soft delete this membership benefit? This will remove it from all lists.',
    )

    if (!confirmed) {
      return
    }

    setActionTargetId(benefit.id)
    setBannerMessage(null)

    try {
      await softDeleteMembershipBenefit(benefit.id)
      removeBenefit(benefit.id)
      if (editingBenefitId === benefit.id) {
        cancelEdit()
      }
      if (expandedBenefitId === benefit.id) {
        setExpandedBenefitId(null)
      }
      showBanner('Deleted membership benefit.', 'success')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to delete membership benefit.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  if (loading) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Membership Benefits
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Loading membership benefits</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Fetching membership benefits from Supabase.
        </p>
      </section>
    )
  }

  if (pageError) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Membership Benefits
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Unable to load membership benefits
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
              Membership Benefits
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Membership Benefits Control Center
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Benefit rows are sourced from Supabase and calculated in the UI.{' '}
              {isStaffViewer
                ? `Current view is limited to ${accessLabel(activeAccessLevel)} access.`
                : 'Public catalog view.'}
            </p>
          </div>

          <div className="grid gap-3 sm:text-right">
            <FieldPill enabled={false}>{currentBenefitPlanCards.length} current</FieldPill>
            {isStaffViewer ? (
              canManage ? (
                <FieldPill enabled={false}>{archivedBenefitPlanCards.length} archived</FieldPill>
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
          <MembershipBenefitForm
            key={createRevision}
            description="Create a membership benefit in Supabase. The database enforces unique plan + price item combinations."
            error={createError}
            isSubmitting={createSubmitting}
            membershipPlans={planOptions}
            onCancel={cancelCreate}
            onSubmit={handleCreate}
            priceItems={priceItemOptions}
            submitLabel="Create Benefit"
            title="Create membership benefit"
          />
        ) : (
          <div className="flex justify-end">
            <button
              className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              onClick={beginCreate}
              type="button"
            >
              Create Benefit
            </button>
          </div>
        )
      ) : null}

      <MembershipBenefitCardDeck
        accessLevel={activeAccessLevel}
        actionTargetId={actionTargetId}
        editingBenefit={editingBenefit}
        editingBenefitId={editingBenefitId}
        editingError={editingError}
        editingSubmitting={editingSubmitting}
        membershipPlans={planOptions}
        priceItems={priceItemOptions}
        expandedBenefitId={expandedBenefitId}
        onArchive={handleArchive}
        onCancelEdit={cancelEdit}
        onDelete={handleDelete}
        onRestore={handleRestore}
        onStartEdit={beginEdit}
        onSubmitEdit={handleEdit}
        onToggleExpanded={(benefitId) =>
          setExpandedBenefitId((current) => (current === benefitId ? null : benefitId))
        }
        cards={pagedCurrentMembershipBenefits}
        showActions={activeAccessLevel === 'management'}
        showArchiveActions={false}
        showParentPlanStatus={isStaffViewer}
        title={
          isStaffViewer ? 'Current membership benefits' : 'Active membership benefits'
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          {currentBenefitPlanCards.length === 0
            ? !isStaffViewer
              ? 'No active membership benefits are available.'
              : 'No current membership benefits match the active filters.'
            : `Showing ${Math.min((currentDisplayPage - 1) * ROWS_PER_PAGE + 1, currentBenefitPlanCards.length)} to ${Math.min(currentDisplayPage * ROWS_PER_PAGE, currentBenefitPlanCards.length)} of ${currentBenefitPlanCards.length}.`}
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

      {canManage && archivedBenefitPlanCards.length > 0 ? (
        <>
          <MembershipBenefitCardDeck
            accessLevel="management"
            actionTargetId={actionTargetId}
            editingBenefit={null}
            editingBenefitId={null}
            editingError={null}
            editingSubmitting={false}
            membershipPlans={planOptions}
            expandedBenefitId={expandedBenefitId}
            onArchive={handleArchive}
            onCancelEdit={cancelEdit}
            onDelete={handleDelete}
            onRestore={handleRestore}
            onStartEdit={beginEdit}
            onSubmitEdit={handleEdit}
            priceItems={priceItemOptions}
            onToggleExpanded={(benefitId) =>
              setExpandedBenefitId((current) => (current === benefitId ? null : benefitId))
            }
            cards={pagedArchivedMembershipBenefits}
            showActions
            showArchiveActions
            showParentPlanStatus
            title="Archived membership benefits"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-400">
              {archivedBenefitPlanCards.length === 0
                ? 'No archived membership benefits available.'
                : `Showing ${Math.min((archiveDisplayPage - 1) * ROWS_PER_PAGE + 1, archivedBenefitPlanCards.length)} to ${Math.min(archiveDisplayPage * ROWS_PER_PAGE, archivedBenefitPlanCards.length)} of ${archivedBenefitPlanCards.length}.`}
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
          Saving membership benefit changes.
        </div>
      ) : null}
    </section>
  )
}
