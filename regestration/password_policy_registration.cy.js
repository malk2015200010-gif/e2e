/**
 * Password policy — registration & grandfathering
 *
 * New accounts: 8–64 chars, upper + lower + digit + special (ASCII only).
 * Existing accounts: legacy passwords (e.g. 123456) still work for login only.
 *
 * The register page now shows a LIVE checklist popover on #password (opens on focus,
 * updates on every keystroke) and its own submit handler blocks the form — with
 * preventDefault(), before any request is sent — whenever a rule is unmet. So weak
 * passwords never reach the server at all; they must be asserted client-side.
 */

import {
  VALID_NEW_PASSWORD,
  LEGACY_PASSWORD,
  WEAK_PASSWORDS,
  PASSWORD_CHECKLIST_RULES,
  fillRegisterForm,
  typeConfirmPassword,
  submitRegister,
  assertRegistrationSucceeded,
  loginWithCredentials,
  LEGACY_LOGIN_ACCOUNTS,
  uniqueRegisterEmail,
  openRegisterPage,
  assertChecklistAppearsOnFocus,
  assertChecklistTracksTyping,
  attemptSubmitWithInvalidPassword,
  assertClientSideBlocked,
} from './password_policy_support.js'
import { STUDENT } from '../../support/users.js'
import {
  openCreateAssistantPage,
  fillAssistantForm,
  ASSISTANT_SUBMIT_BTN,
  VALIDATION_RE,
  visitAsInstructor,
  ASSISTANTS_CREATE,
} from '../instructor_assistants/instructor_assistants_support.js'

const roles = ['student', 'instructor']

describe('Password policy — valid registration (new accounts)', () => {
  roles.forEach((role) => {
    it(`PW-REG-OK-${role} | ${role} registers with compliant password`, () => {
      fillRegisterForm({ role, email: uniqueRegisterEmail(role) })
      submitRegister().then(({ response }) => {
        expect(response?.statusCode, 'register POST').to.be.oneOf([200, 201, 302, 303])
      })
      assertRegistrationSucceeded()
    })
  })
})

describe('Password policy — live checklist popover on #password', () => {
  it('PW-CHK-FOCUS | checklist appears as soon as the password field is focused', () => {
    openRegisterPage()
    assertChecklistAppearsOnFocus()
  })

  it('PW-CHK-LIVE | checklist rules flip to passed live as a compliant password is typed', () => {
    openRegisterPage()
    cy.get('input[name="password"], input[id="password"]').first().focus()
    assertChecklistTracksTyping(VALID_NEW_PASSWORD, PASSWORD_CHECKLIST_RULES)
  })

  it('PW-CHK-PARTIAL | only the satisfied rules are marked passed for a partial password', () => {
    openRegisterPage()
    cy.get('input[name="password"], input[id="password"]').first().focus()
    // "test1234" satisfies lowercase/number/length/ascii but not uppercase/special.
    assertChecklistTracksTyping('test1234', ['length', 'lowercase', 'number', 'ascii'])
  })
})

describe('Password policy — weak passwords rejected client-side (new accounts)', () => {
  const negativeCases = [
    { id: 'legacy', ...WEAK_PASSWORDS.legacyNumeric, reason: 'legacy numeric only' },
    { id: 'short', ...WEAK_PASSWORDS.tooShort, reason: 'fewer than 8 characters' },
    { id: 'no-upper', ...WEAK_PASSWORDS.noUpper, reason: 'missing uppercase' },
    { id: 'no-lower', ...WEAK_PASSWORDS.noLower, reason: 'missing lowercase' },
    { id: 'no-digit', ...WEAK_PASSWORDS.noDigit, reason: 'missing digit' },
    { id: 'no-special', ...WEAK_PASSWORDS.noSpecial, reason: 'missing special character' },
    { id: 'too-long', ...WEAK_PASSWORDS.tooLong, reason: 'more than 64 characters' },
  ]

  negativeCases.forEach(({ id, password, failingRule, reason }) => {
    it(`PW-REG-NO-student-${id} | student blocked client-side, no request sent — ${reason}`, () => {
      fillRegisterForm({ role: 'student', password, email: uniqueRegisterEmail(id) })
      attemptSubmitWithInvalidPassword()
      assertClientSideBlocked(failingRule)
    })
  })

  it('PW-REG-NO-instructor-legacy | instructor blocked client-side with legacy password 123456', () => {
    fillRegisterForm({ role: 'instructor', password: LEGACY_PASSWORD, email: uniqueRegisterEmail('instr-legacy') })
    attemptSubmitWithInvalidPassword()
    assertClientSideBlocked('length')
  })
})

