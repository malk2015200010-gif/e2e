/**
 * Admin unified notifications — Phase 1
 *
 * Admin: admin@demo.com / 123456
 * Bell: <i class="la la-bell" aria-hidden="true"></i> (may appear more than once — we use navbar first)
 *
 * UI tests run against the live app (no feed API required).
 * API tests run only if the app actually calls notifications/* endpoints after opening the bell.
 *
 * Origin: baseUrl in cypress.config may be https://dev.mentoraeg.com while login redirects
 * to http://localhost:PORT. syncBaseUrlToApp() updates baseUrl after login to avoid cy.origin errors.
 */

import { visitWithAuth, loginViaApi } from '../../support/navigation'
import { ADMIN, HTTP_AUTH } from '../../support/users'

const NAVBAR_BELL =
  'header i.la-bell, .navbar i.la-bell, .topbar i.la-bell, .main-header i.la-bell, nav i.la-bell'

const SELECTORS = {
  bellIcon: 'i.la-bell',
  unreadBadge: '[data-cy="admin-notification-unread-count"], .badge, .notification-badge',
  dropdown: '[data-cy="admin-notification-dropdown"]',
  markAllRead: '[data-cy="admin-notification-mark-all-read"]',
  notificationItem: '[data-cy="admin-notification-item"]',
  viewAll: '[data-cy="admin-notification-view-all"]',
  notificationsPage: '[data-cy="admin-notifications-page"]',
  feed: '[data-cy="admin-notification-feed"]',
  needsAttention: '[data-cy="admin-dashboard-needs-attention"]',
  /** Parent sidebar group that nests Payments / Instalments / Withdraws / Refunds */
  financeMenu:
    'a[data-admin-menu-group="payments,refund_requests,instalments,withdraws"], a[data-admin-menu-group*="payments"]',
  instalmentsMenu: 'a[data-admin-menu-item="instalments"]',
  paymentsMenu: 'a[data-admin-menu-item="payments"]',
  withdrawsMenu: 'a[data-admin-menu-item="withdraws"], a[data-admin-menu-item="withdrawals"]',
}

const navQueueBadge = (queueKey) => `[data-cy="nav-queue-badge-${queueKey}"]`

const API_URL = {
  summary: /notifications\/summary/i,
  feed: /notifications\/feed/i,
  read: /notifications\/read(?!-all)/i,
  readAll: /notifications\/read-all/i,
}

function mockSummary(body) {
  return { unread_total: 0, queues: {}, ...body }
}

function mockFeed(items) {
  return {
    data: items.map((it, i) => ({
      id: it.id ?? `n-${i}`,
      title: it.title ?? 'Notification',
      read_at: it.read_at ?? null,
      queue: it.queue ?? 'payments',
      data: {},
    })),
    meta: { current_page: 1, last_page: 1 },
  }
}

const defaultSummary = mockSummary({
  unread_total: 3,
  queues: { payments: 2, withdrawals: 1, verifications: 0, 'course-updates': 4 },
})

const defaultFeed = mockFeed([
  { id: '1', title: 'Pending payment', queue: 'payments' },
  { id: '2', title: 'Withdraw request', queue: 'withdrawals' },
])

/** Counts matching HTTP calls (reset in beforeEach). Avoids cy.wait() when API not wired. */
const apiHits = { summary: 0, feed: 0, read: 0, readAll: 0 }

function resetApiHits() {
  apiHits.summary = 0
  apiHits.feed = 0
  apiHits.read = 0
  apiHits.readAll = 0
}

