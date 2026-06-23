import { Fragment, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../../auth/useAuth'
import type { CustomerRecord } from '../../auth/types'
import { CustomerCsvImport } from '../../components/customers/CustomerCsvImport'
import { ActionMenu } from '../../components/ui/ActionMenu'
import { CustomerForm } from '../../components/customers/CustomerForm'
import {
  archiveCustomer,
  createCustomer,
  customerToFormValues,
  fetchCustomers,
  restoreCustomer,
  softDeleteCustomer,
  sortArchivedCustomersOnly,
  sortCurrentCustomers,
  sortCustomers,
  updateCustomer,
  type CustomerFormValues,
} from '../../lib/customers'
import { importCustomerCsvRows } from '../../lib/customerCsvImport'

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

function CustomerStatusBadge({ status }: { status: CustomerRecord['status'] }) {
  const toneMap: Record<CustomerRecord['status'], { tone: 'success' | 'warning' | 'neutral' | 'danger'; label: string }> = {
    active: { tone: 'success', label: 'Active' },
    inactive: { tone: 'warning', label: 'Inactive' },
    archived: { tone: 'danger', label: 'Archived' },
  }

  const badge = toneMap[status]
  return <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
}

function CustomerDetailPanel({
  customer,
  showNotes = true,
}: {
  customer: CustomerRecord
  showNotes?: boolean
}) {
  return (
    <div className="grid gap-4 rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-4 sm:p-5 lg:grid-cols-2">
      <div className="grid gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Character Name
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{customer.character_name}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Citizen ID
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{customer.citizen_id}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Phone Number
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{customer.phone_number ?? '-'}</p>
        </div>
      </div>

      <div className="grid gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Discord Username
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {customer.discord_username ?? '-'}
          </p>
        </div>
        {showNotes ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Notes
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-200">{customer.notes ?? '-'}</p>
          </div>
        ) : null}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Status
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            <CustomerStatusBadge status={customer.status} />
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Created At
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{formatDate(customer.created_at)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Updated At
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{formatDate(customer.updated_at)}</p>
        </div>
      </div>
    </div>
  )
}

function CustomerTable({
  title,
  customers,
  accessLevel,
  expandedCustomerId,
  onToggleExpanded,
  onStartEdit,
  onArchive,
  onRestore,
  onDelete,
  showArchiveActions = false,
  editingCustomerId,
  editingCustomer,
  editingError,
  editingSubmitting,
  onSubmitEdit,
  onCancelEdit,
  actionTargetId,
  showActions,
}: {
  title: string
  customers: CustomerRecord[]
  accessLevel: 'management' | 'employee'
  expandedCustomerId: string | null
  onToggleExpanded: (customerId: string) => void
  onStartEdit: (customer: CustomerRecord) => void
  onArchive: (customer: CustomerRecord) => void
  onRestore: (customer: CustomerRecord) => void
  onDelete: (customer: CustomerRecord) => void
  showArchiveActions?: boolean
  editingCustomerId: string | null
  editingCustomer: CustomerRecord | null
  editingError: string | null
  editingSubmitting: boolean
  onSubmitEdit: (values: CustomerFormValues) => Promise<void>
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
            {customers.length} {customers.length === 1 ? 'customer' : 'customers'}
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
              <th className="border-b border-white/10 px-4 py-3">Character Name</th>
              <th className="border-b border-white/10 px-4 py-3">Citizen ID</th>
              <th className="border-b border-white/10 px-4 py-3">Phone Number</th>
              <th className="border-b border-white/10 px-4 py-3">Discord Username</th>
              <th className="border-b border-white/10 px-4 py-3">Status</th>
              {showActions ? <th className="border-b border-white/10 px-4 py-3">Actions</th> : null}
            </tr>
          </thead>

          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-sm text-slate-400" colSpan={showActions ? 6 : 5}>
                  No customers found.
                </td>
              </tr>
            ) : (
              customers.map((customer) => {
                const isExpanded = expandedCustomerId === customer.id
                const isEditing = editingCustomerId === customer.id

                return (
                  <Fragment key={customer.id}>
                    <tr className="align-top">
                      <td className="border-b border-white/5 px-4 py-4">
                        <button
                          className="text-left text-sm font-semibold text-white transition hover:text-cyan-200"
                          onClick={() => onToggleExpanded(customer.id)}
                          type="button"
                        >
                          {customer.character_name}
                        </button>
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {customer.citizen_id}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {customer.phone_number ?? '-'}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4 text-sm text-slate-200">
                        {customer.discord_username ?? '-'}
                      </td>
                      <td className="border-b border-white/5 px-4 py-4">
                        <CustomerStatusBadge status={customer.status} />
                      </td>
                      {showActions ? (
                        <td className="border-b border-white/5 px-4 py-4">
                        {canManage ? (
                            <ActionMenu triggerLabel="Actions">
                                {!showArchiveActions ? (
                                  <>
                                    <button
                                      className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/5"
                                      onClick={() => onStartEdit(customer)}
                                      type="button"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/5"
                                      onClick={() => onArchive(customer)}
                                      type="button"
                                    >
                                      Archive
                                    </button>
                                    <button
                                      className="block w-full rounded-xl px-3 py-2 text-left text-sm text-rose-100 transition hover:bg-rose-500/10"
                                      onClick={() => onDelete(customer)}
                                      type="button"
                                    >
                                      Delete
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      className="block w-full rounded-xl px-3 py-2 text-left text-sm text-emerald-100 transition hover:bg-emerald-500/10"
                                      onClick={() => onRestore(customer)}
                                      type="button"
                                    >
                                      Restore
                                    </button>
                                    <button
                                      className="block w-full rounded-xl px-3 py-2 text-left text-sm text-rose-100 transition hover:bg-rose-500/10"
                                      onClick={() => onDelete(customer)}
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
                        <td className="border-b border-white/5 px-4 pb-5 pt-0" colSpan={showActions ? 6 : 5}>
                          <CustomerDetailPanel customer={customer} />
                        </td>
                      </tr>
                    ) : null}

                    {isEditing && editingCustomer ? (
                      <tr>
                        <td className="border-b border-white/5 px-4 pb-5 pt-0" colSpan={showActions ? 6 : 5}>
                          <CustomerForm
                            key={editingCustomer.id}
                            description="Update the customer profile in Supabase. Changes save immediately."
                            error={editingError}
                            initialValues={customerToFormValues(editingCustomer)}
                            isSubmitting={editingSubmitting}
                            onCancel={onCancelEdit}
                            onSubmit={onSubmitEdit}
                            submitLabel="Save changes"
                            title="Edit customer"
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
          Saving customer changes.
        </div>
      ) : null}
    </section>
  )
}

export function CustomersPage() {
  const { accessLevel, authUser, customer } = useAuth()

  const activeAccessLevel = accessLevel ?? 'customer'
  const [customers, setCustomers] = useState<CustomerRecord[]>([])
  const [loading, setLoading] = useState(activeAccessLevel !== 'customer')
  const [pageError, setPageError] = useState<string | null>(null)
  const [bannerMessage, setBannerMessage] = useState<string | null>(null)
  const [bannerTone, setBannerTone] = useState<'success' | 'error' | 'warning' | null>(null)
  const [createVisible, setCreateVisible] = useState(false)
  const [importVisible, setImportVisible] = useState(false)
  const [createRevision, setCreateRevision] = useState(0)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null)
  const [editingError, setEditingError] = useState<string | null>(null)
  const [editingSubmitting, setEditingSubmitting] = useState(false)
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null)
  const [actionTargetId, setActionTargetId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
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
        const customerData = await fetchCustomers()

        if (!isMounted) {
          return
        }

        setCustomers(customerData)
      } catch (error) {
        if (!isMounted) {
          return
        }

        const message = error instanceof Error ? error.message : 'Unable to load customers.'
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
    characterName: customer?.character_name ?? null,
  })
  const existingCitizenIds = useMemo(
    () => customers.map((record) => record.citizen_id),
    [customers],
  )
  const searchTerm = searchQuery.trim().toLowerCase()

  const currentCustomers = sortCurrentCustomers(customers).filter((record) => {
    if (activeAccessLevel === 'customer') {
      return false
    }

    return (
      record.character_name.toLowerCase().includes(searchTerm) &&
      (statusFilter === 'all' ? true : record.status === statusFilter)
    )
  })

  const archivedCustomers = sortArchivedCustomersOnly(customers).filter((record) =>
    record.character_name.toLowerCase().includes(searchTerm),
  )

  const currentTotalPages = Math.max(1, Math.ceil(currentCustomers.length / ROWS_PER_PAGE))
  const currentDisplayPage = Math.min(currentPage, currentTotalPages)
  const pagedCurrentCustomers = currentCustomers.slice(
    (currentDisplayPage - 1) * ROWS_PER_PAGE,
    currentDisplayPage * ROWS_PER_PAGE,
  )

  const archiveTotalPages = Math.max(1, Math.ceil(archivedCustomers.length / ROWS_PER_PAGE))
  const archiveDisplayPage = Math.min(archivePage, archiveTotalPages)
  const pagedArchivedCustomers = archivedCustomers.slice(
    (archiveDisplayPage - 1) * ROWS_PER_PAGE,
    archiveDisplayPage * ROWS_PER_PAGE,
  )

  const editingCustomer =
    editingCustomerId === null ? null : customers.find((record) => record.id === editingCustomerId) ?? null

  function showBanner(message: string, tone: 'success' | 'error' | 'warning') {
    setBannerMessage(message)
    setBannerTone(tone)
  }

  function syncCustomer(updatedCustomer: CustomerRecord) {
    setCustomers((current) => {
      const nextCustomers = current.some((record) => record.id === updatedCustomer.id)
        ? current.map((record) => (record.id === updatedCustomer.id ? updatedCustomer : record))
        : [updatedCustomer, ...current]

      return sortCustomers(nextCustomers.filter((record) => record.deleted_at === null))
    })
  }

  function removeCustomer(customerId: string) {
    setCustomers((current) => current.filter((record) => record.id !== customerId))
  }

  function beginCreate() {
    setCreateVisible(true)
    setImportVisible(false)
    setEditingCustomerId(null)
    setCreateError(null)
    setEditingError(null)
    setBannerMessage(null)
    setCreateRevision((current) => current + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function beginEdit(record: CustomerRecord) {
    setEditingCustomerId(record.id)
    setCreateVisible(false)
    setImportVisible(false)
    setCreateError(null)
    setEditingError(null)
    setBannerMessage(null)
    setExpandedCustomerId(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingCustomerId(null)
    setEditingError(null)
  }

  function cancelCreate() {
    setCreateVisible(false)
    setCreateError(null)
  }

  function beginImport() {
    setImportVisible(true)
    setCreateVisible(false)
    setEditingCustomerId(null)
    setCreateError(null)
    setEditingError(null)
    setBannerMessage(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelImport() {
    setImportVisible(false)
  }

  async function handleCreate(values: CustomerFormValues) {
    setCreateSubmitting(true)
    setCreateError(null)
    setBannerMessage(null)

    try {
      const created = await createCustomer(values)
      syncCustomer(created)
      cancelCreate()
      setExpandedCustomerId(created.id)
      showBanner('Created customer.', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create customer.'
      setCreateError(message)
      showBanner(message, 'error')
    } finally {
      setCreateSubmitting(false)
    }
  }

  async function handleCsvImport(rows: Parameters<typeof importCustomerCsvRows>[0]) {
    setBannerMessage(null)

    const result = await importCustomerCsvRows(rows)

    result.insertedCustomers.forEach((record) => {
      syncCustomer(record)
    })

    if (result.insertedCount > 0) {
      setExpandedCustomerId(result.insertedCustomers[0]?.id ?? null)
    }

    setImportVisible(false)

    showBanner(
      `Imported ${result.insertedCount} customer${result.insertedCount === 1 ? '' : 's'}; ${result.skippedCount} skipped; ${result.failedCount} failed.`,
      result.failedCount > 0 ? 'warning' : 'success',
    )

    return result
  }

  async function handleEdit(values: CustomerFormValues) {
    if (!editingCustomerId) {
      return
    }

    setEditingSubmitting(true)
    setEditingError(null)
    setBannerMessage(null)

    try {
      const updated = await updateCustomer(editingCustomerId, values)
      syncCustomer(updated)
      setEditingCustomerId(null)
      setExpandedCustomerId(updated.id)
      showBanner('Updated customer.', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update customer.'
      setEditingError(message)
      showBanner(message, 'error')
    } finally {
      setEditingSubmitting(false)
    }
  }

  async function handleArchive(record: CustomerRecord) {
    setActionTargetId(record.id)
    setBannerMessage(null)

    try {
      const updated = await archiveCustomer(record.id)
      syncCustomer(updated)
      if (editingCustomerId === record.id) {
        cancelEdit()
      }
      showBanner('Archived customer.', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to archive customer.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  async function handleRestore(record: CustomerRecord) {
    const confirmed = window.confirm('Restore this customer back to active status?')

    if (!confirmed) {
      return
    }

    setActionTargetId(record.id)
    setBannerMessage(null)

    try {
      const updated = await restoreCustomer(record.id)
      syncCustomer(updated)
      showBanner('Restored customer.', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to restore customer.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  async function handleDelete(record: CustomerRecord) {
    const confirmed = window.confirm('Soft delete this customer? This will remove it from all lists.')

    if (!confirmed) {
      return
    }

    setActionTargetId(record.id)
    setBannerMessage(null)

    try {
      await softDeleteCustomer(record.id)
      removeCustomer(record.id)
      if (editingCustomerId === record.id) {
        cancelEdit()
      }
      if (expandedCustomerId === record.id) {
        setExpandedCustomerId(null)
      }
      showBanner('Deleted customer.', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete customer.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  if (loading) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Customers
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Loading customers</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">Fetching customers from Supabase.</p>
      </section>
    )
  }

  if (pageError) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Customers
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Unable to load customers</h1>
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

  if (activeAccessLevel === 'customer') {
    if (!customer) {
      return (
        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
            Customers
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Customer profile not available
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            This portal account does not have a linked customer profile. Contact management to
            complete portal setup.
          </p>
        </section>
      )
    }

    return (
      <section className="space-y-6">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
                Customers
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Your Customer Profile
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                You are viewing the customer profile linked to {currentUser}.
              </p>
            </div>
            <FieldPill enabled>{currentUser}</FieldPill>
          </div>
        </div>

        <CustomerDetailPanel customer={customer} showNotes={false} />
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
              Customers
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Customers Control Center
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Customer rows are sourced from Supabase. Management can edit records here; employees
              have read-only access.
            </p>
          </div>

          <div className="grid gap-3 sm:text-right">
            <FieldPill enabled={false}>{currentCustomers.length} current</FieldPill>
            {canManage ? (
              <FieldPill enabled={false}>{archivedCustomers.length} archived</FieldPill>
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
              : bannerTone === 'warning'
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-100',
          ].join(' ')}
        >
          {bannerMessage}
        </div>
      ) : null}

      {canManage ? (
        <div className="space-y-4">
          <div className="flex flex-wrap justify-end gap-3">
            <button
              className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-slate-900"
              onClick={beginCreate}
              type="button"
            >
              Create Customer
            </button>
            <button
              className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              onClick={beginImport}
              type="button"
            >
              Import CSV
            </button>
          </div>

          {createVisible ? (
            <CustomerForm
              key={createRevision}
              description="Create a customer profile in Supabase. Citizen ID is unique when enforced by the database."
              error={createError}
              isSubmitting={createSubmitting}
              onCancel={cancelCreate}
              onSubmit={handleCreate}
              submitLabel="Create Customer"
              title="Create customer"
            />
          ) : null}

          {importVisible ? (
            <CustomerCsvImport
              existingCitizenIds={existingCitizenIds}
              onClose={cancelImport}
              onConfirmImport={handleCsvImport}
            />
          ) : null}
        </div>
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
              Search by Name
            </span>
            <input
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
              onChange={(event) => {
                setSearchQuery(event.target.value)
                setCurrentPage(1)
                setArchivePage(1)
              }}
              placeholder="Search customers"
              value={searchQuery}
            />
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

      <CustomerTable
        accessLevel={activeAccessLevel as 'management' | 'employee'}
        actionTargetId={actionTargetId}
        editingCustomer={editingCustomer}
        editingCustomerId={editingCustomerId}
        editingError={editingError}
        editingSubmitting={editingSubmitting}
        expandedCustomerId={expandedCustomerId}
        onArchive={handleArchive}
        onCancelEdit={cancelEdit}
        onDelete={handleDelete}
        onRestore={handleRestore}
        onStartEdit={beginEdit}
        onSubmitEdit={handleEdit}
        onToggleExpanded={(customerId) =>
          setExpandedCustomerId((current) => (current === customerId ? null : customerId))
        }
        customers={pagedCurrentCustomers}
        showActions={canManage}
        showArchiveActions={false}
        title="Current customers"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          {currentCustomers.length === 0
            ? 'No current customers match the active filters.'
            : `Showing ${Math.min((currentDisplayPage - 1) * ROWS_PER_PAGE + 1, currentCustomers.length)} to ${Math.min(currentDisplayPage * ROWS_PER_PAGE, currentCustomers.length)} of ${currentCustomers.length}.`}
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

      {canManage && archivedCustomers.length > 0 ? (
        <>
          <CustomerTable
            accessLevel="management"
            actionTargetId={actionTargetId}
            editingCustomer={null}
            editingCustomerId={null}
            editingError={null}
            editingSubmitting={false}
            expandedCustomerId={expandedCustomerId}
            onArchive={handleArchive}
            onCancelEdit={cancelEdit}
            onDelete={handleDelete}
            onRestore={handleRestore}
            onStartEdit={beginEdit}
            onSubmitEdit={handleEdit}
            onToggleExpanded={(customerId) =>
              setExpandedCustomerId((current) => (current === customerId ? null : customerId))
            }
            customers={pagedArchivedCustomers}
            showActions
            showArchiveActions
            title="Archived customers"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-400">
              {archivedCustomers.length === 0
                ? 'No archived customers available.'
                : `Showing ${Math.min((archiveDisplayPage - 1) * ROWS_PER_PAGE + 1, archivedCustomers.length)} to ${Math.min(archiveDisplayPage * ROWS_PER_PAGE, archivedCustomers.length)} of ${archivedCustomers.length}.`}
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
          Saving customer changes.
        </div>
      ) : null}
    </section>
  )
}
