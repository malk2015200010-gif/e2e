/**
 * TC-NEW-009: Student cannot access the admin panel via direct URL.
 *
 * Live behavior (probed as student):
 *   GET /admin           → 302 → /dashboard
 *   GET /admin/users     → 302 → /dashboard
 *   GET /admin/payments  → 302 → /dashboard
 *   (Some /admin/* paths 404; those are not a successful admin panel.)
 */

import { STUDENT } from '../../support/users.js'
import { loginAs, go } from './new_tests_support.js'

describe('TC-NEW-009: Admin Access Prevention', () => {
  beforeEach(() => {
    loginAs(STUDENT)
  })

  it('Should prevent student access to admin dashboard via direct URL', () => {
    go('/admin')
    cy.url({ timeout: 20000 }).should('include', '/dashboard')
    cy.url().should('not.match', /\/admin(\/|$)/)
    cy.get('#adminSidebarToggle, .admin-topbar').should('not.exist')
  })

  it('Should not expose admin data to student users', () => {
    const adminPages = ['/admin', '/admin/users', '/admin/payments']

    adminPages.forEach((page) => {
      go(page)
      cy.url({ timeout: 20000 }).should((url) => {
        // Student is redirected away from admin (typically to /dashboard)
        expect(
          url.includes('/dashboard') || url.includes('/login') || !url.includes('/admin'),
          `student denied on ${page} (landed on ${url})`,
        ).to.eq(true)
      })
      cy.get('#adminSidebarToggle, .admin-topbar').should('not.exist')
    })
  })

  it('Should show no admin elements in student UI', () => {
    go('/dashboard')
    cy.get('body', { timeout: 15000 }).should('exist')
    cy.get('[class*="admin-menu"]').should('not.exist')
    cy.get('[class*="admin-panel"]').should('not.exist')
    cy.get('a[href*="/admin"]').should('not.exist')
  })
})