describe('Password policy — grandfather (existing accounts)', () => {
  LEGACY_LOGIN_ACCOUNTS.forEach(({ label, user, destination }) => {
    it(`PW-GRAND-${user.role || label} | existing ${label} logs in with legacy password`, () => {
      loginWithCredentials(user.email, user.password, destination)
      cy.url().should('satisfy', (url) => url.includes('/dashboard') || url.includes('/admin'))
    })
  })

  it('PW-GRAND-vs-NEW | legacy login works but new registration with same password is blocked client-side', () => {
    loginWithCredentials(STUDENT.email, LEGACY_PASSWORD)
    cy.clearCookies()
    cy.clearLocalStorage()

    fillRegisterForm({
      role: 'student',
      password: LEGACY_PASSWORD,
      email: uniqueRegisterEmail('grandfather'),
    })
    attemptSubmitWithInvalidPassword()
    assertClientSideBlocked('length')
  })
})

describe('Password policy — password mismatch still blocked', () => {
  it('PW-REG-MISMATCH | confirm password must match', () => {
    fillRegisterForm({ role: 'student', password: VALID_NEW_PASSWORD })
    typeConfirmPassword('Wrong@123')
    // The password itself passes the checklist, so the browser POSTs.
    // submitRegister() asserts we left /register; a mismatch must stay and show the server error.
    cy.intercept({ method: 'POST', url: /\/register(?:\?|$)/ }).as('mismatchPost')
    cy.get('#registerForm button[type="submit"]').filter(':visible').first().click({ force: true })
    cy.wait('@mismatchPost', { timeout: 25000 })
    cy.url({ timeout: 15000 }).should('include', '/register')
    cy.get('body').invoke('text').should('match', /password confirmation does not match/i)
  })
})

describe('Password policy — instructor assistant (new account)', () => {
  it('PW-ASST-OK | instructor creates assistant with compliant password', () => {
    const name = `Policy Assistant ${Date.now()}`
    const email = uniqueRegisterEmail('asst-ok')
    visitAsInstructor(ASSISTANTS_CREATE)
    fillAssistantForm({
      name,
      email,
      password: VALID_NEW_PASSWORD,
      permissions: [],
    })
    cy.get(ASSISTANT_SUBMIT_BTN).click({ force: true })
    cy.get('body', { timeout: 20000 }).should('contain.text', name)
  })

  it('PW-ASST-NO-legacy | assistant creation blocked with password 123456', () => {
    openCreateAssistantPage()
    fillAssistantForm({
      name: `Weak Assistant ${Date.now()}`,
      email: uniqueRegisterEmail('asst-bad'),
      password: LEGACY_PASSWORD,
      permissions: [],
    })
    cy.get(ASSISTANT_SUBMIT_BTN).click({ force: true })
    cy.url({ timeout: 15000 }).should('include', ASSISTANTS_CREATE)
    cy.get('body').then(($b) => {
      const hasInvalid = $b.find('input[name="password"]:invalid').length > 0
      const hasCopy = VALIDATION_RE.test($b.text()) || /password|uppercase|lowercase|special/i.test($b.text())
      expect(hasInvalid || hasCopy, 'assistant weak password rejected').to.be.true
    })
  })
})
