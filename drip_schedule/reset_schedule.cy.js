/**
 * Reset Schedule — drip content (dev.mentoraeg.com)
 *
 * Story:
 *   - Reset Schedule button + confirm dialog
 *   - POST /dashboard/courses/{id}/drip/reset clears all section/content unlock dates & days
 *   - Course-update review ON  → clear is queued for admin approval
 *   - Course-update review OFF → clear applies immediately
 *   - Saving drip on a published course with review OFF applies immediately, drops leftover
 *     pending drip CourseUpdate, and clears last_moderation_status when nothing else is pending
 *   - Empty unlock fields are stored as null (UI stays empty, not "0" / leftover strings)
 */

import { loginViaApi } from '../../support/navigation.js'
import {
  BASE,
  STUDENT,
  OTHER_INSTRUCTOR,
  SAMPLE_DATE,
  SAMPLE_DAYS,
  RESET_BTN,
  UNLOCK_DATE,
  UNLOCK_DAYS,
  loginInstructor,
  loginAdmin,
  go,
  goDrip,
  createRecordedCourse,
  addSection,
  addLecture,
  fillUnlockSample,
  saveSchedule,
  stubResetConfirm,
  clickResetSchedule,
  resetScheduleAndWait,
  assertUnlocksEmpty,
  assertUnlocksHaveValues,
  readUnlockValues,
  snapshotUnlocks,
  assertNoPendingDripRow,
  assertAdminQueueDripFor,
  setCourseUpdateReview,
  readReviewEnabled,
  publishCourseAsAdmin,
  csrfFrom,
  pageUiText,
  basicAuth,
} from './reset_schedule_support.js'

const TS = Date.now()
const COURSE_TITLE = `Drip Reset ${TS}`
const SECTION_NAME = `Drip Section ${TS}`
const LECTURE_TITLE = `Drip Lecture ${TS}`

let courseId = null
let emptyCourseId = null
let originalReviewOn = null
let coursePublished = false

