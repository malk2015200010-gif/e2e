/**
 * TC-NEW-004: Payment pending status prevents a new purchase for the same course.
 */

import {
  loginAs,
  openCheckoutWithCart,
  submitOfflineCheckout,
  go,
  PENDING_STUDENT,
  PENDING_MSG_RE,
} from './new_tests_support.js'

describe('TC-NEW-004: Payment Pending Validation', () => {
  beforeEach(() => {
    loginAs(PENDING_STUDENT)
  })

  it('Should prevent new purchase while payment is pending', () => {
    go('/dashboard/purchases')
    cy.get('body', { timeout: 15000 })
      .invoke('text')
      .should('match', /pending offline payment|pending payment|pending/i)

    openCheckoutWithCart()
    submitOfflineCheckout()

    cy.get('body', { timeout: 20000 }).then(($body) => {
      if (PENDING_MSG_RE.test($body.text())) {
        cy.contains(PENDING_MSG_RE).should('be.visible')
        return
      }

      // If first click created/confirmed pending, second attempt must block
      openCheckoutWithCart()
      submitOfflineCheckout()
      cy.contains(PENDING_MSG_RE, { timeout: 20000 }).should('be.visible')
    })
  })
})
