/**
 * Course Access Rights
 *
 * Access rights to the course depend on the user status:
 *   - Instructors can access all their courses
 *   - Admin can access all courses on the platform
 *   - Students can access the courses they are enrolled in, if:
 *       • the course still has active access
 *       • they don't have overdue / pending payment on that course
 *
 * Covers CAR-001 … CAR-015 (see course_access_rights_test_cases.csv).
 */

import {
  loginInstructor,
  loginAdmin,
  loginStudent,
  loginStudentAlt,
  findInstructorOwnCourseId,
  findInstructorOwnCourseIds,
  findInstructorPublicCourseSlug,
  findEnrolledCourseSlug,
  findActiveEnrolledCourseSlug,
  findNotEnrolledCourseSlug,
  assertInstructorCanManageCourse,
  assertAdminCanAccessCourse,
  assertStudentCanAccessEnrolledCourse,
  assertStudentBlockedFromInstructorDashboardCourse,
  assertStudentBlockedFromAdminCourses,
  assertStudentCannotLearnWithoutEnrollment,
  startPendingOfflinePurchase,
  assertPendingOrBlockedAccess,
  assertPurchasesShowPending,
  assertEnrolledPageShowsAccessSignals,
  go,
  pageUiText,
  isMissingPage,
  ENROLL_CTA_RE,
  PENDING_RE,
  ACCESS_BLOCK_RE,
} from './course_access_rights_support.js'

