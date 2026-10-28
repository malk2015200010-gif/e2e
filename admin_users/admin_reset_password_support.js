/**
 * Superadmin reset-user-password — helpers (dev.mentoraeg.com)
 *
 * Dig UI: each /admin/users row has
 *   button.reset-password-button[data-user-id] → #resetPasswordModal
 *   form POST /admin/users/{id}/reset-password
 *
 * Emails are Cloudflare-obfuscated (data-cfemail) — never match email by visible text alone.
 */

import { getAppBase, loginViaApi } from '../../support/navigation.js'
import { basicAuth, ADMINS, STUDENT, STUDENTS } from '../../support/users.js'
import { WEAK_PASSWORDS } from '../regestration/password_policy_support.js'

export const BASE = () => getAppBase()
export { WEAK_PASSWORDS }

/**
 * Dig admin reset enforces the password checklist — `123456` is silently rejected
 * (302 back to users, password unchanged). Keep a policy-compliant baseline.
 */
export const LEGACY_PASSWORD = 'Test@1234'

/** Must differ from LEGACY_PASSWORD; satisfies dig password checklist. */
export const RESET_TO_PASSWORD = 'MentoraReset#8841'
export const VALID_NEW_PASSWORD = RESET_TO_PASSWORD
export const CURRENT_PASSWORD = LEGACY_PASSWORD

export const TARGET_USER = {
  ...(STUDENTS.find((s) => s.email === 'student2@demo.com') || STUDENT),
  // Override stale seed password — dig no longer accepts 123456 via admin reset.
  password: LEGACY_PASSWORD,
}

export const SUPERADMIN = ADMINS.superadmin

/** Cloudflare email decode (same algorithm as email-decode.min.js). */
export const decodeCfEmail = (hex) => {
  const key = parseInt(hex.slice(0, 2), 16)
  let out = ''
  for (let i = 2; i < hex.length; i += 2) {
    out += String.fromCharCode(parseInt(hex.substr(i, 2), 16) ^ key)
  }
  return out
}

/** Stub admin notification polling so it cannot hang page load behind Cypress. */
export const stubAdminNotifications = () => {
  cy.intercept('GET', '**/admin/api/notifications/**', {
    statusCode: 200,
    body: { unread_total: 0, queues: {} },
  }).as('adminNotifSummary')
  cy.intercept('GET', '**/notifications/summary*', {
    statusCode: 200,
    body: { unread_total: 0, queues: {} },
  })
  cy.intercept('GET', '**/notifications/feed*', {
    statusCode: 200,
    body: { data: [], meta: { current_page: 1, last_page: 1 } },
  })
}

export const goAdmin = (path = '') => {
  const clean = path.startsWith('/') ? path : path ? `/${path}` : ''
  stubAdminNotifications()
  return cy.visit(`${BASE()}/admin${clean}`, {
    auth: basicAuth(),
    failOnStatusCode: false,
    // Must be >= cypress.config pageLoadTimeout; 60s was timing out on /admin/users.
    timeout: 120000,
    retryOnNetworkFailure: true,
  })
}

export const loginSuperadminUsers = () => {
  loginViaApi(SUPERADMIN)
  goAdmin('/users')
  cy.url({ timeout: 30000 }).should('include', '/admin')
  cy.url().should('include', '/users')
  cy.get('body', { timeout: 20000 }).should('exist')
  cy.get('body').should('not.contain.text', 'Error 500')
  cy.get('body').should('not.contain.text', '403 Forbidden')
}

export const searchUsers = (query) => {
  cy.get('body').then(($body) => {
    const $input = $body
      .find(
        'input[name="search"], input[type="search"], input[placeholder*="Search"], input[placeholder*="search"], input[name="q"]',
      )
      .filter(':visible')
      .first()
    if ($input.length) {
      cy.wrap($input).clear({ force: true }).type(`${query}{enter}`, { force: true })
      cy.wait(800)
      return
    }
    goAdmin(`/users?search=${encodeURIComponent(query)}`)
  })
}

/**
 * Find Change password for TARGET_USER only (by data-user-id / decoded email).
 * Dig search is unreliable; walk /admin/users pagination (user ~page 10).
 */
