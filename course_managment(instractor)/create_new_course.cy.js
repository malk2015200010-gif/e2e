import { visitWithAuth } from '../../support/navigation'
import { INSTRUCTOR } from '../../support/users'

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

    cy.get('#course_category')
       .select('22', { force: true })

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
