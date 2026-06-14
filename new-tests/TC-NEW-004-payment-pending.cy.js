// TC-NEW-004: Payment Pending Status - Prevent New Purchase
// Priority: CRITICAL | Duration: 45 minutes

import { HTTP_AUTH } from '../../support/users'

describe('TC-NEW-004: Payment Pending Validation', () => {
  const TEST_USER = {
    email: 'test.pending.pay@mail.com',
    password: 'Test@1234'
  }

  const AUTH_HEADERS = HTTP_AUTH

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

  it('Should prevent new purchase while payment is pending', () => {
    cy.visit('https://dev.mentoraeg.com/checkout', {
      auth: AUTH_HEADERS
    })

    // Initiate first payment (will be pending)
    cy.intercept('POST', '**/api/payments/**', {
      statusCode: 200,
      body: {
        success: true,
        status: 'PENDING',
        transactionId: 'TXN-PENDING'
      },
      delay: 5000
    }).as('pendingPayment')

    cy.get('button[class="btn btn-primary w-50 mx-auto d-block mb-3"]').click()

    // Try to add another course while payment pending
    cy.get('[class*="add-to-cart"]')
      .should('be.disabled')

    // Should see error message
    cy.get('[class*="error"]', { timeout: 3000 })
      .should('contain', 'pending payment')
  })
})
