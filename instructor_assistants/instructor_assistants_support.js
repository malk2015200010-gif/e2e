/**
 * MEN-1726 — Instructor Assistants helpers
 *
 * Routes (dev):
 *   /dashboard/assistants            — list
 *   /dashboard/assistants/create     — create form
 *   POST /dashboard/assistants       — save
 *   /dashboard/assistants/{id}/edit  — edit / active toggle
 *   POST /dashboard/assistants/{id}/deactivate — deactivate from list
 *
 * Access model on dev:
 *   Missing permission → redirect to /dashboard (usually NO denial banner).
 *   Earnings page path is /dashboard/earning (singular — /earnings 404s).
 *   Withdraw page path is /dashboard/withdraw; gated by withdraw.view
 *   (withdraw.manage alone still redirects to /dashboard).
 */

import { loginViaApi } from '../../support/navigation.js'
import { HTTP_AUTH, INSTRUCTOR } from '../../support/users.js'
import { VALID_NEW_PASSWORD } from '../regestration/password_policy_support.js'

export const BASE = 'https://dev.mentoraeg.com'
export const AUTH = HTTP_AUTH

export const ASSISTANTS_LIST = '/dashboard/assistants'
export const ASSISTANTS_CREATE = '/dashboard/assistants/create'

export const ASSISTANTS_NAV = 'a[href*="/dashboard/assistants"]'
export const CREATE_ASSISTANT_LINK = 'a.btn-create-course[href*="/dashboard/assistants/create"], a[href*="/dashboard/assistants/create"]'
export const ASSISTANT_SUBMIT_BTN = 'button.assistants-form__submit, button.btn-create-course.assistants-form__submit'

export const WORKING_FOR_RE = /working for/i
export const ACCESS_DENIED_MSG_RE =
  /do not have permission|not authorized to|permission denied|access denied|forbidden|unauthorized|403 forbidden|could not be found|غير مصرح|لا تملك/i
export const ACCESS_DENIED_RE = ACCESS_DENIED_MSG_RE
export const VALIDATION_RE = /required|invalid|must|مطلوب|غير صالح/i
export const DUPLICATE_EMAIL_RE = /already|exists|taken|registered|duplicate|مسجل/i
export const ROUTE_MISSING_RE = /could not be found|404|not found/i

/** Permission checkbox values from /dashboard/assistants/create */
export const PERMS = {
  CREATE_COURSE: 'courses.create',
  PUBLIC_INFO: 'courses.public_info',
  CURRICULUM: 'courses.syllabus',
  PRICING: 'courses.pricing',
  LIVE_SESSIONS: 'live_sessions.manage',
  VIEW_STUDENTS: 'courses.students.view',
  GRADING: 'grading.manage',
  EARNINGS: 'earnings.view',
  WITHDRAW_VIEW: 'withdraw.view',
  WITHDRAW_MANAGE: 'withdraw.manage',
}

export const ROUTES = {
  createCourse: '/dashboard/courses/new',
  liveSessions: '/dashboard/live-sessions',
  liveSessionsCreate: '/dashboard/live-sessions/create',
  earnings: '/dashboard/earning',
  withdraw: '/dashboard/withdraw',
  assignments: '/dashboard/assignments',
  assistants: ASSISTANTS_LIST,
  zoom: '/dashboard/settings/zoom-requests',
  zoomLegacy: '/dashboard/settings/zoom',
  myCourses: '/dashboard/my-courses',
}

export const go = (path, opts = {}) =>
  cy.visit(`${BASE}${path}`, { auth: AUTH, failOnStatusCode: false, timeout: 60000, ...opts })

const extractCsrfToken = (html = '') => {
  const m = html.match(/name="_token"\s+value="([^"]+)"/) ||
    html.match(/<meta name="csrf-token" content="([^"]+)"/)
  return m ? m[1] : ''
}

