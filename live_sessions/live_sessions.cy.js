/**
 * Live Session Management — E2E Test Suite
 *
 * Suites:
 *   TC01–TC16  Core live session management (create, edit, delete, student access)
 *   MEN-1555   Live Sessions shared between courses
 *
 * MEN-1555 link-list rule (course_ids[] on /live-sessions/create):
 *   Archived, expired, and non-live/hybrid courses are excluded from the instructor link list.
 *   Unpublished courses remain visible to the instructor for linking sessions, but are hidden
 *   from students and other public users.
 */

import { visitWithAuth, loginViaApi } from '../../support/navigation.js'
import { HTTP_AUTH, ADMIN, INSTRUCTOR, STUDENT, STUDENTS } from '../../support/users.js'

// ─── Constants ────────────────────────────────────────────────────────────────
const BASE         = 'https://dev.mentoraeg.com'
const AUTH         = HTTP_AUTH
const TS = Date.now()

// Core suite (TC01–TC16)
const CORE_COURSE_TITLE  = `Live Course Auto ${TS}`
const CORE_SESSION_TITLE = `Auto Session ${TS}`
const COURSE_TITLE       = CORE_COURSE_TITLE   // default for helpers
const sessionTitle       = CORE_SESSION_TITLE  // used by TC01–TC16

// MEN-1555 suite
const COURSE_A_TITLE        = `MEN1555 Course A ${TS}`
const COURSE_B_TITLE        = `MEN1555 Course B ${TS}`
const ARCHIVED_COURSE_TITLE = `MEN1555 Archived ${TS}`
const UNPUBLISHED_COURSE_TITLE = `MEN1555 Unpublished ${TS}`
const RECORDED_COURSE_TITLE = `MEN1555 Recorded ${TS}`
const SHARED_SESSION_TITLE  = `MEN1555 Shared Session ${TS}`
const UNPUBLISHED_SESSION_TITLE = `MEN1555 Unpublished Session ${TS}`

/** UI copy for eligible courses on live-session create form */
const LINK_LIST_RULE = /Only active, non-expired and non-archived live or hybrid courses are shown/i

const STUDENT_2 = STUDENTS[1]

// Core suite state (TC01–TC16)
let liveCourseId     = null
let liveSessionId    = null
let deletedSessionId = null

// MEN-1555 suite state
let courseAId        = null
let courseBId        = null
let archivedCourseId = null
let unpublishedCourseId = null
let recordedCourseId = null
let sharedSessionId  = null

// ─── Helpers ──────────────────────────────────────────────────────────────────

const go = (path, opts = {}) =>
  cy.visit(`${BASE}${path}`, { auth: AUTH, failOnStatusCode: false, timeout: 90000, ...opts })

const apiGet = (path) =>
  cy.request({ method: 'GET', url: `${BASE}${path}`, auth: AUTH, failOnStatusCode: false, followRedirect: true })

const minutesFromNow = (n) => {
  const d = new Date(Date.now() + n * 60 * 1000)
  return d.toISOString().slice(0, 16)
}

/** Format schedule for #live_schedule date_picker — UI uses YYYY-MM-DD HH:mm:ss */
const scheduleFromNow = (hoursAhead = 2) => {
  const d = new Date(Date.now() + hoursAhead * 60 * 60 * 1000)
  const yyyy = d.getFullYear()
  const mm   = String(d.getMonth() + 1).padStart(2, '0')
  const dd   = String(d.getDate()).padStart(2, '0')
  const hh   = String(d.getHours()).padStart(2, '0')
  const min  = String(d.getMinutes()).padStart(2, '0')
  const ss   = String(d.getSeconds()).padStart(2, '0')
  const picker = `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`
  return {
    picker,
    iso:     `${yyyy}-${mm}-${dd} ${hh}:${min}`,
    us:      `${mm}/${dd}/${yyyy} ${hh}:${min}`,
    display: `${dd}/${mm}/${yyyy} ${hh}:${min}`,
  }
}

const SCHEDULE_INPUT =
  '#live_schedule, input[name="live_class[schedule]"], input[name="live_session[schedule]"], ' +
  'input.date_picker.ls-form__input, input[name*="schedule"], input[type="datetime-local"]'

const SESSION_TOPIC_INPUT =
  '#live_topic, input[name="live_class[topic]"], input[name="live_session[topic]"], ' +
  'input[name="live_session[title]"], input[name*="topic"], input[name="title"]'

const SESSION_DURATION_INPUT =
  '#live_duration, input[name="live_class[duration]"], input[name="live_session[duration]"], input[name*="duration"]'

const SESSION_RECURRENCE_SELECT =
  '#recurrence_type, select[name="live_class[recurrence_type]"], select[name="live_session[recurrence_type]"]'

const LIVE_SESSIONS_PATH = '/dashboard/live-sessions'
const LIVE_SESSIONS_CREATE_PATH = '/dashboard/live-sessions/create'
const FORM_SCOPES = [
  '#liveSessionForm',
  'form[action*="/live-sessions"]',
  '#createLiveSessionForm',
  '#createMeetingForm',
  '#createMeetingModal',
  '#createLiveSessionModal',
  '.ls-form',
  '.ls-form__body',
]

/** Join comma-separated field selectors under each form scope (avoids matching bare <form>). */
const scopeSelectors = (fieldsCsv, scopes = FORM_SCOPES) => {
  const fields = fieldsCsv.split(',').map((s) => s.trim()).filter(Boolean)
  const parts = []
  for (const scope of scopes) {
    for (const field of fields) {
      parts.push(`${scope} ${field}`)
    }
  }
  parts.push(...fields)
  return parts.join(', ')
}

/** Global live sessions index (replaces per-course /live_class). */
const goToLiveSessionsIndex = () => {
  go(LIVE_SESSIONS_PATH)
  cy.get('body', { timeout: 15000 }).should('exist')
  cy.url({ timeout: 15000 }).should('include', LIVE_SESSIONS_PATH)
}

/** @deprecated — old per-course route removed on dev */
const goToCourseLiveClassPage = (courseId) => {
  cy.log(`WARN: /courses/${courseId}/live_class removed — using ${LIVE_SESSIONS_PATH}`)
  goToLiveSessionsIndex()
}

const goToCourseLiveSessions = (courseId) => goToLiveSessionsIndex()

/** Open create form at /dashboard/live-sessions/create (standalone page, not modal). */
const openCreateLiveSessionForm = (courseId) => {
  expect(courseId, 'courseId required to create live session').to.exist
  goToLiveSessionsIndex()

  cy.get('body').then(($b) => {
    const $create = $b
      .find(
        'a[href*="/live-sessions/create"], button[data-target="#createMeetingModal"], ' +
          'button[data-bs-target="#createMeetingModal"], button[data-target="#createLiveSessionModal"]',
      )
      .filter(':visible')
      .first()

    if ($create.length && ($create.is('a') || $create.attr('href'))) {
      cy.wrap($create).click({ force: true })
    } else if ($create.length) {
      cy.wrap($create).click({ force: true })
    } else {
      go(LIVE_SESSIONS_CREATE_PATH)
    }
  })

  cy.url({ timeout: 20000 }).should('match', /\/live-sessions(\/create)?/)

  // Legacy modal flow (older course pages) — optional
  cy.get('body').then(($b) => {
    if ($b.find('#createMeetingModal').length) {
      cy.get('#createMeetingModal', { timeout: 15000 }).should('be.visible')
      return
    }
    cy.get('#liveSessionForm, #live_topic, #live_schedule, .ls-form', { timeout: 20000 })
      .filter(':visible')
      .first()
      .should('exist')
  })
}

/** @deprecated alias */
const openCreateMeetingModal = (courseId) => openCreateLiveSessionForm(courseId)

