/**
 * XPay / Mentora checkout — E2E
 *
 * Default suite (always runs in full project run):
 *   Mentora-side cart → checkout → payment methods → redirect to XPay hosted URL
 *
 * Optional full hosted-card suite (skipped unless CYPRESS_XPAY_FULL_E2E=1):
 *   Completes card entry on checkout.xpay.app (APPROVED / DECLINED / …)
 *
 * Preferred student: malk2015200010j@gmail.com (no pending offline payments)
 * Preferred course: 423 (non-zero amount without session picks)
 */

import {
  XPAY_CARDS,
  XPAY_CVV,
  XPAY_EXPIRY,
  XPAY_ORIGIN,
  XPAY_REDIRECT_RE,
  assertCheckoutPaymentMethodsVisible,
  assertReturnedToMentora,
  completeXPayHostedCheckout,
  go,
  initiateXPayFromMentora,
  isXPayReactHydrationError,
  loginCheckoutStudent,
  openMentoraCheckout,
} from './xpay_support.js'

describe('Payment — Mentora checkout (XPay ready)', () => {
  beforeEach(() => {
    cy.on('uncaught:exception', (err) => {
      if (isXPayReactHydrationError(err.message)) return false
    })
    loginCheckoutStudent()
  })

  it('XPAY-005 | Paid course checkout shows XPay + offline payment methods', function () {
    openMentoraCheckout()
    assertCheckoutPaymentMethodsVisible()
    cy.get('#xpay-payment-form-card, form[action*="checkout/xpay-payment"]').should('exist')
    cy.contains(/pay with card/i).should('exist')
  })

  it('XPAY-005b | Submitting card payment redirects to hosted XPay checkout', function () {
    openMentoraCheckout()
    initiateXPayFromMentora()
    cy.url().should('match', XPAY_REDIRECT_RE)
    cy.url().should('include', '/c/')
  })

  it('XPAY-009 | Guest cannot open checkout — redirected to login', () => {
    cy.clearCookies()
    cy.clearLocalStorage()
    go('/checkout')
    cy.url({ timeout: 20000 }).should('include', '/login')
  })

  it('XPAY-042 | Checkout displays a server-side total before XPay redirect', function () {
    openMentoraCheckout()
    cy.get('#selected_payment_amount, input[name="selected_payment_amount"]')
      .first()
      .invoke('val')
      .then((val) => {
        const amount = Number(String(val || '0').replace(/,/g, ''))
        expect(amount, 'selected_payment_amount').to.be.greaterThan(0)
      })
    cy.get('body').invoke('text').should('match', /EGP\s*[\d,.]+/i)
  })
})

describe('XPay Hosted Checkout — full card E2E (optional)', () => {
  beforeEach(function () {
    if (!Cypress.env('XPAY_FULL_E2E')) {
      cy.log('SKIP: set CYPRESS_XPAY_FULL_E2E=1 to run hosted card completion tests')
      this.skip()
    }

    cy.on('uncaught:exception', (err) => {
      if (isXPayReactHydrationError(err.message)) return false
    })
    loginCheckoutStudent()
  })

  it('XPAY-E2E-001 | APPROVED — NBE Mastercard EGP (exp 01/39, CVV 100)', function () {
    openMentoraCheckout()
    initiateXPayFromMentora()

    completeXPayHostedCheckout({
      cardNumber: XPAY_CARDS.nbeMastercardEGP.number,
      expiry: XPAY_EXPIRY.approved,
      cvv: XPAY_CVV.match,
    })

    assertReturnedToMentora()
    cy.url().should('match', /success|complete|thank|dashboard|checkout|payment/i)
    cy.get('body').should('not.contain.text', 'Unhandled Exception')
  })

  it('XPAY-E2E-002 | DECLINED — same card, exp 05/39', function () {
    openMentoraCheckout()
    initiateXPayFromMentora()

    completeXPayHostedCheckout({
      cardNumber: XPAY_CARDS.nbeMastercardEGP.number,
      expiry: XPAY_EXPIRY.declined,
      cvv: XPAY_CVV.match,
    })

    assertReturnedToMentora()
    cy.get('body').should('not.contain.text', 'Unhandled Exception')
  })

  it('XPAY-E2E-003 | INSUFFICIENT_FUNDS — exp 01/27', function () {
    openMentoraCheckout()
    initiateXPayFromMentora()

    completeXPayHostedCheckout({
      cardNumber: XPAY_CARDS.banqueMisrVisaEGP.number,
      expiry: XPAY_EXPIRY.insufficientFunds,
      cvv: XPAY_CVV.match,
    })

    assertReturnedToMentora()
    cy.get('body').should('not.contain.text', 'Unhandled Exception')
  })

  it('XPAY-E2E-004 | International USD card — exp 01/39', function () {
    openMentoraCheckout()
    initiateXPayFromMentora()

    completeXPayHostedCheckout({
      cardNumber: XPAY_CARDS.internationalMastercardUSD.number,
      expiry: XPAY_EXPIRY.approved,
      cvv: XPAY_CVV.match,
    })

    assertReturnedToMentora()
    cy.get('body').should('not.contain.text', 'Unhandled Exception')
  })

  it('XPAY-E2E-005 | cy.origin smoke — direct XPay session URL', function () {
    const sessionPath = Cypress.env('XPAY_CHECKOUT_PATH')
    if (!sessionPath) {
      cy.log('SKIP: set CYPRESS_XPAY_CHECKOUT_PATH=/c/cs_test_xxx')
      this.skip()
    }

    cy.visit(`${XPAY_ORIGIN}${sessionPath}`, { failOnStatusCode: false })

    completeXPayHostedCheckout({
      cardNumber: XPAY_CARDS.nbeMastercardEGP.number,
      expiry: XPAY_EXPIRY.approved,
      cvv: XPAY_CVV.match,
    })

    cy.url({ timeout: 120000 }).should('not.match', XPAY_REDIRECT_RE)
  })
})
