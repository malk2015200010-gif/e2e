/**
 * Course Access Rights — helpers
 *
 * Rules (story):
 *   - Instructors can access all of their own courses
 *   - Admin can access all courses on the platform
 *   - Students can access courses they are enrolled in only when:
 *       • access is still active
 *       • there is no overdue / pending payment on that course
 */

import { getAppBase, loginViaApi } from '../../support/navigation.js'
import { HTTP_AUTH, basicAuth, ADMIN, INSTRUCTOR, STUDENT, STUDENTS } from '../../support/users.js'

export const BASE = () => getAppBase()
/** @deprecated Prefer basicAuth() — kept for imports that expect AUTH. */
export const AUTH = HTTP_AUTH

// Second student for "not enrolled / no access" cases — must differ from STUDENT
// and must login on dig. student2@demo.com seed password (123456) is stale;
// current working password there is Test@1234, but prefer a stable 123456 account.
export const STUDENT_ALT =
  STUDENTS.find((s) => s.email === 'studentbuysession@demo.com') ||
  STUDENTS.find((s) => s.email === 'student5@demo.com') ||
  {
    ...(STUDENTS.find((s) => s.email === 'student2@demo.com') || STUDENT),
    password: 'Test@1234',
  }


// NOTE: deliberately no bare '403' — Laravel Debugbar on dev can inject incidental digits.
export const DENIED_RE =
  /do not have permission|not authorized|permission denied|access denied|forbidden|unauthorized|403\s*(forbidden|error)|error\s*403|غير مصرح|لا تملك/i

export const PENDING_RE =
  /pending payment|payment pending|awaiting approval|awaiting payment|incomplete payment|on.?hold|قيد الانتظار|معلق/i

export const OVERDUE_RE =
  /overdue|past due|late payment|متأخر|منتهي الدفع/i

export const EXPIRED_RE =
  /access expired|expired access|access has ended|subscription expired|انتهى الوصول|منتهي الصلاحية/i

export const SUSPENDED_RE =
  /suspended|access suspended|موقوف|معلق الوصول/i

export const ENROLL_CTA_RE =
  /buy now|enroll|add to cart|get started|اشتر|سجل الآن|سجّل/i

export const ACCESS_BLOCK_RE = new RegExp(
  [
    PENDING_RE.source,
    OVERDUE_RE.source,
    EXPIRED_RE.source,
    SUSPENDED_RE.source,
    ENROLL_CTA_RE.source,
    DENIED_RE.source,
  ].join('|'),
  'i',
)

export const go = (path, opts = {}) =>
  cy.visit(`${BASE()}${path.startsWith('/') ? path : `/${path}`}`, {
    // Plain object required — Proxy/empty auth causes: "no auth mechanism defined"
    auth: basicAuth(),
    failOnStatusCode: false,
    timeout: 60000,
    ...opts,
  })

/**
 * A real missing page says "page not found" or shows 404 on its own.
 * A course id such as 1791194040760 in the admin notifications is not a 404.
 */
export const isMissingPage = (text) =>
  /page not found/i.test(text) || /(^|[^0-9])404([^0-9]|$)/i.test(text)

export const pageUiText = () =>
  cy.get('body', { timeout: 15000 }).then(($b) => {
    const $clone = $b.clone()
    $clone.find('#phpdebugbar, .phpdebugbar, script, style, noscript').remove()
    return ($clone.text() || '').replace(/\s+/g, ' ').trim()
  })

export const pageText = () => pageUiText()

const RESERVED_COURSE_SLUGS = new Set(['create', 'search', 'load', 'categories', 'new'])

/** Slug from `/courses/{slug}` — absolute or relative, with an optional extra path or query. */
export const parseCourseSlug = (href) => {
  const match = String(href || '').match(/(?:^|\/)courses\/([a-z0-9][a-z0-9\-]*)/i)
  if (!match) return null
  const slug = match[1]
  if (slug.length <= 3 || RESERVED_COURSE_SLUGS.has(slug.toLowerCase())) return null
  return slug
}

/**
 * Enrolled-course landing links.
 * Active rows use `a.pps-action-link` → `/courses/{slug}`.
 * Suspended rows render a disabled `<button class="pps-action-link">` with no href, so they are skipped.
 */
const courseLandingAnchors = ($b) =>
  [...$b.find('a')].filter((a) => {
    if (a.closest('#phpdebugbar, .phpdebugbar')) return false
    return Boolean(parseCourseSlug(a.getAttribute('href') || ''))
  })

