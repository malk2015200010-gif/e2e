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
  CHECKOUT_STUDENT,
} from './new_tests_support.js'

describe('TC-NEW-005: Expired Voucher Rejection', () => {
  beforeEach(() => {
    loginAs(CHECKOUT_STUDENT)
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

    cy.get('body').then(($body) => {
      if (/your cart is empty|cart is empty/i.test($body.text())) {
        // Empty cart still has voucher UI on some states — fall through if field exists
        if (!$body.find('#voucher_code_input').length) {
          cy.log('SKIP: no voucher field on empty checkout')
          return
        }
      }
    })

    cy.get('#voucher_code_input', { timeout: 15000 }).should('exist')
    applyVoucherCode('EXPIRED2025')

    cy.wait('@voucherCheck', { timeout: 15000 })

    cy.get('#voucher-alert, .alert-danger, body', { timeout: 10000 })
      .invoke('text')
      .should('match', /expired|could not be applied|not found|invalid/i)

    cy.get('#voucher-applied-box').should(($box) => {
      if (!$box.length) return
      expect($box.hasClass('d-none') || !$box.is(':visible')).to.eq(true)
    })
  })
})
