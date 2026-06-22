import type { ReactNode } from 'react'
import { useAuth } from '../auth/useAuth'
import type { AccessLevel } from '../auth/types'
import { AccessDeniedPage } from '../pages/placeholders/AccessDeniedPage'

interface RoleGateProps {
  allowedAccessLevels: AccessLevel[]
  moduleName: string
  children: ReactNode
}

export function RoleGate({
  allowedAccessLevels,
  moduleName,
  children,
}: RoleGateProps) {
  const { accessLevel } = useAuth()

  if (!accessLevel || !allowedAccessLevels.includes(accessLevel)) {
    return (
      <AccessDeniedPage
        moduleName={moduleName}
        requiredAudience={allowedAccessLevels.join(' / ')}
      />
    )
  }

  return <>{children}</>
}
