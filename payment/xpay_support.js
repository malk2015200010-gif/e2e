import './soft_mode.js'

/**
 * Payment / XPay helpers for Mentora checkout (dev.mentoraeg.com)
 *
 * Mentora-side flows are the default for CI / "run all specs".
 * Full hosted-card E2E on checkout.xpay.app only runs when
 * Cypress.env('XPAY_FULL_E2E') is set.
 *
 * Test cards (XPay test mode only — used by optional full E2E):
 *   NBE Mastercard EGP  — 5123 4500 0000 0008
 *   Banque Misr Visa    — 4508 7500 1574 1019
 *   International MC USD — 2223 0000 0000 0007
 *
 * Expiry: 01/39 APPROVED | 05/39 DECLINED | 01/27 INSUFFICIENT_FUNDS
 * CVV: 100 MATCH
 */

import { loginViaApi } from '../../support/navigation.js'
import { HTTP_AUTH, STUDENTS } from '../../support/users.js'

export const BASE = 'https://dev.mentoraeg.com'
export const AUTH = HTTP_AUTH

/** Student without pending offline payments (probed on live). */
export const XPAY_CHECKOUT_STUDENT =
  STUDENTS.find(
    (s) => s.email === (Cypress.env('XPAY_STUDENT_EMAIL') || 'malk2015200010j@gmail.com'),
  ) ||
  STUDENTS.find((s) => s.email === 'malk2015200010b@gmail.com') ||
  STUDENTS[0]

/** Student that already has pending offline payments — for offline/pending assertions. */
export const OFFLINE_PENDING_STUDENT =
  STUDENTS.find((s) => s.email === 'studentbuysession@demo.com') ||
  STUDENTS.find((s) => s.email === 'malk2015200010q@gmail.com') ||
  XPAY_CHECKOUT_STUDENT

/** Paid non-PPS-style course that yields amount > 0 without session picks (probed). */
export const PREFERRED_COURSE_ID = String(Cypress.env('XPAY_COURSE_ID') || '423')

export const XPAY_ORIGIN = 'https://checkout.xpay.app'
export const XPAY_REDIRECT_RE = /checkout\.xpay\.app|xpaycheckout\.com/i

export const PENDING_MSG_RE =
  /already have a pending payment|pending payment|please wait/i

/** Suppress cookie-consent bar so it cannot intercept cart/checkout clicks. */
const suppressCookieConsentBar = () => {
  cy.setCookie('mentora_analytics_consent', 'granted', { domain: 'dev.mentoraeg.com' })
}

export const go = (path, opts = {}) => {
  suppressCookieConsentBar()
  return cy.visit(`${BASE}${path.startsWith('/') ? path : `/${path}`}`, {
    auth: AUTH,
    failOnStatusCode: false,
    timeout: 60000,
    ...opts,
  })
}

export const loginCheckoutStudent = (user = XPAY_CHECKOUT_STUDENT) =>
  loginViaApi(user).then(() => {
    go('/dashboard')
    return cy.url({ timeout: 20000 }).should((url) => {
      expect(url).to.satisfy((u) => !u.includes('/login'), `logged in as ${user.email}`)
    })
  })

export const XPAY_CARDS = {
  nbeMastercardEGP: { number: '5123450000000008', label: '5123 4500 0000 0008', currency: 'EGP' },
  banqueMisrVisaEGP: { number: '4508750015741019', label: '4508 7500 1574 1019', currency: 'EGP' },
  caeMastercardEGP: { number: '5111111111111118', label: '5111 1111 1111 1118', currency: 'EGP' },
  internationalMastercardUSD: {
    number: '2223000000000007',
    label: '2223 0000 0000 0007',
    currency: 'USD',
  },
}

export const XPAY_EXPIRY = {
  approved: '01/39',
  declined: '05/39',
  insufficientFunds: '01/27',
  expiredCard: '04/27',
  timedOut: '08/28',
  acquirerSystemError: '01/37',
  unspecifiedFailure: '02/37',
  unknown: '05/37',
}

