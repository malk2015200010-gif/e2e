/**
 * TC-NEW-001: Prevent creating a second payment while another payment is pending.
 *
 * Live behavior (probed): submitting offline checkout again for a course that
 * already has a pending offline payment redirects back to /checkout with:
 *   "You already have a pending payment for … Please wait …"
 */

import {
  loginAs,
  openCheckoutWithCart,
  submitOfflineCheckout,
  PENDING_STUDENT,
  PENDING_MSG_RE,
} from './new_tests_support.js'

describe('TC-NEW-001: Prevent Duplicate Payment When Pending Payment Exists', () => {
  beforeEach(() => {
    loginAs(PENDING_STUDENT)
  })

  it('Should prevent creating a second payment while another payment is pending', () => {
    openCheckoutWithCart()
    submitOfflineCheckout()

    // First submit may create a pending purchase OR immediately show the block
    // if one already exists for that course. Either way, a second attempt must
    // surface the pending-payment warning.
    cy.get('body', { timeout: 20000 }).then(($body) => {
      if (PENDING_MSG_RE.test($body.text())) {
        cy.contains(PENDING_MSG_RE).should('be.visible')
        cy.contains(/please wait/i).should('be.visible')
        return
      }

      // First attempt succeeded → try again for the same course
      openCheckoutWithCart()
      submitOfflineCheckout()
      cy.contains(PENDING_MSG_RE, { timeout: 20000 }).should('be.visible')
      cy.contains(/please wait/i).should('be.visible')
    })
  })
})
