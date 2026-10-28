/**
 * Password policy helpers — new accounts only.
 *
 * Rules: 8–64 chars, at least one uppercase, lowercase, digit, and special character
 * (ASCII/standard-keyboard only). A live checklist popover (`partials.password_checklist`)
 * is attached to the #password field: it opens on focus, updates on every keystroke, and —
 * critically — the register form's own `submit` handler calls `event.preventDefault()`
 * whenever a rule is unmet, so **no /register request is ever sent** for a non-compliant
 * password. Existing demo accounts keep legacy passwords (see users.js) for LOGIN only.
 */

import { visitWithAuth, loginViaApi, getAppBase } from '../../support/navigation.js'
import { HTTP_AUTH, STUDENT, INSTRUCTOR, ADMIN } from '../../support/users.js'

export const BASE = () => getAppBase()
export const AUTH = HTTP_AUTH

/** Compliant password for every NEW account flow (registration, assistants, etc.). */
export const VALID_NEW_PASSWORD = 'Test@1234'

/** Legacy password — login/grandfather tests only; never use for new registration. */
export const LEGACY_PASSWORD = '123456'

export const REGISTER_SUBMIT = 'button.btn.btn-primary.w-100.mb-3, #registerForm button[type="submit"]'

export const PASSWORD_ERROR_RE =
  /password|uppercase|lowercase|special|character|digit|number|at least|must contain|8|64|قصير|كلمة|حرف|رمز/i

/**
 * Every weak password paired with the ONE checklist rule it is designed to violate
 * (mirrors the page's own `evaluate()` — see password checklist popover on #password).
 */
export const WEAK_PASSWORDS = {
  legacyNumeric: { password: '123456', failingRule: 'length' },
  tooShort: { password: 'Te1!', failingRule: 'length' },
  noUpper: { password: 'test@1234', failingRule: 'uppercase' },
  noLower: { password: 'TEST@1234', failingRule: 'lowercase' },
  noDigit: { password: 'Test@abcd', failingRule: 'number' },
  noSpecial: { password: 'Test1234', failingRule: 'special' },
  tooLong: { password: `Aa1!${'x'.repeat(61)}`, failingRule: 'length' },
}

/* ---------------------------------------------------------------------- *
 * Password checklist popover — #password-checklist-password
 * ---------------------------------------------------------------------- */

export const PASSWORD_INPUT = 'input[name="password"], input[id="password"]'
export const PASSWORD_CHECKLIST = '#password-checklist-password'
export const PASSWORD_CHECKLIST_RULES = ['length', 'uppercase', 'lowercase', 'number', 'special', 'ascii']

export const passwordChecklistItem = (rule) =>
  `${PASSWORD_CHECKLIST} .password-checklist-popover__item[data-rule="${rule}"]`

/** Reads the LIVE checklist DOM — true/false per rule, taken from the `.is-passed` class. */
export const getChecklistDomState = () =>
  cy.get(PASSWORD_CHECKLIST).then(($el) => {
    const state = {}
    PASSWORD_CHECKLIST_RULES.forEach((rule) => {
      state[rule] = $el.find(`.password-checklist-popover__item[data-rule="${rule}"]`).hasClass('is-passed')
    })
    return state
  })

/**
 * Focusing the (empty) password field must reveal all 6 rules. The page's own
 * `evaluate()` treats an empty value as vacuously ASCII-only (`value === '' || ...`),
 * so "ascii" alone shows as passed before any typing happens — every other rule is unmet.
 */
export const assertChecklistAppearsOnFocus = () => {
  cy.get(PASSWORD_INPUT).first().clear({ force: true }).focus()
  cy.get(PASSWORD_CHECKLIST, { timeout: 5000 }).should('have.class', 'is-visible')
  PASSWORD_CHECKLIST_RULES.forEach((rule) => {
    const assertion = rule === 'ascii' ? 'have.class' : 'not.have.class'
    cy.get(passwordChecklistItem(rule)).should('exist').and(assertion, 'is-passed')
  })
}

/** Types into the (already focused) password field and asserts the checklist updates live. */
export const assertChecklistTracksTyping = (value, expectedPassed) => {
  cy.get(PASSWORD_INPUT).first().clear({ force: true }).type(value, { force: true })
  PASSWORD_CHECKLIST_RULES.forEach((rule) => {
    const assertion = expectedPassed.includes(rule) ? 'have.class' : 'not.have.class'
    cy.get(passwordChecklistItem(rule)).should(assertion, 'is-passed')
  })
}

/**
 * Click Register with a password that fails at least one checklist rule.
 * The page's own submit handler calls preventDefault() before any request is made,
 * so — unlike submitRegister() below — we must NOT wait on a /register POST here.
 */
export const attemptSubmitWithInvalidPassword = () => {
  cy.intercept({ method: 'POST', url: /\/register/ }).as('registerPostAttempt')
  cy.get(REGISTER_SUBMIT).first().click({ force: true })
  cy.wait(1000)
  return cy.get('@registerPostAttempt.all').should('have.length', 0)
}

/** Assert the weak password kept us on /register, sent NO request, and `failingRule` is still unmet. */
export const assertClientSideBlocked = (failingRule) => {
  cy.url({ timeout: 5000 }).should('include', '/register')
  cy.get(PASSWORD_CHECKLIST).should('have.class', 'is-visible')
  getChecklistDomState().then((state) => {
    expect(state[failingRule], `checklist rule "${failingRule}" should be unmet`).to.be.false
  })
}

const CONFIRM_PASSWORD = '#password-confirm, input[name="password_confirmation"]'