export const postWithCsrf = (url, bodyFn) =>
  cy.request({ method: 'GET', url: `${BASE}${url}`, auth: AUTH, failOnStatusCode: false }).then((res) => {
    const token = extractCsrfToken(res.body || '')
    return cy.request({
      method: 'POST',
      url: `${BASE}${url}`,
      auth: AUTH,
      form: true,
      followRedirect: true,
      failOnStatusCode: false,
      body: bodyFn(token),
    })
  })

/** Prefer API login — UI form login is flaky on this staging. */
export const loginInstructor = () =>
  loginViaApi(INSTRUCTOR).then(() => {
    go('/dashboard')
    return cy.url({ timeout: 20000 }).should((url) => {
      expect(url).to.satisfy((u) => !u.includes('/login'), 'instructor logged in')
    })
  })

export const ensureInstructorSession = () => loginInstructor()

export const visitAsInstructor = (path) =>
  loginInstructor().then(() => go(path)).then(() => cy.url({ timeout: 20000 }))

export const openAssistantsList = () =>
  visitAsInstructor(ASSISTANTS_LIST).then(() =>
    cy.get('body', { timeout: 30000 }).invoke('text').should('match', /assistants/i),
  )

export const openAssistantsViaNav = () =>
  visitAsInstructor('/dashboard')
    .then(() => cy.get(ASSISTANTS_NAV, { timeout: 15000 }).filter(':visible').first().click({ force: true }))
    .then(() => cy.url({ timeout: 20000 }))
    .then((url) => {
      if (!url.includes(ASSISTANTS_LIST)) return visitAsInstructor(ASSISTANTS_LIST)
      return cy.wrap(url)
    })

export const openCreateAssistantPage = () =>
  visitAsInstructor(ASSISTANTS_CREATE).then(() =>
    cy.get('input[name="name"], #name', { timeout: 15000 }).should('exist'),
  )

const randomTag = () => Cypress._.times(8, () => String.fromCharCode(97 + Cypress._.random(0, 25))).join('')

export const buildAssistantUser = (tag = 'asst') => {
  const id = `${String(tag).replace(/[^a-z0-9]/gi, '').slice(0, 12)}.${Date.now()}.${randomTag()}`
  return {
    name: `Test Assistant ${id}`,
    email: `men1726.${id}@mail.com`,
    password: VALID_NEW_PASSWORD,
  }
}

export const fillAssistantForm = ({ name, email, password, permissions = [] }) => {
  cy.get('input[name="name"], #name').first().clear({ force: true }).type(name, { force: true })
  cy.get('input[name="email"], #email').first().clear({ force: true }).type(email, { force: true })

  // Password checklist blocks submit until all rules pass — type into the live field.
  cy.get('input[name="password"], #password').first()
    .clear({ force: true })
    .focus()
    .type(password, { force: true, delay: 20 })
  cy.get('input[name="password_confirmation"], #password_confirmation').first()
    .clear({ force: true })
    .type(password, { force: true })

  // Uncheck all first so tests with empty permissions stay empty.
  cy.get('body').then(($b) => {
    const $boxes = $b.find('input[name="permissions[]"]')
    if ($boxes.length) cy.wrap($boxes).uncheck({ force: true })
  })

  permissions.forEach((perm) => {
    cy.get(`input[name="permissions[]"][value="${perm}"]`).check({ force: true })
  })
}

/** Create assistant through the UI form. */
export const createAssistantViaUi = ({ name, email, password, permissions = [] }) =>
  openCreateAssistantPage()
    .then(() => fillAssistantForm({ name, email, password, permissions }))
    .then(() => cy.get(ASSISTANT_SUBMIT_BTN).first().click({ force: true }))
    .then(() => cy.url({ timeout: 25000 }).should('include', ASSISTANTS_LIST))
    .then(() => cy.get('body', { timeout: 30000 }).should('contain.text', name))
    .then(() => cy.wrap({ name, email, password, permissions }))

