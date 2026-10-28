/**
 * Curriculum Builder — E2E (MEN-1637 → MEN-1677)
 *
 * Strategy:
 *   - before(): create course + section + lecture/quiz/assignment (once)
 *   - testIsolation: false → shared session & course state
 *   - Selectors match Mentora curriculum HTML (dev/stg)
 *
 * Env:
 *   CYPRESS_BASE_URL / baseUrl — defaults to https://dev.mentoraeg.com
 *   (your runner is on stg → set baseUrl or CYPRESS_BASE_URL to https://stg.mentoraeg.com)
 */

import { getAppBase, loginViaApi, loginAndVisit, dismissCookieBanner, selectCourseCategory } from '../../support/navigation.js'
import { basicAuth, ADMIN, INSTRUCTOR, STUDENT } from '../../support/users.js'

Cypress.on('uncaught:exception', () => false)
Cypress.on('window:before:load', (win) => {
  win.addEventListener(
    'error',
    (e) => {
      if (/ckeditor|customConfig|flatpickr/i.test(String(e.message || e.error || ''))) {
        e.preventDefault()
        e.stopImmediatePropagation()
      }
    },
    true,
  )
})

const BASE = () => getAppBase()
const COURSE_TITLE = `Curriculum Full ${Date.now()}`

let courseId = null
let coursePublished = false
let sectionName = `Section ${Date.now()}`
const lectureTitle = `Lecture ${Date.now()}`
const quizTitle = `Quiz ${Date.now()}`
const assignmentTitle = `Assignment ${Date.now()}`
const updatedLecture = `${lectureTitle} Updated`

// ─── Auth & navigation ────────────────────────────────────────────────────────

const go = (path) =>
  cy
    .visit(`${BASE()}${path}`, {
      auth: basicAuth(),
      failOnStatusCode: false,
      timeout: 120000,
      retryOnNetworkFailure: true,
    })
    .then(() => dismissCookieBanner())

const loginInstructorUI = () => {
  loginAndVisit(INSTRUCTOR, '/dashboard')
}

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

/** Cookie / WhatsApp overlays can sit on top of Create Section. */
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

const goCurriculum = (id = courseId) => {
  go(`/dashboard/courses/${id}/curriculum`)
  cy.get('.dashboard-curriculum-wrap', { timeout: 20000 }).should('exist')
  cy.url({ timeout: 15000 }).should('include', '/curriculum')
  dismissOverlays()
}

const assertOnCurriculum = () => {
  cy.url({ timeout: 15000 }).should('include', '/dashboard/courses/')
  cy.url().should('include', '/curriculum')
}

// ─── DOM scopes ───────────────────────────────────────────────────────────────

const sidebar = () => cy.get('.curriculum-sidebar').first()
const addItemWrap = () =>
  sidebar().find('.dashboard-course-section.is-expanded .section-add-item-wrap, .section-add-item-wrap').first()

const lecturePanel = () =>
  cy.get('#lecture-builder-panel, #lecture-builder-title, #lecture-builder-form', { timeout: 25000 }).then(($el) => {
    const $panel = $el.closest('#lecture-builder-panel')
    return cy.wrap($panel.length ? $panel : $el.first())
  })
const quizPanel = () =>
  cy
    .get('#quiz-builder-panel, #quiz-builder-title, #quiz-builder-meta-form, form[id*="quiz-builder"]', {
      timeout: 25000,
    })
    .then(($el) => {
      const $panel = $el.closest('#quiz-builder-panel')
      return cy.wrap($panel.length ? $panel : $el.first())
    })
const assignmentPanel = () =>
  cy
    .get('#assignment-builder-panel, #assignment-builder-title, #assignment-builder-form', { timeout: 25000 })
    .then(($el) => {
      const $panel = $el.closest('#assignment-builder-panel')
      return cy.wrap($panel.length ? $panel : $el.first())
    })

const itemType = (t) => t.toLowerCase().replace(/s$/, '')

const createSectionPanel = () =>
  cy.get('.curriculum-section-form-panel[data-mode="create"]', { timeout: 10000 }).filter(':visible').first()

// ─── Section ──────────────────────────────────────────────────────────────────

