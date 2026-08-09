/**
 * Course Access Rights — helpers
 *
 * Rules:
 *   - Instructors can access all of their own courses (dashboard management).
 *   - Admin can access all courses on the platform.
 *   - Students can access courses they are enrolled in only when:
 *       • access is still active
 *       • there is no overdue / pending payment on that course
 */

import { loginViaApi } from '../../support/navigation.js'
import { HTTP_AUTH, ADMIN, INSTRUCTOR, STUDENT, STUDENTS } from '../../support/users.js'

export const BASE = 'https://dev.mentoraeg.com'
export const AUTH = HTTP_AUTH

export const STUDENT_ALT = STUDENTS[1] || STUDENT

// NOTE: deliberately no bare '403' here — the Laravel Debugbar (enabled on
// dev/staging) injects large debug JSON into every page, and a bare 3-digit
// '403' can appear incidentally (byte counts, durations, timestamps) even on
// a fully authorized 200 page, causing false-positive "denied" detections.
export const DENIED_RE =
  /do not have permission|not authorized|permission denied|access denied|forbidden|unauthorized|403\s*(forbidden|error)|error\s*403|غير مصرح|لا تملك/i

export const PENDING_RE =
  /pending payment|payment pending|awaiting approval|awaiting payment|incomplete payment|on.?hold|قيد الانتظار|معلق/i

export const OVERDUE_RE =
  /overdue|past due|late payment|متأخر|منتهي الدفع/i

export const EXPIRED_RE =
  /access expired|expired access|access has ended|subscription expired|انتهى الوصول|منتهي/i

export const ENROLL_CTA_RE =
  /buy now|enroll|add to cart|get started|اشتر|سجل الآن|سجّل/i

export const go = (path, opts = {}) =>
  cy.visit(`${BASE}${path}`, { auth: AUTH, failOnStatusCode: false, timeout: 60000, ...opts })

export const loginAs = (user) =>
  loginViaApi(user).then(() => {
    go('/dashboard')
    return cy.url({ timeout: 20000 }).should((url) => {
      expect(url).to.satisfy((u) => !u.includes('/login'), `logged in as ${user.email}`)
    })
  })

export const loginInstructor = () => loginAs(INSTRUCTOR)
export const loginAdmin = () => loginAs(ADMIN)
export const loginStudent = () => loginAs(STUDENT)

export const pageText = () => cy.get('body', { timeout: 15000 }).invoke('text')

export const assertNotLogin = () =>
  cy.url({ timeout: 20000 }).should((url) => {
    expect(url).to.not.include('/login')
  })

/** First instructor-owned course id from /dashboard/my-courses. */
export const findInstructorOwnCourseId = () => {
  go('/dashboard/my-courses')
  cy.url({ timeout: 20000 }).should('include', '/my-courses')
  return cy.get('body', { timeout: 15000 }).then(($b) => {
    const hrefs = [...$b.find('a[href*="/dashboard/courses/"]')]
      .map((a) => a.getAttribute('href') || '')
    const id = hrefs
      .map((h) => (h.match(/\/dashboard\/courses\/(\d+)/) || [])[1])
      .find(Boolean)
    expect(id, 'instructor owns at least one course').to.exist
    return cy.wrap(id)
  })
}

/** Public slug for an instructor course (from my-courses page). */
export const findInstructorPublicCourseSlug = () => {
  go('/dashboard/my-courses')
  return cy.get('body', { timeout: 15000 }).then(($b) => {
    const hrefs = [...$b.find('a[href*="/courses/"]')]
      .map((a) => a.getAttribute('href') || '')
      .filter((h) => /\/courses\/[a-z0-9\-]+/i.test(h) && !h.includes('/dashboard/'))
    const m = (hrefs[0] || '').match(/\/courses\/([a-z0-9\-]+)/i)
    expect(m, 'public course slug on my-courses').to.exist
    return cy.wrap(m[1])
  })
}

/** First enrolled course slug from student enrolled-courses page. */
export const findEnrolledCourseSlug = () => {
  go('/dashboard/enrolled-courses')
  cy.url({ timeout: 20000 }).should('include', '/enrolled-courses')
  return cy.get('body', { timeout: 15000 }).then(($b) => {
    const hrefs = [...$b.find('a[href*="/courses/"]')]
      .map((a) => a.getAttribute('href') || '')
      .filter((h) => /\/courses\/[a-z0-9\-]+/i.test(h))
    const slug = hrefs
      .map((h) => (h.match(/\/courses\/([a-z0-9\-]+)/i) || [])[1])
      .find((s) => s && s.length > 3 && !['create', 'search', 'load'].includes(s))
    expect(slug, 'student has at least one enrolled course').to.exist
    return cy.wrap(slug)
  })
}

