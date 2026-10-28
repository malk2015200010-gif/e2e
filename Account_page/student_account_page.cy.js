import { loginAndVisit } from '../../support/navigation'
import { STUDENT } from '../../support/users'


describe('Student Account Page Navigation', () => {

  beforeEach(() => {
    loginAndVisit(STUDENT, '/dashboard')
  })

  // =====================================
  // Dashboard
  // =====================================

  it('Open Dashboard page', () => {

    cy.get('a[href*="dashboard"]')
      .first()
      .click({ force: true })


    cy.url().should('include', '/dashboard')

    cy.get('a[href*="enrolled-courses"]')
      .first()
      .click({ force: true })

    cy.url().should('include', '/enrolled-courses')

    cy.get('a[href*="my-schedule"]')
      .first()
      .click({ force: true })

    cy.url().should('include', '/my-schedule')

    cy.get('a[href*="my-instalments"]')
      .first()
      .click({ force: true })

    cy.url().should('include', '/my-instalments')

     cy.get('a[href*="wishlist"]')
       .first()
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

    cy.get('a[href*="settings"]')
      .first()
      .click({ force: true })

    cy.url().should('include', '/settings') 


    cy.get('a[href*="logout"]')
      .first()
      .click({ force: true })

    cy.url().then((url) => { cy.log('Post-logout URL: ' + url); expect(url).to.satisfy((u) => u.includes('/login') || !u.includes('/dashboard')) })



  })

  // =====================================
  // enrolled-courses
  // =====================================

  it('Open enrolled-courses page', () => {

    cy.get('a[href*="enrolled-courses"]')
      .first()
      .click({ force: true })

    cy.url().should('include', '/enrolled-courses')

  })

  // =====================================
  // My Schedule
  // =====================================

  it('Open My Schedule page', () => {

    cy.get('a[href*="my-schedule"]')
      .first()
      .click({ force: true })

    cy.url().should('include', '/my-schedule')

  })

  
  // =====================================
  // My Instalments
  // =====================================

  it('Open My Instalments page', () => {

    cy.get('a[href*="my-instalments"]')
      .first()
      .click({ force: true })

    cy.url().should('include', '/my-instalments')

  })

  // =====================================
  // Wishlist
  // =====================================

  it('Open Wishlist page', () => {

    cy.get('a[href*="wishlist"]')
      .first()
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