export const findResetPasswordControl = () => {
  const userId = String(TARGET_USER.id || '')
  const email = TARGET_USER.email

  const findOnPage = ($body) => {
    if (userId) {
      const $byId = $body.find(`button.reset-password-button[data-user-id="${userId}"]`)
      if ($byId.length) return $byId.first()
    }

    let matched = null
    $body.find('tr').each((_, tr) => {
      const $tr = Cypress.$(tr)
      const $cf = $tr.find('a.__cf_email__[data-cfemail]')
      let rowEmail = ''
      if ($cf.length) {
        try {
          rowEmail = decodeCfEmail($cf.attr('data-cfemail') || '')
        } catch (_) {
          rowEmail = ''
        }
      }
      if (rowEmail === email) {
        const $rowBtn = $tr.find('button.reset-password-button')
        if ($rowBtn.length) matched = $rowBtn.first()
        return false
      }
    })
    return matched
  }

  const tryPages = (remaining) =>
    cy.get('body', { timeout: 15000 }).then(($body) => {
      const $btn = findOnPage($body)
      if ($btn && $btn.length) return cy.wrap($btn)

      if (remaining <= 0) {
        throw new Error(
          `Could not find reset-password-button for ${email} (id=${userId}) on /admin/users.`,
        )
      }

      const $next = $body
        .find('a[rel="next"], .pagination a')
        .filter(':visible')
        .filter((_, el) => {
          const t = (el.textContent || '').trim().toLowerCase()
          const rel = el.getAttribute('rel') || ''
          const parentClass = el.parentElement?.className || ''
          if (/disabled/i.test(parentClass)) return false
          return rel === 'next' || t === '›' || t === '»' || t === 'next'
        })

      if (!$next.length) {
        throw new Error(
          `Could not find user ${email} (id=${userId}) — not on page and no pagination next.`,
        )
      }
      cy.wrap($next.first()).click({ force: true })
      cy.wait(500)
      return tryPages(remaining - 1)
    })

  goAdmin('/users')
  return tryPages(50)
}

export const openResetPasswordForm = () => {
  findResetPasswordControl().scrollIntoView().click({ force: true })

  cy.get('#resetPasswordModal', { timeout: 10000 }).should('be.visible')
  cy.get('#resetPasswordModal #admin_reset_password').should('be.visible')
  cy.get('#resetPasswordModal #admin_reset_password_confirmation').should('be.visible')

  // Guard: form action must target TARGET_USER, not another row / account password.
  cy.get('#resetPasswordForm').should('have.attr', 'action').and('include', `/admin/users/${TARGET_USER.id}/reset-password`)
}

export const fillResetPasswordForm = (password, confirm = password) => {
  cy.get('#resetPasswordModal #admin_reset_password')
    .should('be.visible')
    .clear({ force: true })
    .type(password, { force: true, log: false, parseSpecialCharSequences: false })
  cy.get('#resetPasswordModal #admin_reset_password_confirmation')
    .should('be.visible')
    .clear({ force: true })
    .type(confirm, { force: true, log: false, parseSpecialCharSequences: false })
  cy.get('#resetPasswordModal #admin_reset_password').should('have.value', password)
  cy.get('#resetPasswordModal #admin_reset_password_confirmation').should('have.value', confirm)
}

export const submitResetPasswordForm = ({ expectRequest = true, expectedPassword } = {}) => {
  cy.intercept('POST', '**/admin/users/*/reset-password').as('adminResetPassword')
  cy.get('#resetPasswordForm').should('have.attr', 'action').and('match', /\/admin\/users\/\d+\/reset-password/)
  cy.get('#resetPasswordForm').then(($form) => {
    const el = $form[0]
    if (el && typeof el.requestSubmit === 'function') el.requestSubmit()
    else el.submit()
  })
  if (expectRequest) {
    cy.wait('@adminResetPassword', { timeout: 20000 }).then((interception) => {
      const status = interception.response?.statusCode
      const reqUrl = interception.request?.url || ''
      const body = interception.request?.body
      expect(reqUrl, 'reset URL targets TARGET_USER').to.include(
        `/admin/users/${TARGET_USER.id}/reset-password`,
      )
      expect(status, 'reset-password HTTP status').to.be.oneOf([200, 302])
      if (expectedPassword) {
        if (body && typeof body === 'object') {
          expect(body.password, 'POST password field').to.eq(expectedPassword)
          expect(body.password_confirmation, 'POST password_confirmation').to.eq(expectedPassword)
        } else {
          const raw = decodeURIComponent(String(body || '').replace(/\+/g, ' '))
          expect(raw, 'POST body includes password').to.include(`password=${expectedPassword}`)
        }
      }
    })
  }
}

