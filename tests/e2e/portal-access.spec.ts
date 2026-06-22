import { expect, test, type Page } from '@playwright/test'
import { getTestEnv } from './test-env'

const publicRoutes = [
  { path: '/', heading: 'Welcome to CNC Harmony' },
  { path: '/customer-price-list', heading: 'Customer Price List' },
  { path: '/public/membership-plans', heading: 'Membership Control Center' },
  { path: '/public/membership-benefits', heading: 'Membership Benefits Control Center' },
  { path: '/public/complimentary-items', heading: 'Complimentary Items Control Center' },
  { path: '/announcements-shop-info', heading: 'Welcome to CNC Harmony' },
] as const

const publicCatalogModuleRoutes = [
  '/public/membership-plans',
  '/public/membership-benefits',
  '/public/complimentary-items',
] as const

const protectedInternalRoutes = [
  { path: '/dashboard', heading: /^(Management|Employee) Dashboard$/ },
  { path: '/ranks', heading: 'Rank Control Center' },
  { path: '/employees', heading: 'Employee Control Center' },
  { path: '/ex-employees', heading: 'Ex-Employee Control Center' },
  { path: '/management-providers', heading: 'Management / Service Providers' },
  { path: '/customers', heading: 'Customers Control Center' },
  { path: '/price-structure', heading: 'Price Control Center' },
  { path: '/membership-records', heading: 'Membership Records Control Center' },
  { path: '/store-collaborations', heading: 'Store Collaboration Control Center' },
  { path: '/outfit-guide', heading: 'Outfit Guide Control Center' },
  { path: '/audit-logs', heading: 'Audit Trail' },
] as const

const staffCatalogRoutes = [
  { path: '/membership-plans', heading: 'Membership Control Center' },
  { path: '/membership-benefits', heading: 'Membership Benefits Control Center' },
  { path: '/complimentary-items', heading: 'Complimentary Items Control Center' },
] as const

const managementOnlyRoutes = [
  { path: '/customers', heading: 'Customers' },
  { path: '/ex-employees', heading: 'Ex Employees' },
  { path: '/audit-logs', heading: 'Audit Logs' },
] as const

const managementCredentials = {
  email: getTestEnv('E2E_MANAGEMENT_EMAIL'),
  password: getTestEnv('E2E_MANAGEMENT_PASSWORD'),
}

const employeeCredentials = {
  email: getTestEnv('E2E_EMPLOYEE_EMAIL'),
  password: getTestEnv('E2E_EMPLOYEE_PASSWORD'),
}

async function clearBrowserState(page: Page) {
  await page.context().clearCookies()
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
}

function capture404s(page: Page) {
  const notFoundResponses: string[] = []

  page.on('response', (response: { status: () => number; url: () => string }) => {
    if (response.status() === 404) {
      notFoundResponses.push(response.url())
    }
  })

  return notFoundResponses
}

async function expectPublicShell(page: Page) {
  await expect(
    page.locator('header').getByRole('link', { name: 'Staff Login', exact: true }),
  ).toBeVisible()

  for (const publicLink of [
    'Customer Price List',
    'Membership Plans',
    'Membership Benefits',
    'Complimentary Items',
    'Announcements / Shop Info',
  ]) {
    await expect(page.locator('header').getByRole('link', { name: publicLink, exact: true })).toBeVisible()
  }
}

async function expectPortalShell(page: Page) {
  await expect(page.locator('aside')).toBeVisible()
  await expect(page.getByText('Public catalog access without login', { exact: false })).toHaveCount(0)
}

