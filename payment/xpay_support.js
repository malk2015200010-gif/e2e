import './soft_mode.js'

/**
 * Payment / XPay helpers for Mentora checkout (dev.mentoraeg.com)
 *
 * Mentora-side flows are the default for CI / "run all specs".
 * Full hosted-card E2E on checkout.xpay.app only runs when
 * Cypress.expose('XPAY_FULL_E2E') is set.
 *
 * Test cards (XPay test mode only — used by optional full E2E):
 *   NBE Mastercard EGP  — 5123 4500 0000 0008
 *   Banque Misr Visa    — 4508 7500 1574 1019
 *   International MC USD — 2223 0000 0000 0007
 *
 * Expiry: 01/39 APPROVED | 05/39 DECLINED | 01/27 INSUFFICIENT_FUNDS
 * CVV: 100 MATCH
 */

import { getAppBase, loginAndVisit } from '../../support/navigation.js'
import { HTTP_AUTH, basicAuth, STUDENTS } from '../../support/users.js'

export const BASE = () => getAppBase()
export const AUTH = HTTP_AUTH

/** Student without pending offline payments (probed on live). */
export const XPAY_CHECKOUT_STUDENT =
  STUDENTS.find(
    (s) => s.email === (Cypress.expose('XPAY_STUDENT_EMAIL') || 'malk2015200010j@gmail.com'),
  ) ||
  STUDENTS.find((s) => s.email === 'malk2015200010d@gmail.com') ||
  STUDENTS[0]

/** Student that already has pending offline payments — for offline/pending assertions. */
export const OFFLINE_PENDING_STUDENT =
  STUDENTS.find((s) => s.email === 'studentbuysession@demo.com') ||
  STUDENTS.find((s) => s.email === 'malk2015200010q@gmail.com') ||
  XPAY_CHECKOUT_STUDENT

/** Paid non-PPS-style course that yields amount > 0 without session picks (probed). */
export const PREFERRED_COURSE_ID = String(Cypress.expose('XPAY_COURSE_ID') || '423')

export const XPAY_ORIGIN = 'https://checkout.xpay.app'
export const XPAY_REDIRECT_RE = /checkout\.xpay\.app|xpaycheckout\.com/i

export const PENDING_MSG_RE =
  /already have a pending payment|pending payment|please wait/i

const EMPTY_CART_COPY_RE =
  /there is nothing to checkout|your cart is empty\.?|cart is empty\.?|السلة فارغة|سلة\s*فارغ/i

const VISIT_TIMEOUT = 120000

/** Suppress cookie-consent bar so it cannot intercept cart/checkout clicks. */
const suppressCookieConsentBar = () => {
  cy.setCookie('mentora_analytics_consent', 'granted', { domain: new URL(BASE()).hostname })
}

export const go = (path, opts = {}) => {
  suppressCookieConsentBar()
  const target = path.startsWith('/') ? path : `/${path}`
  return cy.visit(`${BASE()}${target}`, {
    auth: basicAuth(),
    failOnStatusCode: false,
    timeout: VISIT_TIMEOUT,
    retryOnNetworkFailure: true,
    ...opts,
  })
}

export const loginCheckoutStudent = (user = XPAY_CHECKOUT_STUDENT) =>
  loginAndVisit(user, '/dashboard')

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

/**
 * Cart occupancy for checkout. Do not scan full $body.text() — Debugbar / GA /
 * Arabic "سلة" in the nav can false-empty a full cart (or hide a real empty state).
 * Positive signals: amount, XPay/offline forms. Empty = visible empty-state copy.
 */
const checkoutSurfaceText = ($body) => {
  const clone = $body.clone()
  clone
    .find(
      '#phpdebugbar, .phpdebugbar, [id*="phpdebugbar"], [class*="phpdebugbar"], script, style, noscript, iframe',
    )
    .remove()
  const $main = clone
    .find('main, #main, .checkout, .checkout-page, .cart-page, .page-content, #content')
    .first()
  return ($main.length ? $main : clone).text()
}

