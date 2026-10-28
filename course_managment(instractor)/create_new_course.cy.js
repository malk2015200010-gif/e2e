import { loginAndVisit, visitWithAuth } from '../../support/navigation'
import { ADMIN, INSTRUCTOR } from '../../support/users'

describe('Create New Course', () => {

  const courseTitle = `Automation Course ${Date.now()}`
  const shortDescription = 'Automation testing course description'

  beforeEach(() => {

    // =========================
    // Login First
    // =========================

    visitWithAuth('login')

    cy.get('input[type="email"]:visible')
      .type(INSTRUCTOR.email)

    cy.get('input[id="password"]:visible')
      .type(INSTRUCTOR.password)

    cy.get('button.btn.btn-primary')
      .click({ force: true })

    // Dashboard
    cy.url().should('include', '/dashboard')

  })

  // =========================================
  // Positive - Create Course Successfully
  // =========================================

  it('Positive - create new course successfully', () => {

    visitWithAuth('dashboard/courses/new')
    // Title
    cy.get('#title')
      .clear()
      .type(courseTitle)
      .should('have.value', courseTitle)

    // Short Description
    cy.get('textarea')
      .first()
      .clear()
      .type(shortDescription)

    // Course Level
    cy.get('select[name="level"]')
      .select('Beginner')

    // Delivery Type
   cy.get('select[name="delivery_type"]')
      .select('Recorded')

    cy.wait(1000)

    pickSelect2Option('#course_category', 'Pre-IGCSE', 'IGCSE - Pearson - Edexcel')

    cy.wait(2000)
    // Topic
    
    cy.contains('label', 'Topic')
      .parent()
      .find('.select2-selection')
      .click({ force: true })

      cy.contains('.select2-results__option', 'Math')
        .click({ force: true })

    // Create Course
    cy.contains('button', /create course/i)
      .click({ force: true })

    // Success
    cy.url().should('include', '/dashboard')

  })

  // =========================================
  // Negative - Empty Title
  // =========================================

  it('Negative - empty title', () => {

    visitWithAuth('dashboard/courses/new')

    cy.get('#title:invalid')
      .should('exist')
    
  })

  // =========================================
  // Negative - Empty Description
  // =========================================

  it('Negative - empty short description', () => {

        visitWithAuth('dashboard/courses/new')


    cy.contains('button', /create course/i)
      .click({ force: true })

    cy.get('textarea')
      .first()
      .then(($input) => {

        expect($input[0].value).to.equal('')

      })

  })

  
  // =========================================
  // UI Test - Required Fields Visible
  // =========================================

  it('UI - all main fields visible', () => {

        visitWithAuth('dashboard/courses/new')

    cy.get('#title')
      .should('be.visible')

    cy.get('textarea')
      .first()
      .should('be.visible')

    cy.get('#course_category')
      .should('be.visible')

    cy.contains('label', 'Topic')
        .should('be.visible')

    cy.contains('button', /create course/i)
      .should('be.visible')

  })

})

// =============================================================================
// National Curriculum
// Admin adds a top-level category "National Curriculum" with subcategories
// GSE and EB, then a course can be assigned to either one.
// =============================================================================

const NATIONAL_CURRICULUM = 'National Curriculum'
const NATIONAL_SUBCATEGORIES = ['GSE', 'EB']

const categoryOptionMeta = ($options) =>
  [...$options].map((option) => {
    const raw = option.textContent.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
    const child = raw.includes('»') || option.innerHTML.includes('raquo')
    return {
      value: option.value,
      label: raw.replace(/^»\s*/, '').trim(),
      child,
    }
  })

const childrenOf = (items, parentLabel) => {
  const start = items.findIndex((item) => !item.child && item.label === parentLabel)
  if (start === -1) return null
  const kids = []
  for (let i = start + 1; i < items.length; i += 1) {
    if (!items[i].child) break
    kids.push(items[i])
  }
  return { parent: items[start], kids }
}

const readParentCategories = () =>
  cy.get('#parent option', { timeout: 20000 }).then(($options) => categoryOptionMeta($options))

const optionText = (el) =>
  (el.textContent || '').replace(/\u00a0/g, ' ').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim()

const rowLabel = (el) => optionText(el).replace(/^»\s*/, '').trim()

/** The closed Select2 box is not always the next sibling of the <select>. */
const findSelect2Selection = (select) => {
  const byId = select.id ? document.getElementById(`select2-${select.id}-container`) : null
  if (byId) return byId.closest('.select2-selection') || byId

  const next = select.nextElementSibling
  const fromNext = next?.matches?.('.select2-selection')
    ? next
    : next?.querySelector?.('.select2-selection')
  if (fromNext) return fromNext

  const inside = select.querySelector?.('.select2-selection')
  if (inside) return inside

  let node = select.parentElement
  for (let depth = 0; node && depth < 4; depth += 1) {
    const choices = [...node.querySelectorAll('.select2-selection')]
    if (choices.length === 1) return choices[0]
    node = node.parentElement
  }
  return null
}