async function expectFirstActionMenuOpens(page: Page, expectedActionLabel: string) {
  const triggers = page.getByRole('button', { name: 'Actions', exact: true })
  const triggerCount = await triggers.count()

  for (let index = 0; index < triggerCount; index += 1) {
    const trigger = triggers.nth(index)
    if (!(await trigger.isVisible())) {
      continue
    }

    await trigger.click()
    const menu = page.locator('[role="menu"]').first()
    const actionButton = menu.getByRole('button', { name: expectedActionLabel, exact: true })

    if (await actionButton.count()) {
      await expect(actionButton).toBeVisible()
      return true
    }

    await page.mouse.click(0, 0)
  }

  return false
}

async function expectFirstActionMenuEditFlow(page: Page, editHeading: RegExp | string) {
  const triggers = page.getByRole('button', { name: 'Actions', exact: true })
  const triggerCount = await triggers.count()

  for (let index = 0; index < triggerCount; index += 1) {
    const trigger = triggers.nth(index)
    if (!(await trigger.isVisible())) {
      continue
    }

    await trigger.click()
    const menu = page.locator('[role="menu"]').first()
    const editButton = menu.getByRole('button', { name: 'Edit', exact: true })

    if (await editButton.count()) {
      await expect(editButton).toBeVisible()
      await editButton.click()
      await expect(page.getByRole('heading', { name: editHeading })).toBeVisible()
      return true
    }

    await page.mouse.click(0, 0)
  }

  return false
}

async function expectCarouselDeckWorks(page: Page) {
  const deck = page.locator('[data-testid="carousel-deck"]').first()
  const dots = deck.getByTestId('carousel-dot')

  await expect(deck).toBeVisible()
  await expect(deck.getByTestId('carousel-prev')).toBeVisible()
  await expect(deck.getByTestId('carousel-next')).toBeVisible()
  await expect(deck.locator('[data-carousel-card]').first()).toBeVisible()
  await expect(dots.first()).toBeVisible()

  const dotCount = await dots.count()

  if (dotCount > 1) {
    await expect(dots.nth(0)).toHaveAttribute('aria-current', 'true')
    await deck.getByTestId('carousel-next').click()
    await expect(dots.nth(1)).toHaveAttribute('aria-current', 'true')
  }
}

async function expectMembershipBenefitsLandscapeCard(page: Page) {
  const deck = page.locator('[data-testid="carousel-deck"]').first()
  const card = deck.locator('[data-testid="membership-plan-card"]').first()
  const previousButton = deck.getByTestId('carousel-prev')
  const nextButton = deck.getByTestId('carousel-next')
  const [deckBox, cardBox, prevBox, nextBox] = await Promise.all([
    deck.boundingBox(),
    card.boundingBox(),
    previousButton.boundingBox(),
    nextButton.boundingBox(),
  ])

  expect(deckBox).not.toBeNull()
  expect(cardBox).not.toBeNull()
  expect(prevBox).not.toBeNull()
  expect(nextBox).not.toBeNull()

  if (!deckBox || !cardBox || !prevBox || !nextBox) {
    return
  }

  expect(cardBox.width).toBeGreaterThan(cardBox.height)
  expect(prevBox.y + prevBox.height / 2).toBeGreaterThan(deckBox.y)
  expect(prevBox.y + prevBox.height / 2).toBeLessThan(deckBox.y + deckBox.height)
  expect(nextBox.y + nextBox.height / 2).toBeGreaterThan(deckBox.y)
  expect(nextBox.y + nextBox.height / 2).toBeLessThan(deckBox.y + deckBox.height)

  await expect(previousButton).toHaveText('')
  await expect(nextButton).toHaveText('')
}

async function findPlanCardWithInactiveParentStatus(page: Page) {
  const cards = page.locator('[data-testid="membership-plan-card"]')
  const cardCount = await cards.count()

  for (let index = 0; index < Math.min(cardCount, 8); index += 1) {
    const card = cards.nth(index)
    const cardText = (await card.innerText().catch(() => '')).toLowerCase()

    if (!cardText.includes('parent plan status')) {
      continue
    }

    if (cardText.includes('inactive') || cardText.includes('archived')) {
      const title = (await card.getByRole('heading').first().textContent())?.trim() ?? ''
      if (title) {
        return title
      }
    }
  }

  return null
}