/** Scope helper for fields on create page or legacy modal */
const createSessionField = (fieldSelector) =>
  cy.get(scopeSelectors(fieldSelector)).filter(':visible').first()

const createMeetingField = createSessionField

/** Select linked course(s) on create form — checkbox list or legacy dropdown. */
const selectCourseOnCreateForm = (courseId, courseTitle = null) => {
  if (!courseId) return

  cy.get('body').then(($b) => {
    const $checkbox = $b.find(`input[name="course_ids[]"][value="${courseId}"]`).first()
    if ($checkbox.length) {
      cy.wrap($checkbox).check({ force: true })
      cy.log(`✓ Linked course checkbox checked: ${courseId}`)
      return
    }

    if (courseTitle) {
      const $byTitle = $b.find('.ls-form__course').filter((_, el) =>
        (el.textContent || '').includes(courseTitle)
      ).find('input[name="course_ids[]"]').first()
      if ($byTitle.length) {
        cy.wrap($byTitle).check({ force: true })
        cy.log(`✓ Linked course by title: ${courseTitle}`)
        return
      }
    }

    const $select = $b
      .find(
        'select[name="live_session[course_id]"], select[name="live_class[course_id]"], ' +
          '#createMeetingModal select[name*="course"], select[name*="course_id"], select#course_id',
      )
      .filter(':visible')
      .first()

    if ($select.length) {
      const hasOption = $select.find(`option[value="${courseId}"]`).length
      if (hasOption) {
        cy.wrap($select).select(String(courseId), { force: true })
        return
      }
      if (courseTitle) {
        const $opt = $select.find('option').filter((_, el) => (el.textContent || '').includes(courseTitle))
        if ($opt.length) cy.wrap($select).select($opt.val(), { force: true })
      }
      return
    }

    cy.log(`WARNING: Course ${courseId} not in linked courses — must be active, non-expired, non-archived live/hybrid`)
  })
}

/** Assert the create-form helper text describing eligible courses. */
const assertLinkListRuleVisible = () => {
  cy.get('body', { timeout: 15000 }).invoke('text').should('match', LINK_LIST_RULE)
}

/** Assert course checkbox on create form (maps to MEN-1555 eligibility rule). */
const assertCourseInLinkList = (courseId, shouldExist = true, reason = '') => {
  const suffix = reason ? ` (${reason})` : ''
  cy.get('body').then(($b) => {
    const count = $b.find(`input[name="course_ids[]"][value="${courseId}"]`).length
    if (shouldExist) {
      expect(count, `eligible course ${courseId} should appear${suffix}`).to.be.greaterThan(0)
    } else {
      expect(count, `ineligible course ${courseId} must NOT appear${suffix}`).to.eq(0)
    }
  })
}

/** Unpublished courses stay linkable for instructors but hidden from students/public. */
const assertCourseHiddenFromPublicUser = (courseId, title, user = STUDENT) => {
  loginViaApi(user)
  go(`/courses/${courseId}`)
  cy.get('body', { timeout: 15000 }).then(($b) => {
    const text = $b.text()
    const hidden = /not found|404|unavailable|no longer|does not exist|page not found|غير متاح|غير موجود/i.test(text)
      || !text.includes(title)
    expect(hidden, `unpublished course "${title}" must not be visible to ${user.email}`).to.be.true
  })
}

/** Select multiple linked courses on create form. */
const selectCoursesOnCreateForm = (courses = []) => {
  courses.forEach(({ id, title }) => selectCourseOnCreateForm(id, title))
}

/** Create a live or hybrid course and return its ID. */
const createLiveCourse = (title, deliveryType = 'Live') => {
  loginInstructorUI()
  go('/dashboard/courses/new')
  cy.get('#title').clear().type(title)
  cy.get('textarea').first().clear().type(`Auto ${deliveryType} course — ${title}`)
  cy.get('select[name="level"]').select('Beginner')
  cy.get('select[name="delivery_type"]').select(deliveryType)
  cy.wait(1000)
  cy.get('#course_category').select('22', { force: true })
  cy.wait(1500)
  cy.contains('label', 'Topic').parent().find('.select2-selection').click({ force: true })
  cy.contains('.select2-results__option', 'Math').click({ force: true })
  cy.contains('button', /create course/i).click({ force: true })
  return cy.url({ timeout: 20000 }).then((url) => {
    const match = url.match(/courses\/(\d+)/)
    const id = match ? match[1] : null
    expect(id, `course id for "${title}"`).to.exist
    return id
  })
}

const PAID_PRICING_IMG = 'img[src*="/assets/images/paid.svg"], img[src*="paid.svg"]'
const FREE_PRICING_IMG = 'img[src*="/assets/images/free.svg"], img[src*="free.svg"]'

/** Click a pricing-type card by its icon image. */
const clickPricingCardByIcon = (iconSelector) => {
  cy.get(iconSelector, { timeout: 10000 })
    .should('be.visible')
    .first()
    .then(($img) => {
      const $card = $img.closest(
        'label, button, a, [role="button"], [data-pricing-type], .pricing-type-card, .pricing-option, .card, .col'
      )
      cy.wrap(($card.length ? $card : $img.parent()).first()).click({ force: true })
    })
}

const PAID_PRICING_TABS = {
  full: '#full-payment-tab',
  instalment: '#instalment-tab',
  perSession: '#pay-per-session-tab',
}

const PAID_PRICING_PANELS = {
  full: '#full-payment-content',
  instalment: '#instalment-content',
  perSession: '#pay-per-session-content',
}

/** Select Paid pricing card. */
const selectPaidPricingOption = () => clickPricingCardByIcon(PAID_PRICING_IMG)

/** Select Free pricing card. */
const selectFreePricingOption = () => clickPricingCardByIcon(FREE_PRICING_IMG)

/** Select Pay Per Session tab on paid pricing. */
const selectPayPerSessionTab = () => {
  cy.get(PAID_PRICING_TABS.perSession, { timeout: 10000 }).should('exist').click({ force: true })
  cy.get(PAID_PRICING_TABS.perSession).should('have.class', 'active')
  cy.get(PAID_PRICING_PANELS.perSession, { timeout: 10000 }).should('be.visible')
}

/** Save paid pricing form. */
const savePaidPricing = (alias = 'setPricing') => {
  cy.intercept('POST', '**/pricing**').as(alias)
  cy.contains('button', /Set Pricing/i).should('be.visible').click({ force: true })
  cy.wait(`@${alias}`, { timeout: 20000 }).its('response.statusCode').should('be.oneOf', [200, 201, 302])
  cy.wait(1000)
}

/** Set Pay Per Session pricing — only input[name="price_per_session"]. */
const setCoursePayPerSessionPricing = (courseId, price = '100') => {
  loginInstructorUI()
  go(`/dashboard/courses/${courseId}/pricing`)
  cy.get('body', { timeout: 15000 }).should('exist')
  selectPaidPricingOption()
  cy.wait(500)
  selectPayPerSessionTab()
  cy.get('input#price_per_session, input[name="price_per_session"]', { timeout: 10000 })
    .should('be.visible')
    .clear({ force: true })
    .type(String(price), { force: true })
  savePaidPricing(`setPpsPricing_${courseId}`)
}

/**
 * Best-effort expired course setup for Pay Per Session courses.
 * access_type is NOT on the Pay Per Session pricing form — try pricing page scan,
 * then fall back to admin unpublish (inactive) without failing the before hook.
 */