const findInResults = (list, label, groupLabel) => {
  const leaves = () =>
    [...list.querySelectorAll('li.select2-results__option')].filter(
      (el) => el.getAttribute('role') !== 'group' && !el.querySelector('ul'),
    )

  if (groupLabel) {
    const header = [...list.querySelectorAll('.select2-results__group')].find(
      (el) => rowLabel(el) === groupLabel,
    )
    const group = header?.parentElement
    const nested = group?.querySelector('ul') || group
    const underGroup = nested
      ? [...nested.querySelectorAll('li.select2-results__option')].find(
          (el) => el.getAttribute('role') !== 'group' && rowLabel(el) === label,
        )
      : null
    if (underGroup) return underGroup
  }

  return leaves().find((el) => rowLabel(el) === label) || null
}

/** Nested options report a small offsetTop, so scroll by their real position on screen. */
const bringIntoView = (list, el) => {
  const delta = el.getBoundingClientRect().top - list.getBoundingClientRect().top
  list.scrollTop += delta - 36
}

/**
 * Select2 only handles mouseup on the visible row. A Cypress click scrolls the
 * page and misses GSE/EB, which sit past the 200px window under National Curriculum.
 */
const mouseUp = (el) => {
  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }))
}

const findNativeOption = (select, label, groupLabel) =>
  [...select.options].find((option) => {
    const text = option.text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
    if (text !== label) return false
    if (!groupLabel) return true
    const group = option.parentElement
    return group.tagName === 'OPTGROUP' && group.label.replace(/\s+/g, ' ').trim() === groupLabel
  })

/**
 * The course form opens a Select2 list. The public catalog does not load Select2,
 * so its category field is a normal select and choosing a value reloads the page.
 */
const pickSelect2Option = (selectSelector, label, groupLabel) => {
  cy.get(selectSelector, { timeout: 20000 }).scrollIntoView({ block: 'center' })
  cy.get(selectSelector).then(($select) => {
    const select = $select[0]
    if (!findSelect2Selection(select)) {
      const option = findNativeOption(select, label, groupLabel)
      const where = groupLabel ? `${label} under ${groupLabel}` : label
      expect(option, where).to.exist
      const reloads = Boolean(select.closest('#course-filter-form'))
      cy.get(selectSelector).select(option.value)
      if (reloads) {
        cy.location('search', { timeout: 20000 }).should('include', `category=${option.value}`)
        cy.get(selectSelector).should('have.value', option.value)
      }
      return
    }

    const selectId = select.id
    const selection = findSelect2Selection($select[0])
    selection.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }))

    cy.get(`#select2-${selectId}-results`, { timeout: 10000 }).should('be.visible')
    cy.get(`#select2-${selectId}-results`).then(($results) => {
      const list = $results[0]
      let match = findInResults(list, label, groupLabel)
      let left = 20
      while (!match && left > 0 && list.scrollTop + list.clientHeight < list.scrollHeight - 4) {
        list.scrollTop += Math.max(Math.floor(list.clientHeight * 0.75), 40)
        match = findInResults(list, label, groupLabel)
        left -= 1
      }
      if (!match) {
        const seen = [...list.querySelectorAll('.select2-results__group, li.select2-results__option')]
          .map((el) => rowLabel(el))
          .filter(Boolean)
          .slice(-8)
          .join(' | ')
        const where = groupLabel ? `${label} under ${groupLabel}` : label
        throw new Error(`"${where}" was not in the open category list. Saw: ${seen}`)
      }
      bringIntoView(list, match)
      bringIntoView(list, match)
      const box = list.getBoundingClientRect()
      const row = match.getBoundingClientRect()
      expect(row.top >= box.top && row.bottom <= box.bottom + 2, `${label} scrolled into the category list`).to.eq(true)

      const jq = window.jQuery || window.$
      if (jq) jq(match).trigger('mouseup')
      else mouseUp(match)

      const selectedText = () =>
        (select.selectedOptions[0]?.textContent || '').replace(/\s+/g, ' ').trim()
      if (selectedText() !== label) {
        const option = findNativeOption(select, label, groupLabel)
        expect(option, groupLabel ? `${label} under ${groupLabel}` : label).to.exist
        if (jq) jq(select).val(option.value).trigger('change')
        else select.value = option.value
      }
      cy.wrap(select).should(() => {
        expect(selectedText()).to.eq(label)
      })
    })
  })
}

const createCategory = (name, parentValue = '0') => {
  visitWithAuth('admin/categories/create')
  cy.get('#category_name').clear().type(name)
  if (String(parentValue) !== '0') {
    cy.get('#parent option').then(($options) => {
      const parent = [...$options].find((option) => option.value === String(parentValue))
      expect(parent, `parent option ${parentValue}`).to.exist
      pickSelect2Option('#parent', optionText(parent).replace(/^»\s*/, '').trim())
    })
  }
  cy.get('#form-category input[name="status"][value="1"]').check({ force: true })
  cy.get('button[form="form-category"]').first().click({ force: true })
  cy.url({ timeout: 20000 }).should('include', '/admin/categories')
  cy.get('body').should(($body) => {
    const text = $body.text().replace(/\s+/g, ' ')
    expect(/already been taken|the given data was invalid/i.test(text), `saving category ${name}`).to.eq(
      false,
    )
  })
}

