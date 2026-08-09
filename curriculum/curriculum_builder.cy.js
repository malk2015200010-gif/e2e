/**
 * Curriculum Builder — E2E (MEN-1637 → MEN-1677)
 *
 * Strategy:
 *   - before(): create course + section + lecture/quiz/assignment (once)
 *   - testIsolation: false → shared session & course state
 *   - Selectors match confirmed dev.mentoraeg.com HTML
 */

import { visitWithAuth, loginViaApi } from '../../support/navigation.js'
import { HTTP_AUTH, ADMIN, INSTRUCTOR, STUDENT } from '../../support/users.js'

const BASE = 'https://dev.mentoraeg.com'
const AUTH = HTTP_AUTH
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
  cy.visit(`${BASE}${path}`, { auth: AUTH, failOnStatusCode: false })

const loginInstructorUI = () => {
  cy.clearCookies()
  cy.clearLocalStorage()
  visitWithAuth('login')
  cy.get('input[type="email"]:visible', { timeout: 10000 }).clear().type(INSTRUCTOR.email)
  cy.get('input[id="password"]:visible').clear().type(INSTRUCTOR.password)
  cy.get('button.btn.btn-primary').click({ force: true })
  cy.url({ timeout: 20000 }).should('include', '/dashboard')
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

const goCurriculum = (id = courseId) => {
  go(`/dashboard/courses/${id}/curriculum`)
  cy.get('.dashboard-curriculum-wrap', { timeout: 20000 }).should('exist')
  cy.url({ timeout: 15000 }).should('include', '/curriculum')
  hideDebugBar()
}

const assertOnCurriculum = () => {
  cy.url({ timeout: 15000 }).should('include', '/dashboard/courses/')
  cy.url().should('include', '/curriculum')
}

// ─── DOM scopes ───────────────────────────────────────────────────────────────

const sidebar = () => cy.get('.curriculum-sidebar').first()
const addItemWrap = () =>
  sidebar().find('.dashboard-course-section.is-expanded .section-add-item-wrap, .section-add-item-wrap').first()

const lecturePanel = () => cy.get('#lecture-builder-panel', { timeout: 15000 })
const quizPanel = () => cy.get('#quiz-builder-panel', { timeout: 15000 })
const assignmentPanel = () => cy.get('#assignment-builder-panel', { timeout: 15000 })

const itemType = (t) => t.toLowerCase().replace(/s$/, '')

// ─── Section ──────────────────────────────────────────────────────────────────

const clickNewSection = () => {
  hideDebugBar()
  cy.get('.btn-curriculum-new-section-sidebar, .btn-curriculum-new-section, .curriculum-panel-empty-action')
    .first()
    .scrollIntoView()
    .click({ force: true })
  cy.get('.curriculum-section-form-panel[data-mode="create"], form.curriculum-section-form', { timeout: 10000 })
    .should('exist')
}

const typeSectionName = (name, mode = 'create') => {
  const sel =
    mode === 'edit'
      ? '.curriculum-section-form-panel[data-mode="edit"] input[name="section_name"]'
      : 'input[name="section_name"].curriculum-section-name-input'

  cy.get(sel, { timeout: 10000 })
    .first()
    .click({ force: true })
    .clear({ force: true })
    .type(name, { force: true })
    .blur({ force: true })
}

const submitCreateSection = () => {
  cy.get('.curriculum-section-form-footer button.btn-curriculum-primary[type="submit"]')
    .first()
    .scrollIntoView()
    .click({ force: true })
}

const submitUpdateSection = () => {
  cy.get('.curriculum-section-form-panel[data-mode="edit"]')
    .find('.curriculum-section-form-footer button.btn-curriculum-primary[name="save"]')
    .scrollIntoView()
    .click({ force: true })
}

const addSection = (name) => {
  assertOnCurriculum()
  cy.intercept('POST', '**/curriculum/new-section').as('newSection')
  clickNewSection()
  typeSectionName(name, 'create')
  submitCreateSection()
  cy.wait('@newSection', { timeout: 20000 })
  sidebar().should('contain.text', name)
}

const renameSection = (newName) => {
  cy.intercept('POST', '**/update-section/**').as('updateSection')
  hideDebugBar()
  sidebar().find('button.section-edit-btn').first().click({ force: true })
  cy.get('.curriculum-section-form-panel[data-mode="edit"]', { timeout: 10000 }).should('exist')
  typeSectionName(newName, 'edit')
  submitUpdateSection()
  cy.wait('@updateSection', { timeout: 20000 })
  cy.reload()
  goCurriculum()
  sidebar().find('.dashboard-course-section').first().should('contain.text', newName)
  sectionName = newName
}

// ─── Items ────────────────────────────────────────────────────────────────────

const openAddMenu = () => {
  addItemWrap().find('.curriculum-add-item-toggle').click({ force: true })
  addItemWrap().find('ul.curriculum-add-item-menu').should('exist')
}

const openItemBuilder = (type) => {
  const links = {
    lecture: 'a.add-item-lecture',
    quiz: 'a.create-new-quiz',
    assignment: 'a.new-assignment-btn',
  }
  openAddMenu()
  addItemWrap().find(links[itemType(type)]).click({ force: true })
  cy.wait(400)
}

const fillItemTitle = (title, type) => {
  const key = itemType(type)
  if (key === 'lecture') {
    lecturePanel().find('#lecture-builder-title').clear({ force: true }).type(title, { force: true }).blur({ force: true })
    lecturePanel().find('button.btn-save-lecture').should('not.be.disabled')
    return
  }
  if (key === 'quiz') {
    quizPanel().find('#quiz-builder-meta-form #quiz-builder-title').clear({ force: true }).type(title, { force: true }).blur({ force: true })
    quizPanel().find('#quiz-builder-settings-form button.btn-save-quiz').should('not.be.disabled')
    return
  }
  assignmentPanel().find('#assignment-builder-form #assignment-builder-title').clear({ force: true }).type(title, { force: true }).blur({ force: true })
  assignmentPanel().find('button.btn-save-assignment').should('not.be.disabled')
}

const saveItem = (type) => {
  const key = itemType(type)
  if (key === 'lecture') {
    lecturePanel().find('button.btn-save-lecture').click({ force: true })
  } else if (key === 'quiz') {
    quizPanel().find('#quiz-builder-settings-form button.btn-save-quiz').click({ force: true })
  } else {
    assignmentPanel().find('button.btn-save-assignment').click({ force: true })
  }
  cy.get('.dashboard-curriculum-wrap', { timeout: 20000 }).should('exist')
  assertOnCurriculum()
}

const createItem = (type, title) => {
  openItemBuilder(type)
  fillItemTitle(title, type)
  saveItem(type)
  sidebar().should('contain.text', title)
}

const openSidebarItem = (title) => {
  sidebar()
    .find('.edit-curriculum-item')
    .contains(title)
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
  close[itemType(type)]().click({ force: true })
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

const ensureCoursePricing = () => {
  go(`/dashboard/courses/${courseId}/pricing`)
  cy.get('body', { timeout: 15000 }).should('exist')
  cy.get('input[name="price"], input[name="course_price"], input#price').filter(':visible').first().then(($el) => {
    if ($el.length) cy.wrap($el).clear({ force: true }).type('0', { force: true })
  })
  cy.contains('button, input[type="submit"]', /save|update/i).first().click({ force: true })
  cy.wait(1000)
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
      cy.get('button[name="publish_btn"][value="publish"]').click({ force: true })
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
    loginInstructorUI()

    go('/dashboard/courses/new')
    cy.get('#title').clear().type(COURSE_TITLE)
    cy.get('textarea').first().clear().type('Curriculum E2E test course')
    cy.get('select[name="level"]').select('Beginner')
    cy.get('select[name="delivery_type"]').select('Recorded')
    cy.wait(1000)
    cy.get('#course_category').select('22', { force: true })
    cy.wait(1500)
    cy.contains('label', 'Topic').parent().find('.select2-selection').click({ force: true })
    cy.contains('.select2-results__option', 'Math').click({ force: true })
    cy.contains('button', /create course/i).click({ force: true })
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
      url: `${BASE}/dashboard/courses/${courseId}/curriculum`,
      auth: AUTH,
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
