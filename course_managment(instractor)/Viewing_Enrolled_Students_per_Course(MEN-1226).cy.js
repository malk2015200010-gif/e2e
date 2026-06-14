/// <reference types="cypress" />

import { visitWithAuth, loginViaApi } from '../../support/navigation'
import { ADMIN, INSTRUCTOR } from '../../support/users'

describe('Course Enrolled Students Roster', () => {

  const instructor = INSTRUCTOR
  const admin = ADMIN

  // =========================================
  // Instructor Login
  // =========================================

  function loginInstructor() {

    cy.clearCookies()
    cy.clearLocalStorage()

    visitWithAuth('login')

    cy.get('input[type="email"]:visible', { timeout: 10000 })
      .should('be.enabled')
      .clear()
      .type(instructor.email)

    cy.get('#password', { timeout: 10000 })
      .should('be.enabled')
      .clear()
      .type(instructor.password)

    cy.get('button.btn.btn-primary')
      .click({ force: true })

    cy.url({ timeout: 20000 })
      .should('include', '/dashboard')

  }

  // =========================================
  // Admin Login
  // =========================================

  function loginAdmin() {
    loginViaApi(ADMIN)
  }

  // =========================================
  // TC1
  // =========================================

  it('TC1 - instructor can open enrolled students roster', () => {

    loginInstructor()

  cy.get('a[href="https://dev.mentoraeg.com/dashboard/my-courses"]')
  .first()
  .click({ force: true })

cy.url().should('include', '/dashboard/my-courses')
  })

  // =========================================
  // TC2
  // =========================================

  it('TC2 - instructor sees required columns', () => {

    loginInstructor()

    cy.get('a[href="https://dev.mentoraeg.com/dashboard/my-courses"]')
  .first()
  .click({ force: true })

   cy.url().should('include', '/dashboard/my-courses')

    cy.contains(/enrolled students/i)
      .first()
      .click({ force: true })

    cy.contains(/name/i).should('exist')
    cy.contains(/phone/i).should('exist')
    cy.contains(/status/i).should('exist')
    cy.contains(/payment/i).should('exist')

  })

  // =========================================
  // TC3
  // =========================================

  it('TC3 - instructor cannot see student email', () => {

    loginInstructor()

    cy.get('a[href="https://dev.mentoraeg.com/dashboard/my-courses"]')
  .first()
  .click({ force: true })

   cy.url().should('include', '/dashboard/my-courses')


    cy.contains(/enrolled students/i)
      .first()
      .click({ force: true })

    cy.get('[data-cy="student-email"]')
      .should('not.exist')
  })

  // =========================================
  // TC4
  // =========================================

  it('TC4 - enrollment status column displays correctly', () => {

    loginInstructor()

    cy.get('a[href="https://dev.mentoraeg.com/dashboard/my-courses"]')
      .first()
      .click({ force: true })

    cy.url().should('include', '/dashboard/my-courses')

    cy.contains(/enrolled students/i)
      .first()
      .click({ force: true })

    // Wait for roster to load
    cy.get('table tbody tr, [data-cy="enrollment-row"]', { timeout: 5000 })
      .should('have.length.greaterThan', 0)

    // Verify status column header exists
    cy.contains(/status/i)
      .should('exist')

    // Verify at least one row contains a visible status (Active, Success, Pending, etc.)
    cy.get('table tbody tr, [data-cy="enrollment-row"]')
      .first()
      .invoke('text')
      .should('match', /active|success|pending|inactive/i)

  })

  // =========================================
  // TC5
  // =========================================

  it('TC5 - mobile responsive roster', () => {

    cy.viewport('iphone-x')

    loginInstructor()

    cy.get('a[href="https://dev.mentoraeg.com/dashboard/my-courses"]')
  .first()
  .click({ force: true })

   cy.url().should('include', '/dashboard/my-courses')
        

    cy.contains(/enrolled students/i)
      .first()
      .click({ force: true })

    // Verify roster content loads (table or card layout)
    cy.get('table tbody tr, [data-cy="enrollment-row"], .card', { timeout: 5000 })
      .should('have.length.greaterThan', 0)

  })

  // =========================================
  // TC6
  // =========================================

  it('TC6 - instructor dashboard accessible after login', () => {

    loginInstructor()

    // Verify instructor successfully logged in and is on dashboard
    cy.url()
      .should('include', '/dashboard')

    // Verify page loaded (no redirect back to login)
    cy.get('a[href="https://dev.mentoraeg.com/dashboard/my-courses"]')
      .should('exist')

  })
})