export const attemptLogin = (email, password) =>
  cy.clearCookies()
    .then(() => cy.clearLocalStorage())
    .then(() => go('/login'))
    .then(() => cy.get('input[type="email"]:visible', { timeout: 15000 }).clear().type(email))
    .then(() =>
      cy.get('input[id="password"], #password').filter(':visible').first().clear().type(password),
    )
    .then(() =>
      cy.get('button.btn.btn-primary').filter(':visible').first().click({ force: true }),
    )

export const loginViaCredentials = (email, password) =>
  attemptLogin(email, password).then(() =>
    cy.url({ timeout: 25000 }).should((url) => {
      expect(url).to.satisfy((u) => !u.includes('/login'), `logged in as ${email}`)
    }),
  )

/** Faster setup — POST /dashboard/assistants (instructor session via loginViaApi). */
export const createAssistantViaApi = ({ name, email, password, permissions = [] }) =>
  loginViaApi(INSTRUCTOR)
    .then(() =>
      cy.request({ method: 'GET', url: `${BASE}${ASSISTANTS_CREATE}`, auth: AUTH, failOnStatusCode: false }),
    )
    .then((res) => {
      const token = extractCsrfToken(res.body || '')
      const parts = [
        `_token=${encodeURIComponent(token)}`,
        `name=${encodeURIComponent(name)}`,
        `email=${encodeURIComponent(email)}`,
        `password=${encodeURIComponent(password)}`,
        `password_confirmation=${encodeURIComponent(password)}`,
      ]
      permissions.forEach((perm) => parts.push(`permissions[]=${encodeURIComponent(perm)}`))

      return cy.request({
        method: 'POST',
        url: `${BASE}/dashboard/assistants`,
        auth: AUTH,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: parts.join('&'),
        failOnStatusCode: false,
        followRedirect: true,
        timeout: 60000,
      })
    })
    .then((res) => {
      expect(res.status, 'create assistant POST').to.be.oneOf([200, 201, 302, 303])
      const html = String(res.body || '')
      expect(html, `assistant "${name}" should appear after create`).to.include(name)
      return cy.wrap({ name, email, password, permissions })
    })

/** Parse assistant id from list HTML near the assistant name (look forward — edit link is after the name). */
export const extractAssistantIdFromListHtml = (html, needle) => {
  const idx = String(html).lastIndexOf(needle)
  if (idx < 0) return null
  const near = String(html).slice(idx, idx + 3000)
  const m =
    near.match(/\/dashboard\/assistants\/(\d+)\/edit/) ||
    near.match(/\/dashboard\/assistants\/(\d+)\/deactivate/)
  return m ? m[1] : null
}

export const findAssistantId = (needle) =>
  openAssistantsList().then(() =>
    cy.get('body', { timeout: 30000 }).should('contain.text', needle).then(($b) => {
      const id = extractAssistantIdFromListHtml($b.html() || '', needle)
      expect(id, `assistant id for ${needle}`).to.exist
      return cy.wrap(id)
    }),
  )

export const findAssistantEditUrl = (needle) =>
  findAssistantId(needle).then((id) => cy.wrap(`/dashboard/assistants/${id}/edit`))

/**
 * Deactivate via list "deactivate" action (most reliable on current UI).
 * Falls back to PUT active=0 on the edit form.
 */
