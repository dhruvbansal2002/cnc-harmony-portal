import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import logo from '../../assets/logo.png'
import { useAuth } from '../../auth/useAuth'
import { getNavigationSections } from '../../routes/navigation'

interface SidebarProps {
  mobile?: boolean
  collapsed?: boolean
  onNavigate?: () => void
  onToggleCollapse?: () => void
}

function getCompactLabel(label: string) {
  const parts = label.split(/[^a-zA-Z0-9]+/).filter(Boolean)
  const initials = parts.map((part) => part[0]?.toUpperCase() ?? '').join('')

  if (initials.length > 0) {
    return initials.slice(0, 3)
  }

  return label.slice(0, 2).toUpperCase()
}

export function Sidebar({
  mobile = false,
  collapsed = false,
  onNavigate,
  onToggleCollapse,
}: SidebarProps) {
  const { accessLevel, authUser, employee, customer, portalUser, signOut } = useAuth()
  const [hoverExpanded, setHoverExpanded] = useState(false)

  const canHoverExpand = !mobile && collapsed
  const isExpanded = mobile || !collapsed || hoverExpanded

  useEffect(() => {
    if (!canHoverExpand) {
      const frame = window.requestAnimationFrame(() => {
        setHoverExpanded(false)
      })

      return () => {
        window.cancelAnimationFrame(frame)
      }
    }

    return undefined
  }, [canHoverExpand])

  const sections = useMemo(() => {
    if (!accessLevel) {
      return []
    }

    return getNavigationSections(accessLevel)
  }, [accessLevel])

  if (!accessLevel) {
    return null
  }

  const displayName =
    employee?.character_name ??
    customer?.character_name ??
    portalUser?.email ??
    authUser?.email ??
    'Current user'

  const accessLabel =
    accessLevel === 'management'
      ? 'Management'
      : accessLevel === 'employee'
        ? 'Employee'
        : 'Customer'

  const containerClasses = mobile
    ? 'flex h-full w-[min(86vw,20rem)] flex-col border-r border-white/10 bg-[#05070a]/95 backdrop-blur-xl'
    : isExpanded
      ? 'sticky top-0 hidden h-dvh w-80 flex-col overflow-hidden border-r border-white/10 bg-[linear-gradient(180deg,rgba(8,12,16,0.96)_0%,rgba(5,8,12,0.88)_100%)] backdrop-blur-xl transition-[width] duration-200 lg:flex'
      : 'sticky top-0 hidden h-dvh w-20 flex-col overflow-hidden border-r border-white/10 bg-[linear-gradient(180deg,rgba(8,12,16,0.96)_0%,rgba(5,8,12,0.88)_100%)] backdrop-blur-xl transition-[width] duration-200 lg:flex'

  return (
    <aside
      className={containerClasses}
      onMouseEnter={() => {
        if (canHoverExpand) {
          setHoverExpanded(true)
        }
      }}
      onMouseLeave={() => {
        if (canHoverExpand) {
          setHoverExpanded(false)
        }
      }}
    >
      {!mobile ? (
        <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-orange-300/20 via-white/30 to-transparent" />
      ) : null}

      <div
        className={[
          'border-b border-white/10 bg-white/[0.03]',
          isExpanded ? 'px-4 py-4' : 'px-3 py-4',
        ].join(' ')}
      >
        <div
          className={[
            'rounded-[1.4rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]',
            isExpanded ? 'flex items-center justify-between gap-3 px-3 py-3' : 'flex flex-col items-center gap-3 px-2 py-3',
          ].join(' ')}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-orange-400/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(249,115,22,0.08)_100%)] text-xs font-semibold text-slate-100 shadow-[0_0_28px_rgba(249,115,22,0.08)]">
            <img alt="" aria-hidden="true" className="h-9 w-9 object-contain" src={logo} />
          </div>

          {isExpanded ? (
            <div className="min-w-0 flex-1">
              <p className="text-[0.64rem] font-semibold uppercase tracking-[0.4em] text-slate-200/90">
                CNC Harmony
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">
                Portal shell
              </p>
            </div>
          ) : null}

          {!mobile && onToggleCollapse ? (
            <button
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/70 text-sm font-semibold text-slate-100 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] transition hover:border-orange-400/40 hover:bg-[rgba(249,115,22,0.10)] hover:text-orange-100"
              onClick={onToggleCollapse}
              type="button"
            >
              {collapsed && !hoverExpanded ? '>>' : '<<'}
            </button>
          ) : null}
        </div>
      </div>

      <div
        className={[
          'flex-1 overscroll-contain px-3 py-5',
          isExpanded ? 'overflow-y-auto' : 'overflow-y-auto scrollbar-none',
        ].join(' ')}
      >
        <div className="space-y-6">
          {sections.map((section) => (
            <div key={section.title} className="space-y-2">
              {isExpanded ? (
                <p className="px-3 text-[0.62rem] font-semibold uppercase tracking-[0.42em] text-slate-500">
                  {section.title}
                </p>
              ) : null}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const compactLabel = getCompactLabel(item.navLabel)

                  return (
                    <NavLink
                      key={item.path}
                      className="block"
                      aria-label={item.navLabel}
                      to={item.path}
                      onClick={onNavigate}
                      title={item.navLabel}
                    >
                      {({ isActive }) => (
                        <span
                          className={[
                            'group relative flex items-center overflow-hidden rounded-[1.1rem] border text-sm transition duration-200',
                            isExpanded ? 'gap-3 px-3 py-3' : 'justify-center px-2 py-3',
                            isActive
                              ? 'border-orange-300/30 bg-[linear-gradient(90deg,rgba(249,115,22,0.14)_0%,rgba(15,23,42,0.82)_55%,rgba(15,23,42,0.72)_100%)] text-orange-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_24px_rgba(249,115,22,0.10)]'
                              : 'border-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.04] hover:text-white',
                          ].join(' ')}
                        >
                          {isActive ? (
                            <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-orange-300 shadow-[0_0_18px_rgba(249,115,22,0.9)]" />
                          ) : null}
                          <span
                            className={[
                              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[0.72rem] font-semibold uppercase tracking-[0.18em] transition',
                              isActive
                                ? 'border-orange-300/30 bg-[linear-gradient(180deg,rgba(249,115,22,0.16)_0%,rgba(146,64,14,0.08)_100%)] text-orange-100 shadow-[0_0_18px_rgba(249,115,22,0.14)]'
                                : 'border-white/10 bg-slate-950/60 text-slate-300 group-hover:border-orange-400/20 group-hover:bg-slate-900 group-hover:text-white',
                            ].join(' ')}
                          >
                            {compactLabel}
                          </span>

                          {isExpanded ? (
                            <span className="min-w-0 truncate font-medium tracking-[0.01em]">
                              {item.navLabel}
                            </span>
                          ) : null}
                        </span>
                      )}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        className={[
          'border-t border-white/10',
          isExpanded ? 'px-6 py-5' : 'px-3 py-4',
        ].join(' ')}
      >
        <div
          className={[
            'rounded-[1.4rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.02)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
            isExpanded ? 'p-4' : 'p-3',
          ].join(' ')}
        >
          <div className={['flex items-center gap-3', !isExpanded ? 'justify-center' : ''].join(' ')}>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/80 text-[0.65rem] font-semibold text-slate-200 shadow-[0_0_22px_rgba(249,115,22,0.08)]">
              <img alt="" aria-hidden="true" className="h-8 w-8 object-contain" src={logo} />
            </div>

            {isExpanded ? (
              <div className="min-w-0">
                <p className="text-[0.62rem] font-semibold uppercase tracking-[0.42em] text-slate-500">
                  Current user
                </p>
                <p className="mt-2 truncate text-sm font-medium text-slate-100">{displayName}</p>
                <p className="mt-1 text-[0.7rem] uppercase tracking-[0.2em] text-slate-400">
                  {accessLabel}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <button
          aria-label="Sign out"
          className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-orange-400/40 hover:bg-[rgba(249,115,22,0.10)] hover:text-orange-100"
          onClick={() => void signOut()}
          title="Sign out"
          type="button"
        >
          {isExpanded ? 'Sign out' : 'SO'}
        </button>
      </div>
    </aside>
  )
}