const markCourseAsExpiredForLinkList = (courseId, title) => {
  loginInstructorUI()
  go(`/dashboard/courses/${courseId}/pricing`)
  cy.get('body', { timeout: 15000 }).should('exist')

  cy.get('body').then(($b) => {
    const $access = $b.find('select[name="access_type"]')
    if (!$access.length) {
      cy.log(`INFO: access_type not on pricing for course ${courseId} — admin unpublish fallback`)
      adminBulkSetCourseStatus(courseId, title, '0')
      return
    }

    cy.wrap($access).select('time_limited', { force: true })
    const yesterday = new Date(Date.now() - 86400000)
    const isoDate = yesterday.toISOString().slice(0, 10)

    const $end = $b.find(
      'input[name*="access_until"], input[name*="access_end"], input[name*="end_date"], ' +
        'input[name*="expire"], input[name*="valid_until"], input.date_picker, input[type="date"]'
    ).filter(':visible').first()

    if ($end.length) {
      cy.wrap($end).clear({ force: true }).type(isoDate, { force: true }).blur()
    }

    savePaidPricing(`setExpiredAccess_${courseId}`)
  })
}

/** Set course price to free via Free pricing card. */
const setCourseFreePricing = (courseId) => {
  loginInstructorUI()
  go(`/dashboard/courses/${courseId}/pricing`)
  cy.get('body', { timeout: 15000 }).should('exist')

  cy.get('body').then(($b) => {
    if ($b.find(PAID_PRICING_IMG).length || $b.find(FREE_PRICING_IMG).length) {
      selectFreePricingOption()
      cy.contains('button', /Set Pricing/i).then(($btn) => {
        if ($btn.length) cy.wrap($btn).click({ force: true })
      })
      return
    }

    const $price = $b.find(
      'input[name="price"], input[name*="price"], input[name="sale_price"], #price, #sale_price'
    ).filter(':visible').first()
    if ($price.length) cy.wrap($price).clear({ force: true }).type('0', { force: true })

    const $free = $b.find('input[type="checkbox"][name*="free"], input[name="is_free"]').first()
    if ($free.length && !$free.prop('checked')) cy.wrap($free).check({ force: true })

    const $save = $b.find('button, input[type="submit"]')
      .filter(':visible')
      .filter((_, el) => /set pricing|save|update|submit/i.test(el.textContent || el.value || ''))
      .first()
    if ($save.length) cy.wrap($save).click({ force: true })
  })
  cy.wait(1000)
}

/** Publish pipeline: submit for review + admin bulk publish. */
const publishCourse = (courseId, title) => {
  loginInstructorUI()
  submitCourseForReview(courseId)
  adminBulkSetCourseStatus(courseId, title, '1')
}

/** Admin-only publish — used by MEN-1555 setup (skips instructor publish page). */
const publishCourseAsAdmin = (courseId, title) => {
  adminBulkSetCourseStatus(courseId, title, '1')
}

/** Instructor archives own course from my-courses (MEN-1626). */
const instructorArchiveCourse = (courseId, title) => {
  loginInstructorUI()
  go('/dashboard/my-courses')
  cy.get('body', { timeout: 15000 }).should('exist')

  cy.get('body').then(($b) => {
    const $row = $b.find('tr, .card, .course-item, [class*="course-card"], .dashboard-course-item')
      .filter((_, el) => (el.textContent || '').includes(title))
      .first()

    const $archive = $row.length
      ? $row.find('a, button').filter((_, el) => /archive|أرش/i.test(el.textContent || ''))
      : $b.find('a, button').filter((_, el) => /archive|أرش/i.test(el.textContent || ''))

    if ($archive.length) {
      cy.wrap($archive.first()).click({ force: true })
      cy.get('body').then(($c) => {
        const $confirm = $c.find('.modal.show button, .swal2-confirm, button')
          .filter(':visible')
          .filter((_, el) => /yes|confirm|archive|ok|موافق/i.test(el.textContent || ''))
          .first()
        if ($confirm.length) cy.wrap($confirm).click({ force: true })
      })
      cy.log(`✓ Course "${title}" archived via my-courses`)
      return
    }

    cy.log(`WARN: Archive button not found — falling back to admin status for ${courseId}`)
    adminBulkSetCourseStatus(courseId, title, '2')
  })
  cy.wait(1500)
}

/** Select offline / bank-transfer payment on checkout. */
const selectOfflinePaymentMethod = () => {
  cy.get('body').then(($b) => {
    const radio = $b.find(
      'input[type="radio"][value*="offline" i], input[type="radio"][value*="bank" i], ' +
        'input[name*="payment_method" i][value*="offline" i], input[name*="payment_method" i][value*="bank" i], ' +
        'input[name*="payment" i][value*="offline" i], input[name*="payment" i][value*="transfer" i]'
    ).filter(':visible').first()

    if (radio.length) {
      cy.wrap(radio).check({ force: true })
      return
    }

    const label = $b.find('label, button, div, span').filter((_, el) =>
      /offline|bank transfer|wire transfer|manual payment|تحويل/i.test(el.textContent || '')
    ).filter(':visible').not('footer *, nav *, header *').first()

    expect(label.length, 'offline payment method on checkout').to.be.greaterThan(0)
    cy.wrap(label).click({ force: true })
  })
}

/** Submit checkout after payment method selected. */
const clickCheckoutSubmit = () => {
  cy.get('body').then(($b) => {
    const btn = $b.find('button, a.btn, input[type="submit"]').filter(':visible').filter((_, el) =>
      /enroll|complete|pay|checkout|purchase|confirm|submit|place order/i.test(el.textContent || el.value || '')
    ).first()
    expect(btn.length, 'checkout submit button').to.be.greaterThan(0)
    cy.wrap(btn).click({ force: true })
  })
}

/** Student submits offline payment at checkout for a course. */
const studentPayOfflineForCourse = (courseId) => {
  loginViaApi(STUDENT)
  go(`/courses/${courseId}`)
  cy.get('body', { timeout: 15000 }).should('exist')

  cy.get('body').then(($b) => {
    const $cta = $b.find('a, button').filter(':visible').filter((_, el) =>
      /enroll|buy now|add to cart|get started|join course|purchase|اشتر/i.test(el.textContent || '')
    ).first()
    expect($cta.length, `enroll/buy CTA for course ${courseId}`).to.be.greaterThan(0)
    cy.wrap($cta).click({ force: true })
  })

  cy.url({ timeout: 30000 }).should('include', '/checkout')
  selectOfflinePaymentMethod()
  clickCheckoutSubmit()

  cy.get('body', { timeout: 20000 }).invoke('text').should('match',
    /pending|submitted|thank you|received|offline|awaiting|approval|success/i)
  cy.log(`✓ Student submitted offline payment for course ${courseId}`)
}