async function expectSidebarLinksVisible(page: Page, linkNames: string[]) {
  const sidebar = page.locator('aside')

  await expect(sidebar).toBeVisible()

  for (const linkName of linkNames) {
    await expect(sidebar.getByRole('link', { name: linkName, exact: true })).toBeVisible()
  }
}

async function expectSidebarLinksAbsent(page: Page, linkNames: string[]) {
  const sidebar = page.locator('aside')

  for (const linkName of linkNames) {
    await expect(sidebar.getByRole('link', { name: linkName, exact: true })).toHaveCount(0)
  }
}

async function loginAs(page: Page, credentials: { email: string; password: string }) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Email').fill(credentials.email)
  await page.getByLabel('Password').fill(credentials.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

test.describe('public access', () => {
  test('public visitors can browse customer-safe pages without login', async ({ page }) => {
    const notFoundResponses = capture404s(page)

    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Welcome to CNC Harmony' })).toBeVisible()
    await expect(page.getByText('Your active membership records')).toHaveCount(0)
    await expect(page.getByText('Linked customer profile not available.')).toHaveCount(0)
    const headerStaffLoginLink = page.locator('header').getByRole('link', {
      name: 'Staff Login',
      exact: true,
    })
    await expect(headerStaffLoginLink).toBeVisible()
    await headerStaffLoginLink.click()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'Staff Login' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Actions', exact: true })).toHaveCount(0)

    for (const route of publicRoutes) {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('heading', { name: route.heading })).toBeVisible()
      await expectPublicShell(page)
      await expect(page.getByRole('button', { name: 'Actions', exact: true })).toHaveCount(0)
      if (route.path === '/public/membership-plans') {
        await expect(page.getByRole('button', { name: 'Create Membership Plan' })).toHaveCount(0)
      }
      if (route.path === '/public/membership-benefits') {
        const benefitCard = page.locator('[data-testid="membership-plan-card"]').first()
        await expect(benefitCard).toBeVisible()
        await expect(benefitCard.locator('[data-testid="membership-benefit-row"]').first()).toBeVisible()
        await expect(benefitCard.locator('[data-testid="benefit-discount"]').first()).toBeVisible()
        await expect(benefitCard.locator('[data-testid="benefit-member-price"]').first()).toBeVisible()
        await expectCarouselDeckWorks(page)
        await expectMembershipBenefitsLandscapeCard(page)
        await expect(page.getByRole('button', { name: 'Create Benefit' })).toHaveCount(0)
      }
      if (route.path === '/public/complimentary-items') {
        await expectCarouselDeckWorks(page)
        await expect(page.getByRole('button', { name: 'Create Complimentary Item' })).toHaveCount(0)
      }
    }

    expect(notFoundResponses, `Unexpected 404 responses: ${notFoundResponses.join(', ')}`).toEqual([])
  })

  test('public visitors can open staff login and sign in from the public shell', async ({
    page,
  }) => {
    const consoleErrors: string[] = []
    const requestFailures: string[] = []

    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text())
      }
    })

    page.on('pageerror', (error) => {
      consoleErrors.push(error.message)
    })

    page.on('requestfailed', (request) => {
      const errorText = request.failure()?.errorText ?? 'unknown error'

      if (errorText === 'net::ERR_ABORTED') {
        return
      }

      requestFailures.push(
        `${request.method()} ${request.url()} :: ${errorText}`,
      )
    })

    await clearBrowserState(page)
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    const staffLoginLink = page.locator('header').getByRole('link', {
      name: 'Staff Login',
      exact: true,
    })
    await expect(staffLoginLink).toBeVisible()
    await staffLoginLink.click()

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'Staff Login' })).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()

    await expect(page.getByLabel('Email')).toBeEnabled()
    await expect(page.getByLabel('Password')).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled()

    await page.getByLabel('Email').fill(managementCredentials.email)
    await page.getByLabel('Password').fill(managementCredentials.password)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading', { name: 'Management Dashboard' })).toBeVisible()

    expect(consoleErrors, `Browser console errors: ${consoleErrors.join(' | ')}`).toEqual([])
    expect(
      requestFailures,
      `Browser request failures: ${requestFailures.join(' | ')}`,
    ).toEqual([])
  })

  test('logged-in staff always land on the dashboard from public entry points', async ({
    page,
  }) => {
    await clearBrowserState(page)
    await loginAs(page, managementCredentials)

    for (const path of ['/', '/login']) {
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      await expect(page).toHaveURL(/\/dashboard$/)
      await expect(page.getByRole('heading', { name: 'Management Dashboard' })).toBeVisible()
      await expect(page.getByText('Linked customer profile not available.')).toHaveCount(0)
    }

    for (const path of publicCatalogModuleRoutes) {
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      await expect(page).toHaveURL(/\/dashboard$/)
      await expect(page.getByRole('heading', { name: 'Management Dashboard' })).toBeVisible()
      await expect(page.getByText('Public catalog access without login')).toHaveCount(0)
    }

    await page.getByRole('link', { name: 'Membership Plans', exact: true }).click()
    await expect(page).toHaveURL(/\/membership-plans$/)
    await expectPortalShell(page)
    await expect(page.getByRole('button', { name: 'Create Membership Plan' })).toBeVisible()

    await page.getByRole('link', { name: 'Membership Benefits', exact: true }).click()
    await expect(page).toHaveURL(/\/membership-benefits$/)
    await expectPortalShell(page)
    await expect(page.getByRole('button', { name: 'Create Benefit' })).toBeVisible()
    const benefitCard = page.locator('[data-testid="membership-plan-card"]').first()
    await expect(benefitCard).toBeVisible()
    await expect(benefitCard.locator('[data-testid="membership-benefit-row"]').first()).toBeVisible()
    await expect(benefitCard.locator('[data-testid="benefit-discount"]').first()).toBeVisible()
    await expect(benefitCard.locator('[data-testid="benefit-member-price"]').first()).toBeVisible()
    await expectCarouselDeckWorks(page)
    await expectMembershipBenefitsLandscapeCard(page)

    await page.getByRole('link', { name: 'Complimentary Items', exact: true }).click()
    await expect(page).toHaveURL(/\/complimentary-items$/)
    await expectPortalShell(page)
    await expect(page.getByRole('button', { name: 'Create Complimentary Item' })).toBeVisible()
    await expectCarouselDeckWorks(page)

    await clearBrowserState(page)
    await loginAs(page, employeeCredentials)

    for (const path of ['/', '/login']) {
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      await expect(page).toHaveURL(/\/dashboard$/)
      await expect(page.getByRole('heading', { name: 'Employee Dashboard' })).toBeVisible()
      await expect(page.getByText('Linked customer profile not available.')).toHaveCount(0)
    }

    for (const path of publicCatalogModuleRoutes) {
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      await expect(page).toHaveURL(/\/dashboard$/)
      await expect(page.getByRole('heading', { name: 'Employee Dashboard' })).toBeVisible()
      await expect(page.getByText('Public catalog access without login')).toHaveCount(0)
    }

    await page.getByRole('link', { name: 'Membership Plans', exact: true }).click()
    await expect(page).toHaveURL(/\/membership-plans$/)
    await expectPortalShell(page)
    await expect(page.getByRole('button', { name: 'Create Membership Plan' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Actions', exact: true })).toHaveCount(0)

    await page.getByRole('link', { name: 'Membership Benefits', exact: true }).click()
    await expect(page).toHaveURL(/\/membership-benefits$/)
    await expectPortalShell(page)
    await expect(page.getByRole('button', { name: 'Create Benefit' })).toHaveCount(0)
    await expect(page.locator('[data-testid="membership-plan-card"]').first()).toBeVisible()
    await expectCarouselDeckWorks(page)
    await expectMembershipBenefitsLandscapeCard(page)
    await expect(page.getByRole('button', { name: 'Actions', exact: true })).toHaveCount(0)

    await page.getByRole('link', { name: 'Complimentary Items', exact: true }).click()
    await expect(page).toHaveURL(/\/complimentary-items$/)
    await expectPortalShell(page)
    await expect(page.getByRole('button', { name: 'Create Complimentary Item' })).toHaveCount(0)
    await expectCarouselDeckWorks(page)
    await expect(page.getByRole('button', { name: 'Actions', exact: true })).toHaveCount(0)
  })

  test('public visitors are redirected to staff login from internal routes', async ({ page }) => {
    for (const route of protectedInternalRoutes) {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' })
      await expect(page).toHaveURL(/\/login$/)
      await expect(page.getByRole('heading', { name: 'Staff Login' })).toBeVisible()
    }
  })
})

test.describe('staff login and access', () => {
  test('management staff can access all internal modules and see actions', async ({ page }) => {
    await clearBrowserState(page)
    await loginAs(page, managementCredentials)

    await expect(page.getByRole('heading', { name: 'Management Dashboard' })).toBeVisible()
    await expectSidebarLinksVisible(page, [
      'Dashboard',
      'Employees',
      'Ex Employees',
      'Ranks',
      'Management / Providers',
      'Customers',
      'Price Structure',
      'Membership Plans',
      'Membership Benefits',
      'Complimentary Items',
      'Membership Records',
      'Store Collaborations',
      'Outfit Guide',
      'Audit Logs',
    ])

    for (const route of [...protectedInternalRoutes, ...staffCatalogRoutes]) {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('heading', { name: route.heading })).toBeVisible()
    }

    await page.goto('/ranks', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: 'Create Rank' })).toBeVisible()
    await expectFirstActionMenuOpens(page, 'Restore')

    await page.goto('/employees', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: 'Create Employee' })).toBeVisible()
    await expectFirstActionMenuOpens(page, 'Edit')
    await expectFirstActionMenuEditFlow(page, /^Edit /)

    await page.goto('/membership-plans', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: 'Create Membership Plan' })).toBeVisible()
    await expectFirstActionMenuOpens(page, 'Edit')
    await expectFirstActionMenuEditFlow(page, /^Edit /)

    await page.goto('/membership-benefits', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: 'Create Benefit' })).toBeVisible()
    await expectFirstActionMenuOpens(page, 'Edit')
    await expectFirstActionMenuEditFlow(page, 'Edit benefit')

    await page.goto('/complimentary-items', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: 'Create Complimentary Item' })).toBeVisible()
    await expectFirstActionMenuOpens(page, 'Edit')
    await expectFirstActionMenuEditFlow(page, 'Edit complimentary item')

    await page.goto('/membership-records', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: 'Create Membership Record' })).toBeVisible()
    await expectFirstActionMenuOpens(page, 'Edit')
    await expectFirstActionMenuEditFlow(page, /^Edit /)

    await page.goto('/price-structure', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: 'Create Price Item' })).toBeVisible()
    await expectFirstActionMenuOpens(page, 'Edit')
    await expectFirstActionMenuEditFlow(page, /^Edit /)

    await page.goto('/store-collaborations', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: 'Create Collaboration' })).toBeVisible()
    await expectFirstActionMenuOpens(page, 'Edit')
    await expectFirstActionMenuEditFlow(page, /^Edit /)

    await page.goto('/outfit-guide', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: 'Create Outfit Guide Item' })).toBeVisible()
    await expectFirstActionMenuOpens(page, 'Edit')
    await expectFirstActionMenuEditFlow(page, /^Edit /)

    for (const route of managementOnlyRoutes) {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' })
      await expect(page.getByText('Access restricted', { exact: true })).toHaveCount(0)
    }
  })

  test('employees can access internal read-only modules but not management actions', async ({ page }) => {
    await clearBrowserState(page)
    await loginAs(page, employeeCredentials)

    await expect(page.getByRole('heading', { name: 'Employee Dashboard' })).toBeVisible()
    await expectSidebarLinksVisible(page, [
      'Dashboard',
      'Employees',
      'Ranks',
      'Management / Providers',
      'Price Structure',
      'Membership Plans',
      'Membership Benefits',
      'Complimentary Items',
      'Membership Records',
      'Store Collaborations',
      'Outfit Guide',
    ])
    await expectSidebarLinksAbsent(page, ['Ex Employees', 'Customers', 'Audit Logs'])

    const allowedRoutes = [
      { path: '/dashboard', heading: /^(Management|Employee) Dashboard$/ },
      { path: '/ranks', heading: 'Rank Control Center' },
      { path: '/employees', heading: 'Employee Control Center' },
      { path: '/price-structure', heading: 'Price Control Center' },
      { path: '/membership-plans', heading: 'Membership Control Center' },
      { path: '/membership-benefits', heading: 'Membership Benefits Control Center' },
      { path: '/complimentary-items', heading: 'Complimentary Items Control Center' },
      { path: '/membership-records', heading: 'Membership Records Control Center' },
      { path: '/store-collaborations', heading: 'Store Collaboration Control Center' },
      { path: '/outfit-guide', heading: 'Outfit Guide Control Center' },
    ] as const

    for (const route of allowedRoutes) {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('heading', { name: route.heading })).toBeVisible()
    }

    for (const route of managementOnlyRoutes.slice(0, 2)) {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('heading', { name: route.heading })).toBeVisible()
      await expect(page.getByText('Access restricted', { exact: true })).toBeVisible()
    }

    await page.goto('/ranks', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: 'Create Rank' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Create Employee' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Create Membership Plan' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Create Benefit' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Create Complimentary Item' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Create Membership Record' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Actions', exact: true })).toHaveCount(0)
  })
})

