/**
 * Shared Actions web regression — helpers
 *
 * Covers web flows that now call shared Actions (RegisterUser, AuthenticateUser,
 * ListEnrolledCourses, ResolveCourseAccess, GetLectureForViewer, ResolveLiveClassJoin).
 * Against https://dev.mentoraeg.com — no local server.
 */

import { getAppBase, loginViaApi, dismissCookieBanner } from '../../support/navigation.js'
import { typeConfirmPassword } from '../regestration/password_policy_support.js'
import { HTTP_AUTH, basicAuth, ADMIN, INSTRUCTOR, STUDENT, STUDENTS } from '../../support/users.js'

export const BASE = () => getAppBase()
export const AUTH = HTTP_AUTH

export const STUDENT_ALT = STUDENTS.find((s) => s.email === 'student2@demo.com') || STUDENTS[1] || STUDENT

/**
 * Enrolled course for malk2015200010e.
 * With no scheduled session, /live-class redirects to /dashboard and shows
 * "No live class sessions available for this course."
 * yujn and chemistry-1 also leave /live-class.
 */
export const LIVE_COURSE_SLUG = 'biology-1'
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
  cy
    .visit(`${BASE()}${path.startsWith('/') ? path : `/${path}`}`, {
      auth: basicAuth(),
      failOnStatusCode: false,
      timeout: 60000,
      ...opts,
    })
    .then(() => dismissCookieBanner())

const visiblePageText = ($body) => {
  const $clone = $body.clone()
  $clone.find('#phpdebugbar, .phpdebugbar, script, style, noscript').remove()
  return ($clone.text() || '').replace(/\s+/g, ' ').trim()
}

export const pageUiText = () => cy.get('body', { timeout: 15000 }).then(($b) => visiblePageText($b))