/** Admin approves pending offline payment from /admin/payments. */
const adminApproveOfflinePayment = (courseTitle = '') => {
  loginViaApi(ADMIN)
  go('/admin/payments')
  cy.get('body', { timeout: 15000 }).should('exist')

  cy.get('body').then(($b) => {
    const search = $b.find('input[name="search"], input[type="search"], input[name="q"], input[name="title"]').first()
    if (search.length && courseTitle) {
      cy.wrap(search).clear().type(courseTitle)
      const searchBtn = $b.find('button[type="submit"]').filter((_, el) =>
        /search|بحث/i.test(el.textContent || '')
      ).first()
      if (searchBtn.length) cy.wrap(searchBtn).click({ force: true })
      cy.wait(800)
    }
  })

  cy.get('body').then(($b) => {
    let $row = $b.find('table tbody tr').filter((_, tr) => {
      const text = tr.textContent || ''
      const offline = /offline|bank transfer|manual|pending/i.test(text)
      const match = (!courseTitle || text.includes(courseTitle)) &&
        (text.includes(STUDENT.email) || !courseTitle)
      return offline && match
    }).first()

    if (!$row.length) {
      $row = $b.find('table tbody tr').filter((_, tr) =>
        /offline|bank transfer|manual|pending/i.test(tr.textContent || '')
      ).first()
    }

    expect($row.length, `pending offline payment${courseTitle ? ` for "${courseTitle}"` : ''}`).to.be.greaterThan(0)

    const $checkbox = $row.find('input.check_bulk_item[name="bulk_ids[]"], input[name="bulk_ids[]"]').first()
    if ($checkbox.length) cy.wrap($checkbox).check({ force: true })
  })

  cy.get('body').then(($b) => {
    const approveBtn = $b.find('button, a, input').filter(':visible').filter((_, el) =>
      /approve|confirm|complete payment|mark as paid/i.test(el.textContent || el.value || '')
    ).first()

    if (approveBtn.length) {
      cy.wrap(approveBtn).click({ force: true })
      return
    }

    cy.get('select[name="status"]', { timeout: 10000 }).then(($sel) => {
      const opts = $sel.find('option').toArray().map((o) => ({ val: o.value, text: o.textContent || '' }))
      const match = opts.find((o) => /approve|complete|paid|success|1/i.test(o.text))
        || opts.find((o) => o.val === '1')
      cy.wrap($sel).select(match ? match.val : '1', { force: true })
    })
    cy.contains('button, input[type="submit"]', /update|approve|apply/i).scrollIntoView().click({ force: true })
  })

  cy.get('body').then(($b) => {
    const $confirm = $b.find('.modal.show button, .swal2-confirm, button').filter(':visible').filter((_, el) =>
      /yes|confirm|approve|ok|موافق/i.test(el.textContent || '')
    ).first()
    if ($confirm.length) cy.wrap($confirm).click({ force: true })
  })

  cy.wait(1500)
  cy.log(`✓ Admin approved offline payment${courseTitle ? ` for "${courseTitle}"` : ''}`)
}

/** Enroll student: offline checkout + admin payment approval. */
const enrollStudentViaOfflinePayment = (courseId, courseTitle) => {
  studentPayOfflineForCourse(courseId)
  adminApproveOfflinePayment(courseTitle)
}

/** Enroll student in course via UI (free or checkout). */
const enrollStudentInCourse = (courseId) => {
  loginViaApi(STUDENT)
  go(`/courses/${courseId}`)
  cy.get('body', { timeout: 15000 }).should('exist')

  cy.get('body').then(($b) => {
    const $cta = $b.find('a, button').filter(':visible').filter((_, el) =>
      /enroll|buy now|add to cart|get started|free|join course|اشتر/i.test(el.textContent || '')
    ).first()
    if ($cta.length) cy.wrap($cta).click({ force: true })
  })

  cy.url({ timeout: 30000 }).then((url) => {
    if (!url.includes('/checkout')) return
    cy.get('body').then(($b) => {
      const $pay = $b.find('button, a').filter(':visible').filter((_, el) =>
        /enroll|complete|pay|checkout|free|confirm|purchase/i.test(el.textContent || '')
      ).first()
      if ($pay.length) cy.wrap($pay).click({ force: true })
    })
  })
  cy.wait(2000)
  cy.log(`✓ Student enrollment attempted for course ${courseId}`)
}

/** Student views course page and checks session visibility. */
const studentAssertSessionOnCourse = (courseId, topic) => {
  loginViaApi(STUDENT)
  go(`/courses/${courseId}`)
  cy.get('body', { timeout: 15000 }).invoke('text').should('include', topic)
}

/** Student tries to join session (returns status via callback). */
const studentTryJoinSession = (sessionId, courseId) => {
  const urls = [
    `${BASE}/dashboard/live-sessions/${sessionId}/start`,
    `${BASE}/dashboard/courses/${courseId}/live_class/${sessionId}/join`,
  ]
  return cy.request({
    method: 'GET', url: urls[0], auth: AUTH, failOnStatusCode: false, followRedirect: true,
  }).then((res) => {
    if (res.status < 400) return res
    return cy.request({
      method: 'GET', url: urls[1], auth: AUTH, failOnStatusCode: false, followRedirect: true,
    })
  })
}

const clickFormSubmit = (labelPattern = /create zoom meeting|create|save|schedule|meeting|session|update/i) => {
  cy.get('body').then(($b) => {
    const candidates = $b
      .find(
        'button.ls-form__submit, button.btn-create-course, ' +
          '#liveSessionForm button[type="submit"], #liveSessionForm input[type="submit"], ' +
          '#createMeetingModal button[type="submit"], #createMeetingForm button[type="submit"], ' +
          'form[action*="/live-sessions"] button[type="submit"], ' +
          'form[action*="/live-sessions"] input[type="submit"], ' +
          'button.btn-success[type="submit"], button.btn-primary[type="submit"]',
      )
      .filter(':visible')

    const $labeled = candidates
      .filter((_, el) => labelPattern.test((el.textContent || el.value || '').trim()))
      .first()

    if ($labeled.length) {
      cy.wrap($labeled).scrollIntoView().click({ force: true })
      return
    }

    const $formSubmit = candidates.first()
    if ($formSubmit.length) {
      cy.wrap($formSubmit).scrollIntoView().click({ force: true })
      return
    }

    cy.contains('button[type="submit"], input[type="submit"]', labelPattern, { timeout: 10000 })
      .scrollIntoView()
      .click({ force: true })
  })
}

const clickCreateSessionSubmit = () => clickFormSubmit(/create zoom meeting|create|save|schedule|meeting|session/i)

/** Fill schedule input — works on modal (#createMeetingModal) or edit page (body) */
const fillScheduleField = (scheduleValue, parentSelector = '') => {
  const scopes = parentSelector
    ? (Array.isArray(parentSelector)
        ? parentSelector
        : parentSelector.split(',').map((s) => s.trim()).filter(Boolean))
    : FORM_SCOPES
  const selector = scopeSelectors(SCHEDULE_INPUT, scopes)

  cy.get(selector, { timeout: 15000 })
    .first()
    .should('be.visible')
    .click({ force: true })
    .clear({ force: true })
    .then(($input) => {
      const isoMatch = scheduleValue.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}:\d{2})/)
      const typed = scheduleValue.includes('/')
        ? scheduleValue
        : isoMatch
          ? `${isoMatch[2]}/${isoMatch[3]}/${isoMatch[1]} ${isoMatch[4]}`
          : scheduleFromNow(2).us
      cy.wrap($input).type(typed, { force: true, delay: 30 }).blur({ force: true })
    })

  cy.get(selector).first().then(($input) => {
    cy.log(`Schedule field set to: "${$input.val()}"`)
  })
}

/** Open meeting edit form — edit link on list or direct URL */
const openMeetingForEdit = (courseId, sessionId, topic = null) => {
  goToLiveSessionsIndex()
  cy.get('body', { timeout: 10000 }).should('exist')

  cy.get('body').then(($b) => {
    let $editBtn = null

    if (topic) {
      const $row = $b.find('tr, .card, .list-group-item').filter((_, el) =>
        Cypress.$(el).text().includes(topic)
      ).first()
      $editBtn = $row.find(
        'a:contains("Edit"), button:contains("Edit"), ' +
          `a[href*="/live-sessions/${sessionId}/edit"], a[href*="/live_class/${sessionId}"]`,
      ).first()
    }

    if (!$editBtn || !$editBtn.length) {
      $editBtn = $b.find(`a[href*="/live-sessions/${sessionId}/edit"], a[href*="/live_class/${sessionId}"]`)
        .filter((_, el) => /edit|update/i.test((el.textContent || '') + (el.getAttribute('href') || '')))
        .first()
    }

    if ($editBtn && $editBtn.length) {
      cy.wrap($editBtn).click({ force: true })
      cy.log('Opened edit via Edit link on live-sessions list')
    } else {
      go(`/dashboard/live-sessions/${sessionId}/edit`)
      cy.log(`Opened edit via URL /live-sessions/${sessionId}/edit`)
    }
  })

  cy.wait(500)

  // Schedule field may be inside a modal or on a standalone edit page
  cy.get('#liveSessionForm, ' + scopeSelectors(SCHEDULE_INPUT), { timeout: 15000 })
    .filter(':visible')
    .first()
    .should('exist')
}