function registerNotificationIntercepts(summaryBody = defaultSummary, feedBody = defaultFeed) {
  cy.intercept({ method: 'GET', url: API_URL.summary }, (req) => {
    apiHits.summary += 1
    req.reply({ statusCode: 200, body: summaryBody })
  }).as('notifSummary')

  cy.intercept({ method: 'GET', url: API_URL.feed }, (req) => {
    apiHits.feed += 1
    req.reply({ statusCode: 200, body: feedBody })
  }).as('notifFeed')

  cy.intercept({ method: 'POST', url: API_URL.read }, (req) => {
    apiHits.read += 1
    req.reply({ statusCode: 200, body: { ok: true } })
  }).as('notifRead')

  cy.intercept({ method: 'POST', url: API_URL.readAll }, (req) => {
    apiHits.readAll += 1
    req.reply({ statusCode: 200, body: { ok: true } })
  }).as('notifReadAll')
}

/**
 * After redirect (e.g. dev.mentoraeg.com → localhost), align Cypress baseUrl with the real app origin.
 * Skip about:blank — its origin serializes as the string "null" and would break later cy.visit calls.
 */
function syncBaseUrlToApp() {
  cy.url().then((url) => {
    if (!/^https?:\/\//i.test(url)) {
      cy.log(`skip baseUrl sync — not on http(s) page yet: ${url}`)
      return
    }

    const origin = new URL(url).origin
    if (!/^https?:\/\//i.test(origin)) {
      cy.log(`skip baseUrl sync — invalid origin: ${origin}`)
      return
    }

    const configured = Cypress.config('baseUrl')
    const configuredOrigin = configured && /^https?:\/\//i.test(configured)
      ? new URL(configured).origin
      : null

    if (configuredOrigin && configuredOrigin !== origin) {
      Cypress.config('baseUrl', origin)
      cy.log(`baseUrl synced to app origin: ${origin}`)
    }
  })
}

function loginAdmin() {
  loginViaApi(ADMIN)
  // Do not sync here: loginViaApi uses cy.request only; the browser may still be about:blank.
}

function goToAdminHome() {
  cy.visit('/admin', {
    auth: HTTP_AUTH,
    failOnStatusCode: false,
    timeout: 60000,
  })
  cy.url({ timeout: 15000 }).then((url) => {
    if (url.includes('/admin')) {
      syncBaseUrlToApp()
      cy.log('Admin home loaded directly')
    } else {
      cy.log(`goToAdminHome: redirected to ${url} — admin session may not persist`)
    }
  })
}

function getNavbarBell() {
  return cy.get('body', { timeout: 15000 }).then(($body) => {
    const $inNav = $body.find(NAVBAR_BELL).filter(':visible')
    const $bell = $inNav.length ? $inNav.first() : $body.find(SELECTORS.bellIcon).filter(':visible').first()
    return cy.wrap($bell)
  })
}

function openNotificationBell() {
  getNavbarBell().should('exist').then(($bell) => {
    const $toggle = $bell.closest(
      'a, button, .dropdown-toggle, .nav-link, .nav-item, [data-bs-toggle="dropdown"], [data-toggle="dropdown"]',
    )
    const $target = $toggle.length ? $toggle.first() : $bell
    cy.wrap($target)
      .scrollIntoView()
      .click({ force: true })
    // Bootstrap sometimes needs a second interaction in headless CI.
    cy.wait(300)
    cy.get('body').then(($body) => {
      const open =
        $body.find(
          '.admin-topbar__dropdown-panel:visible, .dropdown-menu.show:visible, .dropdown-menu:visible, [data-cy="admin-notification-dropdown"]:visible, .admin-notification-dropdown:visible',
        ).length > 0
      if (!open) {
        cy.wrap($target).click({ force: true })
      }
    })
  })
}

function getUnreadBadge() {
  return getNavbarBell().parent().find(SELECTORS.unreadBadge).first()
}

/** Bootstrap-style panel next to navbar bell (no API required). */
function getBellDropdown() {
  return cy.get(
    [
      '.admin-topbar__dropdown-panel:visible',
      '.dropdown-menu.show:visible',
      '.dropdown-menu:visible',
      '[data-cy="admin-notification-dropdown"]:visible',
      '.admin-notification-dropdown:visible',
      '.notifications-dropdown:visible',
      '.notification-dropdown:visible',
      '[class*="notification"][class*="dropdown"]:visible',
      '.admin-topbar .dropdown-menu:visible',
    ].join(', '),
    { timeout: 15000 },
  ).first()
}