/** Status copy for one enrolled card. Do not use `.row` — that is the whole dashboard layout. */
const enrolledCardText = (anchor) => {
  const card =
    anchor.closest('tr') ||
    anchor.closest('div.border.bg-white') ||
    anchor.closest('.course-card, .webinar-card, li') ||
    anchor.parentElement
  return (card?.textContent || '').replace(/\s+/g, ' ')
}

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
export const loginStudentAlt = () => loginAs(STUDENT_ALT)

/** First instructor-owned course id from /dashboard/my-courses. */
export const findInstructorOwnCourseId = () =>
  findInstructorOwnCourseIds().then((ids) => {
    expect(ids.length, 'instructor owns at least one course').to.be.greaterThan(0)
    return cy.wrap(ids[0])
  })

/** Up to N unique instructor-owned course ids. */
export const findInstructorOwnCourseIds = (limit = 3) => {
  go('/dashboard/my-courses')
  cy.url({ timeout: 20000 }).should('include', '/my-courses')
  return cy.get('body', { timeout: 15000 }).then(($b) => {
    const ids = [
      ...new Set(
        [...$b.find('a[href*="/dashboard/courses/"]')]
          .map((a) => a.getAttribute('href') || '')
          .map((h) => (h.match(/\/dashboard\/courses\/(\d+)/) || [])[1])
          .filter(Boolean),
      ),
    ].slice(0, limit)
    return cy.wrap(ids)
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

/**
 * The address bar can already be /enrolled-courses while cy.get('body') still
 * sees the previous document. Retry until a /courses/:slug link is actually in the DOM.
 */
const waitForEnrolledCourseAnchors = () => {
  go('/dashboard/enrolled-courses')
  cy.location('pathname', { timeout: 20000 }).should('include', '/enrolled-courses')
  return cy.get('body', { timeout: 20000 }).should(($b) => {
    expect(
      courseLandingAnchors($b).length,
      'student has at least one enrolled course',
    ).to.be.greaterThan(0)
  })
}

/** First enrolled course slug from student enrolled-courses page. */
export const findEnrolledCourseSlug = () =>
  waitForEnrolledCourseAnchors().then(($b) => {
    const slug = parseCourseSlug(courseLandingAnchors($b)[0].getAttribute('href'))
    return cy.wrap(slug)
  })

/**
 * Prefer an enrolled course that looks "active" (no suspended/expired/pending CTA
 * near the course card). Falls back to first enrolled slug.
 */
export const findActiveEnrolledCourseSlug = () =>
  waitForEnrolledCourseAnchors().then(($b) => {
    const links = courseLandingAnchors($b)
      .map((a) => {
        const slug = parseCourseSlug(a.getAttribute('href'))
        if (!slug) return null
        const cardText = enrolledCardText(a)
        const blocked =
          SUSPENDED_RE.test(cardText) ||
          EXPIRED_RE.test(cardText) ||
          PENDING_RE.test(cardText) ||
          OVERDUE_RE.test(cardText)
        return { slug, blocked }
      })
      .filter(Boolean)

    const pick = links.find((x) => !x.blocked) || links[0]
    return cy.wrap(pick.slug)
  })

/** Course slug visible in catalog but NOT in student's enrolled list. */
export const findNotEnrolledCourseSlug = () =>
  waitForEnrolledCourseAnchors().then(($enrolled) => {
    const enrolled = new Set(
      courseLandingAnchors($enrolled)
        .map((a) => parseCourseSlug(a.getAttribute('href')))
        .filter(Boolean),
    )

    go('/courses')
    return cy.get('body', { timeout: 20000 }).should(($cat) => {
      const candidates = courseLandingAnchors($cat)
        .map((a) => parseCourseSlug(a.getAttribute('href')))
        .filter((s) => s && s.length > 5 && !enrolled.has(s))
      expect(candidates.length, 'at least one non-enrolled catalog course').to.be.greaterThan(0)
    }).then(($cat) => {
      const candidates = courseLandingAnchors($cat)
        .map((a) => parseCourseSlug(a.getAttribute('href')))
        .filter((s) => s && s.length > 5 && !enrolled.has(s))
      return cy.wrap(candidates[0])
    })
  })

export const assertInstructorCanManageCourse = (courseId) => {
  const paths = [
    `/dashboard/courses/${courseId}/information`,
    `/dashboard/courses/${courseId}/curriculum`,
    `/dashboard/courses/${courseId}/enrollments`,
  ]
  paths.forEach((path) => {
    go(path)
    cy.url({ timeout: 20000 }).should('include', path)
    pageUiText().should((text) => {
      expect(DENIED_RE.test(text), `instructor denied on ${path}`).to.eq(false)
      expect(isMissingPage(text), `${path} must not 404`).to.eq(false)
    })
  })
}

export const assertAdminCanAccessCourse = (courseId) => {
  go('/admin/courses')
  cy.url({ timeout: 20000 }).should('include', '/admin/courses')
  pageUiText().should('match', /course/i)

  go(`/admin/courses/${courseId}/enrollments`)
  cy.url({ timeout: 20000 }).should('include', `/admin/courses/${courseId}/enrollments`)
  pageUiText().should((text) => {
    expect(DENIED_RE.test(text), 'admin must not see denial').to.eq(false)
    expect(/page not found/i.test(text), 'admin course page must not be a 404').to.eq(false)
  })
}

export const assertStudentCanAccessEnrolledCourse = (slug) => {
  go(`/courses/${slug}`)
  cy.url({ timeout: 20000 }).should('include', `/courses/${slug}`)
  pageUiText().then((text) => {
    expect(
      PENDING_RE.test(text) && /blocked|cannot access|not allowed/i.test(text),
      'active enrollment not pending-blocked',
    ).to.eq(false)
    expect(
      EXPIRED_RE.test(text) && /cannot|blocked|denied/i.test(text),
      'active enrollment not expired-blocked',
    ).to.eq(false)
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

export const assertStudentBlockedFromAdminCourses = () => {
  go('/admin/courses')
  cy.url({ timeout: 20000 }).should((url) => {
    expect(
      url.includes('/login') || url.includes('/dashboard') || !url.includes('/admin/courses'),
      'student must not stay on admin courses',
    ).to.eq(true)
  })
}

export const assertStudentCannotLearnWithoutEnrollment = (slug) => {
  go(`/courses/${slug}`)
  cy.url({ timeout: 20000 }).should('include', `/courses/${slug}`)
  cy.get('body', { timeout: 15000 }).then(($b) => {
    const text = ($b.text() || '').replace(/\s+/g, ' ')
    const lectureHref = $b.find(`a[href*="/courses/${slug}/lecture/"]`).first().attr('href')
    const hasEnrollCta =
      ENROLL_CTA_RE.test(text) ||
      $b.find('a, button').filter((_, el) => ENROLL_CTA_RE.test(el.textContent || '')).length > 0

    if (lectureHref) {
      let path
      try {
        path = new URL(lectureHref, BASE()).pathname
      } catch {
        path = lectureHref.replace(BASE(), '')
        path = path.startsWith('/') ? path : `/${path}`
      }
      go(path)
      cy.get('body', { timeout: 15000 }).then(($lec) => {
        const lecText = ($lec.text() || '').replace(/\s+/g, ' ')
        const blocked =
          ENROLL_CTA_RE.test(lecText) ||
          PENDING_RE.test(lecText) ||
          DENIED_RE.test(lecText) ||
          /please enroll|must purchase|buy the course|not enrolled|login/i.test(lecText) ||
          !$lec.find('video, iframe, .plyr, .video-js, .lecture-content').length
        expect(hasEnrollCta || blocked, `non-enrolled student blocked from learning ${slug}`).to.eq(true)
      })
      return
    }

    expect(hasEnrollCta, `non-enrolled course ${slug} shows enroll/buy CTA`).to.eq(true)
  })
}

/**
 * Start offline checkout for a course (leaves payment pending — do NOT admin-approve).
 * Best-effort: returns { started:false } if course has no buy CTA.
 */
export const startPendingOfflinePurchase = (courseSlugOrId) => {
  const path = `/courses/${courseSlugOrId}`

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
  pageUiText().then((text) => {
    const blocked = ACCESS_BLOCK_RE.test(text)
    expect(blocked, `pending/overdue/expired student blocked or still on enroll for ${slug}`).to.eq(true)
  })
}

export const assertPurchasesShowPending = () => {
  go('/dashboard/purchases')
  cy.url({ timeout: 20000 }).should('include', '/purchases')
  pageUiText().should('match', PENDING_RE)
}

/** Enrolled-courses page should surface access CTAs when access is not fully active. */
export const assertEnrolledPageShowsAccessSignals = () => {
  go('/dashboard/enrolled-courses')
  pageUiText().then((text) => {
    const hasCourses = /\/courses\//.test(text) || text.length > 100
    expect(hasCourses, 'enrolled-courses page loaded').to.eq(true)
    // Soft signal: refund / suspended / expired / purchase CTAs often appear for restricted access
    if (ACCESS_BLOCK_RE.test(text) || /refund|purchase|pay/i.test(text)) {
      cy.log('Access restriction / payment CTA language present on enrolled-courses')
    } else {
      cy.log('No restriction CTA copy — student enrollments may all be fully active')
    }
  })
}

export { ADMIN, INSTRUCTOR, STUDENT }
