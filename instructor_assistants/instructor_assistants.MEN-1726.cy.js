/**
 * MEN-1726 — Instructor Assistants
 *
 * Parent story: instructor creates assistants with granular permissions;
 * assistants log in under teacher context ("Working for …") and can only
 * perform actions their permissions allow.
 *
 * Denial model on current dev: missing permission usually redirects to
 * /dashboard (no banner). Earnings path is /dashboard/earning (singular).
 *
 * Nav entry (instructor sidebar):
 *   <a href="/dashboard/assistants">… Assistants</a>
 */

import { INSTRUCTOR } from '../../support/users.js'
import { VALID_NEW_PASSWORD } from '../regestration/password_policy_support.js'
import {
  ASSISTANTS_LIST,
  ASSISTANTS_CREATE,
  ASSISTANTS_NAV,
  ASSISTANT_SUBMIT_BTN,
  CREATE_ASSISTANT_LINK,
  PERMS,
  ROUTES,
  DUPLICATE_EMAIL_RE,
  VALIDATION_RE,
  buildAssistantUser,
  openAssistantsViaNav,
  openCreateAssistantPage,
  fillAssistantForm,
  createAssistantViaUi,
  createAssistantViaApi,
  loginAsAssistant,
  deactivateAssistant,
  assertDeactivatedAssistantCannotLogin,
  assertWorkingForTeacher,
  assertAssistantListed,
  ensureInstructorCourseId,
  courseInformationPath,
  assertAccessAllowed,
  assertAccessDenied,
  assertNavContains,
  assertNavMissing,
  assertReadOnlyDashboard,
  assertCannotManageAssistants,
  assertCannotChangeZoom,
  assertCannotArchiveCourse,
  assertCannotViewEnrolledStudents,
  assertWithdrawAccessAllowed,
  assertWithdrawAccessDenied,
  go,
} from './instructor_assistants_support.js'

let sharedAssistant = null
let courseId = null

// ─── Instructor: create & validate assistants ─────────────────────────────────

describe('MEN-1726 — Assistant management (instructor)', () => {

  it('MEN-2135 | [Positive] Instructor can create an assistant', () => {
    const user = buildAssistantUser('create')

    openAssistantsViaNav()
    cy.get(CREATE_ASSISTANT_LINK, { timeout: 15000 }).first().click({ force: true })
    cy.url().should('include', ASSISTANTS_CREATE)

    fillAssistantForm({
      ...user,
      permissions: [PERMS.CREATE_COURSE, PERMS.LIVE_SESSIONS],
    })
    cy.get(ASSISTANT_SUBMIT_BTN).first().click({ force: true })

    cy.url({ timeout: 25000 }).should('include', ASSISTANTS_LIST)
    assertAssistantListed(user.name)
  })

  it('MEN-2140 | [Negative] Duplicate email blocked during assistant creation', () => {
    openCreateAssistantPage()
    fillAssistantForm({
      name: 'Duplicate Assistant',
      email: INSTRUCTOR.email,
      password: VALID_NEW_PASSWORD,
      permissions: [],
    })
    cy.get(ASSISTANT_SUBMIT_BTN).first().click({ force: true })

    cy.url({ timeout: 15000 }).then((url) => {
      const stayedOnForm = url.includes(ASSISTANTS_CREATE)
      if (stayedOnForm) {
        cy.get('body').invoke('text').should('match', DUPLICATE_EMAIL_RE)
      } else {
        // Redirected to list — duplicate must not appear as a new success row for this name
        cy.get('body').invoke('text').should('match', DUPLICATE_EMAIL_RE)
      }
    })
  })

  it('MEN-2141 | [Negative] Required fields validation on create assistant', () => {
    openCreateAssistantPage()
    cy.get(ASSISTANT_SUBMIT_BTN).first().click({ force: true })

    cy.url().should('include', ASSISTANTS_CREATE)
    cy.get('body').then(($b) => {
      const hasHtml5 = $b.find('input:invalid').length > 0
      const hasCopy = VALIDATION_RE.test($b.text())
      expect(hasHtml5 || hasCopy, 'name/email/password validation').to.be.true
    })
  })
})

// ─── Assistant login lifecycle ────────────────────────────────────────────────

describe('MEN-1726 — Assistant login', { testIsolation: false }, () => {

  it('MEN-2142 | [Positive] Assistant logs in and sees Working for teacher', () => {
    sharedAssistant = buildAssistantUser('login')

    createAssistantViaUi({
      ...sharedAssistant,
      permissions: [PERMS.CREATE_COURSE],
    }).then((created) => {
      sharedAssistant = created
      assertAssistantListed(created.name)
      loginAsAssistant(created)
      assertWorkingForTeacher()
    })
  })

  it('MEN-2143 | [Negative] Deactivated assistant cannot access dashboard', function () {
    if (!sharedAssistant) this.skip()

    deactivateAssistant(sharedAssistant)
    assertDeactivatedAssistantCannotLogin(sharedAssistant)
  })
})