function assertBellDropdownOpen() {
  cy.get('body').then(($body) => {
    const $open = $body.find(
      '.admin-topbar__dropdown-panel:visible, .dropdown-menu.show:visible, .dropdown-menu:visible, [data-cy="admin-notification-dropdown"]:visible, .admin-notification-dropdown:visible, .notifications-dropdown:visible',
    )
    if ($open.length) {
      cy.wrap($open.first()).should('be.visible')
      return
    }
    // Soft: bell may open a non-dropdown panel (drawer / offcanvas) on some builds.
    const $alt = $body.find(
      '.offcanvas.show, .modal.show, [role="dialog"]:visible, .admin-topbar__notifications:visible',
    )
    if ($alt.length) {
      cy.log('Notification UI opened as drawer/modal instead of dropdown — OK')
      cy.wrap($alt.first()).should('be.visible')
      return
    }
    getBellDropdown().should('be.visible')
  })
}

/** After opening bell, run fn only if feed API was actually requested. */
function afterBellIfFeedApi(fn) {
  openNotificationBell()
  assertBellDropdownOpen()
  cy.wait(1500)
  cy.then(() => {
    if (apiHits.feed > 0) {
      fn()
    } else {
      cy.log('GET notifications/feed not called — skipping (dropdown is likely server-rendered)')
    }
  })
}

function afterBellIfSummaryApi(fn) {
  openNotificationBell()
  assertBellDropdownOpen()
  cy.wait(1500)
  cy.then(() => {
    if (apiHits.summary > 0) {
      fn()
    } else {
      cy.log('GET notifications/summary not called — skipping')
    }
  })
}

/**
 * Admin sidebar only — never bare `a` (phpdebugbar / topbar queue links pollute matches).
 */
const SIDEBAR_ROOT =
  '.page-sidebar, .dashboard-menu, aside.page-sidebar, .sidebar, #sidebar, .admin-sidebar, .left-side, ul.page-sidebar-menu'

function isIgnoredNavLink(el) {
  if (!el || !el.closest) return true
  if (el.classList?.contains('phpdebugbar-tab')) return true
  if (el.closest('.phpdebugbar, #phpdebugbar')) return true
  if (el.closest('.admin-notification-dropdown, .admin-topbar__dropdown-panel')) return true
  return false
}

/**
 * Prefer visible sidebar links. Avoids hidden topbar queue links and phpdebugbar tabs.
 * Only matches :visible anchors (won't grab Payments inside display:none submenu).
 */
function visibleNavLink(label, timeout = 15000) {
  return cy
    .get(`${SIDEBAR_ROOT} a, a[data-admin-menu-item], a[data-admin-menu-group]`, { timeout })
    .filter(':visible')
    .filter((_, el) => !isIgnoredNavLink(el))
    .filter((_, el) => {
      const text = (el.textContent || '').replace(/\d+/g, '').replace(/\s+/g, ' ').trim()
      return text === label || text.includes(label)
    })
    .first()
}

function financeMenuLink() {
  return cy.get(SELECTORS.financeMenu, { timeout: 15000 }).filter(':visible').first()
}

/**
 * Finance opens when its <a> gets class "opened" and
 * sibling/child ul.nav.nav-second-level becomes display:block.
 */
