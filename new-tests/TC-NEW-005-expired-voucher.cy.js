// TC-NEW-005: Expired Voucher Rejection with Clear Message
// Priority: CRITICAL | Duration: 45 minutes

import { HTTP_AUTH } from '../../support/users'

describe('TC-NEW-005: Expired Voucher Rejection', () => {
  const TEST_USER = {
    email: 'test.voucher@mail.com',
    password: 'Test@1234'
  }

  const AUTH_HEADERS = HTTP_AUTH

  const TEST_VOUCHER = {
    code: 'EXPIRED2025',
    expiryDate: '2025-12-31'
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

  it('Should reject expired voucher with clear message', () => {
    cy.visit('https://dev.mentoraeg.com/checkout', {
      auth: AUTH_HEADERS
    })

    // Intercept voucher validation
    cy.intercept('GET', '**/api/vouchers/**', {
      statusCode: 400,
      body: {
        error: 'This voucher has expired'
      }
    }).as('voucherCheck')

    // Find and fill voucher input
    cy.get('input[placeholder*="Voucher"]', { timeout: 5000 })
      .type(TEST_VOUCHER.code)

    cy.get('button:contains("Apply")')
      .click()

    cy.wait('@voucherCheck')

    // Verify error message in English
    cy.get('[class*="error"]', { timeout: 3000 })
      .should('be.visible')
      .should('contain', 'expired')

    // Verify voucher NOT applied
    cy.get('[class*="voucher-applied"]')
      .should('not.exist')
  })
})