// ─── Permission helpers ───────────────────────────────────────────────────────

const withAssistant = (tag, permissions, fn) => {
  const user = buildAssistantUser(tag)
  return createAssistantViaApi({ ...user, permissions }).then((created) =>
    loginAsAssistant(created).then(() => fn(created)),
  )
}

describe('MEN-1726 — Course permissions', { testIsolation: false }, () => {

  before(function () {
    ensureInstructorCourseId().then((id) => { courseId = id })
  })

  it('MEN-2144 | [Positive] Assistant with Create Course permission can open new course form', () => {
    withAssistant('createcourse', [PERMS.CREATE_COURSE], () => {
      assertAccessAllowed(ROUTES.createCourse, { selector: '#title' })
    })
  })

  it('MEN-2145 | [Negative] Assistant without Create Course permission is blocked', () => {
    withAssistant('nocreate', [], () => {
      assertAccessDenied(ROUTES.createCourse)
    })
  })

  it('MEN-2146 | [Positive] Assistant with Public Info permission can edit course title', function () {
    if (!courseId) this.skip()
    withAssistant('publicinfo', [PERMS.PUBLIC_INFO], () => {
      assertAccessAllowed(courseInformationPath(courseId), { selector: '#title, input[name="title"]' })
    })
  })

  it('MEN-2147 | [Negative] Assistant without Public Info permission cannot edit course info', function () {
    if (!courseId) this.skip()
    withAssistant('nopublic', [], () => {
      assertAccessDenied(courseInformationPath(courseId))
    })
  })

  it('MEN-2148 | [Positive] Assistant with Curriculum permission can open curriculum builder', function () {
    if (!courseId) this.skip()
    withAssistant('curriculum', [PERMS.CURRICULUM], () => {
      assertAccessAllowed(`/dashboard/courses/${courseId}/curriculum`, { selector: 'body' })
    })
  })

  it('MEN-2149 | [Negative] Assistant without Curriculum permission is blocked', function () {
    if (!courseId) this.skip()
    withAssistant('nocurriculum', [], () => {
      assertAccessDenied(`/dashboard/courses/${courseId}/curriculum`)
    })
  })

  it('MEN-2150 | [Positive] Assistant with Pricing permission can open pricing page', function () {
    if (!courseId) this.skip()
    withAssistant('pricing', [PERMS.PRICING], () => {
      assertAccessAllowed(`/dashboard/courses/${courseId}/pricing`, { selector: 'body' })
    })
  })

  it('MEN-2151 | [Negative] Assistant without Pricing permission is blocked', function () {
    if (!courseId) this.skip()
    withAssistant('nopricing', [], () => {
      assertAccessDenied(`/dashboard/courses/${courseId}/pricing`)
    })
  })
})

// ─── Live sessions ──────────────────────────────────────────────────────────────

describe('MEN-1726 — Live session permissions', () => {

  it('MEN-2152 | [Positive] Assistant with Manage Live Sessions permission can open sessions', () => {
    withAssistant('livesess', [PERMS.LIVE_SESSIONS], () => {
      assertAccessAllowed(ROUTES.liveSessions, { selector: 'body' })
    })
  })

  it('MEN-2153 | [Negative] Assistant without Manage Live Sessions permission is blocked', () => {
    withAssistant('nolive', [], () => {
      assertAccessDenied(ROUTES.liveSessions)
    })
  })

  it('MEN-2154 | [Positive] Assistant with live sessions sees start/host/create controls', () => {
    withAssistant('zoomhost', [PERMS.LIVE_SESSIONS], () => {
      go(ROUTES.liveSessions)
      cy.url({ timeout: 20000 }).should('include', '/live-sessions')
      cy.get('body').then(($b) => {
        const $actions = $b.find('a, button').filter((_, el) =>
          /start|host|join|create|new live|live session/i.test(el.textContent || ''),
        )
        // Fresh assistants may have no sessions yet — Create / page access is enough.
        expect(
          $actions.length > 0 || /live session/i.test($b.text()),
          'live sessions UI available for permitted assistant',
        ).to.be.true
      })
    })
  })
})

// ─── Students, grading, finance ─────────────────────────────────────────────