describe('Reset Schedule — drip content', { testIsolation: false }, () => {
  before(() => {
    cy.on('uncaught:exception', () => false)

    readReviewEnabled().then((on) => {
      originalReviewOn = on
      cy.log(`original require_course_update_review=${on}`)
    })

    createRecordedCourse(COURSE_TITLE).then((id) => {
      courseId = id
    })

    cy.then(() => {
      expect(courseId, 'courseId').to.exist
      addSection(courseId, SECTION_NAME)
    })

    cy.then(() => {
      addLecture(courseId, LECTURE_TITLE)
    })
  })

  after(() => {
    cy.then(() => {
      if (originalReviewOn === null) return
      setCourseUpdateReview(originalReviewOn)
    })
  })

  // ─── UI / confirm ───────────────────────────────────────────────────────────

  it('RS-P-01 | [Positive] Reset Schedule button is on the Scheduling page when the course has a syllabus', () => {
    loginInstructor()
    goDrip(courseId)
    cy.contains('h1, .course-edit-header-title', COURSE_TITLE, { timeout: 20000 }).should('exist')
    cy.contains(/How Scheduling Works/i).should('exist')
    cy.get(RESET_BTN).should('be.visible').and('contain.text', 'Reset Schedule')
    cy.get(`form[action$="/dashboard/courses/${courseId}/drip/reset"]`).should('exist')
    cy.get(UNLOCK_DATE).should('have.length.at.least', 1)
    cy.get(UNLOCK_DAYS).should('have.length.at.least', 1)
  })

  it('RS-P-02 | [Positive] Reset Schedule shows a confirm dialog and Cancel leaves unlock fields unchanged', () => {
    loginInstructor()
    goDrip(courseId)
    fillUnlockSample()
    saveSchedule()
    goDrip(courseId)
    assertUnlocksHaveValues()

    readUnlockValues().then((before) => {
      cy.intercept('POST', '**/drip/reset').as('dripReset')
      stubResetConfirm(false)
      clickResetSchedule()
      cy.wait(1000)
      cy.get('@dripReset.all').then((calls) => {
        expect(calls.length, 'cancel must not POST /drip/reset').to.eq(0)
      })
      readUnlockValues().then((after) => {
        expect(after, 'unlock values after cancel').to.deep.equal(before)
      })
    })
  })

  it('RS-P-03 | [Positive] Save Schedule persists specific date and days-after-enrollment', () => {
    loginInstructor()
    goDrip(courseId)
    fillUnlockSample()
    saveSchedule()
    goDrip(courseId)
    cy.get(UNLOCK_DATE).first().invoke('val').should('include', SAMPLE_DATE)
    cy.get(UNLOCK_DAYS).first().invoke('val').should('eq', SAMPLE_DAYS)
  })

  it('RS-P-04 | [Positive] Confirm Reset Schedule POSTs /drip/reset and clears all unlock dates and days (draft, immediate)', () => {
    loginInstructor()
    goDrip(courseId)
    fillUnlockSample()
    saveSchedule()
    goDrip(courseId)
    assertUnlocksHaveValues()

    resetScheduleAndWait()
    goDrip(courseId)
    assertUnlocksEmpty()
  })

  it('RS-P-05 | [Positive] Saving empty unlock fields keeps them empty (stored as null, not leftover strings)', () => {
    loginInstructor()
    goDrip(courseId)
    fillUnlockSample()
    saveSchedule()
    goDrip(courseId)

    cy.get(UNLOCK_DATE).each(($el) => cy.wrap($el).clear({ force: true }).blur())
    cy.get(UNLOCK_DAYS).each(($el) => cy.wrap($el).clear({ force: true }).blur())
    saveSchedule()
    goDrip(courseId)
    assertUnlocksEmpty()
    cy.get(UNLOCK_DAYS).each(($el) => {
      expect(String($el.val() || ''), 'days must not become 0').to.eq('')
    })
  })

  it('RS-P-06 | [Positive] Draft/unpublished reset applies immediately even if course-update review is ON', () => {
    setCourseUpdateReview(true)
    loginInstructor()
    goDrip(courseId)
    fillUnlockSample()
    saveSchedule()
    goDrip(courseId)
    assertUnlocksHaveValues()
    resetScheduleAndWait()
    goDrip(courseId)
    assertUnlocksEmpty()

    loginInstructor()
    go(`/dashboard/courses/${courseId}/pending-changes`)
    assertNoPendingDripRow()
  })

  // ─── Published + review OFF ─────────────────────────────────────────────────

  it('RS-P-07 | [Positive] Published course + review OFF: Reset Schedule applies immediately', () => {
    setCourseUpdateReview(false)
    ensurePublished()
    loginInstructor()
    goDrip(courseId)
    fillUnlockSample()
    saveSchedule()
    goDrip(courseId)
    assertUnlocksHaveValues()

    resetScheduleAndWait()
    goDrip(courseId)
    assertUnlocksEmpty()
    pageUiText().then((text) => {
      expect(text, 'no leftover pending drip after immediate reset').not.to.match(
        /pending drip|drip update pending|awaiting approval/i,
      )
    })
  })

  it('RS-P-08 | [Positive] Published course + review OFF: Save Schedule applies immediately and does not leave a pending drip CourseUpdate', () => {
    setCourseUpdateReview(false)
    ensurePublished()
    loginInstructor()
    goDrip(courseId)
    fillUnlockSample()
    saveSchedule()
    goDrip(courseId)
    cy.get(UNLOCK_DAYS).first().invoke('val').should('eq', SAMPLE_DAYS)

    loginAdmin()
    go('/admin/courses/updates')
    assertAdminQueueDripFor(COURSE_TITLE, false)
  })

  it('RS-P-09 | [Positive] Review OFF save on a published course removes leftover pending drip CourseUpdate', () => {
    ensurePublished()
    setCourseUpdateReview(true)
    loginInstructor()
    goDrip(courseId)
    fillUnlockSample()
    saveSchedule()

    loginAdmin()
    go('/admin/courses/updates')
    cy.get('body', { timeout: 20000 }).should('contain.text', COURSE_TITLE)

    setCourseUpdateReview(false)
    loginInstructor()
    goDrip(courseId)
    cy.get(UNLOCK_DAYS).first().clear({ force: true }).type('3', { force: true })
    saveSchedule()

    loginAdmin()
    go('/admin/courses/updates')
    assertAdminQueueDripFor(COURSE_TITLE, false)

    loginInstructor()
    go(`/dashboard/courses/${courseId}/pending-changes`)
    assertNoPendingDripRow()
  })

  // ─── Published + review ON ──────────────────────────────────────────────────

  it('RS-P-10 | [Positive] Published course + review ON: Reset Schedule is queued (values stay until admin approval)', () => {
    ensurePublished()
    setCourseUpdateReview(true)
    loginInstructor()
    goDrip(courseId)
    assertUnlocksHaveValues()

    // Snapshot LIVE values before the queued save/reset. The drip form can show a
    // pending overlay (e.g. 7) that is not what students currently get (e.g. 3).
    snapshotUnlocks().then((liveBefore) => {
      fillUnlockSample()
      saveSchedule()
      goDrip(courseId)
      resetScheduleAndWait()
      goDrip(courseId)
      snapshotUnlocks().then((after) => {
        expect(after.replace(/\|/g, ''), 'queued reset must not clear live unlock fields').to.not.eq('')
        expect(after, 'live schedule stays until admin approves the queued reset').to.eq(liveBefore)
      })
    })

    loginAdmin()
    go('/admin/courses/updates')
    cy.get('body', { timeout: 20000 }).should('contain.text', COURSE_TITLE)
  })

  it('RS-P-11 | [Positive] Admin Course Updates queue lists the pending drip reset while review is ON', () => {
    ensurePublished()
    setCourseUpdateReview(true)
    loginAdmin()
    go('/admin/courses/updates')
    cy.contains(COURSE_TITLE, { timeout: 20000 }).should('exist')
    pageUiText().then((text) => {
      expect(text, 'queue shows drip/schedule type or the course row').to.match(/drip|schedule|view changes|pending/i)
    })
  })

  // ─── Negatives ──────────────────────────────────────────────────────────────

  it('RS-N-01 | [Negative] Reset Schedule is hidden when the course has no syllabus', () => {
    createRecordedCourse(`Drip Empty ${TS}`).then((id) => {
      emptyCourseId = id
    })
    cy.then(() => {
      loginInstructor()
      goDrip(emptyCourseId)
      cy.get(RESET_BTN).should('not.exist')
      pageUiText().then((text) => {
        expect(text).to.match(/nothing to see here|nothing to show|no syllabus|no content/i)
      })
    })
  })

  it('RS-N-02 | [Negative] GET /drip/reset does not clear unlock fields', () => {
    loginInstructor()
    goDrip(courseId)
    fillUnlockSample()
    saveSchedule()
    goDrip(courseId)
    assertUnlocksHaveValues()

    cy.request({
      method: 'GET',
      url: `${BASE()}/dashboard/courses/${courseId}/drip/reset`,
      auth: basicAuth(),
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status, 'GET reset must not succeed as a clear').to.be.oneOf([404, 405, 302, 200, 419])
    })

    goDrip(courseId)
    assertUnlocksHaveValues()
  })

  it('RS-N-03 | [Negative] Reset POST without CSRF is rejected', () => {
    loginInstructor()
    cy.request({
      method: 'POST',
      url: `${BASE()}/dashboard/courses/${courseId}/drip/reset`,
      auth: basicAuth(),
      form: true,
      failOnStatusCode: false,
      followRedirect: false,
      body: {},
    }).then((res) => {
      expect(res.status, 'missing CSRF').to.be.oneOf([419, 403, 302, 401])
    })
  })

  it('RS-N-04 | [Negative] Student cannot open instructor drip/reset', () => {
    loginViaApi(STUDENT)
    go(`/dashboard/courses/${courseId}/drip`)
    cy.url({ timeout: 20000 }).should((url) => {
      expect(url).to.satisfy(
        (u) => !u.includes(`/courses/${courseId}/drip`),
        'student must not stay on drip page',
      )
    })

    cy.request({
      method: 'POST',
      url: `${BASE()}/dashboard/courses/${courseId}/drip/reset`,
      auth: basicAuth(),
      form: true,
      failOnStatusCode: false,
      body: { _token: 'invalid' },
    }).then((res) => {
      expect(res.status).to.be.oneOf([401, 403, 404, 419, 302])
    })
  })

  it('RS-N-05 | [Negative] Another instructor cannot reset this course', function () {
    loginViaApi(OTHER_INSTRUCTOR, { allowFailure: true }).then((result) => {
      if (result?.skipped) {
        cy.log('SKIP: other instructor credentials failed on dig')
        this.skip()
        return
      }
      go(`/dashboard/courses/${courseId}/drip`)
      cy.url({ timeout: 20000 }).then((url) => {
        const blocked = !url.includes(`/courses/${courseId}/drip`)
        cy.get('body').then(($b) => {
          const denied = /permission|not authorized|forbidden|404|not found/i.test($b.text())
          expect(blocked || denied, 'other instructor blocked from drip').to.eq(true)
        })
      })
    })
  })

  it('RS-N-06 | [Negative] Unauthenticated POST /drip/reset does not clear the schedule', () => {
    loginInstructor()
    goDrip(courseId)
    fillUnlockSample()
    saveSchedule()

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
        url: `${BASE()}/dashboard/courses/${courseId}/drip/reset`,
        auth: basicAuth(),
        form: true,
        failOnStatusCode: false,
        followRedirect: false,
        body: { _token: token },
      })
    }).then((res) => {
      expect(res.status).to.be.oneOf([401, 403, 302, 419])
    })

    loginInstructor()
    goDrip(courseId)
    assertUnlocksHaveValues()
  })

  it('RS-N-07 | [Negative] Unknown course id drip/reset is not found', () => {
    loginInstructor()
    go('/dashboard/courses/99999999/drip')
    cy.url({ timeout: 20000 }).then((url) => {
      const leftDrip = !/\/courses\/99999999\/drip/.test(url)
      cy.get('body').then(($b) => {
        const text = ($b.text() || '').replace(/\s+/g, ' ')
        const missingPage = /not found|404|no longer|does not exist|back to home/i.test(text)
        const noReset = $b.find(RESET_BTN).length === 0
        expect(
          leftDrip || missingPage || noReset,
          'unknown course must not open a usable Reset Schedule page',
        ).to.eq(true)
      })
    })
    cy.request({
      method: 'POST',
      url: `${BASE()}/dashboard/courses/99999999/drip/reset`,
      auth: basicAuth(),
      failOnStatusCode: false,
      form: true,
      body: { _token: 'x' },
    }).then((res) => {
      expect(res.status).to.be.oneOf([404, 403, 419, 302])
    })
  })

  it('RS-N-08 | [Negative] Published + review ON: Reset Schedule must NOT wipe live unlock fields immediately', () => {
    ensurePublished()
    setCourseUpdateReview(true)
    loginInstructor()
    goDrip(courseId)
    assertUnlocksHaveValues()
    resetScheduleAndWait()
    goDrip(courseId)
    assertUnlocksHaveValues()
  })
})

function ensurePublished() {
  if (coursePublished) return
  publishCourseAsAdmin(courseId)
  coursePublished = true
}
