import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ScreenMessage } from '../auth/RequireAuth'
import { PublicAnnouncementsPage } from '../pages/public/PublicAnnouncementsPage'

export function PublicLandingRoute() {
  const { status, accessLevel } = useAuth()

  if (status === 'loading') {
    return (
      <ScreenMessage
        title="Loading public access"
        body="Checking Supabase session and portal authorization."
      />
    )
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