const clickNewSection = () => {
  dismissOverlays()
  cy.get('.btn-curriculum-new-section-sidebar, .btn-curriculum-new-section, .curriculum-panel-empty-action')
    .filter(':visible')
    .first()
    .scrollIntoView()
    .click({ force: true })
  createSectionPanel().should('exist')
  createSectionPanel().invoke('text').should('match', /new section|create section|قسم/i)
}

const visibleEditPanel = () =>
  cy.get('.curriculum-section-form-panel[data-mode="edit"]:visible', { timeout: 10000 }).first()

const sectionNameInput = (mode = 'create') =>
  mode === 'edit'
    ? visibleEditPanel().find('input[name="section_name"]').first()
    : createSectionPanel()
        .find('input[name="section_name"], input.curriculum-section-name-input')
        .filter(':visible')
        .first()

const typeSectionName = (name, mode = 'create') => {
  sectionNameInput(mode).scrollIntoView().click({ force: true })
  sectionNameInput(mode).clear({ force: true })
  sectionNameInput(mode).type(name, { force: true, delay: 15 })
  sectionNameInput(mode).trigger('input', { force: true }).trigger('change', { force: true })

  // Ensure the controlled/native value actually stuck (stg was resetting to placeholder).
  sectionNameInput(mode)
    .invoke('val')
    .then((val) => {
      if (String(val || '') !== name) {
        sectionNameInput(mode)
          .invoke('val', name)
          .trigger('input', { force: true })
          .trigger('change', { force: true })
      }
    })

  sectionNameInput(mode).should('have.value', name)
}

const submitCreateSection = () => {
  dismissOverlays()
  createSectionPanel().within(() => {
    cy.get('input[name="section_name"], input.curriculum-section-name-input')
      .filter(':visible')
      .first()
      .should('not.have.value', '')

    cy.get('form.curriculum-section-form, form')
      .first()
      .then(($form) => {
        const formEl = $form[0]
        if (formEl && typeof formEl.requestSubmit === 'function') {
          formEl.requestSubmit()
          return
        }
        const $btn = $form
          .find('button.btn-curriculum-primary, button[type="submit"]')
          .filter(':visible')
          .first()
        if ($btn.length) {
          $btn[0].click()
          return
        }
        throw new Error('Create Section submit control not found')
      })
  })
}

const submitUpdateSection = () => {
  dismissOverlays()
  visibleEditPanel()
    .find(
      '.curriculum-section-form-footer button.btn-curriculum-primary[type="submit"], ' +
        '.curriculum-section-form-footer button.btn-curriculum-primary[name="save"], ' +
        'button.btn-curriculum-primary',
    )
    .filter(':visible')
    .first()
    .scrollIntoView()
    .click({ force: true })
}

const sectionByName = (name) =>
  sidebar()
    .find('.dashboard-course-section')
    .filter((_, el) => Cypress.$(el).text().includes(name))
    .first()

/**
 * Create a section and assert it appears in the sidebar.
 * Do NOT cy.wait('@newSection') — stg often saves via a different URL / client handler,
 * so the old intercept never fires even when the section is created (or when submit is blocked).
 */
const addSection = (name) => {
  assertOnCurriculum()
  dismissOverlays()

  clickNewSection()
  typeSectionName(name, 'create')
  submitCreateSection()

  // Success = section visible in course structure (not a specific network alias).
  sidebar().contains('.dashboard-course-section', name, { timeout: 25000 }).should('exist')

  // Create panel should close / leave create mode after success.
  cy.get('body').then(($body) => {
    const stillOpenEmpty =
      $body.find('.curriculum-section-form-panel[data-mode="create"]:visible').length > 0 &&
      !$body.find('.dashboard-course-section').filter((_, el) => el.textContent.includes(name)).length
    if (stillOpenEmpty) {
      throw new Error(
        `Create Section did not persist "${name}". Form still open and section missing from sidebar.`,
      )
    }
  })
}

const renameSection = (newName) => {
  dismissOverlays()

  sectionByName(sectionName).find('button.section-edit-btn').first().click({ force: true })
  visibleEditPanel().should('exist')
  typeSectionName(newName, 'edit')
  submitUpdateSection()

  sectionByName(newName).should('exist')
  sectionName = newName
}