export const findFirstLecturePath = (courseSlug) => {
  go(`/courses/${courseSlug}`)
  return cy.get('body', { timeout: 15000 }).then(($b) => {
    const href = [...$b.find(`a[href*="/courses/${courseSlug}/lecture/"]`)]
      .map((a) => a.getAttribute('href') || '')
      .find(Boolean)
    if (!href) return cy.wrap(null)
    const path = href.replace(BASE, '')
    return cy.wrap(path.startsWith('/') ? path : `/${path}`)
  })
}

/** Course slug visible in catalog but NOT in student's enrolled list. */
export const findNotEnrolledCourseSlug = () => {
  go('/dashboard/enrolled-courses')
  return cy.get('body', { timeout: 15000 }).then(($enrolled) => {
    const enrolled = new Set(
      [...$enrolled.find('a[href*="/courses/"]')]
        .map((a) => a.getAttribute('href') || '')
        .map((h) => (h.match(/\/courses\/([a-z0-9\-]+)/i) || [])[1])
        .filter(Boolean),
    )

    go('/courses')
    return cy.get('body', { timeout: 15000 }).then(($cat) => {
      const candidates = [...$cat.find('a[href*="/courses/"]')]
        .map((a) => a.getAttribute('href') || '')
        .map((h) => (h.match(/\/courses\/([a-z0-9\-]+)/i) || [])[1])
        .filter((s) => s && s.length > 5 && !enrolled.has(s))

      expect(candidates.length, 'at least one non-enrolled catalog course').to.be.greaterThan(0)
      return cy.wrap(candidates[0])
    })
  })
}

export const assertInstructorCanManageCourse = (courseId) => {
  const paths = [
    `/dashboard/courses/${courseId}/information`,
    `/dashboard/courses/${courseId}/curriculum`,
    `/dashboard/courses/${courseId}/enrollments`,
  ]
  paths.forEach((path) => {
    go(path)
    cy.url({ timeout: 20000 }).should('include', path)
    pageText().should((text) => {
      expect(DENIED_RE.test(text), `instructor denied on ${path}`).to.eq(false)
    })
  })
}

export const assertAdminCanAccessCourse = (courseId) => {
  go('/admin/courses')
  cy.url({ timeout: 20000 }).should('include', '/admin/courses')
  pageText().should('match', /course/i)

  // There is no bare /admin/courses/{id} route (it 404s) — admin drills into
  // a specific course via its enrollments page instead.
  go(`/admin/courses/${courseId}/enrollments`)
  cy.url({ timeout: 20000 }).should('include', `/admin/courses/${courseId}/enrollments`)
  pageText().should((text) => {
    expect(DENIED_RE.test(text), 'admin must not see denial').to.eq(false)
    expect(/page not found/i.test(text), 'admin course page must not be a 404').to.eq(false)
  })
}

export const assertStudentCanAccessEnrolledCourse = (slug) => {
  go(`/courses/${slug}`)
  cy.url({ timeout: 20000 }).should('include', `/courses/${slug}`)
  pageText().then((text) => {
    expect(PENDING_RE.test(text) && /blocked|cannot access|not allowed/i.test(text), 'active enrollment not pending-blocked').to.eq(false)
    expect(EXPIRED_RE.test(text) && /cannot|blocked|denied/i.test(text), 'active enrollment not expired-blocked').to.eq(false)
  })
  cy.get('body').then(($b) => {
    const lecture = $b.find(`a[href*="/courses/${slug}/lecture/"]`).first()
    if (lecture.length) {
      cy.wrap(lecture).click({ force: true })
      cy.url({ timeout: 20000 }).should('include', '/lecture/')
      cy.get('body', { timeout: 15000 }).should('exist')
    } else {
      cy.log(`No lecture links on ${slug} — course page access is enough`)
    }
  })
}

export const assertStudentBlockedFromInstructorDashboardCourse = (courseId) => {
  go(`/dashboard/courses/${courseId}/curriculum`)
  cy.url({ timeout: 20000 }).should((url) => {
    const blocked =
      url.includes('/dashboard') && !url.includes(`/dashboard/courses/${courseId}/curriculum`)
    expect(blocked, 'student redirected away from instructor curriculum').to.eq(true)
  })
}

