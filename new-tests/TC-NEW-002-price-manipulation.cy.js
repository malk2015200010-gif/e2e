/**
 * TC-NEW-002: Prevent client-side price manipulation.
 *
 * Live behavior (probed): checkout exposes hidden selected_payment_amount
 * fields, but /checkout/offline ignores a tampered value and charges the
 * server-side course price (e.g. tamper "1" → offline instructions still show
 * the real EGP amount).
 */

import {
  loginAs,
  openCheckoutWithCart,
  submitOfflineCheckout,
  CHECKOUT_STUDENT,
  CHECKOUT_STUDENT_ALT,
} from './new_tests_support.js'

describe('TC-NEW-002: Price Manipulation Prevention', () => {
  beforeEach(() => {
    loginAs(CHECKOUT_STUDENT)
  })

  it('Server should ignore tampered DOM price and charge the real amount', () => {
    openCheckoutWithCart()

    cy.get('#selected_payment_amount', { timeout: 15000 })
      .invoke('val')
      .then((raw) => {
        const serverAmount = Number(String(raw || '0').replace(/,/g, ''))
        expect(serverAmount, 'checkout amount before tamper').to.be.greaterThan(1)
        return serverAmount
      })
      .as('serverAmount')

    // Tamper hidden amount fields and any visible price node
    cy.window().then((win) => {
      win.document
        .querySelectorAll(
          'input[name="selected_payment_amount"], input[name*="price"], input[name*="amount"], #selected_payment_amount',
        )
        .forEach((el) => {
          el.value = '1'
        })

      const priceEl = win.document.querySelector(
        '[data-price], .price, .total-price, [class*="price"]',
      )
      if (priceEl) priceEl.innerText = '1 EGP'
    })

    cy.intercept('POST', '**/checkout/**').as('checkoutPost')
    submitOfflineCheckout()

    cy.get('@serverAmount').then((serverAmount) => {
      cy.get('body', { timeout: 20000 }).should(($body) => {
        const text = $body.text()
        expect(text, 'checkout must not 500').to.not.match(/error 500/i)
        // The DOM was forced to 1. The server total must still be the pre-tamper amount,
        // whether the page shows offline instructions or a pending-payment block.
        const shown = text.match(/EGP\s*[\d,.]+/gi) || []
        const numbers = shown
          .map((a) => Number(a.replace(/egp/i, '').replace(/,/g, '').trim()))
          .filter((n) => Number.isFinite(n))
        expect(
          numbers.some((n) => Math.abs(n - Number(serverAmount)) < 0.01),
          `offline/pending total should stay EGP ${serverAmount}, saw ${shown.slice(0, 6).join(', ') || '(none)'}`,
        ).to.eq(true)
      })
      cy.url().should('not.include', '/error')
    })
  })

  it('API-level: checkout does not accept a manipulated amount as success=true for 0.01', () => {
    // First test may leave CHECKOUT_STUDENT with a pending offline payment.
    loginAs(CHECKOUT_STUDENT_ALT)
    cy.intercept('POST', '**/checkout/**', (req) => {
      if (req.body && typeof req.body === 'object') {
        req.body.selected_payment_amount = '0.01'
        req.body.amount = '0.01'
      } else if (typeof req.body === 'string') {
        req.body = req.body
          .replace(/selected_payment_amount=[^&]*/g, 'selected_payment_amount=0.01')
          .replace(/(^|&)amount=[^&]*/g, '$1amount=0.01')
      }
      req.continue()
    }).as('tamperedCheckout')

    openCheckoutWithCart()
    submitOfflineCheckout()

    cy.wait('@tamperedCheckout', { timeout: 20000 }).then((interception) => {
      const status = interception.response?.statusCode
      const loc = interception.response?.headers?.location || ''
      const body = interception.response?.body

      // Server may 302 to offline-instructions (using real price) or back to checkout
      expect(status, 'checkout response status').to.be.oneOf([200, 302, 422, 400, 403])
      if (body && typeof body === 'object' && body.success === true && body.amount !== undefined) {
        expect(Number(body.amount)).to.not.equal(0.01)
      }
      if (typeof loc === 'string' && loc.length) {
        cy.log(`Checkout redirect: ${loc}`)
      }
    })
  })
})