export const XPAY_CVV = {
  match: '100',
  notProcessed: '101',
  noMatch: '102',
}

export const isXPayReactHydrationError = (message = '') =>
  /Minified React error #418|react\.dev\/errors\/418|Hydration failed/i.test(message)

export const cartHasItems = ($body) => {
  // Prefer the explicit empty-cart copy on checkout — Debugbar/other UI can
  // contain incidental "cart"/"badge" noise that is not a real cart item.
  if (/your cart is empty|cart is empty|سلة.*فارغ/i.test($body.text())) return false
  if ($body.find('#selected_payment_amount').length) {
    const amt = Number(String($body.find('#selected_payment_amount').val() || '0').replace(/,/g, ''))
    if (amt > 0) return true
  }
  if ($body.find('.cart-item, [class*="cart-item"], [class*="checkout-item"], .gateway-payment-form').length) {
    return true
  }
  const badge = $body.find('#miniCartDropDown .badge.badge-pill, .mini-cart .badge.badge-pill').first()
  if (!badge.length) return false
  const n = badge.text().trim()
  return n !== '' && n !== '0'
}

export const clearCart = () => {
  go('/checkout')
  cy.get('body').then(($body) => {
    const hasRemove = $body
      .find('a, button')
      .filter((_, el) => /remove|delete|×|حذف|إزالة/i.test(el.textContent || el.getAttribute('title') || ''))
      .filter(':visible').length
    if (!hasRemove) return
    cy.contains('a, button', /remove|delete|حذف|إزالة/i).filter(':visible').first().click({ force: true })
  })
  // Best-effort server clear
  cy.request({
    method: 'POST',
    url: `${BASE}/remove-cart`,
    auth: AUTH,
    form: true,
    failOnStatusCode: false,
    body: {},
  })
}

/**
 * Add preferred paid course via the real /add-to-cart API (same endpoint the
 * UI button hits). UI clicks are flaky here: cookie bar / re-render / single
 * visible add-to-cart button often leave checkout empty even when the badge
 * assertion appeared to pass.
 */
export const ensurePaidCourseInCart = () => {
  go('/courses')
  cy.get('body', { timeout: 15000 }).should('exist')

  cy.get('body').then(($body) => {
    if (cartHasItems($body)) {
      cy.log('Cart already has items')
      return
    }

    const token =
      ($body.find('input[name="_token"]').val() ||
        $body.find('meta[name="csrf-token"]').attr('content') ||
        '') + ''

    cy.request({
      method: 'POST',
      url: `${BASE}/add-to-cart`,
      auth: AUTH,
      form: true,
      failOnStatusCode: false,
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json',
      },
      body: {
        _token: token,
        course_id: PREFERRED_COURSE_ID,
      },
    }).then((res) => {
      expect(res.status, 'add-to-cart status').to.be.oneOf([200, 302])
      if (res.body && typeof res.body === 'object') {
        expect(res.body.success, 'add-to-cart success').to.eq(1)
      }
    })
  })

  // Confirm on checkout itself (source of truth), not a nav badge alone.
  go('/checkout')
  cy.url({ timeout: 20000 }).should('include', '/checkout')
  cy.get('body', { timeout: 15000 }).should(($body) => {
    expect(cartHasItems($body), 'cart has items after add-to-cart').to.eq(true)
  })
}

/** Select first available live-session checkbox if PPS UI is present (amount was 0). */
export const selectSessionsIfNeeded = () => {
  cy.get('body').then(($body) => {
    const amount = Number(
      ($body.find('#selected_payment_amount').val() ||
        $body.find('input[name="selected_payment_amount"]').first().val() ||
        '0').toString().replace(/,/g, ''),
    )
    if (amount > 0) return

    const boxes = $body.find('input.session-checkbox, input[type="checkbox"][name*="session"]').filter(':visible')
    if (boxes.length) {
      cy.wrap(boxes.first()).check({ force: true })
      cy.wait(500)
    }

    // Fallback payment-type radios
    const full = $body
      .find('input[type="radio"]')
      .filter((_, el) => /full|course|complete/i.test(el.value + (el.closest('label')?.textContent || '')))
      .filter(':visible')
      .first()
    if (full.length) cy.wrap(full).check({ force: true })
  })
}

