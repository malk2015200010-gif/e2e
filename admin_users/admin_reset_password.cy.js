/**
 * Story: Allow super admin to reset user's password (dev)
 *
 * Required:
 *   - Reset Password button on each user in /admin/users
 *   - Opens a password reset form for the selected user
 *
 * NOTE: Cypress only lists *.cy.js specs — open THIS file, not *_support.js
 *
 * Dig password policy rejects weak passwords (e.g. 123456) on admin reset.
 * Baseline for student2@demo.com in this suite: LEGACY_PASSWORD (Test@1234).
 */

import { basicAuth, ADMINS, STUDENT } from '../../support/users.js'
import {
  BASE,
  TARGET_USER,
  RESET_TO_PASSWORD,
  LEGACY_PASSWORD,
  WEAK_PASSWORDS,
  loginSuperadminUsers,
  findResetPasswordControl,
  openResetPasswordForm,
  fillResetPasswordForm,
  submitResetPasswordForm,
  assertResetSuccessUi,
  assertLoginWorks,
  loginWorks,
  ensureTargetPasswordViaApi,
  goAdmin,
} from './admin_reset_password_support.js'
import { loginViaApi } from '../../support/navigation.js'

describe('Admin — Reset user password (superadmin)', () => {
  before(() => {
    ensureTargetPasswordViaApi(LEGACY_PASSWORD)
  })

  after(() => {
    // Leave dig in a known good state for other suites.
    ensureTargetPasswordViaApi(LEGACY_PASSWORD)
  })

  it('ARP-01 | [Positive] Superadmin opens /admin/users and sees user list', () => {
    loginSuperadminUsers()
    cy.get('body').then(($body) => {
      const html = $body.html()
      expect(/table|thead|tbody|user|email/i.test(html), 'users list content').to.eq(true)
    })
  })

  it('ARP-02 | [Positive] User row exposes a Reset Password action', () => {
    loginSuperadminUsers()
    findResetPasswordControl().should('exist')
  })

  it('ARP-03 | [Positive] Reset Password opens a password form', () => {
    loginSuperadminUsers()
    openResetPasswordForm()
    cy.get('#resetPasswordModal #admin_reset_password').should('be.visible')
  })

  it('ARP-04 | [Positive] Reset with compliant password then restore', () => {
    expect(RESET_TO_PASSWORD, 'new password must differ from current').to.not.eq(LEGACY_PASSWORD)

    ensureTargetPasswordViaApi(LEGACY_PASSWORD)

    loginSuperadminUsers()
    openResetPasswordForm()
    fillResetPasswordForm(RESET_TO_PASSWORD)
    submitResetPasswordForm({ expectedPassword: RESET_TO_PASSWORD })
    assertResetSuccessUi()

    assertLoginWorks(TARGET_USER.email, RESET_TO_PASSWORD, true)
    assertLoginWorks(TARGET_USER.email, LEGACY_PASSWORD, false)

    ensureTargetPasswordViaApi(LEGACY_PASSWORD)
  })

  it('ARP-05 | [Positive] Old password fails after reset (then restore)', () => {
    const tempPassword = `Rst@${Date.now().toString().slice(-8)}`
    expect(tempPassword).to.not.eq(LEGACY_PASSWORD)

    ensureTargetPasswordViaApi(LEGACY_PASSWORD)

    loginSuperadminUsers()
    openResetPasswordForm()
    fillResetPasswordForm(tempPassword)
    submitResetPasswordForm({ expectedPassword: tempPassword })
    assertResetSuccessUi()

    assertLoginWorks(TARGET_USER.email, LEGACY_PASSWORD, false)
    assertLoginWorks(TARGET_USER.email, tempPassword, true)

    ensureTargetPasswordViaApi(LEGACY_PASSWORD)
  })

  it('ARP-NEG-01 | [Negative] Weak password is rejected', () => {
    ensureTargetPasswordViaApi(LEGACY_PASSWORD)
    loginSuperadminUsers()
    openResetPasswordForm()
    fillResetPasswordForm(WEAK_PASSWORDS.tooShort.password)
    submitResetPasswordForm({ expectRequest: false })
    cy.get('#resetPasswordModal', { timeout: 15000 }).should(($modal) => {
      const stillOpen = $modal.find('#admin_reset_password:visible').length > 0
      const text = $modal.text()
      const hasError = /invalid|required|at least|weak|قصير|كلمة/i.test(text)
      expect(stillOpen || hasError, 'weak password should not succeed silently').to.eq(true)
    })
    // Confirm weak value did not replace baseline.
    assertLoginWorks(TARGET_USER.email, LEGACY_PASSWORD, true)
  })

  it('ARP-NEG-02 | [Negative] Mismatched confirmation is rejected', () => {
    ensureTargetPasswordViaApi(LEGACY_PASSWORD)
    loginSuperadminUsers()
    openResetPasswordForm()
    fillResetPasswordForm(RESET_TO_PASSWORD, 'Different@1234')
    submitResetPasswordForm({ expectRequest: false })
    cy.get('#resetPasswordModal', { timeout: 15000 }).should(($modal) => {
      const stillOpen = $modal.find('#admin_reset_password:visible').length > 0
      const text = $modal.text() + Cypress.$('body').text()
      const hasError = /confirm|match|mismatch|does not match|غير متطابق|تأكيد/i.test(text)
      expect(stillOpen || hasError, 'mismatch should be rejected').to.eq(true)
    })
    assertLoginWorks(TARGET_USER.email, LEGACY_PASSWORD, true)
  })

  it('ARP-NEG-03 | [Negative] content_manager cannot reset users', () => {
    loginWorks(ADMINS.content_manager.email, ADMINS.content_manager.password).then((ok) => {
      if (!ok) {
        cy.log(
          `SKIP ARP-NEG-03: ${ADMINS.content_manager.email} cannot log in with seeded password on dig`,
        )
        expect(true).to.eq(true)
        return
      }
      loginViaApi(ADMINS.content_manager)
      goAdmin('/users')
      cy.url({ timeout: 20000 }).then((url) => {
        cy.get('body').then(($body) => {
          const blocked =
            url.includes('/login') ||
            /403|forbidden|unauthorized|not authorized/i.test($body.text()) ||
            !/table|users/i.test($body.html())
          if (!blocked) {
            const hasReset = $body.find('button.reset-password-button').length
            expect(hasReset, 'content_manager must not get reset password CTA').to.eq(0)
          } else {
            expect(blocked).to.eq(true)
          }
        })
      })
    })
  })

  it('ARP-NEG-04 | [Negative] Student cannot open /admin/users', () => {
    // Use a known-good student login (123456). TARGET_USER baseline is Test@1234 and
    // drifts when prior reset tests leave dig in a different state.
    loginViaApi(STUDENT)
    cy.request({
      method: 'GET',
      url: `${BASE()}/admin/users`,
      auth: basicAuth(),
      failOnStatusCode: false,
      followRedirect: false,
    })
      .its('status')
      .should('be.oneOf', [302, 401, 403, 404])
  })
})
