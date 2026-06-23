import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { getDefaultPath } from './navigation'

export function RoleLandingRoute() {
  const { accessLevel, portalUser } = useAuth()

  if (!accessLevel) {
    return null
  }

  if (accessLevel === 'customer') {
    return <Navigate replace to="/access" />
  }

  if (portalUser?.permission_level === 'employee' && !portalUser.employee_id) {
    return <Navigate replace to="/access" />
  }

  return <Navigate replace to={getDefaultPath()} />
}

