import { visitWithAuth } from '../../support/navigation'
import { INSTRUCTOR } from '../../support/users'

describe('Instructor Account Page Navigation', () => {

  beforeEach(() => {

    // Clear old session
    cy.clearCookies()
    cy.clearLocalStorage()

    // Login
    visitWithAuth('login')

    cy.get('input[type="email"]:visible')
      .clear()
      .type(INSTRUCTOR.email)

    cy.get('#password')
      .clear()
      .type(INSTRUCTOR.password)

    cy.get('button.btn.btn-primary')
      .click({ force: true })

    // Dashboard loaded
    cy.url().should('include', '/dashboard')

  })

  // =====================================
  // Dashboard
  // =====================================

  it('Open Dashboard page', () => {

    cy.contains(/dashboard/i)
      .click({ force: true })

    cy.url().should('include', '/dashboard')

    cy.contains(/create new course/i)
      .click({ force: true })

    cy.url().should('include', '/courses/new')

    cy.contains(/my courses/i)
      .click({ force: true })

    cy.url().should('include', '/my-courses')

    cy.contains(/earnings/i)
      .click({ force: true })

    cy.url().should('include', '/earning')

    cy.contains(/withdraw/i)
      .click({ force: true })

    cy.url().should('include', '/withdraw')

    cy.contains(/my courses reviews/i)
      .click({ force: true })

    cy.url().should('include', '/my-courses-reviews')

     cy.get('a[href*="courses-has-quiz"]')
    .first()
    .click({ force: true })

    cy.url().should('include', '/courses-has-quiz')

    cy.contains(/assignments/i)
      .click({ force: true })

    cy.url().should('include', '/assignments')

    cy.contains(/discussions/i)
      .click({ force: true })

    cy.url().should('include', '/discussions')

     cy.contains(/enrolled courses/i)
      .click({ force: true })

    cy.url().should('include', '/enrolled')

     cy.contains(/my instalments/i)
      .click({ force: true })

    cy.url().should('include', '/my-instalments')

     cy.contains(/wishlist/i)
      .click({ force: true })

    cy.url().should('include', '/wishlist')

     cy.get('a[href*="reviews-i-wrote"]')
       .first()
       .click({ force: true })

    cy.url().should('include', '/reviews-i-wrote')

     cy.get('a[href*="my-quiz-attempts"]')
       .first()
       .click({ force: true })

    cy.url().should('include', '/my-quiz-attempts')

     cy.contains(/purchase history/i)
      .click({ force: true })

    cy.url().should('include', '/purchases')

     cy.contains(/settings/i)
      .click({ force: true })

    cy.url().should('include', '/settings')

     cy.contains(/log out/i)
      .click({ force: true })

    cy.url().then((url) => { cy.log('Post-logout URL: ' + url); expect(url).to.satisfy((u) => u.includes('/login') || !u.includes('/dashboard')) })

  })

  // =====================================
  // Create New Course
  // =====================================

  it('Open Create New Course page', () => {

    cy.contains(/create new course/i)
      .click({ force: true })

    cy.url().should('include', '/courses/new')



  })

  // =====================================
  // My Courses
  // =====================================

  it('Open My Courses page', () => {

    cy.contains(/my courses/i)
      .click({ force: true })

    cy.url().should('include', '/my-courses')

  })

  // =====================================
  // Earnings
  // =====================================

  it('Open Earnings page', () => {

    cy.contains(/earnings/i)
      .click({ force: true })

    cy.url().should('include', '/earning')

  })

  // =====================================
  // Withdraw
  // =====================================

  it('Open Withdraw page', () => {

    cy.contains(/withdraw/i)
      .click({ force: true })

    cy.url().should('include', '/withdraw')

  })

  // =====================================
  // My Courses Reviews
  // =====================================

  it('Open My Courses Reviews page', () => {

    cy.contains(/my courses reviews/i)
      .click({ force: true })

    cy.url().should('include', '/my-courses-reviews')

  })

  // =====================================
  // Quiz Attempts
  // =====================================

  it('Open Quiz Attempts page', () => {

    cy.get('a[href*="courses-has-quiz"]')
    .first()
    .click({ force: true })

    cy.url().should('include', '/courses-has-quiz')

  })

  // =====================================
  // Assignments
  // =====================================

  it('Open Assignments page', () => {

    cy.contains(/assignments/i)
      .click({ force: true })

    cy.url().should('include', '/assignments')

  })

  // =====================================
  // Discussions
  // =====================================

  it('Open Discussions page', () => {

    cy.contains(/discussions/i)
      .click({ force: true })

    cy.url().should('include', '/discussions')

  })

  // =====================================
  // Enrolled Courses
  // =====================================

  it('Open Enrolled Courses page', () => {

    cy.contains(/enrolled courses/i)
      .click({ force: true })

    cy.url().should('include', '/enrolled')

  })

  // =====================================
  // My Instalments
  // =====================================

  it('Open My Instalments page', () => {

    cy.contains(/my instalments/i)
      .click({ force: true })

    cy.url().should('include', '/my-instalments')

  })

  // =====================================
  // Wishlist
  // =====================================

  it('Open Wishlist page', () => {

    cy.contains(/wishlist/i)
      .click({ force: true })

    cy.url().should('include', '/wishlist')

  })

  // =====================================
  // Reviews
  // =====================================

  it('Open Reviews page', () => {

  cy.get('a[href*="reviews-i-wrote"]')
  .first()
  .click({ force: true })


  cy.url().should('include', '/reviews-i-wrote')

})

  // =====================================
  // My Quiz Attempts
  // =====================================

  it('Open My Quiz Attempts page', () => {

    
  cy.get('a[href*="my-quiz-attempts"]')
    .first()
    .click({ force: true })

  cy.url().should('include', '/my-quiz-attempts')

})

  

  // =====================================
  // Purchase History
  // =====================================

  it('Open Purchase History page', () => {

    cy.contains(/purchase history/i)
      .click({ force: true })

    cy.url().should('include', '/purchase')

  })

  // =====================================
  // Settings
  // =====================================

  it('Open Settings page', () => {

    cy.contains(/settings/i)
      .click({ force: true })

    cy.url().should('include', '/settings')

  })

  // =====================================
  // Logout
  // =====================================

  it('Logout successfully', () => {

    cy.contains(/log out/i)
      .click({ force: true })

    cy.url().then((url) => { cy.log('Post-logout URL: ' + url); expect(url).to.satisfy((u) => u.includes('/login') || !u.includes('/dashboard')) })

  })

})