/** Retries until the painted page matches. pageUiText().should() reads once. */
export const assertPageText = (pattern) =>
  cy.get('body', { timeout: 20000 }).should(($body) => {
    expect(visiblePageText($body)).to.match(pattern)
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
  cy.get(`#registerForm input[name="user_as"][value="${value}"]`).check({ force: true })
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
  // Choose the role before typing phones. Switching away from student clears
  // the parent number, so that check has to finish first.
  selectAccountType(role)
  cy.get('input[name="name"], input[id="name"]').first().clear().type(name)
  cy.get('input[name="email"], input[id="email"]').first().clear({ force: true }).type(email, { force: true })

  cy.get('#phone_code').select('20', { force: true })
  cy.get('#phone_number, input[name="phone_number"]').filter(':visible').first().clear({ force: true }).type(phone, { force: true })

  if (!skipParent && role === 'student') {
    cy.get('#parent_phone_code').select('20', { force: true })
    cy.get('#parent_phone_number, input[name="parent_phone_number"]')
      .filter(':visible')
      .first()
      .clear({ force: true })
      .type(parentPhone, { force: true })
  }

  cy.get('#registerForm input#password, input[name="password"]').filter(':visible').first()
    .clear({ force: true })
    .type(password, { force: true, delay: 15 })
  typeConfirmPassword(password)

  return cy.wrap({ name, email, password, phone, parentPhone, role })
}

export const submitRegister = () => {
  cy.intercept({ method: 'POST', url: /\/register/ }).as('sawRegisterPost')
  cy.get(REGISTER_SUBMIT).first().click({ force: true })
  return cy.wait('@sawRegisterPost', { timeout: 25000 })
}

export const assertLeftRegister = () => {
  // Student signup on dev returns to "/" while the session is already logged in.
  // Instructor signup lands on /dashboard or /email/verify.
  cy.url({ timeout: 25000 }).should((url) => {
    const path = new URL(url).pathname
    const landed =
      path === '/' || path.startsWith('/dashboard') || path.startsWith('/email/verify')
    expect(landed, `left /register after signup (got ${url})`).to.eq(true)
  })
  go('/dashboard')
  cy.location('pathname', { timeout: 20000 }).should((path) => {
    expect(path, 'new account session opens the app').to.satisfy(
      (p) => p.includes('/dashboard') || p.includes('/email/verify'),
    )
  })
}

export const assertStayedOnRegister = () =>
  cy.url({ timeout: 15000 }).should('include', '/register')

/** Dedicated student. Admin bulk status 2 blocks login. Do not use for other tests. */
export const INACTIVE_ACCOUNT = {
  email: 'saw.inactive@mail.com',
  password: 'Test@1234',
}

const inactiveUserId = (html) =>
  (String(html).match(/name="bulk_ids\[\]"[^>]*value="(\d+)"/) || [])[1] || ''

export const ensureInactiveAccountBlocked = () => {
  loginViaApi(ADMIN)
  const searchUrl = `${BASE()}/admin/users?q=${encodeURIComponent(INACTIVE_ACCOUNT.email)}`
  return cy
    .request({
      url: searchUrl,
      auth: basicAuth(),
      failOnStatusCode: false,
      log: false,
      timeout: 120000,
    })
    .then((found) => {
      const id = inactiveUserId(found.body)
      expect(id, `admin user id for ${INACTIVE_ACCOUNT.email}`).to.match(/^\d+$/)
      return cy.request({
        url: `${BASE()}/admin/users`,
        qs: { status: '2', bulk_action_btn: 'update_status', 'bulk_ids[]': id },
        auth: basicAuth(),
        failOnStatusCode: false,
        log: false,
        timeout: 120000,
      })
    })
}

export const submitLoginForm = ({ email, password, remember = false }) => {
  cy.get('form[action*="login"] input[name="email"], form[action*="login"] input[type="email"]')
    .filter(':visible')
    .first()
    .clear({ force: true })
    .type(email, { force: true })
  cy.get('form[action*="login"] input[name="password"], form[action*="login"] input[type="password"]')
    .filter(':visible')
    .first()
    .clear({ force: true })
    .type(password, { force: true })
  if (remember) {
    cy.get('form[action*="login"] input[name="remember"]').then(($r) => {
      if ($r.length) cy.wrap($r.first()).check({ force: true })
    })
  }
  cy.get(
    'form[action*="login"] button[type="submit"], button.btn.btn-primary.w-50.mx-auto.d-block.mb-3',
  )
    .filter(':visible')
    .first()
    .click({ force: true })
}

export const assertLeftLogin = () =>
  cy.location('pathname', { timeout: 20000 }).should((path) => {
    expect(path, 'left the login page').to.not.eq('/login')
  })

export const openEnrolledCourses = () => {
  go('/dashboard/enrolled-courses')
  return cy.url({ timeout: 20000 }).should('include', '/enrolled-courses')
}

const RESERVED_COURSE_SLUGS = new Set(['create', 'search', 'load', 'categories', 'new'])

/** `/courses/{slug}` from an absolute or relative href. Ignores `/dashboard/enrolled-courses`. */
const parseCourseSlug = (href) => {
  const match = String(href || '').match(/(?:^|\/)courses\/([a-z0-9][a-z0-9\-]*)/i)
  if (!match) return null
  const slug = match[1]
  if (slug.length <= 3 || RESERVED_COURSE_SLUGS.has(slug.toLowerCase())) return null
  return slug
}

/**
 * Course landing slugs on enrolled-courses.
 * Active cards link with `a.pps-action-link` to `/courses/{slug}` (title is plain text, not a link).
 * Suspended cards use a disabled button with no href. Refund CTAs are not landing links.
 */
export const enrolledLandingSlugs = () =>
  cy.get('body', { timeout: 15000 }).then(($b) => {
    const slugs = [...$b.find('a')]
      .filter((a) => {
        if (a.closest('#phpdebugbar, .phpdebugbar')) return false
        const cls = a.getAttribute('class') || ''
        const text = (a.textContent || '').trim()
        if (/pps-repurchase|refund/i.test(cls)) return false
        if (/^purchase$|^refund/i.test(text)) return false
        return Boolean(parseCourseSlug(a.getAttribute('href') || ''))
      })
      .map((a) => parseCourseSlug(a.getAttribute('href') || ''))
      .filter(Boolean)

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
      return cy.wrap(new URL(href, BASE()).pathname)
    } catch {
      return cy.wrap(href.startsWith('/') ? href : `/${href}`)
    }
  })
}

export { ADMIN, INSTRUCTOR, STUDENT }
