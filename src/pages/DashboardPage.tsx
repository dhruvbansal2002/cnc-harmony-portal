import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import {
  fetchInternalDashboardMetrics,
  type InternalDashboardMetrics,
} from '../lib/dashboard'
import { getNavigationSections } from '../routes/navigation'

function accessLabel(accessLevel: string | null) {
  return accessLevel === 'management'
    ? 'Management'
    : accessLevel === 'employee'
      ? 'Employee'
      : accessLevel === 'customer'
        ? 'Customer'
        : 'Customer'
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

function formatCount(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return '-'
  }

  return new Intl.NumberFormat('en-US').format(value)
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

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string
  value: number | null | undefined
  detail: string
}) {
  return (
    <div className="rounded-[1.6rem] border border-white/10 bg-slate-950/70 p-5 shadow-lg shadow-black/10">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{formatCount(value)}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
    </div>
  )
}

function QuickLinkCard({
  title,
  path,
  section,
}: {
  title: string
  path: string
  section: string
}) {
  return (
    <Link
      className="group rounded-[1.6rem] border border-white/10 bg-slate-950/70 p-4 transition hover:border-cyan-400/40 hover:bg-slate-900"
      to={path}
    >
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">
        {section}
      </p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white transition group-hover:text-cyan-200">
          {title}
        </h3>
        <span className="text-slate-500 transition group-hover:text-cyan-200">-&gt;</span>
      </div>
    </Link>
  )
}

function DashboardShell({
  title,
  subtitle,
  accessLevel,
  currentUser,
  children,
}: {
  title: string
  subtitle: string
  accessLevel: string | null
  currentUser: string
  children: ReactNode
}) {
  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
              Dashboard
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{subtitle}</p>
          </div>

          <div className="grid gap-3 sm:text-right">
            <StatusBadge tone="neutral">{accessLabel(accessLevel)}</StatusBadge>
            <StatusBadge tone="neutral">{currentUser}</StatusBadge>
          </div>
        </div>
      </div>

      {children}
    </section>
  )
}

export function DashboardPage() {
  const { accessLevel, authUser, employee } = useAuth()

  const activeAccessLevel = accessLevel ?? 'employee'
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [internalMetricsData, setInternalMetricsData] = useState<InternalDashboardMetrics | null>(
    null,
  )

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      setLoading(true)
      setPageError(null)

      try {
        const data = await fetchInternalDashboardMetrics()

        if (!isMounted) {
          return
        }

        setInternalMetricsData(data)
      } catch (error) {
        if (!isMounted) {
          return
        }

        const message = error instanceof Error ? error.message : 'Unable to load dashboard data.'
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

  const currentUser = currentUserLabel({
    accessLevel: activeAccessLevel,
    authEmail: authUser?.email,
    employeeName: employee?.character_name ?? null,
  })

  if (loading) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Dashboard
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Loading dashboard data</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Fetching live counts from Supabase.
        </p>
      </section>
    )
  }

  if (pageError) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-slate-100 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
          Dashboard
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Unable to load dashboard</h1>
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

  const metrics = internalMetricsData ?? {
    activeEmployeesCount: 0,
    exEmployeesCount: 0,
    activeRanksCount: 0,
    activeServiceProvidersCount: 0,
    activeCustomersCount: 0,
    activeMembershipPlansCount: 0,
    activeMembershipRecordsCount: 0,
    activePriceItemsCount: 0,
    activeStoreCollaborationsCount: 0,
    activeOutfitGuideItemsCount: 0,
  }

  const internalCards = [
    {
      label: 'Active employees',
      value: metrics.activeEmployeesCount,
      detail: 'Current employee records with active status.',
    },
    {
      label: 'Ex-employees',
      value: metrics.exEmployeesCount,
      detail: 'Separated employee records still available in Supabase.',
    },
    {
      label: 'Active ranks',
      value: metrics.activeRanksCount,
      detail: 'Ranks currently active and not archived.',
    },
    {
      label: 'Active service providers',
      value: metrics.activeServiceProvidersCount,
      detail: 'External management and provider records.',
    },
    {
      label: 'Active customers',
      value: metrics.activeCustomersCount,
      detail: 'Current customer portal profiles.',
    },
    {
      label: 'Active membership plans',
      value: metrics.activeMembershipPlansCount,
      detail: 'Membership plans available in the portal.',
    },
    {
      label: 'Active membership records',
      value: metrics.activeMembershipRecordsCount,
      detail: 'Current membership records tied to customers or snapshots.',
    },
    {
      label: 'Active price items',
      value: metrics.activePriceItemsCount,
      detail: 'Current pricing inventory rows.',
    },
    {
      label: 'Active store collaborations',
      value: metrics.activeStoreCollaborationsCount,
      detail: 'Live store collaboration records.',
    },
    {
      label: 'Active outfit guide items',
      value: metrics.activeOutfitGuideItemsCount,
      detail: 'Current outfit references available internally.',
    },
  ]

  return (
    <DashboardShell
      accessLevel={activeAccessLevel}
    currentUser={currentUser}
    subtitle="Read-only internal dashboard powered entirely by live Supabase counts."
    title={activeAccessLevel === 'management' ? 'Management Dashboard' : 'Employee Dashboard'}
  >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {internalCards.map((card) => (
          <MetricCard key={card.label} detail={card.detail} label={card.label} value={card.value} />
        ))}
      </div>

      <div className="rounded-[2rem] border border-white/10 bg-white/5 p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
              Quick Links
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
              Accessible modules
            </h2>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {getNavigationSections(activeAccessLevel)
            .map((section) => ({
              ...section,
              items: section.items.filter((item) => item.path !== '/dashboard'),
            }))
            .filter((section) => section.items.length > 0)
            .flatMap((section) =>
              section.items.map((item) => (
                <QuickLinkCard
                  key={item.path}
                  path={item.path}
                  section={section.title}
                  title={item.navLabel}
                />
              )),
            )}
        </div>
      </div>
    </DashboardShell>
  )
}
