/**
 * TC-NEW-005: Expired voucher is rejected with a clear student-facing message.
 *
 * UI: #voucher_code_input + #voucher_apply_btn
 * API: POST /checkout/validate-voucher with JSON { voucher_code }
 */

import {
  loginAs,
  openCheckoutWithCart,
  applyVoucherCode,
  VOUCHER_STUDENT,
} from './new_tests_support.js'

describe('TC-NEW-005: Expired Voucher Rejection', () => {
  beforeEach(() => {
    loginAs(VOUCHER_STUDENT)
  })

  it('Should reject expired voucher with clear message', () => {
    cy.intercept('POST', '**/checkout/validate-voucher', {
      statusCode: 200,
      body: {
        valid: false,
        error_message: 'This voucher has expired',
      },
    }).as('voucherCheck')

    openCheckoutWithCart()

    // Apply writes the stubbed error_message into #voucher-alert and does not open the applied box.
    cy.get('#voucher_code_input', { timeout: 15000 }).should('be.visible')
    applyVoucherCode('EXPIRED2025')

    cy.wait('@voucherCheck', { timeout: 15000 })

    cy.get('#voucher-alert', { timeout: 10000 })
      .should('be.visible')
      .and('not.have.class', 'd-none')
      .invoke('text')
      .should('match', /expired/i)

    cy.get('#voucher-applied-box').should('have.class', 'd-none')
  })
})