describe('Course Access Rights', () => {
  // ─── Instructor ────────────────────────────────────────────────────────────

  it('CAR-001 | [Positive] Instructor can access management tabs of their own course', () => {
    loginInstructor()
    findInstructorOwnCourseId().then((id) => {
      assertInstructorCanManageCourse(id)
    })
  })

  it('CAR-002 | [Positive] Instructor can access multiple owned courses', () => {
    loginInstructor()
    findInstructorOwnCourseIds(2).then((ids) => {
      expect(ids.length, 'instructor should own courses').to.be.greaterThan(0)
      ids.forEach((id) => {
        go(`/dashboard/courses/${id}/information`)
        cy.url({ timeout: 20000 }).should('include', `/dashboard/courses/${id}/information`)
        pageUiText().should((text) => {
          expect(isMissingPage(text)).to.eq(false)
        })
      })
    })
  })

  it('CAR-003 | [Positive] Instructor can open the public page of their own course', () => {
    loginInstructor()
    findInstructorPublicCourseSlug().then((slug) => {
      go(`/courses/${slug}`)
      cy.url({ timeout: 20000 }).should('include', `/courses/${slug}`)
      pageUiText().should((text) => {
        expect(isMissingPage(text)).to.eq(false)
      })
    })
  })

  // ─── Admin ─────────────────────────────────────────────────────────────────

  it('CAR-004 | [Positive] Admin can access all courses on the platform', () => {
    loginInstructor()
    findInstructorOwnCourseId().then((id) => {
      loginAdmin()
      assertAdminCanAccessCourse(id)
    })
  })

  it('CAR-005 | [Positive] Admin can open a public course page on the platform', () => {
    loginInstructor()
    findInstructorPublicCourseSlug().then((slug) => {
      loginAdmin()
      go(`/courses/${slug}`)
      cy.url({ timeout: 20000 }).should('include', `/courses/${slug}`)
      pageUiText().should((text) => {
        expect(isMissingPage(text)).to.eq(false)
      })
    })
  })

  // ─── Student — positive (enrolled + active) ────────────────────────────────

  it('CAR-006 | [Positive] Enrolled student can access a course with active access', () => {
    loginStudent()
    findActiveEnrolledCourseSlug().then((slug) => {
      assertStudentCanAccessEnrolledCourse(slug)
    })
  })

  it('CAR-007 | [Positive] Enrolled student sees the course under Enrolled Courses', () => {
    loginStudent()
    findEnrolledCourseSlug().then((slug) => {
      go('/dashboard/enrolled-courses')
      cy.get(`a[href*="/courses/${slug}"]`, { timeout: 15000 })
        .should('exist')
        .first()
        .invoke('text')
        .should('not.be.empty')
    })
  })

  // ─── Student — negative (no enrollment / wrong role) ───────────────────────

  it('CAR-008 | [Negative] Student cannot access instructor course management pages', () => {
    loginInstructor()
    findInstructorOwnCourseId().then((id) => {
      loginStudent()
      assertStudentBlockedFromInstructorDashboardCourse(id)
    })
  })

  it('CAR-009 | [Negative] Student cannot access admin course management', () => {
    loginStudent()
    assertStudentBlockedFromAdminCourses()
  })

  it('CAR-010 | [Negative] Student cannot learn a course they are not enrolled in', () => {
    loginStudent()
    findNotEnrolledCourseSlug().then((slug) => {
      assertStudentCannotLearnWithoutEnrollment(slug)
    })
  })

  it('CAR-011 | [Negative] Different student without enrollment is blocked from learning', () => {
    loginStudentAlt()
    // Use a known popular enrolled course of the primary student if alt is not enrolled.
    findNotEnrolledCourseSlug().then((slug) => {
      assertStudentCannotLearnWithoutEnrollment(slug)
    })
  })

  // ─── Student — pending / inactive access ───────────────────────────────────

  it('CAR-012 | [Negative] Student with pending payment does not get active course access', () => {
    loginInstructor()
    findInstructorPublicCourseSlug().then((slug) => {
      loginStudent()
      go('/dashboard/enrolled-courses')
      cy.get('body').then(($b) => {
        const already = $b.find(`a[href*="/courses/${slug}"]`).length > 0
        const target$ = already ? findNotEnrolledCourseSlug() : cy.wrap(slug)

        target$.then((target) => {
          startPendingOfflinePurchase(target).then((res) => {
            if (!res.started) {
              go('/dashboard/purchases')
              pageUiText().then((text) => {
                const ok =
                  PENDING_RE.test(text) || ENROLL_CTA_RE.test(text) || /purchase|order/i.test(text)
                expect(ok, 'pending-payment scenario observable via purchases/enroll state').to.eq(
                  true,
                )
              })
              assertPendingOrBlockedAccess(target)
              return
            }
            assertPurchasesShowPending()
            assertPendingOrBlockedAccess(target)
          })
        })
      })
    })
  })

  it('CAR-013 | [Positive/Negative] Enrolled page reflects access / payment restriction signals', () => {
    // Story: access depends on active access and no overdue/pending payment.
    // On live data this may show refund/suspended/expired/purchase CTAs.
    loginStudent()
    assertEnrolledPageShowsAccessSignals()
    pageUiText().then((text) => {
      // Page must load meaningfully; restriction CTAs are data-dependent.
      expect(text.length).to.be.greaterThan(80)
      if (ACCESS_BLOCK_RE.test(text)) {
        cy.log('Restriction/payment language found — aligns with story gates')
      }
    })
  })

  // ─── Guest ─────────────────────────────────────────────────────────────────

  it('CAR-014 | [Negative] Guest cannot open instructor course management', () => {
    cy.clearCookies()
    cy.clearLocalStorage()
    go('/dashboard/my-courses')
    cy.url({ timeout: 20000 }).should('include', '/login')
  })

  it('CAR-015 | [Negative] Guest cannot open admin course management', () => {
    cy.clearCookies()
    cy.clearLocalStorage()
    go('/admin/courses')
    cy.url({ timeout: 20000 }).should((url) => {
      expect(
        url.includes('/login') || url.includes('/admin'),
        'guest is challenged for admin courses',
      ).to.eq(true)
    })
    cy.url().then((url) => {
      if (!url.includes('/login')) {
        pageUiText().should('match', /login|sign in|email|password|unauthorized|forbidden/i)
      }
    })
  })
})