export const assertStudentCannotLearnWithoutEnrollment = (slug) => {
  go(`/courses/${slug}`)
  cy.url({ timeout: 20000 }).should('include', `/courses/${slug}`)
  cy.get('body', { timeout: 15000 }).then(($b) => {
    const text = $b.text()
    const lectureHref = $b.find(`a[href*="/courses/${slug}/lecture/"]`).first().attr('href')
    const hasEnrollCta = ENROLL_CTA_RE.test(text) || $b.find('a, button').filter((_, el) =>
      ENROLL_CTA_RE.test(el.textContent || ''),
    ).length > 0

    if (lectureHref) {
      const path = lectureHref.replace(BASE, '')
      go(path.startsWith('http') ? new URL(lectureHref).pathname : path)
      cy.get('body', { timeout: 15000 }).then(($lec) => {
        const lecText = $lec.text()
        const blocked =
          ENROLL_CTA_RE.test(lecText) ||
          PENDING_RE.test(lecText) ||
          DENIED_RE.test(lecText) ||
          /please enroll|must purchase|buy the course|not enrolled|login/i.test(lecText) ||
          !$lec.find('video, iframe, .plyr, .video-js, .lecture-content').length
        // Public marketing pages may still render shell — require enroll CTA or explicit block.
        expect(hasEnrollCta || blocked, `non-enrolled student blocked from learning ${slug}`).to.eq(true)
      })
      return
    }

    expect(hasEnrollCta, `non-enrolled course ${slug} shows enroll/buy CTA`).to.eq(true)
  })
}

/**
 * Start offline checkout for a course (leaves payment pending — do NOT admin-approve).
 * Best-effort: skips gracefully if course has no buy CTA.
 */
export const startPendingOfflinePurchase = (courseSlugOrId) => {
  const path = String(courseSlugOrId).match(/^\d+$/)
    ? `/courses/${courseSlugOrId}`
    : `/courses/${courseSlugOrId}`

  go(path)
  cy.get('body', { timeout: 15000 }).should('exist')

  return cy.get('body').then(($b) => {
    const $cta = $b
      .find('a, button')
      .filter(':visible')
      .filter((_, el) => ENROLL_CTA_RE.test(el.textContent || ''))
      .first()

    if (!$cta.length) {
      cy.log(`No enroll CTA on ${path} — pending-payment path unavailable`)
      return cy.wrap({ started: false })
    }

    cy.wrap($cta).click({ force: true })
    return cy.url({ timeout: 30000 }).then((url) => {
      if (!url.includes('/checkout')) {
        return cy.wrap({ started: false, reason: 'not-checkout' })
      }

      cy.get('body').then(($c) => {
        const radio = $c
          .find(
            'input[type="radio"][value*="offline" i], input[type="radio"][value*="bank" i], ' +
              'input[name*="payment" i][value*="offline" i]',
          )
          .filter(':visible')
          .first()
        if (radio.length) cy.wrap(radio).check({ force: true })
        else {
          cy.contains('label, button, div, span', /offline|bank transfer|manual payment|تحويل/i)
            .filter(':visible')
            .first()
            .click({ force: true })
        }
      })

      cy.get('body').then(($c) => {
        const btn = $c
          .find('button, a.btn, input[type="submit"]')
          .filter(':visible')
          .filter((_, el) =>
            /enroll|complete|pay|checkout|purchase|confirm|submit|place order/i.test(
              el.textContent || el.value || '',
            ),
          )
          .first()
        if (btn.length) cy.wrap(btn).click({ force: true })
      })

      cy.wait(1500)
      return cy.wrap({ started: true, course: courseSlugOrId })
    })
  })
}

export const assertPendingOrBlockedAccess = (slug) => {
  go(`/courses/${slug}`)
  pageText().then((text) => {
    const blocked =
      PENDING_RE.test(text) ||
      OVERDUE_RE.test(text) ||
      EXPIRED_RE.test(text) ||
      ENROLL_CTA_RE.test(text) ||
      DENIED_RE.test(text)
    expect(blocked, `pending/overdue/expired student blocked or still on enroll for ${slug}`).to.eq(true)
  })
}

export const assertPurchasesShowPending = () => {
  go('/dashboard/purchases')
  cy.url({ timeout: 20000 }).should('include', '/purchases')
  pageText().should('match', PENDING_RE)
}
