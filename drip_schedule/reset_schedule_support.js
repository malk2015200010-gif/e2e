/**
 * Reset Schedule / drip helpers — https://dev.mentoraeg.com
 *
 * Routes:
 *   GET  /dashboard/courses/{id}/drip
 *   POST /dashboard/courses/{id}/drip          (Save Schedule)
 *   POST /dashboard/courses/{id}/drip/reset    (Reset Schedule + confirm)
 *   GET  /admin/settings/lms-settings          (require_course_update_review)
 *   GET  /admin/courses/updates                (pending CourseUpdate queue)
 */

import { getAppBase, loginAndVisit, dismissCookieBanner, selectCourseCategory } from '../../support/navigation.js'
import { basicAuth, ADMIN, INSTRUCTOR, STUDENT, INSTRUCTORS } from '../../support/users.js'

export { basicAuth, ADMIN, INSTRUCTOR, STUDENT }
export const OTHER_INSTRUCTOR = INSTRUCTORS[1] // teacher@demoyuliya.com

export const BASE = () => getAppBase()
export const RESET_CONFIRM_RE =
  /Clear all scheduling dates and days for this course\? This cannot be undone\./i

export const RESET_BTN = 'form[action*="/drip/reset"] button[type="submit"]'
export const SAVE_BTN = 'button.btn-purple[type="submit"], button.btn-info[type="submit"]'
export const UNLOCK_DATE = 'input[name*="[unlock_date]"]'
export const UNLOCK_DAYS = 'input[name*="[unlock_days]"]'
export const REVIEW_CHECKBOX = 'input[name="lms_settings[require_course_update_review]"][type="checkbox"]'

export const SAMPLE_DATE = '2026-12-15'
export const SAMPLE_DAYS = '7'

export const go = (path) =>
  cy
    .visit(`${BASE()}${path}`, {
      auth: basicAuth(),
      failOnStatusCode: false,
      timeout: 120000,
      retryOnNetworkFailure: true,
    })
    .then(() => dismissCookieBanner())

export const loginInstructor = () => loginAndVisit(INSTRUCTOR, '/dashboard')
export const loginAdmin = () => loginAndVisit(ADMIN, '/admin')

export const pageUiText = () =>
  cy.get('body', { timeout: 15000 }).then(($b) => {
    const $clone = $b.clone()
    $clone.find('#phpdebugbar, .phpdebugbar, script, style, noscript').remove()
    return ($clone.text() || '').replace(/\s+/g, ' ').trim()
  })

const hideDebugBar = () => {
  cy.document().then((doc) => {
    if (doc.getElementById('cypress-hide-debugbar')) return
    const style = doc.createElement('style')
    style.id = 'cypress-hide-debugbar'
    style.textContent =
      '.phpdebugbar, .phpdebugbar-header, .phpdebugbar-openhandler { display: none !important; }'
    doc.head.appendChild(style)
  })
}

