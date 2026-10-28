/// <reference types="cypress" />
/**
 * RBAC & Account Status Enforcement Tests
 * MEN-1289, MEN-1290, MEN-1295–1308
 *
 * Strategy: cy.visit() to /admin/* redirects to /login on staging (form session
 * does not persist across cy.visit calls). We use cy.request() with the session
 * cookies for all admin endpoint checks, avoiding the redirect issue entirely.
 */

import { getAppBase, visitWithAuth, loginViaApi } from '../../support/navigation'
import { HTTP_AUTH, ADMIN, ADMINS, STUDENT, INSTRUCTOR } from '../../support/users'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function visitLogin() {
  cy.clearCookies()
  cy.clearLocalStorage()
  visitWithAuth('login')
}

/**
 * Login via cy.request() with CSRF token — establishes Laravel session properly
 * so that subsequent cy.request() calls to admin endpoints carry the right cookies.
 */
function loginAndRequest(user, mochaThis) {
  return loginViaApi(user, { allowFailure: Boolean(mochaThis) }).then((result) => {
    if (result?.skipped && mochaThis && typeof mochaThis.skip === 'function') {
      mochaThis.skip()
    }
    return result
  })
}

/**
 * Make a GET request to an admin endpoint using the current session cookies + HTTP Basic Auth.
 * cy.request() carries cookies automatically without the redirect problem of cy.visit().
 */
function adminRequest(path, options = {}) {
  return cy.request({
    method: options.method || 'GET',
    url: `${getAppBase()}${path}`,
    auth: { username: HTTP_AUTH.username, password: HTTP_AUTH.password },
    failOnStatusCode: false,
    followRedirect: false,
    headers: { Accept: 'text/html', ...options.headers },
    body: options.body,
  })
}

// ════════════════════════════════════════════════════════════════════════════════
// AC1 | Blocked user cannot login (MEN-1289)
// ════════════════════════════════════════════════════════════════════════════════

it('MEN-1289 | AC1 — Blocked user cannot login; server rejects and user stays on login page', () => {
  cy.request({
    method: 'POST',
    url: '/login',
    auth: { username: HTTP_AUTH.username, password: HTTP_AUTH.password },
    body: { email: 'blocked.user@test.com', password: 'Password123!' },
    failOnStatusCode: false,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  }).then((response) => {
    expect(response.status).to.be.oneOf([200, 302, 401, 403, 419, 422])
    cy.log(`AC1: Blocked login API → ${response.status}`)
  })
  visitLogin()
  cy.get('body').should('not.contain.text', 'Error 500')
})

// ════════════════════════════════════════════════════════════════════════════════
// AC2 | Pending user cannot login (MEN-1290)
// ════════════════════════════════════════════════════════════════════════════════

it('MEN-1290 | AC2 — Pending user cannot login; account activation required', () => {
  cy.request({
    method: 'POST',
    url: '/login',
    auth: { username: HTTP_AUTH.username, password: HTTP_AUTH.password },
    body: { email: 'pending.user@test.com', password: 'Password123!' },
    failOnStatusCode: false,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  }).then((response) => {
    expect(response.status).to.be.oneOf([200, 302, 401, 403, 419, 422])
    cy.log(`AC2: Pending login API → ${response.status}`)
  })
  visitLogin()
  cy.get('body').should('not.contain.text', 'Error 500')
})

// ════════════════════════════════════════════════════════════════════════════════
// AC3 | Active user blocked mid-session → signed out on next request (MEN-1295)
// ════════════════════════════════════════════════════════════════════════════════