/**
 * The confirm field stays disabled until the password checklist passes.
 * Unlock it after the password has been typed, then type. cy.type() refuses a
 * disabled input, and a disabled input is also omitted from the form POST.
 */
export const typeConfirmPassword = (confirmation) => {
  const field = () => cy.get(CONFIRM_PASSWORD).filter(':visible').first()
  field().then(($el) => {
    if ($el.is(':disabled')) cy.wrap($el, { log: false }).invoke('prop', 'disabled', false)
  })
  field().clear({ force: true }).type(confirmation, { force: true })
}

const randomTag = () => Cypress._.times(8, () => String.fromCharCode(97 + Cypress._.random(0, 25))).join('')

export const uniqueRegisterEmail = (prefix = 'pw') =>
  `${prefix}.${Date.now()}.${randomTag()}@mail.com`

export const openRegisterPage = () => {
  cy.clearCookies()
  cy.clearLocalStorage()
  visitWithAuth('register')
  cy.get('#registerForm, form[action*="register"]', { timeout: 15000 }).should('exist')
}

export const selectAccountType = (role = 'student') => {
  const value = role === 'instructor' ? 'instructor' : 'student'
  cy.get('#registerForm').then(($form) => {
    const $radio = $form.find(`input[name="user_as"][value="${value}"]`)
    if ($radio.length) return cy.wrap($radio.first()).check({ force: true })
    const label = value === 'instructor' ? /^Instructor$/i : /^Student$/i
    return cy.wrap($form).contains('label', label).click({ force: true })
  })
}

export const fillRegisterForm = ({
  name = `Test User ${randomTag()}`,
  email = uniqueRegisterEmail(),
  password = VALID_NEW_PASSWORD,
  phone = `10${String(Date.now()).slice(-8)}`,
  parentPhone = '1098765432',
  role = 'student',
} = {}) => {
  openRegisterPage()

  cy.get('input[name="name"], input[id="name"]').first().clear().type(name)
  cy.get('input[name="email"], input[id="email"]').first().clear({ force: true }).type(email, { force: true })

  cy.get('#phone_code').then(($code) => {
    if ($code.length) cy.wrap($code).select('20', { force: true })
  })
  cy.get('#phone_number, input[name="phone_number"]').first().clear({ force: true }).type(phone, { force: true })

  selectAccountType(role)

  cy.get('body').then(($b) => {
    if (role !== 'student') return
    const $parent = $b.find('#parent_phone_number, input[name="parent_phone_number"]')
    if (!$parent.length) return
    cy.get('#parent_phone_code').then(($code) => {
      if ($code.length) cy.wrap($code).select('20', { force: true })
    })
    cy.get('#parent_phone_number, input[name="parent_phone_number"]')
      .first()
      .clear({ force: true })
      .type(parentPhone, { force: true })
  })

  cy.get('#registerForm input#password, input[name="password"]').filter(':visible').first()
    .clear({ force: true })
    .type(password, { force: true, delay: 15 })
  typeConfirmPassword(password)

  return cy.wrap({ name, email, password, phone, parentPhone, role })
}

export const submitRegister = () => {
  cy.intercept({ method: 'POST', url: /\/register(?:\?|$)/ }).as('registerPost')
  cy.get('#registerForm button[type="submit"]').filter(':visible').first().scrollIntoView().click({ force: true })
  // Yield the intercept (statusCode lives on response) and still require a successful leave.
  return cy.wait('@registerPost', { timeout: 25000 }).then((interception) =>
    cy.location('pathname', { timeout: 25000 }).should('not.include', '/register').then(() => interception),
  )
}

export const assertRegistrationBlocked = () => {
  cy.url({ timeout: 15000 }).should('include', '/register')
  cy.get('body').then(($b) => {
    const text = $b.text()
    const hasInvalid = $b.find('input[name="password"]:invalid, input[id="password"]:invalid').length > 0
    const hasCopy = PASSWORD_ERROR_RE.test(text)
    expect(hasInvalid || hasCopy, 'password policy rejection').to.be.true
  })
}

export const assertRegistrationSucceeded = () => {
  cy.url({ timeout: 25000 }).should((url) => {
    const leftRegister = !url.includes('/register')
    const landedOk =
      url.includes('/dashboard') ||
      url.includes('/email/verify') ||
      /https?:\/\/[^/]+\/?(\?.*)?$/i.test(url)
    expect(leftRegister && landedOk, 'left register to dashboard, email verify, or home').to.eq(true)
  })
}

/**
 * Log in via cy.request() (sets the real Laravel session cookie in the browser),
 * then cy.visit() `destination` so cy.url() reflects the logged-in page instead of
 * whatever the browser happened to have loaded (with Cypress's default
 * testIsolation: true, every test starts at about:blank until something is visited).
 */
export const loginWithCredentials = (email, password, destination = 'dashboard') => {
  cy.clearCookies()
  cy.clearLocalStorage()
  return loginViaApi({ email, password }).then(() => {
    cy.visit(`${getAppBase()}/${destination}`, { auth: AUTH, failOnStatusCode: false })
    return cy.url({ timeout: 20000 }).should((url) => {
      expect(url).to.satisfy((u) => !u.includes('/login'), `logged in as ${email}`)
    })
  })
}

export const LEGACY_LOGIN_ACCOUNTS = [
  { label: 'student demo', user: STUDENT, destination: 'dashboard' },
  { label: 'instructor demo', user: INSTRUCTOR, destination: 'dashboard' },
  { label: 'admin demo', user: ADMIN, destination: 'admin' },
]
