/**
 * Account deletion helpers — https://stg.mentoraeg.com (web FE for App Store 5.1.1(v))
 *
 * Web:
 *   GET  /dashboard/settings
 *   POST /dashboard/settings/delete-account  (_method=DELETE) + window.confirm
 *
 * Always register throwaway users. Never confirm-delete shared demo accounts.
 */

import { getAppBase, loginViaApi, loginAndVisit, dismissCookieBanner } from '../../support/navigation.js'
import { basicAuth } from '../../support/users.js'
import {
  fillRegisterForm,
  submitRegister,
  assertRegistrationSucceeded,
  VALID_NEW_PASSWORD,
  uniqueRegisterEmail,
} from '../regestration/password_policy_support.js'

export { basicAuth, VALID_NEW_PASSWORD, uniqueRegisterEmail, loginViaApi, loginAndVisit }

export const BASE = () => getAppBase()
export const SETTINGS_PATH = '/dashboard/settings'
export const DELETE_PATH = '/dashboard/settings/delete-account'

export const DELETE_CONFIRM_RE =
  /Are you sure you want to delete your account\? This action cannot be undone and all associated data will be lost\./i

export const DELETE_BTN = 'button[form="delete-account-form"]'

export const DELETE_FORM = '#delete-account-form'

export const pinStaging = () => {
  Cypress.config('baseUrl', getAppBase())
}

export const go = (path) =>
  cy
    .visit(`${BASE()}${path}`, {
      auth: basicAuth(),
      failOnStatusCode: false,
      timeout: 120000,
      retryOnNetworkFailure: true,
    })
    .then(() => dismissCookieBanner())

export const goSettings = () => {
  go(SETTINGS_PATH)
  cy.url({ timeout: 20000 }).should('include', '/settings')
}

export const stubDeleteConfirm = (accept) => {
  cy.window().then((win) => {
    if (typeof win.confirm === 'function' && win.confirm.restore) win.confirm.restore()
    cy.stub(win, 'confirm').callsFake((msg) => {
      expect(String(msg || ''), 'Delete account confirm copy').to.match(DELETE_CONFIRM_RE)
      return Boolean(accept)
    })
  })
}

export const assertDeleteAccountButton = () => {
  cy.get(DELETE_BTN, { timeout: 20000 })
    .scrollIntoView()
    .should('contain.text', 'Delete Account')
    .and('have.class', 'btn-danger')
}

export const clickDeleteAccount = () => {
  cy.get(DELETE_BTN, { timeout: 15000 }).scrollIntoView().should('contain.text', 'Delete Account').click()
}

export const csrfFrom = (html = '') => {
  const m =
    String(html).match(/name="_token"\s+value="([^"]+)"/) ||
    String(html).match(/<meta name="csrf-token" content="([^"]+)"/)
  return m ? m[1] : ''
}

const registerFresh = (role, name) => {
  const email = uniqueRegisterEmail(role === 'instructor' ? 'deli' : 'del')
  const password = VALID_NEW_PASSWORD
  return fillRegisterForm({ name, email, password, role }).then((acct) => {
    submitRegister()
    assertRegistrationSucceeded()
    return cy.wrap({ ...acct, email, password, role })
  })
}

export const registerFreshStudent = () => registerFresh('student', 'Delete Account Tester')

export const registerFreshInstructor = () => registerFresh('instructor', 'Delete Account Instructor')

export const signInFresh = (acct) => {
  expect(acct?.email, 'throwaway email').to.be.a('string').and.not.be.empty
  return loginViaApi({ email: acct.email, password: acct.password }).then(() => {
    goSettings()
    return cy.wrap(acct)
  })
}

/** Register a new student, sign in, open Profile Settings. */
export const sessionFreshStudent = () => registerFreshStudent().then((acct) => signInFresh(acct))

/** Register a new instructor, sign in, open Profile Settings. */
export const sessionFreshInstructor = () => registerFreshInstructor().then((acct) => signInFresh(acct))

export const deleteOwnAccountUi = () => {
  cy.intercept('POST', '**/settings/delete-account').as('deleteAccount')
  go(SETTINGS_PATH)
  cy.get('body', { timeout: 20000 }).then(($b) => {
    const hasBtn = $b
      .find('button')
      .toArray()
      .some((el) => /^Delete Account$/i.test((el.textContent || '').trim()))

    if (hasBtn) {
      stubDeleteConfirm(true)
      clickDeleteAccount()
      cy.wait('@deleteAccount', { timeout: 25000 }).its('response.statusCode').should('be.oneOf', [200, 201, 302])
      return
    }

    const pageToken =
      $b.find(`${DELETE_FORM} input[name="_token"]`).attr('value') ||
      $b.find('input[name="_token"]').first().attr('value') ||
      $b.find('meta[name="csrf-token"]').attr('content') ||
      ''
    expect(pageToken, 'CSRF for delete-account fallback').to.have.length.greaterThan(8)
    cy.request({
      method: 'POST',
      url: `${BASE()}${DELETE_PATH}`,
      auth: basicAuth(),
      form: true,
      failOnStatusCode: false,
      followRedirect: true,
      body: { _token: pageToken, _method: 'DELETE', confirm: true },
    }).then((res) => {
      expect(res.status).to.be.oneOf([200, 201, 302])
    })
  })
}

export const assertDeletedAndBlocked = (acct) => {
  cy.url({ timeout: 25000 }).should((url) => {
    expect(url, 'after delete').to.satisfy((u) => u.includes('/login') || !u.includes('/settings'))
  })
  go('/dashboard')
  cy.url({ timeout: 20000 }).should('include', '/login')
  go(SETTINGS_PATH)
  cy.url({ timeout: 20000 }).should('include', '/login')
  return loginViaApi({ email: acct.email, password: acct.password }, { allowFailure: true }).then((res) => {
    expect(res?.skipped, `${acct.email} must not authenticate after deletion`).to.eq(true)
  })
}

export const assertCannotLogin = (email, password) =>
  loginViaApi({ email, password }, { allowFailure: true }).then((res) => {
    expect(res?.skipped, `${email} must not authenticate after deletion`).to.eq(true)
  })