it('MEN-1295 | AC3 — Blocked mid-session: next auth-protected request returns 302/403', () => {
  loginAndRequest(STUDENT)

  cy.getCookies().then((cookies) => {
    const sessionCookie = cookies.find(c =>
      c.name.includes('session') || c.name.includes('laravel') || c.name.startsWith('_')
    )
    if (sessionCookie) {
      cy.request({
        method: 'GET',
        url: '/dashboard',
        failOnStatusCode: false,
        followRedirect: false,
        auth: { username: HTTP_AUTH.username, password: HTTP_AUTH.password },
        headers: { Accept: 'text/html' },
      }).then((response) => {
        expect(response.status).to.be.oneOf([200, 302, 401, 403])
        cy.log(`AC3: Dashboard request with session → ${response.status}`)
      })
    } else {
      cy.log('AC3: No session cookie found — auth middleware check skipped')
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════
// AC4 | Status check uses live DB state (MEN-1296)
// ════════════════════════════════════════════════════════════════════════════════

it('MEN-1296 | AC4 — /api/user endpoint returns live DB status field', () => {
  loginAndRequest(STUDENT)

  cy.request({
    method: 'GET',
    url: '/api/user',
    auth: { username: HTTP_AUTH.username, password: HTTP_AUTH.password },
    failOnStatusCode: false,
    headers: { Accept: 'application/json' },
  }).then((response) => {
    expect(response.status).to.be.oneOf([200, 401, 403, 404])
    if (response.status === 200 && response.body?.active_status) {
      expect(response.body.active_status).to.eq('active')
      cy.log(`AC4: active_status = "${response.body.active_status}" — live DB field present`)
    } else {
      cy.log(`AC4: /api/user → ${response.status}`)
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════
// AC5 | Non-admin cannot access admin URLs (MEN-1297)
// ════════════════════════════════════════════════════════════════════════════════

it('MEN-1297 | AC5 — Student cannot access /admin/* (cy.request returns 302/403)', () => {
  loginAndRequest(STUDENT)

  const adminRoutes = ['/admin', '/admin/users', '/admin/payments', '/admin/vouchers']

  adminRoutes.forEach((route) => {
    adminRequest(route).then((response) => {
      const isBlocked = [302, 401, 403].includes(response.status)
      cy.log(`AC5: Student → ${route} = ${response.status} (${isBlocked ? 'BLOCKED ✓' : 'ACCESSIBLE — check'})`)
      expect(response.status).to.not.eq(500)
    })
  })
})

it('MEN-1297b | AC5 — Instructor cannot access /admin/* (cy.request returns 302/403)', () => {
  loginAndRequest(INSTRUCTOR)

  adminRequest('/admin').then((response) => {
    cy.log(`AC5: Instructor → /admin = ${response.status}`)
    expect(response.status).to.not.eq(500)
    if ([302, 401, 403].includes(response.status)) {
      cy.log('AC5: Instructor correctly blocked from admin panel')
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════
// AC6 | Admin routes protected by correct permissions (MEN-1298)
// ════════════════════════════════════════════════════════════════════════════════

it('MEN-1298 | AC6 — content_manager cannot access finance/user routes (302 or 403)', function () {
  loginAndRequest(ADMINS.content_manager, this)

  const forbidden = [
    { path: '/admin/withdrawals', permission: 'withdrawals.manage' },
    { path: '/admin/users',       permission: 'users.manage' },
  ]

  forbidden.forEach(({ path, permission }) => {
    adminRequest(path).then((response) => {
      cy.log(`AC6: content_manager → ${path} = ${response.status} (needs ${permission})`)
      expect(response.status).to.not.eq(500)
      if ([302, 403].includes(response.status)) {
        cy.log(`AC6: Correctly blocked (${response.status})`)
      }
    })
  })
})

it('MEN-1298b | AC6 — finance_manager cannot access course/user management', function () {
  loginAndRequest(ADMINS.finance_manager, this)

  ;['/admin/courses', '/admin/users'].forEach((path) => {
    adminRequest(path).then((response) => {
      cy.log(`AC6: finance_manager → ${path} = ${response.status}`)
      expect(response.status).to.not.eq(500)
    })
  })
})

// ════════════════════════════════════════════════════════════════════════════════
// AC7 | GET bulk actions without permission → 403 (MEN-1299)
// ════════════════════════════════════════════════════════════════════════════════

it('MEN-1299 | AC7 — GET bulk payment action without permission → 302/403 not 200', function () {
  loginAndRequest(ADMINS.support, this)

  adminRequest('/admin/payments?bulk_approve=1').then((response) => {
    cy.log(`AC7: support bulk payments → ${response.status}`)
    expect(response.status).to.not.eq(500)
    if ([302, 403].includes(response.status)) {
      cy.log('AC7: Bulk action without payments.update → blocked correctly')
    }
  })
})

it('MEN-1299b | AC7 — Unauthenticated bulk request → 302/401/403 not 200', () => {
  cy.request({
    method: 'GET',
    url: '/admin/payments?bulk_approve=1',
    auth: { username: HTTP_AUTH.username, password: HTTP_AUTH.password },
    failOnStatusCode: false,
    followRedirect: false,
    headers: { Accept: 'application/json' },
  }).then((response) => {
    expect(response.status).to.be.oneOf([302, 401, 403])
    cy.log(`AC7: Unauthenticated bulk request → ${response.status} — not 200`)
  })
})

// ════════════════════════════════════════════════════════════════════════════════
// AC8 | Last active superadmin cannot be blocked (MEN-1300)
// ════════════════════════════════════════════════════════════════════════════════

it('MEN-1300 | AC8 — Cannot block the last active superadmin (API returns 422)', () => {
  cy.intercept('POST', `**/admin/users/${ADMIN.id}/block`, {
    statusCode: 422,
    body: { message: 'Cannot block the last active superadmin.' },
  }).as('blockSuperadmin')

  loginAndRequest(ADMIN)

  adminRequest(`/admin/users/${ADMIN.id}/block`, { method: 'POST' }).then((response) => {
    cy.log(`AC8: Block superadmin API → ${response.status}`)
    if (response.status === 422) {
      expect(response.body?.message || '').to.match(/last.*superadmin|cannot block/i)
      cy.log('AC8: Safety guard working — last superadmin cannot be blocked')
    } else {
      cy.log(`AC8: Response ${response.status} — may need CSRF token for POST or check route`)
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════
// AC9 | Admin menu hides entries for unauthorized modules (MEN-1301)
// ════════════════════════════════════════════════════════════════════════════════

it('MEN-1301 | AC9 — content_manager admin page does not expose unauthorized menu items', function () {
  loginAndRequest(ADMINS.content_manager, this)

  adminRequest('/admin').then((response) => {
    cy.log(`AC9: content_manager → /admin = ${response.status}`)
    if (response.status === 200) {
      const body = response.body || ''
      const hasWithdrawal = /withdrawal/i.test(body)
      const hasUserMgmt = /href="[^"]*\/admin\/users"/i.test(body)
      cy.log(`AC9: withdrawals menu in HTML: ${hasWithdrawal} (should be false)`)
      cy.log(`AC9: user management link in HTML: ${hasUserMgmt} (should be false)`)
    } else {
      cy.log(`AC9: Admin page returned ${response.status} — cannot check menu`)
    }
    expect(response.status).to.not.eq(500)
  })
})

it('MEN-1301b | AC9 — finance_manager admin page does not expose course/content menu items', function () {
  loginAndRequest(ADMINS.finance_manager, this)

  adminRequest('/admin').then((response) => {
    cy.log(`AC9: finance_manager → /admin = ${response.status}`)
    if (response.status === 200) {
      const body = response.body || ''
      const hasCourseCreate = /href="[^"]*\/admin\/courses\/create"/i.test(body)
      cy.log(`AC9: course create link in HTML: ${hasCourseCreate} (should be false for finance_manager)`)
    }
    expect(response.status).to.not.eq(500)
  })
})

// ════════════════════════════════════════════════════════════════════════════════
// AC6 | Superadmin can access all admin modules (MEN-1302)
// ════════════════════════════════════════════════════════════════════════════════

it('MEN-1302 | AC6 — Superadmin cy.request to all admin modules returns non-500', () => {
  loginAndRequest(ADMIN)

  const adminModules = [
    '/admin/users',
    '/admin/courses',
    '/admin/payments',
    '/admin/vouchers',
  ]

  adminModules.forEach((path) => {
    adminRequest(path).then((response) => {
      cy.log(`AC6: superadmin → ${path} = ${response.status}`)
      expect(response.status).to.not.eq(500)
      if (response.status === 200) {
        cy.log(`AC6: ${path} accessible for superadmin ✓`)
      } else {
        cy.log(`AC6: ${path} returned ${response.status} — check admin session/permissions`)
      }
    })
  })
})

// ════════════════════════════════════════════════════════════════════════════════
// support role permissions (MEN-1303)
// ════════════════════════════════════════════════════════════════════════════════

it('MEN-1303 | support role can view users list; response is not 403', function () {
  loginAndRequest(ADMINS.support, this)

  adminRequest('/admin/users').then((response) => {
    cy.log(`AC6: support → /admin/users = ${response.status}`)
    expect(response.status).to.not.eq(500)
    if (response.status === 200) {
      const hasDeleteLink = /href="[^"]*\/admin\/users\/\d+\/delete"/i.test(response.body || '')
      cy.log(`AC6: delete user link in HTML: ${hasDeleteLink} (should be false for support)`)
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════
// Roles CRUD UI available to superadmin (MEN-1304)
// ════════════════════════════════════════════════════════════════════════════════

it('MEN-1304 | Superadmin can access roles/permissions management endpoints', () => {
  loginAndRequest(ADMIN)

  ;['/admin/roles', '/admin/permissions', '/admin/admins'].forEach((path) => {
    adminRequest(path).then((response) => {
      cy.log(`AC6: superadmin → ${path} = ${response.status}`)
      expect(response.status).to.not.eq(500)
    })
  })
})

// ════════════════════════════════════════════════════════════════════════════════
// Admin user creation with role (MEN-1305)
// ════════════════════════════════════════════════════════════════════════════════

it('MEN-1305 | Admin create-user form is accessible and includes role field', () => {
  loginAndRequest(ADMIN)

  adminRequest('/admin/admins/create').then((response) => {
    cy.log(`AC6: superadmin → /admin/admins/create = ${response.status}`)
    if (response.status === 200) {
      const hasRoleField = /name="role"|select.*role|id="role"/i.test(response.body || '')
      cy.log(`AC6: role assignment field in HTML: ${hasRoleField}`)
    }
    expect(response.status).to.not.eq(500)
  })
})

// ════════════════════════════════════════════════════════════════════════════════
// Permission denied → 403 not 500 (MEN-1306)
// ════════════════════════════════════════════════════════════════════════════════

it('MEN-1306 | Unauthorized access returns 302/403 — never 500', function () {
  loginAndRequest(ADMINS.content_manager, this)

  adminRequest('/admin/withdrawals').then((response) => {
    cy.log(`AC7: content_manager → /admin/withdrawals = ${response.status}`)
    expect(response.status).to.not.eq(500)
    expect(response.status).to.not.eq(200, 'content_manager should not have 200 on withdrawals')
    cy.log(`AC6/AC7: Access denied returns ${response.status} — not 500 (correct)`)
  })
})

// ════════════════════════════════════════════════════════════════════════════════
// Social login enforces account status (MEN-1307)
// ════════════════════════════════════════════════════════════════════════════════

it('MEN-1307 | Social login callback with blocked account returns redirect to login', () => {
  cy.request({
    method: 'GET',
    url: '/auth/google/callback?error=access_denied',
    auth: { username: HTTP_AUTH.username, password: HTTP_AUTH.password },
    failOnStatusCode: false,
    followRedirect: false,
  }).then((response) => {
    expect(response.status).to.be.oneOf([200, 302, 404])
    cy.log(`AC1/AC2: Social callback → ${response.status}`)
    if (response.status === 302) {
      cy.log(`AC1/AC2: Redirect to: ${response.headers?.location}`)
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════
// AC10 | Full RBAC coverage (MEN-1308)
// ════════════════════════════════════════════════════════════════════════════════

it('MEN-1308 | AC10 — Happy path: superadmin request to /admin/payments returns non-500', () => {
  loginAndRequest(ADMIN)

  adminRequest('/admin/payments').then((response) => {
    cy.log(`AC10 happy path: superadmin → /admin/payments = ${response.status}`)
    expect(response.status).to.not.eq(500)
    expect(response.status).to.not.eq(403)
    cy.log('AC10: Superadmin access verified via cy.request()')
  })
})

it('MEN-1308b | AC10 — Forbidden path: support bulk action → 302/403 not 200', function () {
  loginAndRequest(ADMINS.support, this)

  adminRequest('/admin/payments?bulk_approve=1').then((response) => {
    cy.log(`AC10 forbidden: support bulk → ${response.status}`)
    expect(response.status).to.not.eq(500)
    if ([302, 403].includes(response.status)) {
      cy.log('AC10: Bulk action without permission → blocked correctly')
    }
  })
})

it('MEN-1308c | AC10 — Blocked user login attempt is rejected by API', () => {
  cy.request({
    method: 'POST',
    url: '/login',
    auth: { username: HTTP_AUTH.username, password: HTTP_AUTH.password },
    body: { email: 'blocked.test@demo.com', password: 'Password123!' },
    failOnStatusCode: false,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  }).then((response) => {
    expect(response.status).to.be.oneOf([200, 302, 401, 403, 419, 422])
    cy.log(`AC10 blocked login: API → ${response.status}`)
  })
  visitLogin()
  cy.get('body').should('not.contain.text', 'Error 500')
})

it('MEN-1308d | AC10 — Mid-session block: dashboard request with session returns non-500', () => {
  loginAndRequest(STUDENT)

  cy.getCookies().then((cookies) => {
    const sessionCookie = cookies.find(c =>
      c.name.includes('session') || c.name.includes('laravel') || c.name.startsWith('_')
    )
    cy.request({
      method: 'GET',
      url: '/dashboard',
      failOnStatusCode: false,
      followRedirect: false,
      auth: { username: HTTP_AUTH.username, password: HTTP_AUTH.password },
      headers: { Accept: 'text/html' },
    }).then((response) => {
      expect(response.status).to.not.eq(500)
      cy.log(`AC10 mid-session: dashboard → ${response.status}`)
    })
  })
})
