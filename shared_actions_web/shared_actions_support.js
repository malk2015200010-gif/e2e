/**
 * Shared Actions web regression — helpers
 *
 * Covers web flows that now call shared Actions (RegisterUser, AuthenticateUser,
 * ListEnrolledCourses, ResolveCourseAccess, GetLectureForViewer, ResolveLiveClassJoin).
 * Against https://dev.mentoraeg.com — no local server.
 */

import { loginViaApi } from '../../support/navigation.js'
import { HTTP_AUTH, ADMIN, INSTRUCTOR, STUDENT, STUDENTS } from '../../support/users.js'

export const BASE = 'https://dev.mentoraeg.com'
export const AUTH = HTTP_AUTH

export const STUDENT_ALT = STUDENTS.find((s) => s.email === 'student2@demo.com') || STUDENTS[1] || STUDENT

/** Known enrolled live course that serves /live-class for the primary student. */
export const LIVE_COURSE_SLUG = 'yujn'
/** Enrolled course with a reachable lecture player path. */
export const LECTURE_COURSE_SLUG = 'live-course-1'
export const LECTURE_PATH = `/courses/${LECTURE_COURSE_SLUG}/lecture/483`

export const VALID_NEW_PASSWORD = 'Test@1234'
export const WEAK_PASSWORD = '123456'

export const REGISTER_SUBMIT =
  'button.btn.btn-primary.w-100.mb-3, #registerForm button[type="submit"], button[type="submit"].btn-primary'

export const CTA_RE =
  /pay now|purchase|refund|suspended|access expired|buy now|enroll|اشتر|استرداد|معلق|منتهي/i

export const EMPTY_ENROLLED_RE =
  /no courses|haven't enrolled|not enrolled yet|empty|لا توجد|لم تسجل/i

export const LOCK_RE =
  /locked|drip|not available|available on|enroll|buy now|purchase|preview|يجب|مقفل/i

export const LIVE_JOIN_RE =
  /zoom|meeting sdk|join|countdown|starts in|starts at|upcoming|host|live class/i

const randomTag = () =>
  Cypress._.times(8, () => String.fromCharCode(97 + Cypress._.random(0, 25))).join('')

export const uniqueEmail = (prefix = 'saw') =>
  `${prefix}.${Date.now()}.${randomTag()}@mail.com`

export const go = (path, opts = {}) =>
  cy.visit(`${BASE}${path.startsWith('/') ? path : `/${path}`}`, {
    auth: AUTH,
    failOnStatusCode: false,
    timeout: 60000,
    ...opts,
  })

export const pageUiText = () =>
  cy.get('body', { timeout: 15000 }).then(($b) => {
    const $clone = $b.clone()
    $clone.find('#phpdebugbar, .phpdebugbar, script, style, noscript').remove()
    return ($clone.text() || '').replace(/\s+/g, ' ').trim()
  })

export const loginAs = (user) =>
  loginViaApi(user).then(() => {
    go('/dashboard')
    return cy.url({ timeout: 20000 }).should((url) => {
      expect(url).to.satisfy((u) => !u.includes('/login'), `logged in as ${user.email}`)
    })
  })

export const loginStudent = () => loginAs(STUDENT)
export const loginStudentAlt = () => loginAs(STUDENT_ALT)
export const loginInstructor = () => loginAs(INSTRUCTOR)
export const loginAdmin = () => loginAs(ADMIN)

export const openRegister = () => {
  cy.clearCookies()
  cy.clearLocalStorage()
  go('/register')
  return cy.get('#registerForm, form[action*="register"]', { timeout: 15000 }).should('exist')
}

export const openLogin = () => {
  cy.clearCookies()
  cy.clearLocalStorage()
  go('/login')
  return cy.get('form[action*="login"], input[name="email"]', { timeout: 15000 }).should('exist')
}

export const selectAccountType = (role = 'student') => {
  const value = role === 'instructor' ? 'instructor' : 'student'
  cy.get('#registerForm, form[action*="register"]').then(($form) => {
    const $radio = $form.find(`input[name="user_as"][value="${value}"]`)
    if ($radio.length) return cy.wrap($radio.first()).check({ force: true })
    const label = value === 'instructor' ? /^Instructor$/i : /^Student$/i
    return cy.wrap($form).contains('label', label).click({ force: true })
  })
}

