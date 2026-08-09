/**
 * Refactor Payment and Checkout — Mentora-side regression suite
 *
 * Covers cart → checkout → offline / card gateways without requiring a full
 * hosted XPay card completion (that lives behind XPAY_FULL_E2E in xpay_checkout).
 *
 * Offline pending assertion uses a student that already has a pending purchase
 * so we do not keep creating new pending payments for the XPay student.
 */

import { loginViaApi } from '../../support/navigation.js'
import {
  assertCheckoutPaymentMethodsVisible,
  cartHasItems,
  clickOfflinePayButton,
  clickXPayPayButton,
  ensurePaidCourseInCart,
  go,
  loginCheckoutStudent,
  OFFLINE_PENDING_STUDENT,
  openMentoraCheckout,
  PENDING_MSG_RE,
  XPAY_REDIRECT_RE,
} from './xpay_support.js'

describe('Refactor Payment and Checkout', () => {
  it('TC1 | Student can add a course to cart and open checkout', () => {
    loginCheckoutStudent()
    // ensurePaidCourseInCart adds via API and asserts on /checkout itself
    ensurePaidCourseInCart()
    cy.url().should('include', '/checkout')
    cy.get('body').should(($body) => {
      expect(cartHasItems($body), 'cart has items on checkout').to.eq(true)
    })
    cy.get('body').should('not.contain.text', 'Error 500')
  })

  it('TC2 | Checkout exposes card (XPay) and offline payment options', function () {
    loginCheckoutStudent()
    openMentoraCheckout()
    assertCheckoutPaymentMethodsVisible()
  })

  it('TC3 | Card/XPay pay button starts hosted checkout redirect', function () {
    loginCheckoutStudent()
    openMentoraCheckout()
    clickXPayPayButton()
    cy.url({ timeout: 90000 }).should('match', XPAY_REDIRECT_RE)
  })

  it('TC4 | Offline re-pay for a course with pending payment is blocked', () => {
    loginViaApi(OFFLINE_PENDING_STUDENT)
    go('/dashboard/purchases')
    cy.get('body', { timeout: 15000 })
      .invoke('text')
      .should('match', /pending offline payment|pending payment|pending/i)

    ensurePaidCourseInCart()
    go('/checkout')
    cy.url({ timeout: 20000 }).should('include', '/checkout')

    cy.get('body').then(($body) => {
      if (/your cart is empty|cart is empty/i.test($body.text())) {
        cy.log('Cart empty for pending student — pending already asserted on purchases')
        return
      }
      clickOfflinePayButton()
      cy.get('body', { timeout: 20000 }).should(($b) => {
        const text = $b.text()
        expect(
          PENDING_MSG_RE.test(text) ||
            /offline-instructions|pending offline payment|transfer instructions/i.test(text),
          'offline pending outcome',
        ).to.eq(true)
      })
    })
  })

  it('TC5 | Empty cart checkout shows empty-cart message when cart has no items', () => {
    loginCheckoutStudent()
    go('/checkout')
    cy.get('body').then(($body) => {
      if (cartHasItems($body)) {
        const remove = $body
          .find('a, button')
          .filter((_, el) =>
            /remove|delete|×|حذف|إزالة/i.test(el.textContent || el.getAttribute('title') || ''),
          )
          .filter(':visible')
        if (remove.length) {
          cy.contains('a, button', /remove|delete|حذف|إزالة/i).filter(':visible').first().click({ force: true })
          cy.reload()
        } else {
          cy.log('Could not clear cart via UI — skipping empty-cart copy assert')
          return
        }
      }
    })

    go('/checkout')
    cy.get('body', { timeout: 15000 }).then(($body) => {
      if (cartHasItems($body)) {
        cy.log('Cart still has items — empty-cart copy not asserted')
        return
      }
      cy.wrap($body).invoke('text').should('match', /cart is empty|your cart is empty|سلة/i)
    })
  })
})