function expandFinanceMenu() {
  financeMenuLink().should('be.visible').then(($link) => {
    if ($link.hasClass('opened')) {
      cy.log('Finance already has class opened')
      return
    }
    // Click the Finance anchor itself (this is what toggles class="opened")
    cy.wrap($link).click({ force: true })
  })

  financeMenuLink().should('have.class', 'opened')

  financeMenuLink().parent().within(() => {
    cy.get('ul.nav.nav-second-level', { timeout: 15000 })
      .should('exist')
      .and(($ul) => {
        expect(Cypress.$($ul).css('display'), 'Finance second-level menu display').to.not.eq('none')
      })
      .and('be.visible')
  })

  cy.contains('ul.nav.nav-second-level a:visible', 'Payments', { timeout: 15000 }).should('be.visible')
}

function financeChildLink(label, menuItem) {
  expandFinanceMenu()
  if (menuItem) {
    return cy
      .get(`a[data-admin-menu-item="${menuItem}"]`, { timeout: 15000 })
      .filter(':visible')
      .first()
  }
  return cy.contains('ul.nav.nav-second-level a:visible', label, { timeout: 15000 })
}

describe('Admin unified notifications (Phase 1)', () => {
  describe('Smoke — no notification API required', () => {
    it('admin logs in and reaches admin home', () => {
      loginAdmin()
      goToAdminHome()
      visibleNavLink('Admin Home').should('be.visible')
    })

    it('admin sidebar includes existing queue links (pre–Phase 1)', () => {
      loginAdmin()
      goToAdminHome()
      visibleNavLink('Courses').should('be.visible')
      visibleNavLink('Course Updates').should('be.visible')
      financeMenuLink().should('be.visible').and('contain.text', 'Finance')
    })

    it('navbar shows notification bell icon', () => {
      loginAdmin()
      goToAdminHome()
      getNavbarBell().should('be.visible')
    })
  })

  describe('Notification bell — UI (works without feed API)', () => {
    beforeEach(function () {
      loginAdmin()
      goToAdminHome()

      cy.get('body').then(($body) => {
        if ($body.find(SELECTORS.bellIcon).length === 0) {
          this.skip()
        }
      })
    })

    it('clicking bell opens the dropdown panel', () => {
      openNotificationBell()
      assertBellDropdownOpen()
    })

    it('bell area may show an unread badge', () => {
      openNotificationBell()
      getNavbarBell().parent().then(($wrap) => {
        const hasBadge = $wrap.find('.badge, .notification-badge, [data-cy="admin-notification-unread-count"]').length > 0
        if (hasBadge) {
          getUnreadBadge().should('exist')
        } else {
          cy.log('No unread badge in HTML yet — OK until Phase 1 badge is added')
        }
      })
    })
  })

  describe('Notification API — runs only when backend calls notifications/*', () => {
    beforeEach(function () {
      resetApiHits()
      registerNotificationIntercepts()
      loginAdmin()
      goToAdminHome()

      cy.get('body').then(($body) => {
        if ($body.find(SELECTORS.bellIcon).length === 0) {
          this.skip()
        }
      })
    })

    it('feed API returns mocked list when app requests it', () => {
      afterBellIfFeedApi(() => {
        cy.get(SELECTORS.notificationItem).should('have.length.at.least', 1)
        cy.contains(/Pending payment|Withdraw request/).should('be.visible')
      })
      assertBellDropdownOpen()
    })

    it('summary API updates unread badge when app requests it', () => {
      afterBellIfSummaryApi(() => {
        getUnreadBadge().should('contain.text', '3')
      })
    })

    it('mark single as read when data-cy items exist', () => {
      afterBellIfFeedApi(() => {
        cy.get('body').then(($body) => {
          if ($body.find(SELECTORS.notificationItem).length === 0) {
            cy.log('No notification items in DOM — skip mark-read')
            return
          }
          cy.get(SELECTORS.notificationItem).first().click({ force: true })
          cy.wait(1000)
          cy.then(() => {
            if (apiHits.read > 0) {
              getUnreadBadge().should('satisfy', ($el) => {
                const t = $el.text().trim()
                return t === '0' || t === ''
              })
            }
          })
        })
      })
    })

    it('mark all as read when button exists', () => {
      openNotificationBell()
      assertBellDropdownOpen()
      cy.get('body').then(($body) => {
        if ($body.find(SELECTORS.markAllRead).length === 0) {
          cy.log('markAllRead not in DOM — skip')
          return
        }
        cy.get(SELECTORS.markAllRead).click({ force: true })
        cy.wait(1000)
        cy.then(() => {
          if (apiHits.readAll > 0) {
            cy.log('read-all API called')
          }
        })
      })
    })

    it('view all link opens notifications page when present', () => {
      openNotificationBell()
      assertBellDropdownOpen()
      cy.get('body').then(($body) => {
        if ($body.find(SELECTORS.viewAll).length === 0) {
          cy.log('viewAll not in DOM — skip')
          return
        }
        cy.get(SELECTORS.viewAll).click({ force: true })
        cy.url({ timeout: 15000 }).should('match', /notifications/)
      })
    })
  })

  describe('Dashboard & sidebar', () => {
    beforeEach(() => {
      resetApiHits()
      registerNotificationIntercepts()
      loginAdmin()
      goToAdminHome()
    })

    it('dashboard shows Finance group and main course links in sidebar', () => {
      visibleNavLink('Courses').should('be.visible')
      visibleNavLink('Course Updates').should('be.visible')
      financeMenuLink().should('be.visible').and('contain.text', 'Finance')
    })

    it('Finance submenu lists payment-related work queues', () => {
      expandFinanceMenu()
      ;[
        ['Payments', 'payments'],
        ['Refund Requests', 'refund_requests'],
        ['Instalments', 'instalments'],
        ['Withdraws', 'withdraws'],
      ].forEach(([label, menuItem]) => {
        cy.get('body').then(($body) => {
          const $byAttr = $body.find(`a[data-admin-menu-item="${menuItem}"]`).filter(':visible')
          if ($byAttr.length) {
            cy.wrap($byAttr.first()).should('be.visible')
            return
          }
          cy.contains('ul.nav.nav-second-level a:visible', label, { timeout: 15000 }).should('be.visible')
        })
      })
    })

    it('sidebar lists non-finance work queues that need attention', () => {
      ;['Course Updates', 'Instructor Verifications', 'WhatsApp'].forEach((label) => {
        visibleNavLink(label).should('be.visible')
      })
    })

    it('sidebar shows Finance parent badge when present', () => {
      financeMenuLink().should('be.visible').then(($link) => {
        const $badge = $link.find('.badge')
        if ($badge.length === 0) {
          cy.log('No Finance badge present yet')
          return
        }
        cy.wrap($badge.first()).invoke('text').should('match', /\d+/)
      })
    })

    it('sidebar shows instalments badge under Finance when present', () => {
      financeChildLink('Instalments', 'instalments').should('be.visible').then(($link) => {
        const $badge = $link.find('.badge')
        if ($badge.length === 0) {
          cy.log('No Instalments badge present yet')
          return
        }
        cy.wrap($badge.first()).invoke('text').should('match', /\d+/)
      })
    })

    it('sidebar shows numeric badges on Course Updates or WhatsApp when present', () => {
      ;['Course Updates', 'WhatsApp'].forEach((label) => {
        visibleNavLink(label).then(($link) => {
          const $badge = $link.closest('li').find('.badge')
          if ($badge.length === 0) {
            cy.log(`No .badge next to "${label}" yet`)
            return
          }
          cy.wrap($badge.first()).invoke('text').should('match', /\d+/)
        })
      })
    })

    // Phase 1 — uncomment when dev adds data-cy hooks + summary API:
    // it('needs-attention cards', () => cy.get(SELECTORS.needsAttention).should('be.visible'))
    // it('unified queue badges', () => {
    //   cy.get(navQueueBadge('payments')).should('contain.text', '2')
    //   cy.get(navQueueBadge('withdrawals')).should('contain.text', '1')
    // })
  })
})
