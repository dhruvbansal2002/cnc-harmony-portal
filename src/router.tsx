import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RequireAuth, RequirePublicOnly } from './auth/RequireAuth'
import { PortalLayout } from './components/layout/PortalLayout'
import { PublicSiteLayout } from './components/layout/PublicSiteLayout'
import { AccessPage } from './pages/AccessPage'
import { EmployeeSheetPage } from './pages/employees/EmployeeSheetPage'
import { ExEmployeeSheetPage } from './pages/ex-employees/ExEmployeeSheetPage'
import { ManagementProvidersPage } from './pages/management-providers/ManagementProvidersPage'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { DashboardPage } from './pages/DashboardPage'
import { AuditLogsPage } from './pages/audit-logs/AuditLogsPage'
import { ComplimentaryItemsPage } from './pages/complimentary-items/ComplimentaryItemsPage'
import { CustomersPage } from './pages/customers/CustomersPage'
import { MembershipBenefitsPage } from './pages/membership-benefits/MembershipBenefitsPage'
import { MembershipRecordsPage } from './pages/membership-records/MembershipRecordsPage'
import { MembershipPlansPage } from './pages/membership-plans/MembershipPlansPage'
import { PriceStructurePage } from './pages/price-structure/PriceStructurePage'
import { RankManagementPage } from './pages/ranks/RankManagementPage'
import { StoreCollaborationsPage } from './pages/store-collaborations/StoreCollaborationsPage'
import { OutfitGuidePage } from './pages/outfit-guide/OutfitGuidePage'
import { AnnouncementsPage } from './pages/announcements/AnnouncementsPage'
import { ModulePlaceholderPage } from './pages/placeholders/ModulePlaceholderPage'
import { RoleGate } from './routes/RoleGate'
import { PublicLandingRoute } from './routes/PublicLandingRoute'
import { portalRouteDefinitions, publicRouteDefinitions } from './routes/navigation'
import { RouteErrorBoundary } from './components/RouteErrorBoundary'
import { PublicCustomerPriceListPage } from './pages/public/PublicCustomerPriceListPage'
import { PublicAnnouncementsPage } from './pages/public/PublicAnnouncementsPage'

const publicPaths = new Set(publicRouteDefinitions.map((route) => route.path))
const protectedRouteDefinitions = portalRouteDefinitions.filter(
  (route) => !publicPaths.has(route.path),
)

const publicLoginElement = (
  <RequirePublicOnly>
    <LoginPage />
  </RequirePublicOnly>
)

const publicRoutes = publicRouteDefinitions.map((routeDefinition) => ({
    path: routeDefinition.path.replace(/^\//, ''),
    element:
      routeDefinition.path === '/customer-price-list' ? (
        <PublicCustomerPriceListPage />
      ) : routeDefinition.path === '/public/membership-plans' ? (
        <MembershipPlansPage pageVariant="public" />
      ) : routeDefinition.path === '/public/membership-benefits' ? (
        <MembershipBenefitsPage pageVariant="public" />
      ) : routeDefinition.path === '/public/complimentary-items' ? (
        <ComplimentaryItemsPage pageVariant="public" />
      ) : routeDefinition.path === '/announcements-shop-info' ? (
        <PublicAnnouncementsPage />
      ) : (
      <PublicAnnouncementsPage />
    ),
}))

const protectedPortalRoutes = protectedRouteDefinitions.map((routeDefinition) => ({
  path: routeDefinition.path.replace(/^\//, ''),
  element: (
    <RoleGate
      allowedAccessLevels={routeDefinition.routeAccessLevels}
      moduleName={routeDefinition.moduleName}
    >
      {routeDefinition.path === '/ranks' ? (
        <RankManagementPage />
      ) : routeDefinition.path === '/dashboard' ? (
        <DashboardPage />
      ) : routeDefinition.path === '/announcements' ? (
        <AnnouncementsPage pageVariant="internal" />
      ) : routeDefinition.path === '/employees' ? (
        <EmployeeSheetPage />
      ) : routeDefinition.path === '/customers' ? (
        <CustomersPage />
      ) : routeDefinition.path === '/ex-employees' ? (
        <ExEmployeeSheetPage />
      ) : routeDefinition.path === '/management-providers' ? (
        <ManagementProvidersPage />
      ) : routeDefinition.path === '/membership-plans' ? (
        <MembershipPlansPage />
      ) : routeDefinition.path === '/membership-benefits' ? (
        <MembershipBenefitsPage />
      ) : routeDefinition.path === '/complimentary-items' ? (
        <ComplimentaryItemsPage />
      ) : routeDefinition.path === '/membership-records' ? (
        <MembershipRecordsPage />
      ) : routeDefinition.path === '/price-structure' ? (
        <PriceStructurePage />
      ) : routeDefinition.path === '/store-collaborations' ? (
        <StoreCollaborationsPage />
      ) : routeDefinition.path === '/outfit-guide' ? (
        <OutfitGuidePage />
      ) : routeDefinition.path === '/audit-logs' ? (
        <AuditLogsPage />
      ) : (
        <ModulePlaceholderPage moduleName={routeDefinition.moduleName} />
      )}
    </RoleGate>
  ),
}))

export const router = createBrowserRouter([
  {
    path: '/',
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <PublicSiteLayout />,
        children: [
          {
            index: true,
            element: <PublicLandingRoute />,
          },
          {
            path: 'customer-home',
            element: <Navigate replace to="/" />,
          },
          ...publicRoutes,
        ],
      },
      {
        path: '/login',
        element: publicLoginElement,
      },
      {
        path: '/signup',
        element: (
          <RequirePublicOnly>
            <SignupPage />
          </RequirePublicOnly>
        ),
      },
      {
        path: '/access',
        element: <AccessPage />,
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <PortalLayout />,
            children: [
              ...protectedPortalRoutes,
            ],
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate replace to="/" />,
  },
])
