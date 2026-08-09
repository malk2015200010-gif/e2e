import './soft_mode.js'

/**
 * Helpers for e2e/new-tests — aligned with live dev.mentoraeg.com behavior.
 */

import { loginViaApi } from '../../support/navigation.js'
import { HTTP_AUTH, STUDENT, STUDENTS } from '../../support/users.js'

export const BASE = 'https://dev.mentoraeg.com'
export const AUTH = HTTP_AUTH

/** Student known to have (or easily create) pending offline payments */
export const PENDING_STUDENT =
  STUDENTS.find((s) => s.email === 'studentbuysession@demo.com') || STUDENT

/** Cleaner student for cart / voucher / price tests */
export const CHECKOUT_STUDENT =
  STUDENTS.find((s) => s.email === 'malk2015200010q@gmail.com') || STUDENT

export const PENDING_MSG_RE =
  /already have a pending payment|pending payment|please wait/i

export const go = (path, opts = {}) =>
  cy.visit(`${BASE}${path.startsWith('/') ? path : `/${path}`}`, {
    auth: AUTH,
    failOnStatusCode: false,
    timeout: 60000,
    ...opts,
  })

export const loginAs = (user) =>
  loginViaApi(user).then(() => {
    go('/dashboard')
    return cy.url({ timeout: 20000 }).should((url) => {
      expect(url).to.satisfy((u) => !u.includes('/login'), `logged in as ${user.email}`)
    })
  })

export const cartHasItems = ($body) => {
  if (/your cart is empty|cart is empty|سلة/i.test($body.text())) return false
  const badge = $body.find('.badge.badge-pill').first()
  return badge.length > 0 && badge.text().trim() !== '0'
}

export const addFirstCourseToCart = () => {
  go('/courses')
  cy.get('body', { timeout: 15000 }).should('exist')
  cy.get('body').then(($body) => {
    if (cartHasItems($body)) {
      cy.log('Cart already has items')
      return
    }

    const courseId =
      $body.find('.add-to-cart-btn[data-course-id]').first().attr('data-course-id') || '423'
    const token =
      ($body.find('input[name="_token"]').val() ||
        $body.find('meta[name="csrf-token"]').attr('content') ||
        '') + ''

    // Prefer the real API — UI add-to-cart clicks are flaky (re-render / overlays).
    cy.request({
      method: 'POST',
      url: `${BASE}/add-to-cart`,
      auth: AUTH,
      form: true,
      failOnStatusCode: false,
      headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' },
      body: { _token: token, course_id: courseId },
    }).then((res) => {
      expect(res.status, 'add-to-cart status').to.be.oneOf([200, 302])
    })
  })
}

export const openCheckoutWithCart = () => {
  addFirstCourseToCart()
  go('/checkout')
  cy.url({ timeout: 20000 }).should('include', '/checkout')
  cy.get('body', { timeout: 15000 }).should(($body) => {
    expect(cartHasItems($body) || /pending payment/i.test($body.text()), 'checkout usable').to.eq(
      true,
    )
  })
}

/** Open offline payment tab if present, then click the offline submit button. */
export const submitOfflineCheckout = () => {
  cy.get('body').then(($body) => {
    if (!$body.find('a[href="#payment-tab-offline"]').length) return
    cy.get('a[href="#payment-tab-offline"]').first().click({ force: true })
  })

  cy.get('#offline-payment-form-btn:visible, form[action*="checkout/offline"] button[type="submit"]:visible', {
    timeout: 15000,
  })
    .first()
    .click({ force: true })
}

export const applyVoucherCode = (code) => {
  cy.get('#voucher_code_input', { timeout: 15000 }).should('be.visible').clear().type(code)
  cy.get('#voucher_apply_btn').click({ force: true })
}