export const openMentoraCheckout = function () {
  ensurePaidCourseInCart()
  go('/checkout')
  cy.url({ timeout: 20000 }).should('include', '/checkout')

  cy.get('body', { timeout: 15000 }).then(function ($body) {
    if (!cartHasItems($body)) {
      cy.log('SKIP: checkout cart is empty — set CYPRESS_XPAY_COURSE_ID to a paid course')
      this.skip()
    }
    if (PENDING_MSG_RE.test($body.text())) {
      cy.log('SKIP: student has pending payment on checkout — use a clean account')
      this.skip()
    }
  })

  selectSessionsIfNeeded()
}

export const assertCheckoutPaymentMethodsVisible = () => {
  cy.get('body', { timeout: 15000 }).should(($body) => {
    const html = $body.html()
    expect(html.includes('checkout/xpay-payment') || /pay with card|xpay/i.test($body.text()), 'XPay/card method').to.eq(
      true,
    )
    expect(html.includes('checkout/offline') || /offline|bank|transfer/i.test($body.text()), 'offline method').to.eq(
      true,
    )
  })
}

export const selectXPayPaymentMethod = () => {
  cy.get('body').then(($body) => {
    const hasTab = $body
      .find('a[href*="xpay"], a[href*="card"], [data-toggle="tab"]')
      .filter((_, el) => /card|xpay|online|visa|mastercard|بطاقة/i.test(el.textContent || ''))
      .filter(':visible').length
    if (!hasTab) return
    cy.contains('a[href*="xpay"], a[href*="card"], [data-toggle="tab"]', /card|xpay|online|visa|mastercard|بطاقة/i)
      .filter(':visible')
      .first()
      .click({ force: true })
  })
}

export const syncGatewayAmountFromCheckout = () => {
  cy.get('body').then(($body) => {
    const amt =
      $body.find('#selected_payment_amount').val() ||
      $body.find('input[name="selected_payment_amount"]').first().val() ||
      ''
    if (!amt) return
    $body.find('.gateway-payment-amount').each((_, el) => {
      el.value = amt
    })
    $body.find('.gateway-payment-type').each((_, el) => {
      if (!el.value) el.value = 'full'
    })
  })
}

export const clickXPayPayButton = () => {
  selectXPayPaymentMethod()
  syncGatewayAmountFromCheckout()

  // Terminal click only — submit navigates away; never chain after this.
  cy.get('#xpay-payment-form-card button[type="submit"]:visible', { timeout: 15000 })
    .first()
    .click({ force: true })
}

export const clickOfflinePayButton = () => {
  cy.get('body').then(($body) => {
    if (!$body.find('a[href="#payment-tab-offline"]').length) return
    cy.get('a[href="#payment-tab-offline"]').first().click({ force: true })
  })

  syncGatewayAmountFromCheckout()

  cy.get('#offline-payment-form-btn:visible, form[action*="checkout/offline"] button[type="submit"]:visible', {
    timeout: 15000,
  })
    .first()
    .click({ force: true })
}

/** Mentora → hosted XPay redirect (does not fill the card form). */
export const initiateXPayFromMentora = () => {
  cy.intercept('POST', '**/checkout/xpay-payment').as('xpayPost')
  clickXPayPayButton()
  cy.url({ timeout: 90000 }).should('match', XPAY_REDIRECT_RE)
}

export const waitForXPayRedirect = () => {
  cy.url({ timeout: 90000 }).should('match', XPAY_REDIRECT_RE)
}

export const assertReturnedToMentora = () => {
  cy.url({ timeout: 120000 }).should('include', 'dev.mentoraeg.com')
  cy.url().should('not.match', XPAY_REDIRECT_RE)
}

/**
 * Complete hosted checkout on checkout.xpay.app (cross-origin).
 * Only used when XPAY_FULL_E2E is enabled.
 */