export const cartHasItems = ($body) => {
  const surface = checkoutSurfaceText($body)
  if (EMPTY_CART_COPY_RE.test(surface)) return false

  const amtEl = $body.find('#selected_payment_amount, input[name="selected_payment_amount"]').first()
  const amt = amtEl.length ? Number(String(amtEl.val() || '0').replace(/,/g, '')) : 0
  if (Number.isFinite(amt) && amt > 0) return true

  if ($body.find('.cart-item, [class*="cart-item"], [class*="checkout-item"]').length) {
    return true
  }

  // Payment forms only count when checkout is clearly not the empty-state page.
  if (
    amtEl.length &&
    amt > 0 &&
    $body.find(
      'form[action*="checkout/xpay-payment"], #xpay-payment-form-card, form[action*="checkout/offline"]',
    ).length
  ) {
    return true
  }

  return false
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
    url: `${BASE()}/remove-cart`,
    auth: basicAuth(),
    form: true,
    failOnStatusCode: false,
    body: {},
  })
}

const extractCsrf = (html) => {
  const text = typeof html === 'string' ? html : ''
  const tokenMatch = text.match(/name="_token"\s+value="([^"]+)"/) || text.match(/<meta name="csrf-token" content="([^"]+)"/)
  return tokenMatch ? tokenMatch[1] : ''
}

const extractCourseIds = (html) => {
  const ids = []
  const re = /data-course-id=["'](\d+)["']/g
  let m
  const text = typeof html === 'string' ? html : ''
  while ((m = re.exec(text))) {
    if (!ids.includes(m[1])) ids.push(m[1])
  }
  return ids
}

const addSucceeded = (res) => {
  if (![200, 302].includes(res.status)) return false
  let body = res.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      return true
    }
  }
  if (body && typeof body === 'object' && 'success' in body) {
    return body.success === 1 || body.success === true
  }
  return true
}

const postAddToCart = (token, courseId) =>
  cy.request({
    method: 'POST',
    url: `${BASE()}/add-to-cart`,
    auth: basicAuth(),
    form: true,
    failOnStatusCode: false,
    timeout: VISIT_TIMEOUT,
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      Accept: 'application/json',
    },
    body: {
      _token: token,
      course_id: String(courseId),
    },
  })

/**
 * Always POST a known paid course via /add-to-cart in the current Cypress
 * session (cart is cookie-jar scoped). CSRF comes from GET /courses in the
 * same jar — do not use cy.task('httpGet').
 */
export const addPaidCourseToCart = (courseId) => {
  const preferred = String(courseId || Cypress.expose('XPAY_COURSE_ID') || PREFERRED_COURSE_ID || '423')

  return cy
    .request({
      method: 'GET',
      url: `${BASE()}/courses`,
      auth: basicAuth(),
      failOnStatusCode: false,
      timeout: VISIT_TIMEOUT,
    })
    .then((getRes) => {
      const html = typeof getRes.body === 'string' ? getRes.body : ''
      const token = extractCsrf(html)
      expect(token, 'CSRF token from GET /courses').to.have.length.greaterThan(10)

      const discovered = extractCourseIds(html)
      const candidates = [preferred, ...discovered.filter((id) => id !== preferred)]

      const attempt = (ids) => {
        const id = ids[0]
        if (!id) {
          throw new Error(
            `add-to-cart failed for preferred course ${preferred} and no fallback data-course-id succeeded`,
          )
        }
        return postAddToCart(token, id).then((res) => {
          if (addSucceeded(res)) {
            Cypress.log({ name: 'add-to-cart', message: `success for course ${id}` })
            return { courseId: id }
          }
          Cypress.log({
            name: 'add-to-cart',
            message: `failed for course ${id} (HTTP ${res.status}) — trying next`,
          })
          return attempt(ids.slice(1))
        })
      }

      return attempt(candidates)
    })
}

/**
 * Always POST a paid course after login, then open /checkout and assert items.
 * Do not skip the POST based on a listing-page cart badge.
 */
export const ensurePaidCourseInCart = () => {
  addPaidCourseToCart()
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
  cy.url({ timeout: 20000 }).should('include', '/checkout')

  cy.get('body', { timeout: 15000 }).then(function ($body) {
    if (PENDING_MSG_RE.test(checkoutSurfaceText($body))) {
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

  cy.get('body').then(($body) => {
    if ($body.find('#xpay-payment-form-card button[type="submit"]:visible').length) return
    const tab = $body
      .find('a, button, [data-toggle="tab"]')
      .filter((_, el) => /pay with card|card|xpay|بطاقة/i.test(el.textContent || ''))
      .filter(':visible')
      .first()
    if (tab.length) cy.wrap(tab).click({ force: true })
  })

  // Terminal click only — submit navigates away; never chain after this.
  cy.get(
    '#xpay-payment-form-card button[type="submit"]:visible, form[action*="checkout/xpay-payment"] button[type="submit"]:visible',
    { timeout: 20000 },
  )
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