export const fillRegisterForm = ({
  name = `SAW User ${randomTag()}`,
  email = uniqueEmail(),
  password = VALID_NEW_PASSWORD,
  phone = `10${String(Date.now()).slice(-8)}`,
  parentPhone = '1098765432',
  role = 'student',
  skipParent = false,
} = {}) => {
  openRegister()
  cy.get('input[name="name"], input[id="name"]').first().clear().type(name)
  cy.get('input[name="email"], input[id="email"]').first().clear({ force: true }).type(email, { force: true })

  cy.get('#phone_code').then(($code) => {
    if ($code.length) cy.wrap($code).select('20', { force: true })
  })
  cy.get('#phone_number, input[name="phone_number"]').first().clear({ force: true }).type(phone, { force: true })

  if (!skipParent && role === 'student') {
    cy.get('body').then(($b) => {
      const $parent = $b.find('#parent_phone_number, input[name="parent_phone_number"]')
      if (!$parent.length) return
      cy.get('#parent_phone_code').then(($code) => {
        if ($code.length) cy.wrap($code).select('20', { force: true })
      })
      cy.wrap($parent.first()).clear({ force: true }).type(parentPhone, { force: true })
    })
  }

  cy.get('input[name="password"], input[id="password"]').first().clear().type(password)
  cy.get('input[name="password_confirmation"], input[id="password-confirm"]')
    .first()
    .clear({ force: true })
    .type(password, { force: true })

  selectAccountType(role)
  return cy.wrap({ name, email, password, phone, parentPhone, role })
}

export const submitRegister = () => {
  cy.intercept({ method: 'POST', url: /\/register/ }).as('sawRegisterPost')
  cy.get(REGISTER_SUBMIT).first().click({ force: true })
  return cy.wait('@sawRegisterPost', { timeout: 25000 })
}

export const assertLeftRegister = () =>
  cy.url({ timeout: 25000 }).should((url) => {
    expect(url).to.satisfy(
      (u) => !u.includes('/register') && (u.includes('/dashboard') || u.includes('/email/verify')),
      'left /register after successful signup',
    )
  })

export const assertStayedOnRegister = () =>
  cy.url({ timeout: 15000 }).should('include', '/register')

export const submitLoginForm = ({ email, password, remember = false }) => {
  cy.get('input[name="email"], input[type="email"]').filter(':visible').first().clear().type(email)
  cy.get('input[name="password"], input[type="password"]').filter(':visible').first().clear().type(password)
  if (remember) {
    cy.get('input[name="remember"]').then(($r) => {
      if ($r.length) cy.wrap($r.first()).check({ force: true })
    })
  }
  cy.get('button[type="submit"], button.btn-primary').filter(':visible').first().click({ force: true })
}

export const openEnrolledCourses = () => {
  go('/dashboard/enrolled-courses')
  return cy.url({ timeout: 20000 }).should('include', '/enrolled-courses')
}

/** Unique course landing slugs from enrolled-courses (excludes purchase/refund CTAs). */
export const enrolledLandingSlugs = () =>
  cy.get('body', { timeout: 15000 }).then(($b) => {
    const slugs = [...$b.find('a[href*="/courses/"]')]
      .filter((a) => {
        const cls = `${a.className || ''}`
        const text = (a.textContent || '').trim()
        if (/pps-repurchase|refund/i.test(cls)) return false
        if (/^purchase$|^refund/i.test(text)) return false
        return true
      })
      .map((a) => a.getAttribute('href') || '')
      .map((h) => (h.match(/\/courses\/([a-z0-9\-]+)\/?(?:\?|$)/i) || [])[1])
      .filter((s) => s && s.length > 2 && !['create', 'search', 'load'].includes(s))

    return cy.wrap(slugs)
  })

export const findFirstLecturePath = (courseSlug) => {
  go(`/courses/${courseSlug}`)
  return cy.get('body', { timeout: 15000 }).then(($b) => {
    const href = [...$b.find(`a[href*="/courses/${courseSlug}/lecture/"]`)]
      .map((a) => a.getAttribute('href') || '')
      .find(Boolean)
    if (!href) return cy.wrap(null)
    try {
      return cy.wrap(new URL(href, BASE).pathname)
    } catch {
      return cy.wrap(href.startsWith('/') ? href : `/${href}`)
    }
  })
}

export { ADMIN, INSTRUCTOR, STUDENT }
