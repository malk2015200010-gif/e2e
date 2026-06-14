// TC-NEW-003: Prevent Duplicate Course Purchase - Simultaneous Clicks
// Priority: CRITICAL | Duration: 45 minutes

import { HTTP_AUTH } from '../../support/users'

describe('TC-NEW-003: Duplicate Purchase Prevention', () => {
  const TEST_USER = {
    email: 'test.dup.purchase@mail.com',
    password: 'Test@1234'
  }

  const AUTH_HEADERS = HTTP_AUTH

  const TEST_COURSE = {
    name: 'JavaScript 101',
    price: 200
  }

  beforeEach(() => {
    cy.visit('https://dev.mentoraeg.com/login', {
      auth: AUTH_HEADERS
    })

    cy.get('input[type="email"]:visible')
      .type(TEST_USER.email)

    cy.get('input[id="password"]:visible')
      .type(TEST_USER.password)

    cy.get('button[class="btn btn-primary w-50 mx-auto d-block mb-3"]').click()
    cy.url({ timeout: 10000 }).should('include', '/dashboard')
  })

  it('Should prevent duplicate purchase on simultaneous clicks', () => {
    cy.visit('https://dev.mentoraeg.com/checkout', {
      auth: AUTH_HEADERS
    })

    // Intercept enrollment
    cy.intercept('POST', '**/api/enrollments/**', {
      statusCode: 201,
      body: {
        success: true,
        enrollmentId: 'enroll-001'
      }
    }).as('enrollment')

    // Intercept payment
    cy.intercept('POST', '**/api/payments/**', {
      statusCode: 200,
      body: {
        success: true,
        transactionId: 'TXN-DUP-001',
        amount: TEST_COURSE.price
      },
      delay: 1000
    }).as('payment')

    const checkoutButton = cy.get('button[class="btn btn-primary w-50 mx-auto d-block mb-3"]')

    // Double click rapidly
    checkoutButton.click()
    cy.wait(100)
    checkoutButton.click()

    cy.wait('@payment', { timeout: 15000 })

    // Verify only one payment processed
    cy.get('@payment.all').then(requests => {
      expect(requests.length).to.equal(1)
    })
  })

  it('Should show error when trying to re-enroll', () => {
    cy.visit('https://dev.mentoraeg.com/checkout', {
      auth: AUTH_HEADERS
    })

    // Verify error message appears
    cy.get('[class*="error"]', { timeout: 5000 })
      .should('be.visible')
      .should('contain', 'already enrolled')
  })
})
