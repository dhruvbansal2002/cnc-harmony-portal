import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { ActionMenu } from '../../components/ui/ActionMenu'
import { publicRouteDefinitions } from '../../routes/navigation'
import {
  archiveAnnouncement,
  announcementToFormValues,
  createAnnouncement,
  createEmptyAnnouncementFormValues,
  fetchAnnouncements,
  restoreAnnouncement,
  softDeleteAnnouncement,
  updateAnnouncement,
  type AnnouncementAudience,
  type AnnouncementFormValues,
  type AnnouncementRecord,
} from '../../lib/announcements'

type AnnouncementPageVariant = 'public' | 'internal'

const publicQuickLinks = [
  ...publicRouteDefinitions,
  { path: '/login', navLabel: 'Staff Login' },
]

function formatDate(value: string | null) {
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
  }).format(parsed)
}

function StatusBadge({
  tone,
  children,
}: {
  tone: 'success' | 'warning' | 'neutral' | 'danger' | 'accent'
  children: ReactNode
}) {
  const toneClasses: Record<typeof tone, string> = {
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
    neutral: 'border-white/10 bg-white/5 text-slate-200',
    danger: 'border-rose-500/30 bg-rose-500/10 text-rose-100',
    accent: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] ${toneClasses[tone]}`}
    >
      {children}
    </span>
  )
}

function audienceTone(audience: AnnouncementAudience) {
  switch (audience) {
    case 'public':
      return 'accent'
    case 'employee':
      return 'success'
    case 'management':
      return 'warning'
    case 'all':
      return 'neutral'
    default:
      return 'neutral'
  }
}

function statusTone(status: AnnouncementRecord['status']) {
  switch (status) {
    case 'active':
      return 'success'
    case 'inactive':
      return 'warning'
    case 'archived':
      return 'danger'
    default:
      return 'neutral'
  }
}

function isCurrentAnnouncement(record: AnnouncementRecord) {
  return record.deleted_at === null && record.archived_at === null
}

function isArchivedAnnouncement(record: AnnouncementRecord) {
  return record.deleted_at === null && record.archived_at !== null
}

function isPublicVisibleAnnouncement(record: AnnouncementRecord) {
  return (
    isCurrentAnnouncement(record) &&
    record.status === 'active' &&
    (record.audience === 'public' || record.audience === 'all')
  )
}

function isEmployeeVisibleAnnouncement(record: AnnouncementRecord) {
  return (
    isCurrentAnnouncement(record) &&
    (record.audience === 'employee' || record.audience === 'all')
  )
}

function AnnouncementForm({
  title,
  description,
  initialValues,
  error,
  isSubmitting,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  title: string
  description: string
  initialValues: AnnouncementFormValues
  error: string | null
  isSubmitting: boolean
  submitLabel: string
  onCancel: () => void
  onSubmit: (values: AnnouncementFormValues) => Promise<void>
}) {
  const [values, setValues] = useState<AnnouncementFormValues>(initialValues)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setValues(initialValues)
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [initialValues])

  return (
    <form
      className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-4 shadow-2xl shadow-black/30 backdrop-blur sm:p-5"
      onSubmit={async (event) => {
        event.preventDefault()
        await onSubmit(values)
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">
            Announcements
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
        </div>
        <button
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-white/10"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-200">
            Title <span className="text-cyan-200">*</span>
          </span>
          <input
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
            onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))}
            value={values.title}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-200">
            Audience <span className="text-cyan-200">*</span>
          </span>
          <select
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                audience: event.target.value as AnnouncementAudience,
              }))
            }
            value={values.audience}
          >
            <option value="public">Public</option>
            <option value="employee">Employee</option>
            <option value="management">Management</option>
            <option value="all">All</option>
          </select>
        </label>

        <label className="block space-y-2 lg:col-span-2">
          <span className="text-sm font-medium text-slate-200">
            Body <span className="text-cyan-200">*</span>
          </span>
          <textarea
            className="min-h-36 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm leading-6 text-slate-100 outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
            onChange={(event) => setValues((current) => ({ ...current, body: event.target.value }))}
            value={values.body}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-200">
            Status <span className="text-cyan-200">*</span>
          </span>
          <select
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                status: event.target.value as AnnouncementFormValues['status'],
              }))
            }
            value={values.status}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
          </select>
        </label>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
        <button
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSubmitting}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        <button
          className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  )
}

function AnnouncementCard({
  announcement,
  canManage,
  showAudience,
  isEditing,
  editingForm,
  onToggleEdit,
  onArchive,
  onRestore,
  onDelete,
}: {
  announcement: AnnouncementRecord
  canManage: boolean
  showAudience: boolean
  isEditing: boolean
  editingForm: ReactNode | null
  onToggleEdit: () => void
  onArchive: () => void
  onRestore: () => void
  onDelete: () => void
}) {
  const isArchived = isArchivedAnnouncement(announcement)

  return (
    <article
      className="group rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/20 backdrop-blur"
      data-testid="announcement-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-xl font-semibold tracking-tight text-white">
            {announcement.title}
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {showAudience ? (
              <StatusBadge tone={audienceTone(announcement.audience)}>
                {announcement.audience}
              </StatusBadge>
            ) : null}
            {showAudience ? (
              <StatusBadge tone={statusTone(announcement.status)}>
                {announcement.status}
              </StatusBadge>
            ) : null}
          </div>
        </div>

        {canManage ? (
          <ActionMenu triggerLabel="Actions">
            {!isArchived ? (
              <>
                <button
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/5"
                  onClick={onToggleEdit}
                  type="button"
                >
                  Edit
                </button>
                <button
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/5"
                  onClick={onArchive}
                  type="button"
                >
                  Archive
                </button>
                <button
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm text-rose-100 transition hover:bg-rose-500/10"
                  onClick={onDelete}
                  type="button"
                >
                  Delete
                </button>
              </>
            ) : (
              <>
                <button
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm text-emerald-100 transition hover:bg-emerald-500/10"
                  onClick={onRestore}
                  type="button"
                >
                  Restore
                </button>
                <button
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm text-rose-100 transition hover:bg-rose-500/10"
                  onClick={onDelete}
                  type="button"
                >
                  Delete
                </button>
              </>
            )}
          </ActionMenu>
        ) : null}
      </div>

      <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
        <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">
          {announcement.body}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-xs uppercase tracking-[0.22em] text-slate-500">
        <span>Created {formatDate(announcement.created_at)}</span>
        <span>Updated {formatDate(announcement.updated_at)}</span>
      </div>

      {isEditing ? editingForm : null}
    </article>
  )
}

export function AnnouncementsPage({
  pageVariant = 'public',
}: {
  pageVariant?: AnnouncementPageVariant
}) {
  const { status, accessLevel } = useAuth()
  const isPublicVariant = pageVariant === 'public'
  const isInternalVariant = pageVariant === 'internal'
  const isStaffViewer = accessLevel === 'management' || accessLevel === 'employee'
  const canManage = accessLevel === 'management'

  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [bannerMessage, setBannerMessage] = useState<string | null>(null)
  const [bannerTone, setBannerTone] = useState<'success' | 'error' | null>(null)
  const [createVisible, setCreateVisible] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [createRevision, setCreateRevision] = useState(0)
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null)
  const [editingError, setEditingError] = useState<string | null>(null)
  const [editingSubmitting, setEditingSubmitting] = useState(false)
  const [actionTargetId, setActionTargetId] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadAnnouncements() {
      setLoading(true)
      setPageError(null)

      try {
        const data = await fetchAnnouncements()

        if (!isMounted) {
          return
        }

        setAnnouncements(data)
      } catch (error) {
        if (!isMounted) {
          return
        }

        const message = error instanceof Error ? error.message : 'Unable to load announcements.'
        setPageError(message)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void loadAnnouncements()

    return () => {
      isMounted = false
    }
  }, [])

  const visibleCurrentAnnouncements = useMemo(() => {
    if (isPublicVariant) {
      return announcements.filter(isPublicVisibleAnnouncement)
    }

    if (accessLevel === 'employee') {
      return announcements.filter(isEmployeeVisibleAnnouncement)
    }

    return announcements.filter(isCurrentAnnouncement)
  }, [accessLevel, announcements, isPublicVariant])

  const visibleArchivedAnnouncements = useMemo(() => {
    if (!isInternalVariant || !canManage) {
      return []
    }

    return announcements.filter(isArchivedAnnouncement)
  }, [announcements, canManage, isInternalVariant])

  const summary = useMemo(
    () => ({
      current: visibleCurrentAnnouncements.length,
      archived: visibleArchivedAnnouncements.length,
      publicVisible: announcements.filter(isPublicVisibleAnnouncement).length,
    }),
    [announcements, visibleArchivedAnnouncements.length, visibleCurrentAnnouncements.length],
  )

  if (status === 'loading') {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Announcements / Shop Info
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Loading announcements
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">Checking portal access.</p>
      </section>
    )
  }

  if (status === 'ready' && isPublicVariant && isStaffViewer) {
    return <Navigate replace to="/dashboard" />
  }

  if (status === 'ready' && pageVariant === 'public' && accessLevel === 'customer') {
    return <Navigate replace to="/access" />
  }

  if (status === 'setup' || status === 'inactive') {
    return <Navigate replace to="/access" />
  }

  function showBanner(message: string, tone: 'success' | 'error') {
    setBannerMessage(message)
    setBannerTone(tone)
  }

  function syncAnnouncement(updatedAnnouncement: AnnouncementRecord) {
    setAnnouncements((current) => {
      const nextAnnouncements = current.some((announcement) => announcement.id === updatedAnnouncement.id)
        ? current.map((announcement) =>
            announcement.id === updatedAnnouncement.id ? updatedAnnouncement : announcement,
          )
        : [updatedAnnouncement, ...current]

      return nextAnnouncements.filter((announcement) => announcement.deleted_at === null)
    })
  }

  function removeAnnouncement(announcementId: string) {
    setAnnouncements((current) => current.filter((announcement) => announcement.id !== announcementId))
  }

  function beginCreate() {
    setCreateVisible(true)
    setEditingAnnouncementId(null)
    setCreateError(null)
    setEditingError(null)
    setBannerMessage(null)
    setCreateRevision((current) => current + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function beginEdit(announcement: AnnouncementRecord) {
    setEditingAnnouncementId(announcement.id)
    setCreateVisible(false)
    setCreateError(null)
    setEditingError(null)
    setBannerMessage(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingAnnouncementId(null)
    setEditingError(null)
  }

  function cancelCreate() {
    setCreateVisible(false)
    setCreateError(null)
  }

  async function handleCreate(values: AnnouncementFormValues) {
    setCreateSubmitting(true)
    setCreateError(null)
    setBannerMessage(null)

    try {
      const created = await createAnnouncement(values)
      syncAnnouncement(created)
      cancelCreate()
      showBanner('Created announcement.', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create announcement.'
      setCreateError(message)
      showBanner(message, 'error')
    } finally {
      setCreateSubmitting(false)
    }
  }

  async function handleEdit(values: AnnouncementFormValues) {
    if (!editingAnnouncementId) {
      return
    }

    setEditingSubmitting(true)
    setEditingError(null)
    setBannerMessage(null)

    try {
      const updated = await updateAnnouncement(editingAnnouncementId, values)
      syncAnnouncement(updated)
      setEditingAnnouncementId(null)
      showBanner('Updated announcement.', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update announcement.'
      setEditingError(message)
      showBanner(message, 'error')
    } finally {
      setEditingSubmitting(false)
    }
  }

  async function handleArchive(announcement: AnnouncementRecord) {
    setActionTargetId(announcement.id)
    setBannerMessage(null)

    try {
      const updated = await archiveAnnouncement(announcement.id)
      syncAnnouncement(updated)
      if (editingAnnouncementId === announcement.id) {
        cancelEdit()
      }
      showBanner('Archived announcement.', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to archive announcement.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  async function handleRestore(announcement: AnnouncementRecord) {
    setActionTargetId(announcement.id)
    setBannerMessage(null)

    try {
      const updated = await restoreAnnouncement(announcement.id)
      syncAnnouncement(updated)
      showBanner('Restored announcement.', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to restore announcement.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  async function handleDelete(announcement: AnnouncementRecord) {
    const confirmed = window.confirm('Soft delete this announcement? This removes it from lists.')

    if (!confirmed) {
      return
    }

    setActionTargetId(announcement.id)
    setBannerMessage(null)

    try {
      await softDeleteAnnouncement(announcement.id)
      removeAnnouncement(announcement.id)
      if (editingAnnouncementId === announcement.id) {
        cancelEdit()
      }
      showBanner('Deleted announcement.', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete announcement.'
      showBanner(message, 'error')
    } finally {
      setActionTargetId(null)
    }
  }

  if (loading) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Announcements / Shop Info
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Loading announcements</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">Fetching announcements from Supabase.</p>
      </section>
    )
  }

  if (pageError) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Announcements / Shop Info
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Unable to load announcements</h1>
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

  if (isPublicVariant) {
    return (
      <section className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.7fr)]">
          <div className="space-y-6">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
                Announcements / Shop Info
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Welcome to CNC Harmony
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                Public shop announcements and information are shown here without login. Check the
                latest updates, explore the catalog, or head to Staff Login for the internal portal.
              </p>
            </div>

            <section className="rounded-[2rem] border border-white/10 bg-white/5 p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
                    Public Announcements
                  </p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
                    Latest public updates
                  </h2>
                </div>
                <StatusBadge tone="neutral">{summary.publicVisible} visible</StatusBadge>
              </div>

              <div className="mt-6 space-y-4">
                {visibleCurrentAnnouncements.length === 0 ? (
                  <div className="rounded-[1.6rem] border border-dashed border-white/10 bg-slate-950/50 p-6 text-sm text-slate-300">
                    No public announcements are available right now. Check back soon.
                  </div>
                ) : (
                  visibleCurrentAnnouncements.map((announcement) => (
                    <article
                      key={announcement.id}
                      className="rounded-[1.7rem] border border-white/10 bg-slate-950/70 p-5 shadow-lg shadow-black/20"
                    >
                      <h3 className="text-lg font-semibold tracking-tight text-white">
                        {announcement.title}
                      </h3>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-300">
                        {announcement.body}
                      </p>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
                Quick Links
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
                Public catalog pages
              </h2>

              <div className="mt-5 grid gap-3">
                {publicQuickLinks.map((item) => (
                  <Link
                    key={item.path}
                    className="group rounded-[1.4rem] border border-white/10 bg-slate-950/70 p-4 transition hover:border-cyan-400/40 hover:bg-slate-900"
                    to={item.path}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-white transition group-hover:text-cyan-200">
                        {item.navLabel}
                      </span>
                      <span className="text-slate-500 transition group-hover:text-cyan-200">-&gt;</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
                Shop Info
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Announcements, membership information, and the public catalog are maintained in
                Supabase. Staff can use the login button for portal access.
              </p>
            </section>
          </aside>
        </div>
      </section>
    )
  }

  const editingAnnouncement =
    editingAnnouncementId === null
      ? null
      : announcements.find((announcement) => announcement.id === editingAnnouncementId) ?? null

  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
              Announcements
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {canManage ? 'Announcements Control Center' : 'Announcements'}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              {canManage
                ? 'Create, archive, restore, and soft delete announcements from Supabase.'
                : 'Read-only internal announcements for staff.'}
            </p>
          </div>

          <div className="grid gap-3 sm:text-right">
            <StatusBadge tone="neutral">{summary.current} current</StatusBadge>
            {canManage ? <StatusBadge tone="neutral">{summary.archived} archived</StatusBadge> : null}
            <StatusBadge tone={canManage ? 'warning' : 'accent'}>
              {canManage ? 'Management' : 'Employee'}
            </StatusBadge>
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
          <AnnouncementForm
            key={createRevision}
            description="Create an announcement in Supabase. Audience controls who can see it."
            error={createError}
            initialValues={createEmptyAnnouncementFormValues()}
            isSubmitting={createSubmitting}
            onCancel={cancelCreate}
            onSubmit={handleCreate}
            submitLabel="Create Announcement"
            title="Create announcement"
          />
        ) : (
          <div className="flex justify-end">
            <button
              className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              onClick={beginCreate}
              type="button"
            >
              Create Announcement
            </button>
          </div>
        )
      ) : null}

      <div className="grid gap-4">
        {visibleCurrentAnnouncements.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-white/10 bg-white/5 p-8 text-sm text-slate-300 shadow-2xl shadow-cyan-950/10 backdrop-blur">
            {canManage
              ? 'No current announcements are configured yet.'
              : 'No internal announcements are currently available.'}
          </div>
        ) : (
          visibleCurrentAnnouncements.map((announcement) => (
            <AnnouncementCard
              key={announcement.id}
              announcement={announcement}
              canManage={canManage}
              editingForm={
                editingAnnouncement && editingAnnouncement.id === announcement.id ? (
                  <div className="mt-4">
                    <AnnouncementForm
                      description="Update the announcement in Supabase. Changes save immediately."
                      error={editingError}
                      initialValues={announcementToFormValues(editingAnnouncement)}
                      isSubmitting={editingSubmitting}
                      onCancel={cancelEdit}
                      onSubmit={handleEdit}
                      submitLabel="Save changes"
                      title="Edit announcement"
                    />
                  </div>
                ) : null
              }
              isEditing={editingAnnouncementId === announcement.id}
              onArchive={() => void handleArchive(announcement)}
              onDelete={() => void handleDelete(announcement)}
              onRestore={() => void handleRestore(announcement)}
              onToggleEdit={() => beginEdit(announcement)}
              showAudience={true}
            />
          ))
        )}
      </div>

      {canManage && visibleArchivedAnnouncements.length > 0 ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
                Archive
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
                Archived announcements
              </h2>
            </div>
            <StatusBadge tone="neutral">{visibleArchivedAnnouncements.length} archived</StatusBadge>
          </div>

          <div className="grid gap-4">
            {visibleArchivedAnnouncements.map((announcement) => (
              <AnnouncementCard
                key={announcement.id}
                announcement={announcement}
                canManage
                editingForm={null}
                isEditing={false}
                onArchive={() => void handleArchive(announcement)}
                onDelete={() => void handleDelete(announcement)}
                onRestore={() => void handleRestore(announcement)}
                onToggleEdit={() => beginEdit(announcement)}
                showAudience
              />
            ))}
          </div>
        </section>
      ) : null}

      {actionTargetId ? (
        <div className="sr-only" aria-live="polite">
          Saving announcement changes.
        </div>
      ) : null}
    </section>
  )
}