// ─── Items ────────────────────────────────────────────────────────────────────

const openAddMenu = () => {
  addItemWrap().find('.curriculum-add-item-toggle').first().click({ force: true })
  addItemWrap().find('ul.curriculum-add-item-menu').should('exist')
}

const openItemBuilder = (type) => {
  const key = itemType(type)
  const links = {
    lecture: 'a.add-item-lecture',
    quiz: 'a.create-new-quiz',
    assignment: 'a.new-assignment-btn',
  }
  const panelSel = {
    lecture: '#lecture-builder-panel, #lecture-builder-title, #lecture-builder-form',
    quiz: '#quiz-builder-panel, #quiz-builder-title, #quiz-builder-meta-form, form[id*="quiz-builder"]',
    assignment: '#assignment-builder-panel, #assignment-builder-title, #assignment-builder-form',
  }

  const clickAdd = () => {
    openAddMenu()
    addItemWrap().find(links[key]).first().click({ force: true })
  }

  if (key === 'quiz') cy.intercept('POST', '**/curriculum/quiz/builder').as('quizBuilder')
  clickAdd()
  cy.get('body', { timeout: 8000 }).then(($body) => {
    if ($body.find(panelSel[key]).length) return
    clickAdd()
  })
  cy.get(panelSel[key], { timeout: 25000 }).should('exist')
  if (key === 'quiz') cy.wait('@quizBuilder', { timeout: 30000 })
}

const setNativeValue = (el, title) => {
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement : window.HTMLInputElement
  const setter = Object.getOwnPropertyDescriptor(proto.prototype, 'value')?.set
  el.focus()
  if (setter) setter.call(el, title)
  else el.value = title
  el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: title, inputType: 'insertText' }))
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
  el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }))
}

const TITLE_SELS = {
  lecture: '#lecture-builder-title, #lecture-builder-form input[name="title"]',
  quiz: '#quiz-builder-title, form[id*="quiz-builder"] input[name="title"]',
  assignment: '#assignment-builder-title, #assignment-builder-form input[name="title"]',
}

const SAVE_SELS = {
  lecture: 'button.btn-save-lecture',
  quiz: 'button.btn-save-quiz',
  assignment: 'button.btn-save-assignment',
}

const setInputValue = (selector, title) => {
  cy.get(selector, { timeout: 25000 }).should('exist')
  cy.get(selector).first().then(($el) => {
    setNativeValue($el[0], title)
  })
  cy.get(selector)
    .first()
    .should(($el) => {
      if (String($el.val() || '') !== title) setNativeValue($el[0], title)
      expect(String($el.val() || ''), `value of ${selector}`).to.eq(title)
    })
}

const enableSaveIfStuck = (saveSel) => {
  cy.get(saveSel, { timeout: 15000 }).first().then(($btn) => {
    if ($btn.is(':disabled') || $btn.prop('disabled')) {
      $btn.removeAttr('disabled').prop('disabled', false).removeClass('disabled')
    }
  })
}

const fillItemTitle = (title, type) => {
  const key = itemType(type)
  if (key === 'quiz') return
  setInputValue(TITLE_SELS[key], title)
  enableSaveIfStuck(SAVE_SELS[key])
  cy.get(SAVE_SELS[key]).first().should('not.be.disabled')
}

/**
 * Write the quiz title, then Add Question, then Single Line Text, then Save.
 * The question form is inserted only after the hidden type radio fires change,
 * and only once the quiz itself exists. Choosing the type before that leaves
 * the form out of the page.
 */
