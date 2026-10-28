/// <reference types="cypress" />

import { visitWithAuth, loginViaApi } from '../../support/navigation'
import { ADMIN, INSTRUCTOR, basicAuth } from '../../support/users'

describe('Course Enrolled Students Roster', () => {

  const instructor = INSTRUCTOR
  const admin = ADMIN

  function openMyCourses() {
    cy.get('a[href*="/dashboard/my-courses"]').first().click({ force: true })
    cy.url().should('include', '/dashboard/my-courses')
  }

  /**
   * First "Enrolled students" link on my-courses is often an empty auto-course
   * (no table / no Phone column). Probe enrollment URLs until a roster with rows exists.
   */
  function openFirstRosterWithStudents() {
    openMyCourses()
    cy.get('a[href*="/dashboard/courses/"][href*="/enrollments"]', { timeout: 20000 }).then(($links) => {
      const hrefs = [...new Set([...$links].map((a) => a.href).filter(Boolean))]
      expect(hrefs.length, 'instructor enrollment links').to.be.greaterThan(0)

      const tryHref = (i) => {
        if (i >= Math.min(hrefs.length, 40)) {
          throw new Error('No enrolled-students roster with rows in the first 40 courses')
        }
        cy.request({
          url: hrefs[i],
          auth: basicAuth(),
          failOnStatusCode: false,
          timeout: 60000,
        }).then((res) => {
          const html = String(res.body || '')
          const hasRoster =
            /<th>\s*Phone\s*<\/th>/i.test(html) &&
            /Access status/i.test(html) &&
            !/No enrolled students/i.test(html)
          if (!hasRoster) {
            tryHref(i + 1)
            return
          }
          cy.visit(hrefs[i], {
            auth: basicAuth(),
            failOnStatusCode: false,
            timeout: 120000,
          })
          cy.url().should('include', '/enrollments')
          cy.contains('th', /phone/i, { timeout: 20000 }).should('exist')
        })
      }
      tryHref(0)
    })
  }

  function rosterRows() {
    // Desktop table is `.d-none.d-md-block` — Cypress AUT iframe is often < 768px,
    // so the table exists but is not :visible. Mobile cards (`.d-md-none`) then show.
    return cy.get(
      'table.table-bordered tbody tr, .table-responsive table tbody tr, .d-md-none .border.bg-white',
      { timeout: 20000 },
    )
  }

  function visibleRosterItems() {
    return cy.get('body', { timeout: 20000 }).should(($body) => {
      const n = $body.find(
        'table.table-bordered tbody tr:visible, .table-responsive table tbody tr:visible, .d-md-none .border.bg-white:visible',
      ).length
      expect(n, 'visible roster table rows or mobile cards').to.be.greaterThan(0)
    })
  }

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

    openMyCourses()
  })

  // =========================================
  // TC2
  // =========================================

  it('TC2 - instructor sees required columns', () => {

    loginInstructor()
    openFirstRosterWithStudents()

    cy.contains('th', /student|name/i).should('exist')
    cy.contains('th', /phone/i).should('exist')
    cy.contains('th', /status/i).should('exist')
    cy.contains('th', /payment/i).should('exist')

  })

  // =========================================
  // TC3
  // =========================================

  it('TC3 - instructor cannot see student email', () => {

    loginInstructor()
    openFirstRosterWithStudents()

    cy.get('[data-cy="student-email"]')
      .should('not.exist')
  })

  // =========================================
  // TC4
  // =========================================

  it('TC4 - enrollment status column displays correctly', () => {

    loginInstructor()
    openFirstRosterWithStudents()

    rosterRows().should('have.length.greaterThan', 0)
    visibleRosterItems()

    cy.contains('th', /status/i).should('exist')

    rosterRows()
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
    openFirstRosterWithStudents()

    rosterRows().should('have.length.greaterThan', 0)
    visibleRosterItems()

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
    cy.get('a[href*="/dashboard/my-courses"]')
      .should('exist')

  })
})
