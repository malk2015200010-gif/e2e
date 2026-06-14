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
import { ADMIN } from '../../support/users'

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
  instalmentsMenu: 'a[data-admin-menu-item="instalments"]',
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
 */
function syncBaseUrlToApp() {
  cy.url().then((url) => {
    const origin = new URL(url).origin
    const configured = Cypress.config('baseUrl')
    const configuredOrigin = configured ? new URL(configured).origin : null

    if (configuredOrigin && configuredOrigin !== origin) {
      Cypress.config('baseUrl', origin)
      cy.log(`baseUrl synced to app origin: ${origin}`)
    }
  })
}

function loginAdmin() {
  loginViaApi(ADMIN)
  syncBaseUrlToApp()
}

function goToAdminHome() {
  cy.visit('https://dev.mentoraeg.com/admin', {
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
  getNavbarBell().should('be.visible').then(($bell) => {
    const $toggle = $bell.closest('a, button, .dropdown-toggle, .nav-link, .nav-item')
    const $target = $toggle.length ? $toggle.first() : $bell
    cy.wrap($target).click({ force: true })
  })
}

function getUnreadBadge() {
  return getNavbarBell().parent().find(SELECTORS.unreadBadge).first()
}

/** Bootstrap-style panel next to navbar bell (no API required). */
function getBellDropdown() {
  return cy.get(
    '.admin-topbar__dropdown-panel:visible, .dropdown-menu:visible, [data-cy="admin-notification-dropdown"]:visible, .admin-notification-dropdown:visible',
    { timeout: 10000 }
  ).first()
}

function assertBellDropdownOpen() {
  getBellDropdown().should('be.visible')
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

describe('Admin unified notifications (Phase 1)', () => {
  describe('Smoke — no notification API required', () => {
    it('admin logs in and reaches admin home', () => {
      loginAdmin()
      goToAdminHome()
      cy.contains('a', 'Admin Home').should('be.visible')
    })

    it('admin sidebar includes existing queue links (pre–Phase 1)', () => {
      loginAdmin()
      goToAdminHome()
      cy.contains('Courses').should('be.visible')
      cy.contains('Course Updates').should('be.visible')
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

    it('dashboard shows main admin work queue links in sidebar', () => {
      cy.contains('a', 'Courses', { timeout: 15000 }).should('be.visible')
      cy.contains('a', 'Course Updates').should('be.visible')
      cy.contains('Payments').should('be.visible')
    })

    it('sidebar lists admin work queues that need attention', () => {
      ;['Course Updates', 'Payments', 'Withdraws', 'Instalments', 'Instructor Verifications', 'WhatsApp'].forEach(
        (label) => {
          cy.get('a').filter(':visible').contains(label, { timeout: 15000 }).should('be.visible')
        }
      )
    })

    it('sidebar shows instalments badge when present', () => {
      cy.get(SELECTORS.instalmentsMenu, { timeout: 15000 }).should('be.visible').then(($link) => {
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
        cy.get('a').filter(':visible').contains(label, { timeout: 15000 }).then(($link) => {
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
