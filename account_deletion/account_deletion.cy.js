/**
 * Account deletion — web FE on staging (App Store Guideline 5.1.1(v))
 *
 * Host: https://stg.mentoraeg.com
 *
 * Every signed-in case registers a throwaway student or instructor.
 * Confirm-delete runs only on those new accounts — never on demo/admin users.
 */

import {
  BASE,
  SETTINGS_PATH,
  DELETE_PATH,
  DELETE_FORM,
  DELETE_CONFIRM_RE,
  DELETE_BTN,
  go,
  goSettings,
  pinStaging,
  stubDeleteConfirm,
  clickDeleteAccount,
  assertDeleteAccountButton,
  csrfFrom,
  registerFreshStudent,
  sessionFreshStudent,
  sessionFreshInstructor,
  deleteOwnAccountUi,
  assertDeletedAndBlocked,
  loginViaApi,
  basicAuth,
} from './account_deletion_support.js'

describe('Account deletion — Profile Settings (stg)', () => {
  before(() => {
    pinStaging()
  })

  beforeEach(() => {
    pinStaging()
  })

  // ─── UI on freshly registered users ────────────────────────────────────────

  it('AD-P-01 | [Positive] New student sees Delete Account on Profile Settings', () => {
    sessionFreshStudent()
    assertDeleteAccountButton()
    cy.get(DELETE_FORM).should('exist')
    cy.get(`${DELETE_FORM} input[name="_method"]`).should('have.value', 'DELETE')
    cy.get(DELETE_FORM)
      .should('have.attr', 'action')
      .and('include', DELETE_PATH)
    cy.contains('button, a', /sign out|log out/i).should('exist')
  })

  it('AD-P-02 | [Positive] Delete Account confirm dialog explains the action is permanent', () => {
    sessionFreshStudent()
    cy.get(DELETE_BTN, { timeout: 20000 })
      .scrollIntoView()
      .should('have.attr', 'onclick')
      .and('match', DELETE_CONFIRM_RE)
  })

  it('AD-P-03 | [Positive] Cancel on the confirm dialog does not POST delete-account', () => {
    sessionFreshStudent().then((acct) => {
      cy.intercept('POST', '**/settings/delete-account').as('deleteAccount')
      stubDeleteConfirm(false)
      clickDeleteAccount()
      cy.wait(800)
      cy.get('@deleteAccount.all').then((calls) => {
        expect(calls.length, 'cancel must not POST delete-account').to.eq(0)
      })
      cy.url().should('include', '/settings')
      assertDeleteAccountButton()
      loginViaApi({ email: acct.email, password: acct.password }).then((res) => {
        expect(res?.skipped, 'new student still logs in after cancel').to.not.eq(true)
      })
    })
  })

  it('AD-P-04 | [Positive] New instructor sees Delete Account on Profile Settings', () => {
    sessionFreshInstructor()
    assertDeleteAccountButton()
    cy.get(DELETE_FORM).should('exist')
  })

  it('AD-P-05 | [Positive] Confirming Delete Account soft-deletes a new student and blocks login', () => {
    sessionFreshStudent().then((acct) => {
      deleteOwnAccountUi()
      assertDeletedAndBlocked(acct)
    })
  })

  it('AD-P-06 | [Positive] Confirming Delete Account soft-deletes a new instructor and blocks login', () => {
    sessionFreshInstructor().then((acct) => {
      deleteOwnAccountUi()
      assertDeletedAndBlocked(acct)
    })
  })

  // ─── Negatives ─────────────────────────────────────────────────────────────

  it('AD-N-01 | [Negative] Guest is redirected away from Profile Settings', () => {
    cy.clearCookies()
    go(SETTINGS_PATH)
    cy.url({ timeout: 20000 }).should('include', '/login')
    cy.get(DELETE_FORM).should('not.exist')
  })

  it('AD-N-02 | [Negative] Guest POST /delete-account does not succeed', () => {
    cy.clearCookies()
    cy.request({
      method: 'GET',
      url: `${BASE()}/login`,
      auth: basicAuth(),
      failOnStatusCode: false,
    }).then((loginRes) => {
      const token = csrfFrom(loginRes.body)
      return cy.request({
        method: 'POST',
        url: `${BASE()}${DELETE_PATH}`,
        auth: basicAuth(),
        form: true,
        failOnStatusCode: false,
        followRedirect: false,
        body: { _token: token, _method: 'DELETE' },
      })
    }).then((res) => {
      expect(res.status, 'unauthenticated delete').to.be.oneOf([401, 403, 302, 419])
      const loc = String(res.headers?.location || '')
      if (loc) expect(loc, 'guest delete redirects to login').to.match(/login/i)
    })
  })

  it('AD-N-03 | [Negative] GET /delete-account does not delete a new signed-in student', () => {
    sessionFreshStudent().then((acct) => {
      cy.request({
        method: 'GET',
        url: `${BASE()}${DELETE_PATH}`,
        auth: basicAuth(),
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.be.oneOf([404, 405, 302, 200, 419])
      })
      goSettings()
      assertDeleteAccountButton()
      loginViaApi({ email: acct.email, password: acct.password }).then((res) => {
        expect(res?.skipped, `${acct.email} must still be able to log in`).to.not.eq(true)
      })
    })
  })

  it('AD-N-04 | [Negative] Delete POST without CSRF is rejected', () => {
    sessionFreshStudent().then((acct) => {
      cy.request({
        method: 'POST',
        url: `${BASE()}${DELETE_PATH}`,
        auth: basicAuth(),
        form: true,
        failOnStatusCode: false,
        followRedirect: false,
        body: { _method: 'DELETE' },
      }).then((res) => {
        expect(res.status, 'missing CSRF').to.be.oneOf([419, 403, 401, 302])
      })
      goSettings()
      assertDeleteAccountButton()
      loginViaApi({ email: acct.email, password: acct.password }).then((res) => {
        expect(res?.skipped, 'new student still logs in after CSRF reject').to.not.eq(true)
      })
    })
  })

  it('AD-N-05 | [Negative] Self-service delete cannot target another new user', () => {
    registerFreshStudent().then((victim) => {
      sessionFreshStudent().then((actor) => {
        cy.request({
          method: 'GET',
          url: `${BASE()}${SETTINGS_PATH}`,
          auth: basicAuth(),
          failOnStatusCode: false,
        }).then((page) => {
          const token = csrfFrom(page.body)
          return cy.request({
            method: 'POST',
            url: `${BASE()}${DELETE_PATH}`,
            auth: basicAuth(),
            form: true,
            failOnStatusCode: false,
            followRedirect: true,
            body: {
              _token: token,
              _method: 'DELETE',
              user_id: '999999',
              id: '999999',
              email: victim.email,
              confirm: true,
            },
          })
        })

        loginViaApi({ email: victim.email, password: victim.password }).then((res) => {
          expect(res?.skipped, 'other new user must still log in').to.not.eq(true)
        })
      })
    })
  })

  it('AD-N-06 | [Negative] Mobile DELETE /api/v1/auth/account without mobile auth is forbidden or missing', () => {
    sessionFreshStudent().then((acct) => {
      cy.request({
        method: 'DELETE',
        url: `${BASE()}/api/v1/auth/account`,
        auth: basicAuth(),
        failOnStatusCode: false,
        headers: { Accept: 'application/json' },
        body: { confirm: true },
      }).then((res) => {
        expect(res.status, 'web session must not delete via unauthenticated mobile API').to.be.oneOf([
          401, 403, 404, 405, 419, 422,
        ])
      })
      loginViaApi({ email: acct.email, password: acct.password }).then((res) => {
        expect(res?.skipped, 'new student still logs in after mobile probe').to.not.eq(true)
      })
    })
  })

  it('AD-N-07 | [Negative] Unknown / forged delete URL does not expose admin bulk delete', () => {
    sessionFreshStudent().then((acct) => {
      ;['/admin/users/bulk-delete', '/admin/users/soft-delete', '/dashboard/users/999999/delete'].forEach(
        (path) => {
          cy.request({
            method: 'POST',
            url: `${BASE()}${path}`,
            auth: basicAuth(),
            failOnStatusCode: false,
            form: true,
            body: { _method: 'DELETE', ids: [999999], email: acct.email },
          }).then((res) => {
            expect(res.status, path).to.be.oneOf([401, 403, 404, 405, 419, 302])
          })
        },
      )
      loginViaApi({ email: acct.email, password: acct.password }).then((res) => {
        expect(res?.skipped, 'new student still logs in after forged URLs').to.not.eq(true)
      })
    })
  })
})