const setNativeValue = (el, value) => {
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement : window.HTMLInputElement
  const setter = Object.getOwnPropertyDescriptor(proto.prototype, 'value')?.set
  el.focus()
  if (setter) setter.call(el, value)
  else el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

export const goDrip = (courseId) => {
  go(`/dashboard/courses/${courseId}/drip`)
  cy.url({ timeout: 20000 }).should('include', `/dashboard/courses/${courseId}/drip`)
  hideDebugBar()
}

const dismissOverlays = () => {
  hideDebugBar()
  cy.get('body').then(($body) => {
    const $ok = $body
      .find('button, a, [role="button"]')
      .filter((_, el) => /^(ok|accept|agree|موافق)$/i.test((el.textContent || '').trim()))
      .filter(':visible')
    if ($ok.length) cy.wrap($ok.first()).click({ force: true })
  })
}

export const goCurriculum = (courseId) => {
  go(`/dashboard/courses/${courseId}/curriculum`)
  cy.get('.dashboard-curriculum-wrap', { timeout: 20000 }).should('exist')
  cy.url({ timeout: 15000 }).should('include', '/curriculum')
  dismissOverlays()
}

export const createRecordedCourse = (title) => {
  loginInstructor()
  go('/dashboard/courses/new')
  cy.get('#title', { timeout: 25000 }).should('exist')
  cy.get('#title').clear({ force: true }).type(title, { force: true })
  cy.get('textarea').first().clear({ force: true }).type(`Drip reset E2E — ${title}`, { force: true })
  cy.get('select[name="level"]').select('Beginner')
  cy.get('select[name="delivery_type"]').select('Recorded')
  cy.wait(800)
  selectCourseCategory()
  cy.wait(800)
  cy.contains('label', 'Topic').parent().find('.select2-selection').first().click({ force: true })
  cy.contains('.select2-results__option', 'Math').first().click({ force: true })
  cy.contains('button', /create course/i).first().click({ force: true })

  return cy.url({ timeout: 40000 }).then((url) => {
    const m = url.match(/courses\/(\d+)/)
    expect(m, `course id for "${title}"`).to.exist
    return m[1]
  })
}

const createSectionPanel = () =>
  cy.get('.curriculum-section-form-panel[data-mode="create"]', { timeout: 15000 }).filter(':visible').first()

const sectionNameInput = () =>
  createSectionPanel()
    .find('input[name="section_name"], input.curriculum-section-name-input')
    .filter(':visible')
    .first()

export const addSection = (courseId, name) => {
  goCurriculum(courseId)
  dismissOverlays()

  cy.get('.btn-curriculum-new-section-sidebar, .btn-curriculum-new-section, .curriculum-panel-empty-action')
    .filter(':visible')
    .first()
    .scrollIntoView()
    .click({ force: true })

  createSectionPanel().should('exist')
  createSectionPanel().invoke('text').should('match', /new section|create section|قسم/i)

  sectionNameInput().then(($el) => {
    setNativeValue($el[0], name)
  })
  sectionNameInput().invoke('val').then((val) => {
    if (String(val || '') !== name) {
      sectionNameInput().then(($el) => setNativeValue($el[0], name))
    }
  })
  sectionNameInput().should('have.value', name)

  dismissOverlays()
  createSectionPanel()
    .find(
      'button.btn-curriculum-primary[type="submit"], button.btn-curriculum-primary, button[type="submit"]',
    )
    .filter(':visible')
    .first()
    .scrollIntoView()
    .click({ force: true })

  cy.get('.curriculum-sidebar, .dashboard-curriculum-wrap', { timeout: 25000 }).should(($el) => {
    expect($el.text(), `section "${name}" in curriculum`).to.include(name)
  })

  cy.get('body').then(($b) => {
    const inSidebar = $b
      .find('.dashboard-course-section, .curriculum-sidebar')
      .toArray()
      .some((el) => (el.textContent || '').includes(name))
    if (inSidebar) return
    goCurriculum(courseId)
    cy.get('.curriculum-sidebar, .dashboard-curriculum-wrap', { timeout: 25000 }).should('contain.text', name)
  })
}

export const addLecture = (courseId, title) => {
  goCurriculum(courseId)
  cy.get('.dashboard-course-section').first().then(($s) => {
    if (!$s.hasClass('is-expanded')) {
      cy.wrap($s).find('.section-header, .section-title, h3, button').first().click({ force: true })
    }
  })
  cy.get('.curriculum-add-item-toggle').filter(':visible').first().click({ force: true })
  cy.get('a.add-item-lecture').filter(':visible').first().click({ force: true })
  cy.get('#lecture-builder-title, #lecture-builder-form input[name="title"]', { timeout: 25000 })
    .first()
    .then(($el) => {
      setNativeValue($el[0], title)
    })
  cy.get('button.btn-save-lecture', { timeout: 15000 }).first().then(($btn) => {
    if ($btn.is(':disabled')) $btn.removeAttr('disabled').prop('disabled', false)
  })
  cy.get('button.btn-save-lecture').first().click({ force: true })
  cy.contains('.curriculum-sidebar, .dashboard-curriculum-wrap', title, { timeout: 25000 }).should('exist')
}

export const readUnlockValues = () =>
  cy.get(`${UNLOCK_DATE}, ${UNLOCK_DAYS}`, { timeout: 15000 }).then(($ins) =>
    [...$ins].map((el) => ({
      name: el.getAttribute('name') || '',
      value: String(el.value || '').trim(),
    })),
  )

export const assertUnlocksEmpty = () => {
  cy.get(`${UNLOCK_DATE}, ${UNLOCK_DAYS}`, { timeout: 15000 }).then(($ins) => {
    expect($ins.length, 'unlock fields on drip form').to.be.greaterThan(0)
    ;[...$ins].forEach((el) => {
      expect(String(el.value || '').trim(), el.getAttribute('name')).to.eq('')
    })
  })
}

export const assertUnlocksHaveValues = () => {
  readUnlockValues().then((rows) => {
    const filled = rows.filter((r) => r.value)
    expect(filled.length, 'at least one unlock date/days is set').to.be.greaterThan(0)
  })
}

export const fillUnlockSample = () => {
  cy.get(UNLOCK_DATE, { timeout: 15000 }).first().clear({ force: true }).type(SAMPLE_DATE, { force: true })
  cy.get(UNLOCK_DAYS).first().clear({ force: true }).type(SAMPLE_DAYS, { force: true })
  cy.get(UNLOCK_DATE).first().trigger('change', { force: true })
  cy.get(UNLOCK_DAYS).first().trigger('change', { force: true })
}

export const saveSchedule = () => {
  cy.intercept('POST', '**/dashboard/courses/*/drip').as('saveDrip')
  cy.contains('button[type="submit"]', /Save Schedule/i).first().scrollIntoView().click({ force: true })
  cy.get(UNLOCK_DATE, { timeout: 25000 }).should('exist')
}

export const snapshotUnlocks = () => readUnlockValues().then((rows) => rows.map((r) => r.value).join('|'))

/** Stub window.confirm on the current page (inline onsubmit=return confirm(...)). */
export const stubResetConfirm = (accept) => {
  cy.window().then((win) => {
    if (typeof win.confirm === 'function' && win.confirm.restore) win.confirm.restore()
    cy.stub(win, 'confirm').callsFake((msg) => {
      expect(String(msg || ''), 'Reset Schedule confirm copy').to.match(RESET_CONFIRM_RE)
      return Boolean(accept)
    })
  })
}

export const clickResetSchedule = () => {
  cy.get(RESET_BTN, { timeout: 15000 }).should('be.visible').click()
}

export const resetScheduleAndWait = () => {
  cy.intercept('POST', '**/drip/reset').as('dripReset')
  stubResetConfirm(true)
  clickResetSchedule()
  cy.wait('@dripReset', { timeout: 25000 }).its('response.statusCode').should('be.oneOf', [200, 201, 302])
}

/** Pending-changes / admin queue: ignore chrome + debugbar (they contain "pending" and SQL "drip"). */
export const pendingChangeRowsText = () =>
  cy.get('body', { timeout: 15000 }).then(($b) => {
    const $clone = $b.clone()
    $clone.find('#phpdebugbar, .phpdebugbar, script, style, noscript, nav, header, footer, .dashboard-menu').remove()
    const rows = [...$clone.find('table tbody tr, .pending-change, .list-group-item, .card-body tr')]
      .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
    return rows
  })

export const assertNoPendingDripRow = () => {
  pendingChangeRowsText().then((rows) => {
    const dripRow = rows.some((t) => /\bdrip\b/i.test(t))
    expect(dripRow, `no drip CourseUpdate row (rows=${JSON.stringify(rows.slice(0, 8))})`).to.eq(false)
  })
}

export const adminUpdateRowsText = () =>
  cy.get('body', { timeout: 20000 }).then(($b) => {
    const $clone = $b.clone()
    $clone.find('#phpdebugbar, .phpdebugbar, script, style, noscript, nav, header, footer').remove()
    return [...$clone.find('table tbody tr')]
      .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
      .filter((t) => t && !/^#\s*$/.test(t))
  })

export const assertAdminQueueDripFor = (courseTitle, shouldExist) => {
  adminUpdateRowsText().then((rows) => {
    const hit = rows.some((t) => t.includes(courseTitle) && /\bdrip\b/i.test(t))
    expect(
      hit,
      `admin Course Updates drip row for "${courseTitle}" (rows=${JSON.stringify(rows.slice(0, 12))})`,
    ).to.eq(shouldExist)
  })
}

export const csrfFrom = (html = '') => {
  const m =
    String(html).match(/name="_token"\s+value="([^"]+)"/) ||
    String(html).match(/<meta name="csrf-token" content="([^"]+)"/)
  return m ? m[1] : ''
}