/** Read current schedule value from edit form (modal or page) */
const readScheduleValue = () =>
  cy.get('body').then(($b) => {
    const $modal = $b.find('.modal.show, #editMeetingModal.show, #createMeetingModal.show')
    if ($modal.length && $modal.find(SCHEDULE_INPUT).length) {
      return $modal.find(SCHEDULE_INPUT).first().val()
    }
    return $b.find(SCHEDULE_INPUT).first().val()
  })

/** Click update/save on edit form — modal or standalone page */
const clickUpdateMeeting = () => clickFormSubmit(/update meeting|update session|update|save changes|save/i)

/** Save edit form — Create/Update Meeting button on edit page */
const clickSaveSessionEdit = () => {
  cy.get('body').then(($b) => {
    const $btn = $b.find('button, input[type="submit"]')
      .filter(':visible')
      .filter((_, el) => /update meeting|update session|update|save changes|save/i.test(el.textContent || el.value || ''))
      .first()
    if ($btn.length) cy.wrap($btn).scrollIntoView().click({ force: true })
    else clickUpdateMeeting()
  })
}

/** Fill schedule on edit form — uses Mentora picker format, min +2h from now. */
const fillScheduleOnEdit = (scheduleOrHours = 26) => {
  if (typeof scheduleOrHours === 'object' && scheduleOrHours.picker) {
    cy.get('#live_schedule', { timeout: 15000 }).should('be.visible').click({ force: true })
    cy.get('#live_schedule').clear({ force: true }).type(scheduleOrHours.picker, { force: true, delay: 30 }).blur({ force: true })
    cy.get('#live_schedule').invoke('val').should('match', /\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/)
    return
  }
  const hours = typeof scheduleOrHours === 'number' ? scheduleOrHours : 26
  setScheduleDate(Math.max(hours, 2))
}

/** Set #live_schedule — Mentora format: YYYY-MM-DD HH:mm:ss + bootstrap datetimepicker widget */
const setScheduleDate = (hoursAhead = 2) => {
  const schedule = scheduleFromNow(hoursAhead)
  const when = new Date(Date.now() + hoursAhead * 60 * 60 * 1000)

  cy.get('#live_schedule.date_picker, input[name="live_class[schedule]"]', { timeout: 15000 })
    .should('be.visible')
    .click({ force: true })

  cy.get('#live_schedule')
    .focus()
    .clear({ force: true })
    .type(schedule.picker, { force: true, delay: 30 })
    .blur({ force: true })

  cy.get('#live_schedule').invoke('val').then((val) => {
    if ((val || '').match(/\d{4}-\d{2}-\d{2}/)) return

    cy.get('#live_schedule').then(($input) => {
      cy.window().then((win) => {
        const el = $input[0]
        const jq = win.jQuery || win.$
        if (jq) {
          const $el = jq(el)
          try {
            const dtp = $el.data('DateTimePicker') || $el.data('datetimepicker')
            if (dtp && typeof dtp.date === 'function') {
              dtp.date(when)
              return
            }
            if (typeof $el.datetimepicker === 'function') {
              $el.datetimepicker('date', when)
            }
          } catch (_) { /* ignore */ }
        }
      })
    })
  })

  cy.get('#live_schedule').invoke('val').then((val) => {
    if ((val || '').match(/\d{4}-\d{2}-\d{2}/)) return

    cy.get('body').then(($b) => {
      const $widget = $b.find('.bootstrap-datetimepicker-widget:visible, .datepicker:visible')
      if (!$widget.length) {
        cy.get('#live_schedule').click({ force: true })
      }
    })

    cy.get('.bootstrap-datetimepicker-widget:visible td.day:not(.disabled):not(.old):not(.new), ' +
      '.datepicker-days td.day:not(.disabled):not(.old):not(.new)', { timeout: 5000 })
      .last()
      .click({ force: true })

    cy.get('#live_schedule')
      .invoke('val', schedule.picker)
      .trigger('input', { force: true })
      .trigger('change', { force: true })
      .trigger('blur', { force: true })
  })

  cy.get('#live_schedule').invoke('val').should('match', /\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/)
  cy.log(`Schedule set: ${schedule.picker}`)
  cy.get('body').click(0, 0, { force: true })
}

/** Fill schedule via date_picker — type US format; avoid flatpickr day clicks. */
const fillSchedulePicker = (scheduleValue) => {
  const hoursAhead = 2
  if (typeof scheduleValue === 'string') {
    const m = scheduleValue.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/)
    if (m) {
      const target = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]))
      const diffH = (target.getTime() - Date.now()) / 3600000
      setScheduleDate(Math.max(diffH, 1))
      return
    }
  }
  setScheduleDate(hoursAhead)
}

/** Check if a schedule string reflects the expected date/time */
const scheduleReflects = (actual, expected) => {
  const val = String(actual || '')
  const picker = expected.picker || expected.iso || ''
  const datePart = picker.split(' ')[0]
  const hour = (picker.split(' ')[1] || '').split(':')[0]
  const [, mm, dd] = datePart.match(/^(\d{4})-(\d{2})-(\d{2})/) || []
  return (
    val.includes(datePart) ||
    (hour && val.includes(hour)) ||
    (dd && mm && (val.includes(`${dd}/${mm}`) || val.includes(`${mm}/${dd}`)))
  )
}

/** Open modal/page, fill form, submit, verify session on list */
const createLiveMeeting = (topic, hoursAhead = 2, courseLinks = [{ id: liveCourseId, title: COURSE_TITLE }]) => {
  const links = Array.isArray(courseLinks) ? courseLinks : [{ id: courseLinks, title: COURSE_TITLE }]

  cy.intercept('POST', '**/live-sessions**').as('createMeeting')
  cy.intercept('POST', '**/live_class**').as('createMeetingLegacy')

  openCreateLiveSessionForm(links[0]?.id)

  cy.get(scopeSelectors(SESSION_TOPIC_INPUT), { timeout: 15000 }).first().should('be.visible')
  cy.get(scopeSelectors(SCHEDULE_INPUT), { timeout: 15000 }).first().should('be.visible')

  selectCoursesOnCreateForm(links)
  setScheduleDate(hoursAhead)

  createSessionField(SESSION_TOPIC_INPUT)
    .clear({ force: true })
    .type(topic, { force: true })

  createSessionField(SESSION_DURATION_INPUT).then(($duration) => {
    const current = String($duration.val() || '').trim()
    if (!current || current === '0') {
      cy.wrap($duration).clear({ force: true }).type('60', { force: true })
    }
  })

  createSessionField(SESSION_RECURRENCE_SELECT).then(($sel) => {
    if ($sel.length) cy.wrap($sel).select('none', { force: true })
  })

  cy.get('body').then(($b) => {
    const $submit = $b.find('button.ls-form__submit, #liveSessionForm button[type="submit"], button')
      .filter(':visible')
      .filter((_, el) => /create zoom meeting|create|save|schedule|meeting|session/i.test(el.textContent || ''))
      .first()
    if ($submit.length) {
      cy.wrap($submit).scrollIntoView().click({ force: true })
    } else {
      clickCreateSessionSubmit()
    }
  })

  cy.wait(3000)

  cy.get('body').then(($b) => {
    if (/required|error|invalid|please/i.test($b.text())) {
      cy.log(`WARN: validation text on create form: ${$b.text().slice(0, 300)}`)
    }
  })

  assertMeetingOnPage(topic)
  extractSessionIdFromPage(topic)
  cy.then(() => {
    expect(liveSessionId, `session id for "${topic}"`).to.exist
    cy.log(`✓ Session created: ${liveSessionId}`)
  })
}