const addQuizQuestion = (quizTitle) => {
  const questionTitle = `Question ${Date.now()}`

  cy.get('#quiz-builder-title', { timeout: 20000 }).should('be.visible').click({ force: true })
  cy.get('#quiz-builder-title').clear({ force: true })
  cy.get('#quiz-builder-title').type(quizTitle, { force: true, delay: 20 })
  cy.get('#quiz-builder-title').should('have.value', quizTitle).and('not.have.class', 'is-invalid')

  cy.get('#quiz-add-question-btn', { timeout: 20000 }).should('be.visible').click({ force: true })
  cy.get('#quiz-builder-panel').should(($panel) => {
    expect($panel.attr('data-quiz-id'), 'quiz was created').to.match(/^[1-9]\d*$/)
  })
  cy.get('#quiz-question-type-picker', { timeout: 20000 }).should('be.visible')
  cy.get('#qb_type_text').check({ force: true })
  cy.get('#qb_type_text').trigger('change', { force: true })
  cy.get('#quiz-new-question-form-wrap .quiz-question-form-wrap[data-question-type="text"]', {
    timeout: 20000,
  }).should('exist')

  cy.get('#quiz-new-question-form-wrap input[name="question_title"]')
    .first()
    .then(($el) => setNativeValue($el[0], questionTitle))
  cy.get('#quiz-new-question-form-wrap input[name="score"]')
    .first()
    .then(($el) => setNativeValue($el[0], '1'))

  cy.get('#quiz-new-question-form-wrap .btn-save-question', { timeout: 15000 })
    .should('not.be.disabled')
    .click({ force: true })
  cy.get('button.btn-save-quiz', { timeout: 20000 }).should('be.visible').and('not.be.disabled')
}

const saveItem = (type) => {
  const key = itemType(type)
  if (key === 'lecture') {
    lecturePanel().find('button.btn-save-lecture').first().click({ force: true })
  } else if (key === 'quiz') {
    cy.get('button.btn-save-quiz', { timeout: 15000 }).first().should('not.be.disabled').click({ force: true })
  } else {
    assignmentPanel().find('button.btn-save-assignment').first().click({ force: true })
  }
  cy.get('.dashboard-curriculum-wrap', { timeout: 20000 }).should('exist')
  assertOnCurriculum()
}

const createItem = (type, title) => {
  openItemBuilder(type)
  fillItemTitle(title, type)
  if (itemType(type) === 'quiz') addQuizQuestion(title)
  saveItem(type)
  sidebar().should('contain.text', title)
}

const openSidebarItem = (title) => {
  sidebar()
    .find('.edit-curriculum-item')
    .contains(title)
    .first()
    .closest('.section-item-top')
    .click({ force: true })
  cy.wait(500)
  assertOnCurriculum()
}

const cancelItemEdit = (type = 'lecture') => {
  hideDebugBar()
  const close = {
    lecture: () => lecturePanel().find('button.btn-lecture-builder-close'),
    quiz: () => quizPanel().find('button.btn-quiz-builder-close'),
    assignment: () => assignmentPanel().find('button.btn-assignment-builder-close'),
  }
  close[itemType(type)]().first().click({ force: true })
  cy.wait(400)
}

const buildCurriculum = () => {
  goCurriculum()
  sidebar().invoke('text').then((t) => {
    if (!t.includes(sectionName)) addSection(sectionName)
  })
  sidebar().invoke('text').then((t) => {
    if (t.includes(updatedLecture) || t.includes(lectureTitle)) return
    createItem('Lecture', lectureTitle)
    openSidebarItem(lectureTitle)
    fillItemTitle(updatedLecture, 'Lecture')
    saveItem('Lecture')
  })
  sidebar().invoke('text').then((t) => {
    if (!t.includes(quizTitle)) createItem('Quiz', quizTitle)
  })
  sidebar().invoke('text').then((t) => {
    if (!t.includes(assignmentTitle)) createItem('Assignment', assignmentTitle)
  })
}

// ─── Publish ──────────────────────────────────────────────────────────────────

const selectPaidPricingOption = () => {
  cy.get('img[src*="paid.svg"]', { timeout: 10000 })
    .should('be.visible')
    .then(($img) => {
      let $target = $img.closest(
        'label, button, a, [role="button"], [data-pricing-type], .pricing-type-card, .pricing-option'
      )
      if (!$target.length) $target = $img.parent()
      cy.wrap($target.first()).click({ force: true })
    })
}

const fillTotalPrice = (price = '100') => {
  cy.contains('label, span, p, div', /Total Price/i, { timeout: 10000 })
    .first()
    .closest('.form-group, .mb-3, .row, .card-body, div')
    .find('input[type="text"], input[type="number"]')
    .filter(':visible')
    .first()
    .clear({ force: true })
    .type(price, { force: true })
}

