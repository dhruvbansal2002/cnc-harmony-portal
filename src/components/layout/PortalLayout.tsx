import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

const sidebarPreferenceKey = 'cnc-harmony-sidebar-collapsed'

export function PortalLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    const storedValue = window.localStorage.getItem(sidebarPreferenceKey)

    return storedValue === 'true'
  })

  useEffect(() => {
    window.localStorage.setItem(sidebarPreferenceKey, String(sidebarCollapsed))
  }, [sidebarCollapsed])

  useEffect(() => {
    if (!mobileOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMobileOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [mobileOpen])

  return (
    <div className="h-dvh overflow-hidden bg-[#04070a] text-slate-100">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.08),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(255,255,255,0.05),_transparent_24%),linear-gradient(180deg,_rgba(9,12,16,1)_0%,_rgba(4,7,10,1)_100%)]" />
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:52px_52px] opacity-35" />

      <div className="relative flex h-dvh overflow-hidden">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((current) => !current)}
        />

        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0">
            <Topbar onMenuToggle={() => setMobileOpen(true)} />
          </div>

          <main className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto w-full max-w-7xl pb-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
            type="button"
          />
          <div className="absolute inset-y-0 left-0">
            <Sidebar mobile onNavigate={() => setMobileOpen(false)} collapsed={false} />
          </div>
        </div>
      ) : null}
    </div>
  )
}
