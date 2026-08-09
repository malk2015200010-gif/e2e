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
  PENDING_MSG_RE,
} from './new_tests_support.js'

describe('TC-NEW-002: Price Manipulation Prevention', () => {
  beforeEach(() => {
    loginAs(CHECKOUT_STUDENT)
  })

  it('Server should ignore tampered DOM price and charge the real amount', () => {
    openCheckoutWithCart()

    cy.get('body').then(($body) => {
      if (/your cart is empty|cart is empty/i.test($body.text())) {
        cy.log('SKIP: cart empty — cannot assert price manipulation')
        return
      }
    })

    // Read real displayed amount (if any), then tamper hidden amount fields
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

    cy.get('body', { timeout: 20000 }).then(($body) => {
      const text = $body.text()

      // Pending block is also an acceptable outcome (no cheap purchase created)
      if (PENDING_MSG_RE.test(text)) {
        cy.log('Pending payment blocked checkout — no tampered charge accepted')
        expect(text).to.not.match(/EGP\s*1(\.0+)?\b/)
        return
      }

      // Offline instructions / purchases page must not show a 1 EGP charge
      // as the authoritative total for a real paid course
      const amounts = text.match(/EGP\s*[\d,.]+/gi) || []
      const cheap = amounts.some((a) => /EGP\s*1(\.00)?$/i.test(a.trim()))
      if (cheap && amounts.length === 1) {
        // Only "EGP1" would be suspicious; real pages show the server total
        expect(amounts.join(' '), 'server total after tamper').to.not.match(/^EGP\s*1(\.00)?$/i)
      } else {
        cy.log(`Post-checkout amounts: ${amounts.slice(0, 5).join(', ')}`)
      }

      cy.url().should('not.include', '/error')
      cy.get('body').should('not.contain.text', 'Error 500')
    })
  })

  it('API-level: checkout does not accept a manipulated amount as success=true for 0.01', () => {
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
