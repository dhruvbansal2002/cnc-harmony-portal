import type { AccessLevel } from '../auth/types'

export type PortalSectionKey =
  | 'overview'
  | 'operations'
  | 'commerce'
  | 'reference'

export interface PortalRouteDefinition {
  path: string
  moduleName: string
  navLabel: string
  section: PortalSectionKey
  navAccessLevels: AccessLevel[]
  routeAccessLevels: AccessLevel[]
}

export interface PortalNavigationSection {
  title: string
  items: PortalRouteDefinition[]
}

export interface PublicRouteDefinition {
  path: string
  navLabel: string
}

const allAccessLevels: AccessLevel[] = ['management', 'employee', 'customer']

export const portalRouteDefinitions: PortalRouteDefinition[] = [
  {
    path: '/dashboard',
    moduleName: 'Dashboard',
    navLabel: 'Dashboard',
    section: 'overview',
    navAccessLevels: allAccessLevels,
    routeAccessLevels: allAccessLevels,
  },
  {
    path: '/announcements',
    moduleName: 'Announcements',
    navLabel: 'Announcements',
    section: 'overview',
    navAccessLevels: ['management', 'employee'],
    routeAccessLevels: ['management', 'employee'],
  },
  {
    path: '/employees',
    moduleName: 'Employees',
    navLabel: 'Employees',
    section: 'operations',
    navAccessLevels: ['management', 'employee'],
    routeAccessLevels: ['management', 'employee'],
  },
  {
    path: '/ex-employees',
    moduleName: 'Ex Employees',
    navLabel: 'Ex Employees',
    section: 'operations',
    navAccessLevels: ['management'],
    routeAccessLevels: ['management'],
  },
  {
    path: '/ranks',
    moduleName: 'Ranks',
    navLabel: 'Ranks',
    section: 'operations',
    navAccessLevels: ['management', 'employee'],
    routeAccessLevels: ['management', 'employee'],
  },
  {
    path: '/management-providers',
    moduleName: 'Management / Providers',
    navLabel: 'Management / Providers',
    section: 'operations',
    navAccessLevels: ['management', 'employee'],
    routeAccessLevels: ['management', 'employee'],
  },
  {
    path: '/customers',
    moduleName: 'Customers',
    navLabel: 'Customers',
    section: 'operations',
    navAccessLevels: ['management'],
    routeAccessLevels: ['management'],
  },
  {
    path: '/price-structure',
    moduleName: 'Price Structure',
    navLabel: 'Price Structure',
    section: 'commerce',
    navAccessLevels: ['management', 'employee'],
    routeAccessLevels: ['management', 'employee'],
  },
  {
    path: '/membership-plans',
    moduleName: 'Membership Plans',
    navLabel: 'Membership Plans',
    section: 'commerce',
    navAccessLevels: ['management', 'employee'],
    routeAccessLevels: ['management', 'employee'],
  },
  {
    path: '/membership-benefits',
    moduleName: 'Membership Benefits',
    navLabel: 'Membership Benefits',
    section: 'commerce',
    navAccessLevels: ['management', 'employee'],
    routeAccessLevels: ['management', 'employee'],
  },
  {
    path: '/complimentary-items',
    moduleName: 'Complimentary Items',
    navLabel: 'Complimentary Items',
    section: 'commerce',
    navAccessLevels: ['management', 'employee'],
    routeAccessLevels: ['management', 'employee'],
  },
  {
    path: '/membership-records',
    moduleName: 'Membership Records',
    navLabel: 'Membership Records',
    section: 'commerce',
    navAccessLevels: allAccessLevels,
    routeAccessLevels: allAccessLevels,
  },
  {
    path: '/store-collaborations',
    moduleName: 'Store Collaborations',
    navLabel: 'Store Collaborations',
    section: 'commerce',
    navAccessLevels: ['management', 'employee'],
    routeAccessLevels: ['management', 'employee'],
  },
  {
    path: '/outfit-guide',
    moduleName: 'Outfit Guide',
    navLabel: 'Outfit Guide',
    section: 'reference',
    navAccessLevels: ['management', 'employee'],
    routeAccessLevels: ['management', 'employee'],
  },
  {
    path: '/audit-logs',
    moduleName: 'Audit Logs',
    navLabel: 'Audit Logs',
    section: 'reference',
    navAccessLevels: ['management'],
    routeAccessLevels: ['management'],
  },
]

export const publicRouteDefinitions: PublicRouteDefinition[] = [
  { path: '/announcements-shop-info', navLabel: 'Announcements / Shop Info' },
  { path: '/customer-price-list', navLabel: 'Customer Price List' },
  { path: '/public/membership-plans', navLabel: 'Membership Plans' },
  { path: '/public/membership-benefits', navLabel: 'Membership Benefits' },
  { path: '/public/complimentary-items', navLabel: 'Complimentary Items' },
]

const sectionDefinitions: Record<
  PortalSectionKey,
  { title: string; order: number }
> = {
  overview: { title: 'Overview', order: 0 },
  operations: { title: 'Operations', order: 1 },
  commerce: { title: 'Commerce', order: 2 },
  reference: { title: 'Reference', order: 3 },
}

export function getNavigationSections(
  accessLevel: AccessLevel,
): PortalNavigationSection[] {
  const sections = portalRouteDefinitions
    .filter((item) => item.navAccessLevels.includes(accessLevel))
    .reduce<Partial<Record<PortalSectionKey, PortalRouteDefinition[]>>>(
      (accumulator, item) => {
        const currentItems = accumulator[item.section] ?? []
        accumulator[item.section] = [...currentItems, item]
        return accumulator
      },
      {},
    )

  return (Object.entries(sectionDefinitions) as Array<
    [PortalSectionKey, { title: string; order: number }]
  >)
    .sort((first, second) => first[1].order - second[1].order)
    .map(([sectionKey, sectionDefinition]) => ({
      title: sectionDefinition.title,
      items: sections[sectionKey] ?? [],
    }))
    .filter((section) => section.items.length > 0)
}

export function getDefaultPath() {
  return '/dashboard'
}