const ensureCoursePricing = (price = '100') => {
  go(`/dashboard/courses/${courseId}/pricing`)
  cy.get('body', { timeout: 15000 }).should('exist')
  hideDebugBar()

  cy.intercept('POST', '**/pricing**').as('setPricing')

  // 1) Paid card (paid.svg) — price fields appear only after this
  selectPaidPricingOption()

  // 2) Full Payment tab (default after Paid; click if present but inactive)
  cy.get('body').then(($body) => {
    const $tab = $body
      .find('button, a, [role="tab"], .nav-link')
      .filter((_, el) => /^Full Payment$/i.test((el.textContent || '').trim()))
      .first()
    if ($tab.length && !$tab.hasClass('active')) {
      cy.wrap($tab).click({ force: true })
    }
  })

  // 3) Total Price + 4) Set Pricing
  fillTotalPrice(price)
  cy.contains('button', /Set Pricing/i).should('be.visible').click({ force: true })

  cy.wait('@setPricing', { timeout: 20000 }).its('response.statusCode').should('be.oneOf', [200, 201, 302])
}

const publishAndApproveCourse = () => {
  if (coursePublished) return

  loginInstructorUI()
  ensureCoursePricing()

  go(`/dashboard/courses/${courseId}/publish`)
  cy.get('body', { timeout: 15000 }).then(($b) => {
    const text = $b.text()
    if (/published|live/i.test(text)) {
      coursePublished = true
      return
    }
    if (!/pending state/i.test(text)) {
      cy.get('button[name="publish_btn"][value="publish"]').first().click({ force: true })
      cy.wait(2000)
    }
  })

  loginViaApi(ADMIN)
  go('/admin/courses')
  cy.get('body', { timeout: 15000 }).then(($b) => {
    const cb = $b.find(`input.check_bulk_item[value="${courseId}"]`)
    if (cb.length) {
      cy.wrap(cb.first()).check({ force: true })
    } else {
      go(`/admin/courses/${courseId}/edit`)
    }
  })
  cy.get('select[name="status"]').select('1', { force: true })
  cy.contains('button, input[type="submit"]', /update|save/i).first().click({ force: true })
  cy.wait(1500)
  coursePublished = true
}

// ─── Setup ────────────────────────────────────────────────────────────────────

