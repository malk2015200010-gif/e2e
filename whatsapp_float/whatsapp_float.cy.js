/**
 * WhatsApp Floating Button — MEN-2380
 *
 * Story: Show a fixed WhatsApp button on all public pages. Clicking it opens
 * a chat with Mentora via the existing wa.me URL. Users can dismiss it with
 * a close button.
 *
 * Business update: the icon must be visible again on reload (dismissal is
 * page-instance only — it does NOT persist across reloads or new visits).
 *
 * Covers MEN-2396 … MEN-2410 (see whatsapp_float_test_cases.csv).
 */

import {
  goFresh,
  go,
  widget,
  assertWidgetVisible,
  assertWidgetNotVisible,
  dismissWidget,
  assertDismissButtonAccessible,
  assertWaMeLink,
  assertWaMeGreetingText,
  getDismissedFlag,
  loginStudent,
  loginAdmin,
  assertOnAdminPanel,
  PUBLIC_PAGES,
  WIDGET_SEL,
  LINK_SEL,
  ICON_SEL,
} from './whatsapp_float_support.js'

describe('WhatsApp Floating Button', () => {
  // ─── Visibility on public pages ────────────────────────────────────────────

  it('MEN-2396 | [Positive] Floating button is visible on the homepage for a guest', () => {
    goFresh('')
    assertWidgetVisible()
  })

  it('MEN-2397 | [Positive] Floating button is shown across all public pages', () => {
    PUBLIC_PAGES.forEach((page) => {
      goFresh(page)
      assertWidgetVisible()
    })
  })

  it('MEN-2398 | [Positive] Button is a fixed-position widget outside normal page flow', () => {
    goFresh('')
    widget()
      .should('have.attr', 'role', 'complementary')
      .and('have.css', 'position', 'fixed')
  })

  it('MEN-2399 | [Positive] Button displays the WhatsApp brand icon', () => {
    goFresh('')
    cy.get(ICON_SEL, { timeout: 15000 }).should('exist')
  })

  // ─── Click-through behavior (wa.me link) ───────────────────────────────────

  it('MEN-2400 | [Positive] Clicking the button opens a chat via the existing wa.me URL', () => {
    goFresh('')
    assertWaMeLink()
  })

  it('MEN-2401 | [Positive] WhatsApp link opens in a new tab without exposing opener', () => {
    goFresh('')
    cy.get(LINK_SEL, { timeout: 15000 })
      .should('have.attr', 'target', '_blank')
      // three-arg form above keeps the element as subject; one-arg form
      // below switches the subject to the "rel" attribute's string value.
      .and('have.attr', 'rel')
      .should('match', /noopener/)
  })

  it('MEN-2402 | [Positive] wa.me link carries a pre-filled greeting message', () => {
    goFresh('')
    assertWaMeGreetingText()
  })

  // ─── Dismiss (close) behavior ───────────────────────────────────────────────

  it('MEN-2403 | [Positive] Dismiss (close) button is present and accessible', () => {
    goFresh('')
    assertDismissButtonAccessible()
  })

  it('MEN-2404 | [Positive] Clicking dismiss immediately hides the floating button', () => {
    goFresh('')
    assertWidgetVisible()
    dismissWidget()
    assertWidgetNotVisible()
  })

  it('MEN-2405 | [Positive] Icon is visible again after reload (dismissal does not persist)', () => {
    // Business request: icon must be visible again on reload.
    goFresh('')
    dismissWidget()
    assertWidgetNotVisible()
    cy.reload()
    assertWidgetVisible()
  })

  it('MEN-2406 | [Positive] Icon shows again when visiting another public page after dismiss', () => {
    goFresh('')
    dismissWidget()
    assertWidgetNotVisible()
    go('courses')
    assertWidgetVisible()
    go('about-us')
    assertWidgetVisible()
  })

  it('MEN-2410 | [Positive] Dismiss does not persist a localStorage flag across reloads', () => {
    goFresh('')
    dismissWidget()
    assertWidgetNotVisible()
    // Legacy key must not keep the widget hidden after reload.
    getDismissedFlag().should('not.eq', '1')
    cy.reload()
    assertWidgetVisible()
  })

  // ─── Authenticated users / other layouts ───────────────────────────────────

  it('MEN-2407 | [Positive] Floating button is also shown to authenticated users', () => {
    loginStudent()
    assertWidgetVisible()
  })

  it('MEN-2408 | [Positive] Button and its labels are localized in Arabic', () => {
    cy.clearCookies()
    go('locale/ar') // redirects to the homepage rendered in Arabic
    cy.get('html', { timeout: 15000 }).should('have.attr', 'lang', 'ar')
    widget()
      .should('be.visible')
      .and('have.attr', 'aria-label')
      .should('match', /[\u0600-\u06FF]/)
    assertWaMeGreetingText().should((text) => {
      expect(text).to.match(/[\u0600-\u06FF]/)
    })
  })

  it('MEN-2409 | [Negative] Floating button is not shown inside the admin panel layout', () => {
    loginAdmin()
    assertOnAdminPanel()
    cy.get(WIDGET_SEL).should('not.exist')
  })
})