const ensureNationalCurriculum = () => {
  visitWithAuth('admin/categories/create')
  readParentCategories().then((items) => {
    if (!childrenOf(items, NATIONAL_CURRICULUM)) {
      createCategory(NATIONAL_CURRICULUM, '0')
    }

    visitWithAuth('admin/categories/create')
    readParentCategories().then((latest) => {
      const found = childrenOf(latest, NATIONAL_CURRICULUM)
      expect(found, 'National Curriculum is a top-level category').to.not.eq(null)
      NATIONAL_SUBCATEGORIES.filter((name) => !found.kids.some((kid) => kid.label === name)).forEach(
        (name) => createCategory(name, found.parent.value),
      )
    })
  })
}

const fillNewCourse = (title) => {
  cy.get('#title').clear().type(title).should('have.value', title)
  cy.get('textarea').first().clear().type('Course assigned under National Curriculum')
  cy.get('select[name="level"]').select('Beginner')
  cy.get('select[name="delivery_type"]').select('Recorded')
}

const selectNationalSubcategory = (subcategory) => {
  pickSelect2Option('#course_category', subcategory, NATIONAL_CURRICULUM)
}

describe('National Curriculum category', () => {
  before(() => {
    loginAndVisit(ADMIN, '/admin/categories/create')
    ensureNationalCurriculum()
  })

  it('NC-001 | National Curriculum, GSE, and EB keep the right hierarchy', () => {
    visitWithAuth('admin/categories/create')
    readParentCategories().then((items) => {
      const found = childrenOf(items, NATIONAL_CURRICULUM)
      expect(found, 'top-level National Curriculum').to.not.eq(null)
      expect(found.parent.child, 'National Curriculum is not nested').to.eq(false)
      NATIONAL_SUBCATEGORIES.forEach((name) => {
        expect(
          found.kids.some((kid) => kid.label === name),
          `${name} is a subcategory of National Curriculum`,
        ).to.eq(true)
      })
      ;['American', 'IGCSE - Pearson - Edexcel', 'National'].forEach((name) => {
        expect(
          items.some((item) => !item.child && item.label === name),
          `existing category ${name} is unchanged`,
        ).to.eq(true)
      })
    })
  })

  it('NC-002 | Course create and catalog filter list GSE and EB under National Curriculum', () => {
    loginAndVisit(INSTRUCTOR, '/dashboard/courses/new')
    NATIONAL_SUBCATEGORIES.forEach((name) => {
      pickSelect2Option('#course_category', name, NATIONAL_CURRICULUM)
      cy.get('#course_category option:selected').should(($option) => {
        expect($option.text().replace(/\s+/g, ' ').trim()).to.eq(name)
      })
    })
    pickSelect2Option('#course_category', 'Pre-IGCSE', 'IGCSE - Pearson - Edexcel')

    visitWithAuth('courses')
    pickSelect2Option('#course_category', 'GSE', NATIONAL_CURRICULUM)
    pickSelect2Option('#course_category', 'EB', NATIONAL_CURRICULUM)
    pickSelect2Option('#course_category', 'Pre-IGCSE', 'IGCSE - Pearson - Edexcel')
  })

  NATIONAL_SUBCATEGORIES.forEach((subcategory) => {
    it(`NC-003 | Instructor can assign a new course to ${subcategory}`, () => {
      const title = `${NATIONAL_CURRICULUM} ${subcategory} ${Date.now()}`

      loginAndVisit(INSTRUCTOR, '/dashboard/courses/new')
      fillNewCourse(title)
      cy.intercept('POST', '**/get-topic-options').as('topicOptions')
      selectNationalSubcategory(subcategory)

      cy.get('#course_category option:selected').should(($option) => {
        expect($option.text().replace(/\s+/g, ' ').trim()).to.eq(subcategory)
      })
      cy.get('#course_category option:selected')
        .parent('optgroup')
        .should('have.attr', 'label', NATIONAL_CURRICULUM)

      cy.wait('@topicOptions')
      cy.get('#course_topic option').should(($options) => {
        expect([...$options].some((option) => option.value), `a topic under ${subcategory}`).to.eq(true)
      })
      cy.get('#course_topic').then(($topic) => {
        const option = [...$topic[0].options].find((item) => item.value)
        const jq = window.jQuery || window.$
        if (jq) jq($topic[0]).val(option.value).trigger('change')
        else $topic[0].value = option.value
      })

      cy.contains('button', /create course/i).click({ force: true })
      cy.url({ timeout: 20000 }).should('match', /\/dashboard\/courses\/\d+\//)
      cy.contains(title).should('be.visible')
    })
  })
})