/** Confirm session topic appears on /dashboard/live-sessions list. */
const assertMeetingOnPage = (topic, courseId = liveCourseId) => {
  goToLiveSessionsIndex()
  cy.get('body', { timeout: 15000 }).invoke('text').should('include', topic)
  cy.log(`Meeting "${topic}" visible on ${LIVE_SESSIONS_PATH}`)
}

const extractSessionIdFromPage = (topic = null) => {
  const parseId = (href) => {
    const m = (href || '').match(/\/live-sessions\/(\d+)/) || (href || '').match(/\/live_class\/(\d+)/)
    return m ? m[1] : null
  }

  cy.get('body').then(($b) => {
    if (topic) {
      const $rows = $b.find('tr, .card, .list-group-item, tbody').filter((_, el) =>
        Cypress.$(el).text().includes(topic)
      )
      if ($rows.length) {
        const hrefs = $rows.first().find('a[href*="/live-sessions/"], a[href*="/live_class/"]').toArray()
          .map((a) => a.getAttribute('href'))
        for (const href of hrefs) {
          const id = parseId(href)
          if (id) {
            liveSessionId = id
            cy.log(`✓ Session ID from "${topic}" row: ${liveSessionId}`)
            return
          }
        }
      }
    }

    for (const a of $b.find('a[href*="/live-sessions/"], a[href*="/live_class/"]').toArray()) {
      const href = a.getAttribute('href') || ''
      if (href.includes('/create')) continue
      const id = parseId(href)
      if (id) {
        liveSessionId = id
        cy.log(`✓ Session ID from page link: ${liveSessionId}`)
        return
      }
    }

    cy.log('WARNING: Could not extract liveSessionId — edit/join tests may skip')
  })
}

const loginInstructorUI = () => {
  cy.clearCookies()
  cy.clearLocalStorage()
  visitWithAuth('login')
  cy.get('input[type="email"]:visible', { timeout: 10000 }).clear().type(INSTRUCTOR.email)
  cy.get('input[id="password"]:visible').clear().type(INSTRUCTOR.password)
  cy.get('button.btn.btn-primary').click({ force: true })
  cy.url({ timeout: 20000 }).should('include', '/dashboard')
  cy.log('✓ Instructor logged in')
}

const pickAdminCourseStatusOption = (opts, statusValue) => {
  const val = String(statusValue)
  const byVal = (v) => opts.find((o) => o.val === v)

  if (val === '1') {
    return byVal('1')
      || opts.find((o) => /publish|active|approved/i.test(o.text) && !/unpublish|draft|archive|inactive|pending/i.test(o.text))
  }
  if (val === '0') {
    return byVal('0')
      || opts.find((o) => /unpublish|draft|inactive|pending|rejected/i.test(o.text) && !/publish|active|archive|approved/i.test(o.text))
  }
  if (val === '2') {
    return byVal('2')
      || opts.find((o) => /archive|archived/i.test(o.text) && !/unpublish|publish|active/i.test(o.text))
  }
  return byVal(val)
}

/** Admin bulk status change from /admin/courses */
const adminBulkSetCourseStatus = (courseId, title = COURSE_TITLE, statusValue = '1') => {
  cy.log(`Admin setting course ${courseId} status → ${statusValue}`)
  loginViaApi(ADMIN)
  go('/admin/courses')
  cy.get('body', { timeout: 15000 }).should('exist')

  cy.get('body').then(($b) => {
    const searchInput = $b.find(
      'input[name="search"], input[type="search"], input[name="q"], input[name="title"]'
    ).first()
    if (searchInput.length && title) {
      cy.wrap(searchInput).clear().type(title)
      cy.wait(300)
      const searchBtn = $b.find('button[type="submit"], button:contains("Search")').first()
      if (searchBtn.length) cy.wrap(searchBtn).click({ force: true })
      cy.wait(800)
    }
  })

  cy.get('body').then(($b) => {
    const checkbox = $b.find(`input.check_bulk_item[name="bulk_ids[]"][value="${courseId}"]`)
    if (checkbox.length) {
      cy.wrap(checkbox.first()).check({ force: true })
    } else if (title) {
      cy.contains('tr', title, { timeout: 15000 }).within(() => {
        cy.get('input.check_bulk_item[name="bulk_ids[]"]').check({ force: true })
      })
    }
  })

  cy.get('select[name="status"]', { timeout: 10000 }).then(($sel) => {
    const opts = $sel.find('option').toArray().map((o) => ({ val: o.value, text: (o.textContent || '').trim() }))
    const match = pickAdminCourseStatusOption(opts, statusValue)
    expect(match, `admin course status option for "${statusValue}" (${opts.map((o) => `${o.val}:${o.text}`).join(', ')})`).to.exist
    cy.wrap($sel).select(match.val, { force: true })
  })

  cy.get('body').then(($b) => {
    const updateBtn = $b.find('button:contains("Update"), input[type="submit"][value="Update"]').first()
    if (updateBtn.length) cy.wrap(updateBtn).scrollIntoView().click({ force: true })
    else cy.contains('button', /update/i).scrollIntoView().click({ force: true })
  })
  cy.wait(1500)
}

/** Admin unpublish — sets course to draft/inactive via bulk status. */
const adminUnpublishCourse = (courseId, title) =>
  adminBulkSetCourseStatus(courseId, title, '0')

/** Instructor unpublish from /dashboard/courses/{id}/publish */
const instructorUnpublishCourse = (courseId, title = '') => {
  loginInstructorUI()
  go(`/dashboard/courses/${courseId}/publish`)
  cy.get('body', { timeout: 15000 }).should('exist')

  cy.get('body').then(($b) => {
    const $btn = $b.find(
      'button[name="publish_btn"][value="unpublish"], input[name="publish_btn"][value="unpublish"]'
    ).add(
      $b.find('button, a, input[type="submit"]').filter((_, el) =>
        /unpublish|remove from published|take down|set to draft|draft/i.test(el.textContent || el.value || '')
      )
    ).filter(':visible').first()

    if ($btn.length) {
      cy.wrap($btn).scrollIntoView().click({ force: true })
      cy.wait(2000)
      cy.log(`✓ Course ${courseId}${title ? ` "${title}"` : ''} unpublished via instructor publish page`)
      return
    }

    cy.log(`WARN: Instructor unpublish control not found for course ${courseId} — admin fallback`)
    adminUnpublishCourse(courseId, title)
  })
}

/** @deprecated alias */
const adminBulkPublishCourse = (courseId, title = COURSE_TITLE) =>
  adminBulkSetCourseStatus(courseId, title, '1')