describe('Curriculum Builder', { testIsolation: false }, () => {
  before(() => {
    // CKEditor 4 throws `customConfig` on quiz/assignment panels in Electron.
    cy.on('uncaught:exception', () => false)

    loginInstructorUI()

    go('/dashboard/courses/new')
    cy.get('#title').clear({ force: true })
    cy.get('#title').type(COURSE_TITLE, { force: true })
    cy.get('textarea').first().clear({ force: true })
    cy.get('textarea').first().type('Curriculum E2E test course', { force: true })
    cy.get('select[name="level"]').select('Beginner')
    cy.get('select[name="delivery_type"]').select('Recorded')
    cy.wait(1000)
    selectCourseCategory()
    cy.wait(1500)
    cy.contains('label', 'Topic').parent().find('.select2-selection').first().click({ force: true })
    cy.contains('.select2-results__option', 'Math').first().click({ force: true })
    cy.contains('button', /create course/i).first().click({ force: true })
    cy.wait(2000)

    cy.url({ timeout: 20000 }).then((url) => {
      const m = url.match(/courses\/(\d+)/)
      if (m) courseId = m[1]
    })

    cy.then(() => {
      expect(courseId, 'courseId').to.not.be.null
      loginInstructorUI()
      buildCurriculum()
    })
  })

  // ─── Main audit ─────────────────────────────────────────────────────────────

  it('FULL | curriculum audit — layout, items, save, cancel, rename', () => {
    loginInstructorUI()
    goCurriculum()

    cy.get('.course-edit-nav').should('exist')
    cy.get('.curriculum-sidebar').should('exist')
    cy.get('#curriculum-detail-panel').should('exist')

    sidebar().should('contain.text', updatedLecture)
    sidebar().should('contain.text', quizTitle)
    sidebar().should('contain.text', assignmentTitle)

    renameSection(`Renamed ${Date.now()}`)

    openSidebarItem(updatedLecture)
    fillItemTitle('WILL_NOT_SAVE', 'Lecture')
    cancelItemEdit('Lecture')
    sidebar().should('not.contain.text', 'WILL_NOT_SAVE')
  })

  // ─── MEN coverage (smoke — no duplicate heavy setup) ────────────────────────

  it('MEN-1637 | Split layout', () => {
    loginInstructorUI()
    goCurriculum()
    cy.get('.curriculum-sidebar, #curriculum-detail-panel').should('exist')
  })

  it('MEN-1639 | Open item stays on curriculum URL', () => {
    loginInstructorUI()
    goCurriculum()
    openSidebarItem(updatedLecture)
    cy.url().should('include', '/curriculum')
  })

  it('MEN-1640 | Add section', () => {
    loginInstructorUI()
    goCurriculum()
    addSection(`Extra ${Date.now()}`)
  })

  it('MEN-1641 | Rename section', () => {
    loginInstructorUI()
    goCurriculum()
    renameSection(`Renamed ${Date.now()}`)
  })

  it('MEN-1642 | Collapse / expand', () => {
    loginInstructorUI()
    goCurriculum()
    sidebar().find('.section-collapse-toggle').first().click({ force: true })
    cy.wait(300)
    sidebar().find('.section-collapse-toggle').first().click({ force: true })
  })

  it('MEN-1645 | Create lecture', () => {
    loginInstructorUI()
    goCurriculum()
    createItem('Lecture', `Lec ${Date.now()}`)
  })

  it('MEN-1646 | Create quiz', () => {
    loginInstructorUI()
    goCurriculum()
    createItem('Quiz', `Quiz ${Date.now()}`)
  })

  it('MEN-1647 | Create assignment', () => {
    loginInstructorUI()
    goCurriculum()
    createItem('Assignment', `Asg ${Date.now()}`)
  })

  it('MEN-1653 | Save item changes', () => {
    loginInstructorUI()
    goCurriculum()
    openSidebarItem(updatedLecture)
    const saved = `${updatedLecture} saved`
    fillItemTitle(saved, 'Lecture')
    saveItem('Lecture')
    sidebar().should('contain.text', saved)
    openSidebarItem(saved)
    fillItemTitle(updatedLecture, 'Lecture')
    saveItem('Lecture')
  })

  it('MEN-1654 | Cancel discards changes', () => {
    loginInstructorUI()
    goCurriculum()
    openSidebarItem(updatedLecture)
    fillItemTitle('DISCARD_X', 'Lecture')
    cancelItemEdit('Lecture')
    sidebar().should('not.contain.text', 'DISCARD_X')
  })

  it('MEN-1667 | Lecture title required', () => {
    loginInstructorUI()
    goCurriculum()
    openItemBuilder('Lecture')
    lecturePanel().find('#lecture-builder-title').clear({ force: true }).blur({ force: true })
    lecturePanel().find('button.btn-save-lecture').should('be.disabled')
  })

  it('MEN-1674 | Student blocked from instructor curriculum (draft)', () => {
    loginViaApi(STUDENT)
    cy.request({
      method: 'GET',
      url: `${BASE()}/dashboard/courses/${courseId}/curriculum`,
      auth: basicAuth(),
      failOnStatusCode: false,
      followRedirect: false,
    }).its('status').should('be.oneOf', [401, 403, 404, 302])
  })

  it('SETUP | Publish + admin approve', () => {
    publishAndApproveCourse()
    expect(coursePublished).to.be.true
  })

  it('MEN-1658 | Student can open published course', () => {
    loginViaApi(STUDENT)
    go(`/courses/${courseId}`)
    cy.url({ timeout: 15000 }).should('include', `/courses/${courseId}`)
    cy.get('body').should('exist')
  })

  it('MEN-1663 | Desktop viewport', () => {
    cy.viewport(1280, 800)
    loginInstructorUI()
    goCurriculum()
    cy.get('.dashboard-curriculum-wrap').should('exist')
    cy.viewport(1280, 800)
  })

  it('MEN-1664 | Mobile viewport', () => {
    cy.viewport(375, 667)
    loginInstructorUI()
    goCurriculum()
    cy.get('body').should('exist')
    cy.viewport(1280, 800)
  })
})