export const completeXPayHostedCheckout = ({
  cardNumber,
  expiry,
  cvv = XPAY_CVV.match,
  cardholder = 'Cypress Test',
}) => {
  cy.origin(
    XPAY_ORIGIN,
    { args: { cardNumber, expiry, cvv, cardholder } },
    ({ cardNumber, expiry, cvv, cardholder }) => {
      cy.on('uncaught:exception', (err) => {
        if (/Minified React error #418|react\.dev\/errors\/418|Hydration failed/i.test(err.message)) {
          return false
        }
      })

      const [mm, yy] = expiry.split('/')
      const digits = cardNumber.replace(/\s/g, '')

      cy.get('body', { timeout: 30000 }).should('be.visible')

      // Break click/clear/type into separate queries — XPay re-renders on focus
      // and chaining .click().clear().type() hits "subject no longer attached".
      const cardSel =
        'input[name*="card" i], input[autocomplete="cc-number"], input[placeholder*="card" i], input[inputmode="numeric"]'
      cy.get(cardSel).filter(':visible').first().clear({ force: true })
      cy.get(cardSel).filter(':visible').first().type(digits, { force: true })

      cy.get('body').then(($body) => {
        const hasMonthYear =
          $body.find('input[name*="month" i], input[autocomplete="cc-exp-month"]').filter(':visible').length &&
          $body.find('input[name*="year" i], input[autocomplete="cc-exp-year"]').filter(':visible').length
        const hasCombined = $body
          .find('input[name*="exp" i], input[placeholder*="MM / YY" i], input[autocomplete="cc-exp"]')
          .filter(':visible').length

        if (hasMonthYear) {
          cy.get('input[name*="month" i], input[autocomplete="cc-exp-month"]')
            .filter(':visible')
            .first()
            .clear({ force: true })
          cy.get('input[name*="month" i], input[autocomplete="cc-exp-month"]')
            .filter(':visible')
            .first()
            .type(mm, { force: true })
          cy.get('input[name*="year" i], input[autocomplete="cc-exp-year"]')
            .filter(':visible')
            .first()
            .clear({ force: true })
          cy.get('input[name*="year" i], input[autocomplete="cc-exp-year"]')
            .filter(':visible')
            .first()
            .type(yy, { force: true })
        } else if (hasCombined) {
          cy.get('input[name*="exp" i], input[placeholder*="MM / YY" i], input[autocomplete="cc-exp"]')
            .filter(':visible')
            .first()
            .clear({ force: true })
          cy.get('input[name*="exp" i], input[placeholder*="MM / YY" i], input[autocomplete="cc-exp"]')
            .filter(':visible')
            .first()
            .type(`${mm}/${yy}`, { force: true })
        } else {
          cy.get('input:visible').eq(1).clear({ force: true })
          cy.get('input:visible').eq(1).type(`${mm}${yy}`, { force: true })
        }
      })

      const cvvSel =
        'input[name*="cvc" i], input[name*="cvv" i], input[autocomplete="cc-csc"], input[placeholder*="CVV" i]'
      cy.get(cvvSel).filter(':visible').first().clear({ force: true })
      cy.get(cvvSel).filter(':visible').first().type(cvv, { force: true })

      cy.get('body').then(($body) => {
        if (
          !$body
            .find('input[name*="name" i], input[autocomplete="cc-name"], input[placeholder*="name" i]')
            .filter(':visible').length
        ) {
          return
        }
        cy.get('input[name*="name" i], input[autocomplete="cc-name"], input[placeholder*="name" i]')
          .filter(':visible')
          .first()
          .clear({ force: true })
        cy.get('input[name*="name" i], input[autocomplete="cc-name"], input[placeholder*="name" i]')
          .filter(':visible')
          .first()
          .type(cardholder, { force: true })
      })

      cy.contains('button, [type="submit"]', /pay|complete|confirm|submit|checkout/i, { timeout: 20000 })
        .filter(':visible')
        .first()
        .click({ force: true })
    },
  )
}