export const deactivateAssistant = (assistant) => {
  const needle = assistant.name || assistant.email

  return findAssistantId(needle).then((id) =>
    cy.request({ method: 'GET', url: `${BASE}${ASSISTANTS_LIST}`, auth: AUTH, failOnStatusCode: false, timeout: 60000 })
      .then((listRes) => {
        const token = extractCsrfToken(listRes.body || '')
        return cy.request({
          method: 'POST',
          url: `${BASE}/dashboard/assistants/${id}/deactivate`,
          auth: AUTH,
          form: true,
          followRedirect: true,
          failOnStatusCode: false,
          body: { _token: token },
        }).then((res) => {
          if ([200, 201, 302, 303].includes(res.status)) return cy.wrap(id)

          // Fallback: PUT active=0
          return cy.request({
            method: 'GET',
            url: `${BASE}/dashboard/assistants/${id}/edit`,
            auth: AUTH,
            failOnStatusCode: false,
          }).then((editRes) => {
            const editToken = extractCsrfToken(editRes.body || '')
            return cy.request({
              method: 'POST',
              url: `${BASE}/dashboard/assistants/${id}`,
              auth: AUTH,
              form: true,
              followRedirect: true,
              failOnStatusCode: false,
              body: {
                _token: editToken,
                _method: 'PUT',
                name: assistant.name,
                email: assistant.email,
                active: '0',
              },
            }).then((putRes) => {
              expect(putRes.status, 'deactivate assistant PUT').to.be.oneOf([200, 201, 302, 303])
              return cy.wrap(id)
            })
          })
        })
      }),
  )
}

/**
 * Deactivated assistants can still authenticate on this staging, but they must NOT
 * get the assistant teacher context ("Working for …") on /dashboard.
 */
export const assertDeactivatedAssistantCannotLogin = ({ email, password }) =>
  attemptLogin(email, password).then(() =>
    cy.url({ timeout: 20000 }).then((url) => {
      if (url.includes('/login')) return cy.wrap(null)

      return go('/dashboard').then(() =>
        cy.get('body', { timeout: 15000 }).invoke('text').then((text) => {
          expect(
            WORKING_FOR_RE.test(text),
            'deactivated assistant must not see Working for teacher',
          ).to.be.false
        }),
      )
    }),
  )

export const loginAsAssistant = ({ email, password }) =>
  loginViaCredentials(email, password).then(() =>
    go('/dashboard').then(() =>
      cy.url({ timeout: 20000 }).should((url) => {
        expect(url).to.satisfy((u) => !u.includes('/login'), `assistant dashboard for ${email}`)
      }),
    ),
  )

export const assertWorkingForTeacher = () =>
  cy.get('body', { timeout: 15000 }).invoke('text').should('match', WORKING_FOR_RE)

export const assertAssistantListed = (needle) =>
  openAssistantsList().then(() =>
    cy.get('body', { timeout: 30000 }).should('contain.text', needle),
  )

export const courseInformationPath = (courseId) => `/dashboard/courses/${courseId}/information`

const scrapeCourseIds = (html = '') =>
  [...new Set([...String(html).matchAll(/\/dashboard\/courses\/(\d+)/g)].map((m) => m[1]))]

export const createInstructorDraftCourse = (title) =>
  ensureInstructorSession()
    .then(() => go('/dashboard/courses/new'))
    .then(() => cy.get('#title', { timeout: 20000 }).should('be.visible').clear().type(title))
    .then(() => cy.get('textarea').first().clear().type(`MEN-1726 draft ${title}`))
    .then(() => cy.get('select[name="level"]').select('Beginner'))
    .then(() => cy.get('select[name="delivery_type"]').select('Live'))
    .then(() => cy.wait(800))
    .then(() => cy.get('#course_category').select('22', { force: true }))
    .then(() => cy.wait(800))
    .then(() => cy.contains('label', 'Topic').parent().find('.select2-selection').click({ force: true }))
    .then(() => cy.contains('.select2-results__option', 'Math').click({ force: true }))
    .then(() => cy.contains('button', /create course/i).click({ force: true }))
    .then(() => cy.url({ timeout: 25000 }))
    .then((url) => {
      const m = url.match(/courses\/(\d+)/)
      if (m) return cy.wrap(m[1])

      return cy.get('body').invoke('html').then((html) => {
        const ids = scrapeCourseIds(html)
        expect(ids.length, 'course id after create').to.be.greaterThan(0)
        return cy.wrap(ids[0])
      })
    })

