// TC-NEW-009: Student Cannot Access Admin Panel Direct URL
// Priority: CRITICAL | Duration: 45 minutes

import { HTTP_AUTH, STUDENT } from '../../support/users'

describe('TC-NEW-009: Admin Access Prevention', () => {
  const STUDENT_USER = {
    email: 'student@mail.com',
    password: 'Test@1234'
  }

  const AUTH_HEADERS = HTTP_AUTH

  beforeEach(() => {
    cy.visit('https://dev.mentoraeg.com/login', {
      auth: AUTH_HEADERS
    })

    cy.get('input[type="email"]:visible')
      .type(STUDENT_USER.email)

    cy.get('input[id="password"]:visible')
      .type(STUDENT_USER.password)

    cy.get('button[class="btn btn-primary w-50 mx-auto d-block mb-3"]').click()
    cy.url({ timeout: 10000 }).should('include', '/dashboard')
  })

  it('Should prevent student access to admin dashboard via direct URL', () => {
    // Try to access admin dashboard
    cy.visit('https://dev.mentoraeg.com/admin/dashboard', {
      failOnStatusCode: false,
      auth: AUTH_HEADERS
    })

    // Should be redirected away from admin
    cy.url().should('not.include', '/admin/dashboard')
    cy.url().should('include', '/dashboard')
  })

  it('Should not expose admin data to student users', () => {
    // Try to access admin pages
    const adminPages = [
      '/admin/dashboard',
      '/admin/users',
      '/admin/payments',
      '/admin/reports'
    ]

    adminPages.forEach(page => {
      cy.visit(`https://dev.mentoraeg.com${page}`, {
        failOnStatusCode: false,
        auth: AUTH_HEADERS
      })

      // Should not be on admin page
      cy.url().should('not.include', '/admin')
    })
  })

  it('Should show no admin elements in UI', () => {
    cy.visit('https://dev.mentoraeg.com/dashboard', {
      auth: AUTH_HEADERS
    })

    // Admin-only elements should not exist
    cy.get('[class*="admin-menu"]').should('not.exist')
    cy.get('[class*="admin-panel"]').should('not.exist')
    cy.get('a[href*="/admin"]').should('not.exist')
  })
})
