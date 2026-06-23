import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ScreenMessage } from '../auth/RequireAuth'
import { buildAuthCallbackPath, hasAuthCallbackParams } from '../auth/oauth'
import { PublicAnnouncementsPage } from '../pages/public/PublicAnnouncementsPage'

export function PublicLandingRoute() {
  const currentUrl = typeof window !== 'undefined' ? window.location : null
  const { status, accessLevel, portalUser } = useAuth()

  if (
    currentUrl &&
    hasAuthCallbackParams(currentUrl.search, currentUrl.hash) &&
    currentUrl.pathname !== '/auth/callback'
  ) {
    return <Navigate replace to={buildAuthCallbackPath(currentUrl.search, currentUrl.hash)} />
  }

  if (status === 'loading') {
    return (
      <ScreenMessage
        title="Loading public access"
        body="Checking Supabase session and portal authorization."
      />
    )
  }

  if (
    status === 'ready' &&
    portalUser?.permission_level === 'employee' &&
    !portalUser.employee_id
  ) {
    return <Navigate replace to="/access" />
  }

  if (status === 'ready' && (accessLevel === 'management' || accessLevel === 'employee')) {
    return <Navigate replace to="/dashboard" />
  }

  if (status === 'ready' && accessLevel === 'customer') {
    return <Navigate replace to="/access" />
  }

  if (status === 'setup' || status === 'inactive') {
    return <Navigate replace to="/access" />
  }

  return <PublicAnnouncementsPage />
}