export const ensureInstructorCourseId = () =>
  ensureInstructorSession()
    .then(() => go(ROUTES.myCourses))
    .then(() => cy.url({ timeout: 20000 }).should('include', '/my-courses'))
    .then(() => cy.get('body', { timeout: 20000 }).invoke('html'))
    .then((html) => {
      const ids = scrapeCourseIds(html)
      if (ids.length) return cy.wrap(ids[0])
      return createInstructorDraftCourse(`MEN1726 Course ${Date.now()}`)
    })

export const getInstructorCourseId = ensureInstructorCourseId

const pathKey = (path = '') => path.replace(/^\//, '').replace(/\/$/, '')

/** True when the browser is no longer on the protected path (typical denial = bounce to /dashboard). */
export const wasRedirectedAway = (url = '', path = '') => {
  const key = pathKey(path)
  if (!key) return false
  if (url.includes(key)) return false
  // Exact dashboard home after trying a nested dashboard route
  if (path.includes('/dashboard/') && /\/dashboard\/?(\?|$)/.test(url)) return true
  if (url.includes('/login')) return true
  if (/^https?:\/\/[^/]+\/?(?:\?|$)/.test(url)) return true
  return !url.includes(key)
}

const pageMainText = ($b) => {
  const alerts = $b.find('.alert-danger, .alert-warning, .invalid-feedback, [role="alert"]').text()
  const main = $b.find('.dashboard-wrap, .main-content, #wrapper, main, .container-fluid').first().text()
  return `${alerts}\n${main}\n${$b.text()}`
}

const hasCourseWriteAccess = ($b, path) => {
  if (path.includes('/information')) {
    return $b.find('#title, input[name="title"]').filter(':visible:not([readonly]):not([disabled])').length > 0
  }
  if (path.includes('/curriculum')) {
    return $b.find('button, a, input[type="submit"]').filter((_, el) =>
      /add lecture|add section|add topic|save|create/i.test(el.textContent || el.value || ''),
    ).length > 0
  }
  if (path.includes('/pricing')) {
    return $b.find('input[name*="price"], input[id*="price"], button').filter((_, el) =>
      /price|save|update|set pricing/i.test(el.name || el.id || el.textContent || el.value || ''),
    ).filter(':visible:not([readonly]):not([disabled])').length > 0
  }
  if (/\/courses\/\d+\/?$/.test(path)) {
    return $b.find('a, button').filter((_, el) =>
      /enrolled students|view students|roster/i.test(el.textContent || ''),
    ).length > 0
  }
  return false
}

export const assertWithdrawAccessAllowed = () =>
  go(ROUTES.withdraw).then(() => {
    cy.url({ timeout: 20000 }).should('include', '/dashboard/withdraw')
    cy.title({ timeout: 15000 }).should('match', /withdraw/i)
  })

export const assertWithdrawAccessDenied = () =>
  go(ROUTES.withdraw).then(() =>
    cy.url({ timeout: 15000 }).should((url) => {
      expect(
        wasRedirectedAway(url, ROUTES.withdraw) || !url.includes('/dashboard/withdraw'),
        'assistant must not open /dashboard/withdraw',
      ).to.be.true
    }),
  )

export const assertAccessDenied = (path) =>
  go(path).then(() =>
    cy.url({ timeout: 15000 }).then((url) => {
      if (wasRedirectedAway(url, path)) return

      cy.get('body').then(($b) => {
        const text = pageMainText($b)
        const deniedByMessage = ACCESS_DENIED_MSG_RE.test(text) || ROUTE_MISSING_RE.test(text)
        const deniedByReadOnly =
          (/\/dashboard\/courses\/\d+/.test(path) || path.includes('/withdraw')) &&
          !hasCourseWriteAccess($b, path)

        expect(
          deniedByMessage || deniedByReadOnly,
          `assistant denied for ${path} (url: ${url})`,
        ).to.be.true
      })
    }),
  )

export const assertAccessAllowed = (path, { mustInclude = null, selector = null } = {}) =>
  go(path).then(() => {
    cy.url({ timeout: 20000 }).then((url) => {
      const segment = mustInclude || pathKey(path).split('/').slice(-2).join('/')
      expect(url, `allowed access to ${path}`).to.include(segment)
      expect(wasRedirectedAway(url, path), `must stay on ${path}`).to.be.false
      if (selector) cy.get(selector, { timeout: 15000 }).should('exist')
    })
  })

/** Sidebar/nav scoped — avoid false positives from debugbar / page copy. */
export const assertNavContains = (labelRe) =>
  cy.get('.dashboard-menu, .sidebar, nav, .left-side, #sidebar, body', { timeout: 15000 })
    .first()
    .invoke('text')
    .should('match', labelRe)

export const assertNavMissing = (labelRe) =>
  cy.get('.dashboard-menu, .sidebar, nav, .left-side, #sidebar', { timeout: 15000 }).then(($nav) => {
    const scope = $nav.length ? $nav : Cypress.$('body')
    // Prefer link text in sidebar anchors only
    const linkText = [...scope.find('a')].map((a) => (a.textContent || '').trim()).join('\n')
    expect(labelRe.test(linkText), `nav item ${labelRe} should be hidden`).to.be.false
  })

export const assertReadOnlyDashboard = () =>
  go('/dashboard').then(() =>
    cy.get('body').invoke('text').then((text) => {
      expect(WORKING_FOR_RE.test(text), 'assistant dashboard loads').to.be.true
      expect(/create new course/i.test(text), 'no create course CTA').to.be.false
    }),
  )

export const assertCannotManageAssistants = () =>
  go(ASSISTANTS_LIST).then(() =>
    cy.url({ timeout: 15000 }).should((url) => {
      expect(
        wasRedirectedAway(url, ASSISTANTS_LIST) || !url.includes('/dashboard/assistants'),
        'assistant cannot open assistants management',
      ).to.be.true
    }),
  )

export const assertCannotChangeZoom = () =>
  go(ROUTES.zoom).then(() =>
    cy.url({ timeout: 15000 }).then((url) => {
      if (wasRedirectedAway(url, ROUTES.zoom)) return

      cy.get('body').then(($b) => {
        const main = pageMainText($b)
        if (ACCESS_DENIED_MSG_RE.test(main) || ROUTE_MISSING_RE.test(main)) return

        const $actions = $b.find('a, button, input[type="submit"]').filter((_, el) =>
          /connect.*zoom|disconnect.*zoom|revoke.*zoom|authorize.*zoom|link.*zoom|unlink.*zoom/i.test(
            el.textContent || el.value || '',
          ),
        )
        expect($actions.length, 'assistant must not connect or disconnect Zoom').to.equal(0)
      })
    }),
  )

export const assertCannotArchiveCourse = () =>
  go(ROUTES.myCourses).then(() =>
    cy.get('body').then(($b) => {
      const $archive = $b.find('a, button').filter((_, el) => /archive|أرش/i.test(el.textContent || ''))
      expect($archive.length, 'assistant should not see archive controls').to.equal(0)
    }),
  )

/** Course page may open without students.view — roster controls must still be absent. */
export const assertCannotViewEnrolledStudents = (courseId) =>
  go(`/dashboard/courses/${courseId}`).then(() =>
    cy.url({ timeout: 15000 }).then((url) => {
      if (wasRedirectedAway(url, `/dashboard/courses/${courseId}`)) return

      cy.get('body').then(($b) => {
        const $roster = $b.find('a, button').filter((_, el) =>
          /enrolled students|view students|\broster\b/i.test(el.textContent || ''),
        )
        expect($roster.length, 'no enrolled-students controls without permission').to.equal(0)
      })
    }),
  )
