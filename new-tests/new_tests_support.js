import './soft_mode.js'

/**
 * Helpers for e2e/new-tests — aligned with live dev.mentoraeg.com behavior.
 * Cart add / empty-cart detection is shared with payment/xpay_support.js.
 */

import { loginAndVisit } from '../../support/navigation.js'
import { HTTP_AUTH, STUDENT, STUDENTS } from '../../support/users.js'
import {
  BASE,
  addPaidCourseToCart,
  cartHasItems,
  go,
} from '../payment/xpay_support.js'

export { BASE, addPaidCourseToCart, cartHasItems, go }
export const AUTH = HTTP_AUTH

/** Student known to have (or easily create) pending offline payments */
export const PENDING_STUDENT =
  STUDENTS.find((s) => s.email === 'studentbuysession@demo.com') || STUDENT

/**
 * Cart / voucher / price student.
 * malk2015200010d is soft-deleted and /checkout bounces to /login.
 * student5 can open checkout; keep the XPay card student (…j) out of these specs.
 */
export const CHECKOUT_STUDENT =
  STUDENTS.find((s) => s.email === 'student5@demo.com') ||
  STUDENTS.find((s) => s.email === 'malk2015200010j@gmail.com') ||
  STUDENT

/** Second checkout account so a spec can submit offline twice without the first pending payment blocking the next. */
export const CHECKOUT_STUDENT_ALT =
  STUDENTS.find((s) => s.email === 'studentbuysession@demo.com') || CHECKOUT_STUDENT

/**
 * Voucher specs only stub validate-voucher — they must not share an account that
 * TC-NEW-002 leaves with a pending offline payment. This account is not used to pay.
 */
export const VOUCHER_STUDENT =
  STUDENTS.find((s) => s.email === 'malk2015200010j@gmail.com') || CHECKOUT_STUDENT

export const PENDING_MSG_RE =
  /already have a pending payment|pending payment|please wait/i

export const loginAs = (user) => loginAndVisit(user, '/dashboard')

export const addFirstCourseToCart = (courseId) => addPaidCourseToCart(courseId)

export const openCheckoutWithCart = () => {
  addPaidCourseToCart()
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
