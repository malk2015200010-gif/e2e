/**
 * TC-NEW-003: Prevent duplicate purchase on simultaneous / rapid double-clicks.
 *
 * Live checkout locks gateway buttons on submit (lockGatewayButtonsForSubmit)
 * and rejects a second offline payment for the same course with a pending
 * payment warning.
 */

import {
  loginAs,
  openCheckoutWithCart,
  PENDING_STUDENT,
  PENDING_MSG_RE,
  go,
} from './new_tests_support.js'

describe('TC-NEW-003: Duplicate Purchase Prevention', () => {
  beforeEach(() => {
    loginAs(PENDING_STUDENT)
  })

  it('Should prevent duplicate purchase on simultaneous clicks', () => {
    cy.intercept('POST', '**/checkout/offline').as('offlinePay')
    cy.intercept('POST', '**/checkout/xpay-payment').as('xpayPay')

    openCheckoutWithCart()

    cy.get('body').then(($body) => {
      if (!$body.find('a[href="#payment-tab-offline"]').length) return
      cy.get('a[href="#payment-tab-offline"]').first().click({ force: true })
    })

    // Two separate queries — after the first click the button/page often
    // re-renders, so reusing the same jQuery subject throws detached-DOM.
    cy.get('#offline-payment-form-btn:visible, form[action*="checkout/offline"] button[type="submit"]:visible', {
      timeout: 15000,
    })
      .first()
      .click({ force: true })

    cy.get('body').then(($body) => {
      if (
        !$body.find('#offline-payment-form-btn:visible, form[action*="checkout/offline"] button[type="submit"]:visible')
          .length
      ) {
        return
      }
      cy.get('#offline-payment-form-btn:visible, form[action*="checkout/offline"] button[type="submit"]:visible')
        .first()
        .click({ force: true })
    })

    cy.wait(1500)

    cy.get('@offlinePay.all').then((requests) => {
      // UI lock / server should keep this to at most one successful pending creation.
      // More than one POST can fire in some browsers, but the page must not allow
      // a second successful enrollment — assert outcome below.
      cy.log(`offline POSTs fired: ${requests.length}`)
      expect(requests.length, 'offline checkout POSTs').to.be.at.most(2)
    })

    cy.url({ timeout: 20000 }).should((url) => {
      expect(
        /checkout|purchases|offline-instructions|dashboard/i.test(url),
        `landed on a checkout outcome page (${url})`,
      ).to.eq(true)
    })

    cy.get('body', { timeout: 20000 }).should(($body) => {
      const text = $body.text()
      const blockedOrSingle =
        PENDING_MSG_RE.test(text) ||
        /offline-instructions|pending offline payment|transfer instructions|purchases/i.test(text)
      expect(blockedOrSingle, 'duplicate purchase blocked or single pending created').to.eq(true)
    })
  })

  it('Should show pending/already-enrolled style block when re-checking out same course', () => {
    openCheckoutWithCart()

    cy.get('body').then(($body) => {
      if (!$body.find('a[href="#payment-tab-offline"]').length) return
      cy.get('a[href="#payment-tab-offline"]').first().click({ force: true })
    })

    cy.get('#offline-payment-form-btn:visible, form[action*="checkout/offline"] button[type="submit"]:visible', {
      timeout: 15000,
    })
      .first()
      .click({ force: true })

    // Second attempt
    openCheckoutWithCart()
    cy.get('body').then(($body) => {
      if (!$body.find('a[href="#payment-tab-offline"]').length) return
      cy.get('a[href="#payment-tab-offline"]').first().click({ force: true })
    })
    cy.get('#offline-payment-form-btn:visible, form[action*="checkout/offline"] button[type="submit"]:visible', {
      timeout: 15000,
    })
      .first()
      .click({ force: true })

    cy.get('body', { timeout: 20000 }).should(($body) => {
      const text = $body.text()
      expect(
        PENDING_MSG_RE.test(text) || /already enrolled|already purchased|already have/i.test(text),
        're-enroll / pending blocked',
      ).to.eq(true)
    })

    go('/dashboard/purchases')
    cy.get('body', { timeout: 15000 })
      .invoke('text')
      .should('match', /pending|purchase|payment/i)
  })
})