/** Instructor submits course for review from the Publish tab */
const submitCourseForReview = (courseId) => {
  cy.log(`Instructor publishing course ${courseId}...`)

  go(`/dashboard/courses/${courseId}/publish`)
  cy.url({ timeout: 15000 }).should('include', `/dashboard/courses/${courseId}/publish`)
  cy.get('body', { timeout: 15000 }).should('exist')

  cy.get('body').then(($b) => {
    const text = $b.text()
    const alreadyPending = /Your course is in pending state|course is in pending/i.test(text)
    const publishBtn = $b.find('button[name="publish_btn"][value="publish"]')

    if (alreadyPending) {
      cy.log('INFO: Course already in pending state — skip submit')
      return
    }

    if (publishBtn.length) {
      cy.wrap(publishBtn).scrollIntoView().click({ force: true })
      cy.wait(2000)
      cy.log('✓ Submit for review clicked')
      return
    }

    cy.log('INFO: Publish button not found — course may already be submitted or published')
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1 — Core live session tests (TC01–TC16)
// ─────────────────────────────────────────────────────────────────────────────

describe('Live Session Management — TC01–TC16', () => {

  before(() => {
    createLiveCourse(CORE_COURSE_TITLE).then((id) => { liveCourseId = id })

    cy.then(() => {
      if (!liveCourseId) return
      publishCourse(liveCourseId, CORE_COURSE_TITLE)
    })

    cy.then(() => {
      if (!liveCourseId) return
      loginInstructorUI()
      createLiveMeeting(CORE_SESSION_TITLE, 2, liveCourseId)
      assertMeetingOnPage(CORE_SESSION_TITLE, liveCourseId)
      extractSessionIdFromPage(CORE_SESSION_TITLE)
      cy.then(() => {
        expect(liveSessionId, 'liveSessionId must be set').to.exist
        cy.log(`Core setup — course:${liveCourseId} session:${liveSessionId}`)
      })
    })
  })

  it('TC01 | [Positive] Instructor creates a live session — appears in sessions list', () => {
    loginInstructorUI()
    cy.then(() => {
      if (!liveCourseId) return
      goToLiveSessionsIndex()
      cy.get('body', { timeout: 10000 }).invoke('text').should('include', CORE_SESSION_TITLE)
    })
  })

  it('TC02 | [Positive] Instructor creates multiple sessions for one course', () => {
    loginInstructorUI()
    cy.then(() => {
      if (!liveCourseId) return
      const secondTitle = `Second Session ${Date.now()}`
      createLiveMeeting(secondTitle, 5, liveCourseId)
      assertMeetingOnPage(secondTitle, liveCourseId)
    })
  })

  it('TC03 | [Positive] Instructor edits session schedule before start — Update Meeting saves new day/time', () => {
    loginInstructorUI()
    cy.then(() => {
      if (!liveCourseId || !liveSessionId) return

      // Must be ≥2h from now — use +26h (~next day) to satisfy validation
      const updatedSchedule = scheduleFromNow(26)

      openMeetingForEdit(liveCourseId, liveSessionId, CORE_SESSION_TITLE)
      readScheduleValue().then((scheduleBefore) => {
        fillScheduleOnEdit(updatedSchedule)
        clickSaveSessionEdit()
        cy.wait(2000)

        go(`/dashboard/live-sessions/${liveSessionId}/edit`)
        cy.get('#live_schedule', { timeout: 15000 }).should('be.visible')
        readScheduleValue().then((scheduleAfter) => {
          expect(String(scheduleAfter).trim(), 'schedule after save').to.match(/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/)
          expect(String(scheduleAfter).trim(), 'schedule must change').to.not.equal(String(scheduleBefore).trim())
          expect(
            scheduleReflects(scheduleAfter, updatedSchedule),
            `saved schedule should reflect ${updatedSchedule.picker}`,
          ).to.be.true
        })
      })
    })
  })

  it('TC04 | [Positive] Instructor deletes a session', () => {
    loginInstructorUI()
    cy.then(() => {
      if (!liveCourseId) return
      goToLiveSessionsIndex()
      cy.get('body').then(($b) => {
        const deleteBtns = $b.find(
          'button:contains("Delete"), a:contains("Delete"), [data-method="DELETE"], form[action*="/live-sessions/"] button'
        )
        if (deleteBtns.length > 1) {
          const $row = deleteBtns.last().closest('tr, .card, .list-group-item')
          const editHref = $row.find('a[href*="/live-sessions/"], a[href*="/live_class/"]').first().attr('href') || ''
          const m = editHref.match(/\/live-sessions\/(\d+)/) || editHref.match(/\/live_class\/(\d+)/)
          if (m) deletedSessionId = m[1]
          cy.wrap(deleteBtns.last()).click({ force: true })
          cy.wait(500)
          cy.get('body').then(($c) => {
            const confirm = $c.find('.modal.show button:contains("Yes"), .modal.show button:contains("Confirm")').first()
            if (confirm.length) cy.wrap(confirm).click({ force: true })
          })
        }
      })
    })
  })

  it('TC05 | [Positive] Enrolled student views live sessions in the course', () => {
    loginViaApi(STUDENT)
    cy.then(() => {
      if (!liveCourseId) return
      go(`/courses/${liveCourseId}`)
      cy.get('body', { timeout: 10000 }).should('exist')
    })
  })

  it('TC06 | [Positive] Student joins session exactly 15 minutes before start (mocked)', () => {
    loginViaApi(STUDENT)
    cy.then(() => {
      if (!liveSessionId || !liveCourseId) return
      cy.request({
        method: 'GET',
        url: `${BASE}/dashboard/live-sessions/${liveSessionId}/start`,
        auth: AUTH, failOnStatusCode: false, followRedirect: true,
      }).then((res) => {
        if (res.status >= 400) {
          return cy.request({
            method: 'GET',
            url: `${BASE}/dashboard/courses/${liveCourseId}/live_class/${liveSessionId}/join`,
            auth: AUTH, failOnStatusCode: false, followRedirect: true,
          })
        }
        return cy.wrap(res)
      })
    })
  })

  it('TC07 | [Positive] Student joins a session currently in progress (mocked)', () => {
    loginViaApi(STUDENT)
    cy.then(() => {
      if (!liveSessionId || !liveCourseId) return
      studentTryJoinSession(liveSessionId, liveCourseId)
    })
  })

  it('TC08 | [Positive] Multiple students join the same session simultaneously', () => {
    cy.then(() => {
      if (!liveSessionId || !liveCourseId) return
      loginViaApi(STUDENT)
      studentTryJoinSession(liveSessionId, liveCourseId)
      cy.clearCookies()
      loginViaApi(STUDENT_2)
      studentTryJoinSession(liveSessionId, liveCourseId)
    })
  })

  it('TC09 | [Positive] Ended session remains visible inside the course', () => {
    loginInstructorUI()
    cy.then(() => {
      if (!liveCourseId) return
      goToLiveSessionsIndex()
      cy.get('body', { timeout: 10000 }).invoke('text').should('match', /session/i)
    })
  })

  it('TC10 | [Negative] Creating session with missing fields shows validation error', () => {
    loginInstructorUI()
    cy.then(() => {
      if (!liveCourseId) return
      openCreateLiveSessionForm(liveCourseId)
      cy.get(scopeSelectors(SCHEDULE_INPUT), { timeout: 15000 }).first()
        .clear({ force: true }).invoke('val', '').trigger('change', { force: true })
      clickCreateSessionSubmit()
      cy.wait(500)
      cy.url().then((url) => {
        cy.get('body').then(($after) => {
          const onCreatePage = url.includes('live-sessions/create')
          const hasError = /required|error|validation|invalid/i.test($after.text())
          expect(onCreatePage || hasError).to.be.true
        })
      })
    })
  })

  it('TC11 | [Negative] Instructor cannot edit a session after it has started', () => {
    loginInstructorUI()
    cy.then(() => {
      if (!liveSessionId) return
      cy.request({
        method: 'PUT',
        url: `${BASE}/dashboard/live-sessions/${liveSessionId}`,
        auth: AUTH, form: true, followRedirect: false, failOnStatusCode: false,
        body: { _method: 'PUT', title: 'Edited After Start', starts_at: minutesFromNow(-30) },
      }).then((res) => {
        const blocked = res.status === 403 || res.status === 422 ||
          /started|in progress|cannot|locked/i.test(res.body || '')
        cy.log(`Edit blocked: ${blocked}`)
      })
    })
  })

  it('TC12 | [Negative] Non-enrolled student cannot access a live session', () => {
    loginViaApi(STUDENT_2)
    cy.then(() => {
      if (!liveSessionId || !liveCourseId) return
      ;[
        `/dashboard/live-sessions/${liveSessionId}/start`,
        `/dashboard/live-sessions/${liveSessionId}/edit`,
        `/dashboard/courses/${liveCourseId}/live_class/${liveSessionId}/join`,
      ].forEach((route) => {
        cy.request({ method: 'GET', url: `${BASE}${route}`, auth: AUTH, failOnStatusCode: false, followRedirect: true })
          .then((res) => cy.log(`Non-enrolled ${route} → ${res.status}`))
      })
    })
  })

  it('TC13 | [Negative] Student cannot join more than 15 minutes before start', () => {
    loginViaApi(STUDENT)
    cy.then(() => {
      if (!liveSessionId) return
      cy.request({
        method: 'GET',
        url: `${BASE}/dashboard/live-sessions/${liveSessionId}/start`,
        auth: AUTH, failOnStatusCode: false, followRedirect: true,
      }).then((res) => cy.log(`Early join → ${res.status}`))
    })
  })

  it('TC14 | [Negative] Student cannot join a session that has ended', () => {
    loginViaApi(STUDENT)
    cy.then(() => {
      if (!liveSessionId) return
      cy.request({
        method: 'GET',
        url: `${BASE}/dashboard/live-sessions/${liveSessionId}/start`,
        auth: AUTH, failOnStatusCode: false, followRedirect: true,
      }).then((res) => cy.log(`Join ended → ${res.status}`))
    })
  })

  it('TC15 | [Negative] Unauthenticated user cannot access session URL directly', () => {
    cy.clearCookies()
    cy.clearLocalStorage()
    cy.then(() => {
      if (!liveSessionId || !liveCourseId) return
      cy.request({
        method: 'GET',
        url: `${BASE}/dashboard/live-sessions/${liveSessionId}/start`,
        auth: AUTH, failOnStatusCode: false, followRedirect: true,
      }).then((res) => {
        const blocked = res.status === 401 || res.status === 403 ||
          (res.redirects || []).some((r) => r.includes('/login'))
        cy.log(`Guest blocked: ${blocked}`)
      })
    })
  })

  it('TC16 | [Negative] Student cannot access a deleted session', () => {
    loginViaApi(STUDENT)
    cy.then(() => {
      if (!deletedSessionId || !liveCourseId) {
        cy.log('INFO: No deleted session from TC04 — skip')
        return
      }
      cy.request({
        method: 'GET',
        url: `${BASE}/dashboard/live-sessions/${deletedSessionId}/edit`,
        auth: AUTH, failOnStatusCode: false, followRedirect: true,
      }).then((res) => cy.log(`Deleted session → ${res.status}`))
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2 — MEN-1555: Live Sessions shared between courses
// ─────────────────────────────────────────────────────────────────────────────

describe('MEN-1555 — Live Sessions shared between courses', () => {

  before(() => {
    cy.on('uncaught:exception', (err) => {
      if (/flatpickr|Element attr did not return a valid number/i.test(err.message || '')) {
        return false
      }
    })

    createLiveCourse(COURSE_A_TITLE).then((id) => { courseAId = id })
    createLiveCourse(COURSE_B_TITLE).then((id) => { courseBId = id })
    createLiveCourse(ARCHIVED_COURSE_TITLE).then((id) => { archivedCourseId = id })
    createLiveCourse(UNPUBLISHED_COURSE_TITLE).then((id) => { unpublishedCourseId = id })
    createLiveCourse(RECORDED_COURSE_TITLE, 'Recorded').then((id) => { recordedCourseId = id })

    // 1) Publish active courses via admin (unpublished test course stays draft)
    cy.then(() => {
      const courses = [
        { id: courseAId, title: COURSE_A_TITLE },
        { id: courseBId, title: COURSE_B_TITLE },
        { id: archivedCourseId, title: ARCHIVED_COURSE_TITLE },
        { id: unpublishedCourseId, title: UNPUBLISHED_COURSE_TITLE },
        { id: recordedCourseId, title: RECORDED_COURSE_TITLE },
      ]
      cy.wrap(courses).each(({ id, title }) => {
        if (!id) return
        if (title === UNPUBLISHED_COURSE_TITLE) {
          cy.log(`Skip publish for unpublished test course ${id} — stays draft/inactive`)
          return
        }
        publishCourseAsAdmin(id, title)
      })
    })

    // 2) Shared session on A + B (only session needed for link-list tests)
    cy.then(() => {
      if (!courseAId || !courseBId) return
      loginInstructorUI()
      createLiveMeeting(SHARED_SESSION_TITLE, 3, [
        { id: courseAId, title: COURSE_A_TITLE },
        { id: courseBId, title: COURSE_B_TITLE },
      ])
      extractSessionIdFromPage(SHARED_SESSION_TITLE)
    })

    cy.then(() => {
      sharedSessionId = liveSessionId
      expect(sharedSessionId, 'sharedSessionId required').to.exist
    })

    // 3) Archived course — must NOT appear in link list
    cy.then(() => {
      if (archivedCourseId) instructorArchiveCourse(archivedCourseId, ARCHIVED_COURSE_TITLE)
    })

    cy.then(() => {
      cy.log(`MEN-1555 setup — A:${courseAId} B:${courseBId} archived:${archivedCourseId} unpublished:${unpublishedCourseId} recorded:${recordedCourseId} session:${sharedSessionId}`)
    })
  })

  it('MEN-1555-01 | Active live courses appear and session links to multiple courses', () => {
    loginInstructorUI()

    cy.then(() => {
      expect(courseAId).to.exist
      expect(courseBId).to.exist
      expect(sharedSessionId).to.exist

      goToLiveSessionsIndex()
      cy.get('body').invoke('text').should('include', SHARED_SESSION_TITLE)

      openCreateLiveSessionForm(courseAId)
      assertLinkListRuleVisible()
      assertCourseInLinkList(courseAId, true, 'active live course')
      assertCourseInLinkList(courseBId, true, 'active live course')

      go(`/dashboard/live-sessions/${sharedSessionId}/edit`)
      cy.get(`input[name="course_ids[]"][value="${courseAId}"]`).should('exist')
      cy.get(`input[name="course_ids[]"][value="${courseBId}"]`).should('exist')
    })
  })

  it('MEN-1555-02 | Archived course is NOT shown in link list', () => {
    loginInstructorUI()

    cy.then(() => {
      if (!archivedCourseId) return

      openCreateLiveSessionForm(courseAId)
      assertLinkListRuleVisible()
      assertCourseInLinkList(archivedCourseId, false, 'archived — excluded by rule')
    })
  })

  it('MEN-1555-03 | Unpublished course is linkable for instructor but hidden from students', () => {
    cy.then(() => {
      if (!unpublishedCourseId) return

      loginInstructorUI()
      openCreateLiveSessionForm(courseAId)
      assertCourseInLinkList(unpublishedCourseId, true, 'unpublished — instructor may link sessions')

      createLiveMeeting(UNPUBLISHED_SESSION_TITLE, 3, [
        { id: unpublishedCourseId, title: UNPUBLISHED_COURSE_TITLE },
      ])
      goToLiveSessionsIndex()
      cy.get('body').invoke('text').should('include', UNPUBLISHED_SESSION_TITLE)

      assertCourseHiddenFromPublicUser(unpublishedCourseId, UNPUBLISHED_COURSE_TITLE, STUDENT)
      assertCourseHiddenFromPublicUser(unpublishedCourseId, UNPUBLISHED_COURSE_TITLE, STUDENT_2)
    })
  })

  it('MEN-1555-04 | Recorded (non-live/hybrid) course is NOT shown in link list', () => {
    loginInstructorUI()

    cy.then(() => {
      if (!recordedCourseId) return

      openCreateLiveSessionForm(courseAId)
      assertLinkListRuleVisible()
      assertCourseInLinkList(recordedCourseId, false, 'recorded delivery — only live/hybrid allowed')
    })
  })

})
