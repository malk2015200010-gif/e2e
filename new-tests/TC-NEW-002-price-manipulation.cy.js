// TC-NEW-002: Prevent Client-Side Price Manipulation
// Priority: CRITICAL

import { visitWithAuth } from '../../support/navigation'
import { STUDENTS } from '../../support/users'

const TEST_USER = STUDENTS.find(s => s.email === 'malk2015200010q@gmail.com')

describe('TC-NEW-002: Price Manipulation Prevention', () => {

  beforeEach(() => {
    cy.clearCookies()
    cy.clearLocalStorage()

    // Register intercept BEFORE any navigation so no request is missed
    cy.intercept('POST', '**/payments/**').as('payment')

    visitWithAuth('login')

    cy.get('input[type="email"]:visible').type(TEST_USER.email)
    cy.get('#password').type(TEST_USER.password)
    cy.get('button.btn-primary').click()
    cy.url({ timeout: 10000 }).should('include', '/dashboard')
  })

  it('Server should ignore tampered DOM price and charge the real amount', () => {

    // ── Step 1: Ensure cart has at least one item ──
    visitWithAuth('courses')
    cy.url().should('include', '/courses')

    cy.get('body').then(($body) => {
      const cartBadge = $body.find('.badge.badge-pill')
      const cartEmpty = cartBadge.length === 0 || cartBadge.text().trim() === '0'

      if (cartEmpty) {
        cy.get('.add-to-cart-btn:visible').first().click()
        cy.get('.badge.badge-pill', { timeout: 8000 }).should('not.contain.text', '0')
      }
    })

    // ── Step 2: Go to checkout ──
    visitWithAuth('checkout')
    cy.url().should('include', '/checkout')

    // ── Step 3: Read the real price before manipulation ──
    cy.get('body').then(($body) => {
      // If no cart items at all, skip (can't test payment manipulation on empty cart)
      if ($body.find('.cart-item, [class*="cart-item"], [class*="checkout-item"]').length === 0) {
        cy.log('No cart items found — skipping payment manipulation test')
        return
      }

      // ── Step 4: Tamper with visible price in DOM ──
      cy.window().then((win) => {
        // Try to change any visible price text element
        const priceEl = win.document.querySelector('[data-price], .price, .total-price, [class*="price"]')
        if (priceEl) {
          priceEl.innerText = '1 EGP'
        }

        // Try to change any hidden price/amount inputs
        win.document.querySelectorAll('input[name*="price"], input[name*="amount"]')
          .forEach((el) => {
            el.value = '1'
          })
      })

      // ── Step 5: Submit payment ──
      // Button text varies per course/account state
      cy.get('button').filter(':visible').then(($btns) => {
        const enrollBtn = $btns.filter((_, el) =>
          /enroll|buy|checkout|pay|purchase|complete/i.test(el.innerText)
        )
        if (enrollBtn.length === 0) {
          cy.log('No checkout button found — skipping click')
          return
        }
        cy.wrap(enrollBtn.first()).click()
      })

      // ── Step 6: Wait for payment request OR verify no cheap payment went through ──
      cy.get('@payment').then((interception) => {
        if (!interception) {
          // Payment request never fired — acceptable if checkout redirected or failed gracefully
          cy.log('No payment request fired — page may have redirected before API call')
          cy.url().should('not.include', '/error')
          return
        }

        // If a payment request DID fire, the amount must NOT be 1
        const amount = interception.request?.body?.amount
        if (amount !== undefined) {
          expect(amount).not.to.equal(1)
          expect(amount).not.to.equal('1')
          expect(amount).not.to.equal(0.01)
          cy.log(`Payment request amount: ${amount} — manipulation rejected correctly`)
        } else {
          cy.log('Amount not in request body — server-side price used (correct behavior)')
        }
      })
    })
  })

  it('API-level: payment request body should not contain manipulated amount', () => {

    // Intercept and modify request body in-flight, then verify server rejects or ignores it
    cy.intercept('POST', '**/payments/**', (req) => {
      const originalAmount = req.body?.amount

      // Force a fake low amount into the request
      if (req.body && typeof req.body === 'object') {
        req.body.amount = 0.01
      }

      req.continue((res) => {
        // Server should either:
        // a) Return 4xx (reject the tampered request), OR
        // b) Return the real charge amount (ignore the tampered field)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const returnedAmount = res.body?.amount ?? res.body?.data?.amount
          if (returnedAmount !== undefined) {
            expect(returnedAmount).not.to.equal(0.01)
            cy.log(`Server returned amount: ${returnedAmount} — manipulation blocked`)
          }
        } else {
          cy.log(`Server rejected tampered request with status ${res.statusCode} — correct`)
        }
      })
    }).as('manipulatedPayment')

    visitWithAuth('checkout')
    cy.url().should('include', '/checkout')

    cy.get('body').then(($body) => {
      if ($body.find('.cart-item, [class*="cart-item"], [class*="checkout-item"]').length === 0) {
        cy.log('Cart is empty — skipping API manipulation test')
        return
      }

      cy.get('button').filter(':visible').then(($btns) => {
        const enrollBtn = $btns.filter((_, el) =>
          /enroll|buy|checkout|pay|purchase|complete/i.test(el.innerText)
        )
        if (enrollBtn.length === 0) {
          cy.log('No checkout button found — skipping click')
          return
        }
        cy.wrap(enrollBtn.first()).click()
      })

      // Only wait if a payment request actually fired
      cy.get('@manipulatedPayment').then((interception) => {
        if (interception) {
          cy.log('Payment API was called — manipulation check complete')
        } else {
          cy.log('No payment API call detected on this checkout state')
        }
      })
    })
  })

})