test.describe('membership inheritance', () => {
  test('management can still see child cards linked to inactive or archived parent plans', async ({
    page,
  }) => {
    const targets = [
      {
        path: '/membership-benefits',
        publicPath: '/public/membership-benefits',
        heading: 'Membership Benefits Control Center',
      },
      {
        path: '/complimentary-items',
        publicPath: '/public/complimentary-items',
        heading: 'Complimentary Items Control Center',
      },
    ] as const

    for (const target of targets) {
      await clearBrowserState(page)
      await loginAs(page, managementCredentials)
      await page.goto(target.path, { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('heading', { name: target.heading })).toBeVisible()
      const inactiveTitle = await findPlanCardWithInactiveParentStatus(page)

      if (!inactiveTitle) {
        continue
      }

      const matchingCards = page
        .locator('[data-testid="membership-plan-card"]')
        .filter({ has: page.getByRole('heading', { name: inactiveTitle, exact: true }) })

      await expect(matchingCards.first()).toBeVisible()

      await clearBrowserState(page)
      await loginAs(page, employeeCredentials)

      await page.goto(target.path, { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('heading', { name: target.heading })).toBeVisible()
      await expect(
        page
          .locator('[data-testid="membership-plan-card"]')
          .filter({ has: page.getByRole('heading', { name: inactiveTitle, exact: true }) }),
      ).toHaveCount(0)

      await clearBrowserState(page)
      await page.goto(target.publicPath, { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('heading', { name: target.heading })).toBeVisible()
      await expect(
        page
          .locator('[data-testid="membership-plan-card"]')
          .filter({ has: page.getByRole('heading', { name: inactiveTitle, exact: true }) }),
      ).toHaveCount(0)
    }
  })
})
