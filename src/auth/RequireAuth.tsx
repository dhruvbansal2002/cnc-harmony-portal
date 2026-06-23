import type { ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './useAuth'

function ScreenMessage({
  title,
  body,
}: {
  title: string
  body: string
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-slate-100">
      <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-cyan-950/30 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/80">
          CNC Harmony
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">{body}</p>
      </section>
    </main>
  )
}

function LoadingScreen() {
  return (
    <ScreenMessage
      title="Loading portal access"
      body="Checking Supabase session and portal authorization."
    />
  )
}

export function RequireAuth() {
  const { status, session, accessLevel, portalUser } = useAuth()

  if (status === 'config_missing') {
    return <Navigate replace to="/login" />
  }

  if (status === 'loading') {
    return <LoadingScreen />
  }

  if (!session) {
    return <Navigate replace to="/login" />
  }

  if (status === 'setup' || status === 'inactive') {
    return <Navigate replace to="/access" />
  }

  if (status !== 'ready') {
    return <LoadingScreen />
  }

  if (portalUser?.permission_level === 'employee' && !portalUser.employee_id) {
    return <Navigate replace to="/access" />
  }

  return session && accessLevel === 'customer' ? (
    <Navigate replace to="/access" />
  ) : (
    <Outlet />
  )
}

export function RequirePublicOnly({ children }: { children: ReactNode }) {
  const { status, session, accessLevel, portalUser } = useAuth()

  if (status === 'config_missing') {
    return children
  }

  if (status === 'loading') {
    return <LoadingScreen />
  }

  if (!session) {
    return children
  }

  if (status === 'setup' || status === 'inactive') {
    return <Navigate replace to="/access" />
  }

  if (status === 'ready') {
    if (portalUser?.permission_level === 'employee' && !portalUser.employee_id) {
      return <Navigate replace to="/access" />
    }

    return accessLevel === 'management' || accessLevel === 'employee' ? (
      <Navigate replace to="/dashboard" />
    ) : (
      <Navigate replace to="/access" />
    )
  }

  return children
}

export { ScreenMessage }