export const assertResetSuccessUi = () => {
  // After a real POST, dig redirects back to /admin/users (modal gone).
  cy.url({ timeout: 20000 }).should('include', '/admin/users')
  cy.get('#resetPasswordModal #admin_reset_password:visible').should('not.exist')
}

/**
 * Force-set TARGET_USER password via admin API (same endpoint the UI uses).
 * Used to stabilize dig state — UI tests still exercise the modal separately.
 */
export const ensureTargetPasswordViaApi = (password = LEGACY_PASSWORD) => {
  const auth = basicAuth()
  const userId = TARGET_USER.id
  expect(userId, 'TARGET_USER.id').to.exist

  loginViaApi(SUPERADMIN)

  return cy
    .request({
      method: 'GET',
      url: `${BASE()}/admin/users`,
      auth,
      failOnStatusCode: false,
    })
    .then((res) => {
      const html = String(res.body || '')
      const tokenMatch =
        html.match(/id="resetPasswordForm"[\s\S]{0,500}?name="_token"\s+value="([^"]+)"/) ||
        html.match(/name="_token"\s+value="([^"]+)"/)
      const csrfToken = tokenMatch ? tokenMatch[1] : ''
      expect(csrfToken, 'CSRF for admin reset').to.have.length.greaterThan(10)

      return cy.request({
        method: 'POST',
        url: `${BASE()}/admin/users/${userId}/reset-password`,
        auth,
        form: true,
        followRedirect: true,
        failOnStatusCode: false,
        body: {
          _token: csrfToken,
          password,
          password_confirmation: password,
        },
      })
    })
    .then(() => {
      loginWorks(TARGET_USER.email, password).then((ok) => {
        expect(ok, `ensureTargetPasswordViaApi: ${TARGET_USER.email} must login with seeded password`).to.eq(
          true,
        )
      })
    })
}

/** Try login; yields boolean. Strict — no “empty URL + 200” false positives. */
export const loginWorks = (email, password) => {
  cy.clearCookies()
  cy.clearLocalStorage()
  const auth = basicAuth()
  return cy
    .request({
      method: 'GET',
      url: `${BASE()}/login`,
      auth,
      failOnStatusCode: false,
    })
    .then((res) => {
      const html = String(res.body || '')
      const tokenMatch =
        html.match(/name="_token"\s+value="([^"]+)"/) ||
        html.match(/<meta name="csrf-token" content="([^"]+)"/)
      const csrfToken = tokenMatch ? tokenMatch[1] : ''
      return cy.request({
        method: 'POST',
        url: `${BASE()}/login`,
        auth,
        form: true,
        followRedirect: true,
        failOnStatusCode: false,
        body: { _token: csrfToken, email, password },
      })
    })
    .then((res) => {
      const body = String(res.body || '')
      const redirects = res.redirects || []
      const finalUrl = String(
        redirects.slice(-1)[0] ||
          res.allRequestResponses?.slice(-1)?.[0]?.['Request URL'] ||
          '',
      )
      const onLoginPage =
        /\/login(?:\?|#|$)/.test(finalUrl) ||
        (/name="email"/.test(body) &&
          /name="password"/.test(body) &&
          /login/i.test(body) &&
          !/logout|log out|sign out/i.test(body))

      const ok =
        !onLoginPage &&
        (/logout|log out|sign out|dashboard/i.test(body) ||
          (/^https?:\/\/[^/]+\/?(\?.*)?$/i.test(finalUrl) && !/\/login/i.test(finalUrl)) ||
          /\/dashboard/i.test(finalUrl))

      cy.log(`loginWorks(${email}): ok=${ok} url=${finalUrl.slice(0, 140)} status=${res.status}`)
      return cy.wrap(Boolean(ok))
    })
}

export const assertLoginWorks = (email, password, expectOk = true) => {
  loginWorks(email, password).then((ok) => {
    if (expectOk && !ok) {
      throw new Error(
        `Login failed for ${email} with the expected password. ` +
          'If this follows a UI reset, the new password did not persist (or baseline was wrong).',
      )
    }
    if (!expectOk && ok) {
      throw new Error(
        `Expected login to fail for ${email}, but it succeeded — password was not changed ` +
          '(UI reset may not have submitted the intended password, or baseline password was already different).',
      )
    }
    expect(ok).to.eq(expectOk)
  })
}