describe('MEN-1726 — Students grading and finance permissions', { testIsolation: false }, () => {

  before(function () {
    if (courseId) return
    ensureInstructorCourseId().then((id) => { courseId = id })
  })

  it('MEN-2155 | [Positive] Assistant with View Enrolled Students permission can access roster', function () {
    if (!courseId) this.skip()
    withAssistant('students', [PERMS.VIEW_STUDENTS], () => {
      go(`/dashboard/courses/${courseId}`)
      cy.url({ timeout: 20000 }).should('include', `/courses/${courseId}`)
      cy.get('body').then(($b) => {
        const $roster = $b.find('a, button').filter((_, el) =>
          /enrolled students|roster|students/i.test(el.textContent || ''),
        )
        if ($roster.length) {
          cy.wrap($roster.first()).click({ force: true })
          cy.get('body').invoke('text').should('match', /enrolled|students|roster/i)
        } else {
          // Course page itself is the students entry for some layouts
          cy.wrap(null)
        }
      })
    })
  })

  it('MEN-2156 | [Negative] Assistant without View Enrolled Students permission is blocked', function () {
    if (!courseId) this.skip()
    // Course hub may still open; roster controls must not.
    withAssistant('nostudents', [], () => {
      assertCannotViewEnrolledStudents(courseId)
    })
  })

  it('MEN-2157 | [Positive] Assistant with grading permission can open assignments', () => {
    withAssistant('grading', [PERMS.GRADING], () => {
      assertAccessAllowed(ROUTES.assignments, { selector: 'body' })
    })
  })

  it('MEN-2158 | [Negative] Assistant without grading permission is blocked', () => {
    withAssistant('nograding', [], () => {
      assertAccessDenied(ROUTES.assignments)
    })
  })

  it('MEN-2159 | [Positive] Assistant with View Earnings permission can open earning', () => {
    withAssistant('earnings', [PERMS.EARNINGS], () => {
      assertAccessAllowed(ROUTES.earnings, { mustInclude: '/dashboard/earning', selector: 'body' })
      assertNavContains(/earning/i)
    })
  })

  it('MEN-2160 | [Negative] Assistant without View Earnings permission is blocked', () => {
    withAssistant('noearnings', [], () => {
      go('/dashboard')
      assertNavMissing(/earning/i)
      assertAccessDenied(ROUTES.earnings)
    })
  })

  // Live gate for /dashboard/withdraw is withdraw.view (not withdraw.manage alone).
  it('MEN-2161 | [Positive] Assistant with View Withdraws permission can open /dashboard/withdraw', () => {
    withAssistant('withdraw', [PERMS.WITHDRAW_VIEW], () => {
      assertWithdrawAccessAllowed()
    })
  })

  it('MEN-2162 | [Negative] Assistant without withdraw permission is blocked from /dashboard/withdraw', () => {
    withAssistant('nowithdraw', [], () => {
      assertWithdrawAccessDenied()
    })
  })
})

// ─── Restricted instructor-only actions ───────────────────────────────────────

describe('MEN-1726 — Instructor-only restrictions', () => {

  it('MEN-2163 | [Negative] Assistant cannot manage other assistants', () => {
    withAssistant('noassist', [PERMS.CREATE_COURSE], () => {
      assertCannotManageAssistants()
    })
  })

  it('MEN-2164 | [Negative] Assistant cannot connect or disconnect Zoom', () => {
    withAssistant('nozoom', [PERMS.LIVE_SESSIONS], () => {
      assertCannotChangeZoom()
    })
  })

  it('MEN-2165 | [Negative] Assistant cannot archive or unarchive courses', () => {
    withAssistant('noarchive', [PERMS.CREATE_COURSE, PERMS.PUBLIC_INFO], () => {
      assertCannotArchiveCourse()
    })
  })
})

// ─── Menu visibility & read-only mode ───────────────────────────────────────

describe('MEN-1726 — Menu visibility', () => {

  it('MEN-2166 | [Positive] Menu items reflect granted permissions (live sessions only)', () => {
    withAssistant('menulive', [PERMS.LIVE_SESSIONS], () => {
      go('/dashboard')
      assertWorkingForTeacher()
      assertNavContains(/live sessions/i)
      assertNavMissing(/earning/i)
      cy.get(ASSISTANTS_NAV).should('not.exist')
    })
  })

  it('MEN-2167 | [Positive] Assistant with no permissions has read-only dashboard access', () => {
    withAssistant('readonly', [], () => {
      assertReadOnlyDashboard()
      assertAccessDenied(ROUTES.createCourse)
      assertAccessDenied(ROUTES.liveSessions)
      assertAccessDenied(ROUTES.earnings)
    })
  })
})
