/**
 * MEN-231 — Instructor Personal ID Verification → Publish Gate
 *
 * Story: Instructor uploads national ID card; admin approves in
 *        /admin/verifications; only then can instructor publish courses.
 *
 * E2E flow (testIsolation: false):
 *   MEN-231-01  Register new instructor (complete email verify on dig)
 *   MEN-231-02  Instructor lands on Settings → Verification upload page
 *   MEN-231-03  Valid ID card image submitted → pending review
 *   MEN-231-04  Uploaded ID shows pending — waiting for admin approval
 *   MEN-231-05  Create draft course — cannot publish while ID pending admin review
 *   MEN-231-06  Admin opens verifications queue and approves request
 *   MEN-231-07  After admin approval instructor can submit course for publish
 *
 * Negative (isolated):
 *   MEN-231-08  Submit without ID file — validation error
 *   MEN-231-09  Invalid file type rejected
 *   MEN-231-10  Guest blocked from identity routes
 *   MEN-231-11  Student blocked from instructor identity upload
 */

import { loginViaApi } from '../../support/navigation.js'
import { STUDENT } from '../../support/users.js'
import {
  BASE,
  AUTH,
  ID_INVALID,
  IDENTITY_ROUTE,
  ID_DOCUMENT_INPUT,
  ID_UPLOAD_BTN,
  IDENTITY_PAGE_RE,
  PENDING_STATUS_RE,
  APPROVED_STATUS_RE,
  VALIDATION_RE,
  registerFreshInstructorReady,
  openIdentityVerificationPage,
  uploadInstructorIdCard,
  getIdDocumentInput,
  clickUploadDocumentBtn,
  createDraftCourse,
  assertPublishBlocked,
  assertCanSubmitCourseForPublish,
  adminApproveInstructorIdentity,
  ensureInstructorSession,
} from './instructor_verification_support.js'

const TS = Date.now()
const COURSE_TITLE = `MEN231 Course ${TS}`

let freshInstructor = null
let courseId = null

// ─── Full business journey ────────────────────────────────────────────────────

describe('MEN-231 — ID upload → Admin approve → Publish allowed', { testIsolation: false }, () => {

  it('MEN-231-01 | [Positive] Register new instructor and reach dashboard', () => {
    registerFreshInstructorReady('main').then((user) => {
      freshInstructor = user
    })
  })

  it('MEN-231-02 | [Positive] Instructor opens Settings → Verification upload page', function () {
    if (!freshInstructor) this.skip()

    openIdentityVerificationPage(freshInstructor)
    cy.get('body').invoke('text').should('match', IDENTITY_PAGE_RE)
    cy.get(ID_UPLOAD_BTN).should('exist')
    getIdDocumentInput().should('exist')
  })

  it('MEN-231-03 | [Positive] New instructor uploads national ID card image', function () {
    if (!freshInstructor) this.skip()

    openIdentityVerificationPage(freshInstructor)
    uploadInstructorIdCard()
    cy.get('body', { timeout: 20000 }).invoke('text').should('match',
      /success|submitted|received|pending|thank you|uploaded|تم|قيد المراجعة/i)
  })

  it('MEN-231-04 | [Positive] Uploaded ID shows pending — waiting for admin approval', function () {
    if (!freshInstructor) this.skip()

    openIdentityVerificationPage(freshInstructor)
    cy.get('body', { timeout: 15000 }).invoke('text').should('match', PENDING_STATUS_RE)
  })

  it('MEN-231-05 | [Negative] Instructor cannot publish while ID is pending admin review', function () {
    if (!freshInstructor) this.skip()

    createDraftCourse(COURSE_TITLE, freshInstructor).then((id) => {
      courseId = id
    })

    cy.then(function () {
      if (!courseId) this.skip()
    })

    assertPublishBlocked(courseId, 'ID uploaded but not yet approved by admin')
  })

  it('MEN-231-06 | [Positive] Admin opens Instructor Verifications and approves ID request', function () {
    if (!freshInstructor) this.skip()

    adminApproveInstructorIdentity(freshInstructor)
  })

  it('MEN-231-07 | [Positive] After admin approval instructor can submit course for publish', function () {
    if (!freshInstructor || !courseId) this.skip()

    ensureInstructorSession(freshInstructor).then(() =>
      openIdentityVerificationPage(freshInstructor),
    )
    cy.get('body', { timeout: 15000 }).invoke('text').should('match', APPROVED_STATUS_RE)
    assertCanSubmitCourseForPublish(courseId)
  })
})

// ─── Isolated negative / validation cases ───────────────────────────────────

describe('MEN-231 — Validation & access control', () => {

  it('MEN-231-08 | [Negative] Submit without ID file shows validation error', () => {
    registerFreshInstructorReady('empty').then((user) =>
      cy.wrap(user).as('isoInstructor'),
    )
    cy.get('@isoInstructor').then((user) => openIdentityVerificationPage(user))
    clickUploadDocumentBtn()
    cy.get('body', { timeout: 10000 }).invoke('text').should('match', VALIDATION_RE)
  })

  it('MEN-231-09 | [Negative] Invalid file type is rejected', () => {
    registerFreshInstructorReady('badfile').then((user) =>
      cy.wrap(user).as('isoInstructor'),
    )
    cy.get('@isoInstructor').then((user) => openIdentityVerificationPage(user))
    clickUploadDocumentBtn()
    getIdDocumentInput().selectFile(ID_INVALID(), { force: true })
    clickUploadDocumentBtn()
    cy.get('body', { timeout: 15000 }).invoke('text').should('match',
      /invalid|not allowed|image|pdf|jpg|png|jpeg|file type|غير صالح|نوع الملف/i)
  })

  it('MEN-231-10 | [Negative] Guest blocked from identity upload routes', () => {
    cy.clearCookies()
    cy.clearLocalStorage()

    cy.request({
      method: 'GET',
      url: `${BASE()}${IDENTITY_ROUTE}`,
      auth: AUTH,
      failOnStatusCode: false,
      followRedirect: true,
    }).then((res) => {
      if (res.status === 404) return
      const blocked = res.status === 401 || res.status === 403 ||
        (res.redirects || []).some((r) => /\/login/i.test(r)) ||
        /log in|login|sign in/i.test(res.body || '')
      expect(blocked, `guest blocked from ${IDENTITY_ROUTE}`).to.be.true
    })
  })

  it('MEN-231-11 | [Negative] Student cannot access instructor identity upload', () => {
    loginViaApi(STUDENT)

    cy.request({
      method: 'GET',
      url: `${BASE()}${IDENTITY_ROUTE}`,
      auth: AUTH,
      failOnStatusCode: false,
      followRedirect: true,
    }).then((res) => {
      if (res.status === 404) return
      const blocked = res.status === 403 ||
        (res.redirects || []).some((r) => /\/login|\/dashboard(?!\/settings)/i.test(r)) ||
        !/upload|identity verification|personal id|id card/i.test(res.body || '')
      expect(blocked, `student blocked or no upload UI on ${IDENTITY_ROUTE}`).to.be.true
    })
  })
})