export const readReviewEnabled = () => {
  loginAdmin()
  go('/admin/settings/lms-settings')
  return cy.get(REVIEW_CHECKBOX, { timeout: 20000 }).then(($cb) => Boolean($cb.is(':checked')))
}

export const setCourseUpdateReview = (enabled) => {
  loginAdmin()
  go('/admin/settings/lms-settings')
  cy.get(REVIEW_CHECKBOX, { timeout: 20000 }).then(($cb) => {
    const on = $cb.is(':checked')
    if (Boolean(on) === Boolean(enabled)) {
      cy.log(`require_course_update_review already ${enabled ? 'ON' : 'OFF'}`)
      return
    }
    cy.wrap($cb).click({ force: true })
    cy.get('#settings_save_btn').click({ force: true })
    cy.get('body', { timeout: 20000 }).should(($b) => {
      const t = $b.text()
      expect(/saved|success|updated|lms settings/i.test(t), 'lms settings saved').to.eq(true)
    })
  })
}

export const publishCourseAsAdmin = (courseId) => {
  loginAdmin()
  go('/admin/courses')
  cy.get('body', { timeout: 20000 }).should('exist')
  cy.get('body').then(($b) => {
    const cb = $b.find(`input.check_bulk_item[value="${courseId}"]`)
    if (cb.length) {
      cy.wrap(cb.first()).check({ force: true })
    } else {
      go(`/admin/courses/${courseId}/edit`)
    }
  })
  cy.get('select[name="status"]', { timeout: 15000 }).select('1', { force: true })
  cy.contains('button, input[type="submit"]', /update|save/i).first().click({ force: true })
  cy.wait(1500)
}

export const adminCourseUpdatesHas = (courseTitle, typeRe = /drip|schedule/i) => {
  loginAdmin()
  go('/admin/courses/updates')
  cy.get('body', { timeout: 20000 }).should('exist')
  return pageUiText().then((text) => {
    const hasCourse = text.includes(courseTitle)
    const hasType = typeRe.test(text)
    return Boolean(hasCourse && (hasType || hasCourse))
  })
}

export const pendingChangesMentionsDrip = (courseId) => {
  loginInstructor()
  go(`/dashboard/courses/${courseId}/pending-changes`)
  return pageUiText().then((text) => /drip|schedule|unlock/i.test(text) && !/no pending|nothing pending|no changes/i.test(text))
}

export const dripPageShowsPending = () =>
  pageUiText().then((text) =>
    /pending|awaiting approval|queued for|waiting for admin|moderation/i.test(text),
  )
